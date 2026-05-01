"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "maxus_search:pwa_install_dismissed_at";
// 一度閉じたら 7 日間は再表示しない
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function PWAInit() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBar, setShowBar] = useState(false);

  // Service Worker 登録
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 失敗しても致命ではない
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  // beforeinstallprompt イベントを補足
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 既にインストール済み (standalone モード) なら何もしない
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // 直近 7 日以内に閉じていれば表示しない
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt && Date.now() - Number(dismissedAt) < COOLDOWN_MS) {
        return;
      }
    } catch {
      // ignore
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setShowBar(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setShowBar(false);
      setInstallEvent(null);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } finally {
      setInstallEvent(null);
      setShowBar(false);
    }
  }

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setShowBar(false);
  }

  if (!showBar) return null;

  return (
    <div
      role="dialog"
      aria-label="アプリインストール"
      className="fixed bottom-4 left-4 right-4 z-50 anim-slide-up sm:left-auto sm:right-4 sm:max-w-sm bg-surface border border-border rounded-xl shadow-lg p-3 flex items-center gap-3"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Download size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">
          ホーム画面に追加
        </p>
        <p className="text-xs text-muted">
          アプリのように起動できて便利です
        </p>
      </div>
      <button
        type="button"
        onClick={handleInstall}
        className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 shrink-0"
      >
        追加
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="閉じる"
        className="w-8 h-8 rounded-md text-muted hover:bg-surface-2 flex items-center justify-center shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}
