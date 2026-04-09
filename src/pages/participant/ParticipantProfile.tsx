import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Shield, Save, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const EDUCATION_OPTIONS = ["High School", "Some College", "Bachelor's Degree", "Master's Degree", "Doctorate", "Other"];
const EMPLOYMENT_OPTIONS = ["Full-time", "Part-time", "Self-employed", "Student", "Unemployed", "Retired"];
const INDUSTRY_OPTIONS = ["Technology", "Healthcare", "Finance", "Education", "Retail", "Manufacturing", "Media", "Government", "Non-profit", "Other"];
const INTEREST_OPTIONS = [
  "Technology", "Health & Fitness", "Travel", "Food & Cooking", "Fashion",
  "Gaming", "Music", "Sports", "Finance", "Environment", "Parenting",
  "Home Improvement", "Automotive", "Pets", "Entertainment",
];

export default function ParticipantProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["participant-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("participant-profile");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const profile = data?.profile as Record<string, unknown> | undefined;

  const [form, setForm] = useState<Record<string, unknown>>({});

  // Initialize form from profile when loaded
  const initForm = () => {
    if (!profile) return;
    setForm({
      display_name: profile.display_name || "",
      gender: profile.gender || "",
      country: profile.country || "",
      city: profile.city || "",
      education: profile.education || "",
      employment_status: profile.employment_status || "",
      industry: profile.industry || "",
      job_title: profile.job_title || "",
      bio: profile.bio || "",
      interests: (profile.interests as string[]) || [],
    });
  };

  // Lazy init
  if (profile && Object.keys(form).length === 0) initForm();

  const updateField = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleInterest = (interest: string) => {
    const current = (form.interests as string[]) || [];
    updateField(
      "interests",
      current.includes(interest) ? current.filter((i) => i !== interest) : [...current, interest]
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("participant-profile", {
        body: form,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participant-profile"] });
      toast({ title: "Profile Updated ✓" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <User className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            Keep your profile updated to get matched with the best studies.
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input value={(form.display_name as string) || ""} onChange={(e) => updateField("display_name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={(form.gender as string) || ""} onValueChange={(v) => updateField("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={(form.country as string) || ""} onChange={(e) => updateField("country", e.target.value)} placeholder="United States" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={(form.city as string) || ""} onChange={(e) => updateField("city", e.target.value)} placeholder="New York" />
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea
              value={(form.bio as string) || ""}
              onChange={(e) => updateField("bio", e.target.value)}
              placeholder="Tell researchers a bit about yourself..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Professional */}
      <Card>
        <CardHeader><CardTitle className="text-base">Professional Background</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Education</Label>
              <Select value={(form.education as string) || ""} onValueChange={(v) => updateField("education", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {EDUCATION_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Employment</Label>
              <Select value={(form.employment_status as string) || ""} onValueChange={(v) => updateField("employment_status", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Industry</Label>
              <Select value={(form.industry as string) || ""} onValueChange={(v) => updateField("industry", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Input value={(form.job_title as string) || ""} onChange={(e) => updateField("job_title", e.target.value)} placeholder="e.g. Product Manager" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interests */}
      <Card>
        <CardHeader><CardTitle className="text-base">Interests</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => (
              <button
                key={interest}
                type="button"
                onClick={() => toggleInterest(interest)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                  ((form.interests as string[]) || []).includes(interest)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                )}
              >
                {interest}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Privacy & Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Your data is protected under GDPR. You can request full erasure of your data at any time.
          </p>
          <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
            <Trash2 className="h-3 w-3 me-2" />
            Request Data Erasure
          </Button>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pb-20 md:pb-4">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="lg">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
          Save Profile
        </Button>
      </div>
    </div>
  );
}
