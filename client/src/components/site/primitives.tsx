"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Site primitives — the small vocabulary every public page is built from.

   The look follows the app: charcoal / paper surfaces, hairline rows instead
   of boxed cards, round icon discs, an ink pill for the primary action and
   the soft blue for accents only. Headlines are Outfit, tight, with ONE
   emphasised word written as *word* in the translated string.

   RTL: html[dir=rtl] flips flex/grid flow by itself. Use CSS logical
   properties (sx={{ paddingInlineStart }}) for one-sided spacing — never
   Chakra's ms/me/ps/pe, which stay LTR here.

   Paragraph alignment is set inline on purpose: globals.css justifies any
   <p> without an inline text-align, which wrecks ragged marketing copy.
   ═══════════════════════════════════════════════════════════════════════════ */

import { forwardRef } from "react";
import NextLink from "next/link";
import { Box, type BoxProps } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import type { IconType } from "react-icons";
import { FONT, MONO, SECTION_Y, useSiteLocale, useSiteTheme } from "./tokens";

export { Reveal } from "@/components/ui/appleKit";

/* ── layout ──────────────────────────────────────────────────────────────── */

/** Centred column with fluid side padding (16px minimum gutter on phones). */
export function Container({ children, wide, narrow, ...rest }: BoxProps & { wide?: boolean; narrow?: boolean }) {
  return (
    <Box
      w="100%"
      maxW={narrow ? "820px" : wide ? "1320px" : "1200px"}
      mx="auto"
      px="clamp(16px, 5vw, 48px)"
      {...rest}
    >
      {children}
    </Box>
  );
}

/** A page section: vertical rhythm, optional hairline on top, anchor id. */
export const Section = forwardRef<HTMLElement, BoxProps & { rule?: boolean; tight?: boolean }>(
  function Section({ children, rule, tight, ...rest }, ref) {
    const t = useSiteTheme();
    return (
      <Box
        as="section"
        ref={ref as any}
        position="relative"
        py={tight ? "clamp(56px, 7vw, 96px)" : SECTION_Y}
        borderTop={rule ? "1px solid" : undefined}
        borderColor={t.border}
        sx={{ scrollMarginTop: "84px" }}
        {...rest}
      >
        {children}
      </Box>
    );
  },
);

/* ── type ────────────────────────────────────────────────────────────────── */

