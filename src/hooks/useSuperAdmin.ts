import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isPlatformSuperAdmin } from "@/lib/appDestination";

/**
 * Hook to check if the current user is a platform-level Super Admin.
 * Queries the `super_admins` table. Only super admins have a row there.
 */
export function useSuperAdmin() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    if (!user) {
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    isPlatformSuperAdmin(user.id)
      .then((value) => {
        if (!mounted) return;
        setIsSuperAdmin(value);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setIsSuperAdmin(false);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  return { isSuperAdmin, loading };
}
