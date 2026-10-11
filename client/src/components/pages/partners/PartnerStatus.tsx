"use client";

/* Status chip + timeline node for partner relationships.
   inProgress / discussion / pipeline reuse the kit's StatusChip; the three
   "something is signed" states (signed, licensed, live) are local until the
   kit grows them. */

import { Box, type BoxProps } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { StatusChip, useSiteLocale, useSiteTheme } from "@/components/site";
import type { PartnerStatus } from "./types";

const EXTRA_LABEL = {
  signed: "partners.chip.signed",
  licensed: "partners.chip.licensed",
  live: "partners.chip.live",
} as const;

export function PartnerStatusChip({ status, ...rest }: { status: PartnerStatus } & BoxProps) {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const { isAr } = useSiteLocale();
  if (status === "inProgress" || status === "discussion" || status === "pipeline") {
    return <StatusChip status={status} {...rest} />;
  }
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      gap="7px"
      h="24px"
      px="10px"
      borderRadius="999px"
      bg={t.greenSoft}
      fontSize="12px"
      fontWeight={500}
      letterSpacing={isAr ? 0 : "0.01em"}
      color={t.fgMuted}
      whiteSpace="nowrap"
      flexShrink={0}
      {...rest}
    >
      <Box as="span" w="6px" h="6px" borderRadius="999px" bg={t.green} aria-hidden />
      {tr(EXTRA_LABEL[status])}
    </Box>
  );
}

/** The dot on a rail: filled = moving, ring = waiting. */
export function StatusNode({ status, size = 14, ...rest }: { status: PartnerStatus; size?: number } & BoxProps) {
  const t = useSiteTheme();
  const tone = {
    inProgress: { fill: t.amber, ring: t.amber, halo: t.amberSoft },
    discussion: { fill: t.bg, ring: t.amber, halo: "transparent" },
    pipeline: { fill: t.bg, ring: t.fgFaint, halo: "transparent" },
    signed: { fill: t.green, ring: t.green, halo: t.greenSoft },
    licensed: { fill: t.green, ring: t.green, halo: t.greenSoft },
    live: { fill: t.green, ring: t.green, halo: t.greenSoft },
  }[status];
  return (
    <Box
      aria-hidden
      w={`${size}px`}
      h={`${size}px`}
      borderRadius="999px"
      bg={tone.fill}
      border="2px solid"
      borderColor={tone.ring}
      boxShadow={`0 0 0 5px ${tone.halo}`}
      {...rest}
    />
  );
}
