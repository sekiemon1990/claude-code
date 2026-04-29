"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, History, Settings as SettingsIcon, ListChecks } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { ListBar } from "./ListBar";

type AppShellProps = {
  title?: string;
  showNav?: boolean;
  back?: { href: string; label?: string };
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
};

export function AppShell({
  title = "マクサスサーチ",
  showNav = true,
  back,
  children,
  rightSlot,
}: AppShellProps) {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-surface border-b border-border">
        <div className="mx-auto max-w-md w-full px-4 h-14 flex items-center justify-between">
          {back ? (
            <Link
              href={back.href}
              className="tap-scale flex items-center text-sm text-foreground hover:text-primary -ml-2 px-2 py-1 rounded"
              aria-label="戻る"
            >
              <span className="text-xl leading-none">‹</span>
              <span className="ml-1">{back.label ?? "戻る"}</span>
            </Link>
          ) : (
            <Link
              href="/search"
              className="tap-scale flex items-center gap-2"
              aria-label="ホーム"
            >
              <BrandMark />
              <span className="font-semibold text-foreground">{title}</span>
            </Link>
          )}
          {back && (
            <span className="font-semibold text-foreground text-sm">
              {title}
            </span>
          )}
          <div className="flex items-center gap-1">
            {rightSlot}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <ListBar />

      <main className="flex-1 mx-auto max-w-md w-full px-4 py-4 pb-24">
        {children}
      </main>

      {showNav && (
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border">
          <div className="mx-auto max-w-md w-full grid grid-cols-4">
            <NavItem
              href="/search"
              icon={<Search size={20} />}
              label="検索"
              matchPrefix="/search"
            />
            <NavItem
              href="/list"
              icon={<ListChecks size={20} />}
              label="リスト"
              matchPrefix="/list"
            />
            <NavItem
              href="/history"
              icon={<History size={20} />}
              label="履歴"
              matchPrefix="/history"
            />
            <NavItem
              href="/settings"
              icon={<SettingsIcon size={20} />}
              label="設定"
              matchPrefix="/settings"
            />
          </div>
        </nav>
      )}
    </div>
  );
}

function NavItem({
  href,
  icon,
  label,
  matchPrefix,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  matchPrefix: string;
}) {
  const pathname = usePathname();
  const active = pathname?.startsWith(matchPrefix) ?? false;

  return (
    <Link
      href={href}
      className={
        active
          ? "tap-scale relative flex flex-col items-center justify-center py-2 text-xs font-semibold text-primary"
          : "tap-scale relative flex flex-col items-center justify-center py-2 text-xs text-muted hover:text-foreground"
      }
    >
      {active && (
        <span
          aria-hidden
          className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-b-full bg-primary"
        />
      )}
      <span className="mb-0.5">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function BrandMark() {
  return (
    <span
      aria-hidden
      className="w-7 h-7 rounded-md flex items-center justify-center font-black text-sm shadow-sm"
      style={{
        background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
        color: "white",
      }}
    >
      M
    </span>
  );
}
