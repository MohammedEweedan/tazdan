"use client";

import NextLink from "next/link";
import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  Button,
  SimpleGrid,
  VStack,
  HStack,
  Icon,
  useColorMode,
  Divider,
} from "@chakra-ui/react";
import { useEffect } from "react";
import {
  FiShield,
  FiZap,
  FiLock,
  FiAlertTriangle,
  FiCheckCircle,
  FiArrowRight,
  FiEye,
  FiServer,
  FiFileText,
  FiUsers,
  FiClock,
  FiTrendingUp,
} from "react-icons/fi";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import ColorModeToggle from "@/components/ui/ColorModeToggle";
import { useTranslate } from "@tolgee/react";

// ── Scroll reveal (same as homepage) ─────────────────────────────────
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.opacity = "1";
            (e.target as HTMLElement).style.transform = "translateY(0)";
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(24px)";
      const delay = el.getAttribute("data-delay") || "0";
      el.style.transition = `opacity 0.6s ${delay}ms cubic-bezier(0.16,1,0.3,1), transform 0.6s ${delay}ms cubic-bezier(0.16,1,0.3,1)`;
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);
}

// ── Section header ────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  const { colorMode } = useColorMode();
  const muted = colorMode === "dark" ? "#64748b" : "#94a3b8";
  return (
    <Text
      fontSize="10px"
      fontWeight="700"
      color={muted}
      letterSpacing=".12em"
      textTransform="uppercase"
      mb={2}
      data-reveal
    >
      {children}
    </Text>
  );
}

