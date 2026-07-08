import axios from "axios";

/**
 * Base URL strategy:
 * - If REACT_APP_BACKEND_URL is set at build time (e.g., during local dev / preview),
 *   the frontend calls that host directly.
 * - If it's empty/unset (default for Docker/PandaStack production build), we use
 *   relative paths, so all `/api/*` requests hit the same origin that served the site.
 */
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API_BASE = `${BACKEND_URL}/api`;
export const MEDIA_BASE = BACKEND_URL; // media URLs from the backend already start with /api/media/

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 20000,
});

// Auto-attach Bearer token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("dp_access_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatApiError(err) {
  const detail = err?.response?.data?.detail;
  if (detail == null) return err?.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export function formatINR(amount) {
  if (amount == null) return "₹0";
  return "₹" + Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function shortDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
