import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PublicNav } from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api";
import { Zap } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success("Welcome back!");
      const dest = location.state?.from ||
        (user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard");
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (kind) => {
    if (kind === "admin") { setEmail("admin@dreampick.demo"); setPassword("Demo@123"); }
    else if (kind === "superadmin") { setEmail("superadmin@dreampick.demo"); setPassword("Demo@123"); }
    else { setEmail("customer1@dreampick.demo"); setPassword("Demo@123"); }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      <PublicNav />
      <div className="hero-gradient min-h-[calc(100vh-64px)] flex items-center px-6 py-10">
        <div className="max-w-md w-full mx-auto">
          <div className="text-center mb-8">
            <Link to="/" className="brand-logo text-4xl inline-block">
              Dream<span className="text-[#00E5FF]">Pick</span>
            </Link>
            <div className="overline text-[#00E5FF] mt-3">Sign in</div>
            <p className="text-white/60 text-sm mt-2">Welcome back. Login to your account.</p>
          </div>
          <div className="dp-card p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-widest">Email</Label>
                <Input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@dreampick.demo"
                  className="mt-2 bg-[#070B14] border-white/10 text-white h-11"
                  data-testid="login-email-input"
                />
              </div>
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-widest">Password</Label>
                <Input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-2 bg-[#070B14] border-white/10 text-white h-11"
                  data-testid="login-password-input"
                />
              </div>
              <Button className="btn-primary w-full h-11 rounded-lg text-base" type="submit" disabled={loading} data-testid="login-submit-btn">
                {loading ? "Signing in…" : "Sign in"} <Zap className="w-4 h-4 ml-2" />
              </Button>
            </form>
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="text-xs text-white/50 mb-3">Try a demo account:</div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="ghost" size="sm" className="btn-outline-dp text-xs" onClick={() => fillDemo("customer")} data-testid="login-demo-customer-btn">Customer</Button>
                <Button variant="ghost" size="sm" className="btn-outline-dp text-xs" onClick={() => fillDemo("admin")} data-testid="login-demo-admin-btn">Admin</Button>
                <Button variant="ghost" size="sm" className="btn-outline-dp text-xs" onClick={() => fillDemo("superadmin")} data-testid="login-demo-superadmin-btn">Super Admin</Button>
              </div>
            </div>
            <p className="mt-6 text-center text-sm text-white/50">
              New here?{" "}
              <Link to="/register" className="text-[#00E5FF] hover:underline" data-testid="login-register-link">Create an account</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
