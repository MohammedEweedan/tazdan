"use client";

import { useTranslate } from "@tolgee/react";
import { Section, type Chapter } from "@/components/site";
import HomePhoneJourney from "./HomePhoneJourney";

/** The original manifesto and phone journey, retold with current app captures. */
export default function HomeStory() {
  const { t } = useTranslate();
  const chapters: Chapter[] = [
    {
      id: "story-home", eyebrow: t("home.tour.home.chip"),
      title: t("home.tour.home.title"), body: t("home.tour.home.body"),
      status: "inApp", media: { screen: "home", alt: t("home.hero.alt") },
    },
    {
      id: "story-chat", eyebrow: t("home.tour.chat.chip"),
      title: t("sec_social_title_1") + " " + t("sec_social_title_2"),
      body: t("sec_social_desc"), status: "inApp",
      media: { screen: "messages", alt: t("home.tour.chat.alt") },
    },
    {
      id: "story-buy", eyebrow: t("feat_buy_eyebrow"),
      title: t("feat_buy_title"), body: t("feat_buy_desc"), status: "inApp",
      media: { screen: "buy", alt: t("home.rate.alt") },
    },
    {
      id: "story-market", eyebrow: t("feat_search_eyebrow"),
      title: t("feat_search_title"), body: t("feat_search_desc"), status: "inApp",
      media: { screen: "asset", alt: t("feat_search_title") },
    },
    {
      id: "story-topup", eyebrow: t("feat_pay_eyebrow"),
      title: t("feat_pay_title"), body: t("feat_pay_desc"), status: "pilot",
      media: { screen: "topup", alt: t("feat_pay_title") },
    },
    {
      id: "story-card", eyebrow: t("feat_card_eyebrow"),
      title: t("card_title"), body: t("card_desc"), status: "planned",
      media: { screen: "cards", alt: t("card_title") },
    },
  ];

  return (
    <Section id="story" py={0}>
      <HomePhoneJourney chapters={chapters} />
    </Section>
  );
}
