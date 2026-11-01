-- Preserve healthy calls through normal browser backgrounding while still
-- releasing a room abandoned by every client. Heartbeats are best-effort on
-- mobile, so five minutes was short enough to end valid suspended sessions.

-- The original no-argument RPC was superseded by create_call(text). Removing
-- the obsolete overload prevents callers from bypassing the current lifecycle
-- implementation by selecting an older function signature.
drop function if exists public.create_call();

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

  update public.calls
  set status = 'ended', ended_at = now()
  where couple_id = target_couple_id
    and status = 'accepted'
    and last_activity_at <= now() - interval '30 minutes';

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
      or (status = 'accepted' and last_activity_at <= now() - interval '30 minutes')
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
    or not exists (select 1 from public.couple_members where couple_id = call_record.couple_id and user_id = actor_id)
    or not exists (select 1 from public.couple_members where couple_id = call_record.couple_id and user_id = call_record.caller_id)
    or not exists (select 1 from public.couple_members where couple_id = call_record.couple_id and user_id = call_record.callee_id) then
    raise exception 'relationship_no_longer_active' using errcode = '42501';
  end if;

  update public.calls
  set last_activity_at = now()
  where id = target_call_id
  returning * into updated_call;

  return updated_call;
end;
$$;

revoke all on function public.create_call(text) from public, anon;
grant execute on function public.create_call(text) to authenticated;
revoke all on function public.expire_stale_calls() from public, anon;
grant execute on function public.expire_stale_calls() to authenticated;
revoke all on function public.touch_call(uuid) from public, anon;
grant execute on function public.touch_call(uuid) to authenticated;
