-- 0006_member_admin.sql
-- 成员管理增强：
--   1) admin 可删除成员（连同其账号、档案与全部业务数据，级联清理）
--   2) 增加审计用的 role 更新限制保持不变（沿用 0002 策略）

-- ============ 1. RPC: admin 删除成员 ============
-- 仅 admin 可调用；不能删除自己；目标不存在时返回 not_found。
-- auth.users 行删除后，profiles / contacts / knowledge / todos / tags /
-- share_item / share_space 均通过 on delete cascade 级联清理。
create or replace function public.admin_delete_member(p_uid uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  caller_role text;
  target_role text;
begin
  -- 调用者必须是 admin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is null or caller_role <> 'admin' then
    return json_build_object('ok', false, 'msg', 'forbidden');
  end if;

  -- 不能删除自己（避免误删主管理员）
  if p_uid = auth.uid() then
    return json_build_object('ok', false, 'msg', 'cannot_delete_self');
  end if;

  -- 目标必须存在
  select role into target_role from public.profiles where id = p_uid;
  if target_role is null then
    return json_build_object('ok', false, 'msg', 'not_found');
  end if;

  delete from auth.users where id = p_uid;
  return json_build_object('ok', true);
end; $$;

grant execute on function public.admin_delete_member(uuid) to authenticated;

-- ============ 2. 回归确认：admin 改角色策略已在 0002 建立 ============
-- profiles_update_admin：admin 可改任意成员角色（UI 中的角色下拉框使用）
