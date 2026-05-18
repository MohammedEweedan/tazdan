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
import { FiMenu, FiChevronRight } from "react-icons/fi";
import Logo from "@/components/ui/Logo";
import ColorModeToggle from "@/components/ui/ColorModeToggle";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

const NAV_LINKS = [
  { label: "Markets",  href: "/markets" },
  { label: "Fees",     href: "/fees" },
  { label: "FAQ",      href: "/faq" },
  { label: "Contact",  href: "/contact" },
  { label: "About",    href: "/about" },
];

export default function PublicNav() {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const pathname = usePathname();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navBg = dark
    ? scrolled ? "rgba(0,0,0,0.78)" : "rgba(0,0,0,0.45)"
    : scrolled ? "rgba(250,251,254,0.85)" : "rgba(250,251,254,0.65)";
  const navBorder = scrolled
    ? dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.1)"
    : "transparent";
  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const textSub  = dark ? "rgba(255,255,255,0.6)" : "#475569";
  const ctaBg    = dark ? "white" : "#0a0f1e";
  const ctaFg    = dark ? "#0a0f1e" : "white";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <>
      <Box
        as="nav"
        position="fixed"
        top={0} left={0} right={0}
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
          <Box as={NextLink} href="/" flexShrink={0} display="flex" alignItems="center" px={{ base: 0, md: 2 }}>
            <Logo h={36} />
          </Box>

          {/* Desktop links */}
          <HStack display={{ base: "none", lg: "flex" }} spacing={0.5} mx={2}>
            {NAV_LINKS.map((l) => {
              const active = isActive(l.href);
              return (
                <Box
                  key={l.href}
                  as={NextLink}
                  href={l.href}
                  px={4} py={1.5}
                  borderRadius="full"
                  fontSize="13.5px"
                  fontWeight="600"
                  color={active ? textMain : textSub}
                  bg={active ? (dark ? "rgba(255,255,255,0.08)" : "white") : "transparent"}
                  _hover={{ color: textMain, bg: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.6)" }}
                  transition="all 0.15s ease"
                  boxShadow={active && !dark ? "0 1px 2px rgba(0,0,0,0.04)" : "none"}
                >
                  {l.label}
                </Box>
              );
            })}
          </HStack>

          {/* Right cluster */}
          <HStack spacing={2} ms="auto">
            <Box display={{ base: "none", md: "flex" }} gap={2} alignItems="center">
              <LanguageSwitcher />
              <ColorModeToggle />
            </Box>
            {/* Join Waitlist CTA */}
            <Button
              as="a"
              href="/#waitlist"
              size="sm"
              bg={ctaBg}
              color={ctaFg}
              borderRadius="full"
              fontWeight="700"
              fontSize="13px"
              px={{ base: 4, md: 5 }}
              h={{ base: "34px", md: "36px" }}
              boxShadow="0 0 20px rgba(74,143,224,0.25)"
              _hover={{ opacity: 0.88, transform: "translateY(-1px)" }}
              transition="all 0.15s ease"
              flexShrink={0}
            >
              Join Waitlist
            </Button>
            {/* Mobile hamburger */}
            <IconButton
              display={{ base: "flex", lg: "none" }}
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
              <Box px={6} pb={4}>
                <Logo h={28} />
              </Box>
              <Divider borderColor={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />

              <VStack align="stretch" spacing={0} py={2}>
                {NAV_LINKS.map((l) => {
                  const active = isActive(l.href);
                  return (
                    <Flex
                      key={l.href}
                      as={NextLink}
                      href={l.href}
                      onClick={onClose}
                      px={6} py={4}
                      align="center"
                      justify="space-between"
                      bg={active ? (dark ? "rgba(0,87,184,0.12)" : "rgba(0,87,184,0.06)") : "transparent"}
                      _hover={{ bg: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
                      borderLeft="3px solid"
                      borderColor={active ? "#0057b8" : "transparent"}
                      transition="background 0.15s ease"
                    >
                      <Text fontSize="16px" fontWeight="600" color={textMain}>{l.label}</Text>
                      <Icon as={FiChevronRight} color={textSub} />
                    </Flex>
                  );
                })}
              </VStack>

              <Box flex={1} />

              <Divider borderColor={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
              <HStack px={6} py={4} spacing={3}>
                <LanguageSwitcher />
                <ColorModeToggle />
              </HStack>

              <Box px={6} pb={8}>
                <Button
                  as="a"
                  href="/#waitlist"
                  onClick={onClose}
                  w="100%"
                  h="46px"
                  bg={ctaBg}
                  color={ctaFg}
                  borderRadius="12px"
                  fontWeight="700"
                  fontSize="15px"
                  _hover={{ opacity: 0.9 }}
                >
                  Join Waitlist
                </Button>
              </Box>
            </Flex>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
