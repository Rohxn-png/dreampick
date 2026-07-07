import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Home from "@/pages/Home";
import Plans from "@/pages/Plans";
import Register from "@/pages/Register";
import Login from "@/pages/Login";
import { ForgotPassword, ResetPassword } from "@/pages/PasswordPages";

import CustomerDashboard from "@/pages/customer/Dashboard";
import CustomerTree from "@/pages/customer/Tree";
import CustomerReferrals from "@/pages/customer/Referrals";
import CustomerCommissions from "@/pages/customer/Commissions";
import CustomerCashback from "@/pages/customer/Cashback";
import CustomerWallet from "@/pages/customer/Wallet";
import CustomerProfile from "@/pages/customer/Profile";
import CustomerNotifications from "@/pages/customer/Notifications";

import AdminDashboard from "@/pages/admin/Dashboard";
import AdminUsers from "@/pages/admin/Users";
import AdminUserDetail from "@/pages/admin/UserDetail";
import AdminTree from "@/pages/admin/Tree";
import AdminOrders from "@/pages/admin/Orders";
import AdminCashback from "@/pages/admin/Cashback";
import { AdminDirectCommissions, AdminMatchingIncome } from "@/pages/admin/CommissionPages";
import AdminWithdrawals from "@/pages/admin/Withdrawals";
import AdminSettings from "@/pages/admin/Settings";
import AdminAuditLogs from "@/pages/admin/AuditLogs";
import AdminMedia from "@/pages/admin/Media";
import AdminNotifications from "@/pages/admin/Notifications";

import "@/App.css";

const cust = ["CUSTOMER", "ADMIN"];
const admin = ["ADMIN"];

function App() {
  return (
    <div className="App min-h-screen">
      <BrowserRouter>
        <AuthProvider>
          <Toaster theme="dark" position="top-right" toastOptions={{
            style: { background: "#1F1836", color: "#F5F0FF", border: "1px solid rgba(212,169,58,0.3)" },
          }} />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/about" element={<Home />} />
            <Route path="/gallery" element={<Home />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/dashboard" element={<ProtectedRoute roles={cust}><CustomerDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/tree" element={<ProtectedRoute roles={cust}><CustomerTree /></ProtectedRoute>} />
            <Route path="/dashboard/referrals" element={<ProtectedRoute roles={cust}><CustomerReferrals /></ProtectedRoute>} />
            <Route path="/dashboard/commissions" element={<ProtectedRoute roles={cust}><CustomerCommissions /></ProtectedRoute>} />
            <Route path="/dashboard/cashback" element={<ProtectedRoute roles={cust}><CustomerCashback /></ProtectedRoute>} />
            <Route path="/dashboard/wallet" element={<ProtectedRoute roles={cust}><CustomerWallet /></ProtectedRoute>} />
            <Route path="/dashboard/notifications" element={<ProtectedRoute roles={cust}><CustomerNotifications /></ProtectedRoute>} />
            <Route path="/dashboard/profile" element={<ProtectedRoute roles={cust}><CustomerProfile /></ProtectedRoute>} />

            <Route path="/admin" element={<ProtectedRoute roles={admin}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={admin}><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/users/:user_id" element={<ProtectedRoute roles={admin}><AdminUserDetail /></ProtectedRoute>} />
            <Route path="/admin/tree" element={<ProtectedRoute roles={admin}><AdminTree /></ProtectedRoute>} />
            <Route path="/admin/orders" element={<ProtectedRoute roles={admin}><AdminOrders /></ProtectedRoute>} />
            <Route path="/admin/cashback" element={<ProtectedRoute roles={admin}><AdminCashback /></ProtectedRoute>} />
            <Route path="/admin/direct-commissions" element={<ProtectedRoute roles={admin}><AdminDirectCommissions /></ProtectedRoute>} />
            <Route path="/admin/matching-income" element={<ProtectedRoute roles={admin}><AdminMatchingIncome /></ProtectedRoute>} />
            <Route path="/admin/withdrawals" element={<ProtectedRoute roles={admin}><AdminWithdrawals /></ProtectedRoute>} />
            <Route path="/admin/media" element={<ProtectedRoute roles={admin}><AdminMedia /></ProtectedRoute>} />
            <Route path="/admin/notifications" element={<ProtectedRoute roles={admin}><AdminNotifications /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute roles={admin}><AdminSettings /></ProtectedRoute>} />
            <Route path="/admin/audit-logs" element={<ProtectedRoute roles={admin}><AdminAuditLogs /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
