"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   The six stage cards Taz talks over. Each scene mounts fresh when its
   chapter starts, so every animation here runs from mount with a delay and
   needs no clock of its own. Under reduced motion each scene renders its
   finished state.

   Every figure is illustrative and the demo labels it so — these are not
   quotes. Numbers and currency pairs sit in dir="ltr" spans so they keep
   their order inside Arabic copy.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { Box, type BoxProps } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { FiCheck, FiLink, FiUser } from "react-icons/fi";
import { MONO, Pill, Tag, useLandingTheme, useSides } from "./kit";

const MBox = motion.create(Box as any) as any;
const OUT = [0.22, 1, 0.36, 1] as const;

const fmt = (n: number, d = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/* ── shared bits ─────────────────────────────────────────────────────────── */

function StageCard({ children, ...rest }: BoxProps) {
  const t = useLandingTheme();
  return (
    <MBox
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.45, ease: OUT }}
      w="100%"
      maxW="440px"
      bg={t.card}
      border="1px solid"
      borderColor={t.line}
      borderRadius="16px"
      boxShadow={t.dark ? "0 24px 60px rgba(0,0,0,0.35)" : "0 24px 60px rgba(10,10,11,0.08)"}
      p={{ base: "16px", md: "22px" }}
      color={t.fg}
      {...rest}
    >
      {children}
    </MBox>
  );
}

/** Counts a number up from `from` to `to` without re-rendering React. */
function CountUp({ from = 0, to, decimals = 2, delay = 0, duration = 1.1 }: {
  from?: number; to: number; decimals?: number; delay?: number; duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) { el.textContent = fmt(to, decimals); return; }
    const controls = animate(from, to, {
      duration, delay, ease: OUT,
      onUpdate: (v) => { el.textContent = fmt(v, decimals); },
    });
    return () => controls.stop();
  }, [from, to, decimals, delay, duration, reduced]);
  return <span ref={ref}>{fmt(reduced ? to : from, decimals)}</span>;
}

/** Flips to true after `ms`, or immediately under reduced motion. */
function useAfter(ms: number) {
  const reduced = useReducedMotion();
  const [on, setOn] = useState(!!reduced);
  useEffect(() => {
    if (reduced) { setOn(true); return; }
    const id = window.setTimeout(() => setOn(true), ms);
    return () => window.clearTimeout(id);
  }, [ms, reduced]);
  return on;
}

function Ltr({ children, ...rest }: BoxProps) {
  return <Box as="span" dir="ltr" sx={{ unicodeBidi: "isolate" }} {...rest}>{children}</Box>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  const t = useLandingTheme();
  return (
    <Box fontFamily={MONO} fontSize="11px" letterSpacing="0.08em" textTransform="uppercase" color={t.faint}>
      {children}
    </Box>
  );
}

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  const t = useLandingTheme();
  return (
    <Box display="flex" justifyContent="space-between" alignItems="baseline" gap="12px" py="5px">
      <Box fontSize={strong ? "15px" : "14px"} color={strong ? t.fg : t.sub} fontWeight={strong ? 500 : 400}>{label}</Box>
      <Box
        fontSize={strong ? { base: "22px", md: "26px" } : "14px"}
        fontWeight={strong ? 500 : 400}
        letterSpacing={strong ? "-0.02em" : undefined}
        color={t.fg}
        sx={{ fontVariantNumeric: "tabular-nums" }}
      >
        {children}
      </Box>
    </Box>
  );
}

function CheckDot({ on, size = 22 }: { on: boolean; size?: number }) {
  const t = useLandingTheme();
  return (
    <Box
      w={`${size}px`} h={`${size}px`} flexShrink={0}
      borderRadius="999px"
      display="grid" placeItems="center"
      border="1.5px solid"
      borderColor={on ? t.green : t.line}
      bg={on ? t.greenSoft : "transparent"}
      color={t.green}
      transition="all .3s ease"
    >
      <MBox
        display="grid"
        fontSize={`${Math.round(size * 0.58)}px`}
        initial={false}
        animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 22 }}
      >
        <FiCheck />
      </MBox>
    </Box>
  );
}

function Bar({ pct, delay = 0, color }: { pct: number; delay?: number; color: string }) {
  const t = useLandingTheme();
  const reduced = useReducedMotion();
  return (
    <Box h="8px" borderRadius="999px" bg={t.cardRaised} overflow="hidden">
      <MBox
        h="100%" borderRadius="999px" bg={color}
        initial={{ width: reduced ? `${pct * 100}%` : "0%" }}
        animate={{ width: `${pct * 100}%` }}
        transition={{ duration: 1, delay, ease: OUT }}
      />
    </Box>
  );
}

