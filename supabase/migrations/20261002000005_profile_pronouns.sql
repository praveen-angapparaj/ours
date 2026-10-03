-- Profile-level pronouns make the existing playful copy personal without guessing.
alter table public.profiles
  add column if not exists pronoun_set text not null default 'they_them';

update public.profiles
set pronoun_set = 'they_them'
where pronoun_set is null or pronoun_set not in ('she_her', 'he_him', 'they_them');

alter table public.profiles drop constraint if exists profiles_pronoun_set_check;
alter table public.profiles
  add constraint profiles_pronoun_set_check
  check (pronoun_set in ('she_her', 'he_him', 'they_them'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, pronoun_set)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Troublemaker'),
    case new.raw_user_meta_data ->> 'pronoun_set'
      when 'she_her' then 'she_her'
      when 'he_him' then 'he_him'
      else 'they_them'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
