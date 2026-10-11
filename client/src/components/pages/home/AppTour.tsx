"use client";

// Silent recordings advance only after the complete flow has played.
// The previous frame stays behind the next poster during each crossfade.

import { useCallback, useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslate } from "@tolgee/react";
import type { IconType } from "react-icons";
import {
  FiBriefcase, FiChevronLeft, FiChevronRight, FiEyeOff, FiGlobe, FiHome, FiMessageCircle, FiPause, FiPlay,
  FiSend, FiTarget, FiUsers,
} from "react-icons/fi";
import {
  AppScreen, Body, Container, EASE, Footnote, Headline, MONO, PhoneFrame, Reveal, Section, SectionHeader,
  StatusChip, useMediaVariant, useSiteLocale, useSiteTheme, type Status,
} from "@/components/site";
import { APP_SCREENS, APP_VIDEOS, screenSrc, videoSrc } from "@/content/appMedia";

/** How long a still (or a screen that hasn't been captured yet) stays up. */
const STILL_MS = 8000;

type Stop = {
  id: string;
  icon: IconType;
  video: string;
  screen: string;
  status: Status;
  chip: string;
  title: string;
  body: string;
  alt: string;
};

const STOPS: Stop[] = [
  {
    id: "home", icon: FiHome, video: "tour-home", screen: "home", status: "inApp",
    chip: "home.tour.home.chip", title: "home.tour.home.title", body: "home.tour.home.body", alt: "home.tour.home.alt",
  },
  {
    id: "send", icon: FiSend, video: "flow-send", screen: "send", status: "inApp",
    chip: "home.tour.send.chip", title: "home.tour.send.title", body: "home.tour.send.body", alt: "home.tour.send.alt",
  },
  {
    id: "remit", icon: FiGlobe, video: "flow-remit", screen: "remit", status: "pilot",
    chip: "home.tour.remit.chip", title: "home.tour.remit.title", body: "home.tour.remit.body", alt: "home.tour.remit.alt",
  },
  {
    id: "p2p", icon: FiUsers, video: "flow-p2p", screen: "p2p", status: "inApp",
    chip: "home.tour.p2p.chip", title: "home.tour.p2p.title", body: "home.tour.p2p.body", alt: "home.tour.p2p.alt",
  },
  {
    id: "save", icon: FiTarget, video: "flow-budget", screen: "budgets", status: "inApp",
    chip: "home.tour.save.chip", title: "home.tour.save.title", body: "home.tour.save.body", alt: "home.tour.save.alt",
  },
  {
    id: "chat", icon: FiMessageCircle, video: "flow-chat-pay", screen: "messages", status: "inApp",
    chip: "home.tour.chat.chip", title: "home.tour.chat.title", body: "home.tour.chat.body", alt: "home.tour.chat.alt",
  },
  {
    id: "privacy", icon: FiEyeOff, video: "flow-privacy", screen: "privacy-hidden", status: "inApp",
    chip: "home.tour.privacy.chip", title: "home.tour.privacy.title", body: "home.tour.privacy.body", alt: "home.tour.privacy.alt",
  },
  {
    id: "business", icon: FiBriefcase, video: "flow-business", screen: "business-home", status: "inApp",
    chip: "home.tour.business.chip", title: "home.tour.business.title", body: "home.tour.business.body", alt: "home.tour.business.alt",
  },
];
const N = STOPS.length;
const pad = (n: number) => String(n).padStart(2, "0");
const GUTTER = "clamp(16px, 5vw, 48px)"; // = Container's side padding
const FILL = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" } as const;
type TourStage = { active: number; previous: number | null; ready: boolean };
const changeStage = (stage: TourStage, active: number): TourStage => active === stage.active ? stage : {
  active,
  previous: stage.ready ? stage.active : stage.previous,
  ready: false,
};

/* ── media ───────────────────────────────────────────────────────────────── */

