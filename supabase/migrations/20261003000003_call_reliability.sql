-- Call reliability: recover from interrupted browsers and give mobile users
-- enough time to answer without allowing an accepted call to block future ones.

alter table public.calls
  add column if not exists last_activity_at timestamptz not null default now();

update public.calls
set last_activity_at = coalesce(answered_at, created_at, now())
where last_activity_at is null;

alter table public.calls
  alter column ring_expires_at set default (now() + interval '60 seconds');

create index if not exists calls_accepted_activity_idx
  on public.calls(last_activity_at)
  where status = 'accepted';

create or replace function public.create_call(requested_call_type text)
returns public.calls
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_couple_id uuid;
  target_partner_id uuid;
  member_count integer;
  actor_member_count integer;
  new_call public.calls;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if requested_call_type is null or requested_call_type not in ('audio', 'video') then
    raise exception 'invalid_call_type' using errcode = 'P0001';
  end if;

  select cm.couple_id into target_couple_id
  from public.couple_members cm
  where cm.user_id = actor_id;

  if target_couple_id is null then
    raise exception 'couple_not_found' using errcode = 'P0001';
  end if;

  -- Serialize both participants before closing stale lifecycle rows or creating a ring.
  perform pg_advisory_xact_lock(hashtext(target_couple_id::text));

  select count(*), count(*) filter (where cm.user_id = actor_id)
  into member_count, actor_member_count
  from public.couple_members cm
  where cm.couple_id = target_couple_id;

  if member_count <> 2 or actor_member_count <> 1 then
    raise exception 'relationship_no_longer_active' using errcode = 'P0001';
  end if;

  select cm.user_id into target_partner_id
  from public.couple_members cm
  where cm.couple_id = target_couple_id and cm.user_id <> actor_id;

  if target_partner_id is null then
    raise exception 'partner_not_found' using errcode = 'P0001';
  end if;

  update public.calls
  set status = 'missed', ended_at = now()
  where couple_id = target_couple_id
    and status = 'ringing'
    and ring_expires_at <= now();

  -- A connected browser checks in every 30 seconds. Five minutes leaves room
  -- for a backgrounded phone while still releasing calls abandoned by a crash.
  update public.calls
  set status = 'ended', ended_at = now()
  where couple_id = target_couple_id
    and status = 'accepted'
    and last_activity_at <= now() - interval '5 minutes';

  insert into public.calls (couple_id, caller_id, callee_id, room_name, call_type, status, ring_expires_at, last_activity_at)
  values (target_couple_id, actor_id, target_partner_id, '', requested_call_type, 'ringing', now() + interval '60 seconds', now())
  returning * into new_call;

  return new_call;
exception
  when unique_violation then
    raise exception 'call_already_exists' using errcode = 'P0001';
end;
$$;

create or replace function public.expire_stale_calls()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  expired_count integer;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  update public.calls
  set
    status = case when status = 'ringing' then 'missed' else 'ended' end,
    ended_at = now()
  where (caller_id = actor_id or callee_id = actor_id)
    and (
      (status = 'ringing' and ring_expires_at <= now())
      or (status = 'accepted' and last_activity_at <= now() - interval '5 minutes')
    );

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

create or replace function public.touch_call(target_call_id uuid)
returns public.calls
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  call_record public.calls;
  updated_call public.calls;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into call_record
  from public.calls
  where id = target_call_id
  for update;

  if call_record.id is null then
    raise exception 'call_not_found' using errcode = 'P0001';
  end if;
  if actor_id <> call_record.caller_id and actor_id <> call_record.callee_id then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if call_record.status <> 'accepted' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if (select count(*) from public.couple_members where couple_id = call_record.couple_id) <> 2
    or not exists (
      select 1 from public.couple_members
      where couple_id = call_record.couple_id and user_id = actor_id
    ) then
    raise exception 'relationship_no_longer_active' using errcode = '42501';
  end if;

  update public.calls
  set last_activity_at = now()
  where id = target_call_id
  returning * into updated_call;

  return updated_call;
end;
$$;

revoke all on function public.touch_call(uuid) from public, anon;
grant execute on function public.touch_call(uuid) to authenticated;
