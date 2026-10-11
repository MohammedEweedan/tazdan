"use client";

import { useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import {
  AppScreen, Body, Container, Eyebrow, Headline, PhoneFrame, StatusChip,
  useSiteTheme, type Chapter,
} from "@/components/site";

function useLayerOpacity(progress: MotionValue<number>, index: number, count: number, reduced: boolean) {
  const step = 1 / (count - 1);
  const center = index * step;
  const fade = reduced ? 0.001 : step * 0.15;
  let input: number[];
  let output: number[];
  if (index === 0) {
    input = [0, step / 2 - fade, step / 2 + fade];
    output = [1, 1, 0];
  } else if (index === count - 1) {
    input = [center - step / 2 - fade, center - step / 2 + fade, 1];
    output = [0, 1, 1];
  } else {
    input = [center - step / 2 - fade, center - step / 2 + fade,
      center + step / 2 - fade, center + step / 2 + fade];
    output = [0, 1, 1, 0];
  }
  return useTransform(progress, input, output);
}

/** Later screens sit above earlier ones and fade in over a fully lit image.
 *  This avoids the dark, double-transparent frame produced by fading both
 *  screenshots toward the phone's black background at the same time. */
function useScreenOpacity(progress: MotionValue<number>, index: number, count: number, reduced: boolean) {
  const step = 1 / (count - 1);
  const center = index * step;
  const fade = reduced ? 0.001 : step * 0.15;
  const midpoint = center - step / 2;
  return useTransform(progress,
    index === 0 ? [0, 1] : [0, midpoint - fade, midpoint + fade, 1],
    index === 0 ? [1, 1] : [0, 0, 1, 1]);
}

function ScreenLayer({ chapter, index, count, progress, reduced, active }: {
  chapter: Chapter; index: number; count: number; progress: MotionValue<number>; reduced: boolean; active: boolean;
}) {
  const opacity = useScreenOpacity(progress, index, count, reduced);
  return (
    <motion.div data-journey-screen={index} aria-hidden={!active} style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none" }}>
      <AppScreen id={chapter.media.screen ?? ""} alt={chapter.media.alt} playing={active} />
    </motion.div>
  );
}

function CopyLayer({ chapter, index, count, progress, reduced }: {
  chapter: Chapter; index: number; count: number; progress: MotionValue<number>; reduced: boolean;
}) {
  const screenOpacity = useLayerOpacity(progress, index, count, reduced);
  // Keep chapter text readable while the images blend. Each caption enters
  // once its screen is mostly visible, so two paragraphs never ghost together.
  const opacity = useTransform(screenOpacity, [0, 0.55, 1], [0, 0, 1]);
  const y = useTransform(opacity, [0, 1], [reduced ? 0 : 16, 0]);
  const theme = useSiteTheme();
  return (
    <motion.div data-journey-copy={index} style={{ position: "absolute", inset: 0, opacity, y, pointerEvents: "none",
      display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <Box display="flex" alignItems="center" gap="10px" flexWrap="wrap" mb="14px">
        {chapter.eyebrow && <Eyebrow>{chapter.eyebrow}</Eyebrow>}
        {chapter.status && <StatusChip status={chapter.status} />}
      </Box>
      <Headline as="h3" text={chapter.title} size="sub" maxW={{ base: "17ch", lg: "14ch" }}
        fontSize={{ base: "clamp(27px, 7.5vw, 36px)", lg: "clamp(52px, 5vw, 72px)" }}
        lineHeight={{ base: 1.06, lg: 1.01 }} />
      <Body mt={{ base: "16px", lg: "24px" }} maxW="43ch" fontSize={{ base: "15.5px", lg: "18px" }}>
        {chapter.body}
      </Body>
      <Box mt="24px" fontSize="12px" fontWeight={600} color={theme.fgFaint} dir="ltr">
        {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
      </Box>
    </motion.div>
  );
}

/** A single pinned phone. Each real screenshot and its copy overlap, then
 *  crossfade against the same scroll progress. The browser only animates
 *  opacity and transforms; there are no scroll listeners or React setState calls. */
export default function HomePhoneJourney({ chapters }: { chapters: Chapter[] }) {
  const theme = useSiteTheme();
  const reduced = Boolean(useReducedMotion());
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const progress = scrollYProgress;
  const count = chapters.length;
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  useMotionValueEvent(progress, "change", (value) => {
    const next = Math.max(0, Math.min(count - 1, Math.round(value * (count - 1))));
    if (next !== activeRef.current) {
      activeRef.current = next;
      setActive(next);
    }
  });
  const media = (
    <Box position="relative" h="100%" display="flex" alignItems="center" justifyContent="center">
      <Box aria-hidden position="absolute" inset="-12%" bg={theme.glow} pointerEvents="none" />
      <PhoneFrame w="auto" h={{ base: "min(59dvh, calc(100dvh - 350px), 500px)", lg: "min(72vh, 650px)" }}>
        {chapters.map((chapter, index) => (
          <ScreenLayer key={chapter.id} chapter={chapter} index={index}
            count={count} progress={progress} reduced={reduced} active={active === index} />
        ))}
      </PhoneFrame>
    </Box>
  );
  return (
    <Box ref={ref} position="relative" h={`${count * 100}vh`} aria-label="App journey">
      <Box position="sticky" top={0} h="100dvh" minH="620px" overflow="hidden">
        <Container h="100%" pt={{ base: "60px", lg: "90px" }} pb={{ base: "20px", lg: "60px" }}
          display="grid" alignItems="center"
          gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1fr)" }}
          gridTemplateRows={{ base: "minmax(0,1fr) 250px", lg: "minmax(0,1fr)" }}
          gap={{ base: "10px", lg: "70px" }}>
          <Box position="relative" h="100%" order={{ base: 2, lg: 1 }}>
            {chapters.map((chapter, index) => (
              <CopyLayer key={chapter.id} chapter={chapter} index={index}
                count={count} progress={progress} reduced={reduced} />
            ))}
          </Box>
          <Box order={{ base: 1, lg: 2 }} h="100%">{media}</Box>
        </Container>
        <Box position="absolute" bottom={0} insetInline={0} h="2px" bg={theme.border}>
          <motion.div style={{ height: "100%", background: theme.accent, scaleX: progress,
            transformOrigin: "left" }} />
        </Box>
      </Box>
    </Box>
  );
}
