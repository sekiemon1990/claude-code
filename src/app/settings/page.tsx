"use client";

import { Type, Vibrate, Sparkles, Calculator } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSettings, useTheme } from "@/lib/storage";

export default function SettingsPage() {
  const [settings, update] = useSettings();
  const [theme, toggleTheme] = useTheme();

  return (
    <AppShell back={{ href: "/search", label: "戻る" }} title="設定">
      <div className="flex flex-col gap-4">
        <section className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Type size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">表示</h2>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-foreground">文字サイズ</label>
                <span className="text-xs font-bold text-primary">
                  {Math.round(settings.fontScale * 100)}%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { v: 0.9, label: "小" },
                  { v: 1.0, label: "標準" },
                  { v: 1.15, label: "大" },
                  { v: 1.3, label: "特大" },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => update({ fontScale: opt.v })}
                    className={
                      settings.fontScale === opt.v
                        ? "h-11 rounded-lg border-2 border-primary bg-primary/5 text-primary font-semibold text-sm"
                        : "h-11 rounded-lg border border-border bg-surface text-foreground text-sm hover:border-foreground/30"
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-foreground">テーマ</label>
                <span className="text-xs text-muted">
                  {theme === "dark" ? "ダーク" : "ライト"}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full h-11 rounded-lg border border-border bg-surface text-foreground text-sm hover:border-foreground/30"
              >
                {theme === "dark" ? "ライトに切替" : "ダークに切替"}
              </button>
            </div>
          </div>
        </section>

        <section className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">操作</h2>
          </div>

          <div className="flex flex-col gap-3">
            <ToggleRow
              icon={<Vibrate size={14} />}
              label="ハプティックフィードバック"
              description="ピン留め・メモ保存時に軽く振動"
              checked={settings.hapticEnabled}
              onChange={(v) => update({ hapticEnabled: v })}
            />
            <ToggleRow
              label="アニメーションを減らす"
              description="トランジション・スピナーを抑制"
              checked={settings.reducedMotion}
              onChange={(v) => update({ reducedMotion: v })}
            />
          </div>
        </section>

        <section className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">査定</h2>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-foreground">
                デフォルト買取率
              </label>
              <span className="text-base font-bold text-primary">
                {settings.defaultBuyRate}%
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={95}
              step={5}
              value={settings.defaultBuyRate}
              onChange={(e) =>
                update({ defaultBuyRate: Number(e.target.value) })
              }
              className="w-full accent-primary"
            />
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
              計算機やAI査定の初期値に使われます。
            </p>
          </div>
        </section>

        <section className="bg-surface-2 rounded-xl p-3">
          <p className="text-xs text-muted leading-relaxed">
            設定は端末のブラウザに保存されます。端末を変えると引き継がれません。
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {icon && <span className="text-muted">{icon}</span>}
          <span className="text-sm text-foreground">{label}</span>
        </div>
        <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={
          checked
            ? "shrink-0 w-11 h-6 rounded-full bg-primary relative transition-colors"
            : "shrink-0 w-11 h-6 rounded-full bg-border relative transition-colors"
        }
      >
        <span
          className={
            checked
              ? "absolute top-0.5 left-[22px] w-5 h-5 bg-white rounded-full shadow transition-all"
              : "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
          }
        />
      </button>
    </div>
  );
}
