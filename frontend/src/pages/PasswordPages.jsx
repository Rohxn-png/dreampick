import React, { useState } from "react";
import { Link } from "react-router-dom";
import { PublicNav } from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(null);
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setSent(data);
      toast.success("If the email exists, a reset link has been generated.");
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen bg-[#0F0A1F] text-white">
      <PublicNav />
      <div className="hero-gradient min-h-[80vh] flex items-center px-6 py-10">
        <div className="max-w-md w-full mx-auto dp-card p-8">
          <div className="overline text-[#D4A93A]">Forgot Password</div>
          <h1 className="font-heading text-3xl mt-2 mb-4">Reset your password</h1>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-white/70 text-xs uppercase tracking-widest">Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-2 bg-[#0F0A1F] border-white/10 h-11" data-testid="forgot-email-input" />
            </div>
            <Button type="submit" disabled={loading} className="btn-primary w-full h-11" data-testid="forgot-submit-btn">
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
          {sent?.reset_token && (
            <div className="mt-6 dp-card-gold p-4 text-xs text-white/80" data-testid="forgot-token-display">
              <div className="overline text-[#D4A93A] mb-2">Reset token (demo)</div>
              <div className="font-mono break-all">{sent.reset_token}</div>
              <div className="mt-3 text-white/60">In production this token is emailed. Use it on the reset page.</div>
              <Link to={`/reset-password?token=${sent.reset_token}`} className="text-[#F4D06F] hover:underline inline-block mt-2">Open reset page →</Link>
            </div>
          )}
          <p className="mt-6 text-center text-sm text-white/50">
            Remembered it? <Link to="/login" className="text-[#F4D06F] hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function ResetPassword() {
  const params = new URLSearchParams(window.location.search);
  const [token, setToken] = useState(params.get("token") || "");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (pw !== confirm) { toast.error("Passwords don't match"); return; }
    try {
      await api.post("/auth/reset-password", { token, new_password: pw });
      setDone(true);
      toast.success("Password reset. Please sign in.");
    } catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="min-h-screen bg-[#0F0A1F] text-white">
      <PublicNav />
      <div className="hero-gradient min-h-[80vh] flex items-center px-6 py-10">
        <div className="max-w-md w-full mx-auto dp-card p-8">
          <div className="overline text-[#D4A93A]">Reset Password</div>
          <h1 className="font-heading text-3xl mt-2 mb-4">Set a new password</h1>
          {!done ? (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label className="text-xs text-white/70 uppercase tracking-widest">Reset Token</Label>
                <Input required value={token} onChange={(e) => setToken(e.target.value)} className="bg-[#0F0A1F] border-white/10 h-11 mt-2 font-mono text-xs" data-testid="reset-token-input" />
              </div>
              <div>
                <Label className="text-xs text-white/70 uppercase tracking-widest">New Password</Label>
                <Input required type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} className="bg-[#0F0A1F] border-white/10 h-11 mt-2" data-testid="reset-password-input" />
              </div>
              <div>
                <Label className="text-xs text-white/70 uppercase tracking-widest">Confirm Password</Label>
                <Input required type="password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="bg-[#0F0A1F] border-white/10 h-11 mt-2" data-testid="reset-confirm-input" />
              </div>
              <Button type="submit" className="btn-primary w-full h-11" data-testid="reset-submit-btn">Reset password</Button>
            </form>
          ) : (
            <div className="text-center py-6" data-testid="reset-success">
              <div className="text-[#F4D06F] font-heading text-2xl">Password reset!</div>
              <Link to="/login"><Button className="btn-primary mt-4">Go to Login</Button></Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
