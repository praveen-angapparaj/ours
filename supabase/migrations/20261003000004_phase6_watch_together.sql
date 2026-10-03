-- Phase 6: one durable, secure watch session per existing couple.

create table if not exists public.watch_sessions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null unique references public.couples(id) on delete cascade,
  provider text,
  media_id text,
  playback_state text not null default 'empty' check (playback_state in ('empty', 'paused', 'playing', 'ended')),
  position_seconds double precision not null default 0 check (position_seconds >= 0 and position_seconds <= 86400),
  state_version bigint not null default 0 check (state_version >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (playback_state = 'empty' and provider is null and media_id is null and position_seconds = 0)
    or (
      playback_state in ('paused', 'playing', 'ended')
      and provider = 'youtube'
      and media_id ~ '^[A-Za-z0-9_-]{11}$'
    )
  )
);

create index if not exists watch_sessions_couple_id_idx on public.watch_sessions(couple_id);

alter table public.watch_sessions enable row level security;

drop policy if exists "watch_sessions_visible_to_couple_members" on public.watch_sessions;
create policy "watch_sessions_visible_to_couple_members" on public.watch_sessions
for select to authenticated
using (public.is_couple_member(couple_id));

-- Session creation is server-owned so the browser never supplies a couple id.
create or replace function public.get_watch_session()
returns public.watch_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_couple_id uuid;
  member_count integer;
  session_row public.watch_sessions;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select couple_id into target_couple_id
  from public.couple_members
  where user_id = actor_id;

  if target_couple_id is null then
    raise exception 'couple_not_found' using errcode = 'P0001';
  end if;

  select count(*) into member_count
  from public.couple_members
  where couple_id = target_couple_id;

  if member_count <> 2 then
    raise exception 'relationship_no_longer_active' using errcode = 'P0001';
  end if;

  insert into public.watch_sessions (couple_id)
  values (target_couple_id)
  on conflict (couple_id) do nothing;

  select * into session_row
  from public.watch_sessions
  where couple_id = target_couple_id;

  return session_row;
end;
$$;

-- All meaningful control events take this atomic path. PostgreSQL assigns the
-- order and version, so two near-simultaneous partner actions converge safely.
create or replace function public.update_watch_session(
  requested_provider text,
  requested_media_id text,
  requested_playback_state text,
  requested_position_seconds double precision
)
returns public.watch_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_couple_id uuid;
  member_count integer;
  updated_session public.watch_sessions;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select couple_id into target_couple_id
  from public.couple_members
  where user_id = actor_id;

  if target_couple_id is null then
    raise exception 'couple_not_found' using errcode = 'P0001';
  end if;

  select count(*) into member_count
  from public.couple_members
  where couple_id = target_couple_id;

  if member_count <> 2 then
    raise exception 'relationship_no_longer_active' using errcode = 'P0001';
  end if;

  if requested_playback_state is null or requested_playback_state not in ('empty', 'paused', 'playing', 'ended') then
    raise exception 'invalid_watch_playback_state' using errcode = 'P0001';
  end if;
  if requested_position_seconds is null
    or requested_position_seconds < 0
    or requested_position_seconds > 86400
    or requested_position_seconds = 'Infinity'::double precision
    or requested_position_seconds = '-Infinity'::double precision
    or requested_position_seconds = 'NaN'::double precision then
    raise exception 'invalid_watch_position' using errcode = 'P0001';
  end if;

  if requested_playback_state = 'empty' then
    if requested_provider is not null or requested_media_id is not null or requested_position_seconds <> 0 then
      raise exception 'invalid_empty_watch_state' using errcode = 'P0001';
    end if;
  elsif requested_provider <> 'youtube'
    or requested_media_id is null
    or requested_media_id !~ '^[A-Za-z0-9_-]{11}$' then
    raise exception 'invalid_watch_media' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_couple_id::text));

  insert into public.watch_sessions (couple_id)
  values (target_couple_id)
  on conflict (couple_id) do nothing;

  update public.watch_sessions
  set
    provider = requested_provider,
    media_id = requested_media_id,
    playback_state = requested_playback_state,
    position_seconds = requested_position_seconds,
    state_version = state_version + 1,
    updated_by = actor_id,
    updated_at = now()
  where couple_id = target_couple_id
  returning * into updated_session;

  return updated_session;
end;
$$;

revoke all on table public.watch_sessions from anon;
revoke insert, update, delete on table public.watch_sessions from authenticated;
grant select on table public.watch_sessions to authenticated;

revoke all on function public.get_watch_session() from public, anon;
grant execute on function public.get_watch_session() to authenticated;
revoke all on function public.update_watch_session(text, text, text, double precision) from public, anon;
grant execute on function public.update_watch_session(text, text, text, double precision) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.watch_sessions;
exception when duplicate_object then null;
end;
$$;
