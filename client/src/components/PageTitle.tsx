"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TITLE_MAP: Record<string, string> = {
  "/": "tazdan — Libya. Crypto. Connected.",
  "/en": "tazdan — Libya. Crypto. Connected.",
  "/ar": "تزدان — ليبيا، كريبتو وتحويلات دولية",
  "/about": "About - tazdan",
  "/contact": "Contact - tazdan",
  "/careers": "Careers - tazdan",
  "/fees": "Fees - tazdan",
  "/help": "Help - tazdan",
  "/privacy": "Privacy - tazdan",
  "/terms": "Terms - tazdan",
  "/trust": "Trust - tazdan",
  "/dashboard": "Dashboard - tazdan",
  "/dashboard/trade": "Trade - tazdan",
  "/dashboard/wallet": "Wallet - tazdan",
  "/dashboard/wallet/send": "Send - tazdan",
  "/dashboard/deposit": "Deposit - tazdan",
  "/dashboard/withdraw": "Withdraw - tazdan",
  "/dashboard/send": "Send - tazdan",
  "/dashboard/orders": "Orders - tazdan",
  "/dashboard/p2p": "P2P Market - tazdan",
  "/dashboard/portfolio": "Portfolio - tazdan",
  "/dashboard/cards": "Cards - tazdan",
  "/dashboard/messages": "Messages - tazdan",
  "/dashboard/notifications": "Notifications - tazdan",
  "/dashboard/referrals": "Referrals - tazdan",
  "/dashboard/profile": "Profile - tazdan",
  "/dashboard/settings": "Settings - tazdan",
  "/dashboard/security": "Security - tazdan",
  "/dashboard/kyc": "Identity Verification - tazdan",
  "/dashboard/bank-accounts": "Bank Accounts - tazdan",
  "/dashboard/agent-panel": "Agent Panel - tazdan",
  "/admin": "Admin Dashboard - tazdan",
  "/admin/deposits": "Deposits - Admin - tazdan",
  "/admin/withdrawals": "Withdrawals - Admin - tazdan",
  "/admin/users": "Users - Admin - tazdan",
  "/admin/kyc": "KYC - Admin - tazdan",
  "/admin/orders": "Orders - Admin - tazdan",
  "/admin/rates": "Rates - Admin - tazdan",
  "/admin/settings": "Settings - Admin - tazdan",
  "/admin/aml": "AML - Admin - tazdan",
  "/verify-email": "Verify Email - tazdan",
  "/forgot-password": "Forgot Password - tazdan",
  "/reset-password": "Reset Password - tazdan",
  "/pay": "Pay - tazdan",
  "/cards": "Cards - tazdan",
  "/features": "Features - tazdan",
  "/faq": "FAQ - tazdan",
  "/partners": "Partners - tazdan",
  "/risk": "Risk Summary - tazdan",
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
  if (!last) return "tazdan";
  // Capitalize and replace hyphens
  const formatted = last
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `${formatted} - tazdan`;
}
