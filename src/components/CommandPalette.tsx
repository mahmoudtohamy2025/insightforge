import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useI18n } from "@/lib/i18n";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Tag, Sparkles, StickyNote, Loader2, Search,
  LayoutDashboard, FolderKanban, ClipboardList, Video,
  Lightbulb, Users, Settings, Globe2, ShieldCheck,
  GraduationCap, BookOpen, FileQuestion, Gift, GitCompareArrows,
  FlaskConical, TrendingUp, Scale, Plus, Zap,
} from "lucide-react";

interface SearchResult {
  entity_type: string;
  entity_id: string;
  title: string;
  snippet: string;
  relevance: number;
  created_at: string;
}

const typeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  transcript: { icon: FileText, label: "Transcript", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  theme: { icon: Tag, label: "Theme", color: "bg-purple-500/10 text-purple-600 border-purple-200" },
  pattern: { icon: Sparkles, label: "Pattern", color: "bg-amber-500/10 text-amber-600 border-amber-200" },
  note: { icon: StickyNote, label: "Note", color: "bg-green-500/10 text-green-600 border-green-200" },
};

interface NavCommand {
  label: string;
  icon: React.ElementType;
  url: string;
  group: "Pages";
}

interface ActionCommand {
  label: string;
  icon: React.ElementType;
  url: string;
  group: "Quick Actions";
}

const NAV_COMMANDS: NavCommand[] = [
  { label: "Dashboard", icon: LayoutDashboard, url: "/dashboard", group: "Pages" },
  { label: "Projects", icon: FolderKanban, url: "/projects", group: "Pages" },
  { label: "Surveys", icon: ClipboardList, url: "/surveys", group: "Pages" },
  { label: "Sessions", icon: Video, url: "/sessions", group: "Pages" },
  { label: "Insights", icon: Lightbulb, url: "/insights", group: "Pages" },
  { label: "Digital Twins", icon: Sparkles, url: "/segments", group: "Pages" },
  { label: "Simulation Studio", icon: FlaskConical, url: "/simulate", group: "Pages" },
  { label: "Focus Group Studio", icon: Users, url: "/focus-group", group: "Pages" },
  { label: "A/B Test Studio", icon: FlaskConical, url: "/ab-test", group: "Pages" },
  { label: "Market Sim Studio", icon: TrendingUp, url: "/market-sim", group: "Pages" },
  { label: "Policy Sim Studio", icon: Scale, url: "/policy-sim", group: "Pages" },
  { label: "Compare Simulations", icon: GitCompareArrows, url: "/simulations/compare", group: "Pages" },
  { label: "Participants", icon: Users, url: "/participants", group: "Pages" },
  { label: "Requirements", icon: FileQuestion, url: "/requirements", group: "Pages" },
  { label: "Incentives", icon: Gift, url: "/incentives", group: "Pages" },
  { label: "Marketplace", icon: Globe2, url: "/marketplace", group: "Pages" },
  { label: "Validation Studies", icon: GraduationCap, url: "/validation", group: "Pages" },
  { label: "Methodology", icon: BookOpen, url: "/methodology", group: "Pages" },
  { label: "Trust Center", icon: ShieldCheck, url: "/trust-center", group: "Pages" },
  { label: "Settings", icon: Settings, url: "/settings", group: "Pages" },
];

const ACTION_COMMANDS: ActionCommand[] = [
  { label: "Create Survey", icon: Plus, url: "/surveys", group: "Quick Actions" },
  { label: "Schedule Session", icon: Plus, url: "/sessions", group: "Quick Actions" },
  { label: "Run Simulation", icon: Zap, url: "/simulate", group: "Quick Actions" },
  { label: "Post Study to Marketplace", icon: Plus, url: "/participants", group: "Quick Actions" },
  { label: "Build Custom Twin", icon: Sparkles, url: "/twin-builder", group: "Quick Actions" },
];

