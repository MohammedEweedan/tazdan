"use client";

import { useEffect, useState } from "react";

/**
 * Scroll-spy for a document's sections. The active section is the last one
 * whose top has passed a reading line ~30% down the viewport (never above the
 * fixed nav + sticky contents bar). Measured on scroll in one rAF, so it stays
 * cheap with a long document.
 */
export function useScrollSpy(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join("|");

  useEffect(() => {
    const list = key ? key.split("|") : [];
    if (!list.length) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const line = Math.max(150, window.innerHeight * 0.3);
      let current: string | null = null;
      for (const id of list) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = id;
        else break;
      }
      setActive((prev) => (prev === current ? prev : current));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [key]);

  return active;
}
