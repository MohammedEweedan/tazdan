"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   The hero demo: Taz pops up out of the bottom edge of the frame and walks
   through what tazdan does, one chapter at a time, while the stage beside it
   plays the matching app moment.

   One clock drives everything. `elapsed` (ms into the current chapter) gives
   the typed character count, the tab's progress fill and the moment to
   advance, so pausing is just stopping that clock. It only ticks while the
   demo is on screen, un-paused and not finished; the tour stops on the last
   chapter (the waitlist) instead of looping. Reduced motion turns the clock
   off entirely: lines show in full and the tabs are the navigation.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, VisuallyHidden } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useTranslate } from "@tolgee/react";
import { AnimatePresence, motion, useAnimationControls, useInView, useReducedMotion } from "framer-motion";
import { FiPause, FiPlay, FiRotateCcw } from "react-icons/fi";
import { useAppleLocale } from "@/components/ui/appleKit";
import Mascot, { type MascotPose } from "./Mascot";
import { SceneBusiness, SceneClaim, SceneJoin, SceneRate, SceneSave, SceneSend } from "./DemoScenes";
import { Frame, MONO, Tag, useLandingTheme, useSides } from "./kit";

const MBox = motion.create(Box as any) as any;

const CHAR_MS = 30;      // typing speed
const HOLD_MS = 3400;    // reading time once the line is fully typed
const MIN_MS = 6500;     // floor so short lines still let the stage play out
const LEAD_IN_MS = 650;  // the bubble settles before typing starts

const CHAPTERS = ["rate", "send", "claim", "save", "business", "join"] as const;
const LAST = CHAPTERS.length - 1;

const caretBlink = keyframes`0%, 100% { opacity: 1 } 50% { opacity: 0 }`;

