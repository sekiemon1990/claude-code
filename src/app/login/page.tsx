"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/search";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setInfo(null);
    setLoading(true);

    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(translateError(error.message));
        setLoading(false);
        return;
      }
      router.push(next);
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        setError(translateError(error.message));
        setLoading(false);
        return;
      }
      // メール認証必須の場合
      if (data.user && !data.session) {
        setInfo(
          "確認メールを送信しました。メール内のリンクをクリックしてアカウントを有効化してください。"
        );
        setLoading(false);
        return;
      }
      // 即時サインイン成功
      router.push(next);
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-background">
      <main className="flex-1 mx-auto w-full max-w-md px-6 pt-16 pb-12 flex flex-col">
        <div className="flex flex-col items-center mb-10">
          <div
            aria-hidden
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black mb-4 shadow-md text-white"
            style={{
              background:
                "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
            }}
          >
            M
          </div>
          <h1 className="text-2xl font-bold text-foreground">マクサスサーチ</h1>
          <p className="text-sm text-muted mt-1">
            出張買取スタッフ向け 一括相場検索
          </p>
        </div>

        <div className="grid grid-cols-2 bg-surface-2 rounded-lg p-1 gap-1 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
              setInfo(null);
            }}
            className={
              mode === "signin"
                ? "tap-scale h-10 rounded-md text-sm font-semibold bg-surface text-foreground shadow-sm"
                : "tap-scale h-10 rounded-md text-sm font-medium text-muted hover:text-foreground"
            }
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
              setInfo(null);
            }}
            className={
              mode === "signup"
                ? "tap-scale h-10 rounded-md text-sm font-semibold bg-surface text-foreground shadow-sm"
                : "tap-scale h-10 rounded-md text-sm font-medium text-muted hover:text-foreground"
            }
          >
            新規登録
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground"
            >
              メールアドレス
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@maxus.co.jp"
                className="w-full h-12 pl-10 pr-4 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              パスワード
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <input
                id="password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "signin" ? "••••••••" : "6文字以上"
                }
                className="w-full h-12 pl-10 pr-4 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/30">
              <AlertCircle
                size={16}
                className="text-danger shrink-0 mt-0.5"
              />
              <p className="text-sm text-foreground leading-relaxed">{error}</p>
            </div>
          )}

          {info && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-success/10 border border-success/30">
              <Mail size={16} className="text-success shrink-0 mt-0.5" />
              <p className="text-sm text-foreground leading-relaxed">{info}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="tap-scale h-12 mt-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === "signin" ? "ログイン" : "新規登録"}
          </button>
        </form>

        <div className="mt-auto pt-12 text-center text-xs text-muted">
          <p>マクサスサーチ v0.2.0</p>
          <p className="mt-1">© Maxus Inc.</p>
        </div>
      </main>
    </div>
  );
}

function translateError(message: string): string {
  // Supabase のエラーメッセージを日本語化
  if (message.includes("Invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません";
  }
  if (message.includes("User already registered")) {
    return "このメールアドレスは既に登録されています。ログインしてください。";
  }
  if (message.includes("Email not confirmed")) {
    return "メール認証が完了していません。受信トレイをご確認ください。";
  }
  if (message.includes("Password should be at least")) {
    return "パスワードは6文字以上で入力してください";
  }
  if (message.includes("Email rate limit")) {
    return "メール送信の上限に達しました。しばらくしてから再度お試しください。";
  }
  if (message.includes("Unable to validate email address")) {
    return "メールアドレスの形式が正しくありません";
  }
  return message;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted text-sm">
          読み込み中...
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
