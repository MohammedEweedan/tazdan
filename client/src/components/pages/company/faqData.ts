/* Help-centre content: categories and questions, as literal i18n keys
   (company.faq.<category>.<id>.q / .a). Answers follow
   docs/audit/FEATURE_MATRIX.md: send abroad = pilot, cards and card top-up =
   planned, the business "Invoices" screen is a payouts record (invoicing is
   not built), no chat-encryption claim, "anonymous?" per SITE_BRIEF §5 and
   "licensed?" per §6. */
import type { Status } from "@/components/site";

export type FaqEntry = { id: string; q: string; a: string; link?: { href: string; label: string } };
export type FaqCategory = { id: string; label: string; status?: Status; items: FaqEntry[] };

const e = (id: string, q: string, a: string, link?: FaqEntry["link"]): FaqEntry => ({ id, q, a, link });

export const FAQ_CATEGORIES: FaqCategory[] = [
  { id: "getting", label: "company.faq.cat.getting", items: [
    e("getting-what", "company.faq.getting.what.q", "company.faq.getting.what.a"),
    e("getting-bank", "company.faq.getting.bank.q", "company.faq.getting.bank.a"),
    e("getting-download", "company.faq.getting.download.q", "company.faq.getting.download.a"),
    e("getting-join", "company.faq.getting.join.q", "company.faq.getting.join.a"),
    e("getting-languages", "company.faq.getting.languages.q", "company.faq.getting.languages.a"),
    e("getting-help", "company.faq.getting.help.q", "company.faq.getting.help.a"),
  ] },
  { id: "account", label: "company.faq.cat.account", items: [
    e("account-verify", "company.faq.account.verify.q", "company.faq.account.verify.a"),
    e("account-time", "company.faq.account.time.q", "company.faq.account.time.a"),
    e("account-limits", "company.faq.account.limits.q", "company.faq.account.limits.a"),
    e("account-password", "company.faq.account.password.q", "company.faq.account.password.a"),
    e("account-twofa", "company.faq.account.twofa.q", "company.faq.account.twofa.a"),
    e("account-lost2fa", "company.faq.account.lost2fa.q", "company.faq.account.lost2fa.a"),
    e("account-devices", "company.faq.account.devices.q", "company.faq.account.devices.a"),
    e("account-phone", "company.faq.account.phone.q", "company.faq.account.phone.a"),
    e("account-delete", "company.faq.account.delete.q", "company.faq.account.delete.a", { href: "/delete-account", label: "company.faq.link.delete" }),
  ] },
  { id: "money", label: "company.faq.cat.money", items: [
    e("money-send", "company.faq.money.send.q", "company.faq.money.send.a"),
    e("money-speed", "company.faq.money.speed.q", "company.faq.money.speed.a"),
    e("money-claim", "company.faq.money.claim.q", "company.faq.money.claim.a"),
    e("money-receive", "company.faq.money.receive.q", "company.faq.money.receive.a"),
    e("money-chat", "company.faq.money.chat.q", "company.faq.money.chat.a"),
    e("money-topup", "company.faq.money.topup.q", "company.faq.money.topup.a"),
    e("money-withdraw", "company.faq.money.withdraw.q", "company.faq.money.withdraw.a"),
    e("money-stepup", "company.faq.money.stepup.q", "company.faq.money.stepup.a"),
    e("money-statements", "company.faq.money.statements.q", "company.faq.money.statements.a"),
  ] },
  { id: "abroad", label: "company.faq.cat.abroad", status: "pilot", items: [
    e("abroad-how", "company.faq.abroad.how.q", "company.faq.abroad.how.a"),
    e("abroad-live", "company.faq.abroad.live.q", "company.faq.abroad.live.a"),
    e("abroad-corridors", "company.faq.abroad.corridors.q", "company.faq.abroad.corridors.a"),
    e("abroad-quote", "company.faq.abroad.quote.q", "company.faq.abroad.quote.a"),
    e("abroad-track", "company.faq.abroad.track.q", "company.faq.abroad.track.a"),
    e("abroad-sof", "company.faq.abroad.sof.q", "company.faq.abroad.sof.a"),
  ] },
  { id: "exchange", label: "company.faq.cat.exchange", items: [
    e("exchange-currencies", "company.faq.exchange.currencies.q", "company.faq.exchange.currencies.a"),
    e("exchange-convert", "company.faq.exchange.convert.q", "company.faq.exchange.convert.a"),
    e("exchange-stablecoins", "company.faq.exchange.stablecoins.q", "company.faq.exchange.stablecoins.a"),
    e("exchange-chains", "company.faq.exchange.chains.q", "company.faq.exchange.chains.a"),
    e("exchange-recurring", "company.faq.exchange.recurring.q", "company.faq.exchange.recurring.a"),
    e("exchange-portfolio", "company.faq.exchange.portfolio.q", "company.faq.exchange.portfolio.a"),
    e("exchange-risk", "company.faq.exchange.risk.q", "company.faq.exchange.risk.a", { href: "/risk", label: "company.faq.link.risk" }),
  ] },
  { id: "p2p", label: "company.faq.cat.p2p", items: [
    e("p2p-how", "company.faq.p2p.how.q", "company.faq.p2p.how.a"),
    e("p2p-reverse", "company.faq.p2p.reverse.q", "company.faq.p2p.reverse.a"),
    e("p2p-near", "company.faq.p2p.near.q", "company.faq.p2p.near.a"),
    e("p2p-seen", "company.faq.p2p.seen.q", "company.faq.p2p.seen.a"),
    e("p2p-buy", "company.faq.p2p.buy.q", "company.faq.p2p.buy.a"),
    e("p2p-fee", "company.faq.p2p.fee.q", "company.faq.p2p.fee.a"),
  ] },
  { id: "savings", label: "company.faq.cat.savings", items: [
    e("savings-what", "company.faq.savings.what.q", "company.faq.savings.what.a"),
    e("savings-auto", "company.faq.savings.auto.q", "company.faq.savings.auto.a"),
    e("savings-lock", "company.faq.savings.lock.q", "company.faq.savings.lock.a"),
    e("savings-interest", "company.faq.savings.interest.q", "company.faq.savings.interest.a"),
  ] },
  { id: "cards", label: "company.faq.cat.cards", status: "planned", items: [
    e("cards-how", "company.faq.cards.how.q", "company.faq.cards.how.a"),
    e("cards-when", "company.faq.cards.when.q", "company.faq.cards.when.a"),
    e("cards-fee", "company.faq.cards.fee.q", "company.faq.cards.fee.a"),
  ] },
  { id: "business", label: "company.faq.cat.business", items: [
    e("business-what", "company.faq.business.what.q", "company.faq.business.what.a", { href: "/business", label: "company.faq.link.business" }),
    e("business-approval", "company.faq.business.approval.q", "company.faq.business.approval.a"),
    e("business-roles", "company.faq.business.roles.q", "company.faq.business.roles.a"),
    e("business-payouts", "company.faq.business.payouts.q", "company.faq.business.payouts.a"),
    e("business-api", "company.faq.business.api.q", "company.faq.business.api.a"),
    e("business-webhooks", "company.faq.business.webhooks.q", "company.faq.business.webhooks.a"),
    e("business-external", "company.faq.business.external.q", "company.faq.business.external.a"),
  ] },
  { id: "security", label: "company.faq.cat.security", items: [
    e("security-safe", "company.faq.security.safe.q", "company.faq.security.safe.a", { href: "/security", label: "company.faq.link.security" }),
    e("security-insured", "company.faq.security.insured.q", "company.faq.security.insured.a"),
    e("security-anonymous", "company.faq.security.anonymous.q", "company.faq.security.anonymous.a"),
    e("security-data", "company.faq.security.data.q", "company.faq.security.data.a", { href: "/privacy", label: "company.faq.link.privacy" }),
    e("security-privacyMode", "company.faq.security.privacyMode.q", "company.faq.security.privacyMode.a"),
    e("security-passwords", "company.faq.security.passwords.q", "company.faq.security.passwords.a"),
    e("security-signin", "company.faq.security.signin.q", "company.faq.security.signin.a"),
    e("security-report", "company.faq.security.report.q", "company.faq.security.report.a"),
  ] },
  { id: "fees", label: "company.faq.cat.fees", items: [
    e("fees-transfers", "company.faq.fees.transfers.q", "company.faq.fees.transfers.a", { href: "/fees", label: "company.faq.link.fees" }),
    e("fees-hold", "company.faq.fees.hold.q", "company.faq.fees.hold.a"),
    e("fees-rate", "company.faq.fees.rate.q", "company.faq.fees.rate.a"),
    e("fees-change", "company.faq.fees.change.q", "company.faq.fees.change.a"),
  ] },
  { id: "availability", label: "company.faq.cat.availability", items: [
    e("availability-where", "company.faq.availability.where.q", "company.faq.availability.where.a"),
    e("availability-countries", "company.faq.availability.countries.q", "company.faq.availability.countries.a"),
    e("availability-when", "company.faq.availability.when.q", "company.faq.availability.when.a"),
    e("availability-licensed", "company.faq.availability.licensed.q", "company.faq.availability.licensed.a", { href: "/partners", label: "company.faq.link.partners" }),
    e("availability-partners", "company.faq.availability.partners.q", "company.faq.availability.partners.a"),
  ] },
];
