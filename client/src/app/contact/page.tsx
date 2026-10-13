"use client";

import { useEffect, useState } from "react";
import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiBriefcase, FiClock, FiHelpCircle, FiLifeBuoy, FiLink2, FiMail, FiMapPin, FiMic, FiShield } from "react-icons/fi";
import {
  BentoCard, BentoGrid, Container, CTABand, Headline, Lead, MediaHero, Row, RowList, Section, SectionLabel,
  SiteButton, SiteShell, useSiteTheme,
} from "@/components/site";
import ContactForm, { CONTACT_TOPICS } from "@/components/pages/company/ContactForm";

const SUPPORT_EMAIL = "support@tazdan.com";
// The address already used in the site footer.
const ADDRESS = "128 City Road, London, United Kingdom, EC1V 2NX";

function ContactContent() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const [topic, setTopic] = useState("support");

  // Other pages can deep-link a topic: /contact?topic=partners
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("topic");
    if (q && CONTACT_TOPICS.some((o) => o.value === q)) setTopic(q);
  }, []);

  const writeAbout = (value: string) => {
    setTopic(value);
    document.getElementById("message")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.getElementById("contact-topic")?.focus({ preventScroll: true }), 450);
  };
  const action = (label: string, onClick: () => void) => (
    <SiteButton variant="link" onClick={onClick} arrow>{label}</SiteButton>
  );

  return <>
    <MediaHero
      compact
      eyebrow={t("company.contact.hero.eyebrow")}
      title={t("company.contact.hero.title")}
      lead={t("company.contact.hero.lead")}
      actions={<>
        <SiteButton size="lg" href="#message" arrow>{t("company.contact.hero.primary")}</SiteButton>
        <SiteButton size="lg" variant="secondary" href="/faq">{t("company.contact.hero.secondary")}</SiteButton>
      </>}
    />

    <Section rule id="message">
      <Container>
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,0.85fr) minmax(0,1.15fr)" }} gap="clamp(40px, 6vw, 96px)" alignItems="start">
          <Box>
            <SectionLabel mb="6px">{t("company.contact.channels.label")}</SectionLabel>
            <RowList>
              <Row icon={FiMail} title={t("company.contact.channels.email.title")}
                body={<><Box as="a" href={`mailto:${SUPPORT_EMAIL}`} dir="ltr" color={theme.accentText} fontWeight={500} _hover={{ textDecoration: "underline" }}>{SUPPORT_EMAIL}</Box><br />{t("company.contact.channels.email.body")}</>} />
              <Row icon={FiMapPin} title={t("company.contact.channels.address.title")} body={<Box as="span" dir="ltr" sx={{ unicodeBidi: "isolate" }}>{ADDRESS}</Box>} />
              <Row icon={FiClock} title={t("company.contact.channels.hours.title")} body={t("company.contact.channels.hours.body")} />
            </RowList>

            <SectionLabel mt="44px" mb="6px">{t("company.contact.topics.label")}</SectionLabel>
            <RowList>
              <Row icon={FiLifeBuoy} title={t("company.contact.topics.support.title")} body={<>{t("company.contact.topics.support.body")}<Box as="span" display="block" mt="8px">{action(t("company.contact.topics.support.action"), () => writeAbout("support"))}</Box></>} />
              <Row icon={FiBriefcase} title={t("company.contact.topics.business.title")} body={<>{t("company.contact.topics.business.body")}<Box as="span" display="block" mt="8px"><SiteButton variant="link" href="/business" arrow>{t("company.contact.topics.business.action")}</SiteButton></Box></>} />
              <Row icon={FiLink2} title={t("company.contact.topics.partners.title")} body={<>{t("company.contact.topics.partners.body")}<Box as="span" display="block" mt="8px"><SiteButton variant="link" href="/partners" arrow>{t("company.contact.topics.partners.action")}</SiteButton></Box></>} />
              <Row icon={FiMic} title={t("company.contact.topics.press.title")} body={<>{t("company.contact.topics.press.body")}<Box as="span" display="block" mt="8px">{action(t("company.contact.topics.press.action"), () => writeAbout("press"))}</Box></>} />
            </RowList>
          </Box>

          <Box border="1px solid" borderColor={theme.border} borderRadius="24px" bg={theme.bgElev} p={{ base: "22px", md: "40px" }} minW={0}>
            <Headline text={t("company.contact.form.title")} size="sub" />
            <Lead mt="10px" mb="28px" fontSize={{ base: "16px", md: "17px" }}>{t("company.contact.form.lead")}</Lead>
            <ContactForm topic={topic} onTopic={setTopic} />
          </Box>
        </Box>
      </Container>
    </Section>

    <Section rule tight>
      <Container>
        <BentoGrid>
          <BentoCard span={3} icon={FiShield} title={t("company.contact.safety.title")} body={t("company.contact.safety.body")} />
          <BentoCard span={3} icon={FiHelpCircle} title={t("company.contact.faq.title")} body={t("company.contact.faq.body")}
            link={{ href: "/faq", label: t("company.contact.faq.link") }} />
        </BentoGrid>
      </Container>
    </Section>

    <CTABand />
  </>;
}

export default function ContactPage() {
  return <SiteShell><ContactContent /></SiteShell>;
}
