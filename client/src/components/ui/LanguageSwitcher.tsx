"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Box, Text, useColorMode,
  Modal, ModalOverlay, ModalContent, ModalBody, SimpleGrid,
} from "@chakra-ui/react";
import { useTolgee } from "@tolgee/react";
import { usePathname, useRouter } from "next/navigation";

const LANGUAGES = [
  { code: "en", native: "English",    flag: "🇬🇧" },
  { code: "ar", native: "العربية",    flag: "🇱🇾" },
  { code: "fr", native: "Français",   flag: "🇫🇷" },
  { code: "es", native: "Español",    flag: "🇪🇸" },
  { code: "de", native: "Deutsch",    flag: "🇩🇪" },
  { code: "nl", native: "Nederlands", flag: "🇳🇱" },
  { code: "ru", native: "Русский",    flag: "🇷🇺" },
  { code: "pt", native: "Português",  flag: "🇵🇹" },
  { code: "tr", native: "Türkçe",     flag: "🇹🇷" },
  { code: "cn", native: "中文",        flag: "🇨🇳" },
];

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const tolgee      = useTolgee(["language"]);
  const currentLang = tolgee.getLanguage() ?? "en";
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const [open, setOpen]     = useState(false);
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
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleToggle = useCallback(() => setOpen((v) => !v), []);

  const switchLanguage = (lang: string) => {
    tolgee.changeLanguage(lang);
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    setOpen(false);
    if (["/", "/en", "/ar"].includes(pathname) && (lang === "en" || lang === "ar")) {
      router.push(`/${lang}`);
    }
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
        minH="48px"
        flexShrink={0}
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

      {/* One CENTERED modal for every screen size, with a blurred backdrop
          (matches the waitlist modal). Mobile used to slide up from the bottom
          and desktop was a corner dropdown that skewed left/right; a single
          centered modal is consistent and direction-agnostic (EN + AR). */}
      <Modal isOpen={open} onClose={() => setOpen(false)} isCentered size="sm" motionPreset="scale">
        <ModalOverlay bg="rgba(0,0,0,0.6)" backdropFilter="blur(8px)" />
        <ModalContent
          bg={bg}
          border="1px solid"
          borderColor={border}
          borderRadius="20px"
          boxShadow={shadow}
          overflow="hidden"
          mx={4}
        >
          <ModalBody p={0}>
            <Text px={5} pt={4} pb={2} fontSize="11px" fontWeight="800" letterSpacing="0.12em" color={fgFaint}>
              {(currentLang === "ar" ? "اللغة" : "LANGUAGE")}
            </Text>
            {/* 2 columns on desktop, 1 on small screens. */}
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={0}>
              {LANGUAGES.map((lang) => (
                <LangRow key={lang.code} lang={lang} last />
              ))}
            </SimpleGrid>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
