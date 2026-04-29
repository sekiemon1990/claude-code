"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";

type Period = "30" | "90" | "all";

export default function SearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [model, setModel] = useState("");
  const [excludes, setExcludes] = useState("");
  const [period, setPeriod] = useState<Period>("30");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) return;
    const params = new URLSearchParams({
      keyword: keyword.trim(),
      ...(model.trim() && { model: model.trim() }),
      ...(excludes.trim() && { excludes: excludes.trim() }),
      period,
    });
    router.push(`/search/loading?${params.toString()}`);
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <section>
          <h2 className="text-xl font-bold text-foreground">相場を検索</h2>
          <p className="text-sm text-muted mt-1">
            ヤフオク・メルカリ・ジモティーから一括検索します
          </p>
        </section>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="keyword"
              className="text-sm font-medium text-foreground"
            >
              商品名 <span className="text-danger">*</span>
            </label>
            <input
              id="keyword"
              type="text"
              required
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="例: SONY α7 IV"
              className="h-12 px-4 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="model"
              className="text-sm font-medium text-foreground"
            >
              型番・メーカー
              <span className="ml-1 text-xs text-muted font-normal">
                （任意）
              </span>
            </label>
            <input
              id="model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="例: ILCE-7M4"
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
            <li>・ ブランド名と型番をセットで入れると精度UP</li>
            <li>・ 「ジャンク」「部品取り」を除外すると相場が安定</li>
            <li>・ 期間は短い方が直近トレンドを反映</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
