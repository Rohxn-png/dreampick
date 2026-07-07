import React, { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError, formatINR, shortDate } from "@/lib/api";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const COLOR = {
  PAYMENT_PENDING: "text-yellow-300", PAYMENT_CONFIRMED: "text-[#9D5CFF]",
  ACTIVATED: "gold-text", FAILED: "text-red-400", CANCELLED: "text-red-400", REFUNDED: "text-orange-300",
};

export default function AdminOrders() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("all");
  const load = async () => {
    try {
      const params = {}; if (status !== "all") params.status = status;
      const { data } = await api.get("/admin/orders", { params });
      setRows(data.orders || []);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const activate = async (id) => {
    if (!window.confirm("Confirm activation? This will place user in tree, create cashback schedule, and generate commissions.")) return;
    try { await api.patch(`/admin/orders/${id}/activate`); toast.success("Activated"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  const updateStatus = async (id, newStatus) => {
    if (!window.confirm(`Change status to ${newStatus}?`)) return;
    try { await api.patch(`/admin/orders/${id}/status`, { status: newStatus }); toast.success("Updated"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-orders-page">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="overline text-[#D4A93A]">Orders / Activations</div>
            <h1 className="font-heading text-3xl mt-1">Order management</h1>
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-[#0F0A1F] border-white/10 w-48" data-testid="orders-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#1F1836] border-white/10 text-white">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="PAYMENT_PENDING">Payment Pending</SelectItem>
              <SelectItem value="PAYMENT_CONFIRMED">Payment Confirmed</SelectItem>
              <SelectItem value="ACTIVATED">Activated</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="REFUNDED">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="dp-card p-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/60">Order #</TableHead>
                <TableHead className="text-white/60">Buyer</TableHead>
                <TableHead className="text-white/60">Amount</TableHead>
                <TableHead className="text-white/60">Referral</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(o => (
                <TableRow key={o._id} className="border-white/5" data-testid={`order-row-${o.order_number}`}>
                  <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                  <TableCell><Link to={`/admin/users/${o.buyer_user_id}`} className="text-[#F4D06F] hover:underline">{o.buyer?.full_name || "-"}</Link><div className="text-xs text-white/50">{o.buyer?.email}</div></TableCell>
                  <TableCell>{formatINR(o.amount)}</TableCell>
                  <TableCell className="font-mono text-xs">{o.referral_code_used || "-"}</TableCell>
                  <TableCell><span className={COLOR[o.payment_status]}>{o.payment_status}</span></TableCell>
                  <TableCell className="text-xs text-white/70">{shortDate(o.created_at)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {["PAYMENT_PENDING", "PAYMENT_CONFIRMED"].includes(o.payment_status) && (
                      <>
                        {o.payment_status === "PAYMENT_PENDING" && <Button size="sm" variant="ghost" className="btn-outline-dp text-xs" onClick={() => updateStatus(o._id, "PAYMENT_CONFIRMED")} data-testid={`confirm-payment-${o.order_number}`}>Confirm Payment</Button>}
                        <Button size="sm" className="btn-gold text-xs" onClick={() => activate(o._id)} data-testid={`activate-${o.order_number}`}>Activate</Button>
                      </>
                    )}
                    {o.payment_status === "ACTIVATED" && (
                      <Button size="sm" variant="ghost" className="text-red-400 border border-red-400/30 text-xs" onClick={() => updateStatus(o._id, "REFUNDED")}>Refund</Button>
                    )}
                    {!["ACTIVATED", "CANCELLED", "REFUNDED"].includes(o.payment_status) && (
                      <Button size="sm" variant="ghost" className="text-red-400 text-xs" onClick={() => updateStatus(o._id, "CANCELLED")}>Cancel</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-white/40">No orders.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
