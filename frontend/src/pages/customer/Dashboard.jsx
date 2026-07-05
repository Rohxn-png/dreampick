import React, { useEffect, useState } from "react";
import { CustomerLayout } from "@/components/CustomerLayout";
import { api, formatINR, formatApiError, shortDate } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Copy, ArrowRight, ShoppingBag, CheckCircle2, Clock, Ban } from "lucide-react";
import { Link } from "react-router-dom";
import { CheckoutModal } from "@/components/CheckoutModal";

const StatusBadge = ({ status }) => {
  const map = {
    ACTIVE: { c: "text-[#00FFA3] bg-[#00FFA3]/10", i: CheckCircle2 },
    PENDING: { c: "text-yellow-300 bg-yellow-300/10", i: Clock },
    BLOCKED: { c: "text-red-400 bg-red-400/10", i: Ban },
    PAID: { c: "text-[#00FFA3] bg-[#00FFA3]/10", i: CheckCircle2 },
    CREATED: { c: "text-yellow-300 bg-yellow-300/10", i: Clock },
    FAILED: { c: "text-red-400 bg-red-400/10", i: Ban },
    REFUNDED: { c: "text-white/60 bg-white/10", i: Ban },
    APPROVED: { c: "text-[#00E5FF] bg-[#00E5FF]/10", i: CheckCircle2 },
    REJECTED: { c: "text-red-400 bg-red-400/10", i: Ban },
    REVERSED: { c: "text-white/60 bg-white/10", i: Ban },
  };
  const { c = "text-white/60 bg-white/10", i: Icon = Clock } = map[status] || {};
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest ${c}`}>
      <Icon className="w-3 h-3" /> {status}
    </span>
  );
};

const StatCard = ({ label, value, accent, testId }) => (
  <div className="dp-card p-5" data-testid={testId}>
    <div className="overline text-white/50">{label}</div>
    <div className={`mt-2 font-heading text-3xl ${accent || "text-white"}`}>{value}</div>
  </div>
);

export default function CustomerDashboard() {
  const { user, refreshUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [checkoutOrder, setCheckoutOrder] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/customer/dashboard");
      setData(data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copyRef = () => {
    const link = `${window.location.origin}/register?ref=${user?.referral_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied!");
  };

  const startCheckout = async () => {
    setCreatingOrder(true);
    try {
      const { data } = await api.post("/orders/create", {});
      setCheckoutOrder(data.order);
      setCheckoutOpen(true);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setCreatingOrder(false);
    }
  };

  const onPaid = async () => {
    await refreshUser();
    await load();
  };

  if (loading || !data) {
    return (
      <CustomerLayout>
        <div className="text-white/50 animate-pulse">Loading dashboard…</div>
      </CustomerLayout>
    );
  }

  const c = data.counts;
  const cs = data.commissions_summary;

  return (
    <CustomerLayout>
      <div className="space-y-8" data-testid="customer-dashboard-root">
        {/* Welcome */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="dp-card p-6 lg:col-span-2 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="overline text-[#00E5FF]">Welcome back</div>
              <div className="font-heading text-3xl mt-1">{data.user.full_name}</div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/60">
                <span className="font-mono">{data.user.user_code}</span>
                <span>·</span>
                <span>Ref: <span className="font-mono text-white">{data.user.referral_code}</span></span>
                <StatusBadge status={data.user.status} />
              </div>
            </div>
            <Button className="btn-primary rounded-full" onClick={copyRef} data-testid="customer-copy-ref-btn">
              <Copy className="w-4 h-4 mr-2" /> Copy Referral Link
            </Button>
          </div>
          <div className="dp-card p-6">
            <div className="overline text-white/50">Order status</div>
            {data.order ? (
              <div className="mt-2">
                <div className="font-heading text-lg">{data.order.order_number}</div>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={data.order.payment_status} />
                  <span className="text-xs text-white/50">{formatINR(data.order.amount)}</span>
                </div>
                {data.order.payment_status === "CREATED" && (
                  <Button className="btn-primary mt-3 w-full" onClick={startCheckout} disabled={creatingOrder} data-testid="customer-complete-purchase-btn">
                    Complete Purchase <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                <p className="text-sm text-white/60">No order yet. Purchase to activate.</p>
                <Button className="btn-primary w-full" onClick={startCheckout} disabled={creatingOrder} data-testid="customer-buy-scooter-btn">
                  <ShoppingBag className="w-4 h-4 mr-2" /> Buy Scooter
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Team counts */}
        <div>
          <div className="overline text-white/50 mb-3">Team</div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Left Team" value={c.left_count} accent="text-[#00E5FF]" testId="stat-left-count" />
            <StatCard label="Right Team" value={c.right_count} accent="text-[#00FFA3]" testId="stat-right-count" />
            <StatCard label="Matched Pairs" value={c.matched_pairs} accent="text-[#00E5FF]" testId="stat-matched-pairs" />
            <StatCard label="Unmatched L" value={c.unmatched_left} testId="stat-unmatched-left" />
            <StatCard label="Unmatched R" value={c.unmatched_right} testId="stat-unmatched-right" />
          </div>
        </div>

        {/* Commissions summary */}
        <div>
          <div className="overline text-white/50 mb-3">Earnings</div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Available" value={formatINR(data.available_balance)} accent="text-[#00FFA3]" testId="stat-available" />
            <StatCard label="Pending" value={formatINR(cs.PENDING)} testId="stat-pending" />
            <StatCard label="Approved" value={formatINR(cs.APPROVED)} testId="stat-approved" />
            <StatCard label="Paid" value={formatINR(cs.PAID)} accent="text-[#00E5FF]" testId="stat-paid" />
            <StatCard label="Reversed" value={formatINR(cs.REVERSED)} testId="stat-reversed" />
          </div>
        </div>

        {/* Two column: recent commissions + referrals */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="dp-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="overline text-[#00E5FF]">Recent Commissions</div>
                <div className="text-white/50 text-xs mt-1">Latest 5</div>
              </div>
              <Link to="/dashboard/commissions" className="text-xs text-white/60 hover:text-white">View all →</Link>
            </div>
            <div className="space-y-2">
              {data.recent_commissions.length === 0 && <div className="text-sm text-white/40">No commissions yet.</div>}
              {data.recent_commissions.map((c) => (
                <div key={c._id} className="flex justify-between items-center py-2 border-b border-white/5 last:border-none text-sm">
                  <div>
                    <div className="font-mono text-xs text-white/50">#{c.matched_pair_number} pair</div>
                    <div className="text-white/70">{shortDate(c.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={c.status} />
                    <div className="font-heading text-[#00E5FF]">{formatINR(c.amount)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="dp-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="overline text-[#00E5FF]">Recent Referrals</div>
                <div className="text-white/50 text-xs mt-1">Direct referrals</div>
              </div>
              <Link to="/dashboard/referrals" className="text-xs text-white/60 hover:text-white">View all →</Link>
            </div>
            <div className="space-y-2">
              {data.recent_referrals.length === 0 && <div className="text-sm text-white/40">No referrals yet.</div>}
              {data.recent_referrals.map((r) => (
                <div key={r._id} className="flex justify-between items-center py-2 border-b border-white/5 last:border-none text-sm">
                  <div>
                    <div className="text-white/80">{r.full_name}</div>
                    <div className="text-white/50 font-mono text-xs">{r.user_code}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} order={checkoutOrder} onPaid={onPaid} />
    </CustomerLayout>
  );
}
