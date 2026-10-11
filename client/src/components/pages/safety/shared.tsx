"use client";

/* Small local pieces shared by /security, /trust and /compliance. Built on
   the site kit; nothing here changes the kit itself. */

import NextLink from "next/link";
import { Box, type BoxProps } from "@chakra-ui/react";
import type { IconType } from "react-icons";
import { FiInfo } from "react-icons/fi";
import { Footnote, Reveal, useSiteLocale, useSiteTheme } from "@/components/site";

/** A chip with its own label — for states StatusChip has no word for
 *  ("Pre-launch"). Same look as StatusChip. */
export function LabelChip({ label, tone = "neutral" }: { label: string; tone?: "green" | "amber" | "neutral" | "accent" }) {
  const t = useSiteTheme();
  const { isAr } = useSiteLocale();
  const dot = tone === "green" ? t.green : tone === "amber" ? t.amber : tone === "accent" ? t.accentText : t.fgFaint;
  const bg = tone === "green" ? t.greenSoft : tone === "amber" ? t.amberSoft : "transparent";
  return (
    <Box
      as="span" display="inline-flex" alignItems="center" gap="7px" h="24px" px="10px" borderRadius="999px"
      bg={bg} border="1px solid" borderColor={bg === "transparent" ? t.border : "transparent"}
      fontSize="12px" fontWeight={500} letterSpacing={isAr ? 0 : "0.01em"} color={t.fgMuted} whiteSpace="nowrap" flexShrink={0}
    >
      <Box as="span" w="6px" h="6px" borderRadius="999px" bg={dot} aria-hidden />
      {label}
    </Box>
  );
}

/** A quiet note with a rule on its reading-start side — disclosures that
 *  must be seen but shouldn't shout. */
export function NoteStrip({ title, children, icon: Icon = FiInfo, ...rest }: { title?: string; icon?: IconType } & BoxProps) {
  const t = useSiteTheme();
  return (
    <Box
      display="flex" gap="14px" alignItems="flex-start" py="6px"
      sx={{ paddingInlineStart: "18px", borderInlineStart: `2px solid ${t.amber}` }}
      {...rest}
    >
      <Box color={t.amber} mt="3px" flexShrink={0} aria-hidden><Icon size={18} /></Box>
      <Box minW={0}>
        {title && <Box fontSize={{ base: "16px", md: "17px" }} fontWeight={600} color={t.fg} lineHeight={1.4}>{title}</Box>}
        <Box mt={title ? "6px" : 0} color={t.fgMuted} fontSize="15.5px" lineHeight={1.65} sx={{ "& p + p": { mt: "8px" } }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

/** "On this page" — numbered anchor links in a row of hairline columns. */
export function AnchorIndex({ label, items }: { label: string; items: { href: string; title: string; body: string }[] }) {
  const t = useSiteTheme();
  const { forward } = useSiteLocale();
  return (
    <Box as="nav" aria-label={label}>
      <Box
        as="ol" listStyleType="none" display="grid"
        gridTemplateColumns={{ base: "minmax(0,1fr)", md: `repeat(${items.length}, minmax(0,1fr))` }}
        gap={{ base: 0, md: "clamp(20px, 3vw, 40px)" }}
      >
        {items.map((it, i) => (
          <Box as="li" key={it.href}>
            <Reveal y={12} delay={i * 0.05}>
              <Box
                as={NextLink} href={it.href} display="block" borderTop="1px solid" borderColor={t.divider} py="18px" minH="44px"
                transition="border-color .2s ease" _hover={{ borderColor: t.fg }}
                _focusVisible={{ outline: `2px solid ${t.accentText}`, outlineOffset: "3px" }}
              >
                <Box fontSize="13px" fontWeight={600} color={t.accentText} sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {String(i + 1).padStart(2, "0")}
                </Box>
                <Box mt="8px" display="flex" alignItems="baseline" justifyContent="space-between" gap="12px">
                  <Box fontSize={{ base: "17px", md: "18px" }} fontWeight={600} color={t.fg}>{it.title}</Box>
                  <Box as="span" aria-hidden color={t.fgFaint}>{forward}</Box>
                </Box>
                <Box as="p" mt="4px" fontSize="15px" color={t.fgMuted} lineHeight={1.55} style={{ textAlign: "start" }}>{it.body}</Box>
              </Box>
            </Reveal>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Two-line definition rows: term on one side, explanation on the other. */
export function DefList({ items }: { items: { term: string; desc: string; trailing?: React.ReactNode }[] }) {
  const t = useSiteTheme();
  return (
    <Box as="dl" borderTop="1px solid" borderColor={t.border}>
      {items.map((it) => (
        <Box
          key={it.term}
          display="grid"
          gridTemplateColumns={{ base: "minmax(0,1fr)", md: "minmax(0,0.9fr) minmax(0,1.6fr)" }}
          gap={{ base: "4px", md: "28px" }}
          py="18px" borderBottom="1px solid" borderColor={t.border}
        >
          <Box as="dt" fontSize={{ base: "16px", md: "17px" }} fontWeight={600} color={t.fg} lineHeight={1.4}
            display="flex" alignItems="center" gap="10px" flexWrap="wrap">
            {it.term}{it.trailing}
          </Box>
          <Box as="dd" fontSize="15.5px" lineHeight={1.65} color={t.fgMuted}>{it.desc}</Box>
        </Box>
      ))}
    </Box>
  );
}

/** Media note under a phone. */
export function MediaNote({ text }: { text: string }) {
  return <Footnote align="center" mt="18px" maxW="34ch" mx="auto">{text}</Footnote>;
}
