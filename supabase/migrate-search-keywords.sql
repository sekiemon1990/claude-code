-- 検索キーワード履歴 (オートコンプリート学習用)
-- ユーザーが実行した検索キーワードをカウントベースで蓄積する。
-- オートコンプリート時にこのテーブルからユーザー個人の頻出語を引いて即時表示する。

create table if not exists public.search_keywords (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  count int not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, keyword)
);

create index if not exists search_keywords_user_id_idx on public.search_keywords(user_id);
create index if not exists search_keywords_count_idx on public.search_keywords(count desc);
create index if not exists search_keywords_last_used_idx on public.search_keywords(last_used_at desc);
-- 前方一致検索用 (大文字小文字無視)
create index if not exists search_keywords_keyword_lower_idx on public.search_keywords(user_id, lower(keyword));

-- RLS
alter table public.search_keywords enable row level security;

drop policy if exists "search_keywords_own" on public.search_keywords;
create policy "search_keywords_own" on public.search_keywords
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
