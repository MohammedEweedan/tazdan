"use client";

/* Home-screen widgets: the same three widgets on iPhone and Android, shown on
   a home screen in the visitor's language and colour mode. The images are
   renders of the app's widget code with the site's illustrative persona —
   the footnote says so. */
import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiActivity, FiMessageCircle, FiSend } from "react-icons/fi";
import {
  Container, Eyebrow, Footnote, PhoneStage, Row, RowList,
  Section, SectionHeader, StatusChip, useSiteTheme,
} from "@/components/site";

export default function WidgetsShowcase() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const phones = [
    { device: "iphone" as const, screen: "widgets-ios", label: t("home.widgets.ios"), alt: t("home.widgets.iosAlt") },
    { device: "android" as const, screen: "widgets-android", label: t("home.widgets.android"), alt: t("home.widgets.androidAlt") },
  ];
  return (
    <Section id="widgets" rule>
      <Container>
        <SectionHeader
          eyebrow={t("home.widgets.eyebrow")}
          title={t("home.widgets.title")}
          lead={t("home.widgets.lead")}
          actions={<StatusChip status="inProgress" />}
        />
        <Box
          display="grid"
          gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 1fr) minmax(0, 1.1fr)" }}
          gap="clamp(44px, 7vw, 110px)"
          alignItems="center"
          mt="clamp(44px, 6vw, 88px)"
        >
          <Box display="flex" justifyContent="center" gap="clamp(16px, 3vw, 36px)" position="relative">
            <Box aria-hidden position="absolute" inset="-15%" bg={theme.glow} />
            {phones.map((p, i) => (
              <Box key={p.screen} display="flex" flexDirection="column" alignItems="center" gap="14px" mt={i === 1 ? "clamp(28px, 5vw, 64px)" : 0}>
                <PhoneStage device={p.device} items={[{ screen: p.screen, alt: p.alt }]} index={0} w="min(250px, 42vw)" />
                <Eyebrow>{p.label}</Eyebrow>
              </Box>
            ))}
          </Box>
          <Box>
            <RowList>
              <Row icon={FiSend} title={t("home.widgets.payments.title")} body={t("home.widgets.payments.body")} />
              <Row icon={FiMessageCircle} title={t("home.widgets.chats.title")} body={t("home.widgets.chats.body")} />
              <Row icon={FiActivity} title={t("home.widgets.prices.title")} body={t("home.widgets.prices.body")} />
            </RowList>
            <Footnote mt="24px">{t("home.widgets.note")}</Footnote>
          </Box>
        </Box>
      </Container>
    </Section>
  );
}
