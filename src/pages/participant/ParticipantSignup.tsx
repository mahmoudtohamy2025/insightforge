import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STEPS = ["Account", "Demographics", "Professional", "Interests"];

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const EDUCATION_OPTIONS = ["High School", "Some College", "Bachelor's Degree", "Master's Degree", "Doctorate", "Other"];
const EMPLOYMENT_OPTIONS = ["Full-time", "Part-time", "Self-employed", "Student", "Unemployed", "Retired"];
const INCOME_OPTIONS = ["Under $25k", "$25k–$50k", "$50k–$75k", "$75k–$100k", "$100k–$150k", "$150k+", "Prefer not to say"];
const INDUSTRY_OPTIONS = ["Technology", "Healthcare", "Finance", "Education", "Retail", "Manufacturing", "Media", "Government", "Non-profit", "Other"];

const INTEREST_OPTIONS = [
  "Technology", "Health & Fitness", "Travel", "Food & Cooking", "Fashion",
  "Gaming", "Music", "Sports", "Finance", "Environment", "Parenting",
  "Home Improvement", "Automotive", "Pets", "Entertainment",
];

export default function ParticipantSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get("ref");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Step 2: Demographics
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  // Step 3: Professional
  const [education, setEducation] = useState("");
  const [employment, setEmployment] = useState("");
  const [industry, setIndustry] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [income, setIncome] = useState("");

  // Step 4: Interests
  const [interests, setInterests] = useState<string[]>([]);

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const canProceed = () => {
    if (step === 0) return email && password.length >= 8 && displayName;
    return true; // Steps 2-4 are optional
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Call the signup edge function
      const { data, error } = await supabase.functions.invoke("participant-signup", {
        body: { email, password, display_name: displayName, date_of_birth: dateOfBirth || null, gender: gender || null, country: country || null, city: city || null },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Now sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      // Update profile with remaining fields
      const profileUpdates: Record<string, unknown> = {};
      if (education) profileUpdates.education = education;
      if (employment) profileUpdates.employment_status = employment;
      if (industry) profileUpdates.industry = industry;
      if (jobTitle) profileUpdates.job_title = jobTitle;
      if (income) profileUpdates.income_bracket = income;
      if (interests.length > 0) profileUpdates.interests = interests;

      if (Object.keys(profileUpdates).length > 0) {
        await supabase.functions.invoke("participant-profile", {
          body: profileUpdates,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Claim referral if ?ref=CODE was in URL
      if (referralCode) {
        try {
          await supabase.functions.invoke("participant-referral", {
            body: { referral_code: referralCode.toUpperCase() },
          });
        } catch {
          // silent — non-blocking
        }
      }

      toast({ title: "Welcome! 🎉", description: "Your account has been created successfully." });
      navigate("/participate/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Signup failed";
      toast({ title: "Signup Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Join InsightForge</h1>
          <p className="text-muted-foreground text-sm">
            Earn money by participating in research studies and shaping products.
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                    ? "bg-primary/20 text-primary ring-2 ring-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-0.5 w-6 rounded", i < step ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          ))}
        </div>

        <Card className="shadow-xl border-primary/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{STEPS[step]}</CardTitle>
            <CardDescription>
              {step === 0 && "Create your free participant account."}
              {step === 1 && "Help us match you with relevant studies (optional)."}
              {step === 2 && "Tell us about your professional background (optional)."}
              {step === 3 && "Select your interests to get better study recommendations."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Account */}
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="displayName">Full Name</Label>
                  <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signupEmail">Email</Label>
                  <Input id="signupEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signupPw">Password</Label>
                  <Input id="signupPw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} />
                  {password && password.length < 8 && (
                    <p className="text-xs text-destructive">Password must be at least 8 characters</p>
                  )}
                </div>
              </>
            )}

            {/* Step 2: Demographics */}
            {step === 1 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="United States" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" />
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Professional */}
            {step === 2 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Education</Label>
                    <Select value={education} onValueChange={setEducation}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {EDUCATION_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Employment</Label>
                    <Select value={employment} onValueChange={setEmployment}>
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
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {INDUSTRY_OPTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Job Title</Label>
                    <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Product Manager" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Income Bracket</Label>
                  <Select value={income} onValueChange={setIncome}>
                    <SelectTrigger><SelectValue placeholder="Select (optional)" /></SelectTrigger>
                    <SelectContent>
                      {INCOME_OPTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Step 4: Interests */}
            {step === 3 && (
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                      interests.includes(interest)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                    )}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between pt-2">
              {step > 0 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  <ChevronLeft className="h-4 w-4 me-1" /> Back
                </Button>
              ) : (
                <div />
              )}

              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                  Next <ChevronRight className="h-4 w-4 ms-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading || !canProceed()}>
                  {loading && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  Create Account
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/participate/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
