/* ═══════════════════════════════════════════════════════════════════════════
   /features — the personal app, capability by capability.

   ONE source of truth for the page: every area, every capability and its
   honest status (docs/audit/FEATURE_MATRIX.md → Ready = inApp, Sandbox =
   pilot, Off in production = planned). Flip a status here and both the area
   section and the complete index at the bottom update.

   Keys are written out in full on purpose (the i18n QA greps for literal
   keys). `media` on a capability is the index of the screen in its area's
   `media` list that the phone shows while that row is being read.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { IconType } from "react-icons";
import {
  FiActivity, FiAlertTriangle, FiArchive, FiArrowDownLeft, FiAtSign, FiBell, FiBriefcase, FiCalendar,
  FiCheckCircle, FiClock, FiCode, FiCompass, FiCopy, FiCreditCard, FiDollarSign, FiDownload, FiEye,
  FiEyeOff, FiFileText, FiFilter, FiFlag, FiGift, FiGlobe, FiGrid, FiHash, FiHeadphones, FiImage,
  FiKey, FiLayers, FiLink, FiList, FiLock, FiMail, FiMapPin, FiMaximize, FiMessageCircle,
  FiMessageSquare, FiMonitor, FiMoon, FiPackage, FiPhone, FiPieChart, FiPlusCircle, FiRefreshCw,
  FiRepeat, FiRotateCcw, FiSend, FiServer, FiShield, FiShoppingBag, FiSlash, FiSliders, FiSmartphone,
  FiStar, FiTag, FiTarget, FiTrash2, FiTrendingUp, FiTruck, FiType, FiUser, FiUserCheck, FiUserPlus,
  FiUsers, FiVolume2, FiZap, FiArrowUpRight, FiEdit3, FiCrosshair, FiBookOpen,
} from "react-icons/fi";
import type { Status } from "@/components/site";

export type Capability = { title: string; body: string; status: Status; icon: IconType; media?: number };
/** `tab` labels the switcher pill; `video` plays when captured, else `screen`. */
export type AreaMedia = { screen: string; video?: string; tab: string; alt: string };
export type Area = {
  id: string;
  nav: string;
  pain: string;
  title: string;
  lead: string;
  note?: string;
  link?: { label: string; href: string };
  media: AreaMedia[];
  caps: Capability[];
};

const REC = "features.switcher.recording";

