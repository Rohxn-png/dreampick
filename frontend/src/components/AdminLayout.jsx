import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users, GitBranch, ShoppingBag, Coins, GitMerge, Wallet,
  Settings, ScrollText, LogOut, Home, Image, Bell, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, tid: "admin-nav-dashboard" },
  { to: "/admin/users", label: "Users", icon: Users, tid: "admin-nav-users" },
  { to: "/admin/tree", label: "Tree Explorer", icon: GitBranch, tid: "admin-nav-tree" },
  { to: "/admin/orders", label: "Orders / Activations", icon: ShoppingBag, tid: "admin-nav-orders" },
  { to: "/admin/cashback", label: "Buyer Cashback", icon: Coins, tid: "admin-nav-cashback" },
  { to: "/admin/direct-commissions", label: "Direct Commissions", icon: DollarSign, tid: "admin-nav-direct" },
  { to: "/admin/matching-income", label: "Matching Income", icon: GitMerge, tid: "admin-nav-matching" },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: Wallet, tid: "admin-nav-withdrawals" },
  { to: "/admin/media", label: "Media Manager", icon: Image, tid: "admin-nav-media" },
  { to: "/admin/notifications", label: "Notifications", icon: Bell, tid: "admin-nav-notif" },
  { to: "/admin/settings", label: "Settings", icon: Settings, tid: "admin-nav-settings" },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText, tid: "admin-nav-audit" },
];

export function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0F0A1F] text-white flex">
      <aside className="w-64 shrink-0 border-r border-[#D4A93A]/15 min-h-screen sticky top-0 hidden lg:flex flex-col">
        <div className="px-6 py-6 border-b border-[#D4A93A]/15">
          <Link to="/" className="flex items-center gap-2" data-testid="admin-sidebar-brand">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#7C3AED] to-[#D4A93A] flex items-center justify-center">
              <span className="text-white font-heading text-sm">D</span>
            </div>
            <div>
              <div className="brand-logo text-lg">Dreampick</div>
              <div className="text-[9px] uppercase tracking-widest text-[#D4A93A]">Admin Console</div>
            </div>
          </Link>
          <div className="mt-3 text-xs text-white/60 truncate">{user?.email}</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/admin"} data-testid={item.tid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? "bg-[#7C3AED]/20 text-[#F4D06F] border border-[#D4A93A]/30"
                           : "text-white/60 hover:text-white hover:bg-white/5"
                }`
              }>
              <item.icon className="w-4 h-4" /> {item.label}
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

      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-[#0F0A1F]/95 backdrop-blur border-b border-[#D4A93A]/15 px-4 py-3 flex justify-between items-center">
        <Link to="/" className="brand-logo text-xl">Dream<span className="gold-text">pick</span></Link>
        <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4" /></Button>
      </div>

      <main className="flex-1 min-w-0 lg:pt-0 pt-14">
        <div className="lg:hidden overflow-x-auto border-b border-[#D4A93A]/15">
          <div className="flex gap-1 px-3 py-2">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/admin"}
                className={({ isActive }) =>
                  `whitespace-nowrap px-3 py-1.5 rounded-md text-xs ${
                    isActive ? "bg-[#7C3AED]/20 text-[#F4D06F]" : "text-white/60"
                  }`
                }>
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
