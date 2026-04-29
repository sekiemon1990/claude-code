"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Info, AlertCircle, X } from "lucide-react";
import type { ToastOptions, ToastVariant } from "@/lib/toast";

type ToastInstance = ToastOptions & { id: number; closing: boolean };

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <Check size={16} />,
  info: <Info size={16} />,
  error: <AlertCircle size={16} />,
};

const COLORS: Record<ToastVariant, string> = {
  success: "var(--success)",
  info: "var(--primary)",
  error: "var(--danger)",
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastInstance[]>([]);

  useEffect(() => {
    let nextId = 1;
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastOptions>).detail;
      const id = nextId++;
      const instance: ToastInstance = {
        id,
        closing: false,
        variant: "success",
        duration: 2400,
        ...detail,
      };
      setToasts((prev) => [...prev, instance]);
      const closeAt = instance.duration ?? 2400;
      window.setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, closing: true } : t))
        );
      }, closeAt);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, closeAt + 220);
    }
    window.addEventListener("maxus_toast", onToast);
    return () => window.removeEventListener("maxus_toast", onToast);
  }, []);

  return (
    <div
      className="fixed left-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        transform: "translateX(-50%)",
      }}
      aria-live="polite"
    >
      {toasts.map((t) => {
        const variant = t.variant ?? "success";
        const color = COLORS[variant];
        return (
          <div
            key={t.id}
            className={
              t.closing
                ? "anim-toast-out pointer-events-auto bg-surface border border-border rounded-full shadow-xl px-4 py-2.5 flex items-center gap-2.5 min-w-[200px] max-w-[90vw]"
                : "anim-toast-in pointer-events-auto bg-surface border border-border rounded-full shadow-xl px-4 py-2.5 flex items-center gap-2.5 min-w-[200px] max-w-[90vw]"
            }
            style={{ borderColor: `${color}33` }}
            role={variant === "error" ? "alert" : "status"}
          >
            <span style={{ color }}>{ICONS[variant]}</span>
            <span className="text-sm text-foreground flex-1">{t.message}</span>
            {t.actionLabel && t.actionHref && (
              <Link
                href={t.actionHref}
                className="text-xs font-semibold text-primary hover:underline shrink-0"
              >
                {t.actionLabel}
              </Link>
            )}
            <button
              type="button"
              onClick={() =>
                setToasts((prev) =>
                  prev.map((x) => (x.id === t.id ? { ...x, closing: true } : x))
                )
              }
              aria-label="閉じる"
              className="shrink-0 w-5 h-5 rounded-full text-muted hover:text-foreground flex items-center justify-center"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
