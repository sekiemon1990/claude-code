-- RLS ポリシーに明示的な WITH CHECK 句を追加（INSERT 確実化）
-- Supabase の SQL Editor で実行してください

drop policy if exists "memos_own" on public.memos;
create policy "memos_own" on public.memos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "pins_own" on public.pins;
create policy "pins_own" on public.pins
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "listing_views_own" on public.listing_views;
create policy "listing_views_own" on public.listing_views
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "saved_advices_own" on public.saved_advices;
create policy "saved_advices_own" on public.saved_advices
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
