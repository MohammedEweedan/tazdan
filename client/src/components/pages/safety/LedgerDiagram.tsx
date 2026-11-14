"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   LedgerDiagram — how one payment is written into tazdan's books.

   Pick a scenario; its entries post one by one into a real <table>, a
   balance scale tilts as they land and levels when they add up to zero, and
   the fund-class columns underneath light up for the classes involved. The
   "doesn't add up" scenario ends tilted and refused — what the database's
   commit-time check does (docs/LEDGER.md, regulatory/CUSTOMER_FUNDS.md).

   Accessibility: scenario buttons are aria-pressed toggles; the journal is a
   table with a caption; the status line is aria-live. The SVG is decorative.
   prefers-reduced-motion: every entry is shown at once and nothing moves.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import { useInView } from "framer-motion";
import { useTranslate } from "@tolgee/react";
import { FiCheck, FiRotateCcw, FiX } from "react-icons/fi";
import { Footnote, useMediaReducedMotion, useSiteLocale, useSiteTheme } from "@/components/site";

type FundClass = "customer" | "settlement" | "corporate";
type Leg = { acct: string; cls: FundClass; amt: number; cur: string; group: string };
type ScenarioId = "transfer" | "p2p" | "remit" | "broken";

const SCENARIOS: Record<ScenarioId, { tab: string; note: string; legs: Leg[] }> = {
  transfer: {
    tab: "safety.ledger.tab.transfer",
    note: "safety.ledger.note.transfer",
    legs: [
      { acct: "safety.ledger.acct.yours", cls: "customer", amt: -100, cur: "LYD", group: "safety.ledger.group.transfer" },
      { acct: "safety.ledger.acct.friend", cls: "customer", amt: 100, cur: "LYD", group: "safety.ledger.group.transfer" },
    ],
  },
  p2p: {
    tab: "safety.ledger.tab.p2p",
    note: "safety.ledger.note.p2p",
    legs: [
      { acct: "safety.ledger.acct.seller", cls: "customer", amt: -500, cur: "USDT", group: "safety.ledger.group.lock" },
      { acct: "safety.ledger.acct.escrow", cls: "customer", amt: 500, cur: "USDT", group: "safety.ledger.group.lock" },
      { acct: "safety.ledger.acct.escrow", cls: "customer", amt: -500, cur: "USDT", group: "safety.ledger.group.release" },
      { acct: "safety.ledger.acct.buyer", cls: "customer", amt: 500, cur: "USDT", group: "safety.ledger.group.release" },
    ],
  },
  remit: {
    tab: "safety.ledger.tab.remit",
    note: "safety.ledger.note.remit",
    legs: [
      { acct: "safety.ledger.acct.yours", cls: "customer", amt: -1000, cur: "LYD", group: "safety.ledger.group.funded" },
      { acct: "safety.ledger.acct.clearing", cls: "customer", amt: 1000, cur: "LYD", group: "safety.ledger.group.funded" },
      { acct: "safety.ledger.acct.clearing", cls: "customer", amt: -1000, cur: "LYD", group: "safety.ledger.group.paid" },
      { acct: "safety.ledger.acct.partner", cls: "settlement", amt: 980, cur: "LYD", group: "safety.ledger.group.paid" },
      { acct: "safety.ledger.acct.revenue", cls: "corporate", amt: 20, cur: "LYD", group: "safety.ledger.group.paid" },
    ],
  },
  broken: {
    tab: "safety.ledger.tab.broken",
    note: "safety.ledger.note.broken",
    legs: [
      { acct: "safety.ledger.acct.yours", cls: "customer", amt: -100, cur: "LYD", group: "safety.ledger.group.attempt" },
      { acct: "safety.ledger.acct.friend", cls: "customer", amt: 90, cur: "LYD", group: "safety.ledger.group.attempt" },
    ],
  },
};
const ORDER: ScenarioId[] = ["transfer", "p2p", "remit", "broken"];

