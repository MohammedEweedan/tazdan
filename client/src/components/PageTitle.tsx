"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TITLE_MAP: Record<string, string> = {
  "/": "Home - promrkts",
  "/login": "Login - promrkts",
  "/register": "Register - promrkts",
  "/markets": "Markets - promrkts",
  "/about": "About - promrkts",
  "/contact": "Contact - promrkts",
  "/careers": "Careers - promrkts",
  "/fees": "Fees - promrkts",
  "/help": "Help - promrkts",
  "/privacy": "Privacy - promrkts",
  "/terms": "Terms - promrkts",
  "/trust": "Trust - promrkts",
  "/dashboard": "Dashboard - promrkts",
  "/dashboard/trade": "Trade - promrkts",
  "/dashboard/wallet": "Wallet - promrkts",
  "/dashboard/wallet/send": "Send - promrkts",
  "/dashboard/deposit": "Deposit - promrkts",
  "/dashboard/withdraw": "Withdraw - promrkts",
  "/dashboard/send": "Send - promrkts",
  "/dashboard/orders": "Orders - promrkts",
  "/dashboard/p2p": "P2P Market - promrkts",
  "/dashboard/portfolio": "Portfolio - promrkts",
  "/dashboard/cards": "Cards - promrkts",
  "/dashboard/messages": "Messages - promrkts",
  "/dashboard/notifications": "Notifications - promrkts",
  "/dashboard/referrals": "Referrals - promrkts",
  "/dashboard/profile": "Profile - promrkts",
  "/dashboard/settings": "Settings - promrkts",
  "/dashboard/security": "Security - promrkts",
  "/dashboard/kyc": "Identity Verification - promrkts",
  "/dashboard/tokens": "Tokens - promrkts",
  "/dashboard/contracts": "Contracts - promrkts",
  "/dashboard/bank-accounts": "Bank Accounts - promrkts",
  "/dashboard/agent-panel": "Agent Panel - promrkts",
  "/dashboard/agents": "Agents - promrkts",
  "/dashboard/agents/history": "Agent History - promrkts",
  "/admin": "Admin Dashboard - promrkts",
  "/admin/deposits": "Deposits - Admin - promrkts",
  "/admin/withdrawals": "Withdrawals - Admin - promrkts",
  "/admin/users": "Users - Admin - promrkts",
  "/admin/kyc": "KYC - Admin - promrkts",
  "/admin/orders": "Orders - Admin - promrkts",
  "/admin/rates": "Rates - Admin - promrkts",
  "/admin/settings": "Settings - Admin - promrkts",
  "/admin/aml": "AML - Admin - promrkts",
  "/verify-email": "Verify Email - promrkts",
  "/forgot-password": "Forgot Password - promrkts",
  "/reset-password": "Reset Password - promrkts",
  "/pay": "Pay - promrkts",
};

export default function PageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const title = TITLE_MAP[pathname] || deriveTitle(pathname);
    document.title = title;
  }, [pathname]);

  return null;
}

function deriveTitle(pathname: string): string {
  // Remove leading slash, split by /, take last segment
  const segments = pathname.replace(/^\//, "").split("/");
  const last = segments[segments.length - 1];
  if (!last) return "promrkts";
  // Capitalize and replace hyphens
  const formatted = last
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `${formatted} - promrkts`;
}
