import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  Lightbulb,
  Users,
  Settings,
  ChevronDown,
  Building2,
  LogOut,
  Plus,
  Check,
  Sparkles,
  Globe2,
  ShieldCheck,
  BookOpen,
  FileQuestion,
  Gift,
  GitCompareArrows,
  FlaskConical,
  TrendingUp,
  Scale,
  ChevronRight,
  Shield,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useNavigate } from "react-router-dom";
import { CreateWorkspaceDialog } from "@/components/CreateWorkspaceDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpDrawer } from "@/components/layout/HelpDrawer";

interface NavItem {
  titleKey?: string;
  title?: string;
  url: string;
  icon: React.ElementType;
}

interface NavGroup {
  labelKey: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "nav.group.research",
    label: "Workspace",
    items: [
      { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
      { title: "Decisions", url: "/requirements", icon: FileQuestion },
      { title: "Insights", url: "/insights", icon: Lightbulb },
      { title: "Summaries", url: "/projects", icon: FolderKanban },
    ],
  },
  {
    labelKey: "nav.group.aiStudio",
    label: "Test Ideas",
    items: [
      { title: "AI Test", url: "/simulate", icon: FlaskConical },
      { title: "Panel Discussion", url: "/focus-group", icon: Users },
      { title: "Quick Survey", url: "/surveys", icon: ClipboardList },
      { title: "Compare Options", url: "/ab-test", icon: GitCompareArrows },
      { title: "Customer Profiles", url: "/segments", icon: Sparkles },
      { title: "Market Forecast", url: "/market-sim", icon: TrendingUp },
      { title: "Policy Check", url: "/policy-sim", icon: Scale },
    ],
  },
  {
    labelKey: "nav.group.panel",
    label: "Research Operations",
    items: [
      { titleKey: "nav.panelOverview", url: "/panel", icon: LayoutDashboard },
      { titleKey: "nav.studyPipeline", url: "/requirements", icon: FileQuestion },
      { titleKey: "nav.audienceCrm", url: "/participants", icon: Users },
      { titleKey: "nav.incentives", url: "/incentives", icon: Gift },
    ],
  },
  {
    labelKey: "nav.group.intelligence",
    label: "Guides & Settings",
    items: [
      { title: "Templates Marketplace", url: "/marketplace", icon: Globe2 },
      { title: "How It Works", url: "/methodology", icon: BookOpen },
      { title: "Trust Center", url: "/trust-center", icon: ShieldCheck },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

function NavGroupSection({
  group,
  collapsed,
  openGroups,
  toggleGroup,
  t,
}: {
  group: NavGroup;
  collapsed: boolean;
  openGroups: Record<string, boolean>;
  toggleGroup: (label: string) => void;
  t: (key: string) => string;
}) {
  const groupLabel = t(group.labelKey);
  const groupStateKey = group.labelKey || group.label;
  const isOpen = openGroups[groupStateKey] !== false; // default open
  const getLabel = (item: NavItem) => item.title ?? (item.titleKey ? t(item.titleKey) : item.url);

  return (
    <SidebarGroup className="px-0">
      {!collapsed && (
        <button
          onClick={() => toggleGroup(groupStateKey)}
          className="flex items-center gap-1 px-3 py-1.5 w-full text-left group"
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 flex-1">
            {groupLabel}
          </span>
          <ChevronRight
            className={cn(
              "h-3 w-3 text-muted-foreground/40 transition-transform duration-200",
              isOpen && "rotate-90"
            )}
          />
        </button>
      )}
      {(isOpen || collapsed) && (
        <SidebarGroupContent>
          <SidebarMenu>
            {group.items.map((item) => (
              <SidebarMenuItem key={item.titleKey ?? item.title ?? item.url}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === "/dashboard"}
                          className="hover:bg-sidebar-accent/50 flex items-center justify-center"
                          activeClassName="bg-sidebar-accent text-primary font-medium"
                        >
                          <item.icon className="h-4 w-4" />
                        </NavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      {getLabel(item)}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 me-2 shrink-0" />
                      <span className="truncate">{getLabel(item)}</span>
                    </NavLink>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
      {!collapsed && <div className="h-px bg-sidebar-border/50 mx-3 my-1" />}
    </SidebarGroup>
  );
}

const STORAGE_KEY = "if_sidebar_groups";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const { currentWorkspace, workspaces, switchWorkspace } = useWorkspace();
  const { isSuperAdmin } = useSuperAdmin();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  // Persisted group open/closed state
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [label]: prev[label] === false ? true : false };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const displayName = user?.user_metadata?.full_name || user?.email || "User";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <>
      <TooltipProvider delayDuration={0}>
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-bold text-sm shadow-sm">
                IF
              </div>
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-sidebar-foreground">InsightForge</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">Founder Decision OS</span>
                </div>
              )}
            </div>
          </SidebarHeader>

          {!collapsed && (
            <div className="px-3 py-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                    <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="flex-1 text-start truncate">
                      {currentWorkspace?.name || t("workspace.select")}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {workspaces.map((ws) => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => switchWorkspace(ws.id)}
                      className="flex items-center gap-2"
                    >
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="flex-1 truncate">{ws.name}</span>
                      {ws.id === currentWorkspace?.id && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setCreateOpen(true)}
                    className="text-muted-foreground text-xs"
                  >
                    <Plus className="h-4 w-4 me-2" />
                    {t("workspace.createNew")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <SidebarContent className="overflow-y-auto">
            {NAV_GROUPS.map((group) => (
              <NavGroupSection
                key={group.label}
                group={group}
                collapsed={collapsed}
                openGroups={openGroups}
                toggleGroup={toggleGroup}
                t={t}
              />
            ))}
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-3">
            {/* Super Admin Link */}
            {isSuperAdmin && !collapsed && (
              <a
                href="/admin"
                className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors text-sm font-medium"
              >
                <Shield className="h-4 w-4" />
                Super Admin
              </a>
            )}
            {isSuperAdmin && collapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="/admin"
                    className="flex items-center justify-center p-2 mb-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                  >
                    <Shield className="h-4 w-4" />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Super Admin</TooltipContent>
              </Tooltip>
            )}
            {!collapsed ? (
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                  {initials}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{user?.email}</span>
                </div>
                <HelpDrawer />
                <ThemeToggle />
                <button
                  onClick={handleSignOut}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title={t("auth.logout")}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <HelpDrawer />
                <ThemeToggle />
                <button
                  onClick={handleSignOut}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title={t("auth.logout")}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>
      </TooltipProvider>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
