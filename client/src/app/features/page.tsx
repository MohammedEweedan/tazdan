"use client";

import { useTranslate } from "@tolgee/react";
import {
  Box, SimpleGrid, useColorMode,
} from "@chakra-ui/react";
import {
  FiCreditCard, FiGlobe, FiLock, FiMessageSquare, FiRepeat,
  FiSearch, FiSend, FiShield, FiZap,
} from "react-icons/fi";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import { publicPageTheme } from "@/components/ui/publicPageTheme";
import {
  Band,
  BentoCard,
  CTASection,
  Em,
  FeatureShowcase,
  GraphicKind,
  PageHero,
  SectionHeading,
  StatStrip,
} from "@/components/ui/appleKit";

const stripStars = (value: string) => value.replace(/\*/g, "");

export default function FeaturesPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const { pageBg } = publicPageTheme(dark);

  const featureRows: Array<{
    eyebrow: string;
    title: string;
    desc: string;
    kind: GraphicKind;
    points: { icon: any; label: string }[];
  }> = [
    {
      eyebrow: t("feat_buy_eyebrow"),
      title: t("feat_buy_title"),
      desc: t("feat_buy_desc"),
      kind: "transfer",
      points: [
        { icon: FiZap, label: t("feat_buy_f1") },
        { icon: FiShield, label: t("feat_buy_f2") },
        { icon: FiCreditCard, label: t("feat_buy_f3") },
        { icon: FiGlobe, label: t("feat_buy_f4") },
      ],
    },
    {
      eyebrow: t("feat_search_eyebrow"),
      title: t("feat_search_title"),
      desc: t("feat_search_desc"),
      kind: "chart",
      points: [
        { icon: FiSearch, label: t("feat_search_f1") },
        { icon: FiZap, label: t("feat_search_f2") },
        { icon: FiRepeat, label: t("feat_search_f3") },
        { icon: FiSend, label: t("feat_search_f4") },
      ],
    },
    {
      eyebrow: t("feat_pay_eyebrow"),
      title: t("feat_pay_title"),
      desc: t("feat_pay_desc"),
      kind: "card",
      points: [
        { icon: FiCreditCard, label: t("feat_pay_f1") },
        { icon: FiShield, label: t("feat_pay_f2") },
        { icon: FiGlobe, label: t("feat_pay_f3") },
        { icon: FiZap, label: t("feat_pay_f4") },
      ],
    },
    {
      eyebrow: t("cl_badge"),
      title: stripStars(t("cl_title")),
      desc: t("cl_sub"),
      kind: "transfer",
      points: [
        { icon: FiSend, label: t("cl_s1_title") },
        { icon: FiMessageSquare, label: t("cl_s2_title") },
        { icon: FiZap, label: t("cl_s3_title") },
        { icon: FiLock, label: t("pb_f_selfcustody") },
      ],
    },
    {
      eyebrow: t("rb_badge"),
      title: stripStars(t("rb_title")),
      desc: t("rb_sub"),
      kind: "spark",
      points: [
        { icon: FiRepeat, label: t("rb_cad_daily") },
        { icon: FiRepeat, label: t("rb_cad_weekly") },
        { icon: FiRepeat, label: t("rb_cad_biweekly") },
        { icon: FiRepeat, label: t("rb_cad_monthly") },
      ],
    },
  ];

  const capabilityCards = [
    { icon: FiRepeat, title: t("pb_f_p2p"), desc: t("feature_rates_desc") },
    { icon: FiGlobe, title: t("pb_f_multichain"), desc: t("feature_local_desc") },
    { icon: FiCreditCard, title: t("pb_f_cards"), desc: t("cards_desc") },
    { icon: FiMessageSquare, title: t("pb_f_chat"), desc: t("feat_wallet_desc") },
    { icon: FiShield, title: t("feature_secure_title"), desc: t("feature_secure_desc") },
    { icon: FiZap, title: t("feature_instant_title"), desc: t("feature_instant_desc") },
  ];

  return (
    <Box minH="100vh" bg={pageBg} overflowX="clip">
      <PublicNav />

      <PageHero
        title={
          <>
            {t("pb_phrase_tazdan_prefix")}
            <Em>tazdan</Em>
            {t("pb_phrase_tazdan_suffix")}
          </>
        }
        subtitle={t("pb_sub")}
        primary={{ label: t("minimal_cta_primary"), href: "/register" }}
        secondary={{ label: t("nav_features"), href: "#features-list" }}
      />

      <Band tone="alt" maxW="1120px">
        <StatStrip
          stats={[
            { value: "<2s", label: t("biz_stat3_label") },
            { value: "0%", label: t("page_fees_stat_p2p") },
            { value: "400+", label: t("feat_search_f3") },
            { value: "120+", label: t("pb_f_global") },
          ]}
        />
      </Band>

      <Band id="features-list" maxW="1120px">
        {featureRows.map((group, index) => (
          <FeatureShowcase
            key={group.eyebrow}
            title={group.title}
            desc={group.desc}
            kind={group.kind}
            points={group.points}
            flip={index % 2 === 1}
          />
        ))}
      </Band>

      <Band tone="alt" maxW="1120px">
        <SectionHeading
          title={
            <>
              {t("tz_bento_title_a")} <Em>{t("tz_bento_title_b")}</Em>
            </>
          }
          lede={t("tz_hero_sub")}
        />
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={5}>
          {capabilityCards.map((card, index) => (
            <BentoCard
              key={card.title}
              icon={card.icon}
              title={card.title}
              desc={card.desc}
              delay={index * 0.04}
            />
          ))}
        </SimpleGrid>
      </Band>

      <CTASection
        title={t("minimal_cta_title")}
        subtitle={t("minimal_cta_desc")}
        primary={{ label: t("minimal_cta_primary"), href: "/register" }}
      />

      <PublicFooter />
    </Box>
  );
}
