
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 30),
 birthdate date not null check (birthdate <= (current_date - interval '18 years')::date),
 occupation text not null default '' check (char_length(occupation)<=70),
 goal text not null default 'both' check (goal in ('both','friends','dating')),
 country text not null default 'PL' check (country ~ '^[A-Z]{2}$'),
 region text not null default '' check (char_length(region)<=60),
 interests text[] not null default '{}',
 about text not null default '' check (char_length(about)<=160),
 created_at timestamptz not null default now()
);
create table if not exists public.preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 area text not null default 'poland' check (area in ('poland','region','world')),
 goal text not null default 'both' check (goal in ('both','friends','dating')),
 age_min integer not null default 18 check (age_min between 18 and 100),
 age_max integer not null default 30 check (age_max between 18 and 100),
 matching text not null default 'similar' check (matching in ('similar','random','different')),
 check (age_max>=age_min)
);
create table if not exists public.moments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 day date not null default (now() at time zone 'utc')::date,
 caption text not null check (char_length(caption) between 1 and 160),
 photo_path text not null check (char_length(photo_path)<=300),
 created_at timestamptz not null default now(),
 unique (user_id,day)
);
create table if not exists public.discoveries (
 viewer_id uuid not null references auth.users(id) on delete cascade,
 day date not null default (now() at time zone 'utc')::date,
 moment_id uuid not null references public.moments(id) on delete cascade,
 revealed boolean not null default false,
 primary key(viewer_id,day)
);
create table if not exists public.interests (
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(sender_id,recipient_id),
 check(sender_id<>recipient_id)
);
create index if not exists moments_day_idx on public.moments(day);
create index if not exists discoveries_moment_idx on public.discoveries(moment_id);
alter table public.profiles enable row level security;
alter table public.preferences enable row level security;
alter table public.moments enable row level security;
alter table public.discoveries enable row level security;
alter table public.interests enable row level security;
create policy "profiles_self_select" on public.profiles for select to authenticated using (id=auth.uid());
create policy "profiles_self_insert" on public.profiles for insert to authenticated with check (id=auth.uid());
create policy "profiles_self_update" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy "preferences_self_select" on public.preferences for select to authenticated using (user_id=auth.uid());
create policy "preferences_self_insert" on public.preferences for insert to authenticated with check (user_id=auth.uid());
create policy "preferences_self_update" on public.preferences for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "moments_self_select" on public.moments for select to authenticated using (user_id=auth.uid());
create policy "moments_self_insert" on public.moments for insert to authenticated with check (user_id=auth.uid() and day=(now() at time zone 'utc')::date and split_part(photo_path,'/',1)=auth.uid()::text);
-- Nie dajemy bezpośredniego SELECT do profili innych osób. Odkrywanie odbywa się przez RPC.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('moments','moments',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy "moments_storage_upload" on storage.objects for insert to authenticated
with check(bucket_id='moments' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "moments_storage_read" on storage.objects for select to authenticated
using(bucket_id='moments' and (owner_id=auth.uid()::text or exists(
 select 1 from public.discoveries d join public.moments m on m.id=d.moment_id
 where d.viewer_id=auth.uid() and m.photo_path=name
)));
create policy "moments_storage_delete_own" on storage.objects for delete to authenticated
using(bucket_id='moments' and (storage.foldername(name))[1]=auth.uid()::text);

-- Zwraca dokładnie jeden dzisiejszy moment. Wybór zapisywany jest na cały dzień UTC.
create or replace function public.discover_today()
returns table(photo_path text, caption text, revealed boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_p public.profiles%rowtype; v_f public.preferences%rowtype; v_m uuid; v_today date:=(now() at time zone 'utc')::date;
begin
 if v_uid is null then raise exception 'Zaloguj się'; end if;
 select * into v_p from public.profiles where id=v_uid;
 if not found then return; end if;
 select * into v_f from public.preferences where user_id=v_uid;
 if not found then v_f.user_id:=v_uid;v_f.area:='poland';v_f.goal:='both';v_f.age_min:=18;v_f.age_max:=30;v_f.matching:='similar';end if;
 select d.moment_id into v_m from public.discoveries d where d.viewer_id=v_uid and d.day=v_today;
 if v_m is null then
  select m.id into v_m from public.moments m
  join public.profiles p on p.id=m.user_id
  left join public.preferences pf on pf.user_id=p.id
  where m.day=v_today and m.user_id<>v_uid
    and date_part('year',age(v_today,p.birthdate)) between v_f.age_min and v_f.age_max
    and (v_f.area='world' or (v_f.area='poland' and p.country=v_p.country) or
         (v_f.area='region' and p.country=v_p.country and v_p.region<>'' and lower(p.region)=lower(v_p.region)))
    and (v_f.goal='both' or p.goal='both' or p.goal=v_f.goal)
    and (pf.goal is null or pf.goal='both' or v_p.goal='both' or pf.goal=v_p.goal)
    and (pf.age_min is null or date_part('year',age(v_today,v_p.birthdate)) between pf.age_min and pf.age_max)
    and (pf.area is null or pf.area='world' or (pf.area='poland' and p.country=v_p.country) or
         (pf.area='region' and p.country=v_p.country and p.region<>'' and lower(p.region)=lower(v_p.region)))
  order by
    case when v_f.matching='similar' then
      (select count(*) from unnest(p.interests) i where lower(i)=any(select lower(x) from unnest(v_p.interests) x)) end desc nulls last,
    case when v_f.matching='different' then
      (select count(*) from unnest(p.interests) i where lower(i)=any(select lower(x) from unnest(v_p.interests) x)) end asc nulls last,
    random() limit 1;
  if v_m is not null then
   insert into public.discoveries(viewer_id,day,moment_id) values(v_uid,v_today,v_m)
   on conflict(viewer_id,day) do nothing;
  end if;
 end if;
 return query select m.photo_path,m.caption,d.revealed from public.discoveries d join public.moments m on m.id=d.moment_id where d.viewer_id=v_uid and d.day=v_today;
end $$;
create or replace function public.reveal_today()
returns table(name text,age integer,occupation text,interests text[],about text,goal text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_today date:=(now() at time zone 'utc')::date;
begin
 if v_uid is null then raise exception 'Zaloguj się';end if;
 update public.discoveries d set revealed=true where d.viewer_id=v_uid and d.day=v_today;
 return query select p.name,date_part('year',age(v_today,p.birthdate))::integer,p.occupation,p.interests,p.about,p.goal
 from public.discoveries d join public.moments m on m.id=d.moment_id join public.profiles p on p.id=m.user_id
 where d.viewer_id=v_uid and d.day=v_today and d.revealed;
end $$;
create or replace function public.express_interest() returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_target uuid; v_match boolean;
begin
 if v_uid is null then raise exception 'Zaloguj się';end if;
 select m.user_id into v_target from public.discoveries d join public.moments m on m.id=d.moment_id
 where d.viewer_id=v_uid and d.day=(now() at time zone 'utc')::date and d.revealed;
 if v_target is null then raise exception 'Najpierw odkryj profil';end if;
 insert into public.interests(sender_id,recipient_id) values(v_uid,v_target) on conflict do nothing;
 select exists(select 1 from public.interests where sender_id=v_target and recipient_id=v_uid) into v_match;
 return v_match;
end $$;
revoke all on function public.discover_today() from public,anon;
revoke all on function public.reveal_today() from public,anon;
revoke all on function public.express_interest() from public,anon;
grant execute on function public.discover_today() to authenticated;
grant execute on function public.reveal_today() to authenticated;
grant execute on function public.express_interest() to authenticated;
