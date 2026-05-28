"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TITLE_MAP: Record<string, string> = {
  "/": "Fortuni — crypto made simple",
  "/about": "About - Fortuni",
  "/contact": "Contact - Fortuni",
  "/careers": "Careers - Fortuni",
  "/fees": "Fees - Fortuni",
  "/help": "Help - Fortuni",
  "/privacy": "Privacy - Fortuni",
  "/terms": "Terms - Fortuni",
  "/trust": "Trust - Fortuni",
  "/dashboard": "Dashboard - Fortuni",
  "/dashboard/trade": "Trade - Fortuni",
  "/dashboard/wallet": "Wallet - Fortuni",
  "/dashboard/wallet/send": "Send - Fortuni",
  "/dashboard/deposit": "Deposit - Fortuni",
  "/dashboard/withdraw": "Withdraw - Fortuni",
  "/dashboard/send": "Send - Fortuni",
  "/dashboard/orders": "Orders - Fortuni",
  "/dashboard/p2p": "P2P Market - Fortuni",
  "/dashboard/portfolio": "Portfolio - Fortuni",
  "/dashboard/cards": "Cards - Fortuni",
  "/dashboard/messages": "Messages - Fortuni",
  "/dashboard/notifications": "Notifications - Fortuni",
  "/dashboard/referrals": "Referrals - Fortuni",
  "/dashboard/profile": "Profile - Fortuni",
  "/dashboard/settings": "Settings - Fortuni",
  "/dashboard/security": "Security - Fortuni",
  "/dashboard/kyc": "Identity Verification - Fortuni",
  "/dashboard/bank-accounts": "Bank Accounts - Fortuni",
  "/dashboard/agent-panel": "Agent Panel - Fortuni",
  "/admin": "Admin Dashboard - Fortuni",
  "/admin/deposits": "Deposits - Admin - Fortuni",
  "/admin/withdrawals": "Withdrawals - Admin - Fortuni",
  "/admin/users": "Users - Admin - Fortuni",
  "/admin/kyc": "KYC - Admin - Fortuni",
  "/admin/orders": "Orders - Admin - Fortuni",
  "/admin/rates": "Rates - Admin - Fortuni",
  "/admin/settings": "Settings - Admin - Fortuni",
  "/admin/aml": "AML - Admin - Fortuni",
  "/verify-email": "Verify Email - Fortuni",
  "/forgot-password": "Forgot Password - Fortuni",
  "/reset-password": "Reset Password - Fortuni",
  "/pay": "Pay - Fortuni",
  "/cards": "Cards - Fortuni",
  "/features": "Features - Fortuni",
  "/faq": "FAQ - Fortuni",
  "/partners": "Partners - Fortuni",
  "/risk": "Risk Summary - Fortuni",
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
  if (!last) return "Fortuni";
  // Capitalize and replace hyphens
  const formatted = last
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `${formatted} - Fortuni`;
}
