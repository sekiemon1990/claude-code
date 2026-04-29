"use client";

import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useState } from "react";
import {
  ExternalLink,
  Gavel,
  CalendarDays,
  User,
  Truck,
  MapPin,
  Tag,
  Package,
  Sparkles,
  Star,
  StickyNote,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SourceBadge } from "@/components/SourceBadge";
import { PlatformLogo } from "@/components/PlatformLogo";
import { ImageLightbox } from "@/components/ImageLightbox";
import { ConditionBadge } from "@/components/ConditionBadge";
import { MOCK_RESULT } from "@/lib/mock-data";
import { formatYen, formatRelativeDate } from "@/lib/utils";
import { detectAccessories } from "@/lib/accessories";
import { classifyCondition } from "@/lib/conditions";
import {
  recordListingView,
  setListingMemo,
  setListingPinned,
  useListingMemoValue,
  useListingPinnedValue,
} from "@/lib/storage";
import { SOURCES, type SourceKey } from "@/lib/types";

function parseRef(ref: string): { source: SourceKey; lid: string } | null {
  const [src, ...rest] = ref.split("-");
  const lid = rest.join("-");
  if (!SOURCES.find((s) => s.key === src)) return null;
  return { source: src as SourceKey, lid };
}

function DetailInner({ id, ref }: { id: string; ref: string }) {
  const params = useSearchParams();
  const parsed = parseRef(ref);
  if (!parsed) return notFound();

  const { source, lid } = parsed;
  const sourceData = MOCK_RESULT.sources.find((s) => s.source === source);
  const listing = sourceData?.listings.find((l) => l.id === lid);
  if (!listing) return notFound();

  const meta = SOURCES.find((s) => s.key === source)!;
  const images =
    listing.images && listing.images.length > 0
      ? listing.images
      : listing.thumbnail
        ? [listing.thumbnail]
        : [];

  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const listingRef = `${source}-${lid}`;
  const pinned = useListingPinnedValue(listingRef);
  const memo = useListingMemoValue(listingRef);
  const [memoEditing, setMemoEditing] = useState(false);
  const [memoDraft, setMemoDraft] = useState<string | null>(null);

  const fromKeyword = params.get("keyword") ?? undefined;

  useEffect(() => {
    recordListingView({
      ref: listingRef,
      source,
      title: listing.title,
      price: listing.price,
      thumbnail: listing.thumbnail,
      endedAt: listing.endedAt,
      condition: listing.condition,
      fromKeyword,
    });
  }, [
    listingRef,
    source,
    listing.title,
    listing.price,
    listing.thumbnail,
    listing.endedAt,
    listing.condition,
    fromKeyword,
  ]);

  function startMemoEdit() {
    setMemoDraft(memo);
    setMemoEditing(true);
  }

  function saveMemo() {
    if (memoDraft !== null) setListingMemo(listingRef, memoDraft);
    setMemoEditing(false);
    setMemoDraft(null);
  }

  function cancelMemoEdit() {
    setMemoEditing(false);
    setMemoDraft(null);
  }

  const queryStr = new URLSearchParams(params.toString()).toString();
  const backHref = `/search/result/${id}${queryStr ? `?${queryStr}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      {/* 画像エリア */}
      <section>
        {images.length > 0 ? (
          <>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="block w-full aspect-square rounded-xl overflow-hidden bg-surface-2 border border-border"
              aria-label="画像を拡大"
            >
              <img
                src={images[activeImage]}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
            {images.length > 1 && (
              <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
                {images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={
                      i === activeImage
                        ? "shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 border-primary"
                        : "shrink-0 w-16 h-16 rounded-md overflow-hidden border border-border opacity-70"
                    }
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-full aspect-square rounded-xl bg-surface-2 border border-border flex items-center justify-center text-muted text-sm">
            画像なし
          </div>
        )}
      </section>

      {/* タイトル / 価格 */}
      <section className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <SourceBadge source={source} />
            <ConditionBadge
              rank={classifyCondition(listing.condition)}
              size="sm"
            />
            <span className="text-xs text-muted">{meta.status}</span>
          </div>
          <button
            type="button"
            onClick={() => setListingPinned(listingRef, !pinned)}
            aria-label={pinned ? "ピンを外す" : "ピン留め"}
            className={
              pinned
                ? "shrink-0 -mt-1 -mr-1 w-9 h-9 rounded-lg flex items-center justify-center bg-warning/10 text-warning"
                : "shrink-0 -mt-1 -mr-1 w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:bg-surface-2"
            }
          >
            <Star size={18} fill={pinned ? "currentColor" : "none"} />
          </button>
        </div>
        <h1 className="text-base font-bold text-foreground leading-snug">
          {listing.title}
        </h1>
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-2xl font-bold text-foreground">
            {formatYen(listing.price)}
          </span>
          {listing.bidCount !== undefined && (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Gavel size={12} />
              入札{listing.bidCount}件
            </span>
          )}
        </div>
      </section>

      {/* 詳細情報 */}
      <section className="bg-surface border border-border rounded-xl divide-y divide-border">
        {listing.condition && (
          <DetailRow
            icon={<Tag size={16} />}
            label="状態"
            value={listing.condition}
          />
        )}
        <DetailRow
          icon={<CalendarDays size={16} />}
          label={meta.status}
          value={formatRelativeDate(listing.endedAt)}
          sub={new Date(listing.endedAt).toLocaleString("ja-JP", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
        {listing.sellerName && (
          <DetailRow
            icon={<User size={16} />}
            label="出品者"
            value={listing.sellerName}
          />
        )}
        {listing.shippingInfo && (
          <DetailRow
            icon={<Truck size={16} />}
            label="配送"
            value={listing.shippingInfo}
          />
        )}
        {listing.location && (
          <DetailRow
            icon={<MapPin size={16} />}
            label="所在地"
            value={listing.location}
          />
        )}
      </section>

      {/* 付属品 */}
      <AccessoriesSection
        title={listing.title}
        description={listing.description}
        accessories={listing.accessories}
      />

      {/* 説明 */}
      {listing.description && (
        <section className="bg-surface border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">
            商品説明
          </h2>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {listing.description}
          </p>
        </section>
      )}

      {/* CTA */}
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="h-14 rounded-lg flex items-center justify-center gap-2 text-base font-bold shadow-sm transition-colors"
        style={{
          backgroundColor: meta.color,
          color: "white",
        }}
      >
        <PlatformLogo source={source} size={20} />
        {meta.name}で詳細を見る
        <ExternalLink size={18} />
      </a>

      <Link
        href={backHref}
        className="h-12 rounded-lg border border-border bg-surface text-foreground text-sm font-medium hover:bg-surface-2 flex items-center justify-center"
      >
        検索結果に戻る
      </Link>

      {/* 査定メモ（商品単位） */}
      <section className="bg-surface border border-border rounded-xl p-4 mt-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <StickyNote size={16} className="text-warning" />
            <span className="text-sm font-semibold text-foreground">
              査定メモ
            </span>
          </div>
          {!memoEditing && (
            <button
              type="button"
              onClick={startMemoEdit}
              className="text-xs text-primary hover:underline"
            >
              {memo ? "編集" : "+ 追加"}
            </button>
          )}
        </div>
        {memoEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={memoDraft ?? ""}
              onChange={(e) => setMemoDraft(e.target.value)}
              rows={3}
              placeholder="例: ¥120,000で買取打診したい候補。状態Bランクを目安"
              className="w-full p-3 rounded-lg bg-surface-2 border border-border text-foreground placeholder:text-muted text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelMemoEdit}
                className="flex-1 h-9 rounded-lg border border-border text-foreground text-sm hover:bg-surface-2"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={saveMemo}
                className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                保存
              </button>
            </div>
          </div>
        ) : memo ? (
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {memo}
          </p>
        ) : (
          <p className="text-xs text-muted">
            この商品にメモを残せます。閲覧履歴から一覧で確認できます。
          </p>
        )}
      </section>

      <section className="bg-surface-2 rounded-xl p-3 mt-2">
        <p className="text-xs text-muted leading-relaxed">
          ※ この情報は{meta.name}から取得した時点のスナップショットです。
          最新の情報は媒体のページでご確認ください。
        </p>
      </section>

      {lightboxOpen && images[activeImage] && (
        <ImageLightbox
          src={images[activeImage]}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

function AccessoriesSection({
  title,
  description,
  accessories,
}: {
  title?: string;
  description?: string;
  accessories?: string[];
}) {
  const { items, isInferred } = detectAccessories({
    title,
    description,
    accessories,
  });

  if (items.length === 0) return null;

  return (
    <section className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">付属品</h2>
        </div>
        {isInferred && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted px-2 py-0.5 rounded-full bg-surface-2">
            <Sparkles size={10} />
            本文から自動抽出
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((a) => (
          <span
            key={a}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-surface-2 text-foreground border border-border"
          >
            {a}
          </span>
        ))}
      </div>
      {isInferred && (
        <p className="text-[11px] text-muted mt-2 leading-relaxed">
          ※ 本文中のキーワードから自動抽出した結果です。実際の付属品とは異なる場合があります。
        </p>
      )}
    </section>
  );
}

function DetailRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <div className="text-muted mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        <span className="text-xs text-muted shrink-0">{label}</span>
        <div className="text-right min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {value}
          </div>
          {sub && (
            <div className="text-xs text-muted mt-0.5 truncate">{sub}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string; ref: string }>;
}) {
  const { id, ref } = use(params);
  return (
    <AppShell
      back={{ href: `/search/result/${id}`, label: "結果" }}
      title="出品詳細"
    >
      <Suspense
        fallback={
          <div className="pt-8 text-center text-muted text-sm">
            読み込み中...
          </div>
        }
      >
        <DetailInner id={id} ref={ref} />
      </Suspense>
    </AppShell>
  );
}
