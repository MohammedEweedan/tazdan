"use client";

import NextLink from "next/link";
import {
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Icon,
  Text,
  VStack,
  useColorMode,
} from "@chakra-ui/react";
import { FiArrowLeft, FiHome, FiSearch } from "react-icons/fi";
import { useTranslate } from "@tolgee/react";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import { IconLogo } from "@/components/ui/Logo";

export default function NotFound() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const bg = dark ? "#0a0a0f" : "#fafbfe";
  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.6)" : "#475569";
  const cardBg = dark ? "rgba(255,255,255,0.03)" : "white";
  const cardBorder = dark ? "rgba(255,255,255,0.06)" : "rgba(0,87,184,0.08)";
  const ctaBg = dark ? "white" : "#0a0f1e";
  const ctaFg = dark ? "#0a0f1e" : "white";

  return (
    <Box bg={bg} minH="100vh" color={textMain}>
      <PublicNav />

      <Flex
        as="main"
        minH="100vh"
        align="center"
        justify="center"
        px={{ base: 6, md: 12 }}
        pt="96px"
        pb={16}
      >
        <VStack
          spacing={8}
          maxW="560px"
          w="100%"
          textAlign="center"
          bg={cardBg}
          border="1px solid"
          borderColor={cardBorder}
          borderRadius="24px"
          p={{ base: 8, md: 14 }}
          boxShadow={dark ? "none" : "0 10px 40px rgba(0,87,184,0.06)"}
        >
          <IconLogo size={56} variant="color" />

          <VStack spacing={3}>
            <Text
              fontSize={{ base: "72px", md: "96px" }}
              fontWeight="800"
              lineHeight="1"
              bgGradient="linear(to-br, #0057b8, #00a3ff)"
              bgClip="text"
              letterSpacing="-0.04em"
            >
              404
            </Text>
            <Heading as="h1" size="lg" fontWeight="700" letterSpacing="-0.02em">
              {t("notfound_title", "Page not found")}
            </Heading>
            <Text fontSize="15px" color={textSub} lineHeight="1.7" maxW="420px">
              {t(
                "notfound_body",
                "The page you’re looking for doesn’t exist or has been moved. Let’s get you back on track.",
              )}
            </Text>
          </VStack>

          <HStack spacing={3} flexWrap="wrap" justify="center">
            <Button
              as={NextLink}
              href="/"
              size="md"
              bg={ctaBg}
              color={ctaFg}
              borderRadius="full"
              fontWeight="700"
              fontSize="14px"
              px={6}
              h="44px"
              leftIcon={<Icon as={FiHome} />}
              _hover={{ opacity: 0.88, transform: "translateY(-1px)" }}
              transition="all 0.15s ease"
            >
              {t("notfound_home", "Go home")}
            </Button>
            <Button
              as={NextLink}
              href="/markets"
              size="md"
              variant="outline"
              borderColor={cardBorder}
              color={textMain}
              borderRadius="full"
              fontWeight="600"
              fontSize="14px"
              px={6}
              h="44px"
              leftIcon={<Icon as={FiSearch} />}
              _hover={{ bg: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
            >
              {t("notfound_markets", "Browse markets")}
            </Button>
          </HStack>

          <HStack
            as={NextLink}
            href="/help"
            spacing={2}
            color={textSub}
            fontSize="13px"
            fontWeight="500"
            _hover={{ color: textMain }}
            transition="color 0.15s ease"
          >
            <Icon as={FiArrowLeft} />
            <Text>{t("notfound_help", "Need help? Visit our help center")}</Text>
          </HStack>
        </VStack>
      </Flex>

      <PublicFooter />
    </Box>
  );
}
