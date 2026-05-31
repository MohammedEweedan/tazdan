"use client";

/**
 * 404 page — redesigned to match the public landing language and to
 * give the visitor real signal instead of a dead-end. Three things
 * matter here:
 *
 *   1. The brand reads through immediately (mono surface, large
 *      typography, no Chakra defaults bleeding through).
 *   2. A live operational-status indicator. A blank "Not Found" is
 *      scary on a finance product — people start wondering if their
 *      balance is gone. A clear "All systems operational" badge says
 *      it's just a missing URL, not a meltdown.
 *   3. Two equally weighted exits: back to the product, or contact
 *      support. Most 404s I've seen offer only "go home"; finance
 *      users want a human escape hatch.
 *
 * Tolgee i18n. Strings live under the `notfound_*` namespace; the
 * second arg to `t()` is the English source-of-truth that ships even
 * before a translator picks up the key in the Tolgee editor.
 */

import { useEffect, useState } from "react";
import NextLink from "next/link";
import Image from "next/image";
import {
  Box,
  Flex,
  HStack,
  Heading,
  Text,
  VStack,
  useColorMode,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import { useIsAr } from "@/hooks/useIsAr";

type StatusKind = "live" | "degraded" | "down" | "unknown";

const STATUS_ENDPOINT =
  process.env.NEXT_PUBLIC_STATUS_URL ??
  `${process.env.NEXT_PUBLIC_API_URL ?? ""}/healthz`;
const SUPPORT_EMAIL = "support@tazdan.com";

function useServerStatus() {
  const [status, setStatus] = useState<StatusKind>("unknown");

  useEffect(() => {
    if (!STATUS_ENDPOINT) return;

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);

    (async () => {
      try {
        const r = await fetch(STATUS_ENDPOINT, {
          method: "GET",
          signal: ctrl.signal,
          headers: { Accept: "application/json,text/plain" },
          cache: "no-store",
        });
        // Any HTTP response means the server is up → live.
        // Only network throws (timeout / DNS / CORS) count as down.
        setStatus("live");
      } catch {
        setStatus("down");
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      ctrl.abort();
      clearTimeout(timeout);
    };
  }, []);

  return status;
}

export default function NotFound() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const isAr = useIsAr();
  const dark = colorMode === "dark";
  const status = useServerStatus();

  // Monochrome surface tokens — matches the mobile theme.
  const bg          = dark ? "#0A0A0B" : "#FAFAF7";
  const bgElev      = dark ? "#141416" : "#F1F0EB";
  const bgRaised    = dark ? "#1C1C1F" : "#FFFFFF";
  const line        = dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,11,0.08)";
  const lineStrong  = dark ? "rgba(255,255,255,0.14)" : "rgba(10,10,11,0.14)";
  const fg          = dark ? "#FAFAFA" : "#0A0A0B";
  const fgMuted     = dark ? "rgba(250,250,250,0.62)" : "rgba(10,10,11,0.62)";
  const fgFaint     = dark ? "rgba(250,250,250,0.36)" : "rgba(10,10,11,0.36)";
  const accent      = dark ? "#FAFAFA" : "#0A0A0B";
  const accentFg    = dark ? "#0A0A0B" : "#FAFAFA";
  const greenBg     = "rgba(43,179,111,0.14)";
  const greenFg     = "#3FCF8E";
  const amberBg     = "rgba(232,163,58,0.14)";
  const amberFg     = "#E8A33A";
  const redBg       = "rgba(229,72,77,0.14)";
  const redFg       = "#F87171";

  const statusBg =
    status === "live"     ? greenBg :
    status === "degraded" ? amberBg :
    status === "down"     ? redBg   :
    bgElev;
  const statusFg =
    status === "live"     ? greenFg :
    status === "degraded" ? amberFg :
    status === "down"     ? redFg   :
    fgMuted;
  const statusLabel =
    status === "live"     ? t("notfound_status_live",     "All systems operational") :
    status === "degraded" ? t("notfound_status_degraded", "Some services degraded")   :
    status === "down"     ? t("notfound_status_down",     "Status check failed")      :
                            t("notfound_status_unknown",  "Checking status…");

  return (
    <Box bg={bg} minH="100vh" color={fg}>
      <PublicNav />

      <Flex
        as="main"
        minH="calc(100vh - 80px)"
        align="center"
        justify="center"
        px={{ base: 6, md: 10 }}
        py={{ base: 16, md: 24 }}
        position="relative"
        overflow="hidden"
      >
        {/* Soft radial backdrop — mono, no brand color. */}
        <Box
          position="absolute"
          inset={0}
          pointerEvents="none"
          aria-hidden="true"
          bg={dark
            ? "radial-gradient(60% 80% at 50% 30%, rgba(255,255,255,0.04) 0%, transparent 70%)"
            : "radial-gradient(60% 80% at 50% 30%, rgba(0,0,0,0.04) 0%, transparent 70%)"}
        />

        <VStack
          spacing={{ base: 7, md: 9 }}
          maxW="640px"
          textAlign="center"
          position="relative"
          zIndex={1}
        >
          {/* ── Eyebrow with status pill ──────────────────────────── */}
          <HStack
            spacing={3}
            px={3} py={1.5}
            borderRadius="100px"
            bg={bgElev}
            border="1px solid"
            borderColor={line}
            color={fgMuted}
            fontSize="12px"
            fontWeight={700}
            letterSpacing="0.12em"
            textTransform="uppercase"
          >
            <Text>{t("notfound_eyebrow", "Error 404")}</Text>
            <Box w="1px" h="12px" bg={lineStrong} />
            <HStack spacing={1.5}>
              <Box
                w="6px" h="6px" borderRadius="full"
                bg={statusFg}
                boxShadow={status === "live" ? `0 0 6px ${statusFg}` : undefined}
                className={status === "live" ? "notfound-pulse" : undefined}
              />
              <Text
                color={statusFg}
                bg={statusBg}
                px={2} py={0.5}
                borderRadius="100px"
                fontSize="11px"
                letterSpacing="0.06em"
                fontWeight={700}
              >
                {statusLabel}
              </Text>
            </HStack>
          </HStack>

          {/* ── The mark — TV-static box with theme icon ───────── */}
          <Box
            w={{ base: "120px", md: "152px" }}
            h={{ base: "120px", md: "152px" }}
            borderRadius="36px"
            bg={bgRaised}
            border="1px solid"
            borderColor={line}
            display="grid"
            placeItems="center"
            position="relative"
            overflow="hidden"
            boxShadow={dark
              ? "0 30px 80px -20px rgba(0,0,0,0.6)"
              : "0 30px 80px -20px rgba(10,10,11,0.18)"}
          >
            {/* TV static noise background */}
            <Box
              position="absolute"
              inset={0}
              opacity={0.12}
              sx={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                backgroundSize: "120px 120px",
              }}
            />
            <Box position="relative" zIndex={1}>
              <Image
                src={dark ? "/icon-black.png" : "/icon-white.png"}
                alt="tazdan"
                width={64}
                height={64}
                style={{ borderRadius: 16 }}
              />
            </Box>
          </Box>

          {/* ── Title + subhead ──────────────────────────────────── */}
          <VStack spacing={3}>
            <Heading
              as="h1"
              fontSize={{ base: "30px", md: "44px" }}
              letterSpacing="-0.035em"
              lineHeight={isAr ? 1.2 : 1.05}
              fontWeight={800}
              maxW="22ch"
            >
              {t("notfound_title", "We couldn't find that page.")}
            </Heading>
            <Text
              color={fgMuted}
              fontSize={{ base: "15px", md: "17px" }}
              lineHeight={isAr ? 1.75 : 1.55}
              maxW="56ch"
            >
              {t(
                "notfound_sub",
                "The link might be old, mistyped, or pointing at something we've moved. Our servers are up and processing transactions — this is just a missing page."
              )}
            </Text>
          </VStack>

          {/* ── CTAs: home + contact, equally weighted ───────────── */}
          <HStack spacing={3} flexWrap="wrap" justify="center">
            <NextLink
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 52,
                padding: "0 26px",
                borderRadius: 100,
                background: accent,
                color: accentFg,
                fontWeight: 800,
                fontSize: 15,
                letterSpacing: "-0.01em",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
              </svg>
              {t("notfound_home", "Back to home")}
            </NextLink>

            <NextLink
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Help: 404")}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 52,
                padding: "0 26px",
                borderRadius: 100,
                background: "transparent",
                color: fg,
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "-0.01em",
                textDecoration: "none",
                border: `1px solid ${lineStrong}`,
                whiteSpace: "nowrap",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6" />
              </svg>
              {t("notfound_contact", "Contact support")}
            </NextLink>
          </HStack>

          {/* ── Quick links ──────────────────────────────────────── */}
          <HStack
            mt={2}
            spacing={5}
            color={fgFaint}
            fontSize="12px"
            flexWrap="wrap"
            justify="center"
          >
            <NextLink href="/features">{t("notfound_link_features", "Features")}</NextLink>
            <NextLink href="/fees">{t("notfound_link_fees", "Fees")}</NextLink>
            <NextLink href="/help">{t("notfound_link_help", "Help center")}</NextLink>
            <NextLink href="/contact">{t("notfound_link_contact", "Contact")}</NextLink>
          </HStack>
        </VStack>
      </Flex>

      <PublicFooter />

      {/* Live-status dot pulse. Plain CSS so Chakra's emotion runtime
          doesn't have to register a keyframes per render. */}
      <style jsx global>{`
        @keyframes notfoundPulse {
          0%, 100% { opacity: 1;    transform: scale(1);    }
          50%      { opacity: 0.45; transform: scale(0.78); }
        }
        .notfound-pulse {
          animation: notfoundPulse 1.6s ease-in-out infinite;
          transform-origin: center;
        }
        @media (prefers-reduced-motion: reduce) {
          .notfound-pulse { animation: none; }
        }
      `}</style>
    </Box>
  );
}
