import React, { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError, formatINR, shortDate } from "@/lib/api";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Check, X, RotateCcw, Coins } from "lucide-react";

export default function AdminCommissions() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (status !== "all") params.status = status;
      const { data } = await api.get("/admin/commissions", { params });
      setRows(data.commissions);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const doAction = async (id, action) => {
    if (!window.confirm(`Are you sure you want to ${action.replace("-", " ")} this commission?`)) return;
    try {
      await api.patch(`/admin/commissions/${id}/${action}`);
      toast.success("Done");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const exportCsv = () => {
    const header = ["id", "beneficiary", "pair", "amount", "status", "created_at"];
    const csv = [header.join(",")].concat(rows.map(r => [r._id, r.beneficiary?.email || "", r.matched_pair_number, r.amount, r.status, r.created_at].join(","))).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "commissions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-commissions-page">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="overline text-[#00E5FF]">Commissions</div>
            <h1 className="font-heading text-3xl mt-1">Commission Approvals ({rows.length})</h1>
          </div>
          <Button variant="ghost" className="btn-outline-dp" onClick={exportCsv} data-testid="admin-commissions-csv"><Download className="w-4 h-4 mr-2" /> CSV</Button>
        </div>

        <div className="dp-card p-4 flex gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-[#070B14] border-white/10 w-48" data-testid="admin-commissions-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#0C1222] border-white/10 text-white">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="REVERSED">Reversed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="dp-card p-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/60">ID</TableHead>
                <TableHead className="text-white/60">Beneficiary</TableHead>
                <TableHead className="text-white/60">Pair #</TableHead>
                <TableHead className="text-white/60">Amount</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-white/40">Loading…</TableCell></TableRow>}
              {rows.map(c => (
                <TableRow key={c._id} className="border-white/5" data-testid={`admin-commission-row-${c._id.slice(0,8)}`}>
                  <TableCell className="font-mono text-xs">{c._id.slice(0, 8)}</TableCell>
                  <TableCell>{c.beneficiary?.full_name || "-"}<div className="text-xs text-white/50">{c.beneficiary?.user_code}</div></TableCell>
                  <TableCell>{c.matched_pair_number}</TableCell>
                  <TableCell className="text-[#00E5FF]">{formatINR(c.amount)}</TableCell>
                  <TableCell>
                    <span className={
                      c.status === "PAID" ? "text-[#00FFA3]" :
                      c.status === "APPROVED" ? "text-[#00E5FF]" :
                      c.status === "PENDING" ? "text-yellow-300" :
                      "text-red-400"
                    }>{c.status}</span>
                  </TableCell>
                  <TableCell className="text-white/70 text-xs">{shortDate(c.created_at)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {c.status === "PENDING" && (
                      <>
                        <Button size="sm" className="btn-primary text-xs" onClick={() => doAction(c._id, "approve")} data-testid={`comm-approve-${c._id.slice(0,8)}`}><Check className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" className="text-red-400 border border-red-400/30 text-xs" onClick={() => doAction(c._id, "reject")} data-testid={`comm-reject-${c._id.slice(0,8)}`}><X className="w-3 h-3" /></Button>
                      </>
                    )}
                    {c.status === "APPROVED" && (
                      <Button size="sm" className="btn-primary text-xs" onClick={() => doAction(c._id, "mark-paid")} data-testid={`comm-paid-${c._id.slice(0,8)}`}><Coins className="w-3 h-3 mr-1" /> Pay</Button>
                    )}
                    {["PENDING", "APPROVED", "PAID"].includes(c.status) && (
                      <Button size="sm" variant="ghost" className="btn-outline-dp text-xs" onClick={() => doAction(c._id, "reverse")} data-testid={`comm-reverse-${c._id.slice(0,8)}`}><RotateCcw className="w-3 h-3" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-white/40">No commissions.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
