"use client";

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiCheck, FiSend } from "react-icons/fi";
import {
  BentoCard, BentoGrid, Body, Container, CTABand, FAQList, Footnote, Headline, MediaHero, PhoneStage,
  Section, SectionHeader, SiteButton, SiteShell, StatusChip, useSiteTheme, useWaitlist, type Status,
} from "@/components/site";
import RemitCalculator from "@/components/pages/company/RemitCalculator";

/* ── The fee schedule ─────────────────────────────────────────────────────
   Current settings in the app build (server defaults — keep in step with
   server/src/utils/seed.ts platform settings, priceEngine.service.ts
   (quote spread 2.5 %, platform fee 0.5 %), fxRateProvider.service.ts
   (fx_spread_pct default 1 %), p2p.controller.ts (0.5 %, seller pays),
   withdrawal.controller.ts (2 USD-equivalent bank withdrawal fee),
   business/payouts.service.ts (bulk pay falls back to transfer_fee = 0)
   and remittance/corridors.ts (pilot corridor pricing)). Final tariffs are
   published before launch — the page says so. */
const FREE = [
  { title: "company.fees.free.account.title", body: "company.fees.free.account.body" },
  { title: "company.fees.free.send.title", body: "company.fees.free.send.body" },
  { title: "company.fees.free.receive.title", body: "company.fees.free.receive.body" },
  { title: "company.fees.free.claim.title", body: "company.fees.free.claim.body" },
  { title: "company.fees.free.topup.title", body: "company.fees.free.topup.body" },
  { title: "company.fees.free.savings.title", body: "company.fees.free.savings.body" },
  { title: "company.fees.free.hold.title", body: "company.fees.free.hold.body" },
  { title: "company.fees.free.waitlist.title", body: "company.fees.free.waitlist.body" },
];
const PAID: { title: string; fee: string; notes: string; status?: Status }[] = [
  { title: "company.fees.paid.convert.title", fee: "company.fees.paid.convert.fee", notes: "company.fees.paid.convert.notes" },
  { title: "company.fees.paid.crypto.title", fee: "company.fees.paid.crypto.fee", notes: "company.fees.paid.crypto.notes" },
  { title: "company.fees.paid.p2p.title", fee: "company.fees.paid.p2p.fee", notes: "company.fees.paid.p2p.notes" },
  { title: "company.fees.paid.withdrawBank.title", fee: "company.fees.paid.withdrawBank.fee", notes: "company.fees.paid.withdrawBank.notes" },
  { title: "company.fees.paid.withdrawCrypto.title", fee: "company.fees.paid.withdrawCrypto.fee", notes: "company.fees.paid.withdrawCrypto.notes" },
  { title: "company.fees.paid.remit.title", fee: "company.fees.paid.remit.fee", notes: "company.fees.paid.remit.notes", status: "pilot" },
  { title: "company.fees.paid.bulk.title", fee: "company.fees.paid.bulk.fee", notes: "company.fees.paid.bulk.notes" },
  { title: "company.fees.paid.cardTopup.title", fee: "company.fees.paid.cardTopup.fee", notes: "company.fees.paid.cardTopup.notes", status: "planned" },
  { title: "company.fees.paid.cards.title", fee: "company.fees.paid.cards.fee", notes: "company.fees.paid.cards.notes", status: "planned" },
];
/* Proposed launch plans — the owner's proposal (previously page_fees_*);
   nothing is charged today. */
const PLANS = [
  { name: "company.fees.plans.everyday.name", price: "company.fees.plans.everyday.price", perks: ["company.fees.plans.everyday.perk1", "company.fees.plans.everyday.perk2"] },
  { name: "company.fees.plans.plus.name", price: "company.fees.plans.plus.price", perks: ["company.fees.plans.plus.perk1", "company.fees.plans.plus.perk2", "company.fees.plans.plus.perk3"] },
  { name: "company.fees.plans.business.name", price: "company.fees.plans.business.price", perks: ["company.fees.plans.business.perk1", "company.fees.plans.business.perk2", "company.fees.plans.business.perk3"], note: "company.fees.plans.business.note" },
];

