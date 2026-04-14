import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, UserCircle, Building2, Loader2 } from "lucide-react";

export default function AdminUsers() {
  const [search, setSearch] = useState("");

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-users-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, avatar_url");
      return data ?? [];
    },
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ["admin-users-memberships"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_memberships")
        .select("user_id, workspace_id, role");
      return data ?? [];
    },
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ["admin-users-workspaces"],
    queryFn: async () => {
      const { data } = await supabase.from("workspaces").select("id, name");
      return data ?? [];
    },
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["admin-users-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      return data ?? [];
    },
  });

  const { data: superAdmins = [] } = useQuery({
    queryKey: ["admin-super-admins"],
    queryFn: async () => {
      const { data } = await supabase.from("super_admins").select("user_id");
      return data ?? [];
    },
  });

  const wsMap = workspaces.reduce((a: Record<string, string>, w: any) => { a[w.id] = w.name; return a; }, {});
  const roleMap = userRoles.reduce((a: Record<string, string>, r: any) => { a[r.user_id] = r.role; return a; }, {});
  const saSet = new Set(superAdmins.map((s: any) => s.user_id));

  const membersByUser = memberships.reduce((a: Record<string, any[]>, m: any) => {
    if (!a[m.user_id]) a[m.user_id] = [];
    a[m.user_id].push(m);
    return a;
  }, {});

  const filtered = profiles.filter((p: any) => {
    const q = search.toLowerCase();
    return (
      (p.full_name?.toLowerCase().includes(q) || p.id?.includes(q))
    );
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">User Directory</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {profiles.length} registered users across the platform
        </p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-600" /></div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-3 py-3 w-28">Role</th>
                <th className="text-left px-3 py-3">Workspaces</th>
                <th className="text-left px-3 py-3 w-28">Super Admin</th>
                <th className="text-left px-3 py-3 w-20">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.map((p: any) => {
                const userMs = membersByUser[p.id] || [];
                const isSA = saSet.has(p.id);
                return (
                  <tr key={p.id} className="hover:bg-slate-800/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
                          {p.full_name?.charAt(0)?.toUpperCase() || <UserCircle className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">{p.full_name || "—"}</div>
                          <div className="text-[10px] text-slate-600 font-mono truncate">{p.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs text-slate-400 capitalize">{roleMap[p.id] || "—"}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {userMs.slice(0, 3).map((m: any) => (
                          <div key={m.workspace_id} className="flex items-center gap-1.5 bg-slate-800 rounded px-2 py-0.5">
                            <Building2 className="h-2.5 w-2.5 text-slate-500" />
                            <span className="text-[10px] text-slate-400 truncate max-w-[80px]">
                              {wsMap[m.workspace_id] || m.workspace_id.slice(0, 8)}
                            </span>
                            <span className="text-[10px] text-slate-600 capitalize">{m.role}</span>
                          </div>
                        ))}
                        {userMs.length > 3 && (
                          <span className="text-[10px] text-slate-600">+{userMs.length - 3} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {isSA ? (
                        <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">Super Admin</span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Active</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-600 text-sm">No users found</div>
          )}
        </div>
      )}
    </div>
  );
}
