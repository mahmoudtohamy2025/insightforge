import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  User,
  Brain,
  ShoppingCart,
  Globe,
  Eye,
  Sparkles,
} from "lucide-react";

const STEPS = [
  { id: "basics", label: "Basics", icon: User },
  { id: "demographics", label: "Demographics", icon: User },
  { id: "psychographics", label: "Psychographics", icon: Brain },
  { id: "behavioral", label: "Behavioral", icon: ShoppingCart },
  { id: "cultural", label: "Cultural", icon: Globe },
  { id: "review", label: "Review", icon: Eye },
];

const GENDER_OPTIONS = ["Male", "Female", "Mixed", "Non-binary"];
const INCOME_OPTIONS = ["Low income", "Lower-middle income", "Middle income", "Upper-middle income", "High income"];
const EDUCATION_OPTIONS = ["High school", "Some college", "Bachelor's degree", "Master's degree", "Doctorate", "Trade/vocational"];

const CustomTwinBuilder = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;
  const [currentStep, setCurrentStep] = useState(0);

  // Form data
  const [form, setForm] = useState({
    name: "", description: "",
    // Demographics
    age_range: "", gender: "Mixed", location: "", resident_status: "National", income_level: "Middle income",
    education: "Bachelor's degree", occupation: "",
    // Psychographics
    values: "", lifestyle: "", attitudes: "", interests: "",
    personality_traits: "",
    // Behavioral
    purchase_behavior: "", media_consumption: "", brand_preferences: "",
    decision_factors: "", shopping_channels: "", loyalty_level: [5] as number[],
    // Cultural
    region: "", language: "English", norms: "", traditions: "", religion: "",
  });

  const u = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("segment_profiles").insert({
        workspace_id: workspaceId!,
        name: form.name,
        description: form.description,
        demographics: {
          age_range: form.age_range, gender: form.gender, location: form.location, resident_status: form.resident_status,
          income_level: form.income_level, education: form.education, occupation: form.occupation,
        },
        psychographics: {
          values: form.values, lifestyle: form.lifestyle, attitudes: form.attitudes,
          interests: form.interests, personality_traits: form.personality_traits,
        },
        behavioral_data: {
          purchase_behavior: form.purchase_behavior, media_consumption: form.media_consumption,
          brand_preferences: form.brand_preferences, decision_factors: form.decision_factors,
          shopping_channels: form.shopping_channels, loyalty_level: form.loyalty_level[0],
        },
        cultural_context: {
          region: form.region, language: form.language, norms: form.norms,
          traditions: form.traditions, religion: form.religion,
        },
        created_by: user?.id,
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segment-profiles"] });
      toast({ title: "Digital twin created!", description: `"${form.name}" is ready for simulation.` });
      navigate("/segments");
    },
    onError: (e) => toast({ title: "Failed to create twin", description: e.message, variant: "destructive" }),
  });

  const canProceed = () => {
    switch (currentStep) {
      case 0: return form.name.trim().length > 0;
      case 5: return true; // review
      default: return true;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Basics
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Twin Name *</Label>
              <Input placeholder="e.g. Egyptian Gen-Z Professional Female" value={form.name} onChange={e => u("name", e.target.value)} />
              <p className="text-[10px] text-muted-foreground">A descriptive name for this consumer persona</p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={3} placeholder="Brief summary of who this person represents..." value={form.description} onChange={e => u("description", e.target.value)} />
            </div>
          </div>
        );

      case 1: // Demographics
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Age Range</Label>
                <Input placeholder="25-35" value={form.age_range} onChange={e => u("age_range", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Gender</Label>
                <Select value={form.gender} onValueChange={v => u("gender", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Location</Label>
                <Input placeholder="Cairo, Egypt" value={form.location} onChange={e => u("location", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs border-purple-500/50 text-purple-600 font-semibold border rounded-sm px-1 inline-block bg-purple-50">Resident Status (MENA)</Label>
                <Select value={form.resident_status} onValueChange={v => u("resident_status", v)}>
                  <SelectTrigger className="border-purple-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="National">Local National</SelectItem>
                    <SelectItem value="Expat">Expat Professional</SelectItem>
                    <SelectItem value="Migrant">Migrant Worker</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Income Level</Label>
                <Select value={form.income_level} onValueChange={v => u("income_level", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INCOME_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Education</Label>
                <Select value={form.education} onValueChange={v => u("education", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EDUCATION_OPTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Occupation</Label>
                <Input placeholder="Software engineer" value={form.occupation} onChange={e => u("occupation", e.target.value)} />
              </div>
            </div>
          </div>
        );

      case 2: // Psychographics
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Values & Beliefs</Label>
              <Input placeholder="Health-conscious, environmentally aware, family-oriented" value={form.values} onChange={e => u("values", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Lifestyle</Label>
              <Input placeholder="Active, urban, social, tech-savvy" value={form.lifestyle} onChange={e => u("lifestyle", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Attitudes</Label>
              <Input placeholder="Open to new experiences, price-sensitive, brand-loyal" value={form.attitudes} onChange={e => u("attitudes", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Interests</Label>
              <Input placeholder="Fitness, organic food, social media, travel" value={form.interests} onChange={e => u("interests", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Personality Traits</Label>
              <Input placeholder="Introverted, analytical, empathetic" value={form.personality_traits} onChange={e => u("personality_traits", e.target.value)} />
            </div>
          </div>
        );

      case 3: // Behavioral
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Purchase Behavior</Label>
              <Textarea rows={2} placeholder="Researches extensively before buying, prefers online shopping, buys in bulk..." value={form.purchase_behavior} onChange={e => u("purchase_behavior", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Media Consumption</Label>
              <Input placeholder="Instagram, YouTube, TikTok, news apps" value={form.media_consumption} onChange={e => u("media_consumption", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Brand Preferences</Label>
              <Input placeholder="Apple, Nike, Whole Foods, Tesla" value={form.brand_preferences} onChange={e => u("brand_preferences", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Decision Factors</Label>
              <Input placeholder="Price, quality, brand reputation, peer reviews" value={form.decision_factors} onChange={e => u("decision_factors", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Shopping Channels</Label>
              <Input placeholder="Online stores, malls, local markets" value={form.shopping_channels} onChange={e => u("shopping_channels", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Brand Loyalty (1-10)</Label>
              <div className="flex items-center gap-3">
                <Slider min={1} max={10} step={1} value={form.loyalty_level} onValueChange={v => u("loyalty_level", v)} className="flex-1" />
                <span className="text-sm font-mono w-6 text-right">{form.loyalty_level[0]}</span>
              </div>
            </div>
          </div>
        );

      case 4: // Cultural
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Region</Label>
                <Input placeholder="MENA, North Africa" value={form.region} onChange={e => u("region", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Language(s)</Label>
                <Input placeholder="Arabic, English, French" value={form.language} onChange={e => u("language", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Cultural Norms</Label>
              <Textarea rows={2} placeholder="Conservative dress, halal food requirements, strong family ties..." value={form.norms} onChange={e => u("norms", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Traditions & Customs</Label>
              <Input placeholder="Ramadan fasting, Friday prayers, family gatherings" value={form.traditions} onChange={e => u("traditions", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Religion/Worldview</Label>
              <Input placeholder="Muslim, Christian, Secular, etc." value={form.religion} onChange={e => u("religion", e.target.value)} />
            </div>
          </div>
        );

      case 5: // Review
        return (
          <div className="space-y-4">
            {/* Persona Card */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                    {form.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{form.name || "Untitled Twin"}</h3>
                    {form.description && <p className="text-xs text-muted-foreground">{form.description}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs pt-2 border-t">
                  {form.age_range && <div><span className="text-muted-foreground">Age:</span> {form.age_range}</div>}
                  {form.gender && <div><span className="text-muted-foreground">Gender:</span> {form.gender}</div>}
                  {form.location && <div><span className="text-muted-foreground">Location:</span> {form.location}</div>}
                  {form.resident_status && <div><span className="text-purple-500 font-semibold text-[10px] bg-purple-50 px-1 rounded">Status:</span> {form.resident_status}</div>}
                  {form.income_level && <div><span className="text-muted-foreground">Income:</span> {form.income_level}</div>}
                  {form.education && <div><span className="text-muted-foreground">Education:</span> {form.education}</div>}
                  {form.occupation && <div><span className="text-muted-foreground">Occupation:</span> {form.occupation}</div>}
                </div>

                {(form.values || form.lifestyle || form.interests) && (
                  <div className="pt-2 border-t space-y-1 text-xs">
                    {form.values && <div><span className="text-muted-foreground">Values:</span> {form.values}</div>}
                    {form.lifestyle && <div><span className="text-muted-foreground">Lifestyle:</span> {form.lifestyle}</div>}
                    {form.interests && <div><span className="text-muted-foreground">Interests:</span> {form.interests}</div>}
                  </div>
                )}

                {(form.region || form.language) && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                    {form.region && <Badge variant="secondary" className="text-[10px]">{form.region}</Badge>}
                    {form.language && <Badge variant="secondary" className="text-[10px]">{form.language}</Badge>}
                    {form.religion && <Badge variant="secondary" className="text-[10px]">{form.religion}</Badge>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/segments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Custom Twin Builder
          </h1>
          <p className="text-sm text-muted-foreground">Build a detailed consumer persona step by step.</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, i) => {
          const StepIcon = step.icon;
          const isActive = i === currentStep;
          const isCompleted = i < currentStep;
          return (
            <button key={step.id} onClick={() => i <= currentStep && setCurrentStep(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                isActive ? "bg-primary/10 text-primary font-medium border border-primary/30" :
                isCompleted ? "text-primary/60 cursor-pointer" :
                "text-muted-foreground cursor-default"
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isCompleted ? "bg-primary text-primary-foreground" :
                isActive ? "bg-primary/20 text-primary" :
                "bg-muted text-muted-foreground"
              }`}>
                {isCompleted ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {(() => { const I = STEPS[currentStep].icon; return <I className="h-4 w-4 text-primary" />; })()}
            {STEPS[currentStep].label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderStep()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={currentStep === 0} onClick={() => setCurrentStep(s => s - 1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button onClick={() => setCurrentStep(s => s + 1)} disabled={!canProceed()}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
            {saveMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating twin...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" />Create Digital Twin</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default CustomTwinBuilder;