function FeeTable() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const head = { fontSize: "12px", fontWeight: 600, color: theme.fgFaint, letterSpacing: "0.04em" } as const;
  const cols = { base: "minmax(0,1fr)", md: "minmax(0,1.1fr) minmax(0,0.8fr) minmax(0,1.4fr)" };
  return (
    <Box role="table" aria-label={t("company.fees.paid.eyebrow")}>
      <Box role="row" display={{ base: "none", md: "grid" }} gridTemplateColumns={cols} gap="24px" pb="12px" borderBottom="1px solid" borderColor={theme.divider}>
        <Box role="columnheader" {...head}>{t("company.fees.paid.col.service")}</Box>
        <Box role="columnheader" {...head}>{t("company.fees.paid.col.fee")}</Box>
        <Box role="columnheader" {...head}>{t("company.fees.paid.col.notes")}</Box>
      </Box>
      {PAID.map((r) => (
        <Box key={r.title} role="row" display="grid" gridTemplateColumns={cols} gap={{ base: "6px", md: "24px" }} py="20px" borderBottom="1px solid" borderColor={theme.border} alignItems="baseline">
          <Box role="rowheader" display="flex" flexWrap="wrap" alignItems="center" gap="10px" fontSize="17px" fontWeight={600} color={theme.fg}>
            {t(r.title)}{r.status && <StatusChip status={r.status} />}
          </Box>
          <Box role="cell" fontSize={{ base: "16px", md: "17px" }} fontWeight={600} color={theme.fg} sx={{ fontVariantNumeric: "tabular-nums" }}>{t(r.fee)}</Box>
          <Box role="cell" as="p" fontSize="15px" lineHeight={1.6} color={theme.fgMuted} style={{ textAlign: "start" }}>{t(r.notes)}</Box>
        </Box>
      ))}
    </Box>
  );
}

