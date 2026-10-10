"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Image } from "@chakra-ui/react";
import { useReducedMotion } from "framer-motion";
import { useTranslate } from "@tolgee/react";
import { FONT, useSiteLocale, useSiteTheme } from "@/components/site";

const WORDS = ["money", "tazdan", "crypto", "you"] as const;

export default function RotatingEverythingHeading() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const { isAr } = useSiteLocale();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLHeadingElement>(null);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || reduced) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex(current => (current + 1) % WORDS.length);
    }, 2400);
    return () => window.clearInterval(timer);
  }, [visible, reduced]);
  return (
    <Box ref={ref} as="h2" aria-label={`${t(`pb_phrase_${WORDS[index]}_prefix`)}${WORDS[index] === "tazdan" ? "tazdan" : t(`pb_word_${WORDS[index]}`)}${t(`pb_phrase_${WORDS[index]}_suffix`)}`}
      fontFamily={FONT} fontWeight={600} fontSize={isAr ? "clamp(24px, 7.4vw, 88px)" : "clamp(28px, 8vw, 88px)"}
      letterSpacing={isAr ? 0 : "-.045em"} lineHeight={1.2} display="grid" justifyContent="center">
      {WORDS.map((word, i) => <Box as="span" key={word} aria-hidden gridArea="1 / 1"
        display="inline-flex" alignItems="baseline" justifyContent="center" whiteSpace="nowrap"
        opacity={i === index ? 1 : 0} transform={`translateY(${i === index ? 0 : 14}px)`}
        transition={reduced ? "none" : "opacity .4s ease, transform .4s cubic-bezier(.22,1,.36,1)"}>
        <Box as="span" whiteSpace="pre">{t(`pb_phrase_${word}_prefix`)}</Box>
        {word === "tazdan" ? <Image src="/logo-color.png" alt="" loading="lazy" decoding="async"
          h=".74em" w="2.65em" objectFit="contain" alignSelf="center" /> :
          <Box as="em" fontStyle="normal" color={theme.accentText}>{t(`pb_word_${word}`)}</Box>}
        <Box as="span" whiteSpace="pre">{t(`pb_phrase_${word}_suffix`)}</Box>
      </Box>)}
    </Box>
  );
}
