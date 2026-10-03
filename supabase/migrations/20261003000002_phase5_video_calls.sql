-- Phase 5: video calls remain part of the existing calls domain.
-- Existing audio history and the zero-argument RPC stay valid.

alter table public.calls
  drop constraint if exists calls_call_type_check,
  add constraint calls_call_type_check check (call_type in ('audio', 'video'));

create or replace function public.set_call_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;
  if tg_op = 'UPDATE' and new.room_name <> old.room_name then
    raise exception 'call_room_name_is_immutable' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    new.room_name := 'call_' || new.id::text;
    new.call_type := coalesce(new.call_type, 'audio');
  end if;
  return new;
end;
$$;

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

  if requested_call_type not in ('audio', 'video') then
    raise exception 'invalid_call_type' using errcode = 'P0001';
  end if;

  select cm.couple_id into target_couple_id
  from public.couple_members cm
  where cm.user_id = actor_id;

  if target_couple_id is null then
    raise exception 'couple_not_found' using errcode = 'P0001';
  end if;

  -- Serialize callers from the same couple before expiring an old ring or inserting a new one.
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

  insert into public.calls (couple_id, caller_id, callee_id, room_name, call_type, status, ring_expires_at)
  values (target_couple_id, actor_id, target_partner_id, '', requested_call_type, 'ringing', now() + interval '35 seconds')
  returning * into new_call;

  return new_call;
exception
  when unique_violation then
    raise exception 'call_already_exists' using errcode = 'P0001';
end;
$$;

-- Preserve the Phase 4 RPC for already-loaded or older clients.
create or replace function public.create_call()
returns public.calls
language sql
security definer
set search_path = public
as $$
  select public.create_call('audio'::text);
$$;

revoke all on function public.create_call(text) from public, anon;
grant execute on function public.create_call(text) to authenticated;
revoke all on function public.create_call() from public, anon;
grant execute on function public.create_call() to authenticated;
