import { useState, useMemo } from "react";
import { CreateStudyDialog } from "@/components/studies/CreateStudyDialog";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Upload, Download, Search, Calculator, Star, Users, Loader2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Megaphone } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { CSVImportDialog } from "@/components/participants/CSVImportDialog";
import { ParticipantDetailDialog } from "@/components/participants/ParticipantDetailDialog";
import { triggerDownload, escapeCsv } from "@/lib/exportUtils";

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say", "Other"];

type SortField = "name" | "age" | "session_count" | "quality_score" | "created_at";
type SortDir = "asc" | "desc";

const Participants = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { isAdminOrOwner } = useWorkspaceRole();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [erasingParticipant, setErasingParticipant] = useState<any>(null);
  const [studyDialogOpen, setStudyDialogOpen] = useState(false);

  // Filters
  const [filterGender, setFilterGender] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["participants", currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("*")
        .eq("workspace_id", currentWorkspace!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("participants").insert({
        workspace_id: currentWorkspace!.id,
        name,
        email: email || null,
        age: age ? parseInt(age) : null,
        gender: gender || null,
        location: location || null,
        phone: phone || null,
        source: "manual",
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants"] });
      setAddOpen(false);
      setName("");
      setEmail("");
      setAge("");
      setGender("");
      setLocation("");
      setPhone("");
      toast({ title: t("participants.added") });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const eraseMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const { data, error } = await supabase.functions.invoke("erase-participant", {
        body: { workspace_id: currentWorkspace!.id, participant_id: participantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["participants"] });
      setErasingParticipant(null);
      toast({ title: t("governance.erasureComplete"), description: data?.erased });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleExport = () => {
    if (participants.length === 0) {
      toast({ title: t("participants.noDataExport"), variant: "destructive" });
      return;
    }
    const headers = ["Name", "Email", "Phone", "Age", "Gender", "Location", "Sessions", "Quality Score", "Source"];
    const rows = participants.map((p: any) => [
      escapeCsv(p.name),
      escapeCsv(p.email || ""),
      escapeCsv(p.phone || ""),
      String(p.age || ""),
      escapeCsv(p.gender || ""),
      escapeCsv(p.location || ""),
      String(p.session_count || 0),
      String(p.quality_score || 0),
      escapeCsv(p.source || "manual"),
    ]);
    const csv = [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\n");
    triggerDownload(csv, "participants.csv");
    toast({ title: t("participants.exported") });
  };

  // Get unique sources for filter dropdown
  const uniqueSources = useMemo(() => {
    const sources = new Set(participants.map((p: any) => p.source || "manual"));
    return Array.from(sources).sort();
  }, [participants]);

  // Filter + Search + Sort
  const filtered = useMemo(() => {
    const result = participants.filter((p: any) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.location || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.email || "").toLowerCase().includes(search.toLowerCase());
      const matchesGender = filterGender === "all" || (p.gender || "").toLowerCase() === filterGender.toLowerCase();
      const matchesSource = filterSource === "all" || (p.source || "manual") === filterSource;
      return matchesSearch && matchesGender && matchesSource;
    });

    // Sort
    result.sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === "name") {
        aVal = (aVal || "").toLowerCase();
        bVal = (bVal || "").toLowerCase();
      } else {
        aVal = Number(aVal || 0);
        bVal = Number(bVal || 0);
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [participants, search, filterGender, filterSource, sortField, sortDir]);

  const activeFilterCount = (filterGender !== "all" ? 1 : 0) + (filterSource !== "all" ? 1 : 0);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ms-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ms-1 text-primary" /> : <ArrowDown className="h-3 w-3 ms-1 text-primary" />;
  };

  const avgQuality = participants.length
    ? (participants.reduce((s: number, p: any) => s + Number(p.quality_score || 0), 0) / participants.length).toFixed(1)
    : "0";
  const avgSessions = participants.length
    ? (participants.reduce((s: number, p: any) => s + (p.session_count || 0), 0) / participants.length).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("participants.title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setStudyDialogOpen(true)}>
            <Megaphone className="h-4 w-4 me-2" />Post Study
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 me-2" />{t("participants.import")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 me-2" />{t("participants.export")}
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 me-2" />{t("participants.add")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("participants.add")}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>{t("participants.fieldName")} *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-2"><Label>{t("participants.fieldEmail")}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>{t("participants.fieldPhone")}</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>{t("participants.fieldAge")}</Label><Input type="number" value={age} onChange={(e) => setAge(e.target.value)} /></div>
                  <div className="space-y-2">
                    <Label>{t("participants.fieldGender")}</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger><SelectValue placeholder={t("participants.selectGender")} /></SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>{t("participants.fieldLocation")}</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
                <Button onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending} className="w-full">
                  {createMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {t("common.create")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><Users className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{participants.length}</p>
              <p className="text-xs text-muted-foreground">{t("participants.totalParticipants")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><Star className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{avgQuality}</p>
              <p className="text-xs text-muted-foreground">{t("participants.avgQuality")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><Calculator className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{avgSessions}</p>
              <p className="text-xs text-muted-foreground">{t("participants.avgSessions")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("participants.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
        </div>
        <Select value={filterGender} onValueChange={setFilterGender}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("participants.filterGender")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("participants.allGenders")}</SelectItem>
            {GENDER_OPTIONS.map((g) => (
              <SelectItem key={g} value={g.toLowerCase()}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t("participants.filterSource")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("participants.allSources")}</SelectItem>
            {uniqueSources.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {activeFilterCount} {t("participants.activeFilters")}
          </Badge>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    <span className="flex items-center">{t("participants.fieldName")}<SortIcon field="name" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("age")}>
                    <span className="flex items-center">{t("participants.fieldAge")}<SortIcon field="age" /></span>
                  </TableHead>
                  <TableHead>{t("participants.fieldGender")}</TableHead>
                  <TableHead>{t("participants.fieldLocation")}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("session_count")}>
                    <span className="flex items-center">{t("participants.sessions")}<SortIcon field="session_count" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("quality_score")}>
                    <span className="flex items-center">{t("participants.qualityScore")}<SortIcon field="quality_score" /></span>
                  </TableHead>
                  <TableHead>{t("participants.fieldSource")}</TableHead>
                  {isAdminOrOwner && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdminOrOwner ? 8 : 7} className="p-0">
                      <EmptyState
                        icon={Users}
                        title={t("participants.emptyTitle")}
                        description={t("participants.emptyDesc")}
                        actionLabel={t("participants.add")}
                        onAction={() => setAddOpen(true)}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p: any) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedParticipant(p)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          {p.email && <p className="text-xs text-muted-foreground">{p.email}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{p.age || "—"}</TableCell>
                      <TableCell>{p.gender ? <Badge variant="secondary" className="text-[10px]">{p.gender}</Badge> : "—"}</TableCell>
                      <TableCell className="text-sm">{p.location || "—"}</TableCell>
                      <TableCell>{p.session_count}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className={`h-3 w-3 ${Number(p.quality_score) >= 4.5 ? "text-primary fill-primary" : "text-muted-foreground"}`} />
                          <span className="text-sm">{p.quality_score}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {p.source || "manual"}
                        </Badge>
                      </TableCell>
                      {isAdminOrOwner && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setErasingParticipant(p); }}
                            className="text-destructive hover:text-destructive h-7 w-7 p-0"
                            title={t("governance.eraseParticipant")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CSVImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <ParticipantDetailDialog
        participant={selectedParticipant}
        open={!!selectedParticipant}
        onOpenChange={(open) => !open && setSelectedParticipant(null)}
      />

      <AlertDialog open={!!erasingParticipant} onOpenChange={(open) => !open && setErasingParticipant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("governance.eraseParticipantTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("governance.eraseParticipantDesc").replace("{name}", erasingParticipant?.name || "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => erasingParticipant && eraseMutation.mutate(erasingParticipant.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {eraseMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t("governance.eraseConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {currentWorkspace && (
        <CreateStudyDialog
          open={studyDialogOpen}
          onOpenChange={setStudyDialogOpen}
          workspaceId={currentWorkspace.id}
        />
      )}
    </div>
  );
};

export default Participants;
