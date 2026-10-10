"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Security & compliance — the landing section and the pieces the /security
   page shares with it.

   Every framework carries an honest STATUS. tazdan is pre-launch and has no
   SOC 2 report, no ISO 27001 certificate and no licence yet, so the section
   says exactly that instead of implying badges it doesn't hold. When an
   audit or licence lands, flip that entry's `status` and its `sc_fw_*_status`
   / `sc_fw_*_body` copy — the section and the page both read from here.
   ═══════════════════════════════════════════════════════════════════════════ */

import NextLink from "next/link";
import { Box, useColorMode } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { publicPageTheme } from "@/components/ui/publicPageTheme";
import { Reveal, useAppleLocale } from "@/components/ui/appleKit";

/** done = in place today · partner = met through a certified partner or
 *  applied where the law applies · pending = not done yet. */
export type FrameworkStatus = "done" | "partner" | "pending";
export type FrameworkIconKind = "shield" | "card" | "certificate" | "privacy" | "identity" | "institution";

export const SECURITY_FRAMEWORKS: { id: string; key: string; icon: FrameworkIconKind; status: FrameworkStatus }[] = [
  { id: "soc-2",     key: "soc2", icon: "shield",      status: "pending" },
  { id: "pci-dss",   key: "pci",  icon: "card",        status: "partner" },
  { id: "iso-27001", key: "iso",  icon: "certificate", status: "pending" },
  { id: "gdpr",      key: "gdpr", icon: "privacy",     status: "partner" },
  { id: "aml-kyc",   key: "aml",  icon: "identity",    status: "done" },
  { id: "licensing", key: "lic",  icon: "institution", status: "pending" },
];

/** Line icons on a 96 grid, stroked in the current text colour. */
export function FrameworkIcon({ kind, size }: { kind: FrameworkIconKind; size: string | Record<string, string> }) {
  const paths: Record<FrameworkIconKind, React.ReactNode> = {
    shield: (
      <>
        <path d="M48 12 76 22v24c0 17-11 30-28 38C31 76 20 63 20 46V22l28-10Z" />
        <path d="M35 47l9 9 17-19" />
      </>
    ),
    card: (
      <>
        <rect x="14" y="26" width="68" height="44" rx="5" />
        <path d="M14 38h68M50 60h20" />
        <rect x="24" y="47" width="13" height="10" rx="2" />
      </>
    ),
    certificate: (
      <>
        <path d="M26 12h30l14 14v58H26Z" />
        <path d="M56 12v14h14M34 30h14M34 40h28" />
        <circle cx="48" cy="60" r="9" />
        <path d="M43 68l-3 12 8-4 8 4-3-12" />
      </>
    ),
    privacy: (
      <>
        <circle cx="48" cy="48" r="34" strokeDasharray="1 11.5" strokeWidth="3" />
        <rect x="37" y="46" width="22" height="17" rx="3" />
        <path d="M41 46v-5a7 7 0 0 1 14 0v5" />
      </>
    ),
    identity: (
      <>
        <rect x="14" y="24" width="68" height="48" rx="5" />
        <circle cx="34" cy="43" r="7" />
        <path d="M23 62c2-6 6-9 11-9s9 3 11 9M54 40h18M54 50h18M54 60h11" />
      </>
    ),
    institution: (
      <>
        <path d="M14 36 48 18l34 18Z" />
        <path d="M24 42v24M38 42v24M58 42v24M72 42v24M18 72h60M14 80h68" />
      </>
    ),
  };
  return (
    <Box
      as="svg"
      viewBox="0 0 96 96"
      aria-hidden
      w={size}
      h={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      flexShrink={0}
    >
      {paths[kind]}
    </Box>
  );
}

/** Status pill: a dot + short label, green / blue / hollow grey. */
export function StatusBadge({ status, label }: { status: FrameworkStatus; label: string }) {
  const dark = useColorMode().colorMode === "dark";
  const { textSub, accentText, green, cardBorder } = publicPageTheme(dark);
  const color = status === "done" ? green : status === "partner" ? accentText : textSub;
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      gap="7px"
      px="10px"
      py="3px"
      borderRadius="999px"
      border="1px solid"
      borderColor={cardBorder}
      fontSize="12.5px"
      fontWeight="600"
      color={color}
      whiteSpace="nowrap"
    >
      <Box
        as="span"
        w="7px"
        h="7px"
        borderRadius="999px"
        bg={status === "pending" ? "transparent" : color}
        border="1.5px solid"
        borderColor={color}
      />
      {label}
    </Box>
  );
}

/** The ↗ used on "Details" links, mirrored for Arabic. */
export function DetailsArrow() {
  const { isAr } = useAppleLocale();
  return (
    <Box as="svg" viewBox="0 0 10 10" aria-hidden w="10px" h="10px" fill="none" stroke="currentColor" strokeWidth={1.5}
      transform={isAr ? "scaleX(-1)" : undefined}>
      <path d="M2 8 8 2M3 2h5v5" />
    </Box>
  );
}

