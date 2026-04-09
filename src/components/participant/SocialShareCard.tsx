import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Share2, Twitter, Linkedin, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function SocialShareCard() {
  const [shared, setShared] = useState(false);
  const shareText = "I just helped shape the future of products utilizing my InsightForge AI Twin. Earn money sharing your opinion natively via digital twin simulations! 🚀 #InsightForge #MarketResearch";
  const shareUrl = "https://insightforge.app/participate";

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "InsightForge AI Twin",
          text: shareText,
          url: shareUrl,
        });
        setShared(true);
      } catch (err) {
        // User cancelled or failed
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    toast({ title: "Copied to clipboard!" });
    setShared(true);
  };

  const openTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank");
    setShared(true);
  };

  const openLinkedIn = () => {
    // LinkedIn share URL doesn't support pre-filled text well via simple URL params anymore, 
    // but we can pass the URL and let them write the post.
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, "_blank");
    setShared(true);
  };

  return (
    <Card className="border-primary/20 shadow-md bg-gradient-to-tr from-card to-purple-500/5 animate-fade-in">
      <CardHeader className="pb-3 text-center sm:text-left">
        <CardTitle className="text-lg flex items-center justify-center sm:justify-start gap-2">
          {shared ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Share2 className="h-5 w-5 text-primary" />}
          {shared ? "Thanks for sharing!" : "Share your impact"}
        </CardTitle>
        <CardDescription>
          Tell your network how you're using your Twin, and earn $2 for everyone who signs up through your link.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row items-center gap-3">
        {/* Native Web Share API if supported */}
        {typeof navigator !== "undefined" && navigator.share && (
          <Button variant="default" className="w-full sm:w-auto flex-1 shrink-0 bg-primary" onClick={handleNativeShare}>
            <Share2 className="mr-2 h-4 w-4" /> Share via Mobile
          </Button>
        )}
        
        {/* Fallbacks */}
        <Button variant="outline" className="w-full sm:w-auto hover:text-blue-400 hover:border-blue-400" onClick={openTwitter}>
          <Twitter className="mr-2 h-4 w-4" /> Twitter / X
        </Button>
        <Button variant="outline" className="w-full sm:w-auto hover:text-blue-700 hover:border-blue-700" onClick={openLinkedIn}>
          <Linkedin className="mr-2 h-4 w-4" /> LinkedIn
        </Button>
      </CardContent>
    </Card>
  );
}
