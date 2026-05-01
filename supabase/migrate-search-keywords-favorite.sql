-- 検索キーワードに「お気に入り (保存検索)」フラグを追加
-- お気に入り = よく使う検索を pin して履歴ページで上に固定

alter table public.search_keywords
  add column if not exists is_favorite boolean not null default false;

create index if not exists search_keywords_favorite_idx
  on public.search_keywords(user_id, is_favorite)
  where is_favorite = true;
