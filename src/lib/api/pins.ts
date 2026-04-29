"use client";

import { createClient } from "@/lib/supabase/client";

export type PinRow = {
  id: string;
  user_id: string;
  search_keyword: string | null;
  listing_ref: string | null;
  pinned_at: string;
};

// 検索のピン取得
export async function fetchSearchPin(searchKeyword: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("pins")
    .select("id")
    .eq("search_keyword", searchKeyword)
    .is("listing_ref", null)
    .maybeSingle();
  return !!data;
}

// 商品のピン取得
export async function fetchListingPin(listingRef: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("pins")
    .select("id")
    .eq("listing_ref", listingRef)
    .is("search_keyword", null)
    .maybeSingle();
  return !!data;
}

export async function setSearchPin(
  searchKeyword: string,
  pinned: boolean
): Promise<void> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  if (pinned) {
    await supabase.from("pins").upsert(
      {
        user_id: userData.user.id,
        search_keyword: searchKeyword,
        listing_ref: null,
      },
      { onConflict: "user_id,search_keyword", ignoreDuplicates: true }
    );
  } else {
    await supabase
      .from("pins")
      .delete()
      .eq("search_keyword", searchKeyword)
      .is("listing_ref", null);
  }
}

export async function setListingPin(
  listingRef: string,
  pinned: boolean
): Promise<void> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  if (pinned) {
    await supabase.from("pins").upsert(
      {
        user_id: userData.user.id,
        search_keyword: null,
        listing_ref: listingRef,
      },
      { onConflict: "user_id,listing_ref", ignoreDuplicates: true }
    );
  } else {
    await supabase
      .from("pins")
      .delete()
      .eq("listing_ref", listingRef)
      .is("search_keyword", null);
  }
}

// 全ピン情報を取得
export async function fetchAllPins(): Promise<{
  searchPins: Set<string>;
  listingPins: Set<string>;
}> {
  const supabase = createClient();
  const { data } = await supabase.from("pins").select("*");
  const searchPins = new Set<string>();
  const listingPins = new Set<string>();
  for (const row of (data ?? []) as PinRow[]) {
    if (row.search_keyword) searchPins.add(row.search_keyword);
    if (row.listing_ref) listingPins.add(row.listing_ref);
  }
  return { searchPins, listingPins };
}
