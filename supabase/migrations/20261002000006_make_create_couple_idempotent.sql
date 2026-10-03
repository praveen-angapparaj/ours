-- A repeated Create click, refresh, or retry must return the user's existing space,
-- never surface a unique-membership conflict to the client.
create or replace function public.create_my_couple()
returns table(couple_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  existing_couple_id uuid;
  generated_code text;
  created_couple_id uuid;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(actor_id::text));

  select cm.couple_id into existing_couple_id
  from public.couple_members cm
  where cm.user_id = actor_id;
  if existing_couple_id is not null then
    return query select c.id, c.invite_code from public.couples c where c.id = existing_couple_id;
    return;
  end if;

  loop
    generated_code := public.new_invite_code();
    begin
      insert into public.couples (invite_code, created_by)
      values (generated_code, actor_id)
      returning id into created_couple_id;
      exit;
    exception when unique_violation then
      -- A code collision is retried; the membership conflict below is recovered separately.
    end;
  end loop;

  insert into public.couple_members (couple_id, user_id, role)
  values (created_couple_id, actor_id, 'creator')
  on conflict (user_id) do nothing;

  select cm.couple_id into existing_couple_id
  from public.couple_members cm
  where cm.user_id = actor_id;
  if existing_couple_id is null then
    raise exception 'couple_creation_failed' using errcode = 'P0001';
  end if;

  -- If a concurrent/retried request won the membership, discard this unused couple row.
  if existing_couple_id <> created_couple_id then
    delete from public.couples where id = created_couple_id;
  end if;

  return query select c.id, c.invite_code from public.couples c where c.id = existing_couple_id;
end;
$$;

revoke all on function public.create_my_couple() from public, anon;
grant execute on function public.create_my_couple() to authenticated;
