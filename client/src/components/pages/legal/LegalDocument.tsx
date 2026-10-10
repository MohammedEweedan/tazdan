"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   LegalDocument — the reading layout shared by the privacy policy, terms,
   risk summary (and any page that uses components/ui/LegalPage).

   • Header: eyebrow, title, intro, "Last updated", print, optional notice.
   • Body: sticky contents with scroll-spy (column on desktop, bar on phones),
     numbered sections at a ~68ch measure, each with a copy-link anchor.
   • Related legal documents at the end; a clean print stylesheet.

   The wording is the approved copy passed in by the page — this component
   only lays it out (it strips a leading "1." from titles because it numbers
   sections itself).
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Box, VisuallyHidden } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiCheck, FiLink, FiPrinter } from "react-icons/fi";
import {
  Container, Eyebrow, Headline, Lead, Row, RowList, SectionLabel, useSiteLocale, useSiteTheme,
} from "@/components/site";
import { LegalParagraph } from "./LegalText";
import { DesktopToc, MobileToc, type TocItem } from "./LegalToc";
import LegalPageStyles from "./LegalPageStyles";
import { useScrollSpy } from "./useScrollSpy";

export type LegalSectionData = {
  /** Stable anchor id (keep it the same in every language). Defaults to section-N. */
  id?: string;
  title: string;
  /** A string is rendered as one paragraph (emails and /fees become links). */
  body: React.ReactNode;
  /** false: no number (e.g. a summary block). It is still listed in the contents. */
  numbered?: boolean;
  /** Small label shown in place of the number. */
  kicker?: string;
};

export type LegalDocumentProps = {
  eyebrow: string;
  title: string;
  /** Already-translated "Last updated: …" line. */
  updated?: string;
  intro?: string;
  sections: LegalSectionData[];
  /** Extra items for the meta line (e.g. reading time). */
  meta?: string[];
  /** Shown under the meta line — e.g. a regulatory warning (LegalNotice). */
  notice?: React.ReactNode;
  /** Link list of the other legal documents at the end. Default true. */
  related?: boolean;
};

const NUM_PREFIX = /^\s*[0-9٠-٩۰-۹]+\s*[.)٫\-–]\s*/;

const RELATED = [
  { href: "/terms", key: "common.footer.link.terms" },
  { href: "/privacy", key: "common.footer.link.privacy" },
  { href: "/risk", key: "common.footer.link.risk" },
  { href: "/compliance", key: "common.footer.link.compliance" },
] as const;

/* ── pieces ─────────────────────────────────────────────────────────────── */

function MetaDot() {
  const t = useSiteTheme();
  return <Box as="span" aria-hidden w="3px" h="3px" borderRadius="999px" bg={t.fgFaint} />;
}

function PrintButton() {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  return (
    <Box
      as="button"
      type="button"
      data-legal-noprint
      onClick={() => window.print()}
      display="inline-flex"
      alignItems="center"
      gap="7px"
      minH="44px"
      color={t.accentText}
      fontWeight={500}
      _hover={{ textDecoration: "underline", textUnderlineOffset: "4px" }}
      _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "3px", borderRadius: "6px" }}
    >
      <FiPrinter size={15} aria-hidden />
      {tr("legal.meta.print")}
    </Box>
  );
}

function AnchorButton({
  headingId, copied, onCopy,
}: { headingId: string; copied: boolean; onCopy: () => void }) {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  return (
    <Box
      as="button"
      type="button"
      data-legal-noprint
      onClick={onCopy}
      aria-label={tr("legal.anchor.copy")}
      aria-describedby={headingId}
      position="relative"
      flexShrink={0}
      w="44px"
      h="44px"
      mt="-8px"
      display="flex"
      alignItems="center"
      justifyContent="center"
      borderRadius="999px"
      color={copied ? t.green : t.fgFaint}
      transition="color .15s ease, background-color .15s ease"
      _hover={{ color: copied ? t.green : t.fg, bg: t.bgRaised }}
      _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "1px" }}
      sx={{ marginInlineEnd: "-12px" }}
    >
      {copied ? <FiCheck size={16} aria-hidden /> : <FiLink size={16} aria-hidden />}
      {copied && (
        <Box
          as="span"
          aria-hidden
          position="absolute"
          bottom="calc(100% + 2px)"
          whiteSpace="nowrap"
          px="9px"
          py="3px"
          borderRadius="999px"
          bg={t.fg}
          color={t.bg}
          fontSize="12px"
          fontWeight={500}
          pointerEvents="none"
          sx={{ insetInlineEnd: 0 }}
        >
          {tr("legal.anchor.copied")}
        </Box>
      )}
    </Box>
  );
}

/* ── document ───────────────────────────────────────────────────────────── */

