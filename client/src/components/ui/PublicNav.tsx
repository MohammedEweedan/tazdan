"use client";

import { useState, useEffect } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  Flex,
  HStack,
  VStack,
  Button,
  IconButton,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerBody,
  DrawerCloseButton,
  Divider,
  Icon,
  Text,
  useColorMode,
  useDisclosure,
} from "@chakra-ui/react";
import { FiMenu, FiArrowRight, FiChevronRight, FiLogOut } from "react-icons/fi";
import { useTranslate } from "@tolgee/react";
import Logo from "@/components/ui/Logo";
import ColorModeToggle from "@/components/ui/ColorModeToggle";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import { useAuthStore } from "@/stores/authStore";

/**
 * Shared marketing/public nav (sticky + translucent + blurred).
 * Desktop: centered pill of links.
 * Mobile: hamburger → slide-in drawer with everything laid out vertically.
 */
export default function PublicNav() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const pathname = usePathname();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navBg = dark
    ? scrolled
      ? "rgba(0,0,0,0.78)"
      : "rgba(0,0,0,0.45)"
    : scrolled
      ? "rgba(250,251,254,0.85)"
      : "rgba(250,251,254,0.65)";
  const navBorder = scrolled
    ? dark
      ? "rgba(255,255,255,0.08)"
      : "rgba(0,87,184,0.1)"
    : "transparent";
  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.6)" : "#475569";
  const pillBg = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.035)";
  const pillBorder = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
  const ctaBg = dark ? "white" : "black";
  const ctaFg = dark ? "#0a0f1e" : "white";

  const links = isAuthenticated
    ? [
        { label: t("nav_trade"), href: "/dashboard/trade" },
        { label: t("nav_wallet"), href: "/dashboard/wallet" },
        { label: t("nav_settings"), href: "/dashboard/settings" },
      ]
    : [
        { label: t("nav_markets"), href: "/markets" },
        { label: t("nav_fees"), href: "/fees" },
        { label: t("nav_help"), href: "/help" },
        { label: t("nav_about"), href: "/about" },
      ];

  const isActive = (href: string) => {
    if (href.startsWith("/#")) return false;
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <>
      <Box
        as="nav"
        position="fixed"
        top={0}
        left={0}
        right={0}
        zIndex={200}
        px={{ base: 3, md: 6 }}
        pt={{ base: 2, md: 4 }}
        pb={{ base: 2, md: 0 }}
        transition="all 0.25s ease"
        display="flex"
        alignItems="flex-start"
        justifyContent="center"
        pointerEvents="none"
      >
        <Flex
          w={{ base: "100%", md: "auto" }}
          maxW="1100px"
          mx="auto"
          align="center"
          gap={{ base: 2, md: 3 }}
          bg={navBg}
          border="1px solid"
          borderColor={navBorder}
          borderRadius={{ base: "16px", md: "full" }}
          backdropFilter="blur(22px) saturate(180%)"
          boxShadow={scrolled ? (dark ? "0 8px 30px rgba(0,0,0,0.45)" : "0 8px 30px rgba(0,87,184,0.08)") : "none"}
          transition="all 0.25s ease"
          px={{ base: 3, md: 2 }}
          py={{ base: 2, md: 1.5 }}
          h={{ base: "54px", md: "56px" }}
          pointerEvents="auto"
        >
        {/* Brand */}
        <Box as={NextLink} href="/" flexShrink={0} display="flex" alignItems="center" gap={2} px={{ base: 0, md: 2 }}>
          <Logo h={36} />
        </Box>

        {/* Desktop link pill */}
        <HStack
          display={{ base: "none", lg: "flex" }}
          spacing={0.5}
          mx={2}
        >
          {links.map((l) => {
            const isHash = l.href.startsWith("/#");
            const active = isActive(l.href);
            return (
              <Box
                key={l.href}
                as={isHash ? "a" : NextLink}
                href={l.href}
                px={4}
                py={1.5}
                borderRadius="full"
                fontSize="13.5px"
                fontWeight="600"
                color={active ? textMain : textSub}
                bg={active ? (dark ? "rgba(255,255,255,0.08)" : "white") : "transparent"}
                _hover={{ color: textMain, bg: active ? undefined : (dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.6)") }}
                transition="all 0.15s ease"
                boxShadow={active ? (dark ? "none" : "0 1px 2px rgba(0,0,0,0.04)") : "none"}
              >
                {l.label}
              </Box>
            );
          })}
        </HStack>

        {/* Right cluster (desktop) */}
        <HStack spacing={2} display={{ base: "none", md: "flex" }} ms="auto">
          <LanguageSwitcher />
          <ColorModeToggle />
          {isAuthenticated ? (
            <>
              <Text fontSize="13px" fontWeight="600" color={textMain}>
                Hi, {user?.firstName || user?.email?.split('@')[0]}
              </Text>
              <Button
                size="sm"
                variant="ghost"
                color="#ef4444"
                fontWeight="600"
                fontSize="13px"
                onClick={logout}
                _hover={{ bg: dark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.1)" }}
              >
                Log Out
              </Button>
            </>
          ) : (
            <>
              <Button
                as={NextLink}
                href="/login"
                size="sm"
                variant="ghost"
                color={textMain}
                fontWeight="600"
                fontSize="13px"
                _hover={{ bg: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
              >
                {t("nav_login")}
              </Button>
              <Button
                as={NextLink}
                href="/register"
                size="sm"
                bg={ctaBg}
                color={ctaFg}
                borderRadius="full"
                fontWeight="700"
                fontSize="13px"
                px={5}
                h="36px"
                _hover={{ opacity: 0.88, transform: "translateY(-1px)" }}
                transition="all 0.15s ease"
              >
                {t("nav_register")}
              </Button>
            </>
          )}
        </HStack>

        {/* Mobile right cluster */}
        <HStack spacing={1} display={{ base: "flex", md: "none" }} ms="auto">
          {isAuthenticated ? (
            <Text fontSize="12.5px" fontWeight="600" color={textMain}>
              Hi, {user?.firstName || user?.email?.split('@')[0]}
            </Text>
          ) : (
            <Button
              as={NextLink}
              href="/register"
              size="sm"
              bg={ctaBg}
              color={ctaFg}
              borderRadius="full"
              fontWeight="700"
              fontSize="12.5px"
              px={4}
              h="34px"
            >
              {t("nav_register")}
            </Button>
          )}
          <IconButton
            aria-label="Open menu"
            icon={<Icon as={FiMenu} boxSize={5} />}
            onClick={onOpen}
            variant="ghost"
            color={textMain}
            _hover={{ bg: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
          />
        </HStack>
        </Flex>
      </Box>

      {/* Mobile drawer */}
      <Drawer placement="right" onClose={onClose} isOpen={isOpen} size="xs">
        <DrawerOverlay bg="rgba(0,0,0,0.5)" backdropFilter="blur(6px)" />
        <DrawerContent bg={dark ? "#0a0a0f" : "#ffffff"} color={textMain}>
          <DrawerCloseButton top={4} right={4} color={textMain} />
          <DrawerBody p={0}>
            <Flex direction="column" h="100%" pt={6}>
              {/* header */}
              <Box px={6} pb={4}>
                <Logo h={28} />
              </Box>
              <Divider borderColor={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />

              {/* links */}
              <VStack align="stretch" spacing={0} py={2}>
                {links.map((l) => {
                  const isHash = l.href.startsWith("/#");
                  const active = isActive(l.href);
                  return (
                    <Flex
                      key={l.href}
                      as={isHash ? "a" : NextLink}
                      href={l.href}
                      onClick={onClose}
                      px={6}
                      py={4}
                      align="center"
                      justify="space-between"
                      bg={active ? (dark ? "rgba(0,87,184,0.12)" : "rgba(0,87,184,0.06)") : "transparent"}
                      _hover={{ bg: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
                      borderLeft="3px solid"
                      borderColor={active ? "#0057b8" : "transparent"}
                      transition="background 0.15s ease"
                    >
                      <Text fontSize="16px" fontWeight="600" color={textMain}>
                        {l.label}
                      </Text>
                      <Icon as={FiChevronRight} color={textSub} />
                    </Flex>
                  );
                })}
              </VStack>

              <Divider borderColor={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />

              {/* secondary links */}
              <VStack align="stretch" spacing={0} py={2}>
                {[
                  { label: t("nav_contact"), href: "/contact" },
                  { label: t("nav_careers"), href: "/careers" },
                  { label: t("nav_trust"), href: "/trust" },
                ].map((l) => (
                  <Box
                    key={l.href}
                    as={NextLink}
                    href={l.href}
                    onClick={onClose}
                    px={6}
                    py={3}
                    fontSize="14px"
                    fontWeight="500"
                    color={textSub}
                    _hover={{ color: textMain }}
                  >
                    {l.label}
                  </Box>
                ))}
              </VStack>

              <Box flex={1} />

              {/* toolbar */}
              <Divider borderColor={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
              <HStack px={6} py={4} spacing={3}>
                <LanguageSwitcher />
                <ColorModeToggle />
                <Box flex={1} />
              </HStack>

              {/* auth */}
              <VStack spacing={2} px={6} pb={8}>
                {isAuthenticated ? (
                  <>
                    <Text fontSize="15px" fontWeight="600" color={textMain} textAlign="center" pb={2}>
                      Hi, {user?.firstName || user?.email?.split('@')[0]}
                    </Text>
                    <Button
                      onClick={() => {
                        logout();
                        onClose();
                      }}
                      variant="outline"
                      w="100%"
                      h="46px"
                      borderRadius="12px"
                      fontWeight="700"
                      fontSize="14px"
                      borderColor="#ef4444"
                      color="#ef4444"
                      leftIcon={<Icon as={FiLogOut} />}
                      _hover={{ bg: "rgba(239,68,68,0.1)" }}
                    >
                      Log Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      as={NextLink}
                      href="/login"
                      onClick={onClose}
                      variant="outline"
                      w="100%"
                      h="46px"
                      borderRadius="12px"
                      fontWeight="700"
                      fontSize="14px"
                      borderColor={dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}
                      color={textMain}
                    >
                      {t("nav_login")}
                    </Button>
                    <Button
                      as={NextLink}
                      href="/register"
                      onClick={onClose}
                      w="100%"
                      h="46px"
                      bg={ctaBg}
                      color={ctaFg}
                      borderRadius="12px"
                      fontWeight="700"
                      fontSize="14px"
                      rightIcon={<Icon as={FiArrowRight} />}
                      _hover={{ opacity: 0.9 }}
                    >
                      {t("nav_register")}
                    </Button>
                  </>
                )}
              </VStack>
            </Flex>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
