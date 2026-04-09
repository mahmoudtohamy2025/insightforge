import { useWorkspace } from "@/hooks/useWorkspace";

export function useWorkspaceRole() {
  const { currentWorkspace } = useWorkspace();
  const role = currentWorkspace?.role || "observer";

  return {
    role,
    isOwner: role === "owner",
    isAdmin: role === "admin",
    isAdminOrOwner: role === "owner" || role === "admin",
    isResearcher: role === "researcher",
    isObserver: role === "observer",
    canCreate: role !== "observer", // observers cannot create/modify
  };
}
