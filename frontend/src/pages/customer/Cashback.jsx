import React, { useEffect, useState } from "react";
import { CustomerLayout } from "@/components/CustomerLayout";
import { api, formatApiError, formatINR, shortDate } from "@/lib/api";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "sonner";

const COLOR = {
  SCHEDULED: "text-white/60", DUE: "text-yellow-300", APPROVED: "text-[#9D5CFF]",
  PAID: "gold-text", ON_HOLD: "text-orange-300", CANCELLED: "text-red-400", REVERSED: "text-red-400",
};

export default function CustomerCashback() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/customer/cashback"); setRows(data.cashback_schedule || []); }
      catch (e) { toast.error(formatApiError(e)); }
    })();
  }, []);

  const totals = rows.reduce((acc, r) => {
    acc.gross += r.gross_amount || 0;
    acc.deduction += r.admin_charge_amount || 0;
    acc.net += r.net_amount || 0;
    if (r.status === "PAID") acc.paid++;
    return acc;
  }, { gross: 0, deduction: 0, net: 0, paid: 0 });

  return (
    <CustomerLayout>
      <div className="space-y-6" data-testid="customer-cashback-page">
        <div>
          <div className="overline text-[#D4A93A]">Buyer Cashback</div>
          <h1 className="font-heading text-3xl mt-1">10-month payout schedule</h1>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="dp-card p-5"><div className="overline text-white/50">Gross total</div><div className="font-heading text-2xl mt-2">{formatINR(totals.gross)}</div></div>
          <div className="dp-card p-5"><div className="overline text-white/50">Deduction</div><div className="font-heading text-2xl mt-2 text-red-300">{formatINR(totals.deduction)}</div></div>
          <div className="dp-card p-5"><div className="overline text-white/50">Net total</div><div className="font-heading text-2xl mt-2 gold-text">{formatINR(totals.net)}</div></div>
          <div className="dp-card p-5"><div className="overline text-white/50">Paid</div><div className="font-heading text-2xl mt-2">{totals.paid} / 10</div></div>
        </div>
        <div className="dp-card p-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/60">#</TableHead>
                <TableHead className="text-white/60">Scheduled</TableHead>
                <TableHead className="text-white/60">Gross</TableHead>
                <TableHead className="text-white/60">Deduction</TableHead>
                <TableHead className="text-white/60">Net</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Paid on</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-white/40">No cashback schedule yet. Available after order activation.</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r._id} className="border-white/5" data-testid={`cb-row-${r.installment_number}`}>
                  <TableCell className="font-mono">{r.installment_number}</TableCell>
                  <TableCell>{shortDate(r.scheduled_date)}</TableCell>
                  <TableCell>{formatINR(r.gross_amount)}</TableCell>
                  <TableCell className="text-red-300">{formatINR(r.admin_charge_amount)}</TableCell>
                  <TableCell><span className="gold-text font-heading">{formatINR(r.net_amount)}</span></TableCell>
                  <TableCell><span className={COLOR[r.status]}>{r.status}</span></TableCell>
                  <TableCell>{shortDate(r.paid_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </CustomerLayout>
  );
}
