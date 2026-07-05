import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/60">
        <div className="animate-pulse font-mono text-sm">Loading Dream Pick...</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
