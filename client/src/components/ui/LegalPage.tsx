"use client";

import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  useColorMode,
} from "@chakra-ui/react";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";

export interface LegalSection {
  title: string;
  body: string;
}

interface LegalPageProps {
  eyebrow: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

/**
 * Shared layout for text-heavy legal pages (Terms, Privacy, Compliance).
 */
export default function LegalPage({ eyebrow, title, updated, intro, sections }: LegalPageProps) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.6)" : "#475569";
  const titleGradient = dark
    ? "linear(to-b, #4a8fe0 0%, #ffffff 55%, rgba(255,255,255,0.5) 100%)"
    : "linear(to-b, #0057b8 0%, #0a0f1e 55%, rgba(10,15,30,0.4) 100%)";
  const glow = dark ? "rgba(0,87,184,0.15)" : "rgba(0,87,184,0.06)";

  return (
    <Box minH="100vh" color={textMain} overflowX="clip">
      <PublicNav />

      <Box position="relative" pt={{ base: "110px", md: "150px" }} pb={{ base: 8, md: 14 }}>
        <Box position="absolute" top="10%" left="50%" transform="translateX(-50%)" w="700px" h="400px" bg={glow} filter="blur(140px)" borderRadius="full" pointerEvents="none" />
        <Container maxW="820px" position="relative" zIndex={1}>
          <VStack spacing={5} align="start">
            <Heading
              as="h1"
              fontFamily="'DM Sans', sans-serif"
              fontWeight="800"
              fontSize={{ base: "40px", md: "60px" }}
              letterSpacing="-0.03em"
              lineHeight="1.02"
              bgGradient={titleGradient}
              bgClip="text"
            >
              {title}
            </Heading>
            <Text fontSize="13px" color={textSub} fontWeight="600">
              {updated}
            </Text>
            <Text fontSize={{ base: "15px", md: "17px" }} color={textSub} lineHeight="1.75" pt={4}>
              {intro}
            </Text>
          </VStack>
        </Container>
      </Box>

      <Container maxW="820px" py={{ base: 8, md: 14 }}>
        <VStack align="stretch" spacing={{ base: 8, md: 10 }}>
          {sections.map((s) => (
            <Box key={s.title}>
              <Heading
                as="h2"
                fontSize={{ base: "22px", md: "26px" }}
                fontWeight="700"
                letterSpacing="-0.02em"
                fontFamily="'DM Sans', sans-serif"
                color={textMain}
                mb={4}
              >
                {s.title}
              </Heading>
              <Text fontSize={{ base: "15px", md: "16px" }} color={textSub} lineHeight="1.85">
                {s.body}
              </Text>
            </Box>
          ))}
        </VStack>
      </Container>

      <PublicFooter />
    </Box>
  );
}
