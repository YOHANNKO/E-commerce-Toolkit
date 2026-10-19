-- 跨境百宝囊 v3 — 初始化 Schema
-- 阶段：P1（owner 隔离）+ P2/P3 预留策略（注释中，本期不激活）
-- 运行：supabase db reset / supabase migration up

-- ===================== profiles =====================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  phone         text,
  role          text not null default 'member' check (role in ('admin','member')),
  invited_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

-- 首个注册用户自动成为 admin
create or replace function public.set_first_user_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles) then
    new.role := 'admin';
  end if;
  return new;
end; $$;

drop trigger if exists trg_first_admin on public.profiles;
create trigger trg_first_admin before insert on public.profiles
  for each row execute function public.set_first_user_admin();

-- 注册时自动建 profile（首个用户直接设为 admin；trg_first_admin 为冗余兜底层）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_role text;
begin
  select case when not exists (select 1 from public.profiles) then 'admin' else 'user' end into new_role;
  insert into public.profiles (id, display_name, phone, role)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
          new.raw_user_meta_data->>'phone',
          new_role)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===================== contacts（客户档案） =====================
create table if not exists public.contacts (
  id               uuid primary key default gen_random_uuid(),
  owner            uuid not null references auth.users(id) on delete cascade,
  name             text not null default '',
  type             text not null default 'other',
  role             text not null default '',
  color            text not null default '#2f6df6',
  fields           jsonb not null default '[]'::jsonb,
  shared_from      uuid references auth.users(id),
  shared_from_name text,
  created_at       timestamptz not null default now()
);
create index if not exists contacts_owner_idx on public.contacts(owner);

-- ===================== knowledge（知识库） =====================
create table if not exists public.knowledge (
  id               uuid primary key default gen_random_uuid(),
  owner            uuid not null references auth.users(id) on delete cascade,
  title            text not null default '',
  url              text not null default '',
  note             text not null default '',
  platform_tags    jsonb not null default '[]'::jsonb,
  shared_from      uuid references auth.users(id),
  shared_from_name text,
  created_at       timestamptz not null default now()
);
create index if not exists knowledge_owner_idx on public.knowledge(owner);

-- ===================== todos（待办） =====================
create table if not exists public.todos (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users(id) on delete cascade,
  text       text not null default '',
  note       text not null default '',
  done       boolean not null default false,
  due        text,
  tags       jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists todos_owner_idx on public.todos(owner);

-- ===================== tags（待办标签） =====================
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users(id) on delete cascade,
  name       text not null default '',
  color      text not null default '#3b82f6',
  icon       text not null default '🏷️',
  created_at timestamptz not null default now()
);
create index if not exists tags_owner_idx on public.tags(owner);

-- ===================== share_space（P2 空间级授权） =====================
create table if not exists public.share_space (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users(id) on delete cascade,
  target     uuid not null references auth.users(id) on delete cascade,
  resource   text not null check (resource in ('kb','crm')),
  access     text not null default 'view' check (access in ('view','edit')),
  created_at timestamptz not null default now(),
  unique (owner, target, resource)
);

-- ===================== share_item（P3 单条分享） =====================
create table if not exists public.share_item (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users(id) on delete cascade,
  target      uuid not null references auth.users(id) on delete cascade,
  resource    text not null check (resource in ('kb','crm')),
  resource_id uuid not null,
  status      text not null default 'pending' check (status in ('pending','accepted')),
  note        text,
  created_at  timestamptz not null default now()
);

-- ===================== 授权（SQL 建表需显式授权给 Supabase 角色） =====================
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- ===================== RLS =====================
alter table public.profiles    enable row level security;
alter table public.contacts    enable row level security;
alter table public.knowledge   enable row level security;
alter table public.todos       enable row level security;
alter table public.tags        enable row level security;
alter table public.share_space enable row level security;
alter table public.share_item  enable row level security;

-- profiles：仅自己可见可改
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- P1：用户数据仅 owner 可读写删
drop policy if exists contacts_owner on public.contacts;
create policy contacts_owner on public.contacts
  for all using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists knowledge_owner on public.knowledge;
create policy knowledge_owner on public.knowledge
  for all using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists todos_owner on public.todos;
create policy todos_owner on public.todos
  for all using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists tags_owner on public.tags;
create policy tags_owner on public.tags
  for all using (auth.uid() = owner) with check (auth.uid() = owner);

-- share_space / share_item：P1 仅 owner 管理与基础可见（P2/P3 扩展）
drop policy if exists share_space_owner on public.share_space;
create policy share_space_owner on public.share_space
  for all using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists share_item_owner on public.share_item;
create policy share_item_owner on public.share_item
  for all using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists share_item_target on public.share_item;
create policy share_item_target on public.share_item
  for select using (auth.uid() = target);

-- ============================================================
-- P2 预留（本期不激活）：被授权者只读查看他人 owner 行
--   create policy contacts_shared_select on public.contacts
--     for select using (
--       exists (select 1 from public.share_space s
--               where s.owner = contacts.owner
--                 and s.target = auth.uid()
--                 and s.resource = 'crm'));
--   -- 仅 owner 可写（共享来的禁止 UPDATE/DELETE）
-- P3 预留：接受单条分享时，复制行并标 shared_from（由前端/Edge Function 执行 insert）
-- ============================================================
