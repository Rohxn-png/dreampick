#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Dreampick — Production data reset script.
 *
 * Wipes ALL customer/order/tree/commission data from the connected backend,
 * preserving the configured admin account and system settings.
 *
 * Usage:
 *   yarn reset-production-data
 *   ADMIN_EMAIL=dreampickev@gmail.com ADMIN_PASSWORD='...' BACKEND_URL='https://...' yarn reset-production-data
 *
 * Env variables (falls back to sensible defaults):
 *   BACKEND_URL       — e.g. https://binary-commerce.preview.emergentagent.com  (defaults to REACT_APP_BACKEND_URL from .env)
 *   ADMIN_EMAIL       — admin email  (defaults to dreampickev@gmail.com)
 *   ADMIN_PASSWORD    — admin password (required)
 *   PRESERVE_MEDIA    — "true"|"false"  (default "true")
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Load REACT_APP_BACKEND_URL from frontend/.env as a fallback
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/i);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

const dotenv = loadEnv();
const BACKEND = (process.env.BACKEND_URL || dotenv.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "dreampickev@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "dreampick@123";
const PRESERVE_MEDIA = (process.env.PRESERVE_MEDIA || "true").toLowerCase() !== "false";

if (!BACKEND) {
  console.error("[reset] BACKEND_URL (or REACT_APP_BACKEND_URL in frontend/.env) is required.");
  process.exit(1);
}

async function main() {
  console.log("[reset] Backend:", BACKEND);
  console.log("[reset] Admin  :", ADMIN_EMAIL);
  console.log("[reset] Preserve media:", PRESERVE_MEDIA);

  // Confirmation prompt (interactive if TTY)
  if (process.stdin.isTTY && !process.env.CI && !process.argv.includes("--yes")) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((res) => rl.question(
      "\n⚠️  This will DELETE ALL CUSTOMER DATA (users, orders, commissions, cashback, notifications, audit logs).\n    The admin account and system settings will be preserved.\n    Type 'RESET' to continue: ",
      (a) => { rl.close(); res(a.trim()); },
    ));
    if (answer !== "RESET") { console.log("[reset] Aborted."); process.exit(0); }
  }

  // 1) Log in as admin
  const loginRes = await fetch(`${BACKEND}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!loginRes.ok) {
    console.error("[reset] Admin login failed:", loginRes.status, await loginRes.text());
    process.exit(1);
  }
  const { access_token } = await loginRes.json();

  // 2) Call reset endpoint
  const resetRes = await fetch(`${BACKEND}/api/admin/reset-production-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({
      confirm: "RESET_ALL_CUSTOMER_DATA",
      preserve_media: PRESERVE_MEDIA,
    }),
  });
  if (!resetRes.ok) {
    console.error("[reset] Reset failed:", resetRes.status, await resetRes.text());
    process.exit(1);
  }
  const result = await resetRes.json();
  console.log("\n[reset] ✅  Reset complete.\n");
  console.log("Preserved admin:", result.preserved_admin_email);
  console.log("Deleted counts:");
  for (const [k, v] of Object.entries(result.counts || {})) console.log(`  - ${k}: ${v}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
