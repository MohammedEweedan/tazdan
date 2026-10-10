"use client";

/* Footer — link columns, the product-status disclosures (kept verbatim from
   the approved footer_disclaimer_* copy), company line and badges. */

import NextLink from "next/link";
import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiInstagram, FiLinkedin, FiX } from "react-icons/fi";
import { TextLogo } from "@/components/ui/Logo";
import { Container, Footnote, Headline } from "./primitives";
import { useSiteTheme } from "./tokens";

const COLUMNS = [
  {
    title: "common.footer.col.product",
    links: [
      { key: "common.footer.link.personal", href: "/features" },
      { key: "common.footer.link.business", href: "/business" },
      { key: "common.footer.link.fees", href: "/fees" },
      { key: "common.footer.link.security", href: "/security" },
      { key: "common.footer.link.trust", href: "/trust" },
    ],
  },
  {
    title: "common.footer.col.company",
    links: [
      { key: "common.footer.link.about", href: "/about" },
      { key: "common.footer.link.partners", href: "/partners" },
      { key: "common.footer.link.careers", href: "/careers" },
      { key: "common.footer.link.contact", href: "/contact" },
    ],
  },
  {
    title: "common.footer.col.help",
    links: [
      { key: "common.footer.link.faq", href: "/faq" },
      { key: "common.footer.link.terms", href: "/terms" },
      { key: "common.footer.link.privacy", href: "/privacy" },
      { key: "common.footer.link.compliance", href: "/compliance" },
      { key: "common.footer.link.risk", href: "/risk" },
      { key: "common.footer.link.deleteAccount", href: "/delete-account" },
    ],
  },
] as const;

const SOCIALS = [
  { icon: FiX, href: "https://twitter.com/tazdan", label: "X" },
  { icon: FiInstagram, href: "https://instagram.com/tazdan", label: "Instagram" },
  { icon: FiLinkedin, href: "https://www.linkedin.com/company/tazdan", label: "LinkedIn" },
];

export default function SiteFooter() {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const disclosures = [
    tr("footer_disclaimer_loss"),
    tr("footer_disclaimer_protection"),
    tr("footer_disclaimer_advice"),
    tr("footer_disclaimer_transfers"),
    tr("footer_disclaimer_terms"),
  ];

  return (
    <Box as="footer" borderTop="1px solid" borderColor={t.border} bg={t.dark ? "#13151A" : "#EEF1F6"}>
      <Container wide pt="clamp(56px, 7vw, 96px)" pb="40px">
        <Box
          display="grid"
          gridTemplateColumns={{ base: "minmax(0,1fr)", md: "repeat(3, minmax(0,1fr))", lg: "minmax(0,1.4fr) repeat(3, minmax(0,1fr))" }}
          gap={{ base: "40px", lg: "48px" }}
        >
          <Box gridColumn={{ md: "1 / -1", lg: "auto" }} maxW="380px">
            <TextLogo h={26} />
            <Headline mt="22px" text={tr("common.footer.statement")} size="item" as="p" />
            <Footnote mt="10px" fontSize="14.5px" color={t.fgMuted}>{tr("common.footer.about")}</Footnote>
          </Box>
          {COLUMNS.map((col) => (
            <Box key={col.title}>
              <Box fontSize="13px" fontWeight={600} color={t.fg} mb="14px">{tr(col.title)}</Box>
              <Box as="ul" listStyleType="none" display="grid" gap="10px">
                {col.links.map((l) => (
                  <Box as="li" key={l.href}>
                    <Box
                      as={NextLink}
                      href={l.href}
                      fontSize="14.5px"
                      color={t.fgMuted}
                      _hover={{ color: t.fg }}
                      transition="color .15s ease"
                    >
                      {tr(l.key)}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        <Box mt="clamp(48px, 6vw, 72px)" pt="28px" borderTop="1px solid" borderColor={t.border}>
          <Box fontSize="13px" fontWeight={600} color={t.fg} mb="12px">{tr("footer_disclaimer_title")}</Box>
          <Box
            as="ul"
            listStyleType="none"
            display="grid"
            gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "repeat(2, minmax(0,1fr))" }}
            columnGap="40px"
            rowGap="10px"
          >
            {disclosures.map((d, i) => (
              <Box as="li" key={i}>
                <Footnote fontSize="12.5px">{d}</Footnote>
              </Box>
            ))}
          </Box>
          <Box as={NextLink} href="/risk" display="inline-block" mt="12px" fontSize="13px" fontWeight={500} color={t.accentText}>
            {tr("footer_disclaimer_risk_link")}
          </Box>
        </Box>

        <Box
          mt="32px"
          pt="24px"
          borderTop="1px solid"
          borderColor={t.border}
          display="flex"
          flexDirection={{ base: "column", md: "row" }}
          alignItems={{ base: "flex-start", md: "center" }}
          justifyContent="space-between"
          gap="20px"
        >
          <Box fontSize="12.5px" color={t.fgFaint} lineHeight={1.7}>
            <Box>{tr("footer_copy")}</Box>
            <Box dir="ltr">128 City Road, London, United Kingdom, EC1V 2NX</Box>
            <Box as="a" href="mailto:support@tazdan.com" dir="ltr" _hover={{ color: t.fg }}>support@tazdan.com</Box>
          </Box>
          <Box display="flex" alignItems="center" gap="14px" flexWrap="wrap">
            {SOCIALS.map((s) => (
              <Box
                key={s.label}
                as="a"
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                w="36px"
                h="36px"
                borderRadius="999px"
                border="1px solid"
                borderColor={t.border}
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
                color={t.fgMuted}
                _hover={{ color: t.fg, borderColor: t.fg }}
              >
                <s.icon size={15} />
              </Box>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
