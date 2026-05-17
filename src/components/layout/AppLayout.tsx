import { Suspense, lazy } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { Outlet } from "react-router-dom";

const CommandPalette = lazy(async () => ({
  default: (await import("@/components/CommandPalette")).CommandPalette,
}));
const FirstSimulationWizard = lazy(async () => ({
  default: (await import("@/components/onboarding/FirstSimulationWizard")).FirstSimulationWizard,
}));

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 p-6 animate-fade-in">
            <Outlet />
          </main>
        </div>
      </div>
      <Suspense fallback={null}>
        <CommandPalette />
        <FirstSimulationWizard />
      </Suspense>
    </SidebarProvider>
  );
}