const CLASSES: { id: FundClass; title: string; body: string }[] = [
  { id: "customer", title: "safety.ledger.class.customer.title", body: "safety.ledger.class.customer.body" },
  { id: "settlement", title: "safety.ledger.class.settlement.title", body: "safety.ledger.class.settlement.body" },
  { id: "corporate", title: "safety.ledger.class.corporate.title", body: "safety.ledger.class.corporate.body" },
];
const CLASS_LABEL: Record<FundClass, string> = {
  customer: "safety.ledger.class.customer.short",
  settlement: "safety.ledger.class.settlement.short",
  corporate: "safety.ledger.class.corporate.short",
};

const fmt = (n: number) =>
  (n < 0 ? "−" : "+") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── the balance scale ─────────────────────────────────────────────────── */

function Scale({ outCount, inCount, angle, state, reduced }: {
  outCount: number; inCount: number; angle: number; state: "posting" | "balanced" | "rejected"; reduced: boolean;
}) {
  const t = useSiteTheme();
  const { isAr } = useSiteLocale();
  const rad = (angle * Math.PI) / 180;
  const L = 92;
  const dx = L - L * Math.cos(rad);
  const dy = L * Math.sin(rad);
  const tr = reduced ? "none" : "transform .8s cubic-bezier(.22,1,.36,1)";
  const ink = state === "rejected" ? t.red : state === "balanced" ? t.green : t.fgMuted;
  const pan = (cx: number, count: number, tone: string) => (
    <>
      <line x1={cx} y1={46} x2={cx - 28} y2={112} stroke={t.borderStrong} strokeWidth={1.2} />
      <line x1={cx} y1={46} x2={cx + 28} y2={112} stroke={t.borderStrong} strokeWidth={1.2} />
      {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
        <rect key={i} x={cx - 18} y={102 - i * 9} width={36} height={7} rx={3.5} fill={tone} opacity={0.9} />
      ))}
      <path d={`M ${cx - 32} 112 Q ${cx} 134 ${cx + 32} 112 Z`} fill={t.bgRaised} stroke={t.borderStrong} strokeWidth={1.2} />
    </>
  );
  return (
    <Box as="svg" viewBox="0 0 260 190" w="100%" maxW="300px" aria-hidden display="block" mx="auto"
      style={{ transform: isAr ? "scaleX(-1)" : undefined, overflow: "visible" }}>
      <rect x={96} y={170} width={68} height={8} rx={4} fill={t.borderStrong} />
      <line x1={130} y1={46} x2={130} y2={170} stroke={t.borderStrong} strokeWidth={3} strokeLinecap="round" />
      <g style={{ transform: `translate(${dx}px, ${-dy}px)`, transition: tr }}>{pan(38, outCount, t.fgFaint)}</g>
      <g style={{ transform: `translate(${-dx}px, ${dy}px)`, transition: tr }}>{pan(222, inCount, t.green)}</g>
      <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "130px 46px", transformBox: "view-box", transition: tr }}>
        <line x1={38} y1={46} x2={222} y2={46} stroke={t.fg} strokeWidth={3} strokeLinecap="round" />
      </g>
      <circle cx={130} cy={46} r={7} fill={t.bgElev} stroke={ink} strokeWidth={2.5} style={{ transition: reduced ? "none" : "stroke .4s ease" }} />
    </Box>
  );
}

/* ── the diagram ───────────────────────────────────────────────────────── */

