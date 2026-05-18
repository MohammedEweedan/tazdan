"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Box, Flex, Text, Grid, useColorMode, Icon } from "@chakra-ui/react";
import { useTolgee } from "@tolgee/react";
import { FiGlobe, FiCheck, FiX } from "react-icons/fi";

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

  const [open, setOpen]   = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Detect viewport size
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleOpen = useCallback(() => {
    if (!mobile && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropPos({
        top: rect.bottom + 10,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(true);
  }, [mobile]);

  const switchLanguage = (lang: string) => {
    tolgee.changeLanguage(lang);
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    setOpen(false);
  };

  const current = LANGUAGES.find((l) => l.code === currentLang) ?? LANGUAGES[0];

  // ── Tokens ──────────────────────────────────────────────────────
  const accent      = "#0057b8";
  const textMain    = dark ? "#ffffff"                 : "#0a0f1e";
  const textSub     = dark ? "rgba(255,255,255,0.45)" : "#94a3b8";
  const panelBg     = dark ? "rgba(7,9,18,0.97)"      : "rgba(255,255,255,0.99)";
  const panelBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.11)";
  const rowHover    = dark ? "rgba(255,255,255,0.05)" : "rgba(0,87,184,0.05)";
  const btnBg       = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const btnBorder   = dark ? "rgba(255,255,255,0.09)" : "rgba(0,87,184,0.12)";
  const shadow      = dark
    ? "0 24px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)"
    : "0 24px 60px rgba(0,87,184,0.14), 0 0 0 1px rgba(0,87,184,0.07)";

  // ── Language grid (shared between desktop + mobile) ──────────────
  const LangGrid = () => (
    <Grid templateColumns="1fr 1fr" gap={1.5} p={2}>
      {LANGUAGES.map((lang) => {
        const active = currentLang === lang.code;
        return (
          <Box
            key={lang.code}
            as="button"
            onClick={() => switchLanguage(lang.code)}
            display="flex"
            alignItems="center"
            gap={2.5}
            px={3}
            py={2.5}
            borderRadius="14px"
            bg={active ? accent : "transparent"}
            border="1px solid"
            borderColor={active ? accent : "transparent"}
            transition="all 0.15s ease"
            _hover={{
              bg: active ? accent : rowHover,
              borderColor: active ? accent : (dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.12)"),
            }}
            cursor="pointer"
            textAlign="left"
            position="relative"
          >
            <Text fontSize="18px" lineHeight={1} flexShrink={0}>
              {lang.flag}
            </Text>
            <Text
              fontSize="13px"
              fontWeight={active ? "800" : "600"}
              color={active ? "#fff" : textMain}
              letterSpacing="-0.01em"
              lineHeight="1.2"
              noOfLines={1}
            >
              {lang.native}
            </Text>
            {active && (
              <Box position="absolute" top="6px" right="6px">
                <Icon as={FiCheck} boxSize={2.5} color="rgba(255,255,255,0.8)" />
              </Box>
            )}
          </Box>
        );
      })}
    </Grid>
  );

  // ── Panel header ─────────────────────────────────────────────────
  const PanelHeader = () => (
    <Flex
      align="center" justify="space-between"
      px={4} pt={4} pb={3}
      borderBottom="1px solid" borderColor={panelBorder}
    >
      <Flex align="center" gap={2}>
        <Icon as={FiGlobe} boxSize={4} color={accent} />
        <Text fontSize="14px" fontWeight="800" color={textMain} letterSpacing="-0.02em">
          Choose language
        </Text>
      </Flex>
      <Box
        as="button"
        onClick={() => setOpen(false)}
        w="26px" h="26px"
        borderRadius="8px"
        display="flex" alignItems="center" justifyContent="center"
        color={textSub}
        _hover={{ color: textMain, bg: rowHover }}
        transition="all 0.15s"
        aria-label="Close"
      >
        <Icon as={FiX} boxSize={3.5} />
      </Box>
    </Flex>
  );

  return (
    <>
      {/* ── Trigger ─────────────────────────────────────────────── */}
      <Box
        ref={triggerRef}
        as="button"
        onClick={handleOpen}
        display="inline-flex"
        alignItems="center"
        gap={1.5}
        px={2.5}
        h="34px"
        borderRadius="full"
        bg={btnBg}
        border="1px solid"
        borderColor={open ? accent : btnBorder}
        color={open ? accent : textSub}
        fontSize="12px"
        fontWeight="700"
        letterSpacing="0.03em"
        transition="all 0.18s ease"
        _hover={{ borderColor: accent, color: accent }}
        aria-label="Change language"
        aria-expanded={open}
        flexShrink={0}
      >
        <Text as="span" fontSize="15px" lineHeight={1}>{current.flag}</Text>
        <Text as="span">{current.code.toUpperCase()}</Text>
      </Box>

      <AnimatePresence>
        {open && (
          <>
            {/* ── Backdrop ──────────────────────────────────────── */}
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
                background: mobile ? "rgba(0,0,0,0.6)" : "transparent",
                backdropFilter: mobile ? "blur(8px)" : "none",
                WebkitBackdropFilter: mobile ? "blur(8px)" : "none",
                zIndex: 1400,
              }}
            />

            {mobile ? (
              /* ── Mobile: bottom sheet ─────────────────────────── */
              <motion.div
                key="sheet"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                style={{
                  position: "fixed",
                  bottom: 0, left: 0, right: 0,
                  zIndex: 1401,
                }}
              >
                <Box
                  bg={panelBg}
                  borderTopRadius="28px"
                  borderTop="1px solid" borderLeft="1px solid" borderRight="1px solid"
                  borderColor={panelBorder}
                  boxShadow={shadow}
                  pb="env(safe-area-inset-bottom, 16px)"
                >
                  {/* Drag handle */}
                  <Flex justify="center" pt={3} pb={1}>
                    <Box w="36px" h="4px" borderRadius="full" bg={dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"} />
                  </Flex>
                  <PanelHeader />
                  <LangGrid />
                  <Box h={4} />
                </Box>
              </motion.div>
            ) : (
              /* ── Desktop: dropdown near trigger ───────────────── */
              <motion.div
                key="dropdown"
                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "fixed",
                  top: dropPos.top,
                  right: dropPos.right,
                  zIndex: 1401,
                  width: "300px",
                  transformOrigin: "top right",
                }}
              >
                <Box
                  bg={panelBg}
                  border="1px solid"
                  borderColor={panelBorder}
                  borderRadius="22px"
                  boxShadow={shadow}
                  overflow="hidden"
                >
                  <PanelHeader />
                  <LangGrid />
                  <Flex
                    px={4} py={3}
                    borderTop="1px solid" borderColor={panelBorder}
                    align="center" gap={1.5}
                  >
                    <Icon as={FiGlobe} boxSize={3} color={textSub} />
                    <Text fontSize="11px" color={textSub} letterSpacing="0.02em">
                      More languages coming soon
                    </Text>
                  </Flex>
                </Box>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>
    </>
  );
}
