"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Check } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SOURCES, type SourceKey } from "@/lib/types";

type Period = "30" | "90" | "all";

export default function SearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [excludes, setExcludes] = useState("");
  const [period, setPeriod] = useState<Period>("30");
  const [selectedSources, setSelectedSources] = useState<SourceKey[]>([
    "yahoo_auction",
  ]);

  function toggleSource(key: SourceKey) {
    setSelectedSources((prev) =>
      prev.includes(key)
        ? prev.length > 1
          ? prev.filter((k) => k !== key)
          : prev
        : [...prev, key]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) return;
    if (selectedSources.length === 0) return;
    const params = new URLSearchParams({
      keyword: keyword.trim(),
      ...(excludes.trim() && { excludes: excludes.trim() }),
      period,
      sources: selectedSources.join(","),
    });
    router.push(`/search/loading?${params.toString()}`);
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <section>
          <h2 className="text-xl font-bold text-foreground">相場を検索</h2>
          <p className="text-sm text-muted mt-1">
            選択した媒体から一括で落札相場を取得します
          </p>
        </section>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="keyword"
              className="text-sm font-medium text-foreground"
            >
              商品名・型番 <span className="text-danger">*</span>
            </label>
            <input
              id="keyword"
              type="text"
              required
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="例: SONY α7 IV ILCE-7M4"
              className="h-12 px-4 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="excludes"
              className="text-sm font-medium text-foreground"
            >
              除外ワード
              <span className="ml-1 text-xs text-muted font-normal">
                （任意・スペース区切り）
              </span>
            </label>
            <input
              id="excludes"
              type="text"
              value={excludes}
              onChange={(e) => setExcludes(e.target.value)}
              placeholder="例: ジャンク 部品"
              className="h-12 px-4 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              検索媒体
              <span className="ml-1 text-xs text-muted font-normal">
                （複数選択可）
              </span>
            </span>
            <div className="grid grid-cols-3 gap-2">
              {SOURCES.map((s) => {
                const selected = selectedSources.includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleSource(s.key)}
                    className={
                      selected
                        ? "h-11 rounded-lg border-2 bg-surface text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        : "h-11 rounded-lg border border-border bg-surface text-foreground text-sm flex items-center justify-center gap-1.5 hover:border-foreground/30"
                    }
                    style={
                      selected
                        ? {
                            borderColor: s.color,
                            color: s.color,
                            backgroundColor: `${s.color}0d`,
                          }
                        : undefined
                    }
                  >
                    {selected && <Check size={14} />}
                    {s.shortName}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              検索期間
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { v: "30", label: "直近30日" },
                  { v: "90", label: "直近90日" },
                  { v: "all", label: "全期間" },
                ] as { v: Period; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setPeriod(opt.v)}
                  className={
                    period === opt.v
                      ? "h-11 rounded-lg border-2 border-primary bg-primary/5 text-primary font-semibold text-sm"
                      : "h-11 rounded-lg border border-border bg-surface text-foreground text-sm hover:border-foreground/30"
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="h-14 mt-2 rounded-lg bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 active:bg-primary/80 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <Search size={20} />
            検索する
          </button>
        </form>

        <section className="mt-2">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            検索のコツ
          </h3>
          <ul className="text-xs text-muted space-y-1 leading-relaxed">
            <li>・ ブランド名・型番をスペース区切りで入れると精度UP</li>
            <li>・ 「ジャンク」「部品取り」を除外すると相場が安定</li>
            <li>・ 媒体を増やすほど取得時間が長くなります</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
