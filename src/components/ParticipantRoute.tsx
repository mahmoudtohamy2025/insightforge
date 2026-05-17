import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

/**
 * Route guard for participant-only routes.
 * - If loading: show spinner
 * - If unauthenticated: redirect to /participate/login
 * - If user is enterprise (no participant role): redirect to /dashboard
 * - Otherwise: render child routes
 */
export function ParticipantRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/participate/login?redirect=${redirect}`} replace />;
  }

  const role = user.user_metadata?.role;
  if (role !== "participant") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
