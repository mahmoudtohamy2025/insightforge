import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { identifyUser, resetAnalytics, trackPageView } from "@/lib/analytics";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const pathUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Analytics: identify on login, reset on logout
        if (session?.user) {
          identifyUser(session.user.id, {
            email: session.user.email,
            created_at: session.user.created_at,
          });
        } else if (_event === "SIGNED_OUT") {
          resetAnalytics();
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Track last visited path (debounced)
  useEffect(() => {
    if (!user) return;

    const handlePathChange = () => {
      const path = window.location.pathname;
      // Only track app routes, not auth
      if (path.startsWith("/login") || path.startsWith("/signup") || path.startsWith("/forgot") || path.startsWith("/reset") || path.startsWith("/auth") || path.startsWith("/s/")) return;

      if (pathUpdateTimer.current) clearTimeout(pathUpdateTimer.current);
      pathUpdateTimer.current = setTimeout(() => {
        // Track page view in PostHog
        trackPageView(path);

        supabase
          .from("profiles")
          .update({ last_visited_path: path })
          .eq("id", user.id)
          .then(() => {});
      }, 2000);
    };

    // Listen to popstate and run on mount
    handlePathChange();
    window.addEventListener("popstate", handlePathChange);

    // Use a MutationObserver on the URL (for pushState)
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    history.pushState = function (...args) {
      originalPush.apply(this, args);
      handlePathChange();
    };
    history.replaceState = function (...args) {
      originalReplace.apply(this, args);
      handlePathChange();
    };

    return () => {
      window.removeEventListener("popstate", handlePathChange);
      history.pushState = originalPush;
      history.replaceState = originalReplace;
      if (pathUpdateTimer.current) clearTimeout(pathUpdateTimer.current);
    };
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