/** Renders `*word*` spans of a translated string in the accent colour. */
export function Rich({ text }: { text: string }) {
  const t = useSiteTheme();
  const parts = (text ?? "").split(/\*([^*]+)\*/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          <Box as="em" key={i} fontStyle="normal" color={t.accentText}>
            {part}
          </Box>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Small accent line above a headline — the app's onboarding eyebrow. */
export function Eyebrow({ children, ...rest }: BoxProps) {
  const t = useSiteTheme();
  return (
    <Box fontSize={{ base: "13px", md: "14px" }} fontWeight={500} color={t.accentText} letterSpacing="0.005em" {...rest}>
      {children}
    </Box>
  );
}

/** Uppercase muted caption that heads a list — the app's SectionLabel. */
export function SectionLabel({ children, ...rest }: BoxProps) {
  const t = useSiteTheme();
  const { isAr } = useSiteLocale();
  return (
    <Box
      fontSize="12px"
      fontWeight={600}
      letterSpacing={isAr ? 0 : "0.09em"}
      textTransform="uppercase"
      color={t.fgFaint}
      {...rest}
    >
      {children}
    </Box>
  );
}

const HEADLINE_SIZES = {
  hero: "clamp(44px, 6.6vw, 92px)",
  page: "clamp(40px, 5.6vw, 76px)",
  section: "clamp(32px, 4.4vw, 58px)",
  sub: "clamp(26px, 3vw, 38px)",
  item: "clamp(20px, 1.8vw, 24px)",
} as const;

/** Headline. `text` may contain one `*emphasised*` word. */
export function Headline({
  text, size = "section", as, ...rest
}: { text: string; size?: keyof typeof HEADLINE_SIZES; as?: "h1" | "h2" | "h3" | "h4" | "p" } & BoxProps) {
  const t = useSiteTheme();
  const { isAr } = useSiteLocale();
  const big = size === "hero" || size === "page";
  return (
    <Box
      as={as ?? (big ? "h1" : size === "item" ? "h3" : "h2")}
      fontFamily={FONT}
      fontSize={HEADLINE_SIZES[size]}
      fontWeight={size === "item" ? 600 : 600}
      letterSpacing={isAr ? 0 : big ? "-0.045em" : size === "item" ? "-0.015em" : "-0.035em"}
      lineHeight={isAr ? 1.3 : big ? 1.0 : size === "item" ? 1.25 : 1.06}
      color={t.fg}
      sx={{ textWrap: "balance" }}
      {...rest}
    >
      <Rich text={text} />
    </Box>
  );
}

/** Large intro paragraph under a headline. */
export function Lead({ children, align = "start", ...rest }: { align?: "start" | "center" } & BoxProps) {
  const t = useSiteTheme();
  return (
    <Box
      as="p"
      color={t.fgMuted}
      fontSize={{ base: "17px", md: "20px" }}
      lineHeight={1.55}
      style={{ textAlign: align }}
      sx={{ textWrap: "pretty" }}
      {...rest}
    >
      {children}
    </Box>
  );
}

/** Body paragraph. */
export function Body({ children, align = "start", ...rest }: { align?: "start" | "center" } & BoxProps) {
  const t = useSiteTheme();
  return (
    <Box
      as="p"
      color={t.fgMuted}
      fontSize={{ base: "15.5px", md: "16.5px" }}
      lineHeight={1.65}
      style={{ textAlign: align }}
      sx={{ textWrap: "pretty" }}
      {...rest}
    >
      {children}
    </Box>
  );
}

/** Small faint footnote — disclosures, "illustrative" notes, sources. */
export function Footnote({ children, align = "start", ...rest }: { align?: "start" | "center" } & BoxProps) {
  const t = useSiteTheme();
  return (
    <Box as="p" color={t.fgFaint} fontSize="13px" lineHeight={1.6} style={{ textAlign: align }} {...rest}>
      {children}
    </Box>
  );
}

/** Mono text for figures, codes, API snippets. */
export function Mono({ children, ...rest }: BoxProps) {
  return (
    // data-mono opts out of the Arabic font override in theme/globals.css.
    <Box as="span" data-mono="" fontFamily={MONO} fontSize="0.92em" letterSpacing="0" {...rest}>
      {children}
    </Box>
  );
}

/* ── actions ─────────────────────────────────────────────────────────────── */

type ButtonProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "link";
  size?: "md" | "lg";
  href?: string;
  external?: boolean;
  onClick?: () => void;
  arrow?: boolean;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
} & Omit<BoxProps, "onClick">;

/** Ink pill (primary, like the app's Continue button), hairline pill
 *  (secondary) or accent text link with an arrow. */
export function SiteButton({
  children, variant = "primary", size = "md", href, external, onClick, arrow, type = "button", disabled, ...rest
}: ButtonProps) {
  const t = useSiteTheme();
  const { forward } = useSiteLocale();
  const link = variant === "link";
  const linkProps = href
    ? external
      ? { as: "a" as const, href, target: "_blank", rel: "noopener noreferrer" }
      : { as: NextLink, href }
    : { as: "button" as const, type, disabled, onClick };
  return (
    <Box
      {...linkProps}
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      gap="8px"
      h={link ? "auto" : size === "lg" ? "52px" : "44px"}
      px={link ? 0 : size === "lg" ? "26px" : "20px"}
      borderRadius="999px"
      border={link ? "none" : "1px solid"}
      borderColor={variant === "primary" ? t.fg : t.borderStrong}
      bg={variant === "primary" ? t.fg : "transparent"}
      color={variant === "primary" ? t.bg : link ? t.accentText : t.fg}
      fontFamily={FONT}
      fontSize={size === "lg" ? "16px" : "15px"}
      fontWeight={600}
      whiteSpace="nowrap"
      cursor="pointer"
      transition="transform .18s ease, background-color .18s ease, border-color .18s ease, opacity .18s ease"
      _hover={
        link
          ? { textDecoration: "underline", textUnderlineOffset: "4px" }
          : variant === "primary"
            ? { opacity: 0.88 }
            : { borderColor: t.fg }
      }
      _active={link ? undefined : { transform: "scale(0.98)" }}
      _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "3px" }}
      {...rest}
    >
      {children}
      {arrow && (
        <Box as="span" aria-hidden fontWeight={400}>
          {forward}
        </Box>
      )}
    </Box>
  );
}

