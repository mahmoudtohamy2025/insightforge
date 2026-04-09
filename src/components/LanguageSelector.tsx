import { useI18n, Language } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface LanguageSelectorProps {
  className?: string;
  variant?: "ghost" | "outline" | "default" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  showText?: boolean;
}

const LANGUAGES: { code: Language; label: string; icon: string }[] = [
  { code: "en", label: "English", icon: "🇺🇸" },
  { code: "ar", label: "العربية", icon: "🇸🇦" },
  { code: "fr", label: "Français", icon: "🇫🇷" },
  { code: "es", label: "Español", icon: "🇪🇸" },
  { code: "de", label: "Deutsch", icon: "🇩🇪" },
];

export function LanguageSelector({
  className,
  variant = "ghost",
  size = "icon",
  showText = false,
}: LanguageSelectorProps) {
  const { language, setLanguage } = useI18n();
  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={cn(className)}>
          <Globe className="h-4 w-4" />
          {showText && <span className="ms-2">{currentLang.label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={language === lang.code ? "bg-accent" : ""}
          >
            <span className="me-2 text-base leading-none">{lang.icon}</span>
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
