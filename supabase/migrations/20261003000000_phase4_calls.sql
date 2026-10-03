-- Phase 4: Audio Calling
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  caller_id uuid not null references auth.users(id) on delete restrict,
  callee_id uuid not null references auth.users(id) on delete restrict,
  room_name text not null,
  call_type text not null default 'audio' check (call_type in ('audio', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'accepted', 'declined', 'cancelled', 'missed', 'ended')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  check (caller_id != callee_id)
);

create unique index if not exists single_active_call_idx on public.calls(couple_id) where status in ('ringing', 'accepted');

alter table public.calls enable row level security;

drop policy if exists "calls_visible_to_participants" on public.calls;
create policy "calls_visible_to_participants" on public.calls
for select to authenticated using (auth.uid() = caller_id or auth.uid() = callee_id);

-- We revoke update and insert, and use RPCs for state transitions.
revoke insert, update on public.calls from authenticated;

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

  select cm.user_id into target_partner_id
  from public.couple_members cm
  where cm.couple_id = target_couple_id and cm.user_id != actor_id;

  if target_partner_id is null then
    raise exception 'partner_not_found' using errcode = 'P0001';
  end if;

  insert into public.calls (couple_id, caller_id, callee_id, room_name, status)
  values (
    target_couple_id,
    actor_id,
    target_partner_id,
    'call_' || gen_random_uuid()::text,
    'ringing'
  )
  returning * into new_call;

  return new_call;
exception
  when unique_violation then
    raise exception 'call_already_exists' using errcode = 'P0001';
end;
$$;

create or replace function public.update_call_status(target_call_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  call_record public.calls;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into call_record from public.calls where id = target_call_id for update;

  if call_record.id is null then
    raise exception 'call_not_found' using errcode = 'P0001';
  end if;

  if actor_id != call_record.caller_id and actor_id != call_record.callee_id then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if new_status = 'accepted' then
    if actor_id != call_record.callee_id then
      raise exception 'only_callee_can_accept' using errcode = 'P0001';
    end if;
    if call_record.status != 'ringing' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.calls set status = 'accepted', answered_at = now() where id = target_call_id;
  
  elsif new_status = 'declined' then
    if actor_id != call_record.callee_id then
      raise exception 'only_callee_can_decline' using errcode = 'P0001';
    end if;
    if call_record.status != 'ringing' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.calls set status = 'declined', ended_at = now() where id = target_call_id;

  elsif new_status = 'cancelled' then
    if actor_id != call_record.caller_id then
      raise exception 'only_caller_can_cancel' using errcode = 'P0001';
    end if;
    if call_record.status != 'ringing' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.calls set status = 'cancelled', ended_at = now() where id = target_call_id;

  elsif new_status = 'missed' then
    if call_record.status != 'ringing' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.calls set status = 'missed', ended_at = now() where id = target_call_id;

  elsif new_status = 'ended' then
    if call_record.status != 'accepted' and call_record.status != 'ringing' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.calls set status = 'ended', ended_at = now() where id = target_call_id;
  
  else
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

end;
$$;

revoke all on function public.create_call() from public, anon;
grant execute on function public.create_call() to authenticated;

revoke all on function public.update_call_status(uuid, text) from public, anon;
grant execute on function public.update_call_status(uuid, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.calls;
exception when duplicate_object then null;
end;
$$;