export default function LegalDocument({
  eyebrow, title, updated, intro, sections, meta = [], notice, related = true,
}: LegalDocumentProps) {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const { isAr, forward } = useSiteLocale();
  const pathname = usePathname() ?? "";

  const items = useMemo(() => {
    let n = 0;
    return sections.map((s, i) => {
      const numbered = s.numbered !== false;
      if (numbered) n += 1;
      return {
        ...s,
        id: s.id ?? `section-${i + 1}`,
        label: (s.title ?? "").replace(NUM_PREFIX, ""),
        num: numbered ? String(n).padStart(2, "0") : null,
      };
    });
  }, [sections]);

  const toc: TocItem[] = items.map(({ id, label, num }) => ({ id, label, num }));
  const active = useScrollSpy(items.map((i) => i.id));

  // Copy-link: put the section URL on the clipboard and in the address bar.
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const copy = useCallback(async (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${id}`;
    try {
      window.history.replaceState(null, "", `#${id}`);
    } catch {
      /* ignore */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), 2200);
    } catch {
      /* no clipboard (insecure context) — the address bar now has the link */
    }
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Deep links: re-align once translations (lazy locales) have settled.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const handle = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    }, 120);
    return () => window.clearTimeout(handle);
  }, []);

  const metaItems = [updated, ...meta].filter(Boolean) as string[];
  const relatedDocs = RELATED.filter((d) => d.href !== pathname);
  const headingFix = { "html[lang='ar'] &": { lineHeight: "1.5 !important" } };

  return (
    <Box data-legal-doc>
      <LegalPageStyles />

      {/* header */}
      <Box as="header" data-legal-header borderBottom="1px solid" borderColor={t.border}>
        <Container pt="clamp(112px, 12vw, 164px)" pb="clamp(36px, 5vw, 64px)">
          {eyebrow && <Eyebrow mb="16px">{eyebrow}</Eyebrow>}
          <Headline as="h1" size="page" text={title} maxW="18ch" sx={{ ...headingFix, textWrap: "balance" }} />
          {intro && (
            <Lead mt="22px" maxW="60ch" dir="auto">
              {intro}
            </Lead>
          )}
          {(metaItems.length > 0 || true) && (
            <Box
              mt="20px"
              display="flex"
              flexWrap="wrap"
              alignItems="center"
              columnGap="14px"
              rowGap="0"
              fontSize="14px"
              color={t.fgFaint}
            >
              {metaItems.map((m, i) => (
                <Box as="span" key={i} display="inline-flex" alignItems="center" gap="14px" minH="44px">
                  {i > 0 && <MetaDot />}
                  <span>{m}</span>
                </Box>
              ))}
              <Box as="span" display="inline-flex" alignItems="center" gap="14px" data-legal-noprint>
                {metaItems.length > 0 && <MetaDot />}
                <PrintButton />
              </Box>
            </Box>
          )}
          {notice && (
            <Box mt="24px" maxW="68ch">
              {notice}
            </Box>
          )}
        </Container>
      </Box>

      {/* body */}
      <Container data-legal-body pt="clamp(28px, 5vw, 64px)" pb="clamp(80px, 10vw, 140px)">
        <Box
          data-legal-grid
          display={{ base: "block", lg: "grid" }}
          gridTemplateColumns="minmax(200px, 260px) minmax(0, 1fr)"
          columnGap="clamp(48px, 6vw, 96px)"
        >
          <MobileToc items={toc} active={active} />
          <DesktopToc items={toc} active={active} />

          <Box data-legal-content minW={0} maxW="68ch" fontSize={{ base: "16px", md: "17px" }}>
            {items.map((s, i) => (
              <Box
                as="section"
                key={s.id}
                id={s.id}
                aria-labelledby={`${s.id}-h`}
                data-legal-section
                mt={i === 0 ? 0 : "clamp(36px, 4.5vw, 56px)"}
                pt={i === 0 ? 0 : "clamp(36px, 4.5vw, 56px)"}
                borderTop={i === 0 ? undefined : "1px solid"}
                borderColor={t.border}
                sx={{
                  scrollMarginTop: "136px",
                  "@media (min-width: 62em)": { scrollMarginTop: "104px" },
                }}
              >
                {(s.num || s.kicker) && (
                  <Box
                    mb="10px"
                    fontSize="13px"
                    fontWeight={600}
                    color={t.fgFaint}
                    letterSpacing={s.kicker && !isAr ? "0.09em" : 0}
                    textTransform={s.kicker ? "uppercase" : undefined}
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {s.kicker ?? s.num}
                  </Box>
                )}
                <Box display="flex" alignItems="flex-start" gap="8px">
                  <Box
                    as="h2"
                    id={`${s.id}-h`}
                    dir="auto"
                    flex="1"
                    minW={0}
                    fontSize={{ base: "21px", md: "24px" }}
                    fontWeight={600}
                    letterSpacing={isAr ? 0 : "-0.02em"}
                    lineHeight={1.3}
                    color={t.fg}
                    sx={{ ...headingFix, textWrap: "balance" }}
                  >
                    {s.label}
                  </Box>
                  <AnchorButton headingId={`${s.id}-h`} copied={copied === s.id} onCopy={() => copy(s.id)} />
                </Box>
                <Box mt="14px">
                  {typeof s.body === "string" ? <LegalParagraph>{s.body}</LegalParagraph> : s.body}
                </Box>
              </Box>
            ))}

            {related && relatedDocs.length > 0 && (
              <Box
                as="nav"
                aria-labelledby="legal-related-h"
                data-legal-noprint
                mt="clamp(64px, 8vw, 104px)"
                pt="28px"
                borderTop="1px solid"
                borderColor={t.divider}
              >
                <SectionLabel id="legal-related-h" mb="6px">
                  {tr("legal.related.title")}
                </SectionLabel>
                <RowList sx={{ marginInline: "-12px" }}>
                  {relatedDocs.map((d) => (
                    <Row
                      key={d.href}
                      href={d.href}
                      padX="12px"
                      py="14px"
                      borderRadius="12px"
                      title={tr(d.key)}
                      trailing={<Box as="span" aria-hidden>{forward}</Box>}
                    />
                  ))}
                </RowList>
              </Box>
            )}
          </Box>
        </Box>
      </Container>

      <VisuallyHidden aria-live="polite">{copied ? tr("legal.anchor.copied") : ""}</VisuallyHidden>
    </Box>
  );
}
