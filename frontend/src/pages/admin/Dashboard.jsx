import React, { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError, formatINR, shortDate } from "@/lib/api";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";

const S = ({ label, value, accent, testId }) => (
  <div className="dp-card p-5" data-testid={testId}>
    <div className="overline text-white/50">{label}</div>
    <div className={`mt-2 font-heading text-2xl ${accent || "text-white"}`}>{value}</div>
  </div>
);

const COLORS = ["#7C3AED", "#D4A93A", "#9D5CFF", "#F4D06F", "#EC4899"];

export default function AdminDashboard() {
  const [d, setD] = useState(null);
  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/admin/dashboard"); setD(data); }
      catch (e) { toast.error(formatApiError(e)); }
    })();
  }, []);
  if (!d) return <AdminLayout><div className="text-white/40 animate-pulse">Loading…</div></AdminLayout>;
  const t = d.totals;
  const cb = d.cashback_totals;
  const cbData = [
    { name: "Scheduled", value: cb.SCHEDULED }, { name: "Due", value: cb.DUE },
    { name: "Approved", value: cb.APPROVED }, { name: "Paid", value: cb.PAID },
  ];
  return (
    <AdminLayout>
      <div className="space-y-8" data-testid="admin-dashboard-root">
        <div>
          <div className="overline text-[#D4A93A]">Dreampick Admin</div>
          <h1 className="font-heading text-3xl mt-1">Business overview</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <S label="Total Customers" value={t.total_users} accent="gold-text" testId="stat-total-users" />
          <S label="Active" value={t.active_users} accent="text-[#F4D06F]" testId="stat-active-users" />
          <S label="Pending Activation" value={t.pending_activation} accent="text-yellow-300" testId="stat-pending-activation" />
          <S label="Activated Orders" value={t.activated_orders} accent="text-[#9D5CFF]" testId="stat-activated-orders" />
          <S label="Cashback Scheduled" value={formatINR(cb.SCHEDULED)} testId="stat-cb-scheduled" />
          <S label="Cashback Due" value={formatINR(cb.DUE)} accent="text-yellow-300" testId="stat-cb-due" />
          <S label="Cashback Approved" value={formatINR(cb.APPROVED)} accent="text-[#9D5CFF]" testId="stat-cb-approved" />
          <S label="Cashback Paid" value={formatINR(cb.PAID)} accent="gold-text" testId="stat-cb-paid" />
          <S label="Direct Commissions (paid)" value={formatINR(d.direct_referral_totals.PAID)} testId="stat-direct-paid" />
          <S label="Matching Income (paid)" value={formatINR(d.matching_income_totals.PAID)} testId="stat-matching-paid" />
          <S label="Pending Withdrawals" value={t.pending_withdrawals} accent="text-yellow-300" testId="stat-pending-withdrawals" />
          <S label="Unread Notifications" value={t.unread_notifications} testId="stat-unread-notif" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="dp-card p-6">
            <div className="overline text-[#D4A93A] mb-3">Cashback distribution</div>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={cbData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {cbData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1F1836", border: "1px solid rgba(212,169,58,0.3)", color: "white" }} formatter={(v) => formatINR(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="dp-card p-6">
            <div className="overline text-[#D4A93A] mb-3">Recent activations</div>
            <div className="space-y-2 max-h-64 overflow-auto">
              {d.recent_orders.map(o => (
                <div key={o._id} className="flex justify-between text-sm border-b border-white/5 pb-2">
                  <div><span className="font-mono text-xs">{o.order_number}</span><div className="text-xs text-white/50">{shortDate(o.created_at)}</div></div>
                  <div><span className="text-[#F4D06F]">{o.payment_status}</span> · {formatINR(o.amount)}</div>
                </div>
              ))}
              {d.recent_orders.length === 0 && <div className="text-white/40 text-sm">No orders yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