export default function MascotDemo({ onJoin, restartKey }: { onJoin: () => void; restartKey: number }) {
  const t = useLandingTheme();
  const { t: tr } = useTranslate();
  const { isAr } = useAppleLocale();
  const side = useSides();
  const reduced = !!useReducedMotion();

  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.2 });
  const [started, setStarted] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [elapsed, setElapsed] = useState(-LEAD_IN_MS);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const hop = useAnimationControls();

  useEffect(() => { if (inView) setStarted(true); }, [inView]);

  const line = tr(`lp_line_${chapter + 1}`);
  const chars = useMemo(() => Array.from(line), [line]);
  const duration = Math.max(MIN_MS, chars.length * CHAR_MS + HOLD_MS);
  const typed = reduced ? chars.length : Math.max(0, Math.min(chars.length, Math.floor(elapsed / CHAR_MS)));
  const typing = started && typed < chars.length;
  const running = started && inView && !paused && !finished && !reduced;

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      setElapsed((e) => e + (now - last));
      last = now;
    }, 40);
    return () => window.clearInterval(id);
  }, [running]);

  const goTo = useCallback((i: number) => {
    setChapter(i);
    setElapsed(-LEAD_IN_MS);
    setFinished(false);
  }, []);

  useEffect(() => {
    if (elapsed < duration) return;
    if (chapter < LAST) goTo(chapter + 1);
    else setFinished(true);
  }, [elapsed, duration, chapter, goTo]);

  // A little hop every time the chapter changes.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (!reduced) hop.start({ y: [0, -18, 0], transition: { duration: 0.5, ease: "easeOut" } });
  }, [chapter, hop, reduced]);

  // The hero's "Take the tour" restarts from the top.
  useEffect(() => {
    if (!restartKey) return;
    goTo(0);
    setPaused(false);
    setStarted(true);
  }, [restartKey, goTo]);

  const pose: MascotPose =
    !started ? "rest"
    : chapter === 0 && typing ? "wave"
    : chapter === LAST ? "cheer"
    : "point";

  const progress = (i: number) =>
    i < chapter ? 1
    : i > chapter ? 0
    : finished || reduced ? 1
    : Math.min(1, Math.max(0, elapsed / duration));

  const scene = (() => {
    switch (CHAPTERS[chapter]) {
      case "rate": return <SceneRate />;
      case "send": return <SceneSend />;
      case "claim": return <SceneClaim />;
      case "save": return <SceneSave />;
      case "business": return <SceneBusiness />;
      case "join": return <SceneJoin onJoin={onJoin} />;
    }
  })();

  const control = finished
    ? { icon: <FiRotateCcw />, label: tr("lp_demo_replay"), onClick: () => goTo(0) }
    : paused
      ? { icon: <FiPlay />, label: tr("lp_demo_play"), onClick: () => setPaused(false) }
      : { icon: <FiPause />, label: tr("lp_demo_pause"), onClick: () => setPaused(true) };

  return (
    <Box ref={rootRef} as="section" aria-label={tr("lp_demo_aria")}>
      <Frame
        h={{ base: "auto", md: "520px", lg: "540px" }}
        display={{ base: "flex", md: "grid" }}
        flexDirection="column"
        gridTemplateColumns="minmax(0, 5fr) minmax(0, 7fr)"
      >
        {/* Controls + disclosure ride along the top edge. */}
        <Box
          position="absolute" top="14px" left="14px" right="14px" zIndex={3}
          display="flex" alignItems="center" justifyContent="space-between" pointerEvents="none"
        >
          {reduced ? <span /> : (
            <Box
              as="button" type="button" onClick={control.onClick} aria-label={control.label} title={control.label}
              pointerEvents="auto" w="32px" h="32px" borderRadius="999px" display="grid" placeItems="center"
              border="1px solid" borderColor={t.line} bg={t.card} color={t.fg} fontSize="14px"
              transition="border-color .16s ease" _hover={{ borderColor: t.lineStrong }}
              _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "2px" }}
            >
              {control.icon}
            </Box>
          )}
          {CHAPTERS[chapter] !== "join" && <Tag>{tr("lp_demo_illustrative")}</Tag>}
        </Box>

        {/* Guide column: speech bubble over Taz. */}
        <Box position="relative" order={{ base: 2, md: 0 }} h={{ base: "212px", md: "100%" }}>
          <AnimatePresence mode="wait">
            {started && (
              <MBox
                key={chapter}
                initial={reduced ? false : { opacity: 0, scale: 0.85, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 380, damping: 24, delay: 0.1 }}
                position="absolute"
                bottom={{ base: "14px", md: "200px", lg: "222px" }}
                {...{ [side.start]: { base: "124px", md: "24px" }, [side.end]: "12px" }}
                maxW={{ md: "360px" }}
                bg={t.card}
                border="1px solid"
                borderColor={t.line}
                borderRadius="18px"
                px={{ base: "14px", md: "18px" }}
                py={{ base: "12px", md: "16px" }}
                boxShadow={t.dark ? "0 18px 44px rgba(0,0,0,0.32)" : "0 18px 44px rgba(10,10,11,0.07)"}
                style={{ transformOrigin: isAr ? "bottom right" : "bottom left" }}
              >
                <Box fontFamily={MONO} fontSize="11px" letterSpacing="0.08em" textTransform="uppercase" color={t.accentText} mb="4px">
                  {tr("lp_demo_name")}
                </Box>
                {/* The full line sits invisibly underneath so the bubble is
                    its final size from the first frame and never jumps. */}
                <Box position="relative" fontSize={{ base: "14.5px", md: "17px" }} lineHeight={1.5} color={t.fg} aria-hidden>
                  <Box visibility="hidden">{line}</Box>
                  <Box position="absolute" inset={0}>
                    {chars.slice(0, typed).join("")}
                    {typing && (
                      <Box
                        as="span" display="inline-block" w="2px" h="1em" bg={t.accent}
                        marginInlineStart="2px" verticalAlign="-0.15em" animation={`${caretBlink} 1s steps(1) infinite`}
                      />
                    )}
                  </Box>
                </Box>
                {/* Tail: points at Taz — sideways on mobile, down on desktop. */}
                <Box
                  position="absolute" w="14px" h="14px" bg={t.card} borderColor={t.line} borderStyle="solid"
                  bottom={{ base: "30px", md: "-8px" }}
                  {...{ [side.start]: { base: "-8px", md: "118px" } }}
                  transform={`rotate(${isAr ? -45 : 45}deg)`}
                  sx={{
                    borderWidth: 0,
                    borderBottomWidth: "1px",
                    [`border${side.Start}Width`]: { base: "1px", md: 0 },
                    [`border${side.End}Width`]: { base: 0, md: "1px" },
                  }}
                />
              </MBox>
            )}
          </AnimatePresence>

          <MBox
            position="absolute"
            bottom={{ base: "-26px", md: "-40px" }}
            {...{ [side.start]: { base: "6px", md: "clamp(20px, 4vw, 56px)" } }}
            w={{ base: "112px", md: "210px", lg: "230px" }}
            initial={reduced ? false : { y: "115%" }}
            animate={{ y: started ? "0%" : "115%" }}
            transition={{ type: "spring", stiffness: 260, damping: 14, mass: 0.9 }}
          >
            <motion.div animate={hop}>
              <Mascot pose={pose} talking={typing && typed > 0} mirrored={isAr} label={tr("lp_demo_name")} />
            </motion.div>
          </MBox>
        </Box>

        {/* Stage column. */}
        <Box
          order={{ base: 1, md: 0 }}
          display="flex" alignItems="center" justifyContent="center"
          h={{ base: "400px", md: "100%" }}
          pt={{ base: "56px", md: "56px" }} pb={{ base: "8px", md: "40px" }} px={{ base: "14px", md: "40px" }}
        >
          <AnimatePresence mode="wait">
            {started && (
              <Box key={chapter} w="100%" display="flex" justifyContent="center">
                {scene}
              </Box>
            )}
          </AnimatePresence>
        </Box>
      </Frame>

      {/* Chapter tabs: a top rule that fills as the chapter plays. */}
      <Box
        mt="14px"
        display="grid"
        gridTemplateColumns={{ base: "repeat(3, minmax(0, 1fr))", md: "repeat(6, minmax(0, 1fr))" }}
        columnGap="12px"
        rowGap="12px"
      >
        {CHAPTERS.map((id, i) => {
          const active = i === chapter;
          return (
            <Box
              key={id}
              as="button"
              type="button"
              onClick={() => { goTo(i); setStarted(true); }}
              aria-current={active ? "step" : undefined}
              position="relative"
              pt="12px"
              textAlign="start"
              _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "4px", borderRadius: "4px" }}
            >
              <Box position="absolute" top={0} left={0} right={0} h="2px" bg={t.line} borderRadius="2px" overflow="hidden">
                <Box h="100%" bg={active ? t.accent : t.lineStrong} w={`${progress(i) * 100}%`} />
              </Box>
              <Box fontFamily={MONO} fontSize="11.5px" color={t.faint}>{String(i + 1).padStart(2, "0")}</Box>
              <Box fontSize={{ base: "13.5px", md: "14.5px" }} fontWeight={500} color={active ? t.fg : t.sub} transition="color .2s ease">
                {tr(`lp_tab_${i + 1}`)}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Screen readers get each line whole, once, instead of the typewriter. */}
      <VisuallyHidden aria-live="polite">{started ? line : ""}</VisuallyHidden>
    </Box>
  );
}