type TourMediaProps = {
  stop: Stop;
  index: number;
  alt: string;
  playing: boolean;
  onReady: (index: number) => void;
  onProgress: (index: number, progress: number) => void;
  onEnded: (index: number) => void;
};

/** A still also remains below the video while its first frame is decoding. */
function TourStill({ stop, index, alt, onReady, decorative = false }: Pick<TourMediaProps, "stop" | "index" | "alt" | "onReady"> & { decorative?: boolean }) {
  const variant = useMediaVariant(APP_SCREENS[stop.screen]?.variants);
  useEffect(() => { if (!variant) onReady(index); }, [variant, index, onReady]);
  if (!variant) return <AppScreen id={stop.screen} alt={alt} still />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={screenSrc(stop.screen, variant)}
      alt={decorative ? "" : alt}
      aria-hidden={decorative || undefined}
      decoding="async"
      draggable={false}
      onLoad={() => onReady(index)}
      onError={() => onReady(index)}
      style={FILL}
    />
  );
}

function TourMedia(props: TourMediaProps) {
  const { stop } = props;
  const variant = useMediaVariant(APP_VIDEOS[stop.video]?.variants);
  // A language/theme change gets a fresh decoder and starts the new clip at 0.
  const source = variant ? videoSrc(stop.video, variant) : null;
  return <TourClip key={source?.mp4 ?? stop.screen} {...props} source={source} />;
}