export const AREAS: Area[] = [
  {
    id: "accounts",
    nav: "features.accounts.nav",
    pain: "features.accounts.pain",
    title: "features.accounts.title",
    lead: "features.accounts.lead",
    media: [
      { screen: "balances", tab: "features.accounts.tab.balances", alt: "features.accounts.alt.balances" },
      { screen: "onboarding", tab: "features.accounts.tab.onboarding", alt: "features.accounts.alt.onboarding" },
      { screen: "wallet", tab: "features.accounts.tab.wallet", alt: "features.accounts.alt.wallet" },
      { screen: "asset", tab: "features.accounts.tab.asset", alt: "features.accounts.alt.asset" },
      { screen: "portfolio", tab: "features.accounts.tab.portfolio", alt: "features.accounts.alt.portfolio" },
    ],
    caps: [
      { title: "features.accounts.cap.signup.title", body: "features.accounts.cap.signup.body", status: "inApp", icon: FiUserPlus, media: 1 },
      { title: "features.accounts.cap.email.title", body: "features.accounts.cap.email.body", status: "inApp", icon: FiMail },
      { title: "features.accounts.cap.phone.title", body: "features.accounts.cap.phone.body", status: "planned", icon: FiPhone },
      { title: "features.accounts.cap.apple.title", body: "features.accounts.cap.apple.body", status: "planned", icon: FiSmartphone },
      { title: "features.accounts.cap.fiat.title", body: "features.accounts.cap.fiat.body", status: "inApp", icon: FiDollarSign, media: 2 },
      { title: "features.accounts.cap.crypto.title", body: "features.accounts.cap.crypto.body", status: "inApp", icon: FiLayers, media: 2 },
      { title: "features.accounts.cap.pages.title", body: "features.accounts.cap.pages.body", status: "inApp", icon: FiGrid, media: 0 },
      { title: "features.accounts.cap.display.title", body: "features.accounts.cap.display.body", status: "inApp", icon: FiGlobe, media: 0 },
      { title: "features.accounts.cap.asset.title", body: "features.accounts.cap.asset.body", status: "inApp", icon: FiTrendingUp, media: 3 },
      { title: "features.accounts.cap.portfolio.title", body: "features.accounts.cap.portfolio.body", status: "inApp", icon: FiPieChart, media: 4 },
      { title: "features.accounts.cap.wallet.title", body: "features.accounts.cap.wallet.body", status: "inApp", icon: FiFilter, media: 2 },
      { title: "features.accounts.cap.delete.title", body: "features.accounts.cap.delete.body", status: "inApp", icon: FiTrash2 },
    ],
  },
  {
    id: "move",
    nav: "features.move.nav",
    pain: "features.move.pain",
    title: "features.move.title",
    lead: "features.move.lead",
    media: [
      { video: "flow-send", screen: "send", tab: REC, alt: "features.move.alt.send" },
      { screen: "send", tab: "features.move.tab.send", alt: "features.move.alt.send" },
      { screen: "confirm", tab: "features.move.tab.confirm", alt: "features.move.alt.confirm" },
      { screen: "receive", tab: "features.move.tab.receive", alt: "features.move.alt.receive" },
      { screen: "claim", tab: "features.move.tab.claim", alt: "features.move.alt.claim" },
      { screen: "topup", tab: "features.move.tab.topup", alt: "features.move.alt.topup" },
      { screen: "withdraw", tab: "features.move.tab.withdraw", alt: "features.move.alt.withdraw" },
    ],
    caps: [
      { title: "features.move.cap.handle.title", body: "features.move.cap.handle.body", status: "inApp", icon: FiAtSign, media: 1 },
      { title: "features.move.cap.review.title", body: "features.move.cap.review.body", status: "inApp", icon: FiCheckCircle, media: 2 },
      { title: "features.move.cap.receive.title", body: "features.move.cap.receive.body", status: "inApp", icon: FiArrowDownLeft, media: 3 },
      { title: "features.move.cap.scan.title", body: "features.move.cap.scan.body", status: "inApp", icon: FiMaximize, media: 3 },
      { title: "features.move.cap.claim.title", body: "features.move.cap.claim.body", status: "inApp", icon: FiLink, media: 4 },
      { title: "features.move.cap.claimSafe.title", body: "features.move.cap.claimSafe.body", status: "inApp", icon: FiRotateCcw, media: 4 },
      { title: "features.move.cap.topupBank.title", body: "features.move.cap.topupBank.body", status: "inApp", icon: FiPlusCircle, media: 5 },
      { title: "features.move.cap.topupCrypto.title", body: "features.move.cap.topupCrypto.body", status: "inApp", icon: FiHash, media: 5 },
      { title: "features.move.cap.topupCard.title", body: "features.move.cap.topupCard.body", status: "planned", icon: FiCreditCard },
      { title: "features.move.cap.topupAgent.title", body: "features.move.cap.topupAgent.body", status: "planned", icon: FiMapPin },
      { title: "features.move.cap.withdrawBank.title", body: "features.move.cap.withdrawBank.body", status: "inApp", icon: FiArchive, media: 6 },
      { title: "features.move.cap.withdrawChain.title", body: "features.move.cap.withdrawChain.body", status: "inApp", icon: FiArrowUpRight, media: 6 },
    ],
  },
  {
    id: "abroad",
    nav: "features.abroad.nav",
    pain: "features.abroad.pain",
    title: "features.abroad.title",
    lead: "features.abroad.lead",
    note: "features.abroad.note",
    media: [
      { video: "flow-remit", screen: "remit", tab: REC, alt: "features.abroad.alt.home" },
      { screen: "remit", tab: "features.abroad.tab.home", alt: "features.abroad.alt.home" },
      { screen: "remit-track", tab: "features.abroad.tab.track", alt: "features.abroad.alt.track" },
    ],
    caps: [
      { title: "features.abroad.cap.corridors.title", body: "features.abroad.cap.corridors.body", status: "pilot", icon: FiGlobe, media: 1 },
      { title: "features.abroad.cap.payout.title", body: "features.abroad.cap.payout.body", status: "pilot", icon: FiSend, media: 1 },
      { title: "features.abroad.cap.recipients.title", body: "features.abroad.cap.recipients.body", status: "pilot", icon: FiUsers },
      { title: "features.abroad.cap.quote.title", body: "features.abroad.cap.quote.body", status: "pilot", icon: FiLock },
      { title: "features.abroad.cap.checks.title", body: "features.abroad.cap.checks.body", status: "pilot", icon: FiFileText },
      { title: "features.abroad.cap.confirm.title", body: "features.abroad.cap.confirm.body", status: "pilot", icon: FiUserCheck },
      { title: "features.abroad.cap.track.title", body: "features.abroad.cap.track.body", status: "pilot", icon: FiActivity, media: 2 },
      { title: "features.abroad.cap.refund.title", body: "features.abroad.cap.refund.body", status: "pilot", icon: FiRotateCcw, media: 2 },
    ],
  },
  {
    id: "exchange",
    nav: "features.exchange.nav",
    pain: "features.exchange.pain",
    title: "features.exchange.title",
    lead: "features.exchange.lead",
    media: [
      { screen: "exchange", tab: "features.exchange.tab.convert", alt: "features.exchange.alt.convert" },
      { screen: "buy", tab: "features.exchange.tab.buy", alt: "features.exchange.alt.buy" },
      { screen: "sell", tab: "features.exchange.tab.sell", alt: "features.exchange.alt.sell" },
      { screen: "recurring", tab: "features.exchange.tab.recurring", alt: "features.exchange.alt.recurring" },
    ],
    caps: [
      { title: "features.exchange.cap.convert.title", body: "features.exchange.cap.convert.body", status: "inApp", icon: FiRefreshCw, media: 0 },
      { title: "features.exchange.cap.buy.title", body: "features.exchange.cap.buy.body", status: "inApp", icon: FiShoppingBag, media: 1 },
      { title: "features.exchange.cap.sell.title", body: "features.exchange.cap.sell.body", status: "inApp", icon: FiTag, media: 2 },
      { title: "features.exchange.cap.held.title", body: "features.exchange.cap.held.body", status: "inApp", icon: FiClock, media: 1 },
      { title: "features.exchange.cap.recurring.title", body: "features.exchange.cap.recurring.body", status: "inApp", icon: FiRepeat, media: 3 },
      { title: "features.exchange.cap.recurringCard.title", body: "features.exchange.cap.recurringCard.body", status: "planned", icon: FiCreditCard },
    ],
  },
  {
    id: "p2p",
    nav: "features.p2p.nav",
    pain: "features.p2p.pain",
    title: "features.p2p.title",
    lead: "features.p2p.lead",
    media: [
      { video: "flow-p2p", screen: "p2p", tab: REC, alt: "features.p2p.alt.trade" },
      { screen: "p2p", tab: "features.p2p.tab.market", alt: "features.p2p.alt.market" },
    ],
    caps: [
      { title: "features.p2p.cap.market.title", body: "features.p2p.cap.market.body", status: "inApp", icon: FiList, media: 1 },
      { title: "features.p2p.cap.escrow.title", body: "features.p2p.cap.escrow.body", status: "inApp", icon: FiLock, media: 0 },
      { title: "features.p2p.cap.methods.title", body: "features.p2p.cap.methods.body", status: "inApp", icon: FiDollarSign, media: 1 },
      { title: "features.p2p.cap.listing.title", body: "features.p2p.cap.listing.body", status: "inApp", icon: FiEdit3 },
      { title: "features.p2p.cap.near.title", body: "features.p2p.cap.near.body", status: "inApp", icon: FiCrosshair },
      { title: "features.p2p.cap.reputation.title", body: "features.p2p.cap.reputation.body", status: "inApp", icon: FiStar, media: 1 },
      { title: "features.p2p.cap.chat.title", body: "features.p2p.cap.chat.body", status: "inApp", icon: FiImage, media: 0 },
      { title: "features.p2p.cap.timer.title", body: "features.p2p.cap.timer.body", status: "inApp", icon: FiClock, media: 0 },
      { title: "features.p2p.cap.dispute.title", body: "features.p2p.cap.dispute.body", status: "inApp", icon: FiFlag },
      { title: "features.p2p.cap.safety.title", body: "features.p2p.cap.safety.body", status: "inApp", icon: FiAlertTriangle },
      { title: "features.p2p.cap.tracker.title", body: "features.p2p.cap.tracker.body", status: "inApp", icon: FiActivity },
    ],
  },
  {
    id: "save",
    nav: "features.save.nav",
    pain: "features.save.pain",
    title: "features.save.title",
    lead: "features.save.lead",
    media: [
      { video: "flow-budget", screen: "budgets", tab: REC, alt: "features.save.alt.new" },
      { screen: "budgets", tab: "features.save.tab.goals", alt: "features.save.alt.goals" },
    ],
    caps: [
      { title: "features.save.cap.goals.title", body: "features.save.cap.goals.body", status: "inApp", icon: FiTarget, media: 1 },
      { title: "features.save.cap.auto.title", body: "features.save.cap.auto.body", status: "inApp", icon: FiCalendar, media: 0 },
      { title: "features.save.cap.plan.title", body: "features.save.cap.plan.body", status: "inApp", icon: FiSliders, media: 0 },
      { title: "features.save.cap.lock.title", body: "features.save.cap.lock.body", status: "inApp", icon: FiLock },
      { title: "features.save.cap.move.title", body: "features.save.cap.move.body", status: "inApp", icon: FiPlusCircle, media: 1 },
      { title: "features.save.cap.card.title", body: "features.save.cap.card.body", status: "planned", icon: FiCreditCard },
    ],
  },
  {
    id: "messages",
    nav: "features.messages.nav",
    pain: "features.messages.pain",
    title: "features.messages.title",
    lead: "features.messages.lead",
    media: [
      { video: "flow-chat-pay", screen: "chat-payment", tab: REC, alt: "features.messages.alt.payment" },
      { screen: "messages", tab: "features.messages.tab.inbox", alt: "features.messages.alt.inbox" },
      { screen: "chat-payment", tab: "features.messages.tab.payment", alt: "features.messages.alt.payment" },
      { screen: "contact", tab: "features.messages.tab.contact", alt: "features.messages.alt.contact" },
    ],
    caps: [
      { title: "features.messages.cap.chats.title", body: "features.messages.cap.chats.body", status: "inApp", icon: FiMessageSquare, media: 1 },
      { title: "features.messages.cap.pay.title", body: "features.messages.cap.pay.body", status: "inApp", icon: FiSend, media: 2 },
      { title: "features.messages.cap.request.title", body: "features.messages.cap.request.body", status: "inApp", icon: FiArrowDownLeft, media: 2 },
      { title: "features.messages.cap.contacts.title", body: "features.messages.cap.contacts.body", status: "inApp", icon: FiUser, media: 3 },
      { title: "features.messages.cap.privacy.title", body: "features.messages.cap.privacy.body", status: "inApp", icon: FiEye },
      { title: "features.messages.cap.tools.title", body: "features.messages.cap.tools.body", status: "inApp", icon: FiMessageCircle },
      { title: "features.messages.cap.safety.title", body: "features.messages.cap.safety.body", status: "inApp", icon: FiSlash },
      { title: "features.messages.cap.support.title", body: "features.messages.cap.support.body", status: "inApp", icon: FiHeadphones, media: 1 },
    ],
  },
  {
    id: "cards",
    nav: "features.cards.nav",
    pain: "features.cards.pain",
    title: "features.cards.title",
    lead: "features.cards.lead",
    note: "features.cards.note",
    media: [{ screen: "cards", tab: "features.cards.tab.cards", alt: "features.cards.alt.cards" }],
    caps: [
      { title: "features.cards.cap.virtual.title", body: "features.cards.cap.virtual.body", status: "planned", icon: FiCreditCard },
      { title: "features.cards.cap.physical.title", body: "features.cards.cap.physical.body", status: "planned", icon: FiTruck },
      { title: "features.cards.cap.controls.title", body: "features.cards.cap.controls.body", status: "planned", icon: FiLock },
      { title: "features.cards.cap.topup.title", body: "features.cards.cap.topup.body", status: "planned", icon: FiPackage },
      { title: "features.cards.cap.wallet.title", body: "features.cards.cap.wallet.body", status: "planned", icon: FiSmartphone },
    ],
  },
  {
    id: "security",
    nav: "features.security.nav",
    pain: "features.security.pain",
    title: "features.security.title",
    lead: "features.security.lead",
    link: { label: "features.security.link", href: "/security" },
    media: [
      { video: "flow-privacy", screen: "privacy-hidden", tab: REC, alt: "features.security.alt.privacy" },
      { screen: "kyc", tab: "features.security.tab.kyc", alt: "features.security.alt.kyc" },
      { screen: "twofa", tab: "features.security.tab.twofa", alt: "features.security.alt.twofa" },
      { screen: "devices", tab: "features.security.tab.devices", alt: "features.security.alt.devices" },
      { screen: "privacy-hidden", tab: "features.security.tab.privacy", alt: "features.security.alt.privacy" },
    ],
    caps: [
      { title: "features.security.cap.kyc.title", body: "features.security.cap.kyc.body", status: "inApp", icon: FiUserCheck, media: 1 },
      { title: "features.security.cap.limits.title", body: "features.security.cap.limits.body", status: "inApp", icon: FiSliders, media: 1 },
      { title: "features.security.cap.stepup.title", body: "features.security.cap.stepup.body", status: "inApp", icon: FiShield, media: 2 },
      { title: "features.security.cap.twofa.title", body: "features.security.cap.twofa.body", status: "inApp", icon: FiKey, media: 2 },
      { title: "features.security.cap.biometric.title", body: "features.security.cap.biometric.body", status: "inApp", icon: FiSmartphone, media: 3 },
      { title: "features.security.cap.devices.title", body: "features.security.cap.devices.body", status: "inApp", icon: FiMonitor, media: 3 },
      { title: "features.security.cap.privacy.title", body: "features.security.cap.privacy.body", status: "inApp", icon: FiEyeOff, media: 4 },
      { title: "features.security.cap.handle.title", body: "features.security.cap.handle.body", status: "inApp", icon: FiAtSign },
      { title: "features.security.cap.visibility.title", body: "features.security.cap.visibility.body", status: "inApp", icon: FiEye },
      { title: "features.security.cap.p2p.title", body: "features.security.cap.p2p.body", status: "inApp", icon: FiMapPin },
      { title: "features.security.cap.screening.title", body: "features.security.cap.screening.body", status: "inApp", icon: FiShield },
    ],
  },
  {
    id: "extras",
    nav: "features.extras.nav",
    pain: "features.extras.pain",
    title: "features.extras.title",
    lead: "features.extras.lead",
    media: [
      { screen: "statements", tab: "features.extras.tab.statements", alt: "features.extras.alt.statements" },
      { screen: "history", tab: "features.extras.tab.history", alt: "features.extras.alt.history" },
      { screen: "linked", tab: "features.extras.tab.linked", alt: "features.extras.alt.linked" },
      { screen: "referrals", tab: "features.extras.tab.referrals", alt: "features.extras.alt.referrals" },
      { screen: "settings", tab: "features.extras.tab.settings", alt: "features.extras.alt.settings" },
    ],
    caps: [
      { title: "features.extras.cap.history.title", body: "features.extras.cap.history.body", status: "inApp", icon: FiList, media: 1 },
      { title: "features.extras.cap.statements.title", body: "features.extras.cap.statements.body", status: "inApp", icon: FiDownload, media: 0 },
      { title: "features.extras.cap.notifications.title", body: "features.extras.cap.notifications.body", status: "inApp", icon: FiBell },
      { title: "features.extras.cap.notifPrefs.title", body: "features.extras.cap.notifPrefs.body", status: "inApp", icon: FiSliders, media: 4 },
      { title: "features.extras.cap.linked.title", body: "features.extras.cap.linked.body", status: "inApp", icon: FiBriefcase, media: 2 },
      { title: "features.extras.cap.handle.title", body: "features.extras.cap.handle.body", status: "inApp", icon: FiCopy },
      { title: "features.extras.cap.referral.title", body: "features.extras.cap.referral.body", status: "inApp", icon: FiGift, media: 3 },
      { title: "features.extras.cap.themes.title", body: "features.extras.cap.themes.body", status: "inApp", icon: FiMoon, media: 4 },
      { title: "features.extras.cap.language.title", body: "features.extras.cap.language.body", status: "inApp", icon: FiType, media: 4 },
      { title: "features.extras.cap.tour.title", body: "features.extras.cap.tour.body", status: "inApp", icon: FiCompass },
      { title: "features.extras.cap.feel.title", body: "features.extras.cap.feel.body", status: "inApp", icon: FiVolume2 },
    ],
  },
  {
    id: "business",
    nav: "features.business.nav",
    pain: "features.business.pain",
    title: "features.business.title",
    lead: "features.business.lead",
    link: { label: "features.business.link", href: "/business" },
    media: [
      { video: "flow-business", screen: "business-home", tab: REC, alt: "features.business.alt.bulk" },
      { screen: "business-home", tab: "features.business.tab.home", alt: "features.business.alt.home" },
      { screen: "business-bulk", tab: "features.business.tab.bulk", alt: "features.business.alt.bulk" },
      { screen: "business-keys", tab: "features.business.tab.keys", alt: "features.business.alt.keys" },
    ],
    caps: [
      { title: "features.business.cap.kyb.title", body: "features.business.cap.kyb.body", status: "inApp", icon: FiBookOpen, media: 1 },
      { title: "features.business.cap.team.title", body: "features.business.cap.team.body", status: "inApp", icon: FiUsers, media: 1 },
      { title: "features.business.cap.bulk.title", body: "features.business.cap.bulk.body", status: "inApp", icon: FiLayers, media: 2 },
      { title: "features.business.cap.payouts.title", body: "features.business.cap.payouts.body", status: "inApp", icon: FiZap, media: 2 },
      { title: "features.business.cap.keys.title", body: "features.business.cap.keys.body", status: "inApp", icon: FiKey, media: 3 },
      { title: "features.business.cap.api.title", body: "features.business.cap.api.body", status: "inApp", icon: FiCode, media: 3 },
      { title: "features.business.cap.webhooks.title", body: "features.business.cap.webhooks.body", status: "inApp", icon: FiServer },
    ],
  },
];

/** Area-level chip: shown only when every capability in the area shares it. */
export function areaStatus(area: Area): Status | undefined {
  const first = area.caps[0]?.status;
  return area.caps.every((c) => c.status === first) ? first : undefined;
}
