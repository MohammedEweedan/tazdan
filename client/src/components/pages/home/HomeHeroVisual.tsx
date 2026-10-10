"use client";

import { useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiArrowUpRight, FiRepeat, FiTarget } from "react-icons/fi";
import { PhoneStage, useSiteTheme } from "@/components/site";

/** Product-led hero motion: a real screen with an understated transfer trace. */
export default function HomeHeroVisual({ playing = true }: { playing?: boolean }) {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.04 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Box ref={ref} position="relative" w="min(580px,100%)"
      h={{ base: "min(530px, 132vw)", lg: "670px" }} minH={{ base: "400px", lg: "470px" }}
      display="flex" alignItems="center" justifyContent="center" isolation="isolate">
      <Box aria-hidden position="absolute" inset="3%" borderRadius="full"
        border="1px solid" borderColor={theme.border} />
      <Box aria-hidden position="absolute" inset="15%" borderRadius="full"
        border="1px solid" borderColor={theme.border} />
      <Box as="svg" viewBox="0 0 560 670" preserveAspectRatio="none" aria-hidden
        position="absolute" inset={0} w="100%" h="100%" overflow="visible">
        <defs>
          <linearGradient id="hero-route" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={theme.accent} stopOpacity=".05" />
            <stop offset=".5" stopColor={theme.accent} stopOpacity=".85" />
            <stop offset="1" stopColor={theme.accent} stopOpacity=".05" />
          </linearGradient>
        </defs>
        <path d="M20 205 C124 100 184 165 267 268 S431 398 540 300"
          fill="none" stroke={theme.borderStrong} strokeWidth="1" />
        <path d="M20 205 C124 100 184 165 267 268 S431 398 540 300"
          fill="none" stroke="url(#hero-route)" strokeWidth="2" strokeLinecap="round"
          strokeDasharray="62 760"
          style={{ animation: "hero-trace 7s linear infinite", animationPlayState: visible && playing ? "running" : "paused" }} />
        <path d="M26 480 C135 390 190 475 280 400 S435 240 530 190"
          fill="none" stroke={theme.borderStrong} strokeWidth="1" />
        <circle cx="20" cy="205" r="4" fill={theme.accent} />
        <circle cx="540" cy="300" r="4" fill={theme.green} />
        <circle cx="26" cy="480" r="4" fill={theme.accent} />
        <circle cx="530" cy="190" r="4" fill={theme.green} />
      </Box>
      <Box position="relative" zIndex={2} sx={{
        animation: "hero-float 8s ease-in-out infinite",
        animationPlayState: visible && playing ? "running" : "paused",
        "@keyframes hero-float": { "50%": { transform: "translateY(-10px)" } },
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}>
        <PhoneStage items={[{ screen: "home", alt: t("home.hero.alt") }]} index={0}
          w={{ base: "min(200px, 49vw)", lg: "300px" }} priority />
      </Box>
      <Box position="absolute" zIndex={3} top={{ base: "19%", lg: "21%" }}
        left={{ base: "-1%", lg: "-4%" }} maxW="170px" bg={theme.bgElev}
        border="1px solid" borderColor={theme.borderStrong} borderRadius="16px"
        px={{ base: "12px", md: "16px" }} py="11px" boxShadow={theme.shadow}
        display="flex" alignItems="center" gap="9px"
        sx={{ animation: "hero-enter-left .8s cubic-bezier(.22,1,.36,1) both",
          "@keyframes hero-enter-left": { from: { opacity: 0, transform: "translateX(-24px)" } },
          "@media (prefers-reduced-motion: reduce)": { animation: "none" } }}>
        <Box color={theme.accentText}><FiArrowUpRight size={18} /></Box>
        <Box color={theme.fg} fontSize="13px" fontWeight={600}>{t("home.everything.move.title")}</Box>
      </Box>
      <Box position="absolute" zIndex={3} top={{ base: "57%", lg: "59%" }}
        right={{ base: "-2%", lg: "-2%" }} maxW="170px" bg={theme.bgElev}
        border="1px solid" borderColor={theme.borderStrong} borderRadius="16px"
        px={{ base: "12px", md: "16px" }} py="11px" boxShadow={theme.shadow}
        display="flex" alignItems="center" gap="9px"
        sx={{ animation: "hero-enter-right .8s .18s cubic-bezier(.22,1,.36,1) both",
          "@keyframes hero-enter-right": { from: { opacity: 0, transform: "translateX(24px)" } },
          "@media (prefers-reduced-motion: reduce)": { animation: "none" } }}>
        <Box color={theme.accentText}><FiRepeat size={18} /></Box>
        <Box color={theme.fg} fontSize="13px" fontWeight={600}>{t("home.everything.exchange.title")}</Box>
      </Box>
      <Box position="absolute" zIndex={3} bottom={{ base: "6%", lg: "7%" }}
        left={{ base: "3%", lg: "2%" }} maxW="170px" bg={theme.bgElev}
        border="1px solid" borderColor={theme.borderStrong} borderRadius="16px"
        px={{ base: "12px", md: "16px" }} py="11px" boxShadow={theme.shadow}
        display="flex" alignItems="center" gap="9px"
        sx={{ animation: "hero-enter-left .8s .32s cubic-bezier(.22,1,.36,1) both",
          "@media (prefers-reduced-motion: reduce)": { animation: "none" } }}>
        <Box color={theme.accentText}><FiTarget size={18} /></Box>
        <Box color={theme.fg} fontSize="13px" fontWeight={600}>{t("home.everything.save.title")}</Box>
      </Box>
      <Box as="style">{`@keyframes hero-trace { to { stroke-dashoffset: -822; } }
        @media (prefers-reduced-motion: reduce) { svg path { animation: none !important; } }`}</Box>
    </Box>
  );
}
