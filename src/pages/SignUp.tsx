import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LanguageSelector } from "@/components/LanguageSelector";
import { trackEvent } from "@/lib/analytics";

/**
 * P1.1 — Google OAuth as primary signup path.
 *
 * Before this change: signup required 4 fields (full name + email + password +
 * workspace name) PLUS an email-verification step before the user could run their
 * first simulation. That's 5+ interactions for a "find out in an afternoon" pitch
 * — the audit flagged this as a bait-mismatch.
 *
 * After: Google OAuth ("Continue with Google") sits ABOVE the email form. Two clicks
 * (Google + Allow) → user lands directly on /dashboard. Email/password stays as
 * fallback for anyone who doesn't have or doesn't want to use Google.
 *
 * The OAuth path skips the workspace-name field entirely. The app's onboarding
 * flow (FirstSimulationWizard / OnboardingWizard) will handle workspace creation
 * post-auth via the existing useWorkspace context — no edge case here, since
 * the original email signup already triggers the same downstream onboarding.
 */
const SignUp = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<"google" | "github" | "twitter" | null>(
    null
  );

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleOAuth = async (provider: "google" | "github" | "twitter") => {
    setIsOAuthLoading(provider);
    trackEvent("signup_oauth_clicked", { provider });
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setIsOAuthLoading(null);
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      trackEvent("signup_oauth_error", { provider, reason: error.message });
    }
    // On success, the page redirects to the OAuth provider — no further code runs here.
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    trackEvent("signup_email_submitted");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, workspace_name: workspaceName },
        emailRedirectTo: window.location.origin,
      },
    });
    setIsLoading(false);
    if (error) {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      trackEvent("signup_email_error", { reason: error.message });
    } else {
      toast({
        title: "Check your email",
        description: "We sent you a confirmation link to verify your account.",
      });
      trackEvent("signup_email_success");
    }
  };

  const anyLoading = isLoading || isOAuthLoading !== null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <LanguageSelector showText className="text-muted-foreground" size="sm" />
        </div>

        <Card className="shadow-primary-glow/30">
          <CardHeader className="text-center space-y-3 pb-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
              IF
            </div>
            <div>
              <h1 className="text-xl font-bold">{t("auth.createWorkspace")}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t("auth.signupSubtitle")}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* P1.1 — Primary OAuth path. Two clicks: Google + Allow. No password, no email-verify gate. */}
            <Button
              size="lg"
              variant="outline"
              className="w-full h-12"
              onClick={() => handleOAuth("google")}
              disabled={anyLoading}
            >
              {isOAuthLoading === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin me-2" />
              ) : (
                <svg className="h-4 w-4 me-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Continue with Google
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => handleOAuth("github")}
                disabled={anyLoading}
              >
                {isOAuthLoading === "github" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4 me-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                )}
                GitHub
              </Button>
              <Button
                variant="outline"
                onClick={() => handleOAuth("twitter")}
                disabled={anyLoading}
              >
                {isOAuthLoading === "twitter" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4 me-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                )}
                X / Twitter
              </Button>
            </div>

            <div className="relative my-2">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                or sign up with email
              </span>
            </div>

            <form onSubmit={handleSignUp} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={anyLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={anyLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={anyLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspace">{t("auth.workspaceName")}</Label>
                <Input
                  id="workspace"
                  placeholder="Acme Research"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  required
                  disabled={anyLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={anyLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                {t("auth.createAccount")}
              </Button>
            </form>
            <p className="text-[11px] text-center text-muted-foreground mt-2">
              Free forever · No credit card · 30-second sign-up
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                {t("auth.login")}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default SignUp;