/* ── status ──────────────────────────────────────────────────────────────── */

/** Honest availability labels. Use the one that matches docs/audit/FEATURE_MATRIX.md:
 *  inApp      — built and working in the current app build ("Ready")
 *  pilot      — complete, running on sandbox rails until a partner is live
 *  planned    — designed / off in production until a partner is contracted
 *  inProgress — work under way (e.g. a licence application)
 *  discussion — conversations open, nothing signed
 *  pipeline   — a prospective partner, no agreement
 *  notBuilt   — said plainly: not in the product (yet)
 *  signed / licensed / live — for partners & licensing once they're real */
export type Status =
  | "inApp" | "pilot" | "planned" | "inProgress" | "discussion" | "pipeline"
  | "notBuilt" | "signed" | "licensed" | "live";

/** `label` overrides the status text (e.g. "Pre-launch") while keeping its tone. */
export function StatusChip({ status, label, ...rest }: { status: Status; label?: string } & BoxProps) {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const { isAr } = useSiteLocale();
  const tone = {
    inApp: { dot: t.green, bg: t.greenSoft },
    pilot: { dot: t.accentText, bg: t.accentSoft },
    planned: { dot: t.fgFaint, bg: "transparent" },
    inProgress: { dot: t.amber, bg: t.amberSoft },
    discussion: { dot: t.amber, bg: "transparent" },
    pipeline: { dot: t.fgFaint, bg: "transparent" },
    notBuilt: { dot: "transparent", bg: "transparent" },
    signed: { dot: t.green, bg: t.greenSoft },
    licensed: { dot: t.green, bg: t.greenSoft },
    live: { dot: t.green, bg: t.greenSoft },
  }[status];
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      gap="7px"
      h="24px"
      px="10px"
      borderRadius="999px"
      bg={tone.bg}
      border="1px solid"
      borderColor={tone.bg === "transparent" ? t.border : "transparent"}
      borderStyle={status === "notBuilt" ? "dashed" : "solid"}
      fontSize="12px"
      fontWeight={500}
      letterSpacing={isAr ? 0 : "0.01em"}
      color={t.fgMuted}
      whiteSpace="nowrap"
      flexShrink={0}
      {...rest}
    >
      <Box
        as="span"
        w="6px"
        h="6px"
        borderRadius="999px"
        bg={tone.dot}
        border={status === "notBuilt" ? `1px solid ${t.fgFaint}` : undefined}
        aria-hidden
      />
      {label ?? tr(`common.status.${status}`)}
    </Box>
  );
}

/* ── lists ───────────────────────────────────────────────────────────────── */

