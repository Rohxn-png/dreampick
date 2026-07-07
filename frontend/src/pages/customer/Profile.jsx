import React, { useState } from "react";
import { CustomerLayout } from "@/components/CustomerLayout";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError, shortDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function CustomerProfile() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    phone: user?.phone || "",
    password: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {};
      if (form.full_name && form.full_name !== user.full_name) payload.full_name = form.full_name;
      if (form.phone && form.phone !== user.phone) payload.phone = form.phone;
      if (form.password) payload.password = form.password;
      if (Object.keys(payload).length === 0) {
        toast.info("Nothing to update");
        return;
      }
      await api.patch("/customer/profile", payload);
      await refreshUser();
      setForm({ ...form, password: "" });
      toast.success("Profile updated");
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <CustomerLayout>
      <div className="max-w-2xl space-y-6" data-testid="customer-profile-page">
        <div>
          <div className="overline text-[#F4D06F]">Profile</div>
          <h1 className="font-heading text-3xl mt-1">Account Settings</h1>
        </div>

        <div className="dp-card p-6 space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-white/60">User Code</span><span className="font-mono">{user?.user_code}</span></div>
          <div className="flex justify-between"><span className="text-white/60">Email</span><span>{user?.email}</span></div>
          <div className="flex justify-between"><span className="text-white/60">Referral Code</span><span className="font-mono text-[#F4D06F]">{user?.referral_code}</span></div>
          <div className="flex justify-between"><span className="text-white/60">Status</span><span className="text-[#F4D06F]">{user?.status}</span></div>
          <div className="flex justify-between"><span className="text-white/60">Created</span><span>{shortDate(user?.created_at)}</span></div>
        </div>

        <form onSubmit={submit} className="dp-card p-6 space-y-4">
          <div>
            <Label className="text-xs text-white/60">Full Name</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="bg-[#0F0A1F] border-white/10 h-11 mt-1" data-testid="profile-fullname-input" />
          </div>
          <div>
            <Label className="text-xs text-white/60">Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="bg-[#0F0A1F] border-white/10 h-11 mt-1" data-testid="profile-phone-input" />
          </div>
          <div>
            <Label className="text-xs text-white/60">New Password (optional)</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="bg-[#0F0A1F] border-white/10 h-11 mt-1" placeholder="Leave blank to keep current" data-testid="profile-password-input" />
          </div>
          <Button type="submit" className="btn-primary w-full" disabled={saving} data-testid="profile-save-btn">
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </form>
      </div>
    </CustomerLayout>
  );
}
