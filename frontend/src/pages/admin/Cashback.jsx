import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError, formatINR, shortDate } from "@/lib/api";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STATUS_COLOR = {
  SCHEDULED: "text-white/60", DUE: "text-yellow-300", APPROVED: "text-[#9D5CFF]",
  PAID: "gold-text", ON_HOLD: "text-orange-300", CANCELLED: "text-red-400", REVERSED: "text-red-400",
};

export default function AdminCashback() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("all");
  const load = async () => {
    try {
      const params = {}; if (status !== "all") params.status = status;
      const { data } = await api.get("/admin/cashback", { params });
      setRows(data.cashback_schedule || []);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const doAction = async (id, action) => {
    if (!window.confirm(`Confirm: ${action}?`)) return;
    try { await api.patch(`/admin/cashback/${id}/${action}`); toast.success("Done"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-cashback-page">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="overline text-[#D4A93A]">Buyer Cashback</div>
            <h1 className="font-heading text-3xl mt-1">Scheduled payouts ({rows.length})</h1>
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-[#0F0A1F] border-white/10 w-40" data-testid="cashback-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#1F1836] border-white/10 text-white">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="DUE">Due</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="ON_HOLD">On Hold</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="REVERSED">Reversed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="dp-card p-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/60">User</TableHead>
                <TableHead className="text-white/60">Inst.</TableHead>
                <TableHead className="text-white/60">Scheduled</TableHead>
                <TableHead className="text-white/60">Gross</TableHead>
                <TableHead className="text-white/60">Deduction</TableHead>
                <TableHead className="text-white/60">Net</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r._id} className="border-white/5" data-testid={`admin-cb-row-${r._id.slice(0,8)}`}>
                  <TableCell><Link to={`/admin/users/${r.user_id}`} className="text-[#F4D06F] hover:underline">{r.user?.full_name || r.user_id.slice(0,8)}</Link><div className="text-xs text-white/50 font-mono">{r.user?.user_code}</div></TableCell>
                  <TableCell>{r.installment_number}/10</TableCell>
                  <TableCell>{shortDate(r.scheduled_date)}</TableCell>
                  <TableCell>{formatINR(r.gross_amount)}</TableCell>
                  <TableCell className="text-red-300">{formatINR(r.admin_charge_amount)}</TableCell>
                  <TableCell className="gold-text font-heading">{formatINR(r.net_amount)}</TableCell>
                  <TableCell><span className={STATUS_COLOR[r.status]}>{r.status}</span></TableCell>
                  <TableCell className="text-right space-x-1">
                    {["DUE", "SCHEDULED"].includes(r.status) && <Button size="sm" className="btn-primary text-xs" onClick={() => doAction(r._id, "approve")} data-testid={`cb-approve-${r._id.slice(0,8)}`}>Approve</Button>}
                    {["APPROVED"].includes(r.status) && (
                      <>
                        <Link to={`/admin/users/${r.user_id}`}><Button size="sm" variant="ghost" className="btn-outline-dp text-xs">Bank Details</Button></Link>
                        <Button size="sm" className="btn-gold text-xs" onClick={() => doAction(r._id, "mark-paid")} data-testid={`cb-paid-${r._id.slice(0,8)}`}>Mark Paid</Button>
                      </>
                    )}
                    {["SCHEDULED", "DUE", "APPROVED"].includes(r.status) && <Button size="sm" variant="ghost" className="btn-outline-dp text-xs" onClick={() => doAction(r._id, "hold")}>Hold</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-white/40">No cashback records.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
