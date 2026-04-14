import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Loader2, ShieldAlert } from "lucide-react";

/**
 * Route guard for /admin/* routes.
 * Only allows access if the user is in the super_admins table.
 */
export function SuperAdminRoute() {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: saLoading } = useSuperAdmin();

  if (authLoading || saLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <span className="text-sm text-slate-400">Verifying access…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-center">
          <ShieldAlert className="h-16 w-16 text-red-400" />
          <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          <p className="text-slate-400 max-w-md">
            This area is restricted to InsightForge platform administrators.
          </p>
          <a href="/dashboard" className="text-indigo-400 hover:text-indigo-300 underline text-sm">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
