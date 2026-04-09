import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { CalibrationPanel } from "@/components/twins/CalibrationPanel";
import {
  Plus,
  Users2,
  Loader2,
  Sparkles,
  MessageSquare,
  Zap,
  Trash2,
  TrendingUp,
  Scale,
  Wand2,
} from "lucide-react";

const calibrationColor = (score: number | null) => {
  if (!score || score < 0.3) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (score < 0.6) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
};

const calibrationLabel = (score: number | null) => {
  if (!score || score < 0.3) return "New";
  if (score < 0.6) return "Calibrating";
  return "Calibrated";
};

const GENDER_OPTIONS = ["Male", "Female", "Mixed"];
const INCOME_OPTIONS = ["Low income", "Lower middle", "Middle income", "Upper middle", "High income"];
const EDUCATION_OPTIONS = ["High school", "Some college", "College educated", "Postgraduate", "Mixed"];

const SegmentLibrary = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { t } = useI18n();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    age_range: "25-35",
    gender: "Mixed",
    location: "",
    income_level: "Middle income",
    education: "College educated",
    occupation: "",
    values: "",
    lifestyle: "",
    interests: "",
    region: "",
    language: "English",
  });

  const { data: segments = [], isLoading } = useQuery({
    queryKey: ["segment-profiles", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("segment_profiles")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("segment_profiles").insert({
        workspace_id: workspaceId!,
        name: form.name,
        description: form.description || null,
        demographics: {
          age_range: form.age_range,
          gender: form.gender,
          location: form.location,
          income_level: form.income_level,
          education: form.education,
          occupation: form.occupation,
        },
        psychographics: {
          values: form.values,
          lifestyle: form.lifestyle,
          interests: form.interests,
        },
        cultural_context: {
          region: form.region,
          language: form.language,
        },
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segment-profiles", workspaceId] });
      setCreateOpen(false);
      resetForm();
      toast({ title: "Segment created", description: "Your consumer segment is ready for simulations." });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("segment_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segment-profiles", workspaceId] });
      toast({ title: "Segment deleted" });
    },
  });

  const resetForm = () => setForm({
    name: "", description: "", age_range: "25-35", gender: "Mixed", location: "",
    income_level: "Middle income", education: "College educated", occupation: "",
    values: "", lifestyle: "", interests: "", region: "", language: "English",
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users2 className="h-6 w-6 text-primary" />
            Digital Twins
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create consumer segments and simulate their reactions to your products, campaigns, and policies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {segments.length >= 2 && (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate("/focus-group")}>
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                Focus Group
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/ab-test")}>
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                A/B Test
              </Button>
            </>
          )}
          {segments.length >= 1 && (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate("/market-sim")}>
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                Market Sim
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/policy-sim")}>
                <Scale className="h-3.5 w-3.5 mr-1.5" />
                Policy Impact
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate("/twin-builder")}>
            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            Twin Builder
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Segment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Consumer Segment</DialogTitle>
                <DialogDescription>
                  Define a consumer segment to create digital twins you can query and simulate.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Basic Info */}
                <div className="space-y-2">
                  <Label htmlFor="seg-name">Segment Name *</Label>
                  <Input id="seg-name" placeholder="e.g. Egyptian Gen-Z Health-Conscious Female" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seg-desc">Description</Label>
                  <Textarea id="seg-desc" rows={2} placeholder="Brief description of this segment..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>

                {/* Demographics */}
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Demographics</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Age Range</Label>
                      <Input placeholder="25-35" value={form.age_range} onChange={e => setForm(f => ({ ...f, age_range: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Gender</Label>
                      <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {GENDER_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Location</Label>
                      <Input placeholder="Cairo, Egypt" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Income Level</Label>
                      <Select value={form.income_level} onValueChange={v => setForm(f => ({ ...f, income_level: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {INCOME_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Education</Label>
                      <Select value={form.education} onValueChange={v => setForm(f => ({ ...f, education: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EDUCATION_OPTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Occupation</Label>
                      <Input placeholder="Software engineer" value={form.occupation} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Psychographics */}
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Psychographics</p>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Values & Beliefs</Label>
                      <Input placeholder="Health-conscious, environmentally aware" value={form.values} onChange={e => setForm(f => ({ ...f, values: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Lifestyle</Label>
                      <Input placeholder="Active, urban, tech-savvy" value={form.lifestyle} onChange={e => setForm(f => ({ ...f, lifestyle: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Interests</Label>
                      <Input placeholder="Fitness, organic food, social media" value={form.interests} onChange={e => setForm(f => ({ ...f, interests: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Cultural Context */}
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Cultural Context</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Region</Label>
                      <Input placeholder="MENA, North Africa" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Language</Label>
                      <Input placeholder="Arabic, English" value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={() => createMutation.mutate()} disabled={!form.name.trim() || createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Create Segment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Segment Cards */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : segments.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="No consumer segments yet"
          description="Create your first digital twin segment to start simulating consumer reactions to your products and campaigns."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map((seg: any) => {
            const demo = (seg.demographics || {}) as Record<string, any>;
            const psycho = (seg.psychographics || {}) as Record<string, any>;
            const culture = (seg.cultural_context || {}) as Record<string, any>;

            return (
              <Card key={seg.id} className="group hover:border-primary/50 transition-colors">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {seg.name?.charAt(0)?.toUpperCase() || "S"}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm leading-tight">{seg.name}</h3>
                        {seg.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{seg.description}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${calibrationColor(seg.calibration_score)}`}>
                      {calibrationLabel(seg.calibration_score)}
                    </Badge>
                  </div>

                  {/* Key Demographics */}
                  <div className="flex flex-wrap gap-1.5">
                    {demo.age_range && <Badge variant="secondary" className="text-[10px]">{demo.age_range}</Badge>}
                    {demo.gender && <Badge variant="secondary" className="text-[10px]">{demo.gender}</Badge>}
                    {demo.location && <Badge variant="secondary" className="text-[10px]">{demo.location}</Badge>}
                    {demo.income_level && <Badge variant="secondary" className="text-[10px]">{demo.income_level}</Badge>}
                    {culture.region && <Badge variant="secondary" className="text-[10px]">{culture.region}</Badge>}
                  </div>

                  {/* Psychographic snippet */}
                  {psycho.values && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      <span className="font-medium">Values:</span> {psycho.values}
                    </p>
                  )}

                  {/* Calibration */}
                  <CalibrationPanel
                    segmentId={seg.id}
                    workspaceId={workspaceId!}
                    calibrationScore={seg.calibration_score}
                  />

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t">
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 h-8 text-xs"
                      onClick={() => navigate(`/simulate?segment=${seg.id}`)}
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Ask a Question
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        if (confirm("Delete this segment? All associated simulations will also be deleted.")) {
                          deleteMutation.mutate(seg.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SegmentLibrary;
