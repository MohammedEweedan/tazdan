"use client";

import {
  Box, Container, Heading, Text, VStack, useColorMode,
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

export default function LegalPage({ eyebrow, title, updated, intro, sections }: LegalPageProps) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const pageBg    = dark ? "#000000" : "#ffffff";
  const textMain  = dark ? "#ffffff" : "#0a0f1e";
  const textSub   = dark ? "rgba(255,255,255,0.6)" : "#64748b";
  const cardBg    = dark ? "rgba(255,255,255,0.04)" : "#f4f4f4";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";

  const titleGradient = dark
    ? "linear(to-b, #ffffff 0%, rgba(255,255,255,0.85) 60%, rgba(255,255,255,0.3) 100%)"
    : "linear(to-b, #000000 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.2) 100%)";

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      <Box pt={{ base: "120px", md: "150px" }} pb={{ base: 8, md: 14 }}>
        <Container maxW="820px">
          <VStack spacing={5} align="start">
            <Text fontSize="11px" fontWeight="800" letterSpacing="0.14em" color={textSub} textTransform="uppercase">
              {eyebrow}
            </Text>
            <Heading
              as="h1"
              fontWeight="900"
              fontSize={{ base: "44px", md: "64px" }}
              letterSpacing="-0.04em"
              lineHeight="1.02"
              bgGradient={titleGradient}
              bgClip="text"
              whiteSpace="pre-line"
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
        <VStack align="stretch" spacing={4}>
          {sections.map((s) => (
            <Box
              key={s.title}
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderRadius="20px"
              p={{ base: 6, md: 8 }}
            >
              <Heading
                as="h2"
                fontSize={{ base: "18px", md: "22px" }}
                fontWeight="800"
                letterSpacing="-0.02em"
                color={textMain}
                mb={4}
              >
                {s.title}
              </Heading>
              <Text fontSize={{ base: "14.5px", md: "15.5px" }} color={textSub} lineHeight="1.85">
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
