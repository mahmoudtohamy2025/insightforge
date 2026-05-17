import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { getDefaultAppPathForUser } from "@/lib/appDestination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LanguageSelector } from "@/components/LanguageSelector";

const SignUp = () => {
  const { t, language, setLanguage } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (user && (authLoading || superAdminLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={isSuperAdmin ? "/admin" : "/dashboard"} replace />;
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { data, error } = await supabase.functions.invoke("workspace-signup", {
      body: {
        full_name: fullName,
        email,
        password,
        workspace_name: workspaceName,
      },
    });

    if (error) {
      setIsLoading(false);
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      return;
    }

    if (data?.error) {
      setIsLoading(false);
      toast({ title: "Sign up failed", description: data.error, variant: "destructive" });
      return;
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);

    if (signInError) {
      toast({ title: "Login failed", description: signInError.message, variant: "destructive" });
      return;
    }

    toast({ title: "Workspace created", description: "Your account is ready to use." });
    const destination = signInData.user ? await getDefaultAppPathForUser(signInData.user.id) : "/dashboard";
    navigate(destination);
  };

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
              <p className="text-sm text-muted-foreground mt-1">{t("auth.signupSubtitle")}</p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspace">{t("auth.workspaceName")}</Label>
                <Input id="workspace" placeholder="Acme Research" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} required disabled={isLoading} />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                {t("auth.createAccount")}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">{t("auth.login")}</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default SignUp;
