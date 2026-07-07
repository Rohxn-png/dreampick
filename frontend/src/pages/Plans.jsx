import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PublicNav } from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { API_BASE, api, formatINR } from "@/lib/api";
import { CheckCircle2, Download, ArrowRight, Coins, Users, GitMerge } from "lucide-react";

export default function Plans() {
  const [plan, setPlan] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/plans");
        setPlan(data.plans?.[0] || null);
      } catch (_) {}
    })();
  }, []);

  const downloadPdf = () => {
    window.open(`${API_BASE}/plans/pdf`, "_blank");
  };

  if (!plan) return <div className="min-h-screen bg-[#0F0A1F] text-white"><PublicNav /><div className="p-10 text-white/50">Loading…</div></div>;

  const cb = plan.cashback || {};
  const dr = plan.direct_referral || {};
  const mi = plan.matching_income || {};

  return (
    <div className="min-h-screen bg-[#0F0A1F] text-white">
      <PublicNav />
      <section className="hero-gradient py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="overline text-[#D4A93A]">Plans</div>
          <h1 className="font-heading text-5xl mt-2">Basic EV Scooter Plan</h1>
          <div className="mt-4 flex flex-wrap gap-6 items-end">
            <div>
              <div className="overline text-white/50">Price</div>
              <div className="font-heading text-5xl gold-text mt-1">{formatINR(plan.price)}</div>
              <div className="text-xs text-white/50 mt-1">{plan.gst_note}</div>
            </div>
            <div className="flex gap-3">
              <Link to="/register"><Button className="btn-primary rounded-full px-6 py-6" data-testid="plans-register-btn">Register <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
              <Button className="btn-gold rounded-full px-6 py-6" onClick={downloadPdf} data-testid="plans-download-pdf-btn"><Download className="w-4 h-4 mr-2" /> Download PDF</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-3 gap-6">
          <div className="dp-card p-6" data-testid="plans-features">
            <div className="overline text-[#D4A93A]">EV Scooty Features</div>
            <ul className="mt-4 space-y-2 text-sm text-white/80">
              {(plan.features || []).map((f, i) => (
                <li key={i} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#F4D06F] mt-0.5 shrink-0" /> {f}</li>
              ))}
            </ul>
          </div>
          <div className="dp-card p-6 lg:col-span-2">
            <div className="overline text-[#D4A93A]">Terms and Conditions</div>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              {(plan.terms || []).map((t, i) => (
                <li key={i} className="flex gap-2"><span className="text-[#F4D06F]">•</span> {t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-6">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-3 gap-6">
          <div className="dp-card-gold p-6" data-testid="plans-cashback-card">
            <Coins className="w-8 h-8 text-[#F4D06F] mb-3" />
            <div className="overline text-[#D4A93A]">Buyer Cashback</div>
            <div className="font-heading text-2xl mt-1">Monthly for 10 months</div>
            <div className="mt-4 space-y-2 text-sm text-white/80">
              <div className="flex justify-between"><span>Gross monthly</span><span className="text-white">{formatINR(cb.gross_monthly || 3000)}</span></div>
              <div className="flex justify-between"><span>Admin ({cb.admin_charge_percent || 10}%)</span><span className="text-red-300">-{formatINR((cb.gross_monthly || 3000) * (cb.admin_charge_percent || 10) / 100)}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-2"><span>Net monthly</span><span className="gold-text font-heading">{formatINR((cb.gross_monthly || 3000) - (cb.gross_monthly || 3000) * (cb.admin_charge_percent || 10) / 100)}</span></div>
              <div className="flex justify-between pt-2"><span className="text-white/60">First payout</span><span>+{cb.first_payout_delay_days || 45} days</span></div>
              <div className="flex justify-between"><span className="text-white/60">Total months</span><span>{cb.months || 10}</span></div>
              <div className="flex justify-between text-xs text-white/50 pt-3 border-t border-white/10"><span>Total net (10 months)</span><span className="gold-text font-heading text-base">₹27,000.00</span></div>
            </div>
          </div>
          <div className="dp-card p-6" data-testid="plans-direct-card">
            <Users className="w-8 h-8 text-[#F4D06F] mb-3" />
            <div className="overline text-[#D4A93A]">Direct Referral Commission</div>
            <div className="font-heading text-2xl mt-1">Per successful referral</div>
            <div className="mt-4 space-y-2 text-sm text-white/80">
              <div className="flex justify-between"><span>Gross ({dr.gross_percent || 5}%)</span><span>₹2,750.00</span></div>
              <div className="flex justify-between"><span>Admin ({dr.admin_charge_percent || 10}%)</span><span className="text-red-300">-₹275.00</span></div>
              <div className="flex justify-between border-t border-white/10 pt-2"><span>Net</span><span className="gold-text font-heading">₹2,475.00</span></div>
            </div>
          </div>
          <div className="dp-card p-6" data-testid="plans-matching-card">
            <GitMerge className="w-8 h-8 text-[#F4D06F] mb-3" />
            <div className="overline text-[#D4A93A]">1:1 Matching Income</div>
            <div className="font-heading text-2xl mt-1">Per matched pair</div>
            <div className="mt-4 space-y-2 text-sm text-white/80">
              <div className="flex justify-between"><span>Gross ({mi.gross_percent || 2.5}%)</span><span>₹1,374.00</span></div>
              <div className="flex justify-between"><span>Admin ({mi.admin_charge_percent || 10}%)</span><span className="text-red-300">-₹137.40</span></div>
              <div className="flex justify-between border-t border-white/10 pt-2"><span>Net</span><span className="gold-text font-heading">₹1,236.60</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 text-center text-xs text-white/50">
          All amounts are subject to company terms and administrative deductions. Final eligibility and payout approval are subject to company policy and order verification.
          No automatic payouts — all disbursements are manual and audit-logged.
        </div>
      </section>
    </div>
  );
}
