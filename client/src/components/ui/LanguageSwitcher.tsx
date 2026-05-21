"use client";

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Box, Flex, Text, useColorMode } from "@chakra-ui/react";
import { useTolgee } from "@tolgee/react";

const LANGUAGES = [
  { code: "en", native: "English",    flag: "🇬🇧" },
  { code: "ar", native: "العربية",    flag: "🇸🇦" },
  { code: "fr", native: "Français",   flag: "🇫🇷" },
  { code: "es", native: "Español",    flag: "🇪🇸" },
  { code: "de", native: "Deutsch",    flag: "🇩🇪" },
  { code: "nl", native: "Nederlands", flag: "🇳🇱" },
  { code: "ru", native: "Русский",    flag: "🇷🇺" },
  { code: "cn", native: "中文",        flag: "🇨🇳" },
];

export default function LanguageSwitcher() {
  const tolgee      = useTolgee(["language"]);
  const currentLang = tolgee.getLanguage() ?? "en";
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const [open, setOpen]     = useState(false);
  const [mobile, setMobile] = useState(false);
  const [pos, setPos]       = useState<{ top: number; right: number } | null>(null);
  const triggerRef          = useRef<HTMLButtonElement>(null);

  // Monochrome tokens mirroring screenTokens() in app/page.tsx
  const bg          = dark ? "#000000" : "#ffffff";
  const border      = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const borderSoft  = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const fg          = dark ? "#ffffff" : "#000000";
  const fgFaint     = dark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.30)";
  const hoverBg     = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const activeBg    = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const shadow      = dark
    ? "0 30px 80px -20px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06)"
    : "0 30px 80px -20px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)";

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Recalculate position whenever the dropdown opens or the viewport changes
  useLayoutEffect(() => {
    if (!open || mobile || !triggerRef.current) return;
    const recompute = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 10,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    recompute();
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [open, mobile]);

  const handleToggle = useCallback(() => setOpen((v) => !v), []);

  const switchLanguage = (lang: string) => {
    tolgee.changeLanguage(lang);
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    setOpen(false);
  };

  const current = LANGUAGES.find((l) => l.code === currentLang) ?? LANGUAGES[0];

  const LangRow = ({ lang, last }: { lang: typeof LANGUAGES[number]; last: boolean }) => {
    const active = currentLang === lang.code;
    return (
      <Box
        as="button"
        onClick={() => switchLanguage(lang.code)}
        display="flex"
        alignItems="center"
        gap={3}
        w="100%"
        px={4}
        py={3}
        borderBottom={last ? "none" : "1px solid"}
        borderColor={borderSoft}
        bg={active ? activeBg : "transparent"}
        _hover={{ bg: active ? activeBg : hoverBg }}
        transition="background 0.12s ease"
        cursor="pointer"
        textAlign="left"
        position="relative"
        role="option"
        aria-selected={active}
      >
        <Text fontSize="18px" lineHeight={1} flexShrink={0}>
          {lang.flag}
        </Text>
        <Text
          fontSize="14px"
          fontWeight={active ? "700" : "500"}
          color={fg}
          letterSpacing="-0.01em"
          lineHeight="1.2"
          flex={1}
          noOfLines={1}
        >
          {lang.native}
        </Text>
        {active && (
          <Box
            w="6px"
            h="6px"
            borderRadius="full"
            bg={fg}
            flexShrink={0}
          />
        )}
      </Box>
    );
  };

  return (
    <>
      <Box
        ref={triggerRef}
        as="button"
        onClick={handleToggle}
        display="inline-flex"
        alignItems="center"
        gap={2}
        pl={2.5}
        pr={3}
        h="36px"
        borderRadius="full"
        bg={open ? fg : "transparent"}
        color={open ? bg : fg}
        border="1px solid"
        borderColor={open ? fg : border}
        fontSize="12px"
        fontWeight="700"
        letterSpacing="0.04em"
        transition="all 0.2s cubic-bezier(0.22, 1, 0.36, 1)"
        _hover={{ borderColor: fg }}
        aria-label="Change language"
        aria-haspopup="listbox"
        aria-expanded={open}
        flexShrink={0}
      >
        <Text as="span" fontSize="15px" lineHeight={1}>{current.flag}</Text>
        <Text as="span" lineHeight={1}>{current.code.toUpperCase()}</Text>
        <Box
          as="span"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          opacity={0.6}
          transform={open ? "rotate(180deg)" : "rotate(0deg)"}
          transition="transform 0.2s ease"
        >
          <svg width="9" height="6" viewBox="0 0 9 6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L4.5 4.5L8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Box>
      </Box>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: mobile ? "rgba(0,0,0,0.7)" : "transparent",
                backdropFilter: mobile ? "blur(10px)" : "none",
                WebkitBackdropFilter: mobile ? "blur(10px)" : "none",
                zIndex: 1400,
              }}
            />

            {mobile ? (
              <motion.div
                key="sheet"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 320 }}
                style={{
                  position: "fixed",
                  bottom: 0, left: 0, right: 0,
                  zIndex: 1401,
                }}
              >
                <Box
                  bg={bg}
                  borderTopRadius="28px"
                  borderTop="1px solid"
                  borderLeft="1px solid"
                  borderRight="1px solid"
                  borderColor={border}
                  boxShadow={shadow}
                  pb="env(safe-area-inset-bottom, 16px)"
                  overflow="hidden"
                >
                  <Flex justify="center" pt={3} pb={3}>
                    <Box w="36px" h="4px" borderRadius="full" bg={fgFaint} />
                  </Flex>
                  <Box>
                    {LANGUAGES.map((lang, i) => (
                      <LangRow key={lang.code} lang={lang} last={i === LANGUAGES.length - 1} />
                    ))}
                  </Box>
                </Box>
              </motion.div>
            ) : pos ? (
              <motion.div
                key="dropdown"
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -2 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "fixed",
                  top: pos.top,
                  right: pos.right,
                  zIndex: 1401,
                  width: "240px",
                  transformOrigin: "top right",
                }}
                role="listbox"
              >
                <Box
                  bg={bg}
                  border="1px solid"
                  borderColor={border}
                  borderRadius="16px"
                  boxShadow={shadow}
                  overflow="hidden"
                >
                  {LANGUAGES.map((lang, i) => (
                    <LangRow key={lang.code} lang={lang} last={i === LANGUAGES.length - 1} />
                  ))}
                </Box>
              </motion.div>
            ) : null}
          </>
        )}
      </AnimatePresence>
    </>
  );
}
