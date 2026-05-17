import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { User, Shield, Save, Loader2, Trash2, Wallet, Bell, CreditCard, CheckCircle2, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const EDUCATION_OPTIONS = ["High School", "Some College", "Bachelor's Degree", "Master's Degree", "Doctorate", "Other"];
const EMPLOYMENT_OPTIONS = ["Full-time", "Part-time", "Self-employed", "Student", "Unemployed", "Retired"];
const INDUSTRY_OPTIONS = ["Technology", "Healthcare", "Finance", "Education", "Retail", "Manufacturing", "Media", "Government", "Non-profit", "Other"];
const COUNTRIES = [
  "United States","United Kingdom","Canada","Australia","Germany","France",
  "India","Brazil","Mexico","Netherlands","Spain","Italy","Japan",
  "South Korea","Singapore","United Arab Emirates","Saudi Arabia","Egypt",
  "Nigeria","South Africa","Other",
];
const INTEREST_OPTIONS = [
  "Technology","Health & Fitness","Travel","Food & Cooking","Fashion",
  "Gaming","Music","Sports","Finance","Environment","Parenting",
  "Home Improvement","Automotive","Pets","Entertainment",
];

export default function ParticipantProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [paypalEmail, setPaypalEmail] = useState("");
  const [paypalSaved, setPaypalSaved] = useState(false);

  // Notification prefs
  const [notifNewStudy, setNotifNewStudy] = useState(true);
  const [notifPayment, setNotifPayment] = useState(true);
  const [notifDigest, setNotifDigest] = useState("daily");

  const { data, isLoading, isError, error } = useQuery({
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
    setPaypalEmail((profile.paypal_email as string) || "");
  };

  if (profile && Object.keys(form).length === 0) initForm();

  const updateField = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleInterest = (interest: string) => {
    const current = (form.interests as string[]) || [];
    updateField(
      "interests",
      current.includes(interest) ? current.filter(i => i !== interest) : [...current, interest]
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

  const savePayPal = async () => {
    if (!paypalEmail.includes("@")) {
      toast({ title: "Invalid email", description: "Please enter a valid PayPal email.", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("participant-profile", {
        body: { paypal_email: paypalEmail },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPaypalSaved(true);
      queryClient.invalidateQueries({ queryKey: ["participant-profile"] });
      toast({ title: "PayPal email saved ✓", description: "Future cashouts will be sent here." });
    } catch (err) {
      toast({ title: "Failed to save PayPal email", description: (err as Error).message, variant: "destructive" });
    }
  };

  const exportMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("participant-privacy", {
        body: { action: "export" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (privacyData) => {
      const blob = new Blob([JSON.stringify(privacyData.export, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `participant-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Data export ready", description: "Your participant data export has been generated." });
    },
    onError: (err) => {
      toast({ title: "Export failed", description: (err as Error).message, variant: "destructive" });
    },
  });

  const erasureMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("participant-privacy", {
        body: { action: "request_erasure" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participant-profile"] });
      toast({
        title: "Erasure request completed",
        description: "Your profile and research history were anonymized. Required payout records were retained.",
      });
    },
    onError: (err) => {
      toast({ title: "Error requesting erasure", description: (err as Error).message, variant: "destructive" });
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

  if (isError) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <User className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">My Profile</h1>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            We could not load your profile. {(error as Error)?.message || "Please refresh and try again."}
          </AlertDescription>
        </Alert>
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
            <Input value={(form.display_name as string) || ""} onChange={e => updateField("display_name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={(form.gender as string) || ""} onValueChange={v => updateField("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={(form.country as string) || ""} onValueChange={v => updateField("country", v)}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={(form.city as string) || ""} onChange={e => updateField("city", e.target.value)} placeholder="New York" />
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea
              value={(form.bio as string) || ""}
              onChange={e => updateField("bio", e.target.value)}
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
              <Select value={(form.education as string) || ""} onValueChange={v => updateField("education", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {EDUCATION_OPTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Employment</Label>
              <Select value={(form.employment_status as string) || ""} onValueChange={v => updateField("employment_status", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_OPTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Industry</Label>
              <Select value={(form.industry as string) || ""} onValueChange={v => updateField("industry", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Input value={(form.job_title as string) || ""} onChange={e => updateField("job_title", e.target.value)} placeholder="e.g. Product Manager" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interests */}
      <Card>
        <CardHeader><CardTitle className="text-base">Interests</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map(interest => (
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

      {/* Payment Method */}
      <Card className="border-emerald-200/50 dark:border-emerald-800/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter your PayPal email to receive cashouts. We support PayPal for instant transfers.
          </p>
          <div className="space-y-2">
            <Label htmlFor="paypal-email">PayPal Email</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="paypal-email"
                  type="email"
                  placeholder="your@paypal.com"
                  value={paypalEmail}
                  onChange={e => { setPaypalEmail(e.target.value); setPaypalSaved(false); }}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                onClick={savePayPal}
                className={cn(paypalSaved && "border-emerald-500 text-emerald-600")}
              >
                {paypalSaved ? (
                  <><CheckCircle2 className="h-4 w-4 me-1.5 text-emerald-500" /> Saved</>
                ) : "Save"}
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Shield className="h-3 w-3" />
            Your payment info is encrypted and never shared with researchers.
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">New Study Alerts</p>
              <p className="text-xs text-muted-foreground">Get notified when studies matching your profile are posted</p>
            </div>
            <Switch checked={notifNewStudy} onCheckedChange={setNotifNewStudy} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Payment Notifications</p>
              <p className="text-xs text-muted-foreground">Get notified when earnings are approved or paid out</p>
            </div>
            <Switch checked={notifPayment} onCheckedChange={setNotifPayment} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Email Digest</p>
              <p className="text-xs text-muted-foreground">Summary of available studies</p>
            </div>
            <Select value={notifDigest} onValueChange={setNotifDigest}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="none">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Data */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Privacy & Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Export your participant record, or delete your account by anonymizing profile and research history.
            Financial payout records are retained where legally required.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
          >
            {exportMutation.isPending ? <Loader2 className="h-3 w-3 me-2 animate-spin" /> : <Download className="h-3 w-3 me-2" />}
            Export My Data
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                disabled={erasureMutation.isPending}
              >
                <Trash2 className="h-3 w-3 me-2" />
                Request Data Erasure
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete account anonymizes your profile, referrals, notifications, and submitted research history.
                  Required payout ledger, payout requests, and privacy audit records are retained.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => erasureMutation.mutate()}
                >
                  {erasureMutation.isPending ? "Processing..." : "Delete account and anonymize"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
