"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/storage";

export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="テーマ切替"
      className="w-9 h-9 rounded-lg flex items-center justify-center text-foreground hover:bg-surface-2 transition-colors"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
