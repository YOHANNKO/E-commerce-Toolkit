-- 0007_member_bulk_delete.sql
-- 成员管理：批量删除
--   在 0006 单条 admin_delete_member 的基础上，提供一次调用删除多个成员的 RPC。
--   采用「逐个处理 + 汇总结果」策略，避免一个非法目标导致整批失败。

-- ============ RPC: admin 批量删除成员 ============
-- 入参：p_uids uuid[]  —— 待删除的成员 id 列表
-- 返回：{ ok: bool, deleted: int, skipped: [{ id, reason }] }
--   reason: cannot_delete_self | forbidden | not_found
-- 仅 admin 可调用；自己会被跳过并在 skipped 中说明。
create or replace function public.admin_delete_members(p_uids uuid[])
returns json language plpgsql security definer set search_path = public as $$
declare
  caller_role text;
  uid_item    uuid;
  target_role text;
  deleted_cnt int := 0;
  skipped     json[] := array[]::json[];
begin
  -- 调用者必须是 admin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is null or caller_role <> 'admin' then
    return json_build_object('ok', false, 'msg', 'forbidden', 'deleted', 0, 'skipped', '[]'::json);
  end if;

  if p_uids is null or array_length(p_uids, 1) is null then
    return json_build_object('ok', true, 'deleted', 0, 'skipped', '[]'::json);
  end if;

  foreach uid_item in array p_uids loop
    -- 去重后逐条处理（重复 id 第二次会命中 not_found，这里显式跳过）
    if uid_item = auth.uid() then
      skipped := skipped || json_build_object('id', uid_item, 'reason', 'cannot_delete_self');
      continue;
    end if;

    select role into target_role from public.profiles where id = uid_item;
    if target_role is null then
      skipped := skipped || json_build_object('id', uid_item, 'reason', 'not_found');
      continue;
    end if;

    -- 级联清理 profiles / contacts / knowledge / todos / tags / share_item ...
    delete from auth.users where id = uid_item;
    deleted_cnt := deleted_cnt + 1;
  end loop;

  return json_build_object('ok', true, 'deleted', deleted_cnt, 'skipped', array_to_json(skipped));
end; $$;

grant execute on function public.admin_delete_members(uuid[]) to authenticated;

-- 说明：单条 admin_delete_member(uuid)（0006）保持可用，批量版是其超集。
