import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users, GitBranch, ShoppingBag, DollarSign, Wallet,
  Settings, ScrollText, LogOut, Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, tid: "admin-nav-dashboard" },
  { to: "/admin/users", label: "Users", icon: Users, tid: "admin-nav-users" },
  { to: "/admin/tree", label: "Tree Explorer", icon: GitBranch, tid: "admin-nav-tree" },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag, tid: "admin-nav-orders" },
  { to: "/admin/commissions", label: "Commissions", icon: DollarSign, tid: "admin-nav-commissions" },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: Wallet, tid: "admin-nav-withdrawals" },
  { to: "/admin/settings", label: "Settings", icon: Settings, tid: "admin-nav-settings" },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText, tid: "admin-nav-audit" },
];

export function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#070B14] text-white flex">
      <aside className="w-64 shrink-0 border-r border-white/5 min-h-screen sticky top-0 hidden lg:flex flex-col">
        <div className="px-6 py-6 border-b border-white/5">
          <Link to="/" className="brand-logo text-2xl">
            Dream<span className="text-[#00E5FF]">Pick</span>
          </Link>
          <div className="mt-3 overline text-[#00E5FF]">Admin Console</div>
          <div className="mt-1 text-sm text-white/70 truncate">{user?.email}</div>
          <span className="mt-2 inline-block text-[10px] uppercase tracking-widest text-white/50">
            {user?.role}
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin"}
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
          <Button variant="ghost" onClick={() => navigate("/")} className="w-full justify-start text-white/60 hover:bg-white/5" data-testid="admin-nav-home">
            <Home className="w-4 h-4 mr-3" /> Home
          </Button>
          <Button variant="ghost" onClick={logout} className="w-full justify-start text-white/60 hover:bg-white/5" data-testid="admin-nav-logout">
            <LogOut className="w-4 h-4 mr-3" /> Log out
          </Button>
        </div>
      </aside>

      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-[#070B14]/90 backdrop-blur border-b border-white/5 px-4 py-3 flex justify-between items-center">
        <Link to="/" className="brand-logo text-xl">Dream<span className="text-[#00E5FF]">Pick</span></Link>
        <Button variant="ghost" size="sm" onClick={logout} data-testid="admin-mobile-logout"><LogOut className="w-4 h-4" /></Button>
      </div>

      <main className="flex-1 min-w-0 lg:pt-0 pt-14">
        <div className="lg:hidden overflow-x-auto border-b border-white/5">
          <div className="flex gap-1 px-3 py-2">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/admin"}
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
