"use client";

import { createClient } from "@/lib/supabase/client";

export type MemoRow = {
  id: string;
  user_id: string;
  search_keyword: string | null;
  listing_ref: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

// 検索メモ取得
export async function fetchSearchMemo(
  searchKeyword: string
): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase
    .from("memos")
    .select("body")
    .eq("search_keyword", searchKeyword)
    .is("listing_ref", null)
    .maybeSingle();
  return data?.body ?? "";
}

// 商品メモ取得
export async function fetchListingMemo(listingRef: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase
    .from("memos")
    .select("body")
    .eq("listing_ref", listingRef)
    .is("search_keyword", null)
    .maybeSingle();
  return data?.body ?? "";
}

// 検索メモを保存（空文字は削除）
export async function upsertSearchMemo(
  searchKeyword: string,
  body: string
): Promise<void> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const trimmed = body.trim();
  if (!trimmed) {
    await supabase
      .from("memos")
      .delete()
      .eq("search_keyword", searchKeyword)
      .is("listing_ref", null);
    return;
  }

  const { data: existing } = await supabase
    .from("memos")
    .select("id")
    .eq("search_keyword", searchKeyword)
    .is("listing_ref", null)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("memos")
      .update({ body: trimmed, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("memos").insert({
      user_id: userData.user.id,
      search_keyword: searchKeyword,
      listing_ref: null,
      body: trimmed,
    });
  }
}

// 商品メモを保存（空文字は削除）
export async function upsertListingMemo(
  listingRef: string,
  body: string
): Promise<void> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const trimmed = body.trim();
  if (!trimmed) {
    await supabase
      .from("memos")
      .delete()
      .eq("listing_ref", listingRef)
      .is("search_keyword", null);
    return;
  }

  const { data: existing } = await supabase
    .from("memos")
    .select("id")
    .eq("listing_ref", listingRef)
    .is("search_keyword", null)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("memos")
      .update({ body: trimmed, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("memos").insert({
      user_id: userData.user.id,
      search_keyword: null,
      listing_ref: listingRef,
      body: trimmed,
    });
  }
}

// 全メモを一括取得（履歴画面用）
export async function fetchAllMemos(): Promise<{
  searchMemos: Map<string, string>;
  listingMemos: Map<string, string>;
}> {
  const supabase = createClient();
  const { data } = await supabase.from("memos").select("*");
  const searchMemos = new Map<string, string>();
  const listingMemos = new Map<string, string>();
  for (const row of (data ?? []) as MemoRow[]) {
    if (row.search_keyword) searchMemos.set(row.search_keyword, row.body);
    if (row.listing_ref) listingMemos.set(row.listing_ref, row.body);
  }
  return { searchMemos, listingMemos };
}
