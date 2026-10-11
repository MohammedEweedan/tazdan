"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Landing kit — the small set of primitives the landing page is built from.

   The look is deliberately editorial: white (or charcoal) page, hairline
   rules, medium-weight sans headlines with ONE italic serif keyword, mono
   eyebrows and numbered modules. Colour stays out of the way — the brand blue
   is accent-only (the mascot, the active tab, focus rings), never a CTA fill.

   Headlines come in two voices, picked by <LandingStyleProvider>:
     editorial — medium weight, one italic SERIF keyword (the default, `/`).
     bold      — the classic page's voice: heavy DM Sans, tight tracking, the
                 keyword in italic brand blue (the hybrid, `/hybrid`).
   ═══════════════════════════════════════════════════════════════════════════ */

import { createContext, forwardRef, useContext } from "react";
import NextLink from "next/link";
import { Box, useColorMode, type BoxProps } from "@chakra-ui/react";
import { useAppleLocale } from "@/components/ui/appleKit";

export const SERIF = "var(--font-serif-display), 'Instrument Serif', Georgia, serif";
export const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";
export const EASE = [0.25, 0.1, 0.25, 1] as const;
export const SECTION_GAP = "clamp(96px, 12vw, 176px)";

export function useLandingTheme() {
  const dark = useColorMode().colorMode === "dark";
  return {
    dark,
    bg: dark ? "#16181C" : "#FFFFFF",
    fg: dark ? "#F4F5F7" : "#0A0A0B",
    sub: dark ? "rgba(244,245,247,0.66)" : "rgba(10,10,11,0.64)",
    faint: dark ? "rgba(244,245,247,0.42)" : "rgba(10,10,11,0.42)",
    line: dark ? "rgba(255,255,255,0.12)" : "#E5E5E5",
    lineStrong: dark ? "#F4F5F7" : "#0A0A0B",
    panel: dark ? "#1B1E23" : "#FAFAFA",
    card: dark ? "#1E2127" : "#FFFFFF",
    cardRaised: dark ? "#262A31" : "#F4F5F7",
    dot: dark ? "rgba(255,255,255,0.07)" : "rgba(10,10,11,0.075)",
    accent: "#63A1DB",
    accentText: dark ? "#8BBCE8" : "#3E78AE",
    accentSoft: dark ? "rgba(99,161,219,0.16)" : "rgba(99,161,219,0.14)",
    green: dark ? "#3FCF8E" : "#1F8F58",
    greenSoft: dark ? "rgba(63,207,142,0.14)" : "rgba(31,143,88,0.10)",
  };
}

export type LandingTheme = ReturnType<typeof useLandingTheme>;

export type LandingStyle = "editorial" | "bold";
const LandingStyleContext = createContext<LandingStyle>("editorial");
export const LandingStyleProvider = LandingStyleContext.Provider;
export const useLandingStyle = () => useContext(LandingStyleContext);

/** Physical sides for the reading direction. Chakra v2's insetStart / insetEnd
 *  / borderStart* props resolve from the Chakra theme's direction (LTR here),
 *  not the page's dir="rtl", so anything positioned toward a side picks
 *  left/right explicitly through this. */
export function useSides() {
  const { isAr } = useAppleLocale();
  return isAr
    ? ({ start: "right", end: "left", Start: "Right", End: "Left" } as const)
    : ({ start: "left", end: "right", Start: "Left", End: "Right" } as const);
}

/** Centred 1200px column with fluid side padding. */
export function Container({ children, ...rest }: BoxProps) {
  return (
    <Box w="100%" maxW="1200px" mx="auto" px="clamp(16px, 5vw, 48px)" {...rest}>
      {children}
    </Box>
  );
}

/** The one emphasised keyword in a headline. Arabic has no italic in these
 *  faces (globals.css swaps the family to Outfit/Cairo), so there the emphasis
 *  is carried by colour instead of a synthetic slant. */
export function Serif({ children }: { children: React.ReactNode }) {
  const { isAr } = useAppleLocale();
  const { accentText } = useLandingTheme();
  if (useLandingStyle() === "bold") {
    return (
      <Box as="em" fontStyle={isAr ? "normal" : "italic"} fontWeight={600} color={accentText}>
        {children}
      </Box>
    );
  }
  return (
    <Box
      as="em"
      fontFamily={SERIF}
      fontStyle={isAr ? "normal" : "italic"}
      fontWeight={isAr ? "inherit" : 400}
      fontSize={isAr ? "1em" : "1.08em"}
      letterSpacing="-0.01em"
      color={isAr ? accentText : "inherit"}
    >
      {children}
    </Box>
  );
}

/** Renders `*word*` spans of a translated string through <Serif>. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/\*([^*]+)\*/);
  return (
    <>
      {parts.map((part, i) => (i % 2 ? <Serif key={i}>{part}</Serif> : part))}
    </>
  );
}

/** Section headline — tight tracking, balanced wrap, weight per voice. */
export function Headline({
  text, size = "section", as = "h2", ...rest
}: { text: string; size?: "hero" | "section" | "sub"; as?: "h1" | "h2" | "h3" } & BoxProps) {
  const { fg } = useLandingTheme();
  const { isAr } = useAppleLocale();
  const bold = useLandingStyle() === "bold";
  const fontSize =
    size === "hero" ? "clamp(42px, 5.75vw, 76px)"
    : size === "section" ? (bold ? "clamp(34px, 4.4vw, 60px)" : "clamp(34px, 4vw, 52px)")
    : "clamp(30px, 3.6vw, 46px)";
  return (
    <Box
      as={as}
      fontSize={fontSize}
      fontWeight={bold ? 700 : 500}
      letterSpacing={bold ? "-0.04em" : "-0.03em"}
      lineHeight={isAr ? 1.25 : bold ? 1.02 : size === "hero" ? 1.06 : 1.1}
      color={fg}
      sx={{ textWrap: "balance" }}
      {...rest}
    >
      <Rich text={text} />
    </Box>
  );
}