// ══ TRUST PAGE ═══════════════════════════════════════════════════════════
export default function TrustPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  useScrollReveal();

  const dark = colorMode === "dark";
  const pageBg = dark ? "#000000" : "#fafbfe";
  const navBg = dark ? "rgba(0,0,0,0.85)" : "rgba(250,251,254,0.85)";
  const navBorder = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
  const cardBg = dark ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.9)";
  const cardBorder = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  const muted = dark ? "#64748b" : "#94a3b8";
  const textSub = dark ? "#94a3b8" : "#64748b";
  const footerBg = dark ? "#030310" : "#0f172a";
  const warningBg = dark ? "rgba(245,158,11,0.07)" : "rgba(245,158,11,0.05)";
  const warningBorder = dark ? "rgba(245,158,11,0.2)" : "rgba(245,158,11,0.25)";

  const guarantees = [
    {
      icon: FiZap,
      color: "#f59e0b",
      title: "Sub-second Execution",
      desc: "Our order matching engine processes transactions in under 80ms. From confirmation to settlement, your crypto moves at the speed of the network — not slower.",
    },
    {
      icon: FiShield,
      color: "#3b82f6",
      title: "Bank-grade Encryption",
      desc: "All data is encrypted at rest with AES-256 and in transit over TLS 1.3. Your assets and personal data are protected by the same standards used by global financial institutions.",
    },
    {
      icon: FiServer,
      color: "#0057b8",
      title: "99.9% Uptime SLA",
      desc: "Our infrastructure is distributed across multiple redundant nodes with real-time failover. Planned maintenance is always zero-downtime.",
    },
    {
      icon: FiLock,
      color: "#8b5cf6",
      title: "Cold Storage",
      desc: "The majority of user funds are held in air-gapped cold storage wallets. Hot wallets are kept to a strict operational minimum with multi-signature authorisation.",
    },
    {
      icon: FiEye,
      color: "#06b6d4",
      title: "Advanced Fraud Detection",
      desc: "Proprietary AI-powered fraud detection monitors every transaction in real-time, flagging anomalies instantly. Suspicious activity triggers automatic holds pending manual review.",
    },
    {
      icon: FiUsers,
      color: "#ec4899",
      title: "Strict AML Practices",
      desc: "promrkts enforces rigorous Anti-Money Laundering protocols. All accounts undergo KYC verification. Transactions above threshold values are subject to enhanced due diligence.",
    },
  ];

  const amlPoints = [
    "All users are required to complete full KYC identity verification before transacting.",
    "Transactions are screened against global sanctions lists in real-time.",
    "Suspicious activity reports (SARs) are filed with appropriate authorities where required.",
    "Enhanced Due Diligence (EDD) applies to politically exposed persons (PEPs) and high-value accounts.",
    "Transaction monitoring is continuous and automated with human oversight.",
    "We maintain full compliance with applicable financial regulations in our operating jurisdiction.",
  ];

  const disclaimerPoints = [
    "promrkts is a private limited company providing cryptocurrency exchange and P2P intermediary financial services.",
    "All transactions executed on the promrkts platform are final and irreversible once confirmed on-chain.",
    "Users bear sole responsibility for any loss of tokens or digital assets arising from causes outside of promrkts's direct control, including but not limited to: incorrect wallet addresses entered by the user, wallet incompatibility, network congestion, user error, or improper use of the platform.",
    "promrkts does not accept liability for losses resulting from the user's own negligence, failure to follow platform instructions, or breach of the Terms of Service.",
    "Cryptocurrency trading involves substantial risk. The value of digital assets can decrease significantly. Users should only trade with funds they can afford to lose.",
    "promrkts does not provide financial, investment, legal, or tax advice. Nothing on this platform constitutes a solicitation or recommendation to buy or sell any asset.",
    "By using the promrkts platform, you acknowledge and agree that all responsibility for transaction outcomes — except in cases of proven platform error — rests with you, the user.",
  ];

  return (
    <Box minH="100vh" bg={pageBg} overflowX="hidden">
      <style>{`
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 3px; }
      `}</style>

      {/* ── Nav ── */}
      <Box
        as="nav"
        position="fixed"
        top={0}
        left={0}
        right={0}
        zIndex={200}
        h="64px"
        bg={navBg}
        backdropFilter="blur(20px) saturate(180%)"
        borderBottom="1px solid"
        borderColor={navBorder}
        display="flex"
        alignItems="center"
        px={8}
        gap={8}
      >
        <Box as={NextLink} href="/" textDecoration="none" flexShrink={0}>
          <Text
            fontSize="17px"
            fontWeight="900"
            letterSpacing="-0.04em"
            bgGradient="linear(135deg,#3b82f6,#06b6d4)"
            bgClip="text"
            color="transparent"
          >
            PROMRKTS
          </Text>
        </Box>
        <Flex flex={1} />
        <HStack spacing={2}>
          <LanguageSwitcher />
          <ColorModeToggle />
          <Button
            as={NextLink}
            href="/register"
            size="sm"
            fontSize="13px"
            fontWeight="700"
            bg="linear-gradient(135deg,#2563eb,#1d4ed8)"
            color="white"
            px={5}
            h="34px"
            borderRadius="8px"
            _hover={{
              opacity: 0.9,
              transform: "translateY(-1px)",
              boxShadow: "0 4px 20px rgba(37,99,235,0.4)",
            }}
            transition="opacity 0.2s, transform 0.2s, box-shadow 0.2s"
          >
            Get Started
          </Button>
        </HStack>
      </Box>

      {/* ── Hero ── */}
      <Box
        pt={{ base: "100px", md: "120px" }}
        pb={16}
        px={{ base: 4, md: "40px" }}
        position="relative"
        overflow="hidden"
      >
        {/* Background blobs */}
        <Box position="absolute" inset={0} zIndex={0} pointerEvents="none">
          <Box
            position="absolute"
            top="-20%"
            left="30%"
            w="600px"
            h="600px"
            borderRadius="full"
            bg={
              dark
                ? "radial-gradient(circle,rgba(37,99,235,0.1),transparent 65%)"
                : "radial-gradient(circle,rgba(37,99,235,0.05),transparent 65%)"
            }
            style={{ filter: "blur(60px)" }}
          />
        </Box>
        <Box
          maxW="860px"
          mx="auto"
          textAlign="center"
          position="relative"
          zIndex={2}
        >
          <Box
            display="inline-flex"
            alignItems="center"
            gap={2}
            px={3}
            py={1.5}
            borderRadius="full"
            mb={7}
            border="1px solid"
            borderColor={dark ? "rgba(0,87,184,0.3)" : "rgba(0,87,184,0.2)"}
            bg={dark ? "rgba(0,87,184,0.07)" : "rgba(0,87,184,0.04)"}
            style={{ animation: "fadeIn 0.5s ease forwards" }}
          >
            <Icon as={FiShield} color="#0057b8" boxSize={3} />
            <Text
              fontSize="11px"
              fontWeight="700"
              color="#0057b8"
              letterSpacing=".04em"
            >
              Trust & Safety
            </Text>
          </Box>
          <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

          <Heading
            as="h1"
            fontSize={{ base: "38px", md: "58px" }}
            fontWeight="900"
            lineHeight="1.05"
            letterSpacing="-.05em"
            mb={5}
            style={{ animation: "fadeIn 0.6s 0.1s ease both" }}
          >
            Speed, Security &
            <Box
              as="span"
              display="block"
              bgGradient="linear(135deg,#3b82f6,#06b6d4)"
              bgClip="text"
              color="transparent"
            >
              Full Transparency
            </Box>
          </Heading>

          <Text
            fontSize={{ base: "15px", md: "17px" }}
            color={textSub}
            maxW="560px"
            mx="auto"
            lineHeight="1.85"
            style={{ animation: "fadeIn 0.6s 0.2s ease both" }}
          >
            promrkts is built on a foundation of strict compliance, advanced
            security infrastructure, and absolute transparency with our users
            about how we operate — and where your responsibility begins.
          </Text>
        </Box>
      </Box>

      {/* ── Guarantee Cards ── */}
      <Box px={{ base: 4, md: "40px" }} pb={24}>
        <Box maxW="1200px" mx="auto">
          <Box mb={12} textAlign="center">
            <SectionLabel>Our Commitments</SectionLabel>
            <Heading
              size="lg"
              fontWeight="900"
              letterSpacing="-.03em"
              data-reveal
              data-delay="80"
            >
              What We Guarantee
            </Heading>
          </Box>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={5}>
            {guarantees.map((g, i) => (
              <Box
                key={i}
                data-reveal
                data-delay={`${(i % 3) * 80}`}
                p={7}
                bg={cardBg}
                border="1px solid"
                borderColor={cardBorder}
                borderRadius="16px"
                transition="border-color 0.3s, transform 0.3s, box-shadow 0.3s"
                _hover={{
                  borderColor: g.color + "44",
                  transform: "translateY(-3px)",
                  boxShadow: dark
                    ? "0 16px 40px rgba(0,0,0,0.45)"
                    : "0 16px 40px rgba(0,0,0,0.1)",
                }}
              >
                <Box
                  w="44px"
                  h="44px"
                  borderRadius="12px"
                  mb={5}
                  bg={g.color + "14"}
                  border="1px solid"
                  borderColor={g.color + "22"}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon as={g.icon} color={g.color} boxSize={4.5} />
                </Box>
                <Text
                  fontSize="15px"
                  fontWeight="800"
                  mb={2.5}
                  letterSpacing="-.02em"
                >
                  {g.title}
                </Text>
                <Text fontSize="13.5px" color={textSub} lineHeight="1.8">
                  {g.desc}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      </Box>

      {/* ── AML Section ── */}
      <Box
        px={{ base: 4, md: "40px" }}
        pb={24}
        bg={dark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.012)"}
        borderTop="1px solid"
        borderBottom="1px solid"
        borderColor={cardBorder}
        py={20}
      >
        <Box maxW="1000px" mx="auto">
          <SimpleGrid
            columns={{ base: 1, md: 2 }}
            spacing={16}
            alignItems="start"
          >
            <Box>
              <SectionLabel>Compliance</SectionLabel>
              <Heading
                size="xl"
                fontWeight="900"
                letterSpacing="-.04em"
                mb={5}
                data-reveal
                data-delay="80"
              >
                Anti-Money Laundering Practices
              </Heading>
              <Text
                fontSize="14px"
                color={textSub}
                lineHeight="1.9"
                mb={6}
                data-reveal
                data-delay="160"
              >
                promrkts maintains strict AML compliance in full alignment with
                international financial crime prevention standards. We are
                committed to preventing our platform from being used for illicit
                activity.
              </Text>
              <Box data-reveal data-delay="240">
                <Button
                  as={NextLink}
                  href="#disclaimer"
                  size="md"
                  fontSize="13px"
                  fontWeight="600"
                  variant="outline"
                  borderColor={cardBorder}
                  borderRadius="8px"
                  rightIcon={<FiArrowRight />}
                  _hover={{ borderColor: "rgba(99,102,241,0.4)" }}
                >
                  View User Disclaimer
                </Button>
              </Box>
            </Box>

            <VStack spacing={3} align="stretch">
              {amlPoints.map((point, i) => (
                <Box
                  key={i}
                  data-reveal
                  data-delay={`${i * 60}`}
                  display="flex"
                  gap={3}
                  p={4}
                  bg={cardBg}
                  border="1px solid"
                  borderColor={cardBorder}
                  borderRadius="12px"
                >
                  <Icon
                    as={FiCheckCircle}
                    color="#0057b8"
                    boxSize={4}
                    flexShrink={0}
                    mt="2px"
                  />
                  <Text fontSize="13px" color={textSub} lineHeight="1.75">
                    {point}
                  </Text>
                </Box>
              ))}
            </VStack>
          </SimpleGrid>
        </Box>
      </Box>

      {/* ── Fraud Detection ── */}
      <Box px={{ base: 4, md: "40px" }} py={24}>
        <Box maxW="1000px" mx="auto">
          <Box mb={10} textAlign="center">
            <SectionLabel>Protection Systems</SectionLabel>
            <Heading
              size="lg"
              fontWeight="900"
              letterSpacing="-.03em"
              mb={3}
              data-reveal
              data-delay="80"
            >
              Advanced Fraud Detection
            </Heading>
            <Text
              fontSize="14px"
              color={textSub}
              maxW="500px"
              mx="auto"
              lineHeight="1.85"
              data-reveal
              data-delay="160"
            >
              Our systems operate in the background, 24/7, to protect both the
              platform and its users from fraud, manipulation, and bad actors.
            </Text>
          </Box>

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={5}>
            {[
              {
                icon: FiEye,
                color: "#06b6d4",
                title: "Real-time Monitoring",
                desc: "Every transaction is scanned as it occurs. No batch processing. No delays. Anomalies are flagged before funds move.",
              },
              {
                icon: FiClock,
                color: "#8b5cf6",
                title: "Automated Holds",
                desc: "Suspicious transactions trigger automatic holds for manual review. Users are notified immediately and guided through resolution.",
              },
              {
                icon: FiTrendingUp,
                color: "#3b82f6",
                title: "Pattern Recognition",
                desc: "Our ML models are trained on global fraud patterns. They continuously adapt to new tactics used by bad actors.",
              },
            ].map((item, i) => (
              <Box
                key={i}
                data-reveal
                data-delay={`${i * 100}`}
                p={6}
                bg={cardBg}
                border="1px solid"
                borderColor={cardBorder}
                borderRadius="14px"
                textAlign="center"
                transition="border-color 0.3s, transform 0.3s"
                _hover={{
                  borderColor: item.color + "44",
                  transform: "translateY(-3px)",
                }}
              >
                <Box
                  w="44px"
                  h="44px"
                  borderRadius="12px"
                  mb={4}
                  bg={item.color + "14"}
                  border="1px solid"
                  borderColor={item.color + "22"}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  mx="auto"
                >
                  <Icon as={item.icon} color={item.color} boxSize={4.5} />
                </Box>
                <Text
                  fontSize="14px"
                  fontWeight="800"
                  mb={2}
                  letterSpacing="-.02em"
                >
                  {item.title}
                </Text>
                <Text fontSize="13px" color={textSub} lineHeight="1.75">
                  {item.desc}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      </Box>

      {/* ── Legal Disclaimer ── */}
      <Box
        id="disclaimer"
        px={{ base: 4, md: "40px" }}
        py={20}
        bg={dark ? "rgba(245,158,11,0.04)" : "rgba(245,158,11,0.03)"}
        borderTop="1px solid"
        borderBottom="1px solid"
        borderColor={warningBorder}
      >
        <Box maxW="900px" mx="auto">
          {/* Warning header */}
          <Flex align="center" gap={3} mb={8} data-reveal>
            <Box
              w="40px"
              h="40px"
              borderRadius="10px"
              bg={warningBg}
              border="1px solid"
              borderColor={warningBorder}
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <Icon as={FiAlertTriangle} color="#f59e0b" boxSize={4.5} />
            </Box>
            <Box>
              <Text
                fontSize="10px"
                fontWeight="700"
                color="#f59e0b"
                letterSpacing=".12em"
                textTransform="uppercase"
                mb={0.5}
              >
                Important Legal Notice
              </Text>
              <Heading fontSize="22px" fontWeight="900" letterSpacing="-.03em">
                User Disclaimer & Platform Terms
              </Heading>
            </Box>
          </Flex>

          {/* Company statement */}
          <Box
            p={6}
            bg={cardBg}
            border="1px solid"
            borderColor={cardBorder}
            borderRadius="14px"
            mb={5}
            data-reveal
            data-delay="80"
          >
            <Text
              fontSize="13px"
              fontWeight="700"
              color={dark ? "#a5b4fc" : "#3b82f6"}
              mb={3}
              letterSpacing=".02em"
            >
              COMPANY IDENTITY
            </Text>
            <Text fontSize="14px" color={textSub} lineHeight="1.9">
              <Box as="strong" color={dark ? "white" : "gray.900"}>
                promrkts
              </Box>{" "}
              is a{" "}
              <Box as="strong" color={dark ? "white" : "gray.900"}>
                private limited company
              </Box>{" "}
              providing cryptocurrency exchange services and acting as a{" "}
              <Box as="strong" color={dark ? "white" : "gray.900"}>
                P2P financial intermediary
              </Box>
              . We facilitate the buying, selling, and conversion of digital
              assets between users and counterparties. We are not a bank, not a
              licensed financial advisor, and not a custodian of last resort.
            </Text>
          </Box>

          {/* Final transactions box */}
          <Box
            p={6}
            bg={dark ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.04)"}
            border="1px solid"
            borderColor={dark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.18)"}
            borderRadius="14px"
            mb={5}
            data-reveal
            data-delay="120"
          >
            <Flex align="flex-start" gap={3}>
              <Icon
                as={FiAlertTriangle}
                color="#ef4444"
                boxSize={4}
                mt="2px"
                flexShrink={0}
              />
              <Box>
                <Text
                  fontSize="13px"
                  fontWeight="700"
                  color="#ef4444"
                  mb={2}
                  letterSpacing=".02em"
                >
                  ALL TRANSACTIONS ARE FINAL
                </Text>
                <Text fontSize="14px" color={textSub} lineHeight="1.9">
                  Once a transaction has been submitted and confirmed on the
                  blockchain, it is{" "}
                  <Box as="strong" color={dark ? "white" : "gray.900"}>
                    irreversible
                  </Box>
                  . promrkts cannot reverse, cancel, or recover transactions that
                  have been executed. Users must verify all wallet addresses,
                  networks, and amounts before confirming any transfer.
                </Text>
              </Box>
            </Flex>
          </Box>

          {/* Disclaimer points */}
          <VStack spacing={3} align="stretch" mb={8}>
            {disclaimerPoints.map((point, i) => (
              <Box
                key={i}
                data-reveal
                data-delay={`${i * 50}`}
                display="flex"
                gap={3}
                p={4}
                bg={cardBg}
                border="1px solid"
                borderColor={cardBorder}
                borderRadius="12px"
              >
                <Box
                  w="20px"
                  h="20px"
                  borderRadius="full"
                  bg={warningBg}
                  border="1px solid"
                  borderColor={warningBorder}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                  mt="1px"
                >
                  <Text fontSize="9px" fontWeight="900" color="#f59e0b">
                    {i + 1}
                  </Text>
                </Box>
                <Text fontSize="13.5px" color={textSub} lineHeight="1.8">
                  {point}
                </Text>
              </Box>
            ))}
          </VStack>

          {/* AML brief */}
          <Box
            p={6}
            bg={dark ? "rgba(0,87,184,0.06)" : "rgba(0,87,184,0.04)"}
            border="1px solid"
            borderColor={
              dark ? "rgba(0,87,184,0.2)" : "rgba(0,87,184,0.18)"
            }
            borderRadius="14px"
            data-reveal
          >
            <Flex align="flex-start" gap={3}>
              <Icon
                as={FiShield}
                color="#0057b8"
                boxSize={4}
                mt="2px"
                flexShrink={0}
              />
              <Box>
                <Text
                  fontSize="13px"
                  fontWeight="700"
                  color="#0057b8"
                  mb={2}
                  letterSpacing=".02em"
                >
                  AML & COMPLIANCE STATEMENT
                </Text>
                <Text fontSize="14px" color={textSub} lineHeight="1.9">
                  promrkts employs strict Anti-Money Laundering (AML) practices
                  and advanced fraud detection systems on all transactions. We
                  are committed to operating a compliant, ethical, and
                  transparent financial service. Users engaging in, or suspected
                  of engaging in, money laundering, terrorist financing, or any
                  other illicit activity will have their accounts permanently
                  suspended and reported to the relevant authorities without
                  prior notice.
                </Text>
              </Box>
            </Flex>
          </Box>
        </Box>
      </Box>

      {/* ── CTA ── */}
      <Box px={{ base: 4, md: "40px" }} py={24}>
        <Box
          maxW="720px"
          mx="auto"
          borderRadius="20px"
          p={{ base: 10, md: "56px 64px" }}
          textAlign="center"
          color="white"
          position="relative"
          overflow="hidden"
          bg={
            dark
              ? "linear-gradient(135deg,#0a1128,#0f1a3d 50%,#0c1530)"
              : "linear-gradient(135deg,#1e3a8a,#1e40af 50%,#1d4ed8)"
          }
          border="1px solid"
          borderColor={dark ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.15)"}
        >
          <Box
            position="absolute"
            inset={0}
            pointerEvents="none"
            backgroundImage="linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)"
            backgroundSize="40px 40px"
            opacity={0.4}
          />
          <Icon
            as={FiShield}
            color="rgba(255,255,255,0.3)"
            boxSize={10}
            mb={4}
          />
          <Heading
            size="xl"
            fontWeight="900"
            letterSpacing="-.04em"
            mb={3}
            position="relative"
            zIndex={1}
          >
            Trade with Confidence
          </Heading>
          <Text
            fontSize="15px"
            color="rgba(255,255,255,0.55)"
            mb={8}
            maxW="380px"
            mx="auto"
            lineHeight="1.8"
            position="relative"
            zIndex={1}
          >
            Join thousands of global traders who trust promrkts for secure, fast,
            and compliant crypto exchange.
          </Text>
          <Flex
            gap={3}
            justify="center"
            flexWrap="wrap"
            position="relative"
            zIndex={1}
          >
            <Button
              as={NextLink}
              href="/register"
              size="lg"
              fontSize="14px"
              fontWeight="800"
              bg="white"
              color="blue.800"
              rightIcon={<FiArrowRight />}
              px={8}
              h="48px"
              borderRadius="10px"
              transition="background 0.2s, transform 0.2s"
              _hover={{ bg: "blue.50", transform: "translateY(-2px)" }}
            >
              Create Free Account
            </Button>
            <Button
              as={NextLink}
              href="/"
              size="lg"
              fontSize="13px"
              fontWeight="600"
              bg="rgba(255,255,255,0.07)"
              color="white"
              border="1px solid rgba(255,255,255,0.15)"
              h="48px"
              borderRadius="10px"
              _hover={{
                bg: "rgba(255,255,255,0.12)",
                borderColor: "rgba(255,255,255,0.28)",
              }}
            >
              Back to Home
            </Button>
          </Flex>
        </Box>
      </Box>

      {/* ── Footer ── */}
      <Box
        as="footer"
        bg={footerBg}
        px={{ base: 4, md: "48px" }}
        py={8}
        position="relative"
      >
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          h="1px"
          bg="linear-gradient(90deg,transparent,rgba(99,102,241,0.35),rgba(6,182,212,0.25),transparent)"
        />
        <Box maxW="1200px" mx="auto">
          <Flex
            align="center"
            justify="space-between"
            direction={{ base: "column", md: "row" }}
            gap={4}
          >
            <Text
              fontSize="13px"
              fontWeight="900"
              letterSpacing="-0.04em"
              bgGradient="linear(135deg,#3b82f6,#06b6d4)"
              bgClip="text"
              color="transparent"
            >
              PROMRKTS
            </Text>
            <Text fontSize="12px" color="#334155">
              © 2025 promrkts. All rights reserved. · Private Limited Company
            </Text>
            <HStack spacing={5}>
              {["Terms", "Privacy", "AML Policy"].map((l) => (
                <Box
                  key={l}
                  as={NextLink}
                  href="#"
                  fontSize="12px"
                  color="#334155"
                  textDecoration="none"
                  transition="color 0.12s"
                  _hover={{ color: "#64748b" }}
                >
                  {l}
                </Box>
              ))}
            </HStack>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
}
