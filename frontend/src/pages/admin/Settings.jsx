import React, { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function AdminSettings() {
  const [settings, setSettings] = useState({ scooter_price: 54999, commission_amount: 2700, demo_mode: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/settings");
        setSettings({
          scooter_price: data.settings.scooter_price ?? 54999,
          commission_amount: data.settings.commission_amount ?? 2700,
          demo_mode: data.settings.demo_mode ?? true,
        });
      } catch (e) { toast.error(formatApiError(e)); }
      finally { setLoading(false); }
    })();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.patch("/admin/settings", {
        scooter_price: parseFloat(settings.scooter_price),
        commission_amount: parseFloat(settings.commission_amount),
        demo_mode: !!settings.demo_mode,
      });
      toast.success("Settings updated");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  if (loading) return <AdminLayout><div className="text-white/40 animate-pulse">Loading…</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="max-w-xl space-y-6" data-testid="admin-settings-page">
        <div>
          <div className="overline text-[#00E5FF]">Settings</div>
          <h1 className="font-heading text-3xl mt-1">System Configuration</h1>
        </div>
        <form onSubmit={save} className="dp-card p-6 space-y-4">
          <div>
            <Label className="text-xs text-white/60">Scooter Price (₹)</Label>
            <Input type="number" value={settings.scooter_price} onChange={(e) => setSettings({ ...settings, scooter_price: e.target.value })}
              className="bg-[#070B14] border-white/10 h-11 mt-1" data-testid="settings-scooter-price" />
          </div>
          <div>
            <Label className="text-xs text-white/60">Commission Amount per Matched Pair (₹)</Label>
            <Input type="number" value={settings.commission_amount} onChange={(e) => setSettings({ ...settings, commission_amount: e.target.value })}
              className="bg-[#070B14] border-white/10 h-11 mt-1" data-testid="settings-commission-amount" />
          </div>
          <div className="flex items-center justify-between border-t border-white/5 pt-4">
            <div>
              <Label className="text-xs text-white/60">Demo Mode</Label>
              <div className="text-xs text-white/40 mt-1">Enables simulated payments</div>
            </div>
            <Switch checked={settings.demo_mode} onCheckedChange={(v) => setSettings({ ...settings, demo_mode: v })} data-testid="settings-demo-mode-switch" />
          </div>
          <Button className="btn-primary w-full" type="submit" data-testid="settings-save-btn">Save Settings</Button>
        </form>
      </div>
    </AdminLayout>
  );
}
