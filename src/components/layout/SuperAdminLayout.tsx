import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCircle,
  BookOpen,
  Cpu,
  DollarSign,
  ShieldCheck,
  Settings,
  ArrowLeft,
  LogOut,
  Shield,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const NAV_ITEMS = [
  { label: "Command Center", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Tenants", to: "/admin/tenants", icon: Building2 },
  { label: "Users", to: "/admin/users", icon: UserCircle },
  { label: "Participants", to: "/admin/participants", icon: Users },
  { label: "Studies", to: "/admin/studies", icon: BookOpen },
  { label: "AI Usage", to: "/admin/ai-usage", icon: Cpu },
  { label: "Financials", to: "/admin/financials", icon: DollarSign },
  { label: "Audit Trail", to: "/admin/audit", icon: ShieldCheck },
  { label: "System", to: "/admin/system", icon: Settings },
];

export function SuperAdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const displayName = user?.user_metadata?.full_name || "Admin";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col shrink-0 bg-slate-900 border-r border-slate-800/60 transition-all duration-200",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Brand */}
        <div className="p-4 border-b border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <Shield className="h-4 w-4 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-bold text-white leading-tight">Super Admin</div>
                <div className="text-[10px] text-slate-500 leading-tight">InsightForge Platform</div>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-600 hover:text-slate-400 transition-colors ml-auto"
          >
            <ChevronRight className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-180")} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative",
                  collapsed && "justify-center",
                  isActive
                    ? "bg-indigo-500/15 text-indigo-400 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Divider */}
        <div className="h-px bg-slate-800/60 mx-3" />

        {/* Footer */}
        <div className="p-2 space-y-0.5">
          <NavLink
            to="/dashboard"
            title={collapsed ? "Back to App" : undefined}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Back to App</span>}
          </NavLink>

          <div className={cn("flex items-center gap-2 px-3 py-2", collapsed && "justify-center")}>
            <div className="h-7 w-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-300 truncate">{displayName}</div>
                <div className="text-[10px] text-slate-600 truncate">{user?.email}</div>
              </div>
            )}
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="text-slate-600 hover:text-red-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
