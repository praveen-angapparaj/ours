-- Phase 3: durable relationship data plus authorized ephemeral presence.
-- Deployment setting: Supabase Dashboard > Realtime > Settings > Allow public access must be disabled,
-- otherwise these private-channel authorization policies are not enforced.
alter table public.couples
  add column if not exists relationship_started_on date,
  add column if not exists couple_display_name text;

create or replace function public.update_relationship_date(new_date date)
returns table(id uuid, relationship_started_on date, couple_display_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_couple_id uuid;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if new_date is null then
    raise exception 'relationship_date_required' using errcode = 'P0001';
  end if;
  if new_date > current_date then
    raise exception 'relationship_date_in_future' using errcode = 'P0001';
  end if;

  select cm.couple_id into target_couple_id
  from public.couple_members cm
  where cm.user_id = actor_id;
  if target_couple_id is null then
    raise exception 'couple_not_found' using errcode = 'P0001';
  end if;

  return query
  update public.couples c
  set relationship_started_on = new_date
  where c.id = target_couple_id
  returning c.id, c.relationship_started_on, c.couple_display_name;
end;
$$;

revoke all on function public.update_relationship_date(date) from public, anon;
grant execute on function public.update_relationship_date(date) to authenticated;

-- Realtime topic authorization. A topic is never trusted merely because its UUID is known.
create or replace function public.can_access_couple_presence(channel_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  topic_couple_id uuid;
begin
  if channel_topic !~ '^couple:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:presence$' then
    return false;
  end if;
  topic_couple_id := split_part(channel_topic, ':', 2)::uuid;
  return exists (
    select 1 from public.couple_members cm
    where cm.couple_id = topic_couple_id and cm.user_id = auth.uid()
  );
end;
$$;

revoke all on function public.can_access_couple_presence(text) from public, anon;
grant execute on function public.can_access_couple_presence(text) to authenticated;

drop policy if exists "couple members receive private presence" on realtime.messages;
create policy "couple members receive private presence"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'presence'
  and public.can_access_couple_presence(realtime.topic())
);

drop policy if exists "couple members publish private presence" on realtime.messages;
create policy "couple members publish private presence"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'presence'
  and public.can_access_couple_presence(realtime.topic())
);

-- Database change feeds used for the paired profile and couple row only.
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.couples;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.couple_members;
exception when duplicate_object then null;
end;
$$;
