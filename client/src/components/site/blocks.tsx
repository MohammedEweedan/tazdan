"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Blocks — page-level compositions built from the primitives.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { Box, Collapse, type BoxProps } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import type { IconType } from "react-icons";
import { FiPlus } from "react-icons/fi";
import {
  Body, Container, Eyebrow, Footnote, Headline, IconDisc, Lead, Reveal, Section, SiteButton, StatusChip, type Status,
} from "./primitives";
import { useWaitlist } from "./SiteShell";
import { useSiteTheme } from "./tokens";

/** Page hero: eyebrow, headline, lead, actions, optional visual underneath
 *  (centred) or beside it (split). */
export function PageHero({
  eyebrow, title, lead, actions, visual, align = "center", note, size = "page",
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  actions?: React.ReactNode;
  visual?: React.ReactNode;
  align?: "center" | "split";
  note?: string;
  size?: "hero" | "page";
}) {
  const t = useSiteTheme();
  if (align === "split") {
    return (
      <Box as="header" position="relative" overflow="hidden">
        <Container pt="clamp(112px, 13vw, 168px)" pb="clamp(56px, 8vw, 112px)">
          <Box
            display="grid"
            gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,1.1fr) minmax(0,0.9fr)" }}
            gap="clamp(40px, 6vw, 88px)"
            alignItems="center"
          >
            <Box>
              {eyebrow && <Eyebrow mb="16px">{eyebrow}</Eyebrow>}
              <Headline text={title} size={size} maxW="14ch" />
              {lead && <Lead mt="22px" maxW="40ch">{lead}</Lead>}
              {actions && <Box mt="32px" display="flex" gap="12px" flexWrap="wrap" alignItems="center">{actions}</Box>}
              {note && <Footnote mt="18px" maxW="52ch">{note}</Footnote>}
            </Box>
            {visual && (
              <Box position="relative" display="flex" justifyContent="center">
                <Box aria-hidden position="absolute" inset="-10%" bg={t.glow} pointerEvents="none" />
                {visual}
              </Box>
            )}
          </Box>
        </Container>
      </Box>
    );
  }
  return (
    <Box as="header" position="relative" overflow="hidden">
      <Box aria-hidden position="absolute" top="-10%" left="0" right="0" h="70%" bg={t.glow} pointerEvents="none" opacity={0.8} />
      <Container
        position="relative"
        pt="clamp(116px, 14vw, 180px)"
        pb={visual ? "0" : "clamp(48px, 7vw, 96px)"}
        display="flex"
        flexDirection="column"
        alignItems="center"
        textAlign="center"
      >
        {eyebrow && <Eyebrow mb="18px">{eyebrow}</Eyebrow>}
        <Headline text={title} size={size} maxW="15ch" textAlign="center" />
        {lead && <Lead align="center" mt="22px" maxW="38ch">{lead}</Lead>}
        {actions && (
          <Box mt="32px" display="flex" gap="12px" flexWrap="wrap" justifyContent="center" alignItems="center">
            {actions}
          </Box>
        )}
        {note && <Footnote align="center" mt="18px" maxW="56ch">{note}</Footnote>}
      </Container>
      {visual && <Container position="relative" mt="clamp(48px, 6vw, 80px)">{visual}</Container>}
    </Box>
  );
}

/** Section header: eyebrow + headline, lead beside (split) or under (stack). */
export function SectionHeader({
  eyebrow, title, lead, actions, layout = "split", align = "start", ...rest
}: {
  eyebrow?: string;
  title: string;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  layout?: "split" | "stack";
  align?: "start" | "center";
} & BoxProps) {
  const centered = align === "center";
  if (layout === "stack" || centered) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems={centered ? "center" : "flex-start"}
        textAlign={centered ? "center" : undefined}
        {...rest}
      >
        {eyebrow && <Eyebrow mb="14px">{eyebrow}</Eyebrow>}
        <Headline text={title} maxW="20ch" textAlign={centered ? "center" : undefined} />
        {lead && <Lead align={centered ? "center" : "start"} mt="18px" maxW="44ch">{lead}</Lead>}
        {actions && <Box mt="26px" display="flex" gap="12px" flexWrap="wrap">{actions}</Box>}
      </Box>
    );
  }
  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1fr)" }}
      gap="clamp(18px, 4vw, 72px)"
      alignItems="end"
      {...rest}
    >
      <Box>
        {eyebrow && <Eyebrow mb="14px">{eyebrow}</Eyebrow>}
        <Headline text={title} maxW="17ch" />
      </Box>
      {(lead || actions) && (
        <Box>
          {lead && <Lead maxW="44ch">{lead}</Lead>}
          {actions && <Box mt="22px" display="flex" gap="12px" flexWrap="wrap">{actions}</Box>}
        </Box>
      )}
    </Box>
  );
}

export type FeatureItem = { icon?: IconType; title: string; body: string; status?: Status; href?: string; linkLabel?: string };