/** Body paragraph. Alignment is set inline on purpose: globals.css justifies
 *  every <p> that lacks an inline text-align, which ruins ragged copy. */
export function Para({
  children, align = "start", ...rest
}: { children: React.ReactNode; align?: "start" | "center" } & BoxProps) {
  const { sub } = useLandingTheme();
  return (
    <Box
      as="p"
      color={sub}
      fontSize={{ base: "16px", md: "17px" }}
      lineHeight={1.65}
      style={{ textAlign: align }}
      sx={{ textWrap: "pretty" }}
      {...rest}
    >
      {children}
    </Box>
  );
}

/** Mono eyebrow / footnote text. */
export function Mono({ children, ...rest }: { children: React.ReactNode } & BoxProps) {
  const { faint } = useLandingTheme();
  return (
    <Box fontFamily={MONO} fontSize="12.5px" letterSpacing="0.02em" color={faint} {...rest}>
      {children}
    </Box>
  );
}

type PillProps = {
  children: React.ReactNode;
  variant?: "primary" | "outline" | "text";
  size?: "md" | "lg";
  href?: string;
  onClick?: () => void;
  arrow?: boolean;
} & Omit<BoxProps, "onClick">;

/** Pill button — ink on paper. Primary is a solid ink pill that inverts on
 *  hover; outline is the reverse. Renders a Next link when `href` is set. */
export function Pill({
  children, variant = "primary", size = "md", href, onClick, arrow, ...rest
}: PillProps) {
  const t = useLandingTheme();
  const { isAr } = useAppleLocale();
  const solid = variant === "primary";
  const linkProps = href ? { as: NextLink, href } : { as: "button" as const, type: "button", onClick };
  return (
    <Box
      {...linkProps}
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      gap="8px"
      h={size === "lg" ? "48px" : "40px"}
      px={variant === "text" ? "4px" : size === "lg" ? "24px" : "18px"}
      borderRadius="999px"
      border="1px solid"
      borderColor={variant === "text" ? "transparent" : t.lineStrong}
      bg={solid ? t.fg : "transparent"}
      color={solid ? t.bg : t.fg}
      fontSize={size === "lg" ? "16px" : "15px"}
      fontWeight={500}
      letterSpacing="-0.005em"
      whiteSpace="nowrap"
      transition="background-color .16s ease, color .16s ease, border-color .16s ease"
      _hover={
        variant === "text"
          ? { textDecoration: "underline", textUnderlineOffset: "4px" }
          : solid
            ? { bg: t.bg, color: t.fg }
            : { bg: t.fg, color: t.bg }
      }
      _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "3px" }}
      {...rest}
    >
      {children}
      {arrow && (
        <Box as="span" aria-hidden fontFamily={MONO} fontWeight={400}>
          {isAr ? "←" : "→"}
        </Box>
      )}
    </Box>
  );
}

/** Bordered stage with a faint dot grid — the frame product visuals sit in. */
export const Frame = forwardRef<HTMLDivElement, BoxProps>(function Frame({ children, ...rest }, ref) {
  const t = useLandingTheme();
  return (
    <Box
      ref={ref}
      position="relative"
      overflow="hidden"
      border="1px solid"
      borderColor={t.line}
      borderRadius={{ base: "16px", md: "20px" }}
      bg={t.panel}
      backgroundImage={`radial-gradient(${t.dot} 1px, transparent 1.2px)`}
      backgroundSize="18px 18px"
      {...rest}
    >
      {children}
    </Box>
  );
});

/** Two-column section head: headline left, statement + actions right. */
export function SectionHead({
  title, children, align = "start",
}: { title: string; children?: React.ReactNode; align?: "start" | "end" }) {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1fr)" }}
      alignItems={align}
      gap="clamp(20px, 4vw, 64px)"
    >
      <Headline text={title} maxW="16ch" />
      {children && (
        <Box display="flex" flexDirection="column" alignItems="flex-start" gap="18px" maxW="52ch">
          {children}
        </Box>
      )}
    </Box>
  );
}

/** Numbered module — a strong top rule, a mono index, a title and a line. */
export function Module({ index, title, body, tag }: { index: number; title: string; body: string; tag?: string }) {
  const t = useLandingTheme();
  return (
    <Box borderTop="1px solid" borderColor={t.lineStrong} pt="20px" pb="28px" display="flex" flexDirection="column" gap="8px">
      <Mono color={t.faint} letterSpacing="0.04em">{String(index).padStart(2, "0")}</Mono>
      <Box display="flex" alignItems="center" gap="10px" flexWrap="wrap">
        <Box as="h3" fontSize="18.5px" fontWeight={500} letterSpacing="-0.01em" color={t.fg}>
          {title}
        </Box>
        {tag && <Tag>{tag}</Tag>}
      </Box>
      <Para fontSize="15.5px" lineHeight={1.55} maxW="36ch">{body}</Para>
    </Box>
  );
}

/** Small outlined mono pill: "PLANNED", "PROPOSED", "ILLUSTRATIVE". */
export function Tag({ children }: { children: React.ReactNode }) {
  const t = useLandingTheme();
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      border="1px solid"
      borderColor={t.line}
      borderRadius="999px"
      px="9px"
      py="2px"
      fontFamily={MONO}
      fontSize="10.5px"
      letterSpacing="0.08em"
      textTransform="uppercase"
      color={t.sub}
      lineHeight={1.5}
      whiteSpace="nowrap"
    >
      {children}
    </Box>
  );
}
