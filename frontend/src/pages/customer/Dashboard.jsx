import React, { useEffect, useState } from "react";
import { CustomerLayout } from "@/components/CustomerLayout";
import { api, formatINR, formatApiError, shortDate, API_BASE } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Copy, Share2, MessageCircle, Download, Sparkles, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const StatCard = ({ label, value, accent, testId, hint }) => (
  <div className="dp-card p-5" data-testid={testId}>
    <div className="overline text-white/50">{label}</div>
    <div className={`mt-2 font-heading text-2xl ${accent || "text-white"}`}>{value}</div>
    {hint && <div className="text-[10px] text-white/40 mt-1">{hint}</div>}
  </div>
);

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/customer/dashboard"); setD(data); }
      catch (e) { toast.error(formatApiError(e)); }
    })();
  }, []);

  const referralUrl = user?.referral_code ? `${window.location.origin}/register?ref=${user.referral_code}` : "";
  const copy = (txt, label = "Copied!") => { navigator.clipboard.writeText(txt); toast.success(label); };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Dreampick", text: "Join Dreampick with my referral code!", url: referralUrl }); }
      catch (_) {}
    } else { copy(referralUrl, "Referral link copied!"); }
  };
  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`Join Dreampick with my referral code!\n${referralUrl}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };
  const shareInsta = () => copy(referralUrl, "Referral link copied — paste in Instagram bio or DM");

  if (!d) return <CustomerLayout><div className="text-white/40 animate-pulse">Loading…</div></CustomerLayout>;

  const cb = d.cashback;
  const dr = d.direct_referral_totals;
  const mi = d.matching_income_totals;

  return (
    <CustomerLayout>
      <div className="space-y-8" data-testid="customer-dashboard-root">
        {/* Welcome + referral share */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="dp-card p-6 lg:col-span-2">
            <div className="overline text-[#D4A93A]">Welcome back</div>
            <div className="font-heading text-3xl mt-1">{d.user.full_name}</div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/60">
              <span className="font-mono">{d.user.user_code}</span>
              <span className={d.user.status === "ACTIVE" ? "text-[#F4D06F]" : "text-white/40"}>· {d.user.status}</span>
            </div>
            <div className="mt-4 dp-card-gold p-4 rounded-xl">
              <div className="overline text-[#D4A93A]">Your Referral Code</div>
              <div className="font-mono font-heading text-2xl mt-1 gold-text">{d.user.referral_code}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" className="btn-primary" onClick={() => copy(referralUrl, "Referral link copied!")} data-testid="copy-referral-link-btn"><Copy className="w-3 h-3 mr-2" /> Copy Link</Button>
                <Button size="sm" variant="ghost" className="btn-outline-dp" onClick={share} data-testid="share-btn"><Share2 className="w-3 h-3 mr-2" /> Share</Button>
                <Button size="sm" variant="ghost" className="btn-outline-dp" onClick={shareWhatsApp} data-testid="share-whatsapp-btn"><MessageCircle className="w-3 h-3 mr-2" /> WhatsApp</Button>
                <Button size="sm" variant="ghost" className="btn-outline-dp" onClick={shareInsta} data-testid="share-instagram-btn">Instagram</Button>
                <Button size="sm" variant="ghost" className="btn-outline-dp" onClick={() => window.open(`${API_BASE}/plans/pdf`, "_blank")} data-testid="download-plan-pdf-btn"><Download className="w-3 h-3 mr-2" /> Plan PDF</Button>
              </div>
            </div>
          </div>
          <div className="dp-card p-6">
            <div className="overline text-white/50">Order status</div>
            {d.order ? (
              <>
                <div className="font-heading text-lg mt-2">{d.order.order_number}</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className={d.order.payment_status === "ACTIVATED" ? "text-[#F4D06F]" : "text-yellow-300"}>{d.order.payment_status}</span>
                  <span className="text-xs text-white/50">{formatINR(d.order.amount)}</span>
                </div>
                {d.order.payment_status !== "ACTIVATED" && (
                  <div className="mt-3 text-xs text-white/60">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Your order is awaiting manual admin confirmation.
                  </div>
                )}
              </>
            ) : (
              <div className="mt-2 text-sm text-white/60">No plan order yet. <Link to="/plans" className="text-[#F4D06F]">View plans →</Link></div>
            )}
          </div>
        </div>

        {/* Tree counts */}
        <div>
          <div className="overline text-white/50 mb-3">Your Team</div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Left Team" value={d.counts.left_count} accent="text-[#9D5CFF]" testId="stat-left-count" />
            <StatCard label="Right Team" value={d.counts.right_count} accent="text-[#F4D06F]" testId="stat-right-count" />
            <StatCard label="Matched Pairs" value={d.counts.matched_pairs} testId="stat-matched-pairs" />
            <StatCard label="Unmatched L" value={d.counts.unmatched_left} testId="stat-unmatched-left" />
            <StatCard label="Unmatched R" value={d.counts.unmatched_right} testId="stat-unmatched-right" />
          </div>
        </div>

        {/* Cashback section */}
        <div className="dp-card p-6" data-testid="dashboard-cashback-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="overline text-[#D4A93A]">Buyer Cashback</div>
              <h2 className="font-heading text-2xl">Monthly ₹2,700 net · {cb.completed_installments}/{cb.total_installments} paid</h2>
            </div>
            <Link to="/dashboard/cashback"><Button size="sm" variant="ghost" className="btn-outline-dp">View schedule →</Button></Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Gross monthly" value={formatINR(3000)} testId="cb-gross-monthly" />
            <StatCard label="Admin deduction" value={formatINR(300)} testId="cb-deduction" />
            <StatCard label="Net monthly" value={formatINR(2700)} accent="gold-text" testId="cb-net-monthly" />
            <StatCard label="Next payout" value={cb.next_payout_date ? shortDate(cb.next_payout_date) : "—"} testId="cb-next" />
          </div>
          {cb.ended && (
            <div className="mt-4 dp-card-gold p-4 rounded-lg text-sm text-[#F4D06F]" data-testid="cb-ended-notice">
              <Sparkles className="w-4 h-4 inline mr-1" /> Cashback Completed — Cashback Ended After 10 Months.
            </div>
          )}
        </div>

        {/* Commission summaries */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="dp-card p-6" data-testid="dashboard-direct-card">
            <div className="overline text-[#D4A93A]">Direct Referral Commission</div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div><div className="text-white/50 text-xs">Pending</div><div className="font-heading text-lg text-yellow-300">{formatINR(dr.PENDING)}</div></div>
              <div><div className="text-white/50 text-xs">Approved</div><div className="font-heading text-lg text-[#9D5CFF]">{formatINR(dr.APPROVED)}</div></div>
              <div><div className="text-white/50 text-xs">Paid</div><div className="font-heading text-lg gold-text">{formatINR(dr.PAID)}</div></div>
            </div>
          </div>
          <div className="dp-card p-6" data-testid="dashboard-matching-card">
            <div className="overline text-[#D4A93A]">1:1 Matching Income</div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div><div className="text-white/50 text-xs">Pending</div><div className="font-heading text-lg text-yellow-300">{formatINR(mi.PENDING)}</div></div>
              <div><div className="text-white/50 text-xs">Approved</div><div className="font-heading text-lg text-[#9D5CFF]">{formatINR(mi.APPROVED)}</div></div>
              <div><div className="text-white/50 text-xs">Paid</div><div className="font-heading text-lg gold-text">{formatINR(mi.PAID)}</div></div>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
