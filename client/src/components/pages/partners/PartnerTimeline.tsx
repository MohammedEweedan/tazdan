"use client";

/* PartnerTimeline — every relationship, grouped by stage. Desktop: the stage
   title sits in a sticky column on the reading-start side while its entries
   scroll past on a hairline rail. Phones: stage title on top, rail below.
   Names are plain-text wordmarks, never logos. */

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { Body, Headline, Reveal, SectionLabel, useSiteTheme } from "@/components/site";
import { PartnerStatusChip, StatusNode } from "./PartnerStatus";
import type { PartnerEntry, StageDef } from "./types";

/* Node centred on the first line of the wordmark. */
const NODE = 14;
const NODE_TOP = { base: "8px", md: "13px" };
const RAIL_BOTTOM = { base: "-8px", md: "-13px" };

function Entry({ e, last, labels }: { e: PartnerEntry; last: boolean; labels: { means: string; next: string } }) {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  return (
    <Box
      as="li"
      id={`partner-${e.id}`}
      position="relative"
      pb={last ? 0 : "clamp(44px, 5vw, 64px)"}
      sx={{ paddingInlineStart: { base: "32px", md: "40px" }, scrollMarginTop: "96px" }}
    >
      {!last && (
        <Box
          aria-hidden
          position="absolute"
          top={{ base: `calc(8px + ${NODE}px)`, md: `calc(13px + ${NODE}px)` }}
          bottom={RAIL_BOTTOM}
          w="1px"
          bg={t.divider}
          sx={{ insetInlineStart: `${NODE / 2 - 0.5}px` }}
        />
      )}
      <StatusNode status={e.status} size={NODE} position="absolute" top={NODE_TOP} sx={{ insetInlineStart: 0 }} />

      <Reveal y={14}>
        <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap="10px 16px">
          <Box
            as="h4"
            fontSize={{ base: "26px", md: "36px" }}
            fontWeight={600}
            letterSpacing="-0.03em"
            lineHeight={1.12}
            color={t.fg}
          >
            <bdi>{e.wordmark ?? tr(e.name ?? "")}</bdi>
          </Box>
          <PartnerStatusChip status={e.status} />
        </Box>
        <Body mt="10px" maxW="56ch">{tr(e.role)}</Body>

        <Box
          mt="24px"
          display="grid"
          gridTemplateColumns={{ base: "minmax(0,1fr)", md: "repeat(2, minmax(0,1fr))" }}
          gap="22px clamp(20px, 3vw, 40px)"
        >
          <Box borderTop="1px solid" borderColor={t.border} pt="14px">
            <SectionLabel>{labels.means}</SectionLabel>
            <Body mt="8px" fontSize="15.5px" color={t.fg}>{tr(e.means)}</Body>
          </Box>
          <Box borderTop="1px solid" borderColor={t.border} pt="14px">
            <SectionLabel>{labels.next}</SectionLabel>
            <Body mt="8px" fontSize="15.5px">{tr(e.next)}</Body>
          </Box>
        </Box>
      </Reveal>
    </Box>
  );
}

export function PartnerTimeline({
  stages, entries, labels,
}: { stages: StageDef[]; entries: PartnerEntry[]; labels: { means: string; next: string } }) {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  return (
    <Box as="ol" listStyleType="none" borderBottom="1px solid" borderColor={t.divider}>
      {stages.map((stage, si) => {
        const inStage = entries.filter((e) => e.stage === stage.id);
        if (inStage.length === 0) return null;
        return (
          <Box
            as="li"
            key={stage.id}
            id={`stage-${stage.id}`}
            borderTop="1px solid"
            borderColor={t.divider}
            display="grid"
            gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,4fr) minmax(0,8fr)" }}
            columnGap="clamp(32px, 5vw, 80px)"
            rowGap="28px"
            py="clamp(40px, 5.5vw, 72px)"
            sx={{ scrollMarginTop: "72px" }}
          >
            <Box>
              <Box position={{ base: "static", lg: "sticky" }} top="112px">
                <Box fontSize="13px" fontWeight={600} color={t.accentText} sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {String(si + 1).padStart(2, "0")}
                </Box>
                <Headline as="h3" size="sub" text={tr(stage.name)} mt="8px" />
                <Body mt="10px" fontSize="15.5px" maxW="34ch">{tr(stage.desc)}</Body>
              </Box>
            </Box>
            <Box as="ol" listStyleType="none">
              {inStage.map((e, i) => (
                <Entry key={e.id} e={e} last={i === inStage.length - 1} labels={labels} />
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
