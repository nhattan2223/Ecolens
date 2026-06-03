-- ============================================================
-- Migration: Add auth + RLS to insights table
-- Chạy SQL này trong Supabase SQL Editor
-- ============================================================

-- 1. Thêm cột user_id
alter table public.insights
add column user_id uuid references auth.users(id) on delete cascade null;

-- 2. Bật Row Level Security
alter table public.insights enable row level security;

-- 3. Xoá policies cũ nếu có (để chạy lại an toàn)
drop policy if exists "Anyone can read visible insights" on public.insights;
drop policy if exists "Authenticated users can insert" on public.insights;
drop policy if exists "Users can update own insights" on public.insights;
drop policy if exists "Users can delete own insights" on public.insights;

-- 4. Tạo policies mới
create policy "Anyone can read visible insights"
on public.insights for select
using (is_visible = true);

create policy "Authenticated users can insert"
on public.insights for insert
with check (auth.role() = 'authenticated' and user_id = auth.uid());

create policy "Users can update own insights"
on public.insights for update
using (auth.uid() = user_id);

create policy "Users can delete own insights"
on public.insights for delete
using (auth.uid() = user_id);
