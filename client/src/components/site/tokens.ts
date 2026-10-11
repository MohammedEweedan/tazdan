"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Site tokens — the website's copy of the mobile app's Palette
   (mobile/src/store/themeStore.ts). Keep the two in step: charcoal dark mode
   (never pitch black), paper light mode, and the soft blue #63A1DB used as an
   ACCENT only — eyebrows, links, selected states, focus rings, the one
   emphasised word in a headline. Big figures and CTAs stay ink, not blue.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useColorMode } from "@chakra-ui/react";
import { useAppleLocale } from "@/components/ui/appleKit";

export const FONT = "var(--font-outfit), var(--font-cairo), system-ui, sans-serif";
export const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Vertical rhythm between page sections. */
export const SECTION_Y = "clamp(88px, 11vw, 160px)";

export function siteTokens(dark: boolean) {
  return dark
    ? {
        dark,
        bg: "#16181C",        // page — app `bg`
        bgElev: "#1E2127",    // panels / sheets — app `bgElev`
        bgRaised: "#262A31",  // hovered rows, inputs — app `bgRaised`
        fg: "#F4F5F7",
        fgMuted: "#AEB6C3",
        fgFaint: "#8C96A6",
        border: "rgba(255,255,255,0.09)",
        divider: "rgba(255,255,255,0.12)",
        borderStrong: "rgba(255,255,255,0.22)",
        accent: "#24384F",
        accentFg: "#FFFFFF",
        accentSoft: "rgba(36,56,79,0.16)",
        accentBorder: "rgba(36,56,79,0.42)",
        accentText: "#9BA8B7",
        green: "#3FCF8E",
        greenSoft: "rgba(63,207,142,0.14)",
        amber: "#E9B866",
        amberSoft: "rgba(233,184,102,0.14)",
        red: "#F87171",
        shadow: "0 30px 80px -24px rgba(0,0,0,0.55)",
        phoneShadow: "0 50px 120px -30px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
        glow: "radial-gradient(60% 60% at 50% 40%, rgba(36,56,79,0.22) 0%, rgba(36,56,79,0) 70%)",
      }
    : {
        dark,
        bg: "#F6F7FA",
        bgElev: "#FFFFFF",
        bgRaised: "#EEF1F6",
        fg: "#0A0A0B",
        fgMuted: "#586579",
        fgFaint: "#697589",
        border: "rgba(10,10,11,0.08)",
        divider: "rgba(10,10,11,0.10)",
        borderStrong: "rgba(10,10,11,0.2)",
        accent: "#24384F",
        accentFg: "#FFFFFF",
        accentSoft: "rgba(36,56,79,0.12)",
        accentBorder: "rgba(36,56,79,0.38)",
        accentText: "#24384F",
        green: "#1F8F58",
        greenSoft: "rgba(31,143,88,0.10)",
        amber: "#A86A12",
        amberSoft: "rgba(168,106,18,0.10)",
        red: "#C0272D",
        shadow: "0 30px 70px -28px rgba(10,20,40,0.18)",
        phoneShadow: "0 50px 110px -34px rgba(10,20,40,0.35), 0 0 0 1px rgba(10,10,11,0.06)",
        glow: "radial-gradient(60% 60% at 50% 40%, rgba(36,56,79,0.18) 0%, rgba(36,56,79,0) 70%)",
      };
}

export type SiteTokens = ReturnType<typeof siteTokens>;

/** Theme tokens for the current colour mode. */
export function useSiteTheme(): SiteTokens {
  return siteTokens(useColorMode().colorMode === "dark");
}

/** Locale helpers. `isAr` drives RTL-only tweaks; `sides` names the physical
 *  start/end sides, because Chakra v2's logical props (ms/me/insetStart…)
 *  follow the theme direction (LTR), not the page's dir="rtl". Prefer CSS
 *  logical properties in `sx` (paddingInlineStart, insetInlineEnd…) — those
 *  do follow dir="rtl" — and reach for `sides` only for transforms/gradients. */
export function useSiteLocale() {
  const { language, isAr } = useAppleLocale();
  return {
    language,
    isAr,
    dir: (isAr ? "rtl" : "ltr") as "rtl" | "ltr",
    sides: isAr
      ? ({ start: "right", end: "left" } as const)
      : ({ start: "left", end: "right" } as const),
    /** Arrow glyph that points "forward" in the reading direction. */
    forward: isAr ? "←" : "→",
  };
}
