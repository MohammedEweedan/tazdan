"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   BrandLoader — the app's launch splash, on the web.

   The ن mark from the app icon on brand navy: the lower arc draws itself,
   the wallet clasp pops in, then the dot drops onto the gap and "boops"
   (squash, overshoot, settle). Pure SVG + CSS, so it is in the first HTML
   paint before any script runs. Same timing and geometry as the mobile app
   (mobile/src/components/ui/LaunchSplash.tsx).

   <FirstLoadOverlay>  once per browser session on first load, then fades
                        into the page. An inline <head> script hides it before
                        paint on later loads in the same session.
   <BrandLoader overlay> full-screen, for route transitions (app/loading.tsx).
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";

export const LOADER_NAVY = "#24384F";
export const LOADER_SEEN_KEY = "tz-loader-seen";
/** The mark finishes drawing at ~1.6 s; never cut it off. */
const MIN_MS = 1650;

const CSS = `
.tz-loader{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:${LOADER_NAVY};transition:opacity .38s ease-out}
.tz-loader[data-leaving="1"]{opacity:0;pointer-events:none}
.tz-loader[data-leaving="1"] .tz-mark{transform:scale(1.08);transition:transform .38s ease-out}
html[data-tz-loader-seen] .tz-loader[data-first="1"]{display:none}
.tz-mark{width:min(40vw,40vh,220px);height:auto;overflow:visible}
.tz-bowl{stroke-dasharray:1700;stroke-dashoffset:1700;animation:tz-draw .95s cubic-bezier(.65,0,.35,1) .12s forwards}
.tz-clasp{opacity:0;transform-box:fill-box;transform-origin:center;animation:tz-pop .42s cubic-bezier(.34,1.56,.64,1) .82s forwards}
.tz-dot{opacity:0;transform-box:fill-box;transform-origin:50% 100%;animation:tz-drop .25s cubic-bezier(.55,0,1,.45) 1.12s forwards,tz-boop .42s ease-out 1.37s}
.tz-body{animation:tz-press .36s ease-out 1.37s}
@keyframes tz-draw{to{stroke-dashoffset:0}}
@keyframes tz-pop{0%{opacity:0;transform:scale(.4)}60%{opacity:1;transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}
@keyframes tz-drop{0%{opacity:0;transform:translateY(-110px)}20%{opacity:1}100%{opacity:1;transform:translateY(0)}}
@keyframes tz-boop{0%{transform:scale(1,1)}17%{transform:scale(1.28,.7)}43%{transform:scale(.92,1.1)}70%{transform:scale(1.03,.97)}100%{transform:scale(1,1)}}
@keyframes tz-press{0%,100%{transform:translateY(0)}22%{transform:translateY(14px)}}
@media (prefers-reduced-motion:reduce){.tz-bowl,.tz-clasp,.tz-dot,.tz-body{animation:none;opacity:1;stroke-dashoffset:0}}
`;

/** The animated ن (icon geometry, 1254-unit canvas cropped to the mark). */
export function BrandMark() {
  return (
    <svg className="tz-mark" viewBox="240 210 765 770" role="img" aria-label="tazdan">
      <g className="tz-body">
        <path className="tz-bowl" fill="none" stroke="#fff" strokeWidth="87" strokeLinecap="round" strokeLinejoin="round"
          d="M497 445 L454 445 A155.5 155.5 0 0 0 298.5 600.5 L298.5 766 A155.5 155.5 0 0 0 454 921.5 L765 921.5 A155.5 155.5 0 0 0 920.5 766 L920.5 600.5 A155.5 155.5 0 0 0 765 445 L730 445" />
        <g className="tz-clasp">
          <rect x="635" y="584" width="355" height="207" rx="103.5" fill="#fff" />
          <circle cx="878" cy="687" r="39" fill={LOADER_NAVY} />
        </g>
      </g>
      <circle className="tz-dot" cx="618" cy="350" r="69" fill="#fff" />
    </svg>
  );
}

export function BrandLoader({ leaving = false, first = false }: { leaving?: boolean; first?: boolean }) {
  return (
    <div className="tz-loader" data-leaving={leaving ? "1" : "0"} data-first={first ? "1" : "0"} role="status" aria-live="polite" aria-label="Loading">
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <BrandMark />
    </div>
  );
}

/** First visit in a session: the mark plays over the page, then fades into it. */
export function FirstLoadOverlay() {
  const [phase, setPhase] = useState<"show" | "leave" | "gone">("show");
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(LOADER_SEEN_KEY) === "1"; } catch { /* private mode */ }
    if (seen) { setPhase("gone"); return; }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let timers: number[] = [];
    const finish = () => {
      // performance.now() counts from navigation start, when the CSS animation began.
      const wait = reduced ? 0 : Math.max(0, MIN_MS - performance.now());
      timers.push(window.setTimeout(() => {
        setPhase("leave");
        try { sessionStorage.setItem(LOADER_SEEN_KEY, "1"); } catch { /* ignore */ }
        timers.push(window.setTimeout(() => setPhase("gone"), 420));
      }, wait));
    };
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    return () => { window.removeEventListener("load", finish); timers.forEach(clearTimeout); timers = []; };
  }, []);
  if (phase === "gone") return null;
  return <BrandLoader first leaving={phase === "leave"} />;
}

/** Inline <head> script: hide the first-load overlay before paint once this session has seen it. */
export const LOADER_SEEN_SCRIPT = `try{if(sessionStorage.getItem("${LOADER_SEEN_KEY}")==="1")document.documentElement.setAttribute("data-tz-loader-seen","")}catch(e){}`;
