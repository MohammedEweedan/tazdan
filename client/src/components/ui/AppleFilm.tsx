"use client";

/* ─────────────────────────────────────────────────────────────────────────
   tazdan — AppleFilm: three scroll-choreographed product chapters.

     • FilmSlideUp    — the app rises into frame and the coin list scrolls
                        under its own pinned header. One gesture, one idea.
     • FilmReceipt    — a transfer completes: checkmark draws, rings pulse,
                        the fee falls to zero, and (opt-in) the chime plays.
     • FilmSplitThree — one phone becomes three, fanning out to show
                        recurring buy / send / savings side by side.

   ── Why these take `screen` as a prop ────────────────────────────────────
   The phone shell and the DOM app screens live in LandingPage.tsx and are
   module-private. Rather than export them (circular import) or hoist them
   (a refactor of a 3,800-line file), each chapter accepts whatever node the
   caller wants inside the frame. A chapter owns CHOREOGRAPHY; the caller
   owns the PIXELS.

   `screen` may also be a function of the chapter's own 0→1 progress, so a
   screen can animate its internals in lockstep with the scroll:
       screen={(p) => <ScreenMarkets scroll={p} />}

   ── The one-clock rule ───────────────────────────────────────────────────
   Nothing in here runs on a timer. Scroll is the only clock, so the stage
   is always reversible and never moves while the user is still. Screens
   passed in that run their own setInterval will fight this — pass a
   scrubbed variant.

   Motion is gated behind useReducedMotion(); every string goes through
   Tolgee `t(key, default)`. No register/login links — brand-led, not
   conversion-led.
   ───────────────────────────────────────────────────────────────────────── */

import { useRef, useEffect, useCallback, useState } from "react";
import {
  motion,
  useTransform,
  useSpring,
  useReducedMotion,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";
import { Box, Heading, Text, VStack, HStack, Flex, useColorMode } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { useScrollProgress } from "./AppleShowcase";

const ACCENT = "#63a1db";
const ACCENT_HI = "#7DB4E4";
const EASE = [0.22, 1, 0.36, 1] as const;

/** A screen may be a plain node, or a function of the chapter's progress. */
type ScreenNode = React.ReactNode | ((p: MotionValue<number>) => React.ReactNode);

const renderScreen = (s: ScreenNode, p: MotionValue<number>) =>
  typeof s === "function" ? (s as (p: MotionValue<number>) => React.ReactNode)(p) : s;

/* ═══════════════════════════════════════════════════════════════════════════
   CHIME — the completed-transaction sound.

   Synthesised with WebAudio rather than shipped as a file: two short sine
   partials with an exponential decay. No asset to download, no licensing
   question, and the timbre is tunable in code.

   Browsers block audio until the user has interacted with the page, and a
   scroll does NOT count as that interaction. So sound is OFF until the
   visitor presses the speaker toggle — which both satisfies the autoplay
   policy and means a marketing page never makes noise at someone who
   didn't ask for it. Once armed, it fires on the scroll threshold.
   ═══════════════════════════════════════════════════════════════════════════ */
function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [armed, setArmed] = useState(false);

  // Build (or resume) the context from inside the click handler — Safari
  // only honours a context created/resumed during a real gesture.
  const arm = useCallback(() => {
    try {
      if (!ctxRef.current) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return false;
        ctxRef.current = new AC();
      }
      void ctxRef.current.resume?.();
      setArmed(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const disarm = useCallback(() => setArmed(false), []);

  const play = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;
    // Two rising partials, the second overlapping the tail of the first.
    const notes: Array<[freq: number, at: number, dur: number, gain: number]> = [
      [1318.5, 0.0, 0.16, 0.16], // E6
      [1760.0, 0.075, 0.28, 0.13], // A6
    ];
    for (const [freq, at, dur, peak] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + at;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012); // fast attack
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); // long-ish tail
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
  }, []);

  useEffect(() => () => void ctxRef.current?.close?.(), []);

  return { armed, arm, disarm, play };
}

