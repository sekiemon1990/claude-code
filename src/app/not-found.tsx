import Link from "next/link";
import { Compass, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-surface border border-border rounded-xl p-6 flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Compass size={24} />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground mb-1">
            ページが見つかりませんでした
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            URL が変更された、または商品の出品が削除された可能性があります。
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Link
            href="/search"
            className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 inline-flex items-center justify-center gap-1.5"
          >
            <Search size={14} />
            検索ページへ
          </Link>
          <Link
            href="/"
            className="flex-1 h-11 rounded-lg border border-border text-foreground text-sm hover:bg-surface-2 inline-flex items-center justify-center gap-1.5"
          >
            <Home size={14} />
            ホーム
          </Link>
        </div>
      </div>
    </div>
  );
}