/* ── 01 · the real rate ───────────────────────────────────────────────────── */

export function SceneRate() {
  const t = useLandingTheme();
  const { t: tr } = useTranslate();
  const reduced = useReducedMotion();
  return (
    <StageCard>
      <Eyebrow>{tr("lp_s1_title")} · <Ltr>USD → LYD</Ltr></Eyebrow>

      <Box mt="18px" display="flex" flexDirection="column" gap="16px">
        <Box>
          <Box display="flex" justifyContent="space-between" fontSize="14px" color={t.sub} mb="8px">
            <span>{tr("lp_s1_official")}</span>
            <Ltr sx={{ fontVariantNumeric: "tabular-nums" }}>1 USD = 5.45 LYD</Ltr>
          </Box>
          <Bar pct={0.77} delay={0.15} color={t.faint} />
        </Box>
        <Box>
          <Box display="flex" flexWrap="wrap" justifyContent="space-between" alignItems="baseline" mb="8px" columnGap="12px">
            <Box fontSize="14px" fontWeight={500}>{tr("lp_s1_real")}</Box>
            <Ltr fontSize={{ base: "20px", md: "24px" }} fontWeight={500} letterSpacing="-0.02em" whiteSpace="nowrap" sx={{ fontVariantNumeric: "tabular-nums" }}>
              1 USD = <CountUp from={5.45} to={7.1} delay={0.55} /> LYD
            </Ltr>
          </Box>
          <Bar pct={1} delay={0.55} color={t.accent} />
        </Box>
      </Box>

      {/* The gap, drawn: a flat official peg against the street rate. */}
      <Box mt="18px" h={{ base: "54px", md: "64px" }}>
        <svg viewBox="0 0 300 64" preserveAspectRatio="none" width="100%" height="100%" aria-hidden>
          <line x1="0" y1="50" x2="300" y2="50" stroke={t.faint} strokeWidth="1.5" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
          <motion.path
            d="M0 44 C30 40 45 30 70 32 S110 22 135 24 S175 14 200 17 S245 9 270 11 S290 8 300 8"
            fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke"
            initial={{ pathLength: reduced ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, delay: 0.6, ease: "easeInOut" }}
          />
        </svg>
      </Box>

      <Box mt="14px" pt="14px" borderTop="1px solid" borderColor={t.line} display="flex" justifyContent="space-between" alignItems="center" gap="12px" flexWrap="wrap">
        <Box fontSize="14px" color={t.sub}>{tr("lp_s1_diff")}</Box>
        <MBox
          initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.4 }}
          px="10px" py="4px" borderRadius="999px" bg={t.greenSoft} color={t.green}
          fontSize="14px" fontWeight={600}
        >
          <Ltr>+<CountUp to={1650} decimals={0} delay={1.5} /> LYD</Ltr> {tr("lp_s1_more")}
        </MBox>
      </Box>
    </StageCard>
  );
}

/* ── 02 · send home ───────────────────────────────────────────────────────── */

