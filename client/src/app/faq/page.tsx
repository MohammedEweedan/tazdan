"use client";

import { useMemo, useState } from "react";
import { Box, Input } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiSearch } from "react-icons/fi";
import {
  Body, Container, CTABand, FAQList, PageHero, Section, SectionHeader,
  SiteButton, SiteShell, useSiteTheme,
} from "@/components/site";

type Category = "all" | "getting" | "security" | "trading" | "wallet" | "card" | "fees" | "tokens";
const FAQS: { category: Category; q: string; a: string }[] = [
  { category: "getting", q: "page_help_faq1_q", a: "page_help_faq1_a" },
  { category: "trading", q: "page_help_faq2_q", a: "page_help_faq2_a" },
  { category: "security", q: "page_help_faq3_q", a: "page_help_faq3_a" },
  { category: "security", q: "page_help_faq4_q", a: "page_help_faq4_a" },
  { category: "wallet", q: "page_help_faq5_q", a: "page_help_faq5_a" },
  { category: "wallet", q: "page_help_faq6_q", a: "page_help_faq6_a" },
  { category: "tokens", q: "page_help_faq7_q", a: "page_help_faq7_a" },
  { category: "getting", q: "page_help_faq8_q", a: "page_help_faq8_a" },
  { category: "getting", q: "faq_s_q1", a: "faq_s_a1" },
  { category: "getting", q: "faq_s_q2", a: "faq_s_a2" },
  { category: "wallet", q: "faq_s_q3", a: "faq_s_a3" },
  { category: "fees", q: "faq_s_q4", a: "faq_s_a4" },
  { category: "security", q: "faq_s_q5", a: "faq_s_a5" },
  { category: "trading", q: "faq_s_q6", a: "faq_s_a6" },
  { category: "card", q: "faq_s_q7", a: "faq_s_a7" },
  { category: "getting", q: "faq_s_q8", a: "faq_s_a8" },
  { category: "tokens", q: "faq_s_q9", a: "faq_s_a9" },
  { category: "getting", q: "faq_s_q10", a: "faq_s_a10" },
];

function FAQContent() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const categories: { id: Category; label: string }[] = [
    { id: "all", label: t("faq_section_title") },
    { id: "getting", label: t("page_help_cat_getting") },
    { id: "security", label: t("page_help_cat_security") },
    { id: "trading", label: t("page_help_cat_trading") },
    { id: "wallet", label: t("page_help_cat_wallet") },
    { id: "card", label: t("page_help_cat_card") },
    { id: "fees", label: t("page_help_cat_fees") },
    { id: "tokens", label: t("page_help_cat_tokens") },
  ];
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const seen = new Set<string>();
    return FAQS.map((f) => ({ category: f.category, q: t(f.q), a: t(f.a) }))
      .filter((f) => {
        if (seen.has(f.q)) return false;
        seen.add(f.q);
        return (category === "all" || f.category === category || Boolean(needle))
          && (!needle || (f.q + " " + f.a).toLocaleLowerCase().includes(needle));
      });
  }, [category, query, t]);
  const clear = () => { setQuery(""); setCategory("all"); };

  return <>
    <PageHero eyebrow={t("nav_help")} title={t("page_help_title")} lead={t("page_help_sub")} />
    <Section rule><Container>
      <Box maxW="720px" mx="auto" position="relative">
        <Box aria-hidden position="absolute" top="18px" insetInlineStart="18px" color={theme.accentText}><FiSearch size={20} /></Box>
        <Input value={query} onChange={(e) => setQuery(e.target.value)}
          aria-label={t("page_help_search_ph")} placeholder={t("page_help_search_ph")}
          h="56px" borderRadius="14px" borderColor={theme.borderStrong} bg={theme.bgElev}
          color={theme.fg} sx={{ paddingInlineStart: "52px" }}
          _placeholder={{ color: theme.fgFaint }} _focusVisible={{ borderColor: theme.accent }} />
      </Box>
      <Box display="flex" gap="8px" flexWrap="wrap" mt="30px" justifyContent="center">
        {categories.map((c) => <Box key={c.id} as="button" type="button" onClick={() => setCategory(c.id)}
          aria-pressed={category === c.id} px="16px" h="40px" borderRadius="999px"
          border="1px solid" borderColor={category === c.id ? theme.accentBorder : theme.border}
          color={category === c.id ? theme.fg : theme.fgMuted}
          bg={category === c.id ? theme.accentSoft : "transparent"} fontSize="14px"
          _focusVisible={{ outline: "2px solid " + theme.accent, outlineOffset: "2px" }}>
          {c.label}
        </Box>)}
      </Box>
      <Box maxW="820px" mx="auto" mt="clamp(50px, 6vw, 84px)">
        <SectionHeader layout="stack" eyebrow={t("faq_section_title")} title={t("page_help_title")} lead={t("faq_section_sub")} />
        <Box mt="30px">{filtered.length ? <FAQList items={filtered} /> : <>
          <Body>{t("faq_no_results")}</Body>
          <Box mt="18px"><SiteButton variant="link" onClick={clear}>{t("faq_clear_search")}</SiteButton></Box>
        </>}</Box>
      </Box>
    </Container></Section>
    <CTABand title={t("page_help_contact_title")} lead={t("page_help_contact_d")} />
  </>;
}

export default function FAQPage() { return <SiteShell><FAQContent /></SiteShell>; }
