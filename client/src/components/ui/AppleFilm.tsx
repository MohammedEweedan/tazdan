"use client";

/* ─────────────────────────────────────────────────────────────────────────
   tazdan — AppleFilm: BEATS for the phone journey.

   This file used to export three standalone sticky sections, which sat below
   PhoneJourney and told the same story a second time — a visible seam and no
   real differentiator. They're gone. What's left are the pieces that were
   actually distinctive, exported so the ONE journey in LandingPage can play
   them at the right moment on the phone that's already on screen:

     • useChime / SoundToggle — the completed-transaction sound, opt-in.
     • ReceiptOverlay         — the "sent" card: checkmark draws, rings pulse.
     • FeeLedger              — the fee striking through and falling to zero.
     • TrioSibling            — a second/third phone that fans out of the first.

   Every beat is driven by a MotionValue the caller already owns, so nothing
   here runs on a timer and the whole sequence stays reversible under scroll.
   ───────────────────────────────────────────────────────────────────────── */

import { useRef, useEffect, useCallback, useState } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { Box, Text, VStack, HStack, Flex } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";

const ACCENT = "#63a1db";
const ACCENT_HI = "#7DB4E4";

/* ═══════════════════════════════════════════════════════════════════════════
   CHIME — the completed-transaction sound.

   Synthesised in WebAudio rather than shipped as a file: no asset to load and
   no licensing question. Browsers block audio until the visitor has actually
   interacted, and a scroll does NOT count — so sound stays off until they
   press the toggle. That satisfies the autoplay policy and means a marketing
   page never makes noise at somebody who didn't ask for it.
   ═══════════════════════════════════════════════════════════════════════════ */
export function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [armed, setArmed] = useState(false);

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
    const notes: Array<[freq: number, at: number, dur: number, peak: number]> = [
      [1318.5, 0.0, 0.16, 0.16],   // E6
      [1760.0, 0.075, 0.28, 0.13], // A6, overlapping the first one's tail
    ];
    for (const [freq, at, dur, peak] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + at;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
  }, []);

  useEffect(() => () => void ctxRef.current?.close?.(), []);

  return { armed, arm, disarm, play };
}