export function SceneSend() {
  const t = useLandingTheme();
  const { t: tr } = useTranslate();
  const step1 = useAfter(1300);
  const step2 = useAfter(2300);
  const step3 = useAfter(3300);
  const steps = [
    { on: step1, label: tr("lp_s2_step1") },
    { on: step2, label: tr("lp_s2_step2") },
    { on: step3, label: tr("lp_s2_step3") },
  ];
  return (
    <StageCard>
      <Box display="flex" alignItems="center" gap="10px">
        <Box w="34px" h="34px" borderRadius="999px" bg={t.accentSoft} color={t.accentText} display="grid" placeItems="center">
          <FiUser />
        </Box>
        <Box flex="1" minW={0}>
          <Box fontSize="15px" fontWeight={500}>{tr("lp_s2_to")}</Box>
          <Eyebrow><Ltr>USD → LYD</Ltr></Eyebrow>
        </Box>
      </Box>

      <Box mt="14px">
        <Row label={tr("lp_s2_send")}><Ltr>500.00 USD</Ltr></Row>
        <Row label={tr("lp_s2_rate")}><Ltr>1 USD = 7.10 LYD</Ltr></Row>
        <Row label={tr("lp_s2_fee")}><Ltr>4.00 USD</Ltr></Row>
        <Box my="8px" borderTop="1px dashed" borderColor={t.line} />
        <Row label={tr("lp_s2_get")} strong>
          <Ltr><CountUp to={3521.6} delay={0.5} duration={1.2} /> LYD</Ltr>
        </Row>
      </Box>

      <Box mt="16px" display="grid" gridTemplateColumns="repeat(3, minmax(0,1fr))" gap="8px">
        {steps.map((s, i) => (
          <Box key={i} display="flex" flexDirection="column" alignItems="flex-start" gap="8px">
            <Box display="flex" alignItems="center" w="100%" gap="6px">
              <CheckDot on={s.on} />
              {i < 2 && (
                <Box flex="1" h="2px" bg={t.line} borderRadius="2px" overflow="hidden">
                  <Box h="100%" bg={t.green} w={steps[i + 1].on ? "100%" : "0%"} transition="width .8s ease" />
                </Box>
              )}
            </Box>
            <Box fontSize="12.5px" color={s.on ? t.fg : t.faint} transition="color .3s ease">{s.label}</Box>
          </Box>
        ))}
      </Box>
    </StageCard>
  );
}

/* ── 03 · claim links ─────────────────────────────────────────────────────── */

export function SceneClaim() {
  const t = useLandingTheme();
  const side = useSides();
  const { t: tr } = useTranslate();
  const reduced = useReducedMotion();
  const tapped = useAfter(2100);
  const claimed = useAfter(2450);
  const [chip, setChip] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setChip((c) => (c + 1) % 3), 1100);
    return () => window.clearInterval(id);
  }, [reduced]);
  const via = [tr("lp_s3_phone"), tr("lp_s3_email"), tr("lp_s3_handle")];

  return (
    <StageCard>
      <Box display="flex" alignItems="center" gap="10px">
        <Box w="34px" h="34px" borderRadius="999px" bg={t.cardRaised} display="grid" placeItems="center" fontWeight={600} fontSize="14px">
          {tr("lp_s3_from").charAt(0)}
        </Box>
        <Box fontSize="15px" fontWeight={500}>{tr("lp_s3_from")}</Box>
      </Box>

      <MBox
        initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.35 }}
        mt="14px" display="inline-block" px="14px" py="9px" borderRadius="16px"
        {...{ [`borderTop${side.Start}Radius`]: "4px" }} bg={t.cardRaised} fontSize="14.5px"
      >
        {tr("lp_s3_msg")}
      </MBox>

      <MBox
        initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.35 }}
        mt="10px" border="1px solid" borderColor={claimed ? t.green : t.line}
        borderRadius="14px" p="14px"
      >
        <Box display="flex" alignItems="center" gap="6px" fontFamily={MONO} fontSize="11.5px" color={t.faint}>
          <FiLink /> <Ltr>tazdan.com/c/7Kx2…</Ltr>
        </Box>
        <Box mt="6px" display="flex" alignItems="center" justifyContent="space-between" gap="12px" minH="36px">
          <Box fontSize="15px" fontWeight={500}>{tr("lp_s3_card")}</Box>
          {!claimed && (
            <Box position="relative" flexShrink={0}>
              <MBox
                animate={{ scale: tapped ? 0.92 : 1 }}
                transition={{ duration: 0.12 }}
                px="14px" h="32px" display="grid" placeItems="center"
                borderRadius="999px" bg={t.fg} color={t.bg} fontSize="13.5px" fontWeight={500}
              >
                {tr("lp_s3_claim")}
              </MBox>
              {!reduced && (
                /* The "finger" that taps Claim. */
                <MBox
                  position="absolute" top="50%" left="50%" w="26px" h="26px" ml="-13px" mt="-13px"
                  borderRadius="999px" border="2px solid" borderColor={t.fg}
                  bg={t.dark ? "rgba(255,255,255,0.18)" : "rgba(10,10,11,0.10)"}
                  pointerEvents="none"
                  initial={{ x: 70, y: 70, opacity: 0 }}
                  animate={{ x: 0, y: 0, opacity: 1, scale: tapped ? 0.75 : 1 }}
                  transition={{ delay: 1.2, duration: 0.8, ease: OUT }}
                />
              )}
            </Box>
          )}
        </Box>
        {claimed && (
          <MBox
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            mt="8px" display="flex" alignItems="center" gap="8px" color={t.green} fontSize="14px" fontWeight={500}
          >
            <CheckDot on size={20} /> {tr("lp_s3_claimed")}
          </MBox>
        )}
      </MBox>

      <Box mt="16px" display="flex" alignItems="center" gap="8px" flexWrap="wrap">
        <Box fontSize="13px" color={t.faint}>{tr("lp_s3_via")}</Box>
        {via.map((v, i) => (
          <Box
            key={i}
            px="10px" py="3px" borderRadius="999px" fontSize="13px"
            border="1px solid"
            borderColor={chip === i ? t.accent : t.line}
            bg={chip === i ? t.accentSoft : "transparent"}
            color={chip === i ? t.accentText : t.sub}
            transition="all .3s ease"
          >
            {v}
          </Box>
        ))}
      </Box>
    </StageCard>
  );
}

