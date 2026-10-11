"use client";

/* StageRail — the at-a-glance pipeline under the hero: one hairline rail
   with a station per stage (Licensing → Banking → Pipeline). Each station
   shows who sits in it and the furthest status reached, and jumps to that
   stage's detail in the timeline. */

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { useSiteLocale, useSiteTheme } from "@/components/site";
import { PartnerStatusChip, StatusNode } from "./PartnerStatus";
import { STATUS_RANK, type PartnerEntry, type StageDef } from "./types";

export function StageRail({ stages, entries, label }: { stages: StageDef[]; entries: PartnerEntry[]; label: string }) {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const { sides } = useSiteLocale();

  return (
    <Box
      as="nav"
      aria-label={label}
      display="grid"
      gridTemplateColumns={`repeat(${stages.length}, minmax(0, 1fr))`}
      maxW="1040px"
      mx="auto"
      textAlign="start"
    >
      {stages.map((stage, i) => {
        const inStage = entries.filter((e) => e.stage === stage.id);
        if (inStage.length === 0) return null;
        const lead = inStage.reduce((a, b) => (STATUS_RANK[b.status] > STATUS_RANK[a.status] ? b : a));
        const last = i === stages.length - 1;
        return (
          <Box
            key={stage.id}
            as="a"
            href={`#stage-${stage.id}`}
            data-group=""
            display="block"
            position="relative"
            pt="30px"
            pb="8px"
            minH="44px"
            sx={{ paddingInlineEnd: "clamp(10px, 2.4vw, 32px)" }}
            borderRadius="6px"
            _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "4px" }}
          >
            {/* the rail */}
            <Box
              aria-hidden
              position="absolute"
              top="6px"
              h="1px"
              style={{ insetInlineStart: 0, insetInlineEnd: 0 }}
              bg={last ? `linear-gradient(to ${sides.end}, ${t.divider}, transparent)` : t.divider}
            />
            <StatusNode status={lead.status} position="absolute" top="0" style={{ insetInlineStart: 0 }} />

            <Box fontSize="13px" fontWeight={600} color={t.accentText} sx={{ fontVariantNumeric: "tabular-nums" }}>
              {String(i + 1).padStart(2, "0")}
            </Box>
            <Box
              mt="6px"
              fontSize={{ base: "17px", md: "22px" }}
              fontWeight={600}
              letterSpacing="-0.015em"
              lineHeight={1.25}
              color={t.fg}
              _groupHover={{ textDecoration: "underline", textUnderlineOffset: "5px", textDecorationThickness: "1px" }}
            >
              {tr(stage.name)}
            </Box>
            <Box mt="8px" display="flex" flexWrap="wrap" gap="2px 12px" fontSize={{ base: "13px", md: "15px" }} lineHeight={1.45} color={t.fgMuted}>
              {inStage.map((e) => (
                <Box as="span" key={e.id}>
                  <bdi>{e.wordmark ?? tr(e.name ?? "")}</bdi>
                </Box>
              ))}
            </Box>
            <Box mt="14px" display={{ base: "none", md: "block" }}>
              <PartnerStatusChip status={lead.status} />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
