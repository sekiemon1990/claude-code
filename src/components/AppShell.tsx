import Link from "next/link";
import { Search, History, LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

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
              className="flex items-center text-sm text-foreground hover:text-primary -ml-2 px-2 py-1 rounded"
              aria-label="戻る"
            >
              <span className="text-xl leading-none">‹</span>
              <span className="ml-1">{back.label ?? "戻る"}</span>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <div
                aria-hidden
                className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold"
              >
                M
              </div>
              <span className="font-semibold text-foreground">{title}</span>
            </div>
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

      <main className="flex-1 mx-auto max-w-md w-full px-4 py-4 pb-24">
        {children}
      </main>

      {showNav && (
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border">
          <div className="mx-auto max-w-md w-full grid grid-cols-3">
            <NavItem href="/search" icon={<Search size={20} />} label="検索" />
            <NavItem
              href="/history"
              icon={<History size={20} />}
              label="履歴"
            />
            <NavItem href="/login" icon={<LogOut size={20} />} label="ログアウト" />
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
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center py-2 text-xs text-muted hover:text-primary"
    >
      <span className="mb-0.5">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
