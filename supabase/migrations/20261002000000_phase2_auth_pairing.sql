-- Our Space Phase 2: private authenticated couples
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Troublemaker',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  paired_at timestamptz,
  invite_expires_at timestamptz
);

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('creator', 'partner')),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id)
);

create index if not exists couple_members_couple_id_idx on public.couple_members(couple_id);
create index if not exists couples_invite_code_idx on public.couples(invite_code);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Troublemaker')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Security definer helpers keep RLS policies non-recursive and never accept a caller supplied user id.
create or replace function public.is_couple_member(target_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = target_couple_id and user_id = auth.uid()
  );
$$;

create or replace function public.shares_couple_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id = auth.uid() or exists (
    select 1
    from public.couple_members mine
    join public.couple_members theirs on theirs.couple_id = mine.couple_id
    where mine.user_id = auth.uid() and theirs.user_id = target_user_id
  );
$$;

create or replace function public.new_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := 'OURS-';
  i integer;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, floor(random() * length(alphabet) + 1)::integer, 1);
  end loop;
  return result;
end;
$$;

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
  select cm.couple_id into existing_couple_id from public.couple_members cm where cm.user_id = actor_id;
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
      -- Extremely unlikely invite-code collision; generate a fresh code inside the same transaction.
    end;
  end loop;

  insert into public.couple_members (couple_id, user_id, role)
  values (created_couple_id, actor_id, 'creator');

  return query select created_couple_id, generated_code;
end;
$$;

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
  select cm.couple_id into existing_couple_id from public.couple_members cm where cm.user_id = actor_id;
  if existing_couple_id is not null then
    raise exception 'already_paired' using errcode = 'P0001';
  end if;

  select c.* into target from public.couples c where c.invite_code = normalized_code for update;
  if target.id is null then
    raise exception 'invalid_invite_code' using errcode = 'P0001';
  end if;
  if target.invite_expires_at is not null and target.invite_expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;

  select count(*) into member_count from public.couple_members cm where cm.couple_id = target.id;
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

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;

drop policy if exists "profiles_visible_to_self_or_partner" on public.profiles;
create policy "profiles_visible_to_self_or_partner" on public.profiles
for select to authenticated using (public.shares_couple_with(id));
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "couples_visible_to_members" on public.couples;
create policy "couples_visible_to_members" on public.couples
for select to authenticated using (public.is_couple_member(id));

drop policy if exists "members_visible_to_couple_members" on public.couple_members;
create policy "members_visible_to_couple_members" on public.couple_members
for select to authenticated using (public.is_couple_member(couple_id));

revoke all on public.profiles, public.couples, public.couple_members from anon;
revoke insert, delete, update on public.couples, public.couple_members from authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.couples, public.couple_members to authenticated;
revoke all on function public.create_my_couple() from public, anon;
revoke all on function public.join_couple_by_code(text) from public, anon;
revoke all on function public.is_couple_member(uuid) from public, anon;
revoke all on function public.shares_couple_with(uuid) from public, anon;
revoke all on function public.new_invite_code() from public, anon, authenticated;
grant execute on function public.create_my_couple() to authenticated;
grant execute on function public.join_couple_by_code(text) to authenticated;
grant execute on function public.is_couple_member(uuid) to authenticated;
grant execute on function public.shares_couple_with(uuid) to authenticated;
