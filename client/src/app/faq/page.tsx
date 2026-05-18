"use client";

import NextLink from "next/link";
import {
  Box, Heading, Text, VStack, HStack,
  Icon, Button, useColorMode,
} from "@chakra-ui/react";
import { FiArrowRight, FiMessageCircle } from "react-icons/fi";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import FAQSection from "@/components/ui/FAQSection";
import WaitlistSection from "@/components/ui/WaitlistSection";

export default function FAQPage() {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const textSub  = dark ? "rgba(255,255,255,0.55)" : "#64748b";
  const glow     = dark ? "rgba(0,87,184,0.15)" : "rgba(0,87,184,0.06)";
  const titleGradient = dark
    ? "linear(to-b, #4a8fe0 0%, #ffffff 55%, rgba(255,255,255,0.5) 100%)"
    : "linear(to-b, #0057b8 0%, #0a0f1e 55%, rgba(10,15,30,0.4) 100%)";

  return (
    <Box minH="100vh" color={textMain} overflowX="clip">
      <PublicNav />

      {/* Hero */}
      <Box position="relative" pt={{ base: "110px", md: "160px" }} pb={{ base: 8, md: 14 }}>
        <Box
          position="absolute" top="20%" left="50%" transform="translateX(-50%)"
          w="700px" h="400px" bg={glow} filter="blur(140px)"
          borderRadius="full" pointerEvents="none"
        />
        <VStack spacing={5} textAlign="center" position="relative" zIndex={1} px={5}>
          <Heading
            as="h1"
            fontWeight="900"
            fontSize={{ base: "42px", md: "72px" }}
            lineHeight="1.0"
            letterSpacing="-0.04em"
            bgGradient={titleGradient}
            bgClip="text"
          >
            Frequently asked<br />questions
          </Heading>
          <Text fontSize={{ base: "15px", md: "18px" }} color={textSub} maxW="520px" lineHeight="1.7">
            Everything you need to know about promrkts. Still have questions?
            We&apos;re a message away.
          </Text>
          <HStack spacing={3} pt={2} flexWrap="wrap" justify="center">
            <Button
              as="a"
              href="/#waitlist"
              h="46px" px={6}
              bg={dark ? "white" : "#0a0f1e"}
              color={dark ? "#0a0f1e" : "white"}
              borderRadius="full"
              fontWeight="700"
              fontSize="14px"
              rightIcon={<Icon as={FiArrowRight} />}
              _hover={{ opacity: 0.88, transform: "translateY(-1px)" }}
              transition="all 0.15s"
            >
              Join the waitlist
            </Button>
            <Button
              as={NextLink}
              href="/contact"
              h="46px" px={6}
              variant="outline"
              borderRadius="full"
              fontWeight="700"
              fontSize="14px"
              color={textMain}
              borderColor={dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}
              leftIcon={<Icon as={FiMessageCircle} />}
              _hover={{ bg: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
            >
              Contact us
            </Button>
          </HStack>
        </VStack>
      </Box>

      {/* FAQ accordion — reuses the homepage component */}
      <FAQSection />

      {/* Waitlist nudge at the bottom */}
      <WaitlistSection />

      <PublicFooter />
    </Box>
  );
}
