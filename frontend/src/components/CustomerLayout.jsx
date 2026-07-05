import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, GitBranch, Users, Wallet, DollarSign, User, LogOut, Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, tid: "customer-nav-dashboard" },
  { to: "/dashboard/tree", label: "My Tree", icon: GitBranch, tid: "customer-nav-tree" },
  { to: "/dashboard/referrals", label: "Referrals", icon: Users, tid: "customer-nav-referrals" },
  { to: "/dashboard/commissions", label: "Commissions", icon: DollarSign, tid: "customer-nav-commissions" },
  { to: "/dashboard/wallet", label: "Wallet", icon: Wallet, tid: "customer-nav-wallet" },
  { to: "/dashboard/profile", label: "Profile", icon: User, tid: "customer-nav-profile" },
];

export function CustomerLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#070B14] text-white flex">
      <aside className="w-64 shrink-0 border-r border-white/5 min-h-screen sticky top-0 hidden lg:flex flex-col">
        <div className="px-6 py-6 border-b border-white/5">
          <Link to="/" className="brand-logo text-2xl text-white" data-testid="customer-sidebar-brand">
            Dream<span className="text-[#00E5FF]">Pick</span>
          </Link>
          <div className="mt-3 text-xs text-white/50 font-mono">{user?.user_code}</div>
          <div className="mt-1 text-sm text-white truncate">{user?.full_name}</div>
          <span className="mt-2 inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#00FFA3]">
            <span className="w-1.5 h-1.5 bg-[#00FFA3] rounded-full"></span> {user?.status}
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              data-testid={item.tid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 pb-4 space-y-1">
          <Button variant="ghost" onClick={() => navigate("/")} className="w-full justify-start text-white/60 hover:text-white hover:bg-white/5" data-testid="customer-nav-home">
            <Home className="w-4 h-4 mr-3" /> Home
          </Button>
          <Button variant="ghost" onClick={logout} className="w-full justify-start text-white/60 hover:text-white hover:bg-white/5" data-testid="customer-nav-logout">
            <LogOut className="w-4 h-4 mr-3" /> Log out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-[#070B14]/90 backdrop-blur border-b border-white/5 px-4 py-3 flex justify-between items-center">
        <Link to="/" className="brand-logo text-xl">
          Dream<span className="text-[#00E5FF]">Pick</span>
        </Link>
        <Button variant="ghost" size="sm" onClick={logout} data-testid="customer-mobile-logout">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>

      <main className="flex-1 min-w-0 lg:pt-0 pt-14">
        {/* Mobile horizontal nav */}
        <div className="lg:hidden overflow-x-auto border-b border-white/5">
          <div className="flex gap-1 px-3 py-2">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/dashboard"}
                className={({ isActive }) =>
                  `whitespace-nowrap px-3 py-1.5 rounded-md text-xs ${
                    isActive ? "bg-[#00E5FF]/10 text-[#00E5FF]" : "text-white/60"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="p-6 lg:p-10">{children}</div>
      </main>
    </div>
  );
}