function FeesContent() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const { open } = useWaitlist();
  const rateSteps = [
    { title: t("company.fees.rate.mid.title"), body: t("company.fees.rate.mid.body") },
    { title: t("company.fees.rate.margin.title"), body: t("company.fees.rate.margin.body") },
    { title: t("company.fees.rate.yours.title"), body: t("company.fees.rate.yours.body") },
  ];
  const faqs = [
    { q: t("company.fees.faq.free.q"), a: t("company.fees.faq.free.a") },
    { q: t("company.fees.faq.hold.q"), a: t("company.fees.faq.hold.a") },
    { q: t("company.fees.faq.change.q"), a: t("company.fees.faq.change.a") },
    { q: t("company.fees.faq.earn.q"), a: t("company.fees.faq.earn.a") },
  ];

  return <>
    <MediaHero
      compact
      eyebrow={t("company.fees.hero.eyebrow")}
      title={t("company.fees.hero.title")}
      lead={t("company.fees.hero.lead")}
      actions={<>
        <SiteButton size="lg" onClick={open} arrow>{t("company.common.join")}</SiteButton>
        <SiteButton size="lg" variant="secondary" href="#calculator">{t("company.fees.hero.secondary")}</SiteButton>
      </>}
      note={t("company.fees.hero.note")}
    />

    {/* What's free */}
    <Section rule>
      <Container>
        <SectionHeader eyebrow={t("company.fees.free.eyebrow")} title={t("company.fees.free.title")} lead={t("company.fees.free.lead")} />
        <Box as="ul" listStyleType="none" mt="clamp(36px, 5vw, 64px)" display="grid"
          gridTemplateColumns={{ base: "minmax(0,1fr)", md: "repeat(2, minmax(0,1fr))" }} columnGap="clamp(24px, 4vw, 64px)">
          {FREE.map((f) => (
            <Box as="li" key={f.title} display="flex" alignItems="flex-start" gap="16px" py="20px" borderTop="1px solid" borderColor={theme.border}>
              <Box flex="1" minW={0}>
                <Box fontSize="17px" fontWeight={600} color={theme.fg}>{t(f.title)}</Box>
                <Box as="p" mt="4px" fontSize="15px" lineHeight={1.6} color={theme.fgMuted} style={{ textAlign: "start" }}>{t(f.body)}</Box>
              </Box>
              <Box flexShrink={0} display="inline-flex" alignItems="center" gap="6px" color={theme.green} fontSize="15px" fontWeight={600}>
                <FiCheck aria-hidden />{t("company.common.free")}
              </Box>
            </Box>
          ))}
        </Box>
      </Container>
    </Section>

    {/* What costs what */}
    <Section rule>
      <Container>
        <SectionHeader eyebrow={t("company.fees.paid.eyebrow")} title={t("company.fees.paid.title")} lead={t("company.fees.paid.lead")} />
        <Box mt="clamp(36px, 5vw, 64px)"><FeeTable /></Box>
      </Container>
    </Section>

    {/* The rate, explained — no rates-as-advice. */}
    <Section rule>
      <Container>
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,1.1fr) minmax(0,0.9fr)" }} gap="clamp(48px, 8vw, 120px)" alignItems="center">
          <Box>
            <SectionHeader layout="stack" eyebrow={t("company.fees.rate.eyebrow")} title={t("company.fees.rate.title")} lead={t("company.fees.rate.lead")} />
            <Box as="ol" listStyleType="none" mt="32px">
              {rateSteps.map((s, i) => (
                <Box as="li" key={i} display="grid" gridTemplateColumns="36px minmax(0,1fr)" gap="12px" py="18px" borderTop="1px solid" borderColor={theme.border}>
                  <Box fontSize="13px" fontWeight={600} color={theme.accentText} pt="3px" sx={{ fontVariantNumeric: "tabular-nums" }}>{String(i + 1).padStart(2, "0")}</Box>
                  <Box>
                    <Box fontSize="17px" fontWeight={600} color={theme.fg}>{s.title}</Box>
                    <Body mt="4px" fontSize="15px">{s.body}</Body>
                  </Box>
                </Box>
              ))}
            </Box>
            <Footnote mt="20px">{t("company.fees.rate.note")}</Footnote>
          </Box>
          <Box display="flex" flexDirection="column" alignItems="center" gap="16px">
            <Box position="relative">
              <Box aria-hidden position="absolute" inset="-20%" bg={theme.glow} pointerEvents="none" />
              <PhoneStage items={[{ screen: "exchange", alt: t("company.fees.rate.alt") }]} index={0} w="min(290px, 72vw)" />
            </Box>
            <Footnote align="center">{t("common.media.illustrative")}</Footnote>
          </Box>
        </Box>
      </Container>
    </Section>

    {/* Calculator */}
    <Section rule id="calculator">
      <Container>
        <SectionHeader eyebrow={t("company.fees.calc.eyebrow")} title={t("company.fees.calc.title")} lead={t("company.fees.calc.lead")} />
        <BentoGrid mt="clamp(36px, 5vw, 64px)">
          <Box gridColumn={{ base: "auto", md: "span 4" }} minW={0} border="1px solid" borderColor={theme.border} borderRadius="24px" bg={theme.bgElev} p={{ base: "22px", md: "34px" }}>
            <RemitCalculator />
          </Box>
          <BentoCard span={2} icon={FiSend} status="inApp" title={t("company.fees.calc.side.title")} body={t("company.fees.calc.side.body")} />
        </BentoGrid>
      </Container>
    </Section>

    {/* Proposed plans — clearly not final, nothing charged today. */}
    <Section rule>
      <Container>
        <SectionHeader eyebrow={t("company.fees.plans.eyebrow")} title={t("company.fees.plans.title")} lead={t("company.fees.plans.lead")} />
        <BentoGrid mt="clamp(36px, 5vw, 64px)">
          {PLANS.map((p) => (
            <Box key={p.name} gridColumn={{ base: "auto", md: "span 2" }} minW={0} border="1px solid" borderColor={theme.border} borderRadius="24px" bg={theme.bgElev}
              p={{ base: "26px", md: "34px" }} display="flex" flexDirection="column">
              <Box display="flex" alignItems="center" justifyContent="space-between" gap="10px">
                <Box fontSize="15px" fontWeight={600} color={theme.fgMuted}>{t(p.name)}</Box>
                <StatusChip status="planned" />
              </Box>
              <Headline mt="16px" text={t(p.price)} size="sub" as="h3" />
              <Box as="ul" listStyleType="none" mt="20px" display="grid" gap="10px">
                {p.perks.map((k) => (
                  <Box as="li" key={k} display="flex" gap="10px" alignItems="flex-start" fontSize="15px" color={theme.fgMuted} lineHeight={1.5}>
                    <Box as="span" mt="3px" color={theme.accentText} flexShrink={0}><FiCheck aria-hidden /></Box>{t(k)}
                  </Box>
                ))}
              </Box>
              {p.note && <Footnote mt="auto" pt="18px">{t(p.note)}</Footnote>}
            </Box>
          ))}
        </BentoGrid>
      </Container>
    </Section>

    {/* Questions */}
    <Section rule>
      <Container>
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,0.8fr) minmax(0,1.2fr)" }} gap="clamp(32px, 6vw, 96px)">
          <SectionHeader layout="stack" eyebrow={t("company.fees.faq.eyebrow")} title={t("company.fees.faq.title")} />
          <FAQList items={faqs} />
        </Box>
      </Container>
    </Section>

    <CTABand secondary={{ label: t("company.fees.cta.secondary"), href: "/faq" }} />
  </>;
}

export default function FeesPage() {
  return <SiteShell><FeesContent /></SiteShell>;
}
