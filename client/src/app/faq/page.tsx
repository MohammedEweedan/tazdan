"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, Input } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiSearch, FiX } from "react-icons/fi";
import {
  Body, Container, CTABand, Headline, MediaHero, Section, SiteButton, SiteShell, StatusChip, useSiteTheme,
} from "@/components/site";
import HelpAccordion from "@/components/pages/company/HelpAccordion";
import { FAQ_CATEGORIES } from "@/components/pages/company/faqData";
import { useFieldStyle } from "@/components/pages/company/fields";

function FAQContent() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const field = useFieldStyle();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const ring = theme.dark ? theme.accentText : theme.accent;

  // Deep links (#faq-<id> or #<category>) land on the right topic.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (FAQ_CATEGORIES.some((c) => c.id === hash)) setCategory(hash);
  }, []);

  const translated = useMemo(() => FAQ_CATEGORIES.map((c) => ({
    ...c,
    label: t(c.label),
    items: c.items.map((it) => ({
      id: it.id, q: t(it.q), a: t(it.a),
      link: it.link ? { href: it.link.href, label: t(it.link.label) } : undefined,
    })),
  })), [t]);

  const needle = query.trim().toLocaleLowerCase();
  const visible = useMemo(() => translated
    .filter((c) => needle || category === "all" || c.id === category)
    .map((c) => ({ ...c, items: needle ? c.items.filter((it) => `${it.q} ${it.a}`.toLocaleLowerCase().includes(needle)) : c.items }))
    .filter((c) => c.items.length > 0), [translated, needle, category]);
  const count = visible.reduce((n, c) => n + c.items.length, 0);

  const chip = (id: string, label: string) => {
    const on = !needle && category === id;
    return (
      <Box key={id} as="button" type="button" onClick={() => { setCategory(id); setQuery(""); }} aria-pressed={on}
        flexShrink={0} minH="44px" px="16px" borderRadius="999px" border="1px solid"
        borderColor={on ? theme.fg : theme.border} bg={on ? theme.fg : "transparent"} color={on ? theme.bg : theme.fgMuted}
        fontSize="14px" fontWeight={500} whiteSpace="nowrap" transition="background-color .15s ease, color .15s ease"
        _hover={on ? undefined : { borderColor: theme.borderStrong, color: theme.fg }}
        _focusVisible={{ outline: `2px solid ${ring}`, outlineOffset: "2px" }}>
        {label}
      </Box>
    );
  };

  return <>
    <MediaHero compact eyebrow={t("company.faq.hero.eyebrow")} title={t("company.faq.hero.title")} lead={t("company.faq.hero.lead")}>
      <Box role="search" maxW="640px" mx="auto" position="relative">
        <Box as="label" htmlFor="faq-search" position="absolute" w="1px" h="1px" overflow="hidden" sx={{ clip: "rect(0 0 0 0)" }}>
          {t("company.faq.search.label")}
        </Box>
        <Box aria-hidden position="absolute" top="0" bottom="0" display="flex" alignItems="center" color={theme.fgMuted} zIndex={1} pointerEvents="none"
          style={{ insetInlineStart: "18px" }}>
          <FiSearch size={19} />
        </Box>
        <Input id="faq-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("company.faq.search.placeholder")}
          h="58px" {...field} fontSize="16px" borderRadius="999px" bg={theme.bgElev} sx={{ paddingInlineStart: "50px", paddingInlineEnd: "52px" }} />
        {query && (
          <Box as="button" type="button" onClick={() => setQuery("")} aria-label={t("company.faq.search.clear")}
            position="absolute" top="7px" w="44px" h="44px" borderRadius="999px" display="flex" alignItems="center" justifyContent="center"
            color={theme.fgMuted} zIndex={1} _hover={{ color: theme.fg }} _focusVisible={{ outline: `2px solid ${ring}` }}
            style={{ insetInlineEnd: "7px" }}>
            <FiX size={18} />
          </Box>
        )}
      </Box>
    </MediaHero>

    <Section tight pt="clamp(40px, 5vw, 64px)">
      <Container narrow>
        <Box role="group" aria-label={t("company.faq.filter.label")}
          display="flex" gap="8px" overflowX={{ base: "auto", md: "visible" }} flexWrap={{ base: "nowrap", md: "wrap" }}
          justifyContent={{ base: "flex-start", md: "center" }} pb="6px" mx={{ base: "-16px", md: 0 }} px={{ base: "16px", md: 0 }}
          sx={{ scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
          {chip("all", t("company.faq.filter.all"))}
          {translated.map((c) => chip(c.id, c.label))}
        </Box>

        <Box role="status" aria-live="polite" mt="24px" fontSize="14px" color={theme.fgFaint} textAlign="center" minH="20px">
          {needle && <>{t("company.faq.results.label")} {count}</>}
        </Box>

        {count === 0 ? (
          <Box mt="40px" textAlign="center" display="flex" flexDirection="column" alignItems="center">
            <Headline text={t("company.faq.results.none.title")} size="sub" as="h2" textAlign="center" />
            <Body align="center" mt="12px">{t("company.faq.results.none.body")}</Body>
            <Box mt="20px" display="flex" gap="18px" flexWrap="wrap" justifyContent="center">
              <SiteButton variant="link" onClick={() => setQuery("")}>{t("company.faq.search.clear")}</SiteButton>
              <SiteButton variant="link" href="/contact" arrow>{t("company.faq.results.none.action")}</SiteButton>
            </Box>
          </Box>
        ) : (
          <Box mt="24px" display="grid" gap="clamp(48px, 6vw, 72px)">
            {visible.map((c) => (
              <Box as="section" key={c.id} id={c.id} aria-labelledby={`cat-${c.id}`} sx={{ scrollMarginTop: "96px" }}>
                <Box display="flex" alignItems="center" gap="12px" flexWrap="wrap" mb="14px">
                  <Headline id={`cat-${c.id}`} text={c.label} size="sub" as="h2" />
                  {c.status && <StatusChip status={c.status} />}
                </Box>
                <HelpAccordion items={c.items} />
              </Box>
            ))}
          </Box>
        )}
      </Container>
    </Section>

    <CTABand title={t("company.faq.contact.title")} lead={t("company.faq.contact.lead")}
      secondary={{ label: t("company.faq.contact.secondary"), href: "/contact" }} />
  </>;
}

export default function FAQPage() {
  return <SiteShell><FAQContent /></SiteShell>;
}
