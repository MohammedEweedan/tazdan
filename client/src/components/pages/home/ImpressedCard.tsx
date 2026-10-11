"use client";

import { useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { useSiteLocale } from "@/components/site";

/** A single light sweep on the original end-card logo, after the phone story. */
export default function ImpressedCard() {
  const { t } = useTranslate();
  const { isAr } = useSiteLocale();
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        io.disconnect();
      }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const mask = {
    WebkitMaskImage: "url(/logo-color.png)", maskImage: "url(/logo-color.png)",
    WebkitMaskSize: "contain", maskSize: "contain",
    WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
    WebkitMaskPosition: "center", maskPosition: "center",
  } as const;
  return (
    <Box as="section" id="impressed" ref={ref} bg="#05070A" color="#F4F5F7"
      minH={{ base: "58vh", md: "72vh" }} display="flex" alignItems="center"
      justifyContent="center" py="80px" px="20px" textAlign="center">
      <Box display="flex" flexDirection="column" alignItems="center" gap="28px">
        <Box position="relative" w="min(440px, 66vw)" sx={{ aspectRatio: "937 / 240" }}
          filter="drop-shadow(0 16px 42px rgba(99,161,219,.18))">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-color.png" alt="tazdan" loading="lazy" decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          <Box aria-hidden position="absolute" inset={0} style={mask}
            sx={{
              backgroundImage: "linear-gradient(100deg, transparent 38%, rgba(255,255,255,.96) 50%, transparent 62%)",
              backgroundSize: "260% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: isAr ? "0% 0%" : "100% 0%",
              animation: visible ? (isAr ? "shine-rtl 2.2s ease-in-out .15s 1 both" : "shine-ltr 2.2s ease-in-out .15s 1 both") : "none",
              "@keyframes shine-ltr": { to: { backgroundPosition: "0% 0%" } },
              "@keyframes shine-rtl": { to: { backgroundPosition: "100% 0%" } },
              "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }}
          />
        </Box>
        <Box as="p" fontSize={{ base: "20px", md: "27px" }} lineHeight={1.3}
          fontWeight={500} color="rgba(245,247,250,.76)" style={{ textAlign: "center" }}>
          {t("journey_end_subtitle")}
        </Box>
      </Box>
    </Box>
  );
}
