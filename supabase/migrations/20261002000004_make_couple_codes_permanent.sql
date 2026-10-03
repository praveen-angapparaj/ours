-- A couple code is a durable identifier for exactly one two-person space.
-- It is never required again after the accounts have been paired.
update public.couples
set invite_expires_at = null
where invite_expires_at is not null;

-- The creator's account can be deleted; doing so removes the couple and its memberships.
alter table public.couples drop constraint if exists couples_created_by_fkey;
alter table public.couples
  add constraint couples_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete cascade;

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

-- If the non-creator account is deleted, remove the established space as well.
create or replace function public.remove_paired_couple_after_member_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.couples c
    where c.id = old.couple_id and c.paired_at is not null
  ) then
    delete from public.couples where id = old.couple_id;
  end if;
  return old;
end;
$$;

drop trigger if exists remove_paired_couple_after_member_delete on public.couple_members;
create trigger remove_paired_couple_after_member_delete
after delete on public.couple_members
for each row execute function public.remove_paired_couple_after_member_delete();

revoke all on function public.remove_paired_couple_after_member_delete() from public, anon, authenticated;
