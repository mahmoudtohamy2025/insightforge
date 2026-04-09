import { Bell, Globe } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { NotificationCenter } from "@/components/layout/NotificationCenter";

export function AppHeader() {
  const { t, language, setLanguage } = useI18n();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <SidebarTrigger className="shrink-0" />

      {/* Global Search Trigger */}
      <div className="flex-1 max-w-md flex items-center">
        <button
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors w-full max-w-[220px]"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-start text-xs">{t("nav.search")}</span>
          <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1">
        {/* Language Toggle */}
        <LanguageSelector />

        {/* Dark Mode */}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationCenter />
      </div>
    </header>
  );
}
