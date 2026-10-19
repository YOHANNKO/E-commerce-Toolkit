-- 0005_templates.sql
-- 文案模板库：在 knowledge 表中扩展 kind='templates'，并增加中文原文、翻译语言字段

-- 1) 新增字段
alter table public.knowledge
  add column if not exists chinese_text text not null default '',
  add column if not exists translations jsonb not null default '[]'::jsonb;

-- 2) 扩展 kind 枚举
alter table public.knowledge drop constraint if exists knowledge_kind_check;
alter table public.knowledge
  add constraint knowledge_kind_check check (kind in ('official','private','templates'));

-- 3) 更新写策略：templates 仅 owner 可写
alter policy knowledge_write on public.knowledge
  using (
    (kind = 'official' and public.is_admin()) or
    (kind in ('private','templates') and owner = auth.uid())
  )
  with check (
    (kind = 'official' and public.is_admin()) or
    (kind in ('private','templates') and owner = auth.uid())
  );

-- 4) accept_share 防御：拒绝 kind='templates' 的分享（该库暂不支持共享）
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
    if src is null or src.kind = 'templates' then
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