/** Headline where `*word*` becomes the accent italic, like the rest of the landing. */
export function AccentTitle({ text, dark }: { text: string; dark: boolean }) {
  const { isAr } = useAppleLocale();
  const accent = dark ? "#7DB4E4" : "#3E78AE";
  return (
    <>
      {text.split(/\*([^*]+)\*/).map((part, i) =>
        i % 2 ? (
          <Box as="span" key={i} fontStyle={isAr ? "normal" : "italic"} fontWeight="600" color={accent}>{part}</Box>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function SecurityComplianceSection() {
  const { t } = useTranslate();
  const dark = useColorMode().colorMode === "dark";
  const { isAr } = useAppleLocale();
  const { textMain, textSub, strongBorder, accentText } = publicPageTheme(dark);

  return (
    <Box as="section" py={{ base: 20, md: 32 }} px={{ base: 4, md: 8 }}>
      <Box maxW="1180px" mx="auto">
        {/* Head: headline left, statement + link right. */}
        <Box
          display="grid"
          gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1fr)" }}
          gap={{ base: 6, lg: 16 }}
          alignItems="start"
        >
          <Reveal>
            <Box
              fontSize={{ base: "11px", md: "12px" }} fontWeight="800" letterSpacing={isAr ? 0 : "0.22em"}
              textTransform="uppercase" color={accentText} mb={3}
            >
              {t("sc_eyebrow")}
            </Box>
            <Box
              as="h2"
              fontWeight="700"
              fontSize={{ base: "clamp(30px, 7.6vw, 40px)", md: "clamp(40px, 4.2vw, 58px)" }}
              letterSpacing={isAr ? 0 : "-0.035em"}
              lineHeight={isAr ? 1.2 : 1.04}
              color={textMain}
              maxW="14ch"
              sx={{ textWrap: "balance" }}
            >
              <AccentTitle text={t("sc_title")} dark={dark} />
            </Box>
          </Reveal>
          <Reveal delay={0.05}>
            <Box display="flex" flexDirection="column" alignItems="flex-start" gap={5} maxW="56ch" pt={{ lg: 8 }}>
              <Box as="p" fontSize={{ base: "15.5px", md: "16.5px" }} lineHeight="1.65" color={textSub} style={{ textAlign: "start" }}>
                {t("sc_statement")}
              </Box>
              <Box
                as={NextLink}
                href="/security"
                display="inline-flex" alignItems="center" gap={2}
                px={5} h="42px" borderRadius="999px"
                border="1px solid" borderColor={strongBorder}
                fontSize="14px" fontWeight="700" color={textMain}
                transition="all .2s ease"
                _hover={{ borderColor: "#63a1db", color: "#63a1db" }}
              >
                {t("sc_more")} <Box as="span" aria-hidden>{isAr ? "←" : "→"}</Box>
              </Box>
            </Box>
          </Reveal>
        </Box>

        {/* Frameworks: centred items, big line icon, honest status. */}
        <Box
          as="ul"
          aria-label={t("sc_list_aria")}
          listStyleType="none"
          display="grid"
          gridTemplateColumns={{ base: "repeat(2, minmax(0,1fr))", lg: "repeat(3, minmax(0,1fr))" }}
          columnGap={{ base: 4, md: 12 }}
          rowGap={{ base: 10, md: 16 }}
          mt={{ base: 14, md: 24 }}
        >
          {SECURITY_FRAMEWORKS.map((fw, i) => {
            const name = t(`sc_fw_${fw.key}_name`);
            return (
              <Box as="li" key={fw.id}>
                <Reveal delay={(i % 3) * 0.05} y={16}>
                  <Box display="flex" flexDirection="column" alignItems="center" gap="10px" textAlign="center">
                    <Box color={textMain} mb={{ base: 1, md: 3 }}>
                      <FrameworkIcon kind={fw.icon} size={{ base: "60px", md: "88px" }} />
                    </Box>
                    <Box as="h3" fontSize={{ base: "15.5px", md: "17px" }} fontWeight="700" color={textMain}>{name}</Box>
                    <Box fontSize={{ base: "13.5px", md: "15px" }} lineHeight="1.5" color={textSub} maxW="30ch">
                      {t(`sc_fw_${fw.key}_d`)}
                    </Box>
                    <StatusBadge status={fw.status} label={t(`sc_fw_${fw.key}_status`)} />
                    <Box
                      as={NextLink}
                      href={`/security#${fw.id}`}
                      display="inline-flex" alignItems="center" gap="6px"
                      fontSize="13px" fontWeight="600" color={textSub}
                      _hover={{ color: textMain, textDecoration: "underline", textUnderlineOffset: "4px" }}
                      aria-label={`${t("sc_details")}: ${name}`}
                    >
                      {t("sc_details")} <DetailsArrow />
                    </Box>
                  </Box>
                </Reveal>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
