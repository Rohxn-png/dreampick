import React, { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError, formatINR } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

function ConfigSection({ title, config, onChange, testId, extra }) {
  if (!config) return null;
  const gross = parseFloat(config.gross_percent ?? config.gross_monthly ?? 0);
  const price = parseFloat(config.plan_price || 54999);
  const adminPct = parseFloat(config.admin_charge_percent || 0);
  const grossAmt = config.gross_monthly ? gross : (price * gross / 100);
  const dedAmt = grossAmt * adminPct / 100;
  const netAmt = grossAmt - dedAmt;
  return (
    <div className="dp-card p-6 space-y-3" data-testid={testId}>
      <div className="flex justify-between items-start">
        <div>
          <div className="overline text-[#D4A93A]">{title}</div>
          <h3 className="font-heading text-xl mt-1">Configuration</h3>
        </div>
        <Switch checked={config.status === "active"} onCheckedChange={(v) => onChange({ ...config, status: v ? "active" : "inactive" })} data-testid={`${testId}-status-switch`} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div><Label className="text-xs text-white/70">Plan price</Label><Input type="number" value={config.plan_price ?? 54999} onChange={(e) => onChange({ ...config, plan_price: parseFloat(e.target.value) })} className="bg-[#0F0A1F] border-white/10 mt-1" /></div>
        {config.gross_monthly !== undefined ? (
          <div><Label className="text-xs text-white/70">Gross monthly (₹)</Label><Input type="number" value={config.gross_monthly} onChange={(e) => onChange({ ...config, gross_monthly: parseFloat(e.target.value) })} className="bg-[#0F0A1F] border-white/10 mt-1" /></div>
        ) : (
          <div><Label className="text-xs text-white/70">Gross percent (%)</Label><Input type="number" step="0.01" value={config.gross_percent} onChange={(e) => onChange({ ...config, gross_percent: parseFloat(e.target.value) })} className="bg-[#0F0A1F] border-white/10 mt-1" /></div>
        )}
        <div><Label className="text-xs text-white/70">Admin charge (%)</Label><Input type="number" step="0.01" value={config.admin_charge_percent} onChange={(e) => onChange({ ...config, admin_charge_percent: parseFloat(e.target.value) })} className="bg-[#0F0A1F] border-white/10 mt-1" /></div>
        {config.months !== undefined && <div><Label className="text-xs text-white/70">Total months</Label><Input type="number" value={config.months} onChange={(e) => onChange({ ...config, months: parseInt(e.target.value) })} className="bg-[#0F0A1F] border-white/10 mt-1" /></div>}
        {config.first_payout_delay_days !== undefined && <div><Label className="text-xs text-white/70">First payout delay (days)</Label><Input type="number" value={config.first_payout_delay_days} onChange={(e) => onChange({ ...config, first_payout_delay_days: parseInt(e.target.value) })} className="bg-[#0F0A1F] border-white/10 mt-1" /></div>}
        <div>
          <Label className="text-xs text-white/70">Rounding</Label>
          <Select value={config.rounding_mode || "two_decimals"} onValueChange={(v) => onChange({ ...config, rounding_mode: v })}>
            <SelectTrigger className="bg-[#0F0A1F] border-white/10 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#1F1836] border-white/10 text-white">
              <SelectItem value="two_decimals">Two decimals (default)</SelectItem>
              <SelectItem value="round_down">Round down</SelectItem>
              <SelectItem value="round_up">Round up</SelectItem>
              <SelectItem value="nearest_rupee">Nearest rupee</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/5 text-sm">
        <div><div className="text-white/50 text-xs">Gross</div><div className="font-heading mt-1">{formatINR(grossAmt)}</div></div>
        <div><div className="text-white/50 text-xs">Deduction</div><div className="font-heading mt-1 text-red-300">-{formatINR(dedAmt)}</div></div>
        <div><div className="text-white/50 text-xs">Net</div><div className="font-heading mt-1 gold-text">{formatINR(netAmt)}</div></div>
      </div>
      {extra}
    </div>
  );
}

export default function AdminSettings() {
  const [s, setS] = useState(null);
  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/admin/settings"); setS(data.settings); }
      catch (e) { toast.error(formatApiError(e)); }
    })();
  }, []);
  const save = async (patch) => {
    try { await api.patch("/admin/settings", patch); toast.success("Settings saved"); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  if (!s) return <AdminLayout><div className="text-white/40 animate-pulse">Loading…</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-settings-page">
        <div>
          <div className="overline text-[#D4A93A]">Settings</div>
          <h1 className="font-heading text-3xl mt-1">Commission configurations</h1>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div><Label className="text-xs text-white/70">Company Name</Label><Input value={s.company_name || ""} onChange={(e) => setS({ ...s, company_name: e.target.value })} className="bg-[#0F0A1F] border-white/10 mt-1" /></div>
          <div><Label className="text-xs text-white/70">GST Number</Label><Input value={s.gst_number || ""} onChange={(e) => setS({ ...s, gst_number: e.target.value })} className="bg-[#0F0A1F] border-white/10 mt-1 font-mono" /></div>
        </div>
        <div className="flex justify-end">
          <Button className="btn-gold" onClick={() => save({ company_name: s.company_name, gst_number: s.gst_number, plan_price: s.plan_price })} data-testid="settings-save-brand-btn">Save Brand</Button>
        </div>

        <ConfigSection title="Buyer Cashback" testId="cashback-config" config={s.cashback_config} onChange={(v) => setS({ ...s, cashback_config: v })}
          extra={<div className="flex justify-end pt-2"><Button size="sm" className="btn-primary" onClick={() => save({ cashback_config: s.cashback_config })} data-testid="save-cashback-btn">Save Cashback Config</Button></div>} />

        <ConfigSection title="Direct Referral Commission" testId="direct-config" config={s.direct_referral_config} onChange={(v) => setS({ ...s, direct_referral_config: v })}
          extra={<div className="flex justify-end pt-2"><Button size="sm" className="btn-primary" onClick={() => save({ direct_referral_config: s.direct_referral_config })} data-testid="save-direct-btn">Save Direct Config</Button></div>} />

        <ConfigSection title="1:1 Matching Income" testId="matching-config" config={s.matching_config} onChange={(v) => setS({ ...s, matching_config: v })}
          extra={<div className="flex justify-end pt-2"><Button size="sm" className="btn-primary" onClick={() => save({ matching_config: s.matching_config })} data-testid="save-matching-btn">Save Matching Config</Button></div>} />
      </div>
    </AdminLayout>
  );
}
