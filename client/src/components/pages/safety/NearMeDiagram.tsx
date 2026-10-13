"use client";

/* NearMeDiagram — how P2P "Near me" keeps a seller's address out of it:
   opt-in → the point is rounded to a ~1 km cell before it's stored → other
   people only ever see a rounded distance (server/src/utils/geo.ts,
   displayDistanceKm). The three steps are real text beside a decorative SVG;
   the animation loops while on screen and is static under reduced motion. */

import { useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import { useInView } from "framer-motion";
import { useTranslate } from "@tolgee/react";
import { useMediaReducedMotion, useSiteTheme } from "@/components/site";

const STEPS = [
  { title: "safety.near.s1.title", body: "safety.near.s1.body" },
  { title: "safety.near.s2.title", body: "safety.near.s2.body" },
  { title: "safety.near.s3.title", body: "safety.near.s3.body" },
];

export default function NearMeDiagram() {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const reduced = useMediaReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reduced || !inView) return;
    const id = window.setInterval(() => setPhase((p) => (p + 1) % 3), 2600);
    return () => window.clearInterval(id);
  }, [reduced, inView]);

  const p = reduced ? 2 : phase;
  const ease = reduced ? "none" : "all .7s cubic-bezier(.22,1,.36,1)";
  const grid = Array.from({ length: 11 }, (_, i) => i * 32);
  // the seller's exact spot and the ~1 km cell it is rounded into
  const exact = { x: 205, y: 77 };
  const cell = { x: 192, y: 64, s: 32 };
  const buyer = { x: 72, y: 172 };

  return (
    <Box ref={ref} display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", md: "minmax(0,1fr) minmax(0,1fr)" }}
      gap={{ base: "24px", md: "40px" }} alignItems="center">
      <Box as="svg" viewBox="0 0 320 230" w="100%" maxW="420px" mx="auto" aria-hidden display="block"
        borderRadius="18px" bg={t.bg} border="1px solid" borderColor={t.border}>
        {grid.map((g) => <line key={`v${g}`} x1={g} y1={0} x2={g} y2={230} stroke={t.border} strokeWidth={1} />)}
        {grid.slice(0, 8).map((g) => <line key={`h${g}`} x1={0} y1={g} x2={320} y2={g} stroke={t.border} strokeWidth={1} />)}
        {/* rounded cell */}
        <rect x={cell.x} y={cell.y} width={cell.s} height={cell.s} rx={6}
          fill={t.greenSoft} stroke={t.green} strokeWidth={1.5} strokeDasharray="4 3"
          style={{ opacity: p >= 1 ? 1 : 0, transition: ease }} />
        {/* exact spot: shown, then dropped */}
        <g style={{ opacity: p === 0 ? 1 : 0, transition: ease }}>
          <circle cx={exact.x} cy={exact.y} r={12} fill={t.amberSoft} />
          <circle cx={exact.x} cy={exact.y} r={4.5} fill={t.amber} />
        </g>
        {/* stored point = cell centre */}
        <circle cx={cell.x + 16} cy={cell.y + 16} r={4} fill={t.green} style={{ opacity: p >= 1 ? 1 : 0, transition: ease }} />
        {/* buyer and the rough distance */}
        <circle cx={buyer.x} cy={buyer.y} r={6} fill={t.fg} />
        <circle cx={buyer.x} cy={buyer.y} r={14} fill="none" stroke={t.borderStrong} />
        <line x1={buyer.x} y1={buyer.y} x2={cell.x + 16} y2={cell.y + 16} stroke={t.fgMuted} strokeWidth={1.5} strokeDasharray="5 5"
          style={{ opacity: p === 2 ? 1 : 0, transition: ease }} />
        <g style={{ opacity: p === 2 ? 1 : 0, transition: ease }}>
          <rect x={92} y={98} width={104} height={28} rx={14} fill={t.bgElev} stroke={t.borderStrong} />
          <text x={144} y={117} textAnchor="middle" fontSize={13} fontWeight={600} fill={t.fg}>{tr("safety.near.distance")}</text>
        </g>
      </Box>
      <Box as="ol" listStyleType="none" display="grid" gap="18px">
        {STEPS.map((s, i) => {
          const on = reduced || i === p;
          return (
            <Box as="li" key={s.title} display="flex" gap="14px" alignItems="flex-start">
              <Box w="28px" h="28px" minW="28px" borderRadius="999px" display="flex" alignItems="center" justifyContent="center"
                fontSize="13px" fontWeight={700} border="1px solid" transition="all .4s ease"
                bg={on ? t.fg : "transparent"} color={on ? t.bg : t.fgMuted} borderColor={on ? t.fg : t.borderStrong}
                aria-hidden>{i + 1}</Box>
              <Box>
                <Box fontSize="16.5px" fontWeight={600} color={t.fg}>{tr(s.title)}</Box>
                <Box as="p" mt="4px" fontSize="15px" lineHeight={1.6} color={t.fgMuted} style={{ textAlign: "start" }}>{tr(s.body)}</Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
