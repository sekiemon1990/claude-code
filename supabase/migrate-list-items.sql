-- list_items を「クエリ・進捗埋め込み型」に再構築 (プロトタイプ仕様)
-- 実スクレイピング実装時に search_id 経由の正規化スキーマへ移行する

drop table if exists public.list_items cascade;

create table public.list_items (
  id uuid primary key default uuid_generate_v4(),
  list_id uuid not null references public.appraisal_lists(id) on delete cascade,
  -- 検索条件
  keyword text not null,
  excludes text,
  period text not null default '30',
  sources text[] not null default '{}',
  conditions text[] not null default '{}',
  shipping text not null default 'any',
  -- ステータス
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'error', 'cancelled')),
  progress int not null default 0,
  -- 結果 (completed 時)
  median int,
  min_price int,
  max_price int,
  total_count int,
  suggested_buy_price int,
  error_message text,
  -- 時刻
  added_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  -- モック進捗用 (本物の Inngest が来たら不要)
  total_ms int,
  target_complete_at_ms bigint
);

create index list_items_list_id_idx on public.list_items(list_id);
create index list_items_added_at_idx on public.list_items(added_at desc);

-- RLS
alter table public.list_items enable row level security;

create policy "list_items_select" on public.list_items for select
  using (
    exists (
      select 1 from public.appraisal_lists l
      where l.id = list_items.list_id and l.user_id = auth.uid()
    )
  );

create policy "list_items_insert" on public.list_items for insert
  with check (
    exists (
      select 1 from public.appraisal_lists l
      where l.id = list_items.list_id and l.user_id = auth.uid()
    )
  );

create policy "list_items_update" on public.list_items for update
  using (
    exists (
      select 1 from public.appraisal_lists l
      where l.id = list_items.list_id and l.user_id = auth.uid()
    )
  );

create policy "list_items_delete" on public.list_items for delete
  using (
    exists (
      select 1 from public.appraisal_lists l
      where l.id = list_items.list_id and l.user_id = auth.uid()
    )
  );
