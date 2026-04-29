"use client";

import { createClient } from "@/lib/supabase/client";
import type { SourceKey } from "@/lib/types";

export type ListingViewSnapshot = {
  ref: string;
  source: SourceKey;
  title: string;
  price: number;
  thumbnail?: string;
  endedAt: string;
  condition?: string;
  fromKeyword?: string;
  viewedAt: string;
};

export async function recordListingView(
  snapshot: Omit<ListingViewSnapshot, "viewedAt">
): Promise<void> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  // 既存の同じrefの履歴があれば削除（最新の閲覧時刻に更新する目的）
  await supabase
    .from("listing_views")
    .delete()
    .eq("user_id", userData.user.id)
    .eq("listing_ref", snapshot.ref);

  await supabase.from("listing_views").insert({
    user_id: userData.user.id,
    listing_ref: snapshot.ref,
    source: snapshot.source,
    title: snapshot.title,
    price: snapshot.price,
    thumbnail: snapshot.thumbnail ?? null,
    ended_at: snapshot.endedAt,
    condition: snapshot.condition ?? null,
    from_keyword: snapshot.fromKeyword ?? null,
  });
}

export async function fetchListingViews(): Promise<ListingViewSnapshot[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("listing_views")
    .select("*")
    .order("viewed_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((row) => ({
    ref: row.listing_ref,
    source: row.source as SourceKey,
    title: row.title,
    price: row.price,
    thumbnail: row.thumbnail ?? undefined,
    endedAt: row.ended_at,
    condition: row.condition ?? undefined,
    fromKeyword: row.from_keyword ?? undefined,
    viewedAt: row.viewed_at,
  }));
}
