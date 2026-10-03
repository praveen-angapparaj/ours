-- Low-latency, private Watch Together control messages. The database session
-- remains authoritative; this topic only removes Postgres Changes latency for
-- confirmed play, pause, seek, and video-selection updates.
-- Realtime Dashboard setting required: "Allow public access" must be disabled.

create or replace function public.can_access_couple_watch_sync(channel_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  topic_couple_id uuid;
begin
  if channel_topic !~ '^couple:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:watch-sync$' then
    return false;
  end if;

  topic_couple_id := split_part(channel_topic, ':', 2)::uuid;
  return exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = topic_couple_id
      and cm.user_id = auth.uid()
  );
end;
$$;

revoke all on function public.can_access_couple_watch_sync(text) from public, anon;
grant execute on function public.can_access_couple_watch_sync(text) to authenticated;

drop policy if exists "couple members receive private watch sync" on realtime.messages;
create policy "couple members receive private watch sync"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and public.can_access_couple_watch_sync(realtime.topic())
);

drop policy if exists "couple members publish private watch sync" on realtime.messages;
create policy "couple members publish private watch sync"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and public.can_access_couple_watch_sync(realtime.topic())
);
