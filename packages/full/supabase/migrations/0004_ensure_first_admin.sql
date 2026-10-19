-- 0004_ensure_first_admin.sql
-- 兜底：保证首个注册用户成为 admin（不受 GoTrue 创建 profile 路径影响）
-- 客户端在登录/加载用户信息后调用本函数：
--   若全库尚无 admin，则把当前用户提升为 admin 并返回 true；否则返回 false。

create or replace function public.ensure_caller_admin_if_first()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  admin_n int;
begin
  select count(*) into admin_n from public.profiles where role = 'admin';
  if admin_n = 0 then
    update public.profiles set role = 'admin' where id = auth.uid();
    return true;
  end if;
  return false;
end; $$;

grant execute on function public.ensure_caller_admin_if_first() to authenticated;
