"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Story — scroll-told product chapters and pain-point framing.

   <StoryScroll>  Desktop: chapters scroll on one side while a sticky phone on
                  the other crossfades to each chapter's real screen/recording.
                  Phones/tablets: each chapter stacks its own phone under the
                  copy. Chapters can open with the pain they answer.
   <PainList>     "What it's like today" → "What changes" rows.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { Box, useBreakpointValue } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";
import type { IconType } from "react-icons";
import { PhoneStage, type PhoneMedia } from "./device";
import { Body, Eyebrow, Headline, IconDisc, Reveal, StatusChip, type Status } from "./primitives";
import { EASE, useSiteLocale, useSiteTheme } from "./tokens";

export type Chapter = {
  id: string;
  eyebrow?: string;
  /** The pain this chapter answers, shown as a quiet quote above the title. */
  pain?: string;
  title: string;
  body: string;
  /** Extra points under the body. */
  points?: { icon?: IconType; text: string }[];
  status?: Status;
  media: PhoneMedia;
  /** Optional slot under the copy (a link, a mini table…). */
  extra?: React.ReactNode;
};

function ChapterCopy({ c, active }: { c: Chapter; active: boolean }) {
  const t = useSiteTheme();
  const reduced = useReducedMotion();
  return (
    <motion.div
      animate={{ opacity: active || reduced ? 1 : 0.32 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {c.pain && (
        <Box
          as="p"
          mb="18px"
          fontSize={{ base: "15px", md: "16px" }}
          lineHeight={1.55}
          color={t.fgFaint}
          style={{ textAlign: "start" }}
          sx={{ paddingInlineStart: "14px", borderInlineStart: `2px solid ${t.divider}` }}
        >
          {c.pain}
        </Box>
      )}
      <Box display="flex" alignItems="center" gap="10px" flexWrap="wrap" mb="12px">
        {c.eyebrow && <Eyebrow>{c.eyebrow}</Eyebrow>}
        {c.status && <StatusChip status={c.status} />}
      </Box>
      <Headline text={c.title} size="sub" as="h3" maxW="18ch" />
      <Body mt="16px" maxW="46ch">{c.body}</Body>
      {c.points && c.points.length > 0 && (
        <Box as="ul" mt="20px" listStyleType="none" display="grid" gap="12px">
          {c.points.map((p, i) => (
            <Box as="li" key={i} display="flex" gap="12px" alignItems="flex-start" color={t.fgMuted} fontSize="15px" lineHeight={1.55}>
              {p.icon ? <IconDisc icon={p.icon} size={28} /> : (
                <Box as="span" mt="9px" w="6px" h="6px" minW="6px" borderRadius="999px" bg={t.accentText} aria-hidden />
              )}
              <Box as="span" pt={p.icon ? "3px" : 0}>{p.text}</Box>
            </Box>
          ))}
        </Box>
      )}
      {c.extra && <Box mt="22px">{c.extra}</Box>}
    </motion.div>
  );
}

/** Scroll-driven chapters with a sticky phone. `phoneSide` is in reading
 *  direction ("end" = right in English, left in Arabic). */
export function StoryScroll({ chapters, phoneSide = "end" }: { chapters: Chapter[]; phoneSide?: "start" | "end" }) {
  const t = useSiteTheme();
  const desktop = useBreakpointValue({ base: false, lg: true }, { ssr: true }) ?? false;
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!desktop) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        });
      },
      // A thin band across the middle of the viewport decides the chapter.
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [desktop, chapters.length]);

  if (!desktop) {
    return (
      <Box display="grid" gap="clamp(72px, 14vw, 120px)">
        {chapters.map((c) => (
          <Reveal key={c.id} y={24}>
            <Box display="grid" gap="36px" justifyItems="center">
              <Box w="100%"><ChapterCopy c={c} active /></Box>
              <Box position="relative">
                <Box aria-hidden position="absolute" inset="-18%" bg={t.glow} pointerEvents="none" />
                <PhoneStage items={[c.media]} index={0} w="min(280px, 72vw)" />
              </Box>
            </Box>
          </Reveal>
        ))}
      </Box>
    );
  }

  const phone = (
    <Box position="sticky" top="calc(50vh - min(320px, 37vh))" h="min(640px, 74vh)" display="flex" justifyContent="center">
      <Box position="relative" h="100%">
        <Box aria-hidden position="absolute" inset="-22%" bg={t.glow} pointerEvents="none" />
        <PhoneStage items={chapters.map((c) => c.media)} index={active} h="100%" w="auto" />
      </Box>
    </Box>
  );

  return (
    <Box
      display="grid"
      gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)"
      gap="clamp(40px, 6vw, 96px)"
      alignItems="start"
    >
      {phoneSide === "start" && phone}
      <Box>
        {chapters.map((c, i) => (
          <Box
            key={c.id}
            id={c.id}
            ref={(el: HTMLDivElement | null) => { refs.current[i] = el; }}
            data-index={i}
            minH="86vh"
            display="flex"
            alignItems="center"
            sx={{ scrollMarginTop: "84px" }}
          >
            <ChapterCopy c={c} active={i === active} />
          </Box>
        ))}
      </Box>
      {phoneSide === "end" && phone}
    </Box>
  );
}

/** Pain → change rows. */
export function PainList({ items }: { items: { pain: string; fix: string }[] }) {
  const t = useSiteTheme();
  const { forward } = useSiteLocale();
  return (
    <Box role="list">
      {items.map((it, i) => (
        <Reveal key={i} y={14} delay={i * 0.04}>
          <Box
            role="listitem"
            display="grid"
            gridTemplateColumns={{ base: "minmax(0,1fr)", md: "minmax(0,1fr) 28px minmax(0,1fr)" }}
            gap={{ base: "8px", md: "20px" }}
            alignItems="baseline"
            py="22px"
            borderTop="1px solid"
            borderColor={t.border}
          >
            <Box as="p" fontSize={{ base: "16px", md: "18px" }} lineHeight={1.5} color={t.fgFaint} style={{ textAlign: "start" }}>
              {it.pain}
            </Box>
            <Box aria-hidden color={t.accentText} display={{ base: "none", md: "block" }} textAlign="center">
              {forward}
            </Box>
            <Box as="p" fontSize={{ base: "16px", md: "18px" }} lineHeight={1.5} color={t.fg} fontWeight={500} style={{ textAlign: "start" }}>
              {it.fix}
            </Box>
          </Box>
        </Reveal>
      ))}
    </Box>
  );
}
