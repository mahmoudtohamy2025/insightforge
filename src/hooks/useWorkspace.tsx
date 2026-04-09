import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  tier: string;
  status: string;
  role: string; // user's role in this workspace
  created_at: string;
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  isLoading: boolean;
  switchWorkspace: (workspaceId: string) => void;
  refetchWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

const STORAGE_KEY = "insightforge-workspace-id";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("workspace_memberships")
      .select("role, workspace_id, workspaces(id, name, slug, tier, status, created_at)")
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to fetch workspaces:", error);
      setIsLoading(false);
      return;
    }

    const mapped: Workspace[] = (data || [])
      .filter((m: any) => m.workspaces)
      .map((m: any) => ({
        id: m.workspaces.id,
        name: m.workspaces.name,
        slug: m.workspaces.slug,
        tier: m.workspaces.tier,
        status: m.workspaces.status,
        role: m.role,
        created_at: m.workspaces.created_at,
      }));

    setWorkspaces(mapped);

    // Restore saved workspace or default to first
    const savedId = localStorage.getItem(STORAGE_KEY);
    const saved = mapped.find((w) => w.id === savedId);
    setCurrentWorkspace(saved || mapped[0] || null);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      const ws = workspaces.find((w) => w.id === workspaceId);
      if (ws) {
        setCurrentWorkspace(ws);
        localStorage.setItem(STORAGE_KEY, workspaceId);
      }
    },
    [workspaces]
  );

  return (
    <WorkspaceContext.Provider
      value={{ currentWorkspace, workspaces, isLoading, switchWorkspace, refetchWorkspaces: fetchWorkspaces }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return context;
}
