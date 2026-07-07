import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PublicNav } from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success("Welcome back");
      const dest = loc.state?.from || (user.role === "ADMIN" ? "/admin" : "/dashboard");
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0F0A1F] text-white">
      <PublicNav />
      <div className="hero-gradient min-h-[calc(100vh-64px-40px)] flex items-center px-6 py-10">
        <div className="max-w-md w-full mx-auto">
          <div className="text-center mb-8">
            <div className="brand-logo text-4xl">Dream<span className="gold-text">pick</span></div>
            <div className="overline text-[#D4A93A] mt-3">Sign in</div>
            <p className="text-white/60 text-sm mt-2">Welcome back. Log in to your account.</p>
          </div>
          <div className="dp-card p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-widest">Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 bg-[#0F0A1F] border-white/10 h-11" data-testid="login-email-input" />
              </div>
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-widest">Password</Label>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                    className="mt-2 bg-[#0F0A1F] border-white/10 h-11 pr-10" data-testid="login-password-input" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/4 text-white/50" data-testid="login-password-toggle">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="mt-2 text-right">
                  <Link to="/forgot-password" className="text-xs text-[#F4D06F] hover:underline" data-testid="login-forgot-link">Forgot password?</Link>
                </div>
              </div>
              <Button type="submit" disabled={loading} className="btn-primary w-full h-11" data-testid="login-submit-btn">
                {loading ? "Signing in…" : "Sign in"} <LogIn className="w-4 h-4 ml-2" />
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-white/50">
              New here? <Link to="/register" className="text-[#F4D06F] hover:underline" data-testid="login-register-link">Create an account</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
