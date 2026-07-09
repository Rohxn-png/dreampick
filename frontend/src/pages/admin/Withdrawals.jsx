import React, { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError, formatINR, shortDate } from "@/lib/api";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function AdminWithdrawals() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (status !== "all") params.status = status;
      const { data } = await api.get("/admin/withdrawals", { params });
      setRows(data.withdrawal_requests);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [status]);

  const doAction = async (id, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this withdrawal?`)) return;
    try {
      await api.patch(`/admin/withdrawals/${id}/${action}`);
      toast.success("Done");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-withdrawals-page">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="overline text-[#F4D06F]">Withdrawals</div>
            <h1 className="font-heading text-3xl mt-1">Payout Requests ({rows.length})</h1>
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-[#0F0A1F] border-white/10 w-40" data-testid="admin-withdrawals-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#1F1836] border-white/10 text-white">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="dp-card p-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/60">Request</TableHead>
                <TableHead className="text-white/60">Customer</TableHead>
                <TableHead className="text-white/60">Amount</TableHead>
                <TableHead className="text-white/60">Bank</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Requested</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-white/40">Loading…</TableCell></TableRow>}
              {rows.map(w => (
                <TableRow key={w._id} className="border-white/5" data-testid={`admin-wr-row-${w._id.slice(0,8)}`}>
                  <TableCell className="font-mono text-xs">{w._id.slice(0, 8)}</TableCell>
                  <TableCell>{w.user?.full_name}<div className="text-xs text-white/50">{w.user?.user_code}</div></TableCell>
                  <TableCell className="text-[#F4D06F]">{formatINR(w.amount)}</TableCell>
                  <TableCell className="text-white/70">{w.bank_name} · {w.bank_account_masked}</TableCell>
                  <TableCell><span className={w.status === "PAID" ? "text-[#F4D06F]" : w.status === "APPROVED" ? "text-[#F4D06F]" : w.status === "PENDING" ? "text-yellow-300" : "text-red-400"}>{w.status}</span></TableCell>
                  <TableCell className="text-white/70 text-xs">{shortDate(w.created_at)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {w.status === "PENDING" && (
                      <>
                        <Button size="sm" className="btn-primary text-xs" onClick={() => doAction(w._id, "approve")} data-testid={`wr-approve-${w._id.slice(0,8)}`}>Approve</Button>
                        <Button size="sm" variant="ghost" className="text-red-400 border border-red-400/30 text-xs" onClick={() => doAction(w._id, "reject")} data-testid={`wr-reject-${w._id.slice(0,8)}`}>Reject</Button>
                      </>
                    )}
                    {w.status === "APPROVED" && (
                      <Button size="sm" className="btn-primary text-xs" onClick={() => doAction(w._id, "mark-paid")} data-testid={`wr-paid-${w._id.slice(0,8)}`}>Mark Paid</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-white/40">No withdrawal requests.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
