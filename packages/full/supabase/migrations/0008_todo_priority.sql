-- 0008_todo_priority.sql
-- 日程待办：新增优先级列
-- 取值：'urgent' | 'high' | 'normal' | 'none'
--   urgent = 紧急 / high = 优先 / normal = 平缓 / none = 不急（默认）
--
-- 在 Supabase SQL Editor 中执行本文件。
-- 未执行时前端会自动降级（本地模式不受影响），但云端模式下
-- insert/update 携带 priority 字段会因 unknown column 报错 —— 必执行。

alter table public.todos
  add column if not exists priority text not null default 'none';

-- 约束：只允许四个枚举值（若已存在同名约束则跳过）
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.todos'::regclass
      and conname  = 'todos_priority_chk'
  ) then
    alter table public.todos
      add constraint todos_priority_chk
      check (priority in ('urgent', 'high', 'normal', 'none'));
  end if;
end $$;

-- 查询排序辅助索引（列表按 owner 过滤后再排序；PostgREST 只支持单列排序，
-- 三级排序仍在前端内存完成；此索引仅加速 owner 维度的取数）
-- 注意：0001_init 中该列名为 owner（非 user_id）
create index if not exists todos_owner_priority_idx
  on public.todos (owner, priority);