function TourClip({ stop, index, alt, playing, source, onReady, onProgress, onEnded }: TourMediaProps & { source: ReturnType<typeof videoSrc> | null }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [decoded, setDecoded] = useState(false);
  const shouldPlay = useRef(playing);
  const stillElapsed = useRef(0);
  const ended = useRef(false);
  shouldPlay.current = playing;
  const video = Boolean(source && !failed);

  useEffect(() => { if (playing) setLoaded(true); }, [playing]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !loaded || !video) return;
    if (!playing) {
      el.pause();
      return;
    }
    if (el.ended) {
      if (!ended.current) {
        ended.current = true;
        onEnded(index);
      }
      return;
    }
    el.play().then(() => {
      // A pending play promise can resolve after the visitor pauses/leaves.
      if (!shouldPlay.current) el.pause();
    }).catch((error: DOMException) => {
      if (shouldPlay.current && error.name !== "AbortError") setFailed(true);
    });
    return () => el.pause();
  }, [playing, loaded, video, index, onEnded]);

  // Reading media time means buffering consumes no tour progress. Updating the
  // DOM directly keeps the chip smooth without rerendering React every frame.
  useEffect(() => {
    if (!playing || !video) return;
    let frame = 0;
    const tick = () => {
      const el = ref.current;
      if (el && Number.isFinite(el.duration) && el.duration > 0) onProgress(index, el.currentTime / el.duration);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, video, index, onProgress]);

  // Only a genuine still fallback uses a wall clock, and that clock pauses
  // under the same controls as video playback.
  useEffect(() => {
    if (!playing || video) return;
    const started = performance.now();
    const previous = stillElapsed.current;
    let frame = 0;
    const tick = () => {
      const elapsed = Math.min(STILL_MS, previous + performance.now() - started);
      onProgress(index, elapsed / STILL_MS);
      if (elapsed >= STILL_MS) {
        if (!ended.current) {
          ended.current = true;
          onEnded(index);
        }
      } else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      stillElapsed.current = Math.min(STILL_MS, previous + performance.now() - started);
    };
  }, [playing, video, index, onProgress, onEnded]);

  if (!source || failed) return <TourStill stop={stop} index={index} alt={alt} onReady={onReady} />;
  return (
    <>
      <TourStill stop={stop} index={index} alt={alt} onReady={onReady} decorative />
      {/* The poster has its own layer so the phone never flashes a blank frame. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={source.poster} alt="" aria-hidden decoding="async" draggable={false} onLoad={() => onReady(index)} style={FILL} />
      <video
        ref={ref}
        muted
        playsInline
        preload="none"
        src={loaded ? source.mp4 : undefined}
        onLoadedData={() => { setDecoded(true); onReady(index); }}
        onEnded={() => {
          onProgress(index, 1);
          if (shouldPlay.current && !ended.current) {
            ended.current = true;
            onEnded(index);
          }
        }}
        onError={() => setFailed(true)}
        poster={source.poster}
        aria-label={alt}
        disablePictureInPicture
        style={{ ...FILL, opacity: decoded ? 1 : 0, transition: "opacity .18s ease" }}
      />
    </>
  );
}

/* ── controls ────────────────────────────────────────────────────────────── */

function RoundButton({
  label, onClick, children,
}: { label: string; onClick: () => void; children: React.ReactNode }) {
  const t = useSiteTheme();
  return (
    <Box
      as="button"
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      w="44px"
      h="44px"
      borderRadius="999px"
      border="1px solid"
      borderColor={t.borderStrong}
      color={t.fg}
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      transition="border-color .18s ease, transform .18s ease"
      _hover={{ borderColor: t.fg }}
      _active={{ transform: "scale(0.96)" }}
      _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "3px" }}
    >
      {children}
    </Box>
  );
}

/* ── tour ────────────────────────────────────────────────────────────────── */

export default function AppTour() {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const { isAr, sides } = useSiteLocale();
  const reduced = useReducedMotion();

  const [stage, setStage] = useState<TourStage>({ active: 0, previous: null, ready: false });
  const active = stage.active;
  /** null = the visitor hasn't chosen; then reduced motion means paused. */
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [hover, setHover] = useState(false);
  const [kbFocus, setKbFocus] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  const paused = userPaused ?? Boolean(reduced);
  const playing = inView && pageVisible && !paused && !hover && !kbFocus;

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const activeRef = useRef(active);
  activeRef.current = active;

  const ready = useCallback((index: number) => setStage((current) => current.active === index && !current.ready ? { ...current, ready: true } : current), []);
  const progress = useCallback((index: number, value: number) => {
    if (activeRef.current !== index) return;
    const bar = barRefs.current[index];
    if (bar) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, value))})`;
  }, []);
  const next = useCallback((index: number) => setStage((current) => current.active === index ? changeStage(current, (index + 1) % N) : current), []);

  // Play only while the tour is on screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  // New topic: reset progress and keep its chip in view inside the scroller
  // (horizontal only — never moves the page).
  useEffect(() => {
    barRefs.current.forEach((b) => { if (b) b.style.transform = "scaleX(0)"; });
    const sc = scrollerRef.current;
    const tab = tabRefs.current[active];
    if (sc && tab && sc.scrollWidth > sc.clientWidth + 1) {
      const a = tab.getBoundingClientRect();
      const b = sc.getBoundingClientRect();
      sc.scrollBy({ left: a.left + a.width / 2 - (b.left + b.width / 2), behavior: reduced ? "auto" : "smooth" });
    }
  }, [active, reduced]);

  const select = (i: number, focus?: boolean) => {
    const n = ((i % N) + N) % N;
    setStage((current) => changeStage(current, n));
    if (focus) tabRefs.current[n]?.focus();
  };

  const onTabKey = (e: React.KeyboardEvent) => {
    const fwd = isAr ? "ArrowLeft" : "ArrowRight";
    const back = isAr ? "ArrowRight" : "ArrowLeft";
    const focused = tabRefs.current.findIndex((el) => el === document.activeElement);
    const cur = focused >= 0 ? focused : active;
    let i: number | null = null;
    if (e.key === fwd) i = cur + 1;
    else if (e.key === back) i = cur - 1;
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = N - 1;
    if (i === null) return;
    e.preventDefault();
    select(i, true);
  };

  const hoverProps = {
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === "mouse") setHover(true); },
    onPointerLeave: () => setHover(false),
  };

  const stop = STOPS[active];
  const Prev = isAr ? FiChevronRight : FiChevronLeft;
  const Next = isAr ? FiChevronLeft : FiChevronRight;

  return (
    <Section id="tour" rule aria-labelledby="tour-title">
      <Container>
        <Reveal y={20}>
          <SectionHeader
            eyebrow={tr("home.tour.eyebrow")}
            title={tr("home.tour.title")}
            id="tour-title"
          />
        </Reveal>

        <Box
          ref={rootRef}
          mt="clamp(36px, 5vw, 64px)"
          onFocus={(e: React.FocusEvent) => {
            const el = e.target as HTMLElement;
            if (el.matches?.(":focus-visible")) setKbFocus(true);
          }}
          onBlur={(e: React.FocusEvent) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKbFocus(false);
          }}
        >
          {/* Topic chips */}
          <Box
            ref={scrollerRef}
            role="tablist"
            aria-label={tr("home.tour.tablist")}
            aria-orientation="horizontal"
            position="sticky"
            top="64px"
            zIndex={20}
            onKeyDown={onTabKey}
            display="flex"
            gap="8px"
            flexWrap={{ base: "nowrap", lg: "wrap" }}
            overflowX={{ base: "auto", lg: "visible" }}
            mx={{ base: `calc(-1 * ${GUTTER})`, lg: 0 }}
            px={{ base: GUTTER, lg: 0 }}
            py="14px"
            bg={t.dark ? "rgba(22,24,28,.94)" : "rgba(246,247,250,.94)"}
            sx={{
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
              scrollPaddingInline: GUTTER,
              WebkitOverflowScrolling: "touch",
              backdropFilter: "blur(16px)",
            }}
          >
            {STOPS.map((s, i) => {
              const sel = i === active;
              const Icon = s.icon;
              return (
                <Box
                  key={s.id}
                  as="button"
                  type="button"
                  role="tab"
                  id={`tour-tab-${s.id}`}
                  aria-selected={sel}
                  aria-controls="tour-panel"
                  tabIndex={sel ? 0 : -1}
                  ref={(el: HTMLButtonElement | null) => { tabRefs.current[i] = el; }}
                  onClick={() => select(i)}
                  position="relative"
                  overflow="hidden"
                  display="inline-flex"
                  alignItems="center"
                  gap="8px"
                  h="44px"
                  px="16px"
                  flexShrink={0}
                  borderRadius="999px"
                  border="1px solid"
                  borderColor={sel ? t.accentBorder : t.border}
                  bg={`linear-gradient(135deg, ${sel ? (t.dark ? "rgba(36,56,79,.42)" : "rgba(36,56,79,.38)") : t.accentSoft}, ${t.bg} 95%)`}
                  color={sel ? t.fg : t.fgMuted}
                  fontSize="15px"
                  fontWeight={sel ? 600 : 500}
                  whiteSpace="nowrap"
                  transition="border-color .2s ease, color .2s ease"
                  _hover={{ borderColor: sel ? t.accentBorder : t.borderStrong, color: t.fg }}
                  _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "2px" }}
                >
                  <Box
                    as="span"
                    aria-hidden
                    ref={(el: HTMLSpanElement | null) => { barRefs.current[i] = el; }}
                    position="absolute"
                    inset={0}
                    bg={t.accentSoft}
                    transform="scaleX(0)"
                    transformOrigin={sides.start}
                    pointerEvents="none"
                  />
                  <Box as="span" position="relative" display="inline-flex" color={sel ? t.accentText : "inherit"} aria-hidden>
                    <Icon size={16} />
                  </Box>
                  <Box as="span" position="relative">{tr(s.chip)}</Box>
                </Box>
              );
            })}
          </Box>

          {/* Stage */}
          <Box
            id="tour-panel"
            role="tabpanel"
            aria-labelledby={`tour-tab-${stop.id}`}
            mt={{ base: "28px", lg: "clamp(36px, 4vw, 56px)" }}
            display="grid"
            gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1fr)" }}
            gap={{ base: "32px", lg: "clamp(40px, 6vw, 96px)" }}
            alignItems="center"
          >
            {/* Phone */}
            <Box order={{ base: 1, lg: 2 }} display="flex" justifyContent="center" {...hoverProps}>
              <Box position="relative" h={{ lg: "min(540px, 64vh)" }}>
                <Box aria-hidden position="absolute" inset="-20%" bg={t.glow} pointerEvents="none" />
                <PhoneFrame w={{ base: "min(225px, 59vw)", lg: "auto" }} h={{ base: "auto", lg: "100%" }}>
                  {[stage.previous, active].filter((index): index is number => index !== null).map((index) => {
                    const item = STOPS[index];
                    const current = index === active;
                    return (
                      <motion.div
                        key={item.id}
                        initial={false}
                        animate={{ opacity: !current || stage.previous === null || stage.ready ? 1 : 0 }}
                        transition={{ duration: reduced ? 0 : 0.55, ease: EASE }}
                        aria-hidden={!current}
                        style={{ position: "absolute", inset: 0, zIndex: current ? 1 : 0 }}
                      >
                        <TourMedia
                          stop={item}
                          index={index}
                          alt={tr(item.alt)}
                          playing={playing && current}
                          onReady={ready}
                          onProgress={progress}
                          onEnded={next}
                        />
                      </motion.div>
                    );
                  })}
                </PhoneFrame>
              </Box>
            </Box>

            {/* Copy — every topic shares one grid cell so the height never jumps */}
            <Box order={{ base: 2, lg: 1 }}>
              <Box display="grid" {...hoverProps}>
                {STOPS.map((s, i) => {
                  const on = i === active;
                  return (
                    <Box
                      key={s.id}
                      gridArea="1 / 1"
                      aria-hidden={!on}
                      visibility={on ? "visible" : "hidden"}
                      opacity={on ? 1 : 0}
                      transform={on || reduced ? "none" : "translateY(10px)"}
                      transition={reduced ? "none" : "opacity .45s ease, transform .55s cubic-bezier(.22,1,.36,1), visibility .45s"}
                    >
                      <Box display="flex" alignItems="center" gap="12px" mb="18px" flexWrap="wrap">
                        <Box
                          as="span"
                          fontFamily={MONO}
                          fontSize="13px"
                          color={t.fgFaint}
                          sx={{ fontVariantNumeric: "tabular-nums" }}
                          dir="ltr"
                        >
                          {pad(i + 1)} / {pad(N)}
                        </Box>
                        <StatusChip status={s.status} />
                      </Box>
                      <Headline as="h3" size="sub" text={tr(s.title)} maxW="17ch" />
                      <Body mt="16px" maxW="44ch">{tr(s.body)}</Body>
                    </Box>
                  );
                })}
              </Box>

              <Box mt="28px" display="flex" alignItems="center" gap="10px">
                <RoundButton label={tr("home.tour.prev")} onClick={() => select(active - 1)}>
                  <Prev size={18} />
                </RoundButton>
                <RoundButton
                  label={paused ? tr("common.media.play") : tr("common.media.pause")}
                  onClick={() => setUserPaused(!paused)}
                >
                  {paused ? <FiPlay size={17} /> : <FiPause size={17} />}
                </RoundButton>
                <RoundButton label={tr("home.tour.next")} onClick={() => select(active + 1)}>
                  <Next size={18} />
                </RoundButton>
              </Box>
            </Box>
          </Box>

          <Footnote mt="clamp(32px, 4vw, 48px)" maxW="70ch">{tr("common.media.illustrative")}</Footnote>
        </Box>
      </Container>
    </Section>
  );
}
