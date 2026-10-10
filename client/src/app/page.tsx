"use client";

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  Container, PainList, PhoneStage,
  Section, SectionHeader, SiteButton, SiteShell, useSiteTheme,
} from "@/components/site";
import AppTour from "@/components/pages/home/AppTour";
import AfterJourney from "@/components/pages/home/AfterJourney";
import HomeStory from "@/components/pages/home/HomeStory";
import FeatureShowcase from "@/components/pages/home/FeatureShowcase";
import ImpressedCard from "@/components/pages/home/ImpressedCard";
import HomeHero from "@/components/pages/home/HomeHero";

function HomeContent() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const pains = [1, 2, 3, 4].map((i) => ({
    pain: t(`home.pain.${i}.before`), fix: t(`home.pain.${i}.after`),
  }));
  return <>
    <HomeHero />
    <HomeStory />
    <ImpressedCard />
    <Section rule>
      <Container>
        <SectionHeader eyebrow={t("home.pain.eyebrow")} title={t("home.pain.title")} lead={t("home.pain.lead")} />
        <Box mt="clamp(36px, 5vw, 72px)"><PainList items={pains} /></Box>
      </Container>
    </Section>
    <Section rule>
      <Container>
        <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "1fr 1fr" }} alignItems="center" gap="clamp(48px, 8vw, 120px)">
          <Box>
            <SectionHeader layout="stack" eyebrow={t("home.rate.eyebrow")} title={t("home.rate.title")} lead={t("home.rate.lead")}
              actions={<SiteButton variant="link" href="/features#exchange" arrow>{t("home.rate.link")}</SiteButton>} />
          </Box>
          <Box display="flex" justifyContent="center" position="relative">
            <Box aria-hidden position="absolute" inset="-20%" bg={theme.glow} />
            <PhoneStage items={[{ screen: "buy", alt: t("home.rate.alt") }]} index={0} w="min(280px, 72vw)" />
          </Box>
        </Box>
      </Container>
    </Section>
    <AppTour />
    <FeatureShowcase />
    <AfterJourney />
  </>;
}

export default function Home() { return <SiteShell><HomeContent /></SiteShell>; }
