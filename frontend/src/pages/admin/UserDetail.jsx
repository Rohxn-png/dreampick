import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError, formatINR, shortDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, EyeOff, Copy, ShieldAlert, KeyRound, ArrowLeft } from "lucide-react";

const REVEAL_REASONS = [
  "Monthly Cashback Payout",
  "Referral Commission Payout",
  "1:1 Matching Payout",
  "Withdrawal Payment",
  "Verification",
  "Other",
];

export default function AdminUserDetail() {
  const { user_id } = useParams();
  const [d, setD] = useState(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealBankId, setRevealBankId] = useState(null);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [revealed, setRevealed] = useState(null); // { bank_account_id, details }
  const [tempPw, setTempPw] = useState("");

  const load = async () => {
    try { const { data } = await api.get(`/admin/users/${user_id}`); setD(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [user_id]);

  const openReveal = (bankId) => {
    setRevealBankId(bankId);
    setReason(REVEAL_REASONS[0]);
    setCustomReason("");
    setRevealOpen(true);
  };

  const confirmReveal = async () => {
    const finalReason = reason === "Other" ? customReason.trim() : reason;
    if (!finalReason) { toast.error("Reason is required"); return; }
    try {
      const { data } = await api.post(`/admin/users/${user_id}/bank-details/reveal`, {
        bank_account_id: revealBankId, reason: finalReason,
      });
      setRevealed({ bank_account_id: revealBankId, details: data.bank_details, session_id: data.session_id });
      setRevealOpen(false);
      toast.success("Bank details revealed (audit-logged)");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const auditCopy = async (action, textToCopy) => {
    if (!revealed) return;
    if (textToCopy) navigator.clipboard.writeText(textToCopy);
    try {
      await api.post(`/admin/users/${user_id}/bank-details/audit-copy`, {
        bank_account_id: revealed.bank_account_id, action,
      });
      toast.success(`${action} logged`);
    } catch (_) {}
  };

  const hideBank = () => {
    auditCopy("HIDE_BANK_DETAILS", null);
    setRevealed(null);
  };

  const setTemporaryPassword = async () => {
    if (tempPw.length < 6) { toast.error("Password must be at least 6 chars"); return; }
    try {
      await api.post(`/admin/users/${user_id}/set-temp-password`, { temp_password: tempPw });
      toast.success("Temporary password set. User must change it on next login.");
      setTempPw("");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const sendReset = async () => {
    try {
      const { data } = await api.post(`/admin/users/${user_id}/send-password-reset`);
      toast.success("Reset link generated");
      if (data.reset_token) {
        navigator.clipboard.writeText(`${window.location.origin}/reset-password?token=${data.reset_token}`);
        toast.info("Reset URL copied to clipboard");
      }
    } catch (e) { toast.error(formatApiError(e)); }
  };

  if (!d) return <AdminLayout><div className="text-white/40 animate-pulse">Loading…</div></AdminLayout>;

  const u = d.user;

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-user-detail-page">
        <Link to="/admin/users" className="text-white/60 text-sm hover:text-white inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back to users</Link>

        {/* Profile */}
        <div className="dp-card p-6">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <div className="overline text-[#D4A93A]">Customer profile</div>
              <h1 className="font-heading text-3xl mt-1">{u.full_name}</h1>
              <div className="mt-2 text-sm text-white/60 space-x-3">
                <span className="font-mono">{u.user_code}</span>
                <span>· {u.email}</span>
                <span>· {u.phone || "—"}</span>
              </div>
              <div className="mt-2 flex gap-3 text-sm">
                <span className="text-white/60">Status:</span> <span className={u.status === "ACTIVE" ? "text-[#F4D06F]" : "text-yellow-300"}>{u.status}</span>
                <span className="text-white/60 ml-4">Referral:</span> <span className="font-mono text-[#F4D06F]">{u.referral_code}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bank Details for Manual Payment */}
        <div className="dp-card-gold p-6" data-testid="bank-details-card">
          <div className="flex items-start gap-3 mb-4">
            <ShieldAlert className="w-6 h-6 text-[#F4D06F] shrink-0 mt-1" />
            <div>
              <div className="overline text-[#D4A93A]">Bank Details for Manual Payment</div>
              <h2 className="font-heading text-2xl mt-1">Payout information</h2>
              <p className="text-xs text-white/60 mt-1">Details are masked by default. Every reveal, copy, and hide action is audit-logged with reason, admin ID, timestamp, and IP.</p>
            </div>
          </div>
          {d.bank_accounts_masked.length === 0 && <div className="text-white/50 text-sm">Customer has not added a bank account yet.</div>}
          {d.bank_accounts_masked.map((b) => {
            const isRevealed = revealed?.bank_account_id === b._id;
            const det = isRevealed ? revealed.details : null;
            return (
              <div key={b._id} className="mt-3 p-4 rounded-lg bg-[#0F0A1F]/60 border border-white/10 space-y-3" data-testid={`bank-account-${b._id.slice(0,8)}`}>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-white/50">Account holder:</span> <span className="ml-2">{isRevealed ? det.account_holder : b.account_holder}</span></div>
                  <div><span className="text-white/50">Bank:</span> <span className="ml-2">{b.bank_name}</span></div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50">Account number:</span>
                    <span className="font-mono ml-2">{isRevealed ? det.account_number : b.account_number}</span>
                    {isRevealed && <button onClick={() => auditCopy("COPY_ACCOUNT_NUMBER", det.account_number)} className="text-[#F4D06F] hover:text-white" data-testid="bank-copy-account"><Copy className="w-3 h-3" /></button>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50">IFSC:</span>
                    <span className="font-mono ml-2">{isRevealed ? det.ifsc : b.ifsc}</span>
                    {isRevealed && <button onClick={() => auditCopy("COPY_IFSC", det.ifsc)} className="text-[#F4D06F] hover:text-white" data-testid="bank-copy-ifsc"><Copy className="w-3 h-3" /></button>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50">UPI ID:</span>
                    <span className="font-mono ml-2">{isRevealed ? (det.upi_id || "—") : (b.upi_id || "—")}</span>
                    {isRevealed && det.upi_id && <button onClick={() => auditCopy("COPY_UPI_ID", det.upi_id)} className="text-[#F4D06F] hover:text-white" data-testid="bank-copy-upi"><Copy className="w-3 h-3" /></button>}
                  </div>
                  <div><span className="text-white/50">Verification:</span> <span className="ml-2">{b.verification_status}</span></div>
                  <div><span className="text-white/50">Last updated:</span> <span className="ml-2">{shortDate(b.updated_at)}</span></div>
                </div>
                <div className="flex gap-2 pt-2 border-t border-white/5">
                  {!isRevealed ? (
                    <Button size="sm" className="btn-primary" onClick={() => openReveal(b._id)} data-testid={`reveal-bank-${b._id.slice(0,8)}`}>
                      <Eye className="w-3 h-3 mr-2" /> Reveal Full Bank Details
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="btn-outline-dp" onClick={hideBank} data-testid={`hide-bank-${b._id.slice(0,8)}`}>
                      <EyeOff className="w-3 h-3 mr-2" /> Hide
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Password management (no display of passwords) */}
        <div className="dp-card p-6" data-testid="password-management-card">
          <div className="overline text-[#D4A93A]">Password Management</div>
          <div className="text-xs text-white/50 mt-1">Passwords are never displayed. Set a temporary password (user must change it at next login) or send a reset link.</div>
          <div className="mt-4 grid md:grid-cols-2 gap-3">
            <div className="flex gap-2">
              <Input type="text" placeholder="Temporary password" value={tempPw} onChange={(e) => setTempPw(e.target.value)} className="bg-[#0F0A1F] border-white/10 h-10" data-testid="temp-password-input" />
              <Button className="btn-primary" onClick={setTemporaryPassword} data-testid="set-temp-password-btn">Set Temp</Button>
            </div>
            <Button variant="ghost" className="btn-outline-dp" onClick={sendReset} data-testid="send-reset-btn"><KeyRound className="w-4 h-4 mr-2" /> Generate Password-Reset Link</Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="dp-card p-4"><div className="overline text-white/50">Orders</div><div className="mt-2 text-2xl font-heading">{d.orders.length}</div></div>
          <div className="dp-card p-4"><div className="overline text-white/50">Cashback Installments</div><div className="mt-2 text-2xl font-heading">{d.cashback_schedule.length}</div></div>
          <div className="dp-card p-4"><div className="overline text-white/50">Commissions</div><div className="mt-2 text-2xl font-heading">{d.commissions.length}</div></div>
        </div>
        {d.commissions.length > 0 && (
          <div className="dp-card p-6">
            <div className="overline text-[#D4A93A] mb-3">Commission history</div>
            <div className="space-y-2 max-h-64 overflow-auto">
              {d.commissions.map(c => (
                <div key={c._id} className="flex justify-between text-sm border-b border-white/5 pb-2">
                  <div><span className="text-white/50">{c.commission_type}</span> · {shortDate(c.created_at)}</div>
                  <div><span className="gold-text">{formatINR(c.net_amount)}</span> · <span className="text-white/60">{c.status}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reveal confirmation modal */}
      <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
        <DialogContent className="bg-[#1F1836] border-[#D4A93A]/30 text-white max-w-md" data-testid="reveal-confirm-modal">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl gold-text">Confirm reveal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-white/70">
              You are about to reveal full bank details of this customer for manual payout processing. This action is audit-logged with your admin ID, IP, timestamp, and reason.
            </p>
            <div>
              <Label className="text-xs text-white/70 uppercase tracking-widest">Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="bg-[#0F0A1F] border-white/10 mt-2" data-testid="reveal-reason-select"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1F1836] border-white/10 text-white">
                  {REVEAL_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {reason === "Other" && (
              <Input value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Specify reason…" className="bg-[#0F0A1F] border-white/10" data-testid="reveal-custom-reason" />
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" className="btn-outline-dp" onClick={() => setRevealOpen(false)}>Cancel</Button>
            <Button className="btn-primary" onClick={confirmReveal} data-testid="reveal-confirm-btn">Confirm & Reveal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
