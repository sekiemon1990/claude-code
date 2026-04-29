"use client";

import { useEffect, useState } from "react";
import { formatJSTDate, formatRelativeDate } from "@/lib/utils";

// SSR/CSR で同じ結果になる絶対日付を初期表示し、
// マウント後に "X分前" などの相対表記へ更新する。
// これによりハイドレーション不一致 (React #418) を防ぐ。
export function RelativeDate({
  iso,
  className,
}: {
  iso: string;
  className?: string;
}) {
  const [text, setText] = useState<string>(() => formatJSTDate(iso));

  useEffect(() => {
    const update = () => setText(formatRelativeDate(iso));
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [iso]);

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}
