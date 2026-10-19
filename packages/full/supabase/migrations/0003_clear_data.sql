-- 0003_clear_data.sql
-- ⚠️ 不可逆操作：清空全部业务数据并删除所有账号（用于全新上线前的数据清洗）
-- 执行后：所有用户数据丢失，所有账号被删除；
-- 之后首个注册的账号会在 profiles 为空时由 trg_first_admin 触发器自动成为 admin。

-- 1) 清空业务表（cascade 一并清理引用）
truncate table public.share_item   restart identity cascade;
truncate table public.share_space  restart identity cascade;
truncate table public.tags        restart identity cascade;
truncate table public.todos       restart identity cascade;
truncate table public.knowledge   restart identity cascade;
truncate table public.contacts    restart identity cascade;
truncate table public.profiles    restart identity cascade;

-- 2) 删除所有账号记录，让"重新注册"成为全新首用户（→ 自动 admin）
delete from auth.users; delete from auth.identities; delete from auth.sessions; delete from auth.refresh_tokens;

-- 提示：触发器 trg_first_admin 不会被 truncate 删除，仍生效。
-- 验证首用户为 admin：注册后执行
--   select email, role from public.profiles p join auth.users u on u.id = p.id;
