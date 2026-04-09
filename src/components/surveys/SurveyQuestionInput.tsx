import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, GripVertical } from "lucide-react";

interface SurveyQuestionInputProps {
  questionId: string;
  questionType: string;
  options: string[] | { rows?: string[]; columns?: string[] } | null | unknown;
  value: string;
  onChange: (value: string) => void;
}

export function SurveyQuestionInput({ questionId, questionType, options, value, onChange }: SurveyQuestionInputProps) {
  switch (questionType) {
    case "nps":
      return (
        <div className="space-y-2">
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(String(n))}
                className={cn(
                  "h-10 w-10 rounded-md text-sm font-medium border transition-colors",
                  value === String(n)
                    ? n <= 6
                      ? "bg-destructive text-destructive-foreground border-destructive"
                      : n <= 8
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-input hover:bg-muted"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground px-1">
            <span>Not likely</span>
            <span>Very likely</span>
          </div>
        </div>
      );

    case "scale":
      return (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(String(n))}
                className={cn(
                  "h-10 w-10 rounded-md text-sm font-medium border transition-colors",
                  value === String(n)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-input hover:bg-muted"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground px-1 max-w-[230px]">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      );

    case "multiple_choice":
      return (
        <RadioGroup value={value} onValueChange={onChange}>
          {((options as any[]) ?? []).map((opt, i) => (
            <div key={i} className="flex items-center space-x-2 rtl:space-x-reverse">
              <RadioGroupItem value={opt} id={`${questionId}-${i}`} />
              <Label htmlFor={`${questionId}-${i}`} className="cursor-pointer font-normal">
                {opt}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );

    case "yes_no":
      return (
        <div className="flex gap-3">
          {["yes", "no"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={cn(
                "flex-1 h-11 rounded-md text-sm font-medium border transition-colors capitalize",
                value === v
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-input hover:bg-muted"
              )}
            >
              {v === "yes" ? "Yes" : "No"}
            </button>
          ))}
        </div>
      );

    case "multi_select": {
      let selected: string[] = [];
      try {
        selected = value ? JSON.parse(value) : [];
      } catch {
        selected = [];
      }

      const toggle = (opt: string) => {
        const next = selected.includes(opt)
          ? selected.filter((s) => s !== opt)
          : [...selected, opt];
        onChange(JSON.stringify(next));
      };

      return (
        <div className="space-y-2">
          {((options as any[]) ?? []).map((opt, i) => (
            <div key={i} className="flex items-center space-x-2 rtl:space-x-reverse">
              <Checkbox
                id={`${questionId}-ms-${i}`}
                checked={selected.includes(opt)}
                onCheckedChange={() => toggle(opt)}
              />
              <Label htmlFor={`${questionId}-ms-${i}`} className="cursor-pointer font-normal">
                {opt}
              </Label>
            </div>
          ))}
        </div>
      );
    }

    case "ranking": {
      let ranked: string[] = [];
      try {
        ranked = value ? JSON.parse(value) : [];
      } catch {
        ranked = [];
      }
      // Initialize with default option order if not yet ranked
      const optsArray = Array.isArray(options) ? options : [];
      if (ranked.length === 0 && optsArray.length > 0) {
        ranked = [...optsArray];
      }

      const move = (from: number, to: number) => {
        const next = [...ranked];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        onChange(JSON.stringify(next));
      };

      return (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-2">Drag or use arrows to rank from most to least important</p>
          {ranked.map((item, i) => (
            <div
              key={item}
              className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-mono text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
              <span className="flex-1">{item}</span>
              <div className="flex gap-0.5 shrink-0">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="h-7 w-7 rounded flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={i === ranked.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="h-7 w-7 rounded flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    case "open_ended":
    case "text":
    default:
      return (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer..."
          className="min-h-[100px]"
        />
      );
  }
}
