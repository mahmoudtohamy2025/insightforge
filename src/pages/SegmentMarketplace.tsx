import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Search, Download, Star, Filter, Package, Globe2, Loader2, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MarketplaceSegment = {
  id: string;
  creator_workspace_id: string;
  creator_name: string;
  name: string;
  description: string;
  avatar_url: string | null;
  industry: string | null;
  price_credits: number;
  downloads: number;
  calibration_score: number | null;
  created_at: string;
  location: string | null;
  age_range: string | null;
};

export default function SegmentMarketplace() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const { data: segments, isLoading } = useQuery({
    queryKey: ["marketplace_segments", activeTab, searchQuery],
    queryFn: async () => {
      let query = supabase.from("marketplace_segments").select("*");
      
      if (activeTab === "industry") {
        query = query.not("industry", "is", null);
      } else if (activeTab === "community") {
        query = query.is("industry", null);
      }

      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      const { data, error } = await query.order("downloads", { ascending: false });
      
      if (error) throw error;
      return data as MarketplaceSegment[];
    },
  });

  const importMutation = useMutation({
    mutationFn: async (segmentId: string) => {
      if (!currentWorkspace?.id) throw new Error("No active workspace");
      
      // We call the edge function "marketplace-handler"
      const { data, error } = await supabase.functions.invoke('marketplace-handler', {
        body: {
          action: "import",
          segment_id: segmentId,
          target_workspace_id: currentWorkspace.id
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_segments"] });
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast({
        title: "Segment Imported!",
        description: "The digital twin has been successfully added to your workspace.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Segment Marketplace</h1>
          <p className="text-muted-foreground mt-1">
            Discover verified industry packs and community-contributed digital twins to accelerate your research.
          </p>
        </div>
      </div>

      <div className="bg-primary/5 rounded-xl border p-6 flex flex-col md:flex-row gap-6 items-center shadow-sm">
        <div className="flex-1 space-y-4">
          <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-none">Industry Packs</Badge>
          <h2 className="text-2xl font-bold">Instantly Calibrated vertical models.</h2>
          <p className="text-muted-foreground text-sm max-w-xl">
            Jumpstart your simulations with pre-calibrated segment packs for Healthcare, Fintech, FMCG, and E-commerce. Validated against millions of real-world data points.
          </p>
        </div>
        <div className="hidden md:flex gap-4 p-4 bg-background rounded-lg border shadow-sm items-center">
            <div className="text-center px-4 border-r">
               <div className="text-2xl font-bold text-primary">85%</div>
               <div className="text-xs text-muted-foreground font-medium uppercase mt-1">Avg Accuracy</div>
            </div>
            <div className="text-center px-4">
               <div className="text-2xl font-bold text-primary">10k+</div>
               <div className="text-xs text-muted-foreground font-medium uppercase mt-1">Data Points</div>
            </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card border rounded-lg p-2 shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-3 sm:w-[400px]">
            <TabsTrigger value="all">All Items</TabsTrigger>
            <TabsTrigger value="industry" className="gap-2"><Package className="h-3 w-3" /> Packs</TabsTrigger>
            <TabsTrigger value="community" className="gap-2"><Globe2 className="h-3 w-3" /> Community</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search segments..."
            className="pl-9 bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="flex flex-col h-[320px]">
              <CardHeader className="pb-2">
                <Skeleton className="h-10 w-10 rounded-full mb-2" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="flex-1">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : segments?.length === 0 ? (
          <div className="col-span-full border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No segments found.</p>
            <p className="text-sm">Try adjusting your search filters.</p>
          </div>
        ) : (
          segments?.map((segment) => (
            <Card key={segment.id} className="flex flex-col group hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-2 relative pt-8">
                {segment.industry && (
                  <Badge className="absolute top-4 right-4 text-[10px] uppercase font-bold tracking-wider" variant="secondary">
                    {segment.industry}
                  </Badge>
                )}
                
                <div className="flex items-center gap-3">
                  {segment.avatar_url ? (
                    <img
                      src={segment.avatar_url}
                      alt={segment.name}
                      className="w-12 h-12 rounded-full object-cover border-2 shadow-sm"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border-2">
                      {segment.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">{segment.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">by {segment.creator_name}</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 py-4 space-y-4 text-sm">
                <p className="text-muted-foreground line-clamp-2 min-h-[40px]">
                  {segment.description || "No description provided."}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted px-2 py-1.5 rounded text-muted-foreground flex items-center gap-1.5">
                    <Star className="h-3 w-3" />
                    <span className="truncate">{segment.calibration_score ? `${(segment.calibration_score * 100).toFixed(0)}% Accuracy` : "Uncalibrated"}</span>
                  </div>
                  <div className="bg-muted px-2 py-1.5 rounded text-muted-foreground flex items-center gap-1.5">
                    <Download className="h-3 w-3" />
                    <span className="truncate">{segment.downloads} Uses</span>
                  </div>
                  {segment.location && (
                    <div className="bg-muted px-2 py-1.5 rounded text-muted-foreground col-span-2 truncate">
                       📍 {segment.location}
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="pt-0 border-t mt-auto px-6 py-4 flex gap-3">
                 <div className="text-sm font-semibold mr-auto flex items-center">
                    {segment.price_credits > 0 ? (
                        <span className="text-primary">{segment.price_credits} Credits</span>
                    ) : (
                        <span className="text-emerald-600">Free</span>
                    )}
                 </div>
                <Button 
                   size="sm" 
                   onClick={() => importMutation.mutate(segment.id)}
                   disabled={importMutation.isPending || segment.creator_workspace_id === currentWorkspace?.id}
                   className="shadow-sm"
                >
                  {importMutation.isPending && importMutation.variables === segment.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Import
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
