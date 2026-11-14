"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Landing language — the landing page's signature sections, generalised so
   every page reads like the landing page:

   <MediaHero>   full-height hero: brand glow, optional background loop
                 (masked, dimmed, paused off-screen), centred copy that
                 resolves in a staggered reveal. The landing's own hero
                 (pages/home/HomeHero) adds its product intro on top of this.
   <BentoGrid> / <BentoCard>
                 the landing's showcase tiles: 24px radius, elevated surface,
                 hairline, icon + status chip + title + body + optional link
                 and visual. A 6-column grid on desktop; cards take `span`.
   <BrandMoment> the glowing wordmark interlude ("Impressed? There's more").
   <PhoneJourney> lives in ./PhoneJourney (pinned phone, real screens).
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { Box, type BoxProps } from "@chakra-ui/react";
import { useMediaReducedMotion } from "./device";
import type { IconType } from "react-icons";
import { Body, Container, Eyebrow, Footnote, Headline, Lead, SiteButton, StatusChip, type Status } from "./primitives";
import { useSiteTheme } from "./tokens";

const REVEAL_SX = {
  "@keyframes media-hero-reveal": {
    from: { opacity: 0, transform: "translateY(18px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
  ".media-hero-step": { animation: "media-hero-reveal .9s cubic-bezier(.22,1,.36,1) both" },
  "@media (prefers-reduced-motion: reduce)": { ".media-hero-step": { animation: "none" } },
};

/** Full-height hero in the landing's style. `video` is a public path to a
 *  muted loop (e.g. "/videos/hero-background.mp4"); `image` a still. */
export function MediaHero({
  eyebrow, title, lead, actions, note, video, image, compact, children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  actions?: React.ReactNode;
  note?: string;
  video?: string;
  image?: string;
  /** shorter hero for inner pages (~78vh instead of a full screen) */
  compact?: boolean;
  /** optional visual under the copy (a phone, a diagram…) */
  children?: React.ReactNode;
}) {
  const t = useSiteTheme();
  const reduced = useMediaReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hero = ref.current;
    const el = videoRef.current;
    if (!hero || !el) return;
    let visible = true;
    const update = () => (visible && !document.hidden ? void el.play().catch(() => {}) : el.pause());
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); });
    io.observe(hero);
    document.addEventListener("visibilitychange", update);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", update); el.pause(); };
  }, [video, reduced]);

  const mask = { maskImage: "linear-gradient(#000 70%, transparent)", WebkitMaskImage: "linear-gradient(#000 70%, transparent)" };
  return (
    <Box
      as="header"
      ref={ref}
      position="relative"
      overflow="hidden"
      isolation="isolate"
      minH={children ? undefined : compact ? { base: "560px", lg: "max(640px, 78svh)" } : { base: "max(640px, 100svh)", lg: "max(760px, 100svh)" }}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      pt={{ base: "112px", md: "128px" }}
      pb={children ? "0" : "64px"}
      sx={REVEAL_SX}
    >
      <Box aria-hidden position="absolute" inset={0} bg={t.glow} opacity={0.45} />
      {video && !reduced && (
        <Box aria-hidden position="absolute" inset={0} pointerEvents="none" opacity={ready ? (t.dark ? 0.3 : 0.15) : 0} transition="opacity 1.2s ease" sx={mask}>
          <video ref={videoRef} autoPlay muted playsInline loop preload="none" onLoadedData={() => setReady(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}>
            <source src={video} type="video/mp4" />
          </video>
        </Box>
      )}
      {image && (!video || reduced) && (
        <Box aria-hidden position="absolute" inset={0} opacity={t.dark ? 0.3 : 0.15} bgImage={`url(${image})`} bgSize="cover" bgPosition="center" sx={mask} />
      )}
      <Container position="relative" zIndex={2} display="flex" flexDirection="column" alignItems="center" textAlign="center">
        {eyebrow && <Eyebrow className="media-hero-step" mb="20px">{eyebrow}</Eyebrow>}
        <Headline className="media-hero-step" text={title} size={compact ? "page" : "hero"} maxW="15ch" textAlign="center"
          sx={{ animationDelay: ".12s", textWrap: "balance" }} />
        {lead && <Lead className="media-hero-step" align="center" mt="24px" maxW="48ch" sx={{ animationDelay: ".26s" }}>{lead}</Lead>}
        {actions && (
          <Box className="media-hero-step" mt="32px" display="flex" gap="12px" flexWrap="wrap" justifyContent="center" alignItems="center" sx={{ animationDelay: ".42s" }}>
            {actions}
          </Box>
        )}
        {note && <Footnote className="media-hero-step" align="center" mt="20px" maxW="56ch" sx={{ animationDelay: ".56s" }}>{note}</Footnote>}
      </Container>
      {children && (
        <Container position="relative" zIndex={1} mt="clamp(48px, 6vw, 80px)" className="media-hero-step" sx={{ animationDelay: ".6s" }}>
          {children}
        </Container>
      )}
    </Box>
  );
}

