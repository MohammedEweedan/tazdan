"use client";

/* Small local pieces for the partners page. */

import { Box, type BoxProps } from "@chakra-ui/react";
import { SectionLabel, useSiteTheme } from "@/components/site";

/** Column captions that sit above the kit's PainList (desktop only — on
 *  phones the rows stack and the captions would float). Mirrors the
 *  PainList grid so the captions line up with the two text columns. */
export function PainColumns({ pain, fix }: { pain: string; fix: string }) {
  return (
    <Box
      aria-hidden
      display={{ base: "none", md: "grid" }}
      gridTemplateColumns="minmax(0,1fr) 28px minmax(0,1fr)"
      gap="20px"
      pb="14px"
    >
      <SectionLabel>{pain}</SectionLabel>
      <span />
      <SectionLabel>{fix}</SectionLabel>
    </Box>
  );
}

/** "Last reviewed · October 2026" — label and date as separate strings so
 *  no locale has to splice a date into a sentence. */
export function Dateline({ label, date, dateTime, ...rest }: { label: string; date: string; dateTime?: string } & BoxProps) {
  const t = useSiteTheme();
  return (
    <Box display="inline-flex" alignItems="center" gap="10px" flexWrap="wrap" {...rest}>
      <SectionLabel>{label}</SectionLabel>
      <Box as="span" w="4px" h="4px" borderRadius="999px" bg={t.fgFaint} aria-hidden />
      <Box as="time" dateTime={dateTime} fontSize="14px" fontWeight={500} color={t.fg}>{date}</Box>
    </Box>
  );
}
