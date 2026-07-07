import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PublicNav } from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { CheckCircle2, XCircle, Zap } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
    referral_code: params.get("ref") || "",
    placement_side: "LEFT",
    terms: false,
  });
  const [refInfo, setRefInfo] = useState(null); // { valid, referrer }
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Validate referral code with debounce
  useEffect(() => {
    const code = form.referral_code.trim();
    if (!code) {
      setRefInfo(null);
      setPreview(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post("/referrals/validate", { referral_code: code });
        setRefInfo(data);
      } catch (e) {
        setRefInfo({ valid: false });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.referral_code]);

  // When code+side change, load placement preview
  useEffect(() => {
    if (!refInfo?.valid) { setPreview(null); return; }
    (async () => {
      try {
        const { data } = await api.post("/tree/preview-placement", {
          referral_code: form.referral_code.trim(),
          selected_side: form.placement_side,
        });
        setPreview(data);
      } catch (e) {
        setPreview(null);
      }
    })();
  }, [refInfo, form.placement_side, form.referral_code]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      toast.error("Passwords don't match");
      return;
    }
    if (!form.terms) {
      toast.error("Please accept the terms.");
      return;
    }
    if (form.referral_code && !refInfo?.valid) {
      toast.error("Invalid referral code.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        referral_code: form.referral_code.trim() || null,
        placement_side: form.referral_code.trim() ? form.placement_side : null,
      };
      await register(payload);
      toast.success("Account created. Submitting your activation request…");
      // Auto-create the activation order
      try { await api.post("/orders/create", {}); } catch (_) {}
      navigate("/dashboard");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      <PublicNav />
      <div className="hero-gradient min-h-[calc(100vh-64px)] py-10 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <Link to="/" className="brand-logo text-4xl inline-block">
              Dream<span className="text-[#00E5FF]">Pick</span>
            </Link>
            <div className="overline text-[#00E5FF] mt-3">Register</div>
            <p className="text-white/60 text-sm mt-2">Join the electric revolution. Activation requires scooter purchase.</p>
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            <form onSubmit={handleSubmit} className="lg:col-span-3 dp-card p-8 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/70 text-xs uppercase tracking-widest">Full Name</Label>
                  <Input required value={form.full_name} onChange={(e) => setField("full_name", e.target.value)}
                    className="mt-2 bg-[#070B14] border-white/10 h-11" data-testid="register-fullname-input" />
                </div>
                <div>
                  <Label className="text-white/70 text-xs uppercase tracking-widest">Phone</Label>
                  <Input required value={form.phone} onChange={(e) => setField("phone", e.target.value)}
                    className="mt-2 bg-[#070B14] border-white/10 h-11" placeholder="+91-9000000000" data-testid="register-phone-input" />
                </div>
              </div>
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-widest">Email</Label>
                <Input required type="email" value={form.email} onChange={(e) => setField("email", e.target.value)}
                  className="mt-2 bg-[#070B14] border-white/10 h-11" data-testid="register-email-input" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/70 text-xs uppercase tracking-widest">Password</Label>
                  <Input required type="password" value={form.password} onChange={(e) => setField("password", e.target.value)}
                    className="mt-2 bg-[#070B14] border-white/10 h-11" data-testid="register-password-input" minLength={6} />
                </div>
                <div>
                  <Label className="text-white/70 text-xs uppercase tracking-widest">Confirm Password</Label>
                  <Input required type="password" value={form.confirm_password} onChange={(e) => setField("confirm_password", e.target.value)}
                    className="mt-2 bg-[#070B14] border-white/10 h-11" data-testid="register-confirm-password-input" minLength={6} />
                </div>
              </div>

              <div className="border-t border-white/5 pt-4">
                <Label className="text-white/70 text-xs uppercase tracking-widest">Referral Code (optional)</Label>
                <Input value={form.referral_code} onChange={(e) => setField("referral_code", e.target.value.toUpperCase())}
                  className="mt-2 bg-[#070B14] border-white/10 h-11 font-mono" placeholder="AARA574212" data-testid="register-referral-input" />
                {form.referral_code && refInfo && (
                  <div className="mt-2 flex items-center gap-2 text-xs" data-testid="register-referral-status">
                    {refInfo.valid ? (
                      <><CheckCircle2 className="w-4 h-4 text-[#00FFA3]" /> <span className="text-[#00FFA3]">Valid — {refInfo.referrer.full_name} ({refInfo.referrer.user_code})</span></>
                    ) : (
                      <><XCircle className="w-4 h-4 text-red-400" /> <span className="text-red-400">Referral code not found</span></>
                    )}
                  </div>
                )}

                {refInfo?.valid && (
                  <div className="mt-4">
                    <Label className="text-white/70 text-xs uppercase tracking-widest">Placement Side</Label>
                    <RadioGroup value={form.placement_side} onValueChange={(v) => setField("placement_side", v)} className="grid grid-cols-2 gap-3 mt-2">
                      <label htmlFor="left" className={`dp-card p-4 cursor-pointer ${form.placement_side === "LEFT" ? "border-[#00E5FF]" : ""}`}>
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="LEFT" id="left" data-testid="register-side-left" />
                          <div>
                            <div className="font-heading">LEFT branch</div>
                            <div className="text-xs text-white/50 mt-1">
                              {refInfo.referrer.left_count} members
                              {refInfo.referrer.left_slot_empty ? " · direct slot empty" : " · direct occupied"}
                            </div>
                          </div>
                        </div>
                      </label>
                      <label htmlFor="right" className={`dp-card p-4 cursor-pointer ${form.placement_side === "RIGHT" ? "border-[#00E5FF]" : ""}`}>
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="RIGHT" id="right" data-testid="register-side-right" />
                          <div>
                            <div className="font-heading">RIGHT branch</div>
                            <div className="text-xs text-white/50 mt-1">
                              {refInfo.referrer.right_count} members
                              {refInfo.referrer.right_slot_empty ? " · direct slot empty" : " · direct occupied"}
                            </div>
                          </div>
                        </div>
                      </label>
                    </RadioGroup>
                    <div className="mt-2 text-xs text-white/50">
                      Suggested: <span className="text-[#00E5FF]">{refInfo.referrer.suggested_side}</span> · Balance diff: {refInfo.referrer.balance_diff}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 pt-2">
                <Checkbox id="terms" checked={form.terms} onCheckedChange={(v) => setField("terms", !!v)} data-testid="register-terms-checkbox" />
                <label htmlFor="terms" className="text-xs text-white/60 leading-relaxed">
                  I understand this is a demo application. No real payment or payout will occur. I agree to the terms & conditions.
                </label>
              </div>

              <Button className="btn-primary w-full h-11 mt-2" type="submit" disabled={loading} data-testid="register-submit-btn">
                {loading ? "Creating account…" : "Register"} <Zap className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-center text-sm text-white/50">
                Already have an account? <Link to="/login" className="text-[#00E5FF] hover:underline" data-testid="register-login-link">Sign in</Link>
              </p>
            </form>

            {/* Preview */}
            <aside className="lg:col-span-2 space-y-4">
              <div className="dp-card p-6" data-testid="register-preview-card">
                <div className="overline text-[#00E5FF] mb-3">Placement Preview</div>
                {!refInfo?.valid && (
                  <p className="text-sm text-white/50">Enter a valid referral code to see placement info. You can also register without a referral code.</p>
                )}
                {refInfo?.valid && preview && (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/60">Sponsor</span>
                      <span>{preview.referrer.full_name} ({preview.referrer.user_code})</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/60">L / R Counts</span>
                      <span className="font-mono">{preview.referrer.left_count} / {preview.referrer.right_count}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/60">Direct slot</span>
                      <span className={preview.direct_slot_empty ? "text-[#00FFA3]" : "text-white/80"}>
                        {preview.direct_slot_empty ? "Empty (direct)" : "Occupied — BFS below"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/60">Placement Parent</span>
                      <span className="font-mono">{preview.placement_preview.placement_parent_user_code}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/60">Placement Side</span>
                      <span className="text-[#00E5FF]">{preview.placement_preview.placement_side}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Expected Depth</span>
                      <span>Level {preview.placement_preview.expected_depth}</span>
                    </div>
                    <div className="text-[10px] text-white/40 pt-2 border-t border-white/5">
                      Preview only. Placement finalizes after successful (mock) payment.
                    </div>
                  </div>
                )}
              </div>
              <div className="dp-card p-6">
                <div className="overline text-[#F4D06F] mb-2">Ready to use</div>
                <p className="text-sm text-white/60">After registration, submit an activation request. Payment is confirmed manually by our team.</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
