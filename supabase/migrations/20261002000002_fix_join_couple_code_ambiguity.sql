-- Fix PL/pgSQL output-column name collisions in the deployed join RPC.
create or replace function public.join_couple_by_code(input_code text)
returns table(couple_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  normalized_code text := upper(trim(input_code));
  existing_couple_id uuid;
  target public.couples%rowtype;
  member_count integer;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if normalized_code is null or normalized_code !~ '^OURS-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$' then
    raise exception 'invalid_invite_code' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(actor_id::text));
  select cm.couple_id into existing_couple_id
  from public.couple_members cm
  where cm.user_id = actor_id;
  if existing_couple_id is not null then
    raise exception 'already_paired' using errcode = 'P0001';
  end if;

  select c.* into target
  from public.couples c
  where c.invite_code = normalized_code
  for update;
  if target.id is null then
    raise exception 'invalid_invite_code' using errcode = 'P0001';
  end if;
  if target.invite_expires_at is not null and target.invite_expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;

  select count(*) into member_count
  from public.couple_members cm
  where cm.couple_id = target.id;
  if member_count >= 2 then
    raise exception 'couple_full' using errcode = 'P0001';
  end if;

  insert into public.couple_members (couple_id, user_id, role)
  values (target.id, actor_id, 'partner');
  update public.couples set paired_at = coalesce(paired_at, now()) where id = target.id;

  return query select target.id, target.invite_code;
exception
  when unique_violation then
    raise exception 'already_paired' using errcode = 'P0001';
end;
$$;

revoke all on function public.join_couple_by_code(text) from public, anon;
grant execute on function public.join_couple_by_code(text) to authenticated;
