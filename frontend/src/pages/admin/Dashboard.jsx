import React, { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError, formatINR, shortDate } from "@/lib/api";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const StatCard = ({ label, value, accent, testId }) => (
  <div className="dp-card p-5" data-testid={testId}>
    <div className="overline text-white/50">{label}</div>
    <div className={`mt-2 font-heading text-3xl ${accent || "text-white"}`}>{value}</div>
  </div>
);

const COLORS = ["#00E5FF", "#00FFA3", "#FFB800", "#FF3B30", "#94A3B8"];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/dashboard");
        setData(data);
      } catch (e) { toast.error(formatApiError(e)); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading || !data) return <AdminLayout><div className="text-white/40 animate-pulse">Loading…</div></AdminLayout>;

  const t = data.totals;
  const cs = data.commissions_summary;
  const cc = data.commissions_counts;

  const pieData = Object.entries(cc).map(([k, v]) => ({ name: k, value: v }));
  const barData = [
    { name: "Users", Total: t.total_users, Active: t.active_users, Pending: t.pending_users },
    { name: "Orders", Total: t.total_orders, Paid: t.paid_orders, Failed: t.failed_orders },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8" data-testid="admin-dashboard-root">
        <div>
          <div className="overline text-[#00E5FF]">Admin Console</div>
          <h1 className="font-heading text-3xl mt-1">Dream Pick — Overview</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={t.total_users} accent="text-[#00E5FF]" testId="admin-stat-total-users" />
          <StatCard label="Active Users" value={t.active_users} accent="text-[#00FFA3]" testId="admin-stat-active-users" />
          <StatCard label="Pending Users" value={t.pending_users} accent="text-yellow-300" testId="admin-stat-pending-users" />
          <StatCard label="Paid Orders" value={t.paid_orders} accent="text-[#00E5FF]" testId="admin-stat-paid-orders" />
          <StatCard label="Failed Orders" value={t.failed_orders} testId="admin-stat-failed-orders" />
          <StatCard label="Refunded" value={t.refunded_orders} testId="admin-stat-refunded" />
          <StatCard label="Sales Total" value={formatINR(t.sales_total)} accent="text-[#00E5FF]" testId="admin-stat-sales" />
          <StatCard label="Pending Withdrawals" value={t.pending_withdrawals} accent="text-yellow-300" testId="admin-stat-pending-withdrawals" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="dp-card p-6 lg:col-span-2">
            <div className="overline text-[#00E5FF] mb-3">Commissions by Status</div>
            <div className="grid grid-cols-5 gap-3">
              {Object.entries(cs).map(([k, v]) => (
                <div key={k} data-testid={`admin-comm-total-${k}`}>
                  <div className="overline text-white/50">{k}</div>
                  <div className="font-heading text-xl mt-1">{formatINR(v)}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 h-72">
              <ResponsiveContainer>
                <BarChart data={barData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94A3B8" />
                  <YAxis stroke="#94A3B8" />
                  <Tooltip contentStyle={{ background: "#0C1222", border: "1px solid rgba(255,255,255,0.1)", color: "white" }} />
                  <Bar dataKey="Total" fill="#00E5FF" />
                  <Bar dataKey="Active" fill="#00FFA3" />
                  <Bar dataKey="Pending" fill="#FFB800" />
                  <Bar dataKey="Paid" fill="#00FFA3" />
                  <Bar dataKey="Failed" fill="#FF3B30" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="dp-card p-6">
            <div className="overline text-[#00E5FF] mb-3">Commission Status Distribution</div>
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0C1222", border: "1px solid rgba(255,255,255,0.1)", color: "white" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 justify-center text-[10px] text-white/60 mt-2">
              {pieData.map((p, i) => (
                <div key={p.name} className="flex items-center gap-1">
                  <span className="w-2 h-2" style={{ background: COLORS[i % COLORS.length] }}></span>
                  {p.name}: {p.value}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="dp-card p-6">
            <div className="overline text-[#00E5FF] mb-3">Recent Users</div>
            {data.recent_users.map((u) => (
              <div key={u._id} className="flex justify-between border-b border-white/5 py-2 text-sm">
                <div><div>{u.full_name}</div><div className="text-white/50 font-mono text-xs">{u.user_code}</div></div>
                <div className="text-white/70">{shortDate(u.created_at)}</div>
              </div>
            ))}
          </div>
          <div className="dp-card p-6">
            <div className="overline text-[#00E5FF] mb-3">Recent Orders</div>
            {data.recent_orders.map((o) => (
              <div key={o._id} className="flex justify-between border-b border-white/5 py-2 text-sm">
                <div><div className="font-mono text-xs">{o.order_number}</div><div className="text-white/50 text-xs">{shortDate(o.created_at)}</div></div>
                <div className="text-white/70"><span className="text-[#00E5FF]">{o.payment_status}</span> · {formatINR(o.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
