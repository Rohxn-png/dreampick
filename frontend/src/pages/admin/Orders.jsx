import React, { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError, formatINR, shortDate } from "@/lib/api";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Download } from "lucide-react";

export default function AdminOrders() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (status !== "all") params.status = status;
      if (q) params.q = q;
      const { data } = await api.get("/admin/orders", { params });
      setRows(data.orders);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const doAction = async (orderId, action) => {
    try {
      await api.patch(`/admin/orders/${orderId}/${action}`);
      toast.success(`Order ${action} applied`);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const exportCsv = () => {
    const header = ["order_number", "buyer_email", "amount", "payment_status", "delivery_status", "created_at"];
    const csv = [header.join(",")].concat(
      rows.map(r => [r.order_number, r.buyer?.email || "", r.amount, r.payment_status, r.delivery_status, r.created_at].join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "orders.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-orders-page">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="overline text-[#00E5FF]">Orders</div>
            <h1 className="font-heading text-3xl mt-1">Order Management</h1>
          </div>
          <Button variant="ghost" className="btn-outline-dp" onClick={exportCsv} data-testid="admin-orders-csv-btn"><Download className="w-4 h-4 mr-2" /> CSV</Button>
        </div>

        <div className="dp-card p-4 flex gap-3 flex-wrap">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-[#070B14] border-white/10 w-40" data-testid="admin-orders-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#0C1222] border-white/10 text-white">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="CREATED">Created</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="REFUNDED">Refunded</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Search order #" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
            className="bg-[#070B14] border-white/10 max-w-xs" data-testid="admin-orders-search" />
          <Button className="btn-primary" onClick={load}>Apply</Button>
        </div>

        <div className="dp-card p-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/60">Order #</TableHead>
                <TableHead className="text-white/60">Buyer</TableHead>
                <TableHead className="text-white/60">Amount</TableHead>
                <TableHead className="text-white/60">Referral</TableHead>
                <TableHead className="text-white/60">Payment</TableHead>
                <TableHead className="text-white/60">Delivery</TableHead>
                <TableHead className="text-white/60">Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={8} className="text-white/40">Loading…</TableCell></TableRow>}
              {rows.map(o => (
                <TableRow key={o._id} className="border-white/5" data-testid={`admin-order-row-${o.order_number}`}>
                  <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                  <TableCell>{o.buyer?.full_name || "-"}<div className="text-xs text-white/50">{o.buyer?.email}</div></TableCell>
                  <TableCell>{formatINR(o.amount)}</TableCell>
                  <TableCell className="font-mono text-xs">{o.referral_code_used || "-"}</TableCell>
                  <TableCell><span className={o.payment_status === "PAID" ? "text-[#00FFA3]" : o.payment_status === "FAILED" ? "text-red-400" : "text-yellow-300"}>{o.payment_status}</span></TableCell>
                  <TableCell><span className="text-white/70">{o.delivery_status}</span></TableCell>
                  <TableCell className="text-white/70 text-xs">{shortDate(o.created_at)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {o.payment_status === "CREATED" && (
                      <>
                        <Button size="sm" className="btn-primary text-xs" onClick={() => doAction(o._id, "simulate-paid")} data-testid={`order-pay-${o.order_number}`}>Pay</Button>
                        <Button size="sm" variant="ghost" className="btn-outline-dp text-xs" onClick={() => doAction(o._id, "simulate-failed")} data-testid={`order-fail-${o.order_number}`}>Fail</Button>
                      </>
                    )}
                    {o.payment_status === "PAID" && (
                      <>
                        <Button size="sm" variant="ghost" className="btn-outline-dp text-xs" onClick={() => doAction(o._id, "deliver")} data-testid={`order-deliver-${o.order_number}`}>Deliver</Button>
                        <Button size="sm" variant="ghost" className="text-red-400 border border-red-400/30 text-xs" onClick={() => doAction(o._id, "refund")} data-testid={`order-refund-${o.order_number}`}>Refund</Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-white/40">No orders found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
