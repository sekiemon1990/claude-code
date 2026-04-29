"use client";

import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import { Suspense, use, useState } from "react";
import {
  ExternalLink,
  Gavel,
  CalendarDays,
  User,
  Truck,
  MapPin,
  Tag,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SourceBadge } from "@/components/SourceBadge";
import { ImageLightbox } from "@/components/ImageLightbox";
import { MOCK_RESULT } from "@/lib/mock-data";
import { formatYen, formatRelativeDate } from "@/lib/utils";
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
        <div className="flex items-center gap-2 mb-2">
          <SourceBadge source={source} />
          <span className="text-xs text-muted">{meta.status}</span>
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
        {meta.name}で詳細を見る
        <ExternalLink size={18} />
      </a>

      <Link
        href={backHref}
        className="h-12 rounded-lg border border-border bg-surface text-foreground text-sm font-medium hover:bg-surface-2 flex items-center justify-center"
      >
        検索結果に戻る
      </Link>

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
