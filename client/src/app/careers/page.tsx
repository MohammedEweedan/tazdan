"use client";

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiAward, FiBriefcase, FiClock, FiDollarSign, FiGlobe, FiMapPin, FiShield, FiTarget, FiTrendingUp, FiUsers, FiZap,
} from "react-icons/fi";
import {
  BentoCard, BentoGrid, Body, Container, CTABand, Headline, MediaHero, Row, RowList,
  Section, SectionHeader, SiteButton, SiteShell, useSiteTheme,
} from "@/components/site";

const CAREERS_EMAIL = "careers@tazdan.com";

/* The real open roles (carried over from the previous careers page). The
   mailto subject stays in English so applications sort the same way in the
   inbox whatever language the visitor reads. */
const ROLES = [
  { id: "fe", subject: "Senior Frontend Engineer", title: "company.careers.role.fe.title", dept: "company.careers.role.fe.dept", loc: "company.careers.role.fe.loc", exp: "company.careers.role.fe.exp", skills: "company.careers.role.fe.skills" },
  { id: "be", subject: "Backend Engineer", title: "company.careers.role.be.title", dept: "company.careers.role.be.dept", loc: "company.careers.role.be.loc", exp: "company.careers.role.be.exp", skills: "company.careers.role.be.skills" },
  { id: "pm", subject: "Product Manager", title: "company.careers.role.pm.title", dept: "company.careers.role.pm.dept", loc: "company.careers.role.pm.loc", exp: "company.careers.role.pm.exp", skills: "company.careers.role.pm.skills" },
  { id: "aml", subject: "Compliance & AML Officer", title: "company.careers.role.aml.title", dept: "company.careers.role.aml.dept", loc: "company.careers.role.aml.loc", exp: "company.careers.role.aml.exp", skills: "company.careers.role.aml.skills" },
  { id: "support", subject: "Customer Support Specialist", title: "company.careers.role.support.title", dept: "company.careers.role.support.dept", loc: "company.careers.role.support.loc", exp: "company.careers.role.support.exp", skills: "company.careers.role.support.skills" },
  { id: "growth", subject: "Growth & Marketing Manager", title: "company.careers.role.growth.title", dept: "company.careers.role.growth.dept", loc: "company.careers.role.growth.loc", exp: "company.careers.role.growth.exp", skills: "company.careers.role.growth.skills" },
];
const mailto = (subject: string) => `mailto:${CAREERS_EMAIL}?subject=${encodeURIComponent(subject)}`;

function CareersContent() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const work = [
    { icon: FiDollarSign, title: t("company.careers.work.salary.title"), body: t("company.careers.work.salary.body") },
    { icon: FiAward, title: t("company.careers.work.equity.title"), body: t("company.careers.work.equity.body") },
    { icon: FiClock, title: t("company.careers.work.pace.title"), body: t("company.careers.work.pace.body") },
    { icon: FiTarget, title: t("company.careers.work.growth.title"), body: t("company.careers.work.growth.body") },
    { icon: FiUsers, title: t("company.careers.work.team.title"), body: t("company.careers.work.team.body") },
    { icon: FiGlobe, title: t("company.careers.work.remote.title"), body: t("company.careers.work.remote.body") },
  ];
  const meta = { display: "inline-flex", alignItems: "center", gap: "6px" } as const;

  return <>
    <MediaHero
      compact
      eyebrow={t("company.careers.hero.eyebrow")}
      title={t("company.careers.hero.title")}
      lead={t("company.careers.hero.lead")}
      actions={<>
        <SiteButton size="lg" href="#roles" arrow>{t("company.careers.hero.primary")}</SiteButton>
        <SiteButton size="lg" variant="secondary" href="#work">{t("company.careers.hero.secondary")}</SiteButton>
      </>}
    />

    <Section rule>
      <Container>
        <SectionHeader eyebrow={t("company.careers.values.eyebrow")} title={t("company.careers.values.title")} />
        <BentoGrid mt="clamp(40px, 6vw, 72px)">
          <BentoCard span={2} icon={FiShield} title={t("company.careers.values.trust.title")} body={t("company.careers.values.trust.body")} />
          <BentoCard span={2} icon={FiZap} title={t("company.careers.values.taste.title")} body={t("company.careers.values.taste.body")} />
          <BentoCard span={2} icon={FiTrendingUp} title={t("company.careers.values.own.title")} body={t("company.careers.values.own.body")} />
        </BentoGrid>
      </Container>
    </Section>

    <Section rule id="work">
      <Container>
        <SectionHeader eyebrow={t("company.careers.work.eyebrow")} title={t("company.careers.work.title")} lead={t("company.careers.work.lead")} />
        <Box mt="clamp(36px, 5vw, 64px)" display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", md: "repeat(2, minmax(0,1fr))" }} columnGap="clamp(24px, 4vw, 64px)">
          {[work.slice(0, 3), work.slice(3)].map((col, i) => (
            <RowList key={i}>{col.map((w) => <Row key={w.title} icon={w.icon} title={w.title} body={w.body} />)}</RowList>
          ))}
        </Box>
      </Container>
    </Section>

    <Section rule id="roles">
      <Container>
        <SectionHeader eyebrow={t("company.careers.roles.eyebrow")} title={t("company.careers.roles.title")} lead={t("company.careers.roles.lead")} />
        <Box as="ul" listStyleType="none" mt="clamp(36px, 5vw, 64px)" borderBottom="1px solid" borderColor={theme.border}>
          {ROLES.map((r) => (
            <Box as="li" key={r.id} display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", md: "minmax(0,1fr) auto" }} gap={{ base: "14px", md: "32px" }}
              alignItems="center" py="26px" borderTop="1px solid" borderColor={theme.border}>
              <Box minW={0}>
                <Headline text={t(r.title)} size="item" />
                <Box mt="10px" display="flex" flexWrap="wrap" columnGap="18px" rowGap="6px" fontSize="14px" color={theme.fgMuted}>
                  <Box as="span" {...meta}><FiBriefcase aria-hidden size={14} />{t(r.dept)}</Box>
                  <Box as="span" {...meta}><FiMapPin aria-hidden size={14} />{t(r.loc)}</Box>
                  <Box as="span" {...meta}><FiClock aria-hidden size={14} />{t(r.exp)}</Box>
                </Box>
                <Box mt="8px" fontSize="14px" color={theme.fgFaint}>{t(r.skills)}</Box>
              </Box>
              <SiteButton as="a" href={mailto(`Application - ${r.subject}`)} variant="secondary" arrow
                aria-label={`${t("company.careers.roles.applyFor")} ${t(r.title)}`} justifySelf={{ base: "start", md: "end" }}>
                {t("company.careers.roles.apply")}
              </SiteButton>
            </Box>
          ))}
        </Box>
      </Container>
    </Section>

    <Section rule>
      <Container>
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1fr)" }} gap="clamp(24px, 5vw, 80px)" alignItems="end">
          <SectionHeader layout="stack" eyebrow={t("company.careers.apply.eyebrow")} title={t("company.careers.apply.title")} />
          <Box>
            <Body>{t("company.careers.apply.body")}</Body>
            <Box mt="24px">
              <SiteButton as="a" href={mailto("General Application")} size="lg" arrow>{t("company.careers.apply.primary")}</SiteButton>
            </Box>
          </Box>
        </Box>
      </Container>
    </Section>

    <CTABand />
  </>;
}

export default function CareersPage() {
  return <SiteShell><CareersContent /></SiteShell>;
}
