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
import { APP_GIFS, APP_LOOPS, APP_SCREENS, APP_VIDEOS, gifSrc, loopSrc, screenSrc, videoSrc, type AppMediaVariant } from "@/content/appMedia";
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

/** Observe the media container, so posters and videos share the same lifecycle. */
function useMediaVisibility() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    const update = () => setForeground(!document.hidden);
    update();
    io.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return { ref, visible: visible && foreground };
}

type MediaSource = { mp4: string; webm: string; poster: string };

/** Load once near the viewport, then pause without losing the current frame. */
function MediaLoop({ src, alt, playing, priority, onError }: {
  src: MediaSource; alt: string; playing: boolean; priority?: boolean; onError: () => void;
}) {
  const { ref: containerRef, visible } = useMediaVisibility();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const active = visible && playing;
  useEffect(() => { if (active) setLoaded(true); }, [active]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (loaded && active) void video.play().catch(() => {});
    else video.pause();
  }, [loaded, active]);
  return (
    <Box ref={containerRef} position="absolute" inset={0}>
      {/* A sharp poster also covers the first decode, so the bezel never flashes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src.poster} alt="" aria-hidden loading={priority ? "eager" : "lazy"} decoding="async" style={fill} />
      <video
        ref={videoRef}
        muted loop playsInline preload="none"
        src={loaded ? src.mp4 : undefined}
        poster={src.poster}
        onLoadedData={() => { if (active) void videoRef.current?.play().catch(() => {}); }}
        onError={onError}
        aria-label={alt}
        disablePictureInPicture
        style={fill}
      />
    </Box>
  );
}

function ScreenImage({ id, variant, gifVariant, alt, priority, playing }: {
  id: string; variant: AppMediaVariant | null; gifVariant: AppMediaVariant | null;
  alt: string; priority?: boolean; playing: boolean;
}) {
  const { ref, visible } = useMediaVisibility();
  const animated = playing && visible && gifVariant && (!variant || gifVariant === variant);
  const src = animated ? gifSrc(id, gifVariant) : variant ? screenSrc(id, variant) : null;
  return (
    <Box ref={ref} position="absolute" inset={0}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" draggable={false} style={fill} />
      ) : <Placeholder label={alt} />}
    </Box>
  );
}

/** Page-screen animations use smooth, controllable recordings when available.
 *  GIFs remain a fallback; pausing or reduced motion shows the captured still. */
export function AppScreen({ id, alt, priority, still, playing = true }: {
  id: string; alt: string; priority?: boolean; still?: boolean; playing?: boolean;
}) {
  const variant = useMediaVariant(APP_SCREENS[id]?.variants);
  const loopVariant = useMediaVariant(APP_LOOPS[id]?.variants);
  const gifVariant = useMediaVariant(APP_GIFS[id]);
  const reduced = useReducedMotion();
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const animated = !still && !reduced;
  const src = loopVariant ? loopSrc(id, loopVariant) : null;
  if (animated && src && failedSource !== src.mp4 && (!variant || loopVariant === variant)) {
    return <MediaLoop key={src.mp4} src={src} alt={alt} priority={priority} playing={playing}
      onError={() => setFailedSource(src.mp4)} />;
  }
  return <ScreenImage id={id} variant={variant} gifVariant={gifVariant} alt={alt} priority={priority} playing={animated && playing} />;
}

/** A captured screen recording; falls back to the still with the same id
 *  (or `fallbackScreen`) when the video hasn't been produced. */
export function AppVideo({
  id, alt, fallbackScreen, playing = true,
}: { id: string; alt: string; fallbackScreen?: string; playing?: boolean }) {
  const variant = useMediaVariant(APP_VIDEOS[id]?.variants);
  const reduced = useReducedMotion();
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const src = variant ? videoSrc(id, variant) : null;
  if (!src || failedSource === src.mp4 || reduced) {
    return <AppScreen id={fallbackScreen ?? id} alt={alt} still={Boolean(reduced)} playing={playing} />;
  }
  return <MediaLoop key={src.mp4} src={src} alt={alt} playing={playing} onError={() => setFailedSource(src.mp4)} />;
}

/** One item a phone can show: a recording or a still. */
export type PhoneMedia = { video?: string; screen?: string; alt: string };

/** A phone that crossfades between media items (driven by `index`). */
export function PhoneStage({
  items, index, priority, playing = true, ...rest
}: { items: PhoneMedia[]; index: number; priority?: boolean; playing?: boolean } & BoxProps) {
  const reduced = useReducedMotion();
  const item = items[Math.max(0, Math.min(index, items.length - 1))];
  if (items.length === 1) {
    return (
      <PhoneFrame {...rest}>
        {item.video ? (
          <AppVideo id={item.video} alt={item.alt} fallbackScreen={item.screen} playing={playing} />
        ) : (
          <AppScreen id={item.screen ?? ""} alt={item.alt} priority={priority} playing={playing} />
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
            <AppVideo id={item.video} alt={item.alt} fallbackScreen={item.screen} playing={playing} />
          ) : (
            <AppScreen id={item.screen ?? ""} alt={item.alt} priority={priority} playing={playing} />
          )}
        </motion.div>
      </AnimatePresence>
    </PhoneFrame>
  );
}