function SoundToggle({
  armed,
  onToggle,
  dark,
}: {
  armed: boolean;
  onToggle: () => void;
  dark: boolean;
}) {
  const { t } = useTranslate();
  const fg = dark ? "rgba(255,255,255,0.70)" : "rgba(10,15,30,0.65)";
  return (
    <Flex
      as="button"
      onClick={onToggle}
      aria-pressed={armed}
      aria-label={
        armed
          ? t("tz_film_sound_off", "Turn transaction sound off")
          : t("tz_film_sound_on", "Turn transaction sound on")
      }
      align="center"
      gap="8px"
      px="14px"
      h="36px"
      borderRadius="18px"
      border="1px solid"
      borderColor={armed ? (dark ? ACCENT_HI : ACCENT) : dark ? "rgba(255,255,255,0.14)" : "rgba(10,15,30,0.12)"}
      color={armed ? (dark ? ACCENT_HI : ACCENT) : fg}
      bg="transparent"
      transition="all .25s ease"
      _hover={{ borderColor: dark ? ACCENT_HI : ACCENT }}
    >
      <Box as="svg" width="15px" height="15px" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 9v6h4l5 4V5L8 9H4z"
          fill="currentColor"
        />
        {armed ? (
          <path
            d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ) : (
          <path d="M17 9.5l4 5m0-5l-4 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        )}
      </Box>
      <Text fontSize="12px" fontWeight={600} letterSpacing="0.02em" fontFamily="'DM Sans', sans-serif">
        {armed ? t("tz_film_sound_state_on", "Sound on") : t("tz_film_sound_state_off", "Sound off")}
      </Text>
    </Flex>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED CHROME
   ═══════════════════════════════════════════════════════════════════════════ */

/** Sticky stage wrapper. `height` is the scroll budget — longer = slower. */
function FilmTrack({
  children,
  trackRef,
  height = { base: "280vh", md: "320vh" },
}: {
  children: React.ReactNode;
  trackRef: React.RefObject<HTMLDivElement>;
  height?: { base: string; md: string };
}) {
  const { colorMode } = useColorMode();
  const pageBg = colorMode === "dark" ? "#16181C" : "#ffffff";
  return (
    <Box ref={trackRef} position="relative" h={height} bg={pageBg}>
      <Box position="sticky" top={0} h="100vh" overflow="hidden" bg={pageBg}>
        {children}
      </Box>
    </Box>
  );
}

/** Headline block. Arrives ahead of the visual, then holds. */
function FilmCopy({
  progress,
  range,
  eyebrow,
  headline,
  sub,
  reduced,
  align = "center",
}: {
  progress: MotionValue<number>;
  range: [number, number];
  eyebrow?: string;
  headline: React.ReactNode;
  sub?: string;
  reduced: boolean;
  align?: "center" | "start";
}) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const [a, b] = range;
  const opacity = useTransform(progress, [a, a + (b - a) * 0.45, b], reduced ? [1, 1, 1] : [0, 1, 1]);
  const y = useTransform(progress, [a, b], reduced ? [0, 0] : [28, 0]);

  return (
    <motion.div style={{ opacity, y, willChange: "opacity, transform" }}>
      <VStack spacing="14px" align={align === "center" ? "center" : "flex-start"} textAlign={align === "center" ? "center" : "start"}>
        {eyebrow && (
          <Text
            fontSize={{ base: "11px", md: "12px" }}
            fontWeight={700}
            letterSpacing="0.16em"
            textTransform="uppercase"
            color={dark ? ACCENT_HI : ACCENT}
            fontFamily="'DM Sans', sans-serif"
          >
            {eyebrow}
          </Text>
        )}
        <Heading
          fontFamily="'DM Sans', sans-serif"
          fontWeight={700}
          letterSpacing="-0.045em"
          lineHeight={1.05}
          color={dark ? "#ffffff" : "#0a0f1e"}
          fontSize={{ base: "30px", md: "58px" }}
          maxW="16ch"
        >
          {headline}
        </Heading>
        {sub && (
          <Text
            fontSize={{ base: "14px", md: "17px" }}
            color={dark ? "rgba(255,255,255,0.58)" : "rgba(10,15,30,0.55)"}
            maxW="44ch"
            lineHeight={1.5}
            fontFamily="'DM Sans', sans-serif"
          >
            {sub}
          </Text>
        )}
      </VStack>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1 — SLIDE UP  ·  the app rises, then the coin list scrolls
   ═══════════════════════════════════════════════════════════════════════════ */
export function FilmSlideUp({
  eyebrow,
  headline,
  sub,
  screen,
  /** How far (px) to drive the screen's internals once the phone has landed. */
  innerScroll = 0,
}: {
  eyebrow?: string;
  headline: React.ReactNode;
  sub?: string;
  screen: ScreenNode;
  innerScroll?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const reduced = !!useReducedMotion();
  const raw = useScrollProgress(trackRef);
  const p = useSpring(raw, { stiffness: 90, damping: 28, mass: 0.4 });

  // Act 1 (0 → .34): the phone rises into frame from below the fold.
  // Act 2 (.34 → 1): it holds while the list scrolls under its own header.
  const phoneY = useTransform(p, [0, 0.34], reduced ? ["0vh", "0vh"] : ["52vh", "0vh"]);
  const phoneScale = useTransform(p, [0, 0.34], reduced ? [1, 1] : [0.9, 1]);
  const phoneOpacity = useTransform(p, [0, 0.12], reduced ? [1, 1] : [0, 1]);
  const listY = useTransform(p, [0.34, 1], reduced ? [0, 0] : [0, -innerScroll]);

  // Copy sits above the phone and lifts away as the device takes the stage.
  const copyOpacity = useTransform(p, [0, 0.1, 0.3, 0.44], reduced ? [1, 1, 1, 1] : [0, 1, 1, 0]);
  const copyY = useTransform(p, [0, 0.44], reduced ? [0, 0] : [24, -40]);

  return (
    <FilmTrack trackRef={trackRef}>
      <Flex position="absolute" inset={0} direction="column" align="center" justify="flex-start" pt={{ base: "12vh", md: "14vh" }} px="24px">
        <motion.div style={{ opacity: copyOpacity, y: copyY, willChange: "opacity, transform", zIndex: 2 }}>
          <FilmCopy progress={p} range={[0, 0.2]} eyebrow={eyebrow} headline={headline} sub={sub} reduced={reduced} />
        </motion.div>

        <motion.div
          style={{
            y: phoneY,
            scale: phoneScale,
            opacity: phoneOpacity,
            marginTop: "clamp(24px, 4vh, 56px)",
            willChange: "transform, opacity",
          }}
        >
          {/* The inner wrapper is what "scrolls" — clipped by the phone's
              own screen inset, so content slides under the bezel. */}
          <motion.div style={{ y: listY, willChange: "transform" }}>
            {renderScreen(screen, p)}
          </motion.div>
        </motion.div>
      </Flex>
    </FilmTrack>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2 — RECEIPT  ·  the transfer completes
   ═══════════════════════════════════════════════════════════════════════════ */
export function FilmReceipt({
  eyebrow,
  headline,
  sub,
  screen,
  amount,
  asset,
  feeBefore,
  feeAfter,
  /** Progress at which the transaction "lands". */
  at = 0.52,
}: {
  eyebrow?: string;
  headline: React.ReactNode;
  sub?: string;
  screen: ScreenNode;
  amount: string;
  asset: string;
  feeBefore?: string;
  feeAfter?: string;
  at?: number;
}) {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const trackRef = useRef<HTMLDivElement>(null);
  const reduced = !!useReducedMotion();
  const raw = useScrollProgress(trackRef);
  const p = useSpring(raw, { stiffness: 90, damping: 28, mass: 0.4 });
  const chime = useChime();

  // Fire the chime once, on the downward crossing of the landing threshold.
  const firedRef = useRef(false);
  useMotionValueEvent(p, "change", (v) => {
    if (v >= at && !firedRef.current) {
      firedRef.current = true;
      if (chime.armed) chime.play();
    } else if (v < at - 0.06) {
      firedRef.current = false; // re-arm when scrolled back out
    }
  });

  // Success card: springs in at the threshold.
  const cardOpacity = useTransform(p, [at - 0.06, at], [0, 1]);
  const cardScale = useTransform(p, [at - 0.06, at, at + 0.05], reduced ? [1, 1, 1] : [0.82, 1.04, 1]);
  // Checkmark stroke draws itself.
  const tickDraw = useTransform(p, [at, at + 0.08], reduced ? [1, 1] : [0, 1]);
  // Two rings pulse outward and fade.
  const ring1 = useTransform(p, [at, at + 0.14], reduced ? [0, 0] : [0.2, 1]);
  const ring1Op = useTransform(p, [at, at + 0.14], reduced ? [0, 0] : [0.45, 0]);
  const ring2 = useTransform(p, [at + 0.04, at + 0.2], reduced ? [0, 0] : [0.2, 1]);
  const ring2Op = useTransform(p, [at + 0.04, at + 0.2], reduced ? [0, 0] : [0.32, 0]);
  // Fee line: the old number strikes through, zero takes its place.
  const feeStrike = useTransform(p, [at + 0.06, at + 0.14], reduced ? [1, 1] : [0, 1]);
  const feeZeroOp = useTransform(p, [at + 0.1, at + 0.18], reduced ? [1, 1] : [0, 1]);
  const feeOldOp = useTransform(p, [at + 0.1, at + 0.18], reduced ? [0.4, 0.4] : [1, 0.38]);

  const tick = 34; // checkmark path length, approximately

  return (
    <FilmTrack trackRef={trackRef}>
      <Flex position="absolute" inset={0} align="center" justify="center" px="24px" gap={{ base: "0", lg: "72px" }} direction={{ base: "column", lg: "row" }}>
        {/* Copy + fee ledger */}
        <VStack spacing="28px" align={{ base: "center", lg: "flex-start" }} maxW="460px" zIndex={2}>
          <FilmCopy
            progress={p}
            range={[0.02, 0.26]}
            eyebrow={eyebrow}
            headline={headline}
            sub={sub}
            reduced={reduced}
            align="start"
          />

          {(feeBefore || feeAfter) && (
            <HStack
              spacing="14px"
              px="20px"
              py="14px"
              borderRadius="16px"
              border="1px solid"
              borderColor={dark ? "rgba(255,255,255,0.10)" : "rgba(10,15,30,0.08)"}
              bg={dark ? "rgba(255,255,255,0.03)" : "rgba(10,15,30,0.02)"}
            >
              <Text
                fontSize="12px"
                fontWeight={600}
                letterSpacing="0.12em"
                textTransform="uppercase"
                color={dark ? "rgba(255,255,255,0.45)" : "rgba(10,15,30,0.45)"}
                fontFamily="'DM Sans', sans-serif"
              >
                {t("tz_film_fee_label", "Transfer fee")}
              </Text>
              {feeBefore && (
                <Box position="relative">
                  <motion.span
                    style={{
                      opacity: feeOldOp,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "17px",
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      color: dark ? "rgba(255,255,255,0.55)" : "rgba(10,15,30,0.5)",
                    }}
                  >
                    {feeBefore}
                  </motion.span>
                  {/* the strike-through draws left→right */}
                  <motion.div
                    style={{
                      scaleX: feeStrike,
                      originX: 0,
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: "52%",
                      height: "1.5px",
                      background: dark ? "rgba(255,255,255,0.55)" : "rgba(10,15,30,0.5)",
                    }}
                  />
                </Box>
              )}
              {feeAfter && (
                <motion.span
                  style={{
                    opacity: feeZeroOp,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "19px",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.02em",
                    color: dark ? ACCENT_HI : ACCENT,
                  }}
                >
                  {feeAfter}
                </motion.span>
              )}
            </HStack>
          )}

          <SoundToggle
            armed={chime.armed}
            dark={dark}
            onToggle={() => {
              if (chime.armed) {
                chime.disarm();
              } else if (chime.arm()) {
                chime.play(); // confirm the choice audibly
              }
            }}
          />
        </VStack>

        {/* Phone + the success overlay */}
        <Box position="relative" mt={{ base: "36px", lg: 0 }} flexShrink={0}>
          {renderScreen(screen, p)}

          {/* Success card — floats over whatever screen was passed in, so the
              chapter works with a DOM screen or a screenshot alike. */}
          <motion.div
            style={{
              opacity: cardOpacity,
              scale: cardScale,
              position: "absolute",
              left: "50%",
              top: "50%",
              translateX: "-50%",
              translateY: "-50%",
              zIndex: 20,
              pointerEvents: "none",
              willChange: "opacity, transform",
            }}
          >
            <VStack
              spacing="12px"
              px="30px"
              py="26px"
              borderRadius="26px"
              bg={dark ? "rgba(22,24,28,0.82)" : "rgba(255,255,255,0.86)"}
              border="1px solid"
              borderColor={dark ? "rgba(255,255,255,0.14)" : "rgba(10,15,30,0.08)"}
              boxShadow={dark ? "0 24px 70px rgba(0,0,0,0.55)" : "0 24px 70px rgba(10,15,30,0.16)"}
              style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
            >
              <Box position="relative" w="62px" h="62px">
                {/* pulse rings */}
                <motion.div
                  style={{
                    scale: ring1, opacity: ring1Op,
                    position: "absolute", inset: 0, borderRadius: "50%",
                    border: `2px solid ${dark ? ACCENT_HI : ACCENT}`,
                  }}
                />
                <motion.div
                  style={{
                    scale: ring2, opacity: ring2Op,
                    position: "absolute", inset: 0, borderRadius: "50%",
                    border: `2px solid ${dark ? ACCENT_HI : ACCENT}`,
                  }}
                />
                <Flex
                  position="absolute" inset={0} align="center" justify="center"
                  borderRadius="50%" bg={dark ? ACCENT_HI : ACCENT}
                >
                  <Box as="svg" width="30px" height="30px" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <motion.path
                      d="M5 12.6l4.4 4.4L19 7.4"
                      stroke={dark ? "#16181C" : "#ffffff"}
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ pathLength: tickDraw, strokeDasharray: tick, strokeDashoffset: 0 }}
                    />
                  </Box>
                </Flex>
              </Box>

              <Text
                fontFamily="'DM Sans', sans-serif"
                fontSize="26px"
                fontWeight={700}
                letterSpacing="-0.03em"
                color={dark ? "#ffffff" : "#0a0f1e"}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {amount}{" "}
                <Box as="span" fontSize="15px" fontWeight={600} color={dark ? "rgba(255,255,255,0.5)" : "rgba(10,15,30,0.45)"}>
                  {asset}
                </Box>
              </Text>
              <Text
                fontFamily="'DM Sans', sans-serif"
                fontSize="12px"
                fontWeight={600}
                letterSpacing="0.1em"
                textTransform="uppercase"
                color={dark ? ACCENT_HI : ACCENT}
              >
                {t("tz_film_sent", "Sent")}
              </Text>
            </VStack>
          </motion.div>
        </Box>
      </Flex>
    </FilmTrack>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3 — ONE BECOMES THREE
   ═══════════════════════════════════════════════════════════════════════════ */
export function FilmSplitThree({
  eyebrow,
  headline,
  sub,
  panels,
}: {
  eyebrow?: string;
  headline: React.ReactNode;
  sub?: string;
  /** Exactly three. The middle one is the phone that was already on stage. */
  panels: Array<{ label: string; caption?: string; screen: ScreenNode }>;
}) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const trackRef = useRef<HTMLDivElement>(null);
  const reduced = !!useReducedMotion();
  const raw = useScrollProgress(trackRef);
  const p = useSpring(raw, { stiffness: 90, damping: 28, mass: 0.4 });

  // Act 1 (0 → .3)  — one phone, centred, alone.
  // Act 2 (.3 → .68) — the siblings separate out of it and settle.
  // Act 3 (.68 → 1)  — labels rise underneath.
  const SPLIT: [number, number] = [0.3, 0.68];

  const sideX = useTransform(p, SPLIT, reduced ? ["0%", "0%"] : ["0%", "118%"]);
  const sideXNeg = useTransform(p, SPLIT, reduced ? ["0%", "0%"] : ["0%", "-118%"]);
  const sideScale = useTransform(p, SPLIT, reduced ? [1, 1] : [1, 0.84]);
  const sideRot = useTransform(p, SPLIT, reduced ? [0, 0] : [0, 7]);
  const sideRotNeg = useTransform(p, SPLIT, reduced ? [0, 0] : [0, -7]);
  const sideOpacity = useTransform(p, [SPLIT[0], SPLIT[0] + 0.08], reduced ? [1, 1] : [0, 1]);
  const centreScale = useTransform(p, SPLIT, reduced ? [1, 1] : [1, 0.94]);
  const labelOpacity = useTransform(p, [0.68, 0.82], reduced ? [1, 1] : [0, 1]);
  const labelY = useTransform(p, [0.68, 0.82], reduced ? [0, 0] : [16, 0]);

  const copyOpacity = useTransform(p, [0, 0.1, 0.26, 0.36], reduced ? [1, 1, 1, 1] : [0, 1, 1, 0]);
  const copyY = useTransform(p, [0, 0.36], reduced ? [0, 0] : [24, -36]);

  const [left, centre, right] = panels;

  const Panel = ({
    panel,
    x,
    rotate,
    scale,
    opacity,
    z,
  }: {
    panel: { label: string; caption?: string; screen: ScreenNode };
    x?: MotionValue<string>;
    rotate?: MotionValue<number>;
    scale: MotionValue<number>;
    opacity?: MotionValue<number>;
    z: number;
  }) => (
    <motion.div
      style={{
        x, rotate, scale, opacity,
        position: "absolute",
        left: "50%",
        top: "50%",
        translateX: "-50%",
        translateY: "-50%",
        zIndex: z,
        willChange: "transform, opacity",
      }}
    >
      <VStack spacing="0">
        {renderScreen(panel.screen, p)}
        <motion.div style={{ opacity: labelOpacity, y: labelY, marginTop: "22px", textAlign: "center" }}>
          <Text
            fontFamily="'DM Sans', sans-serif"
            fontSize={{ base: "13px", md: "15px" }}
            fontWeight={700}
            letterSpacing="-0.01em"
            color={dark ? "#ffffff" : "#0a0f1e"}
          >
            {panel.label}
          </Text>
          {panel.caption && (
            <Text
              fontFamily="'DM Sans', sans-serif"
              fontSize={{ base: "11px", md: "12.5px" }}
              color={dark ? "rgba(255,255,255,0.45)" : "rgba(10,15,30,0.45)"}
              mt="3px"
            >
              {panel.caption}
            </Text>
          )}
        </motion.div>
      </VStack>
    </motion.div>
  );

  return (
    <FilmTrack trackRef={trackRef} height={{ base: "300vh", md: "340vh" }}>
      <Box position="absolute" inset={0}>
        <Flex position="absolute" top={{ base: "9vh", md: "11vh" }} left={0} right={0} justify="center" px="24px" zIndex={4}>
          <motion.div style={{ opacity: copyOpacity, y: copyY, willChange: "opacity, transform" }}>
            <FilmCopy progress={p} range={[0, 0.2]} eyebrow={eyebrow} headline={headline} sub={sub} reduced={reduced} />
          </motion.div>
        </Flex>

        {/* The stage. All three start stacked at dead centre — the split is
            pure transform, so at p=0 they are literally one phone. */}
        <Box position="absolute" inset={0} style={{ perspective: "1400px" }}>
          {left && <Panel panel={left} x={sideXNeg} rotate={sideRotNeg} scale={sideScale} opacity={sideOpacity} z={1} />}
          {right && <Panel panel={right} x={sideX} rotate={sideRot} scale={sideScale} opacity={sideOpacity} z={1} />}
          {centre && <Panel panel={centre} scale={centreScale} z={3} />}
        </Box>
      </Box>
    </FilmTrack>
  );
}
