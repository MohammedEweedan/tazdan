"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Device — real app screens on the site.

   <PhoneFrame>  CSS iPhone (19.5:9) with a Dynamic Island. Screens captured
                 by the pipeline already carry the iOS status bar and home
                 indicator, so the frame only adds bezel + island.
   <AppScreen>   A still from public/app/screens, picked for the visitor's
                 language and colour mode (ar-dark / en-light / en-dark).
   <AppVideo>    A screen recording from public/app/video — muted, inline,
                 looping, playing only while on screen, poster-only under
                 prefers-reduced-motion.

   Both read src/content/appMedia.ts (written by the capture pipeline) and
   fall back to a quiet placeholder for any id that hasn't been captured, so
   pages never break while media is still being produced.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { Box, type BoxProps } from "@chakra-ui/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { APP_GIFS, APP_SCREENS, APP_VIDEOS, gifSrc, screenSrc, videoSrc, type AppMediaVariant } from "@/content/appMedia";
import { EASE, useSiteLocale, useSiteTheme } from "./tokens";

/** Best available capture variant for this visitor. */
export function useMediaVariant(available: AppMediaVariant[] | undefined): AppMediaVariant | null {
  const { isAr } = useSiteLocale();
  const { dark } = useSiteTheme();
  if (!available || available.length === 0) return null;
  const wanted: AppMediaVariant[] = isAr
    ? ["ar-dark", "en-dark"]
    : dark ? ["en-dark", "en-light"] : ["en-light", "en-dark"];
  return wanted.find((v) => available.includes(v)) ?? available[0];
}

export const hasScreen = (id: string) => Boolean(APP_SCREENS[id]?.variants?.length);
export const hasVideo = (id: string) => Boolean(APP_VIDEOS[id]?.variants?.length);

/* ── frame ───────────────────────────────────────────────────────────────── */

/** iPhone-proportioned frame. Size it with `w` (e.g. "min(320px, 78vw)"). */
export function PhoneFrame({ children, ...rest }: BoxProps) {
  const t = useSiteTheme();
  return (
    <Box
      position="relative"
      w="300px"
      flexShrink={0}
      sx={{ aspectRatio: "393 / 852" }}
      borderRadius="15.5% / 7.2%"
      bg={t.dark ? "#0B0C0E" : "#111215"}
      p="1.35%"
      boxShadow={`${t.phoneShadow}, inset 0 0 0 1px rgba(255,255,255,0.18)`}
      {...rest}
    >
      <Box
        position="relative"
        w="100%"
        h="100%"
        overflow="hidden"
        borderRadius="14.1% / 6.55%"
        bg={t.dark ? "#16181C" : "#F6F7FA"}
        sx={{ isolation: "isolate", transform: "translateZ(0)" }}
      >
        {children}
        {/* Dynamic Island */}
        <Box
          aria-hidden
          position="absolute"
          top="1.35%"
          left="50%"
          transform="translateX(-50%)"
          w="32%"
          h="4.3%"
          borderRadius="999px"
          bg="#000"
          zIndex={3}
        />
      </Box>
    </Box>
  );
}

/* ── media ───────────────────────────────────────────────────────────────── */

function Placeholder({ label }: { label?: string }) {
  const t = useSiteTheme();
  return (
    <Box
      position="absolute"
      inset={0}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bgGradient={`linear(to-b, ${t.bgElev}, ${t.bg})`}
      color={t.fgFaint}
      fontSize="13px"
      textAlign="center"
      px="12%"
    >
      {label}
    </Box>
  );
}

const fill = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" } as const;

/** A captured screen. Plays its animated GIF loop when one exists (the
 *  owner wants page screens animated), the still otherwise — and always the
 *  still under prefers-reduced-motion, since a GIF can't be paused.
 *  `alt` should be a translated description. */
export function AppScreen({ id, alt, priority, still }: { id: string; alt: string; priority?: boolean; still?: boolean }) {
  const variant = useMediaVariant(APP_SCREENS[id]?.variants);
  const gifVariant = useMediaVariant(APP_GIFS[id]);
  const reduced = useReducedMotion();
  if (!variant && !gifVariant) return <Placeholder label={alt} />;
  const animated = !still && !reduced && gifVariant && (!variant || gifVariant === variant);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={animated ? gifSrc(id, gifVariant) : screenSrc(id, (variant ?? gifVariant)!)}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      style={fill}
    />
  );
}

/** A captured screen recording; falls back to the still with the same id
 *  (or `fallbackScreen`) when the video hasn't been produced. */
export function AppVideo({
  id, alt, fallbackScreen, playing = true,
}: { id: string; alt: string; fallbackScreen?: string; playing?: boolean }) {
  const variant = useMediaVariant(APP_VIDEOS[id]?.variants);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (visible && playing && !reduced) setLoaded(true); }, [visible, playing, reduced]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [variant]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (visible && playing && !reduced) el.play().catch(() => {});
    else el.pause();
  }, [visible, playing, reduced, loaded]);

  if (!variant || failed) return <AppScreen id={fallbackScreen ?? id} alt={alt} />;
  const src = videoSrc(id, variant);
  return (
    <video
      ref={ref}
      key={src.mp4}
      muted
      loop
      playsInline
      preload="none"
      src={loaded ? src.mp4 : undefined}
      onError={() => setFailed(true)}
      poster={src.poster}
      aria-label={alt}
      style={fill}
    >
    </video>
  );
}

/** One item a phone can show: a recording or a still. */
export type PhoneMedia = { video?: string; screen?: string; alt: string };

/** A phone that crossfades between media items (driven by `index`). */
export function PhoneStage({
  items, index, priority, ...rest
}: { items: PhoneMedia[]; index: number; priority?: boolean } & BoxProps) {
  const reduced = useReducedMotion();
  const item = items[Math.max(0, Math.min(index, items.length - 1))];
  if (items.length === 1) {
    return (
      <PhoneFrame {...rest}>
        {item.video ? (
          <AppVideo id={item.video} alt={item.alt} fallbackScreen={item.screen} />
        ) : (
          <AppScreen id={item.screen ?? ""} alt={item.alt} priority={priority} />
        )}
      </PhoneFrame>
    );
  }
  return (
    <PhoneFrame {...rest}>
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={`${item.video ?? ""}|${item.screen ?? ""}`}
          initial={reduced ? false : { opacity: 0, scale: 1.015 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.55, ease: EASE }}
          style={{ position: "absolute", inset: 0 }}
        >
          {item.video ? (
            <AppVideo id={item.video} alt={item.alt} fallbackScreen={item.screen} />
          ) : (
            <AppScreen id={item.screen ?? ""} alt={item.alt} priority={priority} />
          )}
        </motion.div>
      </AnimatePresence>
    </PhoneFrame>
  );
}
