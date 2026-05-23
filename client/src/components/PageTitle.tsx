"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TITLE_MAP: Record<string, string> = {
  "/": "fortuni — crypto made simple",
  "/about": "About - fortuni",
  "/contact": "Contact - fortuni",
  "/careers": "Careers - fortuni",
  "/fees": "Fees - fortuni",
  "/help": "Help - fortuni",
  "/privacy": "Privacy - fortuni",
  "/terms": "Terms - fortuni",
  "/trust": "Trust - fortuni",
  "/dashboard": "Dashboard - fortuni",
  "/dashboard/trade": "Trade - fortuni",
  "/dashboard/wallet": "Wallet - fortuni",
  "/dashboard/wallet/send": "Send - fortuni",
  "/dashboard/deposit": "Deposit - fortuni",
  "/dashboard/withdraw": "Withdraw - fortuni",
  "/dashboard/send": "Send - fortuni",
  "/dashboard/orders": "Orders - fortuni",
  "/dashboard/p2p": "P2P Market - fortuni",
  "/dashboard/portfolio": "Portfolio - fortuni",
  "/dashboard/cards": "Cards - fortuni",
  "/dashboard/messages": "Messages - fortuni",
  "/dashboard/notifications": "Notifications - fortuni",
  "/dashboard/referrals": "Referrals - fortuni",
  "/dashboard/profile": "Profile - fortuni",
  "/dashboard/settings": "Settings - fortuni",
  "/dashboard/security": "Security - fortuni",
  "/dashboard/kyc": "Identity Verification - fortuni",
  "/dashboard/bank-accounts": "Bank Accounts - fortuni",
  "/dashboard/agent-panel": "Agent Panel - fortuni",
  "/admin": "Admin Dashboard - fortuni",
  "/admin/deposits": "Deposits - Admin - fortuni",
  "/admin/withdrawals": "Withdrawals - Admin - fortuni",
  "/admin/users": "Users - Admin - fortuni",
  "/admin/kyc": "KYC - Admin - fortuni",
  "/admin/orders": "Orders - Admin - fortuni",
  "/admin/rates": "Rates - Admin - fortuni",
  "/admin/settings": "Settings - Admin - fortuni",
  "/admin/aml": "AML - Admin - fortuni",
  "/verify-email": "Verify Email - fortuni",
  "/forgot-password": "Forgot Password - fortuni",
  "/reset-password": "Reset Password - fortuni",
  "/pay": "Pay - fortuni",
  "/cards": "Cards - fortuni",
  "/features": "Features - fortuni",
  "/faq": "FAQ - fortuni",
  "/partners": "Partners - fortuni",
  "/risk": "Risk Summary - fortuni",
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
  if (!last) return "fortuni";
  // Capitalize and replace hyphens
  const formatted = last
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `${formatted} - fortuni`;
}