/** Grid of features — hairline-topped columns, no boxes. */
export function FeatureGrid({ items, columns = 3 }: { items: FeatureItem[]; columns?: 2 | 3 | 4 }) {
  const t = useSiteTheme();
  return (
    <Box
      display="grid"
      gridTemplateColumns={{
        base: "minmax(0,1fr)",
        sm: "repeat(2, minmax(0,1fr))",
        lg: `repeat(${columns}, minmax(0,1fr))`,
      }}
      columnGap="clamp(20px, 3vw, 44px)"
      rowGap="clamp(32px, 4vw, 52px)"
    >
      {items.map((it, i) => (
          <Box key={i} borderTop="1px solid" borderColor={t.divider} pt="22px" h="100%" display="flex" flexDirection="column">
            <Box display="flex" alignItems="center" justifyContent="space-between" gap="12px" mb="18px">
              {it.icon ? <IconDisc icon={it.icon} /> : <span />}
              {it.status && <StatusChip status={it.status} />}
            </Box>
            <Headline text={it.title} size="item" />
            <Body mt="8px" fontSize="15.5px">{it.body}</Body>
            {it.href && (
              <Box mt="auto" pt="14px">
                <SiteButton variant="link" href={it.href} arrow>{it.linkLabel}</SiteButton>
              </Box>
            )}
          </Box>
      ))}
    </Box>
  );
}

/** Numbered steps (01, 02, 03 …) across a row. */
export function Steps({ items }: { items: { title: string; body: string }[] }) {
  const t = useSiteTheme();
  return (
    <Box
      as="ol"
      listStyleType="none"
      display="grid"
      gridTemplateColumns={{ base: "minmax(0,1fr)", md: `repeat(${Math.min(items.length, 4)}, minmax(0,1fr))` }}
      gap="clamp(24px, 3vw, 40px)"
    >
      {items.map((s, i) => (
        <Reveal key={i} y={16} delay={i * 0.06}>
          <Box as="li" borderTop="1px solid" borderColor={t.fg} pt="18px">
            <Box fontSize="13px" fontWeight={600} color={t.accentText} sx={{ fontVariantNumeric: "tabular-nums" }}>
              {String(i + 1).padStart(2, "0")}
            </Box>
            <Box mt="10px" fontSize="18px" fontWeight={600} color={t.fg} lineHeight={1.35}>{s.title}</Box>
            <Body mt="6px" fontSize="15px">{s.body}</Body>
          </Box>
        </Reveal>
      ))}
    </Box>
  );
}

/** Accordion FAQ — hairline rows with a plus that turns into a cross. */
export function FAQList({ items }: { items: { q: string; a: string }[] }) {
  const t = useSiteTheme();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Box borderBottom="1px solid" borderColor={t.border}>
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <Box key={i} borderTop="1px solid" borderColor={t.border}>
            <Box
              as="button"
              type="button"
              w="100%"
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              gap="16px"
              py="22px"
              textAlign="start"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "2px" }}
            >
              <Box fontSize={{ base: "16.5px", md: "18px" }} fontWeight={500} color={t.fg} lineHeight={1.4}>{it.q}</Box>
              <Box
                as="span"
                aria-hidden
                color={t.fgMuted}
                transition="transform .25s ease"
                transform={isOpen ? "rotate(45deg)" : "none"}
                flexShrink={0}
              >
                <FiPlus size={20} />
              </Box>
            </Box>
            <Collapse in={isOpen} animateOpacity>
              <Body pb="24px" maxW="70ch">{it.a}</Body>
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );
}

/** Closing call to action used at the bottom of most pages. Defaults to the
 *  shared waitlist copy (common.cta.*). */
export function CTABand({
  title, lead, note, secondary,
}: { title?: string; lead?: string; note?: string; secondary?: { label: string; href: string } }) {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const { open } = useWaitlist();
  return (
    <Section>
      <Container>
        <Box position="relative" textAlign="center" display="flex" flexDirection="column" alignItems="center">
          <Box aria-hidden position="absolute" inset="-30% 0" bg={t.glow} pointerEvents="none" />
          <Headline position="relative" text={title ?? tr("common.cta.title")} maxW="16ch" textAlign="center" />
          <Lead position="relative" align="center" mt="18px" maxW="40ch">{lead ?? tr("common.cta.lead")}</Lead>
          <Box position="relative" mt="30px" display="flex" gap="12px" flexWrap="wrap" justifyContent="center">
            <SiteButton size="lg" onClick={open} arrow>{tr("common.cta.primary")}</SiteButton>
            <SiteButton size="lg" variant="secondary" href={secondary?.href ?? "/features"}>
              {secondary?.label ?? tr("common.cta.secondary")}
            </SiteButton>
          </Box>
          <Footnote position="relative" align="center" mt="18px" maxW="56ch">{note ?? tr("common.cta.note")}</Footnote>
        </Box>
      </Container>
    </Section>
  );
}
