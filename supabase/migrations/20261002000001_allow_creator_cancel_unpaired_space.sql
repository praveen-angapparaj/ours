-- A creator may undo an unpaired invite, but never dissolve an established two-person space.
create or replace function public.cancel_my_unpaired_couple()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_couple_id uuid;
  member_role text;
  member_count integer;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(actor_id::text));
  select cm.couple_id, cm.role into target_couple_id, member_role
  from public.couple_members cm
  where cm.user_id = actor_id;

  if target_couple_id is null then
    return;
  end if;
  if member_role <> 'creator' then
    raise exception 'only_creator_can_cancel_invite' using errcode = 'P0001';
  end if;

  perform 1 from public.couples where id = target_couple_id for update;
  select count(*) into member_count from public.couple_members where couple_id = target_couple_id;
  if member_count <> 1 then
    raise exception 'cannot_cancel_paired_couple' using errcode = 'P0001';
  end if;

  delete from public.couples where id = target_couple_id;
end;
$$;

revoke all on function public.cancel_my_unpaired_couple() from public, anon;
grant execute on function public.cancel_my_unpaired_couple() to authenticated;
