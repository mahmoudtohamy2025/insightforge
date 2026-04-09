import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

const AuthCallback = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setStatus("error");
          setMessage(error.message);
          return;
        }

        if (data.session) {
          // Parse the hash to determine the type of callback
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const type = hashParams.get("type");

          if (type === "recovery") {
            setStatus("success");
            setMessage(t("auth.callback.recovery"));
            setTimeout(() => navigate("/reset-password", { replace: true }), 2000);
          } else {
            setStatus("success");
            setMessage(t("auth.callback.emailConfirmed"));
            setTimeout(() => navigate("/dashboard", { replace: true }), 2000);
          }
        } else {
          // No session but no error — might be email confirmation that auto-signs in
          // Listen for auth state change
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" && session) {
              setStatus("success");
              setMessage(t("auth.callback.emailConfirmed"));
              setTimeout(() => navigate("/dashboard", { replace: true }), 2000);
              subscription.unsubscribe();
            }
          });

          // Timeout fallback
          setTimeout(() => {
            setStatus("error");
            setMessage(t("auth.callback.error"));
            subscription.unsubscribe();
          }, 10000);
        }
      } catch {
        setStatus("error");
        setMessage(t("auth.callback.error"));
      }
    };

    handleCallback();
  }, [navigate, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground">{t("auth.callback.processing")}</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="h-10 w-10 text-green-500" />
              <p className="text-foreground font-medium">{message}</p>
              <p className="text-sm text-muted-foreground">{t("auth.callback.redirecting")}</p>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-foreground font-medium">{message}</p>
              <button
                onClick={() => navigate("/login", { replace: true })}
                className="text-sm text-primary underline"
              >
                {t("auth.backToLogin")}
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;
