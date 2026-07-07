import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError, formatINR, shortDate } from "@/lib/api";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STATUS_COLOR = {
  PENDING: "text-yellow-300", APPROVED: "text-[#9D5CFF]", PAID: "gold-text",
  REJECTED: "text-red-400", REVERSED: "text-red-400", ON_HOLD: "text-orange-300",
};

export function CommissionListPage({ commissionType, label }) {
  const [rows, setRows] = useState([]);
  const load = async () => {
    try {
      const { data } = await api.get(`/admin/commissions?commission_type=${commissionType}`);
      setRows(data.commissions || []);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [commissionType]);

  const doAction = async (id, action) => {
    if (!window.confirm(`Confirm: ${action}?`)) return;
    try { await api.patch(`/admin/commissions/${id}/${action}`); toast.success("Done"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid={`admin-${commissionType.toLowerCase()}-page`}>
        <div>
          <div className="overline text-[#D4A93A]">{label}</div>
          <h1 className="font-heading text-3xl mt-1">{label} ({rows.length})</h1>
        </div>
        <div className="dp-card p-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/60">Beneficiary</TableHead>
                {commissionType === "MATCHING_INCOME" && <TableHead className="text-white/60">Pair #</TableHead>}
                <TableHead className="text-white/60">Gross</TableHead>
                <TableHead className="text-white/60">Deduction</TableHead>
                <TableHead className="text-white/60">Net</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(c => (
                <TableRow key={c._id} className="border-white/5" data-testid={`row-${c._id.slice(0,8)}`}>
                  <TableCell><Link to={`/admin/users/${c.beneficiary_user_id}`} className="text-[#F4D06F] hover:underline">{c.beneficiary?.full_name || "-"}</Link><div className="text-xs text-white/50 font-mono">{c.beneficiary?.user_code}</div></TableCell>
                  {commissionType === "MATCHING_INCOME" && <TableCell>{c.matched_pair_number}</TableCell>}
                  <TableCell>{formatINR(c.gross_amount)}</TableCell>
                  <TableCell className="text-red-300">{formatINR(c.admin_charge_amount)}</TableCell>
                  <TableCell className="gold-text font-heading">{formatINR(c.net_amount)}</TableCell>
                  <TableCell><span className={STATUS_COLOR[c.status]}>{c.status}</span></TableCell>
                  <TableCell>{shortDate(c.created_at)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {c.status === "PENDING" && (
                      <>
                        <Button size="sm" className="btn-primary text-xs" onClick={() => doAction(c._id, "approve")}>Approve</Button>
                        <Button size="sm" variant="ghost" className="btn-outline-dp text-xs" onClick={() => doAction(c._id, "hold")}>Hold</Button>
                        <Button size="sm" variant="ghost" className="text-red-400 border border-red-400/30 text-xs" onClick={() => doAction(c._id, "reject")}>Reject</Button>
                      </>
                    )}
                    {c.status === "APPROVED" && (
                      <>
                        <Link to={`/admin/users/${c.beneficiary_user_id}`}><Button size="sm" variant="ghost" className="btn-outline-dp text-xs">Bank</Button></Link>
                        <Button size="sm" className="btn-gold text-xs" onClick={() => doAction(c._id, "mark-paid")}>Mark Paid</Button>
                      </>
                    )}
                    {["PENDING", "APPROVED", "PAID"].includes(c.status) && (
                      <Button size="sm" variant="ghost" className="btn-outline-dp text-xs" onClick={() => doAction(c._id, "reverse")}>Reverse</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={commissionType === "MATCHING_INCOME" ? 8 : 7} className="text-white/40">No {label.toLowerCase()} records.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}

export function AdminDirectCommissions() {
  return <CommissionListPage commissionType="DIRECT_REFERRAL" label="Direct Referral Commissions" />;
}
export function AdminMatchingIncome() {
  return <CommissionListPage commissionType="MATCHING_INCOME" label="1:1 Matching Income" />;
}