const RECENT_STORAGE_KEY = "if_recent_pages";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { currentWorkspace } = useWorkspace();
  const { t } = useI18n();
  const navigate = useNavigate();

  // Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const handleCustomOpen = () => setOpen(true);
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleCustomOpen);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleCustomOpen);
    };
  }, []);

  const [recentUrls, setRecentUrls] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      try {
        const stored = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || "[]");
        setRecentUrls(stored);
      } catch (e) {
        setRecentUrls([]);
      }
    }
  }, [open]);

  // Debounced content search
  useEffect(() => {
    if (!query.trim() || !currentWorkspace?.id) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data, error } = await supabase.rpc("global_search", {
          ws_id: currentWorkspace.id,
          search_query: query.trim(),
          result_limit: 15,
        });
        if (error) {
          setResults([]);
        } else {
          setResults((data as SearchResult[]) || []);
        }
      } catch {
        setResults([]);
      }
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, currentWorkspace?.id]);

  const handleNavigate = useCallback(
    (url: string) => {
      setOpen(false);
      setQuery("");
      
      // Save to recent
      const navItem = NAV_COMMANDS.find(n => n.url === url) || ACTION_COMMANDS.find(a => a.url === url);
      if (navItem) {
        try {
          const stored = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || "[]") as string[];
          const updated = [url, ...stored.filter(u => u !== url)].slice(0, 5);
          localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          // ignore
        }
      }
      
      navigate(url);
    },
    [navigate],
  );

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery("");
      switch (result.entity_type) {
        case "transcript":
        case "theme":
        case "note":
          navigate(`/sessions/${result.entity_id}`);
          break;
        case "pattern":
          navigate("/insights");
          break;
      }
    },
    [navigate],
  );

  const formatSnippet = (snippet: string) =>
    snippet.replace(/<<([^>]+)>>/g, "**$1**").replace(/\n/g, " ").slice(0, 120);

  const grouped = results.reduce(
    (acc, r) => {
      const key = r.entity_type;
      if (!acc[key]) acc[key] = [];
      acc[key].push(r);
      return acc;
    },
    {} as Record<string, SearchResult[]>,
  );

  // Filter nav and action commands based on query
  const filteredNav = query.trim()
    ? NAV_COMMANDS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : NAV_COMMANDS;

  const filteredActions = query.trim()
    ? ACTION_COMMANDS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : ACTION_COMMANDS;

  // Retrieve Recent Command shapes
  const recentCommands = recentUrls
    .map(url => NAV_COMMANDS.find(n => n.url === url) || ACTION_COMMANDS.find(a => a.url === url))
    .filter(Boolean) as (NavCommand | ActionCommand)[];

  return (
    <>

      <CommandDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
        <CommandInput
          placeholder="Search pages, run actions, find research..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[420px]">
          {/* Quick Actions — always shown when no query, or matched */}
          {filteredActions.length > 0 && (
            <>
              <CommandGroup heading="Quick Actions">
                {filteredActions.map((cmd) => (
                  <CommandItem
                    key={cmd.url + cmd.label}
                    value={`action-${cmd.label}`}
                    onSelect={() => handleNavigate(cmd.url)}
                    className="flex items-center gap-2"
                  >
                    <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                      <cmd.icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm">{cmd.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Recent Pages */}
          {!query.trim() && recentCommands.length > 0 && (
            <>
              <CommandGroup heading="Recent">
                {recentCommands.map((cmd) => (
                  <CommandItem
                    key={`recent-${cmd.url}`}
                    value={`recent-${cmd.label}`}
                    onSelect={() => handleNavigate(cmd.url)}
                    className="flex items-center gap-2"
                  >
                    <cmd.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm">{cmd.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Page Navigation */}
          {filteredNav.length > 0 && (
            <>
              <CommandGroup heading="Navigate To">
                {filteredNav.map((cmd) => (
                  <CommandItem
                    key={cmd.url}
                    value={`nav-${cmd.label}`}
                    onSelect={() => handleNavigate(cmd.url)}
                    className="flex items-center gap-2"
                  >
                    <cmd.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm">{cmd.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {/* Content search results */}
          {query.trim() && (
            <>
              <CommandSeparator />
              {isSearching && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!isSearching && results.length === 0 && filteredNav.length === 0 && filteredActions.length === 0 && (
                <CommandEmpty>No results found for "{query}"</CommandEmpty>
              )}
              {!isSearching && Object.entries(grouped).map(([type, items], groupIdx) => {
                const config = typeConfig[type] || typeConfig.transcript;
                return (
                  <div key={type}>
                    {groupIdx > 0 && <CommandSeparator />}
                    <CommandGroup heading={`${config.label}s (${items.length})`}>
                      {items.map((result) => {
                        const Icon = config.icon;
                        return (
                          <CommandItem
                            key={`${result.entity_type}-${result.entity_id}-${result.created_at}`}
                            value={`${result.entity_type}-${result.entity_id}`}
                            onSelect={() => handleSelect(result)}
                            className="flex items-start gap-2 py-2"
                          >
                            <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{result.title}</span>
                                <Badge variant="outline" className={`text-[9px] shrink-0 ${config.color}`}>
                                  {config.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {formatSnippet(result.snippet)}
                              </p>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </div>
                );
              })}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
