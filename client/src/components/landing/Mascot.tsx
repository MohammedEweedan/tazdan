"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Taz — the landing page's guide. The wallet mark come alive: the rounded
   body is the wallet, the bobble on the antenna is the mark's dot, and the
   snap tab on its side is the mark's clasp.

   Motion is plain CSS on purpose. Every limb rotates about a fixed point in
   viewBox units (SVG's default transform-box is view-box), which keeps the
   shoulders pinned — framer-motion would measure each group's bbox instead.
   globals.css already collapses animations under prefers-reduced-motion, so
   the idle loops stop there for free; the one JS loop (the talking mouth)
   checks it explicitly.
   ═══════════════════════════════════════════════════════════════════════════ */

import { memo, useEffect, useId, useState } from "react";
import { useReducedMotion } from "framer-motion";

export type MascotPose = "rest" | "wave" | "point" | "cheer";

const INK = "#1C3149";
const PUPIL = "#0E1A28";
const SPRING = "transform .55s cubic-bezier(.34,1.56,.64,1)";

/* Same command structure (M Q Q Z) so any of these can replace another. */
const MOUTH = {
  smile: "M95 146 Q110 162 125 146 Q110 153 95 146 Z",
  mid:   "M96 145 Q110 166 124 145 Q110 149 96 145 Z",
  open:  "M97 143 Q110 175 123 143 Q110 146 97 143 Z",
} as const;
const TALK_CYCLE: (keyof typeof MOUTH)[] = ["open", "mid", "open", "smile", "mid", "open", "smile"];

/* Right arm is drawn raised; these rotate it about the shoulder. The cheer is
   a bigger, higher wave — the left arm stays down because raising it would
   sweep behind the clasp. */
const RIGHT_ARM: Record<MascotPose, number> = { rest: 105, wave: 0, point: 22, cheer: -16 };
const WAVES: Record<MascotPose, boolean> = { rest: false, wave: true, point: false, cheer: true };
/* Pupil offset per pose — pointing looks at the stage. */
const LOOK: Record<MascotPose, [number, number]> = {
  rest: [0, 1.5], wave: [0, 1.5], point: [4, 1], cheer: [0, -2],
};

const KEYFRAMES = `
@keyframes taz-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
@keyframes taz-antenna { 0%,100% { transform: rotate(-7deg) } 50% { transform: rotate(7deg) } }
@keyframes taz-blink { 0%,92%,100% { transform: scaleY(1) } 96% { transform: scaleY(.12) } }
@keyframes taz-wave { 0%,100% { transform: rotate(-14deg) } 50% { transform: rotate(16deg) } }
`;

function Mascot({
  pose = "rest", talking = false, mirrored = false, label = "Taz",
}: {
  pose?: MascotPose;
  talking?: boolean;
  /** Flip horizontally so Taz faces the stage in RTL layouts. */
  mirrored?: boolean;
  label?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const reduced = useReducedMotion();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!talking || reduced) { setFrame(0); return; }
    const id = window.setInterval(() => setFrame((f) => f + 1), 105);
    return () => window.clearInterval(id);
  }, [talking, reduced]);

  const mouth = talking && !reduced ? MOUTH[TALK_CYCLE[frame % TALK_CYCLE.length]] : MOUTH.smile;
  const [lx, ly] = LOOK[pose];

  return (
    <svg
      viewBox="0 0 220 240"
      role="img"
      aria-label={label}
      style={{ display: "block", width: "100%", height: "auto", overflow: "visible", transform: mirrored ? "scaleX(-1)" : undefined }}
    >
      <style>{KEYFRAMES}</style>
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8EC1ED" />
          <stop offset="1" stopColor="#4F8BC4" />
        </linearGradient>
      </defs>

      <g style={{ animation: "taz-bob 3.4s ease-in-out infinite" }}>
        {/* Antenna — the mark's dot on a stalk. */}
        <g style={{ transformOrigin: "110px 66px", animation: "taz-antenna 2.6s ease-in-out infinite" }}>
          <path d="M110 66 Q104 51 110 39" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <circle cx="110" cy="30" r="10" fill="#A9D0F2" stroke={INK} strokeWidth="3.5" />
          <circle cx="106.5" cy="26.5" r="3" fill="#fff" opacity=".85" />
        </g>

        {/* Arms sit behind the body so the shoulders tuck in. */}
        <g>
          <path d="M46 176 C34 184 27 196 24 208" fill="none" stroke={INK} strokeWidth="13" strokeLinecap="round" />
          <path d="M46 176 C34 184 27 196 24 208" fill="none" stroke="#5E9AD2" strokeWidth="6.5" strokeLinecap="round" />
          <circle cx="23" cy="213" r="9.5" fill="#fff" stroke={INK} strokeWidth="3.5" />
        </g>
        <g style={{ transformOrigin: "174px 176px", transform: `rotate(${RIGHT_ARM[pose]}deg)`, transition: SPRING }}>
          <g
            style={{
              transformOrigin: "174px 176px",
              animation: WAVES[pose] ? `taz-wave ${pose === "cheer" ? ".45s" : ".6s"} ease-in-out infinite` : undefined,
            }}
          >
            <path d="M174 176 C188 172 197 160 201 146" fill="none" stroke={INK} strokeWidth="13" strokeLinecap="round" />
            <path d="M174 176 C188 172 197 160 201 146" fill="none" stroke="#6FA7DC" strokeWidth="6.5" strokeLinecap="round" />
            <circle cx="202" cy="140" r="9.5" fill="#fff" stroke={INK} strokeWidth="3.5" />
          </g>
        </g>

        {/* Body — the wallet. */}
        <rect x="40" y="62" width="140" height="176" rx="50" fill={`url(#${uid}-body)`} stroke={INK} strokeWidth="4" />
        <ellipse cx="76" cy="90" rx="17" ry="8" fill="#fff" opacity=".35" transform="rotate(-24 76 90)" />

        {/* Snap tab — the mark's clasp. */}
        <rect x="22" y="120" width="38" height="30" rx="15" fill="#3E78AE" stroke={INK} strokeWidth="3.5" />
        <circle cx="37" cy="135" r="5" fill="#fff" stroke={INK} strokeWidth="2.5" />

        {/* Brows lift while talking. */}
        <g style={{ transform: talking ? "translateY(-3px)" : "none", transition: "transform .3s ease" }}>
          <path d="M75 88 Q88 81 100 87" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <path d="M120 87 Q132 81 145 88" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        </g>

        {/* Eyes blink as one group; pupils follow the pose. */}
        <g style={{ transformOrigin: "110px 116px", animation: "taz-blink 4.6s ease-in-out infinite" }}>
          <ellipse cx="88" cy="116" rx="15" ry="18" fill="#fff" stroke={INK} strokeWidth="3.5" />
          <ellipse cx="132" cy="116" rx="15" ry="18" fill="#fff" stroke={INK} strokeWidth="3.5" />
          <g style={{ transform: `translate(${lx}px, ${ly}px)`, transition: SPRING }}>
            <circle cx="88" cy="117" r="7.5" fill={PUPIL} />
            <circle cx="132" cy="117" r="7.5" fill={PUPIL} />
            <circle cx="85.5" cy="114" r="2.6" fill="#fff" />
            <circle cx="129.5" cy="114" r="2.6" fill="#fff" />
          </g>
        </g>

        <ellipse cx="68" cy="146" rx="10" ry="6" fill="#FF8FA8" opacity=".5" />
        <ellipse cx="152" cy="146" rx="10" ry="6" fill="#FF8FA8" opacity=".5" />

        <path d={mouth} fill={PUPIL} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export default memo(Mascot);