/** Round icon disc — the app's "Move money" grid glyph. */
export function IconDisc({
  icon: Icon, size = 40, tone = "accent",
}: { icon: IconType; size?: number; tone?: "accent" | "neutral" | "green" }) {
  const t = useSiteTheme();
  const bg = tone === "accent" ? t.accentSoft : tone === "green" ? t.greenSoft : t.bgRaised;
  const fg = tone === "accent" ? t.accentText : tone === "green" ? t.green : t.fg;
  return (
    <Box
      w={`${size}px`}
      h={`${size}px`}
      minW={`${size}px`}
      borderRadius="999px"
      bg={bg}
      color={fg}
      display="flex"
      alignItems="center"
      justifyContent="center"
      aria-hidden
    >
      <Icon size={Math.round(size * 0.45)} />
    </Box>
  );
}

/** Grouped surface for a list of rows — the app's Panel. Use sparingly:
 *  most lists on the site are bare hairline rows (RowList without panel). */
export function Panel({ children, ...rest }: BoxProps) {
  const t = useSiteTheme();
  return (
    <Box bg={t.bgElev} borderRadius="22px" border="1px solid" borderColor={t.border} overflow="hidden" {...rest}>
      {children}
    </Box>
  );
}

/** Vertical list of rows separated by hairlines. */
export function RowList({ children, panel, ...rest }: BoxProps & { panel?: boolean }) {
  const t = useSiteTheme();
  const inner = (
    <Box
      role="list"
      sx={{
        "& > [role=listitem] + [role=listitem]": { borderTop: `1px solid ${t.border}` },
      }}
      {...(panel ? {} : rest)}
    >
      {children}
    </Box>
  );
  return panel ? <Panel {...rest}>{inner}</Panel> : inner;
}

/** One row: optional icon disc, title, description, trailing slot. */
export function Row({
  icon, title, body, trailing, href, padX, ...rest
}: {
  icon?: IconType;
  title: React.ReactNode;
  body?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  /** horizontal padding — set when the list sits inside a Panel */
  padX?: string;
} & Omit<BoxProps, "title">) {
  const t = useSiteTheme();
  const linkProps = href ? { as: NextLink, href } : {};
  return (
    <Box
      role="listitem"
      {...linkProps}
      display="flex"
      alignItems={body ? "flex-start" : "center"}
      gap="16px"
      py="18px"
      px={padX}
      transition="background-color .16s ease"
      _hover={href ? { bg: t.bgRaised } : undefined}
      {...rest}
    >
      {icon && <IconDisc icon={icon} />}
      <Box flex="1" minW={0}>
        <Box fontSize={{ base: "16px", md: "17px" }} fontWeight={600} color={t.fg} lineHeight={1.35}>
          {title}
        </Box>
        {body && (
          <Box as="p" mt="4px" fontSize="15px" lineHeight={1.6} color={t.fgMuted} style={{ textAlign: "start" }}>
            {body}
          </Box>
        )}
      </Box>
      {trailing && (
        <Box flexShrink={0} alignSelf="center" color={t.fgMuted} fontSize="15px">
          {trailing}
        </Box>
      )}
    </Box>
  );
}

/* ── figures ─────────────────────────────────────────────────────────────── */

/** A figure with a label under a hairline — for stat rows. */
export function Stat({ value, label, note }: { value: React.ReactNode; label: React.ReactNode; note?: React.ReactNode }) {
  const t = useSiteTheme();
  return (
    <Box borderTop="1px solid" borderColor={t.divider} pt="16px">
      <Box
        fontSize="clamp(30px, 3.6vw, 48px)"
        fontWeight={600}
        letterSpacing="-0.035em"
        lineHeight={1.05}
        color={t.fg}
        sx={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </Box>
      <Box mt="8px" fontSize="15px" color={t.fgMuted} lineHeight={1.45}>
        {label}
      </Box>
      {note && (
        <Box mt="4px" fontSize="12.5px" color={t.fgFaint}>
          {note}
        </Box>
      )}
    </Box>
  );
}

/** Thin horizontal rule. */
export function Rule(props: BoxProps) {
  const t = useSiteTheme();
  return <Box as="hr" border="none" borderTop="1px solid" borderColor={t.border} {...props} />;
}
