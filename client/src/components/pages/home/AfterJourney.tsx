"use client";

/* The original landing-page sequence after “Impressed? There’s more”.
   Each section keeps its purpose and order, with current app screens and
   honest availability labels. */
import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiBriefcase, FiCreditCard, FiGlobe, FiLock, FiRepeat, FiSend, FiUsers } from "react-icons/fi";
import {
  Body, Container, CTABand, Eyebrow, FeatureGrid, Footnote, Headline, Lead,
  PhoneStage, Row, RowList, Section, SectionHeader, SiteButton, Stat,
  StatusChip, Steps, StoryScroll, useSiteTheme, type Chapter,
} from "@/components/site";
import PeopleOrbit from "./PeopleOrbit";
import TrustSection from "./TrustSection";
import FeatureMarquee from "./FeatureMarquee";

export default function AfterJourney() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const exchange: Chapter[] = [
    { id: "buy", eyebrow: t("onramp_buy_title"), title: t("onramp_buy_title"), body: t("onramp_buy_desc"), status: "inApp", media: { screen: "buy", alt: t("home.rate.alt") } },
    { id: "sell", eyebrow: t("onramp_sell_title"), title: t("onramp_sell_title"), body: t("onramp_sell_desc"), status: "inApp", media: { screen: "sell", alt: t("onramp_sell_title") } },
    { id: "abroad", eyebrow: t("onramp_send_title"), title: t("onramp_send_title"), body: t("onramp_send_desc"), status: "pilot", media: { screen: "remit", alt: t("onramp_send_title") } },
  ];
  return <>
    {/* 01 — currency on and off ramps */}
    <Section id="exchange" rule><Container>
      <SectionHeader eyebrow={t("home.rate.eyebrow")} title={t("onramp_headline")} lead={t("home.rate.lead")} />
      <Box mt="clamp(48px, 7vw, 100px)"><StoryScroll chapters={exchange} /></Box>
      <Footnote mt="36px">{t("common.media.illustrative")}</Footnote>
    </Container></Section>

    {/* 03 — card programme */}
    <Section id="cards" rule><Container>
      <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap="clamp(44px, 7vw, 110px)" alignItems="center">
        <Box>
          <Box display="flex" alignItems="center" gap="12px" mb="16px"><Eyebrow>{t("pb_f_cards")}</Eyebrow><StatusChip status="planned" /></Box>
          <Headline text={t("card_title")} maxW="18ch" />
          <Lead mt="18px" maxW="46ch">{t("card_desc")}</Lead>
          <Box mt="26px"><RowList>{["card_f1", "card_f2", "card_f3", "card_f4"].map((k) => <Row key={k} title={t(k)} />)}</RowList></Box>
          <Box mt="24px"><SiteButton variant="link" href="/features#cards" arrow>{t("home.everything.link")}</SiteButton></Box>
        </Box>
        <Box display="flex" justifyContent="center"><PhoneStage items={[{ screen: "cards", alt: t("card_title") }]} index={0} w="min(290px, 76vw)" /></Box>
      </Box>
    </Container></Section>

    {/* 04 — ClaimLinks */}
    <Section id="claim-links" rule><Container>
      <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap="clamp(44px, 7vw, 110px)" alignItems="center">
        <Box display="flex" justifyContent="center" order={{ base: 2, lg: 1 }}><PhoneStage items={[{ screen: "claim", alt: t("cl_title") }]} index={0} w="min(290px, 76vw)" /></Box>
        <Box order={{ base: 1, lg: 2 }}>
          <Eyebrow mb="14px">{t("cl_badge")}</Eyebrow><Headline text={t("cl_title")} maxW="17ch" />
          <Lead mt="18px" maxW="46ch">{t("cl_sub")}</Lead>
        </Box>
      </Box>
      <Box mt="clamp(58px, 7vw, 100px)"><Steps items={[1, 2, 3].map((i) => ({ title: t(`cl_s${i}_title`), body: t(`cl_s${i}_desc`) }))} /></Box>
    </Container></Section>

    {/* 05 — recurring saving and goals */}
    <Section id="save" rule><Container>
      <SectionHeader eyebrow={t("rb_badge")} title={t("rb_title")} lead={t("rb_sub")} />
      <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="clamp(32px, 5vw, 80px)" mt="clamp(44px, 6vw, 88px)">
        <Box borderTop="1px solid" borderColor={theme.border} pt="22px">
          <Eyebrow mb="8px">{t("rb_badge")}</Eyebrow>
          <Body>{t("home.everything.save.body")}</Body>
          <Box mt="28px" display="flex" justifyContent="center"><PhoneStage items={[{ screen: "recurring", alt: t("rb_badge") }]} index={0} w="min(250px, 68vw)" /></Box>
        </Box>
        <Box borderTop="1px solid" borderColor={theme.border} pt="22px">
          <Eyebrow mb="8px">{t("home.everything.save.title")}</Eyebrow>
          <Body>{t("home.tour.save.body")}</Body>
          <Box mt="28px" display="flex" justifyContent="center"><PhoneStage items={[{ screen: "budgets", alt: t("home.tour.save.alt") }]} index={0} w="min(250px, 68vw)" /></Box>
        </Box>
      </Box>
    </Container></Section>

    {/* 06 — the original people constellation */}
    <PeopleOrbit />

    {/* 07 — business */}
    <Section id="business" rule><Container>
      <SectionHeader eyebrow={t("lb_biz_eyebrow")} title={t("lb_biz_title")} lead={t("home.business.lead")}
        actions={<SiteButton variant="link" href="/business" arrow>{t("home.business.link")}</SiteButton>} />
      <Box mt="clamp(36px, 5vw, 72px)"><FeatureGrid items={[
        { icon: FiUsers, title: t("business.story.team.eyebrow"), body: t("business.story.team.body"), status: "inApp" },
        { icon: FiSend, title: t("business.story.bulk.eyebrow"), body: t("business.story.bulk.body"), status: "inApp" },
        { icon: FiLock, title: t("business.story.approval.eyebrow"), body: t("business.story.approval.body"), status: "inApp" },
        { icon: FiBriefcase, title: t("business.story.payouts.eyebrow"), body: t("business.story.payouts.body"), status: "inApp" },
        { icon: FiRepeat, title: t("business.story.keys.eyebrow"), body: t("business.story.keys.body"), status: "inApp" },
      ]} /></Box>
      <Box mt="54px" display="flex" justifyContent="center"><PhoneStage items={[{ screen: "business-home", alt: t("home.business.alt") }]} index={0} w="min(270px, 72vw)" /></Box>
    </Container></Section>

    {/* 08 — partnership opportunities */}
    <Section id="partners" rule><Container>
      <SectionHeader eyebrow={t("lb_partner_eyebrow")} title={t("lb_partner_title")} lead={t("lb_partner_sub")}
        actions={<SiteButton variant="link" href="/partners" arrow>{t("lb_partner_cta")}</SiteButton>} />
      <Box mt="clamp(36px, 5vw, 72px)"><FeatureGrid columns={4} items={[1, 2, 3, 4].map((i) => ({ icon: [FiBriefcase, FiCreditCard, FiGlobe, FiSend][i - 1], title: t(`lb_partner_${i}_t`), body: t(`lb_partner_${i}_d`), status: "pipeline" }))} /></Box>
      <Footnote mt="28px">{t("partners.footnote.trademarks")}</Footnote>
    </Container></Section>

    {/* 09 — infrastructure */}
    <Section id="infrastructure" rule><Container>
      <SectionHeader eyebrow={t("lb_infra_eyebrow")} title={t("lb_infra_title")} lead={t("lb_infra_sub")} />
      <Box display="grid" gridTemplateColumns={{ base: "repeat(2,minmax(0,1fr))", lg: "repeat(4,minmax(0,1fr))" }} gap="24px" mt="clamp(36px, 5vw, 72px)">
        <Stat value="97" label={t("lb_infra_1_l")} />
        <Stat value="417" label={t("lb_infra_2_l")} />
        <Stat value="89" label={t("lb_infra_3_l")} />
        <Stat value={t("lb_infra_4_n")} label={t("lb_infra_4_l")} />
      </Box>
      <Footnote mt="26px">{t("lb_infra_note")}</Footnote>
    </Container></Section>

    {/* 10 — protections, framework status, then the original marquee closer */}
    <TrustSection />
    <FeatureMarquee />
    <CTABand />
  </>;
}
