"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * 検索キーワードのカウンタ式蓄積。
 * 同じキーワードを検索すると count が増えるだけ。
 */
export async function recordSearchKeyword(keyword: string): Promise<void> {
  const trimmed = keyword.trim();
  if (!trimmed) return;
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  // 既存行をチェック
  const { data: existing } = await supabase
    .from("search_keywords")
    .select("id, count")
    .eq("user_id", userData.user.id)
    .eq("keyword", trimmed)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("search_keywords")
      .update({
        count: existing.count + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("search_keywords").insert({
      user_id: userData.user.id,
      keyword: trimmed,
      count: 1,
    });
  }
}

/**
 * 個人検索履歴のうち、prefix にマッチするものを返す (count 降順)。
 * prefix が空の場合は最近頻出のものを返す。
 */
export async function fetchUserKeywordSuggestions(
  prefix: string,
  limit = 8,
): Promise<string[]> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const trimmed = prefix.trim();
  let query = supabase
    .from("search_keywords")
    .select("keyword, count, last_used_at")
    .eq("user_id", userData.user.id);

  if (trimmed) {
    // 前方一致 (大文字小文字無視) で絞り込み
    query = query.ilike("keyword", `${trimmed}%`);
  }

  const { data } = await query
    .order("count", { ascending: false })
    .order("last_used_at", { ascending: false })
    .limit(limit);

  if (!data) return [];
  return (data as { keyword: string }[]).map((r) => r.keyword);
}
