import React, { useEffect, useState } from "react";
import { CustomerLayout } from "@/components/CustomerLayout";
import { api, formatApiError, formatINR, shortDate } from "@/lib/api";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS = {
  PENDING: "text-yellow-300",
  APPROVED: "text-[#F4D06F]",
  PAID: "text-[#F4D06F]",
  REJECTED: "text-red-400",
  REVERSED: "text-white/60",
};

export default function CustomerCommissions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/customer/commissions");
        setRows(data.commissions || []);
      } catch (e) {
        toast.error(formatApiError(e));
      } finally { setLoading(false); }
    })();
  }, []);

  const totals = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + r.amount;
    return acc;
  }, {});

  const exportCsv = () => {
    const header = ["id", "matched_pair", "amount", "status", "created_at", "approved_at", "paid_at"];
    const csv = [header.join(",")].concat(
      rows.map(r => [r._id, r.matched_pair_number, r.amount, r.status, r.created_at, r.approved_at || "", r.paid_at || ""].join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "commissions.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  return (
    <CustomerLayout>
      <div className="space-y-6" data-testid="customer-commissions-page">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="overline text-[#F4D06F]">Commissions</div>
            <h1 className="font-heading text-3xl mt-1">Earnings History</h1>
          </div>
          <Button variant="ghost" className="btn-outline-dp" onClick={exportCsv} data-testid="commissions-export-csv-btn">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {["PENDING", "APPROVED", "PAID", "REJECTED", "REVERSED"].map(s => (
            <div key={s} className="dp-card p-4" data-testid={`commission-total-${s}`}>
              <div className="overline text-white/50">{s}</div>
              <div className={`mt-2 font-heading text-xl ${STATUS_COLORS[s]}`}>{formatINR(totals[s] || 0)}</div>
            </div>
          ))}
        </div>

        <div className="dp-card p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-white/60">Commission</TableHead>
                  <TableHead className="text-white/60">Pair #</TableHead>
                  <TableHead className="text-white/60">Amount</TableHead>
                  <TableHead className="text-white/60">Status</TableHead>
                  <TableHead className="text-white/60">Triggered</TableHead>
                  <TableHead className="text-white/60">Approved</TableHead>
                  <TableHead className="text-white/60">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={7} className="text-white/40">Loading…</TableCell></TableRow>}
                {rows.map(r => (
                  <TableRow key={r._id} className="border-white/5" data-testid={`commission-row-${r._id}`}>
                    <TableCell className="font-mono text-xs">{r._id.slice(0, 8)}</TableCell>
                    <TableCell>{r.matched_pair_number}</TableCell>
                    <TableCell className="text-[#F4D06F]">{formatINR(r.amount)}</TableCell>
                    <TableCell><span className={STATUS_COLORS[r.status]}>{r.status}</span></TableCell>
                    <TableCell>{shortDate(r.created_at)}</TableCell>
                    <TableCell>{shortDate(r.approved_at)}</TableCell>
                    <TableCell>{shortDate(r.paid_at)}</TableCell>
                  </TableRow>
                ))}
                {!loading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-white/40">No commissions yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