export function SoundToggle({
  armed, onToggle, dark,
}: { armed: boolean; onToggle: () => void; dark: boolean }) {
  const { t } = useTranslate();
  const idle = dark ? "rgba(255,255,255,0.70)" : "rgba(10,15,30,0.65)";
  const on = dark ? ACCENT_HI : ACCENT;
  return (
    <Flex
      as="button"
      onClick={onToggle}
      aria-pressed={armed}
      aria-label={armed
        ? t("tz_film_sound_off", "Turn transaction sound off")
        : t("tz_film_sound_on", "Turn transaction sound on")}
      align="center" gap="8px" px="14px" h="34px" borderRadius="17px"
      border="1px solid"
      borderColor={armed ? on : dark ? "rgba(255,255,255,0.14)" : "rgba(10,15,30,0.12)"}
      color={armed ? on : idle}
      bg="transparent" transition="all .25s ease" _hover={{ borderColor: on }}
    >
      <Box as="svg" width="15px" height="15px" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
        {armed
          ? <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          : <path d="M17 9.5l4 5m0-5l-4 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
      </Box>
      <Text fontSize="12px" fontWeight={600} letterSpacing="0.02em" fontFamily="'DM Sans', sans-serif">
        {armed ? t("tz_film_sound_state_on", "Sound on") : t("tz_film_sound_state_off", "Sound off")}
      </Text>
    </Flex>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RECEIPT OVERLAY — the transfer lands on the phone already on screen.
   ═══════════════════════════════════════════════════════════════════════════ */
export function ReceiptOverlay({
  progress, at, amount, asset, dark, reduced = false,
}: {
  progress: MotionValue<number>;
  /** Progress at which the transaction lands. */
  at: number;
  amount: string;
  asset: string;
  dark: boolean;
  reduced?: boolean;
}) {
  const { t } = useTranslate();
  const opacity = useTransform(progress, [at - 0.03, at, at + 0.10, at + 0.13], [0, 1, 1, 0]);
  const scale = useTransform(progress, [at - 0.03, at, at + 0.025], reduced ? [1, 1, 1] : [0.82, 1.04, 1]);
  const tick = useTransform(progress, [at, at + 0.035], reduced ? [1, 1] : [0, 1]);
  const ring1 = useTransform(progress, [at, at + 0.06], reduced ? [0, 0] : [0.2, 1]);
  const ring1Op = useTransform(progress, [at, at + 0.06], reduced ? [0, 0] : [0.45, 0]);
  const ring2 = useTransform(progress, [at + 0.015, at + 0.085], reduced ? [0, 0] : [0.2, 1]);
  const ring2Op = useTransform(progress, [at + 0.015, at + 0.085], reduced ? [0, 0] : [0.32, 0]);

  return (
    <motion.div
      style={{
        opacity, scale,
        position: "absolute", left: "50%", top: "50%",
        translateX: "-50%", translateY: "-50%",
        zIndex: 30, pointerEvents: "none", willChange: "opacity, transform",
      }}
    >
      <VStack
        spacing="10px" px="26px" py="22px" borderRadius="24px"
        bg={dark ? "rgba(22,24,28,0.82)" : "rgba(255,255,255,0.88)"}
        border="1px solid"
        borderColor={dark ? "rgba(255,255,255,0.14)" : "rgba(10,15,30,0.08)"}
        boxShadow={dark ? "0 24px 70px rgba(0,0,0,0.55)" : "0 24px 70px rgba(10,15,30,0.16)"}
        style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
      >
        <Box position="relative" w="54px" h="54px">
          <motion.div style={{ scale: ring1, opacity: ring1Op, position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${dark ? ACCENT_HI : ACCENT}` }} />
          <motion.div style={{ scale: ring2, opacity: ring2Op, position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${dark ? ACCENT_HI : ACCENT}` }} />
          <Flex position="absolute" inset={0} align="center" justify="center" borderRadius="50%" bg={dark ? ACCENT_HI : ACCENT}>
            <Box as="svg" width="27px" height="27px" viewBox="0 0 24 24" fill="none" aria-hidden>
              <motion.path
                d="M5 12.6l4.4 4.4L19 7.4"
                stroke={dark ? "#16181C" : "#ffffff"}
                strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                style={{ pathLength: tick }}
              />
            </Box>
          </Flex>
        </Box>
        <Text
          fontFamily="'DM Sans', sans-serif" fontSize="23px" fontWeight={700}
          letterSpacing="-0.03em" color={dark ? "#ffffff" : "#0a0f1e"}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {amount}{" "}
          <Box as="span" fontSize="14px" fontWeight={600} color={dark ? "rgba(255,255,255,0.5)" : "rgba(10,15,30,0.45)"}>
            {asset}
          </Box>
        </Text>
        <Text
          fontFamily="'DM Sans', sans-serif" fontSize="11px" fontWeight={600}
          letterSpacing="0.1em" textTransform="uppercase" color={dark ? ACCENT_HI : ACCENT}
        >
          {t("tz_film_sent", "Sent")}
        </Text>
      </VStack>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FEE LEDGER — the fee strikes through and falls to zero.
   ═══════════════════════════════════════════════════════════════════════════ */
export function FeeLedger({
  progress, at, before, after, dark, reduced = false,
}: {
  progress: MotionValue<number>;
  at: number;
  before: string;
  after: string;
  dark: boolean;
  reduced?: boolean;
}) {
  const { t } = useTranslate();
  const strike = useTransform(progress, [at + 0.02, at + 0.055], reduced ? [1, 1] : [0, 1]);
  const zeroOp = useTransform(progress, [at + 0.04, at + 0.075], reduced ? [1, 1] : [0, 1]);
  const oldOp = useTransform(progress, [at + 0.04, at + 0.075], reduced ? [0.4, 0.4] : [1, 0.38]);
  const muted = dark ? "rgba(255,255,255,0.55)" : "rgba(10,15,30,0.5)";

  return (
    <HStack
      spacing="12px" px="18px" py="12px" borderRadius="15px"
      border="1px solid" borderColor={dark ? "rgba(255,255,255,0.10)" : "rgba(10,15,30,0.08)"}
      bg={dark ? "rgba(255,255,255,0.03)" : "rgba(10,15,30,0.02)"}
    >
      <Text
        fontSize="11px" fontWeight={600} letterSpacing="0.12em" textTransform="uppercase"
        color={dark ? "rgba(255,255,255,0.45)" : "rgba(10,15,30,0.45)"}
        fontFamily="'DM Sans', sans-serif"
      >
        {t("tz_film_fee_label", "Transfer fee")}
      </Text>
      <Box position="relative">
        <motion.span style={{
          opacity: oldOp, fontFamily: "'DM Sans', sans-serif", fontSize: "16px",
          fontWeight: 600, fontVariantNumeric: "tabular-nums", color: muted,
        }}>
          {before}
        </motion.span>
        <motion.div style={{
          scaleX: strike, originX: 0, position: "absolute",
          left: 0, right: 0, top: "52%", height: "1.5px", background: muted,
        }} />
      </Box>
      <motion.span style={{
        opacity: zeroOp, fontFamily: "'DM Sans', sans-serif", fontSize: "18px",
        fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em",
        color: dark ? ACCENT_HI : ACCENT,
      }}>
        {after}
      </motion.span>
    </HStack>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRIO SIBLING — a second phone that separates out of the one on stage.

   Starts stacked exactly behind the hero phone, so at the beginning of the
   beat there is visibly ONE device; the split is pure transform.
   ═══════════════════════════════════════════════════════════════════════════ */
export function TrioSibling({
  progress, range, exit, side, spread, endScale, label, caption, dark, reduced = false, children,
}: {
  progress: MotionValue<number>;
  range: [number, number];
  /** When this phone powers off. Must be given explicitly when the fan holds
   *  near the end of the track — a range derived from `range` would land past
   *  1.0 and simply never fire, leaving the siblings lit while the centre
   *  device goes dark. */
  exit?: [number, number];
  side: -1 | 1;
  /** Travel distance as a % of one phone's width. */
  spread: number;
  endScale: number;
  label: string;
  caption?: string;
  dark: boolean;
  reduced?: boolean;
  children: React.ReactNode;
}) {
  const [a, b] = range;
  const [ex0, ex1] = exit ?? [b + 0.10, b + 0.13];
  const x = useTransform(progress, [a, b], reduced ? ["0%", "0%"] : ["0%", `${side * spread}%`]);
  const rotate = useTransform(progress, [a, b], reduced ? [0, 0] : [0, side * 7]);
  const scale = useTransform(progress, [a, b], reduced ? [1, 1] : [1, endScale]);
  const opacity = useTransform(progress, [a - 0.01, a + 0.02, ex0, ex1], [0, 1, 1, 0]);
  const labelOp = useTransform(progress, [a + (b - a) * 0.7, b], reduced ? [1, 1] : [0, 1]);

  return (
    <motion.div
      style={{
        x, rotate, scale, opacity,
        position: "absolute", left: "50%", top: "50%",
        translateX: "-50%", translateY: "-50%",
        zIndex: 1, willChange: "transform, opacity",
      }}
    >
      <VStack spacing="0">
        {children}
        <motion.div style={{ opacity: labelOp, marginTop: "18px", textAlign: "center" }}>
          <Text
            fontFamily="'DM Sans', sans-serif" fontSize={{ base: "12px", md: "14px" }}
            fontWeight={700} letterSpacing="-0.01em" color={dark ? "#ffffff" : "#0a0f1e"}
          >
            {label}
          </Text>
          {caption && (
            <Text
              fontFamily="'DM Sans', sans-serif" fontSize={{ base: "10px", md: "12px" }}
              color={dark ? "rgba(255,255,255,0.45)" : "rgba(10,15,30,0.45)"} mt="2px"
            >
              {caption}
            </Text>
          )}
        </motion.div>
      </VStack>
    </motion.div>
  );
}