/* ── 04 · budgets and goals ───────────────────────────────────────────────── */

export function SceneSave() {
  const t = useLandingTheme();
  const side = useSides();
  const { t: tr } = useTranslate();
  const reduced = useReducedMotion();
  const autoOn = useAfter(1500);
  const budgets = [
    { label: tr("lp_s4_b1"), used: "540 / 750", pct: 0.72, color: t.fg },
    { label: tr("lp_s4_b2"), used: "1,200 / 1,200", pct: 1, color: t.faint },
    { label: tr("lp_s4_b3"), used: "180 / 400", pct: 0.45, color: t.accent },
  ];
  return (
    <StageCard>
      <Box display="flex" alignItems="center" gap="16px">
        <Box position="relative" w={{ base: "72px", md: "84px" }} h={{ base: "72px", md: "84px" }} flexShrink={0}>
          <svg viewBox="0 0 84 84" width="100%" height="100%" aria-hidden style={{ transform: "rotate(-90deg)" }}>
            <circle cx="42" cy="42" r="34" fill="none" stroke={t.cardRaised} strokeWidth="8" />
            <motion.circle
              cx="42" cy="42" r="34" fill="none" stroke={t.accent} strokeWidth="8" strokeLinecap="round"
              initial={{ pathLength: reduced ? 0.64 : 0 }}
              animate={{ pathLength: 0.64 }}
              transition={{ duration: 1.4, delay: 0.3, ease: OUT }}
            />
          </svg>
          <Box position="absolute" inset={0} display="grid" placeItems="center" fontSize="16px" fontWeight={600}>
            <Ltr>64%</Ltr>
          </Box>
        </Box>
        <Box minW={0}>
          <Box fontSize="15px" fontWeight={500}>{tr("lp_s4_goal")}</Box>
          <Box fontSize={{ base: "22px", md: "26px" }} fontWeight={500} letterSpacing="-0.02em" sx={{ fontVariantNumeric: "tabular-nums" }}>
            <Ltr><CountUp to={3200} decimals={0} delay={0.3} duration={1.4} /> LYD</Ltr>
          </Box>
          <Box fontSize="13px" color={t.sub}>{tr("lp_s4_of")}</Box>
        </Box>
      </Box>

      <Box mt="14px" display="flex" alignItems="center" gap="10px" px="12px" py="9px" borderRadius="12px" bg={t.cardRaised}>
        <Box w="34px" h="20px" borderRadius="999px" bg={autoOn ? t.accent : t.line} position="relative" transition="background .3s ease" flexShrink={0}>
          <Box
            position="absolute" top="2px" w="16px" h="16px" borderRadius="999px" bg="#fff"
            {...{ [side.start]: autoOn ? "16px" : "2px" }} transition={`${side.start} .3s cubic-bezier(.34,1.56,.64,1)`}
            boxShadow="0 1px 3px rgba(0,0,0,0.25)"
          />
        </Box>
        <Box fontSize="13.5px">{tr("lp_s4_auto")}</Box>
      </Box>

      <Box mt="16px">
        <Eyebrow>{tr("lp_s4_budgets")}</Eyebrow>
        <Box mt="10px" display="flex" flexDirection="column" gap="10px">
          {budgets.map((b, i) => (
            <Box key={i}>
              <Box display="flex" justifyContent="space-between" fontSize="13px" mb="5px">
                <span>{b.label}</span>
                <Ltr color={t.sub} sx={{ fontVariantNumeric: "tabular-nums" }}>{b.used}</Ltr>
              </Box>
              <Bar pct={b.pct} delay={0.5 + i * 0.15} color={b.color} />
            </Box>
          ))}
        </Box>
      </Box>
    </StageCard>
  );
}

