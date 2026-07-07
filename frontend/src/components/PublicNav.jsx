import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, Menu, X } from "lucide-react";
import { AnnouncementTicker } from "@/components/AnnouncementTicker";

export function PublicNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const goDashboard = () => {
    if (user?.role === "ADMIN") navigate("/admin");
    else navigate("/dashboard");
  };
  const links = [
    { to: "/", label: "Home", tid: "nav-home" },
    { to: "/plans", label: "Plans", tid: "nav-plans" },
    { to: "/about", label: "About Us", tid: "nav-about" },
    { to: "/gallery", label: "Gallery", tid: "nav-gallery" },
  ];
  return (
    <div className="sticky top-0 z-40">
      <nav className="backdrop-blur-xl bg-[#0F0A1F]/80 border-b border-[#D4A93A]/20">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo + brand */}
          <Link to="/" className="flex items-center gap-3" data-testid="nav-brand">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#D4A93A] flex items-center justify-center border border-[#D4A93A]/30" title="Logo placeholder — upload from admin portal">
              <span className="text-white font-heading font-semibold text-lg">D</span>
            </div>
            <div className="hidden sm:block">
              <div className="brand-logo text-sm text-[#F5F0FF] leading-tight">Dreampick</div>
              <div className="text-[10px] uppercase tracking-widest text-[#D4A93A] leading-tight">Private Limited</div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm text-white/70">
            {links.map(l => (
              <Link key={l.to} to={l.to} className="hover:text-[#F4D06F] transition-colors" data-testid={l.tid}>
                {l.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Button variant="ghost" className="text-white hover:bg-white/5" onClick={goDashboard} data-testid="nav-dashboard-btn">
                  <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
                </Button>
                <Button variant="ghost" size="icon" className="text-white/70 hover:bg-white/5" onClick={logout} data-testid="nav-logout-btn">
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" className="hidden sm:inline"><Button variant="ghost" className="text-white hover:bg-white/5" data-testid="nav-login-btn">Login</Button></Link>
                <Link to="/register"><Button className="btn-primary rounded-full px-5" data-testid="nav-register-btn">Register</Button></Link>
              </>
            )}
            <button className="md:hidden text-white" onClick={() => setOpen(!open)} data-testid="nav-mobile-toggle">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="md:hidden border-t border-white/5 px-4 py-3 space-y-2">
            {links.map(l => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block py-2 text-white/80">
                {l.label}
              </Link>
            ))}
            {!user && <Link to="/login" onClick={() => setOpen(false)} className="block py-2 text-white/80">Login</Link>}
          </div>
        )}
      </nav>
      <AnnouncementTicker />
    </div>
  );
}
