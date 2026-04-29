"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/search");
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-background">
      <main className="flex-1 mx-auto w-full max-w-md px-6 pt-16 pb-12 flex flex-col">
        <div className="flex flex-col items-center mb-12">
          <div
            aria-hidden
            className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-3xl font-bold mb-4 shadow-md"
          >
            M
          </div>
          <h1 className="text-2xl font-bold text-foreground">マクサスサーチ</h1>
          <p className="text-sm text-muted mt-1">
            出張買取スタッフ向け 一括相場検索
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="staffId"
              className="text-sm font-medium text-foreground"
            >
              スタッフID
            </label>
            <input
              id="staffId"
              type="text"
              autoComplete="username"
              inputMode="numeric"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder="例: 1024"
              className="h-12 px-4 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-12 px-4 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <button
            type="submit"
            className="h-12 mt-4 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:bg-primary/80 transition-colors"
          >
            ログイン
          </button>

          <Link
            href="/search"
            className="text-center text-sm text-muted hover:text-primary mt-2"
          >
            パスワードを忘れた場合
          </Link>
        </form>

        <div className="mt-auto pt-12 text-center text-xs text-muted">
          <p>マクサスサーチ v0.1.0</p>
          <p className="mt-1">© Maxus Inc.</p>
        </div>
      </main>
    </div>
  );
}
