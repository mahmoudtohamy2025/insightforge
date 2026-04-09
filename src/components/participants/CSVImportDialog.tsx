import { useState, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface ParsedRow {
  name: string;
  email?: string;
  age?: number;
  gender?: string;
  location?: string;
  phone?: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

const MAX_ROWS = 500;

const KNOWN_HEADERS: Record<string, keyof ParsedRow> = {
  name: "name",
  "full name": "name",
  fullname: "name",
  email: "email",
  "email address": "email",
  age: "age",
  gender: "gender",
  sex: "gender",
  location: "location",
  city: "location",
  country: "location",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function mapHeaders(headers: string[]): (keyof ParsedRow | null)[] {
  return headers.map((h) => {
    const normalized = h.toLowerCase().trim();
    return KNOWN_HEADERS[normalized] || null;
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CSVImportDialog = ({ open, onOpenChange }: CSVImportDialogProps) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [columnMap, setColumnMap] = useState<(keyof ParsedRow | null)[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setStep("upload");
    setParsedRows([]);
    setColumnMap([]);
    setRawHeaders([]);
    setParseErrors([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());

      if (lines.length < 2) {
        toast({ title: t("participants.csvNoData"), variant: "destructive" });
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const mapped = mapHeaders(headers);
      setRawHeaders(headers);
      setColumnMap(mapped);

      const errors: string[] = [];
      const rows: ParsedRow[] = [];

      const dataLines = lines.slice(1, MAX_ROWS + 1);
      if (lines.length - 1 > MAX_ROWS) {
        errors.push(t("participants.csvRowLimit").replace("{max}", String(MAX_ROWS)));
      }

      dataLines.forEach((line, idx) => {
        const values = parseCSVLine(line);
        const row: Partial<ParsedRow> = {};

        mapped.forEach((field, colIdx) => {
          if (!field || !values[colIdx]) return;
          const val = values[colIdx];
          if (field === "age") {
            const num = parseInt(val);
            if (!isNaN(num) && num > 0 && num < 150) row.age = num;
          } else if (field === "email") {
            if (isValidEmail(val)) row.email = val;
            else errors.push(`Row ${idx + 2}: invalid email "${val}"`);
          } else {
            (row as Record<string, string | number | undefined>)[field] = val;
          }
        });

        if (!row.name) {
          errors.push(`Row ${idx + 2}: missing name, skipped`);
          return;
        }

        rows.push(row as ParsedRow);
      });

      setParsedRows(rows);
      setParseErrors(errors);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!currentWorkspace || !user) return;
    setStep("importing");

    // Fetch existing emails for dedup
    const { data: existing } = await supabase
      .from("participants")
      .select("email")
      .eq("workspace_id", currentWorkspace.id)
      .not("email", "is", null);

    const existingEmails = new Set(
      (existing || []).map((p) => p.email?.toLowerCase())
    );

    const toInsert: Array<{
      workspace_id: string;
      created_by: string;
      name: string;
      email: string | null;
      age: number | null;
      gender: string | null;
      location: string | null;
      phone: string | null;
      source: string;
    }> = [];
    let skipped = 0;
    const errors: string[] = [];

    parsedRows.forEach((row) => {
      if (row.email && existingEmails.has(row.email.toLowerCase())) {
        skipped++;
        return;
      }
      toInsert.push({
        workspace_id: currentWorkspace.id,
        created_by: user.id,
        name: row.name,
        email: row.email || null,
        age: row.age || null,
        gender: row.gender || null,
        location: row.location || null,
        phone: row.phone || null,
        source: "csv",
      });
    });

    // Batch insert in chunks of 50
    let imported = 0;
    for (let i = 0; i < toInsert.length; i += 50) {
      const chunk = toInsert.slice(i, i + 50);
      const { error } = await supabase.from("participants").insert(chunk);
      if (error) {
        errors.push(`Batch ${Math.floor(i / 50) + 1}: ${error.message}`);
      } else {
        imported += chunk.length;
      }
    }

    setResult({ imported, skipped, errors });
    setStep("done");
    queryClient.invalidateQueries({ queryKey: ["participants"] });
  };

  const nameColExists = columnMap.includes("name");
  const previewRows = parsedRows.slice(0, 5);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("participants.importCSV")}</DialogTitle>
          <DialogDescription>{t("participants.importDesc")}</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">
                {t("participants.csvDropHint")}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                {t("participants.selectFile")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("participants.csvFormat")}
            </p>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{parsedRows.length} rows</Badge>
              {nameColExists ? (
                <Badge variant="outline" className="text-green-600">
                  <CheckCircle2 className="h-3 w-3 me-1" />
                  Name column detected
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 me-1" />
                  No name column found
                </Badge>
              )}
            </div>

            {previewRows.length > 0 && (
              <div className="border rounded-lg overflow-auto max-h-48">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {rawHeaders.map((h, i) => (
                        <TableHead key={i} className="text-xs">
                          {h}
                          {columnMap[i] && (
                            <Badge variant="secondary" className="ms-1 text-[9px]">
                              → {columnMap[i]}
                            </Badge>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, i) => (
                      <TableRow key={i}>
                        {rawHeaders.map((_, ci) => {
                          const field = columnMap[ci];
                          return (
                            <TableCell key={ci} className="text-xs py-1">
                              {field ? (row as unknown as Record<string, string | number | undefined>)[field] || "—" : "—"}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {parseErrors.length > 0 && (
              <div className="bg-destructive/10 rounded-lg p-3 max-h-24 overflow-auto">
                {parseErrors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {e}
                  </p>
                ))}
                {parseErrors.length > 5 && (
                  <p className="text-xs text-destructive mt-1">
                    +{parseErrors.length - 5} more warnings
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={reset}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleImport} disabled={!nameColExists || parsedRows.length === 0}>
                {t("participants.importCount").replace("{count}", String(parsedRows.length))}
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t("participants.importing")}</p>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4">
            <div className="bg-primary/5 rounded-lg p-6 text-center">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-primary" />
              <p className="font-semibold">
                {t("participants.importResult")
                  .replace("{imported}", String(result.imported))
                  .replace("{skipped}", String(result.skipped))}
              </p>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-destructive/10 rounded-lg p-3">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive">{e}</p>
                ))}
              </div>
            )}
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              {t("common.done")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
