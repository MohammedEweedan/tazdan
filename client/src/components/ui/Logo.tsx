"use client";

import { Box, Image, useColorMode } from "@chakra-ui/react";

/**
 * Logo variants:
 *  - "auto"  -> picks black (light mode) / white (dark mode)
 *  - "color" -> full colour version
 *  - "black" -> force black
 *  - "white" | "light" -> force white
 */
export type LogoVariant = "auto" | "color" | "black" | "white" | "light";

function resolveVariant(variant: LogoVariant, dark: boolean): "color" | "black" | "white" {
  if (variant === "color") return "color";
  if (variant === "black") return "black";
  if (variant === "white" || variant === "light") return "white";
  return dark ? "white" : "black";
}

const LOGO_SRC: Record<"color" | "black" | "white", string> = {
  color: "/logo-color.png",
  black: "/logo-color.png",
  white: "/logo-color.png",
};

/* The icon-only mark is the ASTERISK from the wordmark — not the wallet
   glyph (`icon-color.png`), which read as a generic finance app and shares
   nothing with the logo people see in the nav. Unlike the wordmark files
   these DO have real per-mode variants, so each one is used. */
const ICON_SRC: Record<"color" | "black" | "white", string> = {
  color: "/icon-asterisk.png",
  black: "/icon-asterisk-black.png",
  white: "/icon-asterisk-white.png",
};

// Icon-only logo (mobile + compact UI)
export function IconLogo({
  size = 36,
  variant = "auto",
}: {
  size?: number;
  variant?: LogoVariant;
}) {
  const { colorMode } = useColorMode();
  const resolved = resolveVariant(variant, colorMode === "dark");
  return (
    <Image
      src={ICON_SRC[resolved]}
      alt="tazdan"
      boxSize={`${size}px`}
      objectFit="contain"
    />
  );
}

// Full text logo (desktop)
export function TextLogo({
  h = 32,
  variant = "auto",
}: {
  h?: number;
  variant?: LogoVariant;
}) {
  const { colorMode } = useColorMode();
  const resolved = resolveVariant(variant, colorMode === "dark");
  return (
    <Image
      src={LOGO_SRC[resolved]}
      alt="tazdan"
      height={`${h}px`}
      objectFit="contain"
    />
  );
}

// Auto-switching responsive logo:
//  - Mobile: icon variant
//  - Desktop: text logo variant
export default function Logo({
  h = 36,
  variant = "auto",
}: {
  h?: number;
  variant?: LogoVariant;
}) {
  return (
    <>
      <Box display={{ base: "block", md: "none" }}>
        <IconLogo size={h} variant={variant} />
      </Box>
      <Box display={{ base: "none", md: "block" }}>
        <TextLogo h={h} variant={variant} />
      </Box>
    </>
  );
}