/* ── 05 · business payouts ────────────────────────────────────────────────── */

export function SceneBusiness() {
  const t = useLandingTheme();
  const { t: tr } = useTranslate();
  const reduced = useReducedMotion();
  const d1 = useAfter(900);
  const d2 = useAfter(1500);
  const d3 = useAfter(2100);
  const reconciled = useAfter(2800);
  const rows = [
    { name: tr("lp_s5_r1"), amt: "12,400.00", on: d1 },
    { name: tr("lp_s5_r2"), amt: "8,150.00", on: d2 },
    { name: tr("lp_s5_r3"), amt: "4,900.00", on: d3 },
  ];
  return (
    <StageCard>
      <Box display="flex" alignItems="center" justifyContent="space-between" gap="10px">
        <Box display="flex" alignItems="center" gap="8px" flexWrap="wrap">
          <Box fontSize="15px" fontWeight={500}>{tr("lp_s5_title")}</Box>
          <Tag>{tr("lp_s5_planned")}</Tag>
        </Box>
        <Eyebrow>{tr("lp_s5_batch")}</Eyebrow>
      </Box>

      <Box mt="12px">
        {rows.map((r, i) => (
          <Box
            key={i}
            display="flex" alignItems="center" gap="10px" py="11px"
            borderBottom="1px solid" borderColor={t.line}
          >
            <CheckDot on={r.on} />
            <Box flex="1" minW={0} fontSize="14px" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">{r.name}</Box>
            <Ltr fontSize="14px" sx={{ fontVariantNumeric: "tabular-nums" }}>{r.amt} LYD</Ltr>
          </Box>
        ))}
      </Box>

      <Box mt="12px" display="flex" justifyContent="space-between" alignItems="baseline">
        <Box fontSize="14px" color={t.sub}>{tr("lp_s5_total")}</Box>
        <Box fontSize={{ base: "20px", md: "22px" }} fontWeight={500} letterSpacing="-0.02em" sx={{ fontVariantNumeric: "tabular-nums" }}>
          <Ltr><CountUp to={25450} delay={0.4} duration={1.6} /> LYD</Ltr>
        </Box>
      </Box>

      <Box mt="12px" minH="30px">
        {reconciled && (
          <MBox
            initial={reduced ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            display="inline-flex" alignItems="center" gap="8px"
            px="10px" py="4px" borderRadius="999px" bg={t.greenSoft} color={t.green} fontSize="13.5px" fontWeight={500}
          >
            <FiCheck /> {tr("lp_s5_rec")}
          </MBox>
        )}
      </Box>
    </StageCard>
  );
}

/* ── 06 · join ────────────────────────────────────────────────────────────── */

export function SceneJoin({ onJoin }: { onJoin: () => void }) {
  const t = useLandingTheme();
  const { t: tr } = useTranslate();
  const reduced = useReducedMotion();
  const items = [1, 2, 3, 4, 5].map((i) => tr(`lp_tab_${i}`));
  return (
    <StageCard textAlign="center">
      <Eyebrow>{tr("lp_s6_title")}</Eyebrow>
      <Box mt="10px" display="flex" alignItems="baseline" justifyContent="center" gap="10px">
        <Box fontSize={{ base: "44px", md: "56px" }} fontWeight={500} letterSpacing="-0.04em" lineHeight={1}>
          {tr("lp_s6_price")}
        </Box>
        <Box fontSize="15px" color={t.sub}>{tr("lp_s6_price_sub")}</Box>
      </Box>
      <Box mt="8px" fontSize="14px" color={t.sub}>{tr("lp_s6_sub")}</Box>

      <Box mt="18px" display="flex" flexWrap="wrap" justifyContent="center" gap="8px">
        {items.map((label, i) => (
          <MBox
            key={i}
            initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.12, duration: 0.3 }}
            display="inline-flex" alignItems="center" gap="6px"
            px="10px" py="4px" borderRadius="999px" border="1px solid" borderColor={t.line}
            fontSize="13px"
          >
            <Box as={FiCheck} color={t.green} /> {label}
          </MBox>
        ))}
      </Box>

      <Box mt="20px">
        <Pill size="lg" onClick={onJoin} arrow>{tr("lp_hero_cta_primary")}</Pill>
      </Box>
    </StageCard>
  );
}
