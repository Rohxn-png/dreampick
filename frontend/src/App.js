import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Home from "@/pages/Home";
import ScooterDetails from "@/pages/ScooterDetails";
import Register from "@/pages/Register";
import Login from "@/pages/Login";

import CustomerDashboard from "@/pages/customer/Dashboard";
import CustomerTree from "@/pages/customer/Tree";
import CustomerReferrals from "@/pages/customer/Referrals";
import CustomerCommissions from "@/pages/customer/Commissions";
import CustomerWallet from "@/pages/customer/Wallet";
import CustomerProfile from "@/pages/customer/Profile";

import AdminDashboard from "@/pages/admin/Dashboard";
import AdminUsers from "@/pages/admin/Users";
import AdminTree from "@/pages/admin/Tree";
import AdminOrders from "@/pages/admin/Orders";
import AdminCommissions from "@/pages/admin/Commissions";
import AdminWithdrawals from "@/pages/admin/Withdrawals";
import AdminSettings from "@/pages/admin/Settings";
import AdminAuditLogs from "@/pages/admin/AuditLogs";

import "@/App.css";

function App() {
  return (
    <div className="App min-h-screen">
      <BrowserRouter>
        <AuthProvider>
          <Toaster theme="dark" position="top-right" toastOptions={{
            style: { background: "#0C1222", color: "#fff", border: "1px solid rgba(255,255,255,0.08)" },
          }} />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/scooter" element={<ScooterDetails />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />

            {/* Customer */}
            <Route path="/dashboard" element={<ProtectedRoute roles={["CUSTOMER", "ADMIN", "SUPER_ADMIN"]}><CustomerDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/tree" element={<ProtectedRoute roles={["CUSTOMER", "ADMIN", "SUPER_ADMIN"]}><CustomerTree /></ProtectedRoute>} />
            <Route path="/dashboard/referrals" element={<ProtectedRoute roles={["CUSTOMER", "ADMIN", "SUPER_ADMIN"]}><CustomerReferrals /></ProtectedRoute>} />
            <Route path="/dashboard/commissions" element={<ProtectedRoute roles={["CUSTOMER", "ADMIN", "SUPER_ADMIN"]}><CustomerCommissions /></ProtectedRoute>} />
            <Route path="/dashboard/wallet" element={<ProtectedRoute roles={["CUSTOMER", "ADMIN", "SUPER_ADMIN"]}><CustomerWallet /></ProtectedRoute>} />
            <Route path="/dashboard/profile" element={<ProtectedRoute roles={["CUSTOMER", "ADMIN", "SUPER_ADMIN"]}><CustomerProfile /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/tree" element={<ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}><AdminTree /></ProtectedRoute>} />
            <Route path="/admin/orders" element={<ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}><AdminOrders /></ProtectedRoute>} />
            <Route path="/admin/commissions" element={<ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}><AdminCommissions /></ProtectedRoute>} />
            <Route path="/admin/withdrawals" element={<ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}><AdminWithdrawals /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}><AdminSettings /></ProtectedRoute>} />
            <Route path="/admin/audit-logs" element={<ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}><AdminAuditLogs /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
