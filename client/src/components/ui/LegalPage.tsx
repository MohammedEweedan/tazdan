"use client";

import {
  Box, Text, VStack, useColorMode,
} from "@chakra-ui/react";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import { publicPageTheme } from "@/components/ui/publicPageTheme";
import { Band, BentoCard, PageHero, Reveal } from "@/components/ui/appleKit";

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

  const {
    pageBg, textMain, textSub,
  } = publicPageTheme(dark);

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      <PageHero
        eyebrow={eyebrow}
        title={title}
        subtitle={intro}
        size="md"
        maxW="860px"
      >
        <Text fontSize="13px" color={textSub} fontWeight="600">{updated}</Text>
      </PageHero>

      <Band maxW="860px">
        <VStack align="stretch" spacing={4}>
          {sections.map((s, index) => (
            <BentoCard key={s.title} title={s.title} delay={index * 0.025}>
              <Text fontSize={{ base: "14.5px", md: "15.5px" }} color={textSub} lineHeight="1.85">
                {s.body}
              </Text>
            </BentoCard>
          ))}
          <Reveal>
            <Box pt={4}>
              <Text fontSize="12px" color={textSub} textAlign="center">
                {updated}
              </Text>
            </Box>
          </Reveal>
        </VStack>
      </Band>

      <PublicFooter />
    </Box>
  );
}
