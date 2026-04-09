import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Gift, Copy, CheckCircle2, Users, ArrowRight } from "lucide-react";

export function ReferralsTab({ workspaceId }: { workspaceId: string | undefined }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  // Predictable mock invite code based on workspace ID
  const inviteCode = workspaceId ? `IF-${workspaceId.substring(0, 8).toUpperCase()}` : "IF-DEMO-2026";
  const inviteUrl = `https://insightforge.app/signup?ref=${inviteCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast({
      title: "Copied to clipboard",
      description: "Share this link with colleagues to earn bonus tokens.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-primary/20 shadow-sm bg-gradient-to-br from-card to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Invite Colleagues, Get Tokens
          </CardTitle>
          <CardDescription>
            For every colleague who signs up using your link and runs their first simulation, your workspace gets <strong className="text-primary font-bold">100,000 bonus tokens</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input readOnly value={inviteUrl} className="pr-12 text-muted-foreground font-mono text-sm" />
            </div>
            <Button variant="secondary" onClick={copyToClipboard} className="shrink-0 w-24">
              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <><Copy className="h-4 w-4 mr-2" /> Copy</>}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border/50 pt-6 mt-6">
            <div className="space-y-2">
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-sm text-muted-foreground">Pending Invites</p>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-emerald-500">0</p>
              <p className="text-sm text-muted-foreground">Successful Referrals</p>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-primary">0</p>
              <p className="text-sm text-muted-foreground">Tokens Earned</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Send Email Invites
          </CardTitle>
          <CardDescription>Invite external researchers directly to try InsightForge.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="colleague@company.com" type="email" />
            <Button onClick={() => toast({ title: "Invite sent!" })}>
              Send <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
