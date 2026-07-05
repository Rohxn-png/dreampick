import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard } from "lucide-react";

export function PublicNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const goDashboard = () => {
    if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") navigate("/admin");
    else navigate("/dashboard");
  };

  return (
    <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#070B14]/70 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link to="/" className="brand-logo text-2xl text-white" data-testid="nav-brand-logo">
          Dream<span className="text-[#00E5FF]">Pick</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
          <Link to="/scooter" className="hover:text-white transition-colors" data-testid="nav-scooter-link">Scooter</Link>
          <a href="/#how" className="hover:text-white transition-colors" data-testid="nav-how-link">Referral Program</a>
          <a href="/#faq" className="hover:text-white transition-colors" data-testid="nav-faq-link">FAQ</a>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" className="text-white hover:bg-white/5" onClick={goDashboard} data-testid="nav-dashboard-btn">
                <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
              </Button>
              <Button variant="ghost" className="text-white/70 hover:bg-white/5" onClick={logout} data-testid="nav-logout-btn">
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" className="text-white hover:bg-white/5" data-testid="nav-login-btn">Login</Button>
              </Link>
              <Link to="/register">
                <Button className="btn-primary rounded-full px-5" data-testid="nav-register-btn">Register</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
