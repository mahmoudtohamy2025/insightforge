import { useState } from "react";
import { useLocation } from "react-router-dom";
import { HelpCircle, PlayCircle, BookOpen } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ALL_TOURS } from "@/lib/tourDefinitions";
import { ProductTour } from "@/components/onboarding/ProductTour";

export function HelpDrawer() {
  const [open, setOpen] = useState(false);
  const [activeTour, setActiveTour] = useState<string | null>(null);
  const location = useLocation();

  // Determine current page tour based on route
  const getCurrentTourId = () => {
    const path = location.pathname;
    if (path === "/segments") return "twins";
    if (path === "/simulate") return "simulation";
    if (path === "/focus-group") return "focusGroup";
    if (path === "/ab-test") return "abTest";
    if (path === "/market-sim") return "marketSim";
    if (path === "/policy-sim") return "policySim";
    if (path === "/sessions") return "sessions";
    if (path === "/surveys") return "surveys";
    if (path === "/requirements") return "requirements";
    if (path === "/insights") return "insights";
    return null;
  };

  const currentTourId = getCurrentTourId();

  const handleStartTour = (id: string) => {
    localStorage.removeItem(`tour_completed_${id}`); // Reset so it can play again
    setActiveTour(id);
    setOpen(false); // Close drawer to show tour
  };

  const activeTourData = activeTour ? ALL_TOURS[activeTour as keyof typeof ALL_TOURS] : null;

  return (
    <>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Help & Tours"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="sm:max-w-md mx-auto">
          <div className="mx-auto w-full max-w-sm">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Help Center
              </DrawerTitle>
              <DrawerDescription>
                Replay interactive guides for any feature in InsightForge.
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-4 pb-0 space-y-4">
              {currentTourId && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                  <p className="text-sm font-semibold text-primary">Current Page Guide</p>
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => handleStartTour(currentTourId)}
                  >
                    <PlayCircle className="mr-2 h-4 w-4" />
                    How to use {ALL_TOURS[currentTourId as keyof typeof ALL_TOURS]?.label}
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  All Feature Tours
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto pb-6 pr-2">
                  {Object.entries(ALL_TOURS).map(([key, tour]) => (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      className="justify-start text-xs font-normal"
                      onClick={() => handleStartTour(key)}
                    >
                      <PlayCircle className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      {tour.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Render selected tour */}
      {activeTourData && (
        <ProductTour
          tourId={activeTourData.id}
          steps={activeTourData.steps}
          onComplete={() => setActiveTour(null)}
        />
      )}
    </>
  );
}
