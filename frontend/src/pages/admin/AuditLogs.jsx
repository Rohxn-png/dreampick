import React, { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError, shortDate } from "@/lib/api";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "sonner";

export default function AdminAuditLogs() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/audit-logs");
        setRows(data.audit_logs || []);
      } catch (e) { toast.error(formatApiError(e)); }
      finally { setLoading(false); }
    })();
  }, []);
  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-audit-page">
        <div>
          <div className="overline text-[#F4D06F]">Audit Logs</div>
          <h1 className="font-heading text-3xl mt-1">Admin Activity ({rows.length})</h1>
        </div>
        <div className="dp-card p-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/60">When</TableHead>
                <TableHead className="text-white/60">Admin</TableHead>
                <TableHead className="text-white/60">Action</TableHead>
                <TableHead className="text-white/60">Target</TableHead>
                <TableHead className="text-white/60">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-white/40">Loading…</TableCell></TableRow>}
              {rows.map(r => (
                <TableRow key={r._id} className="border-white/5" data-testid={`audit-row-${r._id.slice(0,8)}`}>
                  <TableCell className="text-xs text-white/70">{shortDate(r.created_at)}</TableCell>
                  <TableCell className="text-white/80 text-xs">{r.admin_email}</TableCell>
                  <TableCell><span className="text-[#F4D06F]">{r.action}</span></TableCell>
                  <TableCell className="text-white/70">{r.target_type} · <span className="font-mono text-xs">{(r.target_id || "").slice(0, 8)}</span></TableCell>
                  <TableCell className="text-xs text-white/50 font-mono">{JSON.stringify(r.details).slice(0, 60)}</TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-white/40">No audit logs yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
