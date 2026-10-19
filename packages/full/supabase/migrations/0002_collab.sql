-- 跨境百宝囊 v3 — 0002 协作与权限扩展
-- 内容：角色(admin/admin_user/user) + 客户标签 + 官方知识库 + 分享/收件箱

-- ============ 1. profiles.role 扩展 ============
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin','admin_user','user','member'));
alter table public.profiles alter column role set default 'user';
update public.profiles set role = 'user' where role = 'member';

-- ============ 2. contacts.tags（自定义标签 / 文件夹分类） ============
alter table public.contacts add column if not exists tags jsonb not null default '[]'::jsonb;

-- ============ 3. knowledge.kind（official 官方 / private 私有） ============
alter table public.knowledge add column if not exists kind text not null default 'private'
  check (kind in ('official','private'));

-- ============ 4. share_item 展示字段 ============
alter table public.share_item add column if not exists title text;
alter table public.share_item add column if not exists target_email text;
alter table public.share_item add column if not exists from_name text;

-- ============ 5. is_admin() 助手（security definer 避免 RLS 递归） ============
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ============ 6. RLS: profiles ============
drop policy if exists profiles_self on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() = id or public.is_admin());
-- 自己只能改自己，且不能改 role（防越权）
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id)
  with check (role = (select role from public.profiles where id = auth.uid()));
-- admin 可改任意成员（含提升 admin_user）
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (public.is_admin()) with check (true);

-- ============ 7. RLS: knowledge（官方全员只读 / 私有仅本人） ============
drop policy if exists knowledge_owner on public.knowledge;
create policy knowledge_select on public.knowledge
  for select using (kind = 'official' or owner = auth.uid());
drop policy if exists knowledge_write on public.knowledge;
create policy knowledge_write on public.knowledge
  for all
  using (
    (kind = 'official' and public.is_admin()) or
    (kind = 'private' and owner = auth.uid())
  )
  with check (
    (kind = 'official' and public.is_admin()) or
    (kind = 'private' and owner = auth.uid())
  );

-- ============ 8. RLS: share_item ============
drop policy if exists share_item_owner on public.share_item;
drop policy if exists share_item_target on public.share_item;
create policy share_item_select on public.share_item
  for select using (auth.uid() = owner or auth.uid() = target);
create policy share_item_insert on public.share_item
  for insert with check (auth.uid() = owner);
create policy share_item_update on public.share_item
  for update using (auth.uid() = owner or auth.uid() = target)
  with check (auth.uid() = owner or auth.uid() = target);
create policy share_item_delete on public.share_item
  for delete using (auth.uid() = owner or auth.uid() = target);

-- ============ 9. RPC: 邮箱 -> uid ============
create or replace function public.email_to_uid(p_email text)
returns uuid language sql security definer set search_path = public as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

-- ============ 10. RPC: 接受分享（复制源到自己的空间，源不受影响） ============
create or replace function public.accept_share(p_item uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  rec public.share_item;
  src record;
  new_id uuid;
  src_name text;
begin
  select * into rec from public.share_item where id = p_item and target = auth.uid() and status = 'pending';
  if rec is null then return json_build_object('ok', false, 'msg', 'not_found'); end if;

  if rec.resource = 'crm' then
    select * into src from public.contacts where id = rec.resource_id;
    if src is null then
      update public.share_item set status = 'accepted' where id = p_item;
      return json_build_object('ok', false, 'msg', 'source_gone');
    end if;
    select display_name into src_name from public.profiles where id = src.owner;
    insert into public.contacts (owner, name, type, role, color, fields, tags, shared_from, shared_from_name)
      values (auth.uid(), src.name, src.type, src.role, src.color, src.fields, src.tags, src.owner, coalesce(src_name, ''))
      returning id into new_id;
  else
    select * into src from public.knowledge where id = rec.resource_id;
    if src is null then
      update public.share_item set status = 'accepted' where id = p_item;
      return json_build_object('ok', false, 'msg', 'source_gone');
    end if;
    select display_name into src_name from public.profiles where id = src.owner;
    insert into public.knowledge (owner, title, url, note, platform_tags, kind, shared_from, shared_from_name)
      values (auth.uid(), src.title, src.url, src.note, src.platform_tags, 'private', src.owner, coalesce(src_name, ''))
      returning id into new_id;
  end if;
  update public.share_item set status = 'accepted' where id = p_item;
  return json_build_object('ok', true, 'new_id', new_id);
end; $$;

-- ============ 11. 授权 RPC 给 authenticated ============
grant execute on function public.is_admin() to authenticated;
grant execute on function public.email_to_uid(text) to authenticated;
grant execute on function public.accept_share(uuid) to authenticated;
