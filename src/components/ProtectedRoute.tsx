import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user || checked) return;

    // Only redirect from /dashboard (initial landing)
    if (location.pathname !== "/dashboard") {
      setChecked(true);
      return;
    }

    supabase
      .from("profiles")
      .select("last_visited_path")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.last_visited_path && data.last_visited_path !== "/dashboard" && data.last_visited_path !== "/") {
          setRedirectPath(data.last_visited_path);
        }
        setChecked(true);
      });
  }, [user, checked, location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />;
}