export default function LedgerDiagram() {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const reduced = useMediaReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [scenario, setScenario] = useState<ScenarioId>("transfer");
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const legs = SCENARIOS[scenario].legs;
  const shown = reduced ? legs.length : step;

  useEffect(() => { setStep(0); }, [scenario, run]);
  useEffect(() => {
    if (reduced || !inView || step >= legs.length) return;
    const id = window.setTimeout(() => setStep((s) => s + 1), step === 0 ? 450 : 800);
    return () => window.clearTimeout(id);
  }, [reduced, inView, step, legs.length]);

  const posted = legs.slice(0, shown);
  const sum = posted.reduce((a, l) => a + l.amt, 0);
  const out = posted.filter((l) => l.amt < 0).reduce((a, l) => a - l.amt, 0);
  const inn = posted.filter((l) => l.amt > 0).reduce((a, l) => a + l.amt, 0);
  const done = shown >= legs.length;
  const state: "posting" | "balanced" | "rejected" = !done ? "posting" : Math.abs(sum) < 1e-9 ? "balanced" : "rejected";
  const angle = state === "rejected"
    ? Math.sign(inn - out) * 7
    : Math.max(-9, Math.min(9, ((inn - out) / Math.max(inn, out, 1)) * 9));
  const involved = useMemo(() => new Set(legs.map((l) => l.cls)), [legs]);
  const groups = useMemo(() => Array.from(new Set(legs.map((l) => l.group))), [legs]);
  const statusColor = state === "rejected" ? t.red : state === "balanced" ? t.green : t.fgMuted;
  const statusText = state === "rejected" ? tr("safety.ledger.rejected") : state === "balanced" ? tr("safety.ledger.balanced") : tr("safety.ledger.posting");
  const cur = legs[0].cur;

  return (
    <Box ref={ref}>
      <Box role="group" aria-label={tr("safety.ledger.label")} display="flex" flexWrap="wrap" gap="8px">
        {ORDER.map((id) => {
          const on = id === scenario;
          return (
            <Box key={id} as="button" type="button" aria-pressed={on} onClick={() => { setScenario(id); setRun((r) => r + 1); }}
              h="44px" px="18px" borderRadius="999px" border="1px solid"
              borderColor={on ? t.fg : t.borderStrong} bg={on ? t.fg : "transparent"} color={on ? t.bg : t.fg}
              fontSize="14.5px" fontWeight={600} transition="background-color .18s ease, color .18s ease, border-color .18s ease"
              _hover={on ? undefined : { borderColor: t.fg }}
              _focusVisible={{ outline: `2px solid ${t.accentText}`, outlineOffset: "3px" }}>
              {tr(SCENARIOS[id].tab)}
            </Box>
          );
        })}
      </Box>

      <Box mt="28px" display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,1.3fr) minmax(0,0.7fr)" }}
        gap={{ base: "28px", lg: "48px" }} alignItems="center">
        {/* journal */}
        <Box order={{ base: 2, lg: 1 }} minW={0}>
          <Box as="table" w="100%" sx={{ borderCollapse: "collapse", tableLayout: "fixed" }} fontSize={{ base: "14.5px", md: "15.5px" }}>
            <Box as="caption" textAlign="start" color={t.fgFaint} fontSize="13px" pb="10px" sx={{ captionSide: "top" }}>
              {tr("safety.ledger.caption")}
            </Box>
            <Box as="thead">
              <Box as="tr" borderBottom="1px solid" borderColor={t.divider}>
                <Box as="th" scope="col" textAlign="start" py="10px" fontSize="12px" fontWeight={600} color={t.fgFaint}
                  letterSpacing="0.06em" textTransform="uppercase">{tr("safety.ledger.col.account")}</Box>
                <Box as="th" scope="col" textAlign="end" py="10px" w={{ base: "44%", md: "38%" }} fontSize="12px" fontWeight={600} color={t.fgFaint}
                  letterSpacing="0.06em" textTransform="uppercase">{tr("safety.ledger.col.amount")}</Box>
              </Box>
            </Box>
            {groups.map((g) => (
              <Box as="tbody" key={g}>
                <Box as="tr">
                  <Box as="th" scope="rowgroup" colSpan={2} textAlign="start" pt="16px" pb="4px" fontSize="13px" fontWeight={600} color={t.accentText}>
                    {tr(g)}
                  </Box>
                </Box>
                {legs.map((l, i) => l.group !== g ? null : (
                  <Box as="tr" key={i} borderBottom="1px solid" borderColor={t.border}
                    style={{ opacity: i < shown ? 1 : 0.18, transition: reduced ? "none" : "opacity .45s ease" }}>
                    <Box as="td" py="12px" minW={0} sx={{ paddingInlineEnd: "10px" }}>
                      <Box color={t.fg} fontWeight={500} textDecoration={state === "rejected" ? "line-through" : "none"}
                        sx={{ textDecorationColor: t.red }}>{tr(l.acct)}</Box>
                      <Box mt="3px" display="inline-flex" alignItems="center" gap="6px" fontSize="12.5px" color={t.fgMuted}>
                        <Box as="span" w="7px" h="7px" borderRadius="999px" aria-hidden
                          bg={l.cls === "customer" ? t.green : l.cls === "settlement" ? t.amber : t.accentText} />
                        {tr(CLASS_LABEL[l.cls])}
                      </Box>
                    </Box>
                    <Box as="td" py="12px" textAlign="end" whiteSpace="nowrap" sx={{ fontVariantNumeric: "tabular-nums" }}
                      color={l.amt < 0 ? t.fg : t.green} fontWeight={600}>
                      <span dir="ltr">{fmt(l.amt)} <Box as="span" color={t.fgFaint} fontWeight={500} fontSize="0.86em">{l.cur}</Box></span>
                    </Box>
                  </Box>
                ))}
              </Box>
            ))}
            <Box as="tfoot">
              <Box as="tr" borderTop="2px solid" borderColor={t.fg}>
                <Box as="th" scope="row" textAlign="start" py="14px" fontWeight={600} color={t.fg}>{tr("safety.ledger.total")}</Box>
                <Box as="td" py="14px" textAlign="end" fontWeight={700} color={statusColor} sx={{ fontVariantNumeric: "tabular-nums" }}>
                  <span dir="ltr">{Math.abs(sum) < 1e-9 ? "0.00" : fmt(sum)} <Box as="span" color={t.fgFaint} fontWeight={500} fontSize="0.86em">{cur}</Box></span>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* scale + status */}
        <Box order={{ base: 1, lg: 2 }} display="flex" flexDirection="column" alignItems="center" gap="14px">
          <Box w={{ base: "220px", md: "100%" }}>
            <Scale outCount={posted.filter((l) => l.amt < 0).length} inCount={posted.filter((l) => l.amt > 0).length}
              angle={angle} state={state} reduced={reduced} />
            <Box display="flex" justifyContent="space-between" px="4%" mt="-6px" fontSize="12.5px" color={t.fgFaint} aria-hidden>
              <span>{tr("safety.ledger.out")}</span><span>{tr("safety.ledger.in")}</span>
            </Box>
          </Box>
          <Box aria-live="polite" display="inline-flex" alignItems="center" gap="8px" minH="28px" fontSize="15px" fontWeight={600} color={statusColor}>
            {state === "balanced" && <FiCheck aria-hidden />}
            {state === "rejected" && <FiX aria-hidden />}
            {statusText}
          </Box>
          {!reduced && (
            <Box as="button" type="button" onClick={() => setRun((r) => r + 1)} display="inline-flex" alignItems="center" gap="8px"
              minH="44px" px="14px" color={t.accentText} fontSize="14px" fontWeight={600} borderRadius="999px"
              _hover={{ textDecoration: "underline", textUnderlineOffset: "4px" }}
              _focusVisible={{ outline: `2px solid ${t.accentText}`, outlineOffset: "2px" }}>
              <FiRotateCcw aria-hidden /> {tr("safety.ledger.replay")}
            </Box>
          )}
        </Box>
      </Box>

      <Box as="p" mt="22px" maxW="70ch" color={t.fgMuted} fontSize="15.5px" lineHeight={1.65} style={{ textAlign: "start" }}>
        {tr(SCENARIOS[scenario].note)}
      </Box>

      {/* fund classes */}
      <Box mt="36px" display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", md: "repeat(3, minmax(0,1fr))" }} gap={{ base: "18px", md: "28px" }}>
        {CLASSES.map((c) => {
          const on = involved.has(c.id);
          const tone = c.id === "customer" ? t.green : c.id === "settlement" ? t.amber : t.accentText;
          return (
            <Box key={c.id} pt="16px" borderTop="2px solid" borderColor={on ? tone : t.border} transition="border-color .4s ease">
              <Box display="flex" alignItems="center" gap="8px" fontSize="16px" fontWeight={600} color={t.fg}>
                <Box as="span" w="8px" h="8px" borderRadius="999px" bg={tone} aria-hidden />
                {tr(c.title)}
              </Box>
              <Box as="p" mt="6px" fontSize="14.5px" lineHeight={1.6} color={t.fgMuted} style={{ textAlign: "start" }}>{tr(c.body)}</Box>
            </Box>
          );
        })}
      </Box>
      <Footnote mt="18px">{tr("safety.ledger.illustrative")}</Footnote>
    </Box>
  );
}
