"use client";

import { useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiArrowDownLeft, FiArrowUpRight, FiCreditCard, FiGlobe, FiLink,
  FiLock, FiMessageCircle, FiRepeat, FiSend, FiTarget,
} from "react-icons/fi";
import type { IconType } from "react-icons";
import { Container, Eyebrow, Lead, Section, useSiteLocale, useSiteTheme } from "@/components/site";
import RotatingEverythingHeading from "./RotatingEverythingHeading";

const FEATURES: { key: string; icon: IconType }[] = [
  { key: "pb_f_buy", icon: FiArrowDownLeft },
  { key: "pb_f_sell", icon: FiArrowUpRight },
  { key: "pb_f_send", icon: FiSend },
  { key: "pb_f_claimlink", icon: FiLink },
  { key: "pb_f_recurring", icon: FiTarget },
  { key: "pb_f_p2p", icon: FiGlobe },
  { key: "pb_f_cards", icon: FiCreditCard },
  { key: "pb_f_multichain", icon: FiRepeat },
  { key: "pb_f_selfcustody", icon: FiLock },
  { key: "pb_f_applepay", icon: FiCreditCard },
  { key: "pb_f_chat", icon: FiMessageCircle },
  { key: "pb_f_global", icon: FiGlobe },
];

/** Two identical groups give the marquee a seamless loop in either direction. */
export default function FeatureMarquee() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const { isAr } = useSiteLocale();
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Section id="closer" ref={ref} rule overflow="hidden" px={0}>
      <Container textAlign="center">
        <Eyebrow mb="16px" textAlign="center">{t("pb_eyebrow")}</Eyebrow>
        <RotatingEverythingHeading />
        <Lead align="center" mt="24px" maxW="55ch" mx="auto">{t("pb_sub")}</Lead>
      </Container>
      <Box mt="clamp(66px, 8vw, 112px)" overflow="hidden" w="100%" dir="ltr"
        sx={{
          maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
        }}>
        <Box data-feature-marquee display="flex" w="max-content" dir="ltr" aria-hidden
          sx={{
            animation: "feature-marquee 46s linear infinite",
            animationDirection: isAr ? "reverse" : "normal",
            animationPlayState: visible ? "running" : "paused",
            "@keyframes feature-marquee": { to: { transform: "translateX(-50%)" } },
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            "&:hover": { animationPlayState: "paused" },
          }}>
          {[0, 1].map((copy) => (
            <Box key={copy} display="flex" gap="12px" pr="12px" flexShrink={0} dir={isAr ? "rtl" : "ltr"}>
              {FEATURES.map(({ key, icon: Icon }) => (
                <Box key={key} display="inline-flex" alignItems="center" gap="14px"
                  bg={theme.accent} color="#ffffff" h={{ base: "64px", md: "78px" }}
                  px={{ base: "18px", md: "24px" }} borderRadius="999px" whiteSpace="nowrap">
                  <Box as="span" w={{ base: "38px", md: "46px" }} h={{ base: "38px", md: "46px" }}
                    borderRadius="full" bg="#F6F9FC" display="inline-flex" alignItems="center" justifyContent="center">
                    <Icon size={20} color="#071018" />
                  </Box>
                  <Box as="span" fontSize={{ base: "22px", md: "32px" }} fontWeight={700} letterSpacing="-0.035em">
                    {t(key)}
                  </Box>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Section>
  );
}
