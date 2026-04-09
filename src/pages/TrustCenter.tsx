import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Shield, ShieldAlert, FileText, Download, Fingerprint, Lock, Server } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function TrustCenter() {
  const { currentWorkspace } = useWorkspace();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit_logs", currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select(`
          id, action, resource_type, resource_id, created_at,
          user_id, ip_address, details
        `)
        .eq("workspace_id", currentWorkspace?.id)
        .order("created_at", { ascending: false })
        .limit(50);
        
      if (error) throw error;
      return data as any[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const getActionBadge = (action: string) => {
    if (action.includes("created") || action.includes("added")) return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">{action}</Badge>;
    if (action.includes("deleted") || action.includes("removed")) return <Badge variant="destructive">{action}</Badge>;
    if (action.includes("simulation")) return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-none">{action}</Badge>;
    return <Badge variant="outline">{action}</Badge>;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto py-6">
      <div className="flex flex-col md:flex-row shadow-sm bg-card border rounded-lg overflow-hidden">
        <div className="bg-primary/5 p-8 md:w-1/3 flex flex-col justify-center border-r">
          <Shield className="h-12 w-12 text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-2">Enterprise Trust Center</h2>
          <p className="text-muted-foreground text-sm">
            Continuous compliance tracking and audit logging. Designed for strict data sovereignty and SOC 2 requirements.
          </p>
        </div>
        <div className="p-8 md:w-2/3 grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <Lock className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold text-sm">Data Encryption</h3>
            <p className="text-xs text-muted-foreground">AES-256 at rest, TLS 1.3 in transit</p>
          </div>
          <div className="space-y-2">
            <Server className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold text-sm">Data Residency</h3>
            <p className="text-xs text-muted-foreground">EU (Frankfurt) / US (N. Virginia)</p>
          </div>
          <div className="space-y-2">
            <ShieldAlert className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold text-sm">Compliance</h3>
            <p className="text-xs text-muted-foreground flex gap-1 mt-1">
              <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">SOC 2 Type II</span>
              <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">ISO 27001</span>
            </p>
          </div>
          <div className="space-y-2">
            <Fingerprint className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold text-sm">Access Control</h3>
            <p className="text-xs text-muted-foreground">Strict Row-Level Security Enforced</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div>
            <CardTitle className="text-lg">Audit Log</CardTitle>
            <CardDescription>Immutable record of all critical workspace activities.</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>User / IP</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                    No audit logs available yet. Events will populate here automatically.
                  </TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {format(new Date(log.created_at!), "MMM d, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      {getActionBadge(log.action)}
                    </TableCell>
                    <TableCell className="capitalize text-sm">
                      {log.resource_type.replace(/_/g, " ")}
                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5" title={log.resource_id ?? ""}>
                         {log.resource_id ? log.resource_id.substring(0, 8) + "..." : "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.user_id ? "Authenticated User" : "System Agent"}
                      {log.ip_address && (
                        <div className="text-muted-foreground font-mono mt-0.5">{log.ip_address}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.details ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title={JSON.stringify(log.details, null, 2)}>
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