/** 6-column bento grid (one column on phones). */
export function BentoGrid({ children, ...rest }: BoxProps) {
  return (
    <Box display="grid" gap="16px" gridTemplateColumns={{ base: "minmax(0,1fr)", md: "repeat(6, minmax(0,1fr))" }} {...rest}>
      {children}
    </Box>
  );
}

/** One bento tile. `span` = desktop columns out of 6 (2, 3, 4 or 6). */
export function BentoCard({
  icon: Icon, status, title, body, link, visual, span = 3, size = "item", children, ...rest
}: {
  icon?: IconType;
  status?: Status;
  title: string;
  body?: React.ReactNode;
  link?: { href: string; label: string };
  /** decorative or illustrative content pinned to the bottom of the tile */
  visual?: React.ReactNode;
  span?: 2 | 3 | 4 | 6;
  size?: "item" | "sub";
  children?: React.ReactNode;
} & Omit<BoxProps, "title">) {
  const t = useSiteTheme();
  return (
    <Box
      border="1px solid"
      borderColor={t.border}
      borderRadius="24px"
      bg={t.bgElev}
      p={{ base: "26px", md: "34px" }}
      display="flex"
      flexDirection="column"
      gridColumn={{ base: "auto", md: `span ${span}` }}
      minW={0}
      {...rest}
    >
      {(Icon || status) && (
        <Box display="flex" alignItems="center" justifyContent="space-between" gap="10px" mb="18px">
          {Icon ? <Box color={t.accentText}><Icon size={27} aria-hidden /></Box> : <span />}
          {status && <StatusChip status={status} />}
        </Box>
      )}
      <Headline text={title} size={size} maxW={size === "sub" ? "15ch" : undefined} />
      {body && <Body mt="10px" maxW="46ch">{body}</Body>}
      {children}
      {link && (
        <Box mt="20px">
          <SiteButton variant="link" href={link.href} arrow>{link.label}</SiteButton>
        </Box>
      )}
      {visual && <Box mt="auto" pt="28px" w="100%">{visual}</Box>}
    </Box>
  );
}

/** The landing's brand interlude: the wordmark glowing on near-black, with
 *  one light sweep when it scrolls into view, and a short line under it. */
export function BrandMoment({ line }: { line: string }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useMediaReducedMotion();
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const mask = {
    WebkitMaskImage: "url(/logo-color.png)", maskImage: "url(/logo-color.png)",
    WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
    WebkitMaskPosition: "center", maskPosition: "center",
  } as const;
  return (
    <Box as="section" ref={ref} bg="#05070A" color="#F4F5F7" minH={{ base: "52vh", md: "64vh" }}
      display="flex" alignItems="center" justifyContent="center" py="80px" px="20px" textAlign="center"
      sx={{
        "@keyframes brand-sweep": { from: { transform: "translateX(-120%)" }, to: { transform: "translateX(120%)" } },
      }}>
      <Box display="flex" flexDirection="column" alignItems="center" gap="28px">
        <Box position="relative" w="min(440px, 66vw)" sx={{ aspectRatio: "937 / 240" }} filter="drop-shadow(0 16px 42px rgba(36,56,79,.45))">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-color.png" alt="tazdan" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          {seen && !reduced && (
            <Box aria-hidden position="absolute" inset={0} style={mask} overflow="hidden">
              <Box position="absolute" inset={0} bg="linear-gradient(100deg, transparent 30%, rgba(255,255,255,.55) 50%, transparent 70%)"
                sx={{ animation: "brand-sweep 1.6s cubic-bezier(.22,1,.36,1) .2s both" }} />
            </Box>
          )}
        </Box>
        <Box fontSize={{ base: "18px", md: "21px" }} color="rgba(244,245,247,0.78)">{line}</Box>
      </Box>
    </Box>
  );
}
