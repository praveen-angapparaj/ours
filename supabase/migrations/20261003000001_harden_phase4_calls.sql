-- Phase 4 hardening: keep call identity, lifecycle, and LiveKit authorization server-owned.

alter table public.calls
  add column if not exists ring_expires_at timestamptz not null default (now() + interval '35 seconds');

update public.calls
set ring_expires_at = created_at + interval '35 seconds'
where ring_expires_at is null;

alter table public.calls
  drop constraint if exists calls_call_type_check,
  add constraint calls_call_type_check check (call_type = 'audio');

alter table public.calls
  drop constraint if exists calls_status_timestamps_check,
  add constraint calls_status_timestamps_check check (
    (status = 'ringing' and answered_at is null and ended_at is null)
    or (status = 'accepted' and answered_at is not null and ended_at is null)
    or (status in ('declined', 'cancelled', 'missed') and answered_at is null and ended_at is not null)
    or (status = 'ended' and answered_at is not null and ended_at is not null)
  ) not valid;

create unique index if not exists calls_room_name_idx on public.calls(room_name);
create index if not exists calls_participant_active_idx on public.calls(caller_id, status) where status in ('ringing', 'accepted');
create index if not exists calls_callee_active_idx on public.calls(callee_id, status) where status in ('ringing', 'accepted');

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
    new.call_type := 'audio';
  end if;
  return new;
end;
$$;

drop trigger if exists calls_set_identity on public.calls;
create trigger calls_set_identity
before insert or update on public.calls
for each row execute function public.set_call_identity();

drop function if exists public.update_call_status(uuid, text);

create or replace function public.create_call()
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
  values (target_couple_id, actor_id, target_partner_id, '', 'audio', 'ringing', now() + interval '35 seconds')
  returning * into new_call;

  return new_call;
exception
  when unique_violation then
    raise exception 'call_already_exists' using errcode = 'P0001';
end;
$$;

create function public.update_call_status(target_call_id uuid, new_status text)
returns public.calls
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  call_record public.calls;
  member_count integer;
  actor_is_member boolean;
  caller_is_member boolean;
  callee_is_member boolean;
  updated_call public.calls;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into call_record from public.calls where id = target_call_id for update;
  if call_record.id is null then
    raise exception 'call_not_found' using errcode = 'P0001';
  end if;

  if actor_id <> call_record.caller_id and actor_id <> call_record.callee_id then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select
    count(*),
    coalesce(bool_or(cm.user_id = actor_id), false),
    coalesce(bool_or(cm.user_id = call_record.caller_id), false),
    coalesce(bool_or(cm.user_id = call_record.callee_id), false)
  into member_count, actor_is_member, caller_is_member, callee_is_member
  from public.couple_members cm
  where cm.couple_id = call_record.couple_id;

  if member_count <> 2 or not actor_is_member or not caller_is_member or not callee_is_member then
    raise exception 'relationship_no_longer_active' using errcode = '42501';
  end if;

  if new_status = 'accepted' then
    if actor_id <> call_record.callee_id then
      raise exception 'only_callee_can_accept' using errcode = 'P0001';
    end if;
    if call_record.status <> 'ringing' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    if call_record.ring_expires_at <= now() then
      update public.calls set status = 'missed', ended_at = now() where id = target_call_id returning * into updated_call;
      return updated_call;
    end if;
    update public.calls set status = 'accepted', answered_at = now() where id = target_call_id returning * into updated_call;

  elsif new_status = 'declined' then
    if actor_id <> call_record.callee_id then
      raise exception 'only_callee_can_decline' using errcode = 'P0001';
    end if;
    if call_record.status <> 'ringing' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.calls set status = 'declined', ended_at = now() where id = target_call_id returning * into updated_call;

  elsif new_status = 'cancelled' then
    if actor_id <> call_record.caller_id then
      raise exception 'only_caller_can_cancel' using errcode = 'P0001';
    end if;
    if call_record.status <> 'ringing' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.calls set status = 'cancelled', ended_at = now() where id = target_call_id returning * into updated_call;

  elsif new_status = 'missed' then
    if actor_id <> call_record.caller_id then
      raise exception 'only_caller_can_mark_missed' using errcode = 'P0001';
    end if;
    if call_record.status <> 'ringing' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.calls set status = 'missed', ended_at = now() where id = target_call_id returning * into updated_call;

  elsif new_status = 'ended' then
    if call_record.status <> 'accepted' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.calls set status = 'ended', ended_at = now() where id = target_call_id returning * into updated_call;

  else
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  return updated_call;
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
  set status = 'missed', ended_at = now()
  where status = 'ringing'
    and ring_expires_at <= now()
    and (caller_id = actor_id or callee_id = actor_id);

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

alter table public.calls enable row level security;

drop policy if exists "calls_visible_to_participants" on public.calls;
create policy "calls_visible_to_participants" on public.calls
for select to authenticated
using (auth.uid() = caller_id or auth.uid() = callee_id);

revoke all on table public.calls from anon;
revoke insert, update, delete on table public.calls from authenticated;
grant select on table public.calls to authenticated;

revoke all on function public.create_call() from public, anon;
grant execute on function public.create_call() to authenticated;
revoke all on function public.update_call_status(uuid, text) from public, anon;
grant execute on function public.update_call_status(uuid, text) to authenticated;
revoke all on function public.expire_stale_calls() from public, anon;
grant execute on function public.expire_stale_calls() to authenticated;
