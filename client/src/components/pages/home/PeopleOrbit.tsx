"use client";

import { useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { Container, Eyebrow, Headline, Section, useSiteTheme } from "@/components/site";

const PEOPLE = [
  { src: "/screenshots/p1.avif", x: [-119, -310], y: [-133, -190], size: [62, 90], delay: 0 },
  { src: "/screenshots/p2.avif", x: [-18, -92], y: [-174, -280], size: [70, 104], delay: 90 },
  { src: "/screenshots/p3.avif", x: [116, 260], y: [-124, -183], size: [72, 110], delay: 180 },
  { src: "/screenshots/p4.avif", x: [-123, -316], y: [123, 173], size: [60, 88], delay: 270 },
  { src: "/screenshots/p5.avif", x: [20, 112], y: [164, 273], size: [65, 98], delay: 360 },
  { src: "/screenshots/p6.avif", x: [128, 317], y: [115, 177], size: [70, 106], delay: 450 },
];

/** The original people constellation, using cheap transform transitions. */
export default function PeopleOrbit() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Section id="people" ref={ref} rule overflow="hidden">
      <Container>
        <Box position="relative" h={{ base: "540px", md: "720px" }} display="flex" alignItems="center" justifyContent="center">
          <Box aria-hidden position="absolute" inset="14%" bg={theme.glow} pointerEvents="none" />
          {PEOPLE.map((p, i) => (
            <Box key={p.src} position="absolute" top="50%" left="50%" zIndex={i + 1}
              w={{ base: p.size[0] + "px", md: p.size[1] + "px" }}
              h={{ base: p.size[0] + "px", md: p.size[1] + "px" }}
              opacity={visible ? 1 : 0}
              transform={visible ? {
                base: `translate(calc(-50% + ${p.x[0]}px), calc(-50% + ${p.y[0]}px))`,
                md: `translate(calc(-50% + ${p.x[1]}px), calc(-50% + ${p.y[1]}px))`,
              } : "translate(-50%, -50%)"}
              transition="transform 900ms cubic-bezier(.22,1,.36,1), opacity 600ms ease"
              transitionDelay={visible ? p.delay + "ms" : "0ms"}
              sx={{ "@media (prefers-reduced-motion: reduce)": { transition: "none" } }}>
              <Box w="100%" h="100%" borderRadius="full" overflow="hidden"
                border="2px solid" borderColor={theme.dark ? "rgba(255,255,255,.25)" : "rgba(10,15,30,.18)"}
                boxShadow={theme.dark ? "0 20px 55px rgba(0,0,0,.45)" : "0 20px 55px rgba(10,15,30,.14)"}
                sx={{ "@media (prefers-reduced-motion: reduce)": { animation: "none" } }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt="" loading="lazy" decoding="async"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </Box>
            </Box>
          ))}
          <Box position="relative" zIndex={10} maxW={{ base: "250px", md: "530px" }}
            textAlign="center" px="10px" pointerEvents="none">
            <Eyebrow mb="14px" textAlign="center">{t("home.tour.chat.chip")}</Eyebrow>
            <Headline text={t("socialproof_label")} size="page" textAlign="center"
              sx={{ textShadow: theme.dark ? "0 4px 36px #0B0D10" : "0 4px 36px #F6F7FA" }} />
          </Box>
        </Box>
      </Container>
    </Section>
  );
}
