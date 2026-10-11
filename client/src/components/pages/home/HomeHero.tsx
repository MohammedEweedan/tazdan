"use client";

import { useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { Container, Eyebrow, Footnote, Headline, Lead, SiteButton, useSiteTheme, useWaitlist } from "@/components/site";
import HomeHeroVisual from "./HomeHeroVisual";

/** The product arrives first; the message resolves over it in one reveal. */
export default function HomeHero() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const { open } = useWaitlist();
  const [playing, setPlaying] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [copyVisible, setCopyVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(reduced);
    if (reduced) { setPlaying(false); setCopyVisible(true); setRevealed(true); return; }
    const copyTimer = window.setTimeout(() => setCopyVisible(true), 3100);
    const timer = window.setTimeout(() => { setPlaying(false); setRevealed(true); }, 4000);
    return () => { window.clearTimeout(copyTimer); window.clearTimeout(timer); };
  }, []);
  useEffect(() => {
    const hero = heroRef.current;
    const video = videoRef.current;
    if (!hero || !video) return;
    const update = (onScreen: boolean) => {
      if (onScreen && !document.hidden) void video.play().catch(() => {});
      else video.pause();
    };
    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(visible); });
    const onVisibility = () => update(visible);
    io.observe(hero);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVisibility); video.pause(); };
  }, [revealed, reducedMotion]);
  return (
    <Box as="header" ref={heroRef} id="hero" position="relative" overflow="hidden" isolation="isolate"
      minH={{ base: "max(680px, 100svh)", lg: "max(800px, 100svh)" }}
      display="flex" alignItems="center" justifyContent="center" pt="96px" pb="64px"
      sx={{
        "@keyframes hero-product-reveal": {
          "0%": { opacity: 0, transform: "scale(.94)", filter: "blur(0px)" },
          "7%": { opacity: 1, transform: "scale(1)", filter: "blur(0px)" },
          "70%": { opacity: 1, transform: "scale(1)", filter: "blur(0px)" },
          "100%": { opacity: 0, transform: "scale(1.04)", filter: "blur(18px)" },
        },
        "@keyframes hero-copy-reveal": {
          from: { opacity: 0, transform: "translateY(18px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        ".hero-copy-step": { animation: "hero-copy-reveal .9s cubic-bezier(.22,1,.36,1) both" },
        "@media (prefers-reduced-motion: reduce)": {
          ".hero-product": { animation: "none", opacity: 0 },
          ".hero-copy-step": { animation: "none" },
        },
      }}>
      <Box aria-hidden position="absolute" inset={0} bg={theme.glow} opacity={.45} />
      {revealed && !reducedMotion && <Box aria-hidden position="absolute" inset={0} pointerEvents="none"
        opacity={videoReady ? (theme.dark ? .3 : .15) : 0} transition="opacity 1.2s ease"
        sx={{ maskImage: "linear-gradient(#000 70%, transparent)", WebkitMaskImage: "linear-gradient(#000 70%, transparent)" }}>
        <video ref={videoRef} autoPlay muted playsInline loop preload="none"
          onLoadedData={() => setVideoReady(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}>
          <source src="/videos/hero-background.mp4" type="video/mp4" />
        </video>
      </Box>}
      <Box className="hero-product" aria-hidden position="absolute" inset={0}
        display="flex" alignItems="center" justifyContent="center" pointerEvents="none"
        sx={{ animation: "hero-product-reveal 4s ease-in-out both" }}>
        <HomeHeroVisual playing={playing} />
      </Box>
      <Container position="relative" zIndex={2} display="flex" flexDirection="column"
        alignItems="center" textAlign="center" visibility={copyVisible ? "visible" : "hidden"}
        sx={{ ".hero-copy-step": { animationPlayState: copyVisible ? "running" : "paused" } }}>
        <Eyebrow className="hero-copy-step" mb="20px">{t("home.hero.eyebrow")}</Eyebrow>
        <Headline className="hero-copy-step" text={t("home.hero.title")} size="hero" maxW="15ch"
          textAlign="center" sx={{ animationDelay: ".15s", textWrap: "balance" }} />
        <Lead className="hero-copy-step" align="center" mt="24px" maxW="48ch" sx={{ animationDelay: ".3s" }}>
          {t("home.hero.lead")}
        </Lead>
        <Box className="hero-copy-step" mt="32px" display="flex" gap="12px" flexWrap="wrap"
          justifyContent="center" alignItems="center" sx={{ animationDelay: ".5s" }}>
          <SiteButton size="lg" onClick={open} arrow>{t("home.hero.primary")}</SiteButton>
          <SiteButton size="lg" variant="secondary" href="#story">{t("home.hero.secondary")}</SiteButton>
        </Box>
        <Footnote className="hero-copy-step" align="center" mt="20px" maxW="52ch" sx={{ animationDelay: ".7s" }}>
          {t("home.hero.note")}
        </Footnote>
      </Container>
    </Box>
  );
}
