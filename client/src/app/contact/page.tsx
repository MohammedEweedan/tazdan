"use client";

import { useState } from "react";
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  Input,
  Textarea,
  Button,
  Select,
  Icon,
  Flex,
  FormControl,
  FormLabel,
  useColorMode,
  useToast,
} from "@chakra-ui/react";
import {
  FiLifeBuoy,
  FiShield,
  FiMic,
  FiBriefcase,
  FiMapPin,
  FiClock,
  FiSend,
} from "react-icons/fi";
import { useTranslate } from "@tolgee/react";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";

export default function ContactPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", topic: "support", msg: "" });

  const pageBg = dark ? "#000000" : "#fafbfe";
  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.6)" : "#475569";
  const cardBg = dark ? "rgba(255,255,255,0.03)" : "white";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.1)";
  const inputBg = dark ? "rgba(255,255,255,0.04)" : "white";
  const glow = dark ? "rgba(0,87,184,0.15)" : "rgba(0,87,184,0.06)";

  const titleGradient = dark
    ? "linear(to-b, #4a8fe0 0%, #ffffff 55%, rgba(255,255,255,0.5) 100%)"
    : "linear(to-b, #0057b8 0%, #0a0f1e 55%, rgba(10,15,30,0.4) 100%)";

  const channels = [
    { icon: FiLifeBuoy, t: t("page_contact_ch1_t"), v: t("page_contact_ch1_v"), d: t("page_contact_ch1_d"), color: "#22c55e" },
    { icon: FiShield, t: t("page_contact_ch2_t"), v: t("page_contact_ch2_v"), d: t("page_contact_ch2_d"), color: "#f59e0b" },
    { icon: FiMic, t: t("page_contact_ch3_t"), v: t("page_contact_ch3_v"), d: t("page_contact_ch3_d"), color: "#8b5cf6" },
    { icon: FiBriefcase, t: t("page_contact_ch4_t"), v: t("page_contact_ch4_v"), d: t("page_contact_ch4_d"), color: "#4a8fe0" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Placeholder: wire to real endpoint later.
    setTimeout(() => {
      setSubmitting(false);
      toast({ title: t("page_contact_form_send") + " ✓", status: "success", duration: 3500 });
      setForm({ name: "", email: "", topic: "support", msg: "" });
    }, 900);
  };

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      {/* Hero */}
      <Box position="relative" pt={{ base: "110px", md: "160px" }} pb={{ base: 10, md: 16 }}>
        <Box position="absolute" top="20%" left="50%" transform="translateX(-50%)" w="800px" h="440px" bg={glow} filter="blur(140px)" borderRadius="full" pointerEvents="none" />
        <Container maxW="900px" position="relative" zIndex={1}>
          <VStack spacing={5} textAlign="center">
            <Text fontSize="11px" fontWeight="800" color="#4a8fe0" letterSpacing="0.22em">
              ✦ {t("page_contact_eyebrow")}
            </Text>
            <Heading
              as="h1"
              fontFamily="'DM Sans', sans-serif"
              fontWeight="800"
              fontSize={{ base: "40px", md: "68px" }}
              lineHeight="1.0"
              letterSpacing="-0.04em"
              bgGradient={titleGradient}
              bgClip="text"
            >
              {t("page_contact_title")}
            </Heading>
            <Text fontSize={{ base: "15px", md: "18px" }} color={textSub} maxW="620px" lineHeight="1.7">
              {t("page_contact_sub")}
            </Text>
          </VStack>
        </Container>
      </Box>

      {/* Channels */}
      <Container maxW="1180px" py={{ base: 4, md: 10 }}>
        <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
          {channels.map((ch) => (
            <Box
              key={ch.t}
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderRadius="20px"
              p={6}
              transition="all 0.2s ease"
              _hover={{ transform: "translateY(-3px)", borderColor: "#0057b8" }}
            >
              <HStack spacing={4} align="start">
                <Flex w="44px" h="44px" borderRadius="12px" bg={`${ch.color}22`} border="1px solid" borderColor={`${ch.color}44`} align="center" justify="center" flexShrink={0}>
                  <Icon as={ch.icon} color={ch.color} boxSize={5} />
                </Flex>
                <VStack align="start" spacing={1} flex={1}>
                  <Text fontSize="11px" fontWeight="800" color={textSub} letterSpacing="0.15em" textTransform="uppercase">
                    {ch.t}
                  </Text>
                  <Text
                    as="a"
                    href={`mailto:${ch.v}`}
                    fontSize="17px"
                    fontWeight="700"
                    color={textMain}
                    _hover={{ color: "#4a8fe0" }}
                    transition="color 0.15s"
                    wordBreak="break-all"
                  >
                    {ch.v}
                  </Text>
                  <Text fontSize="13px" color={textSub}>
                    {ch.d}
                  </Text>
                </VStack>
              </HStack>
            </Box>
          ))}
        </SimpleGrid>
      </Container>

      {/* Form + Office info */}
      <Container maxW="1180px" py={{ base: 10, md: 16 }}>
        <SimpleGrid columns={{ base: 1, lg: 3 }} gap={8}>
          {/* Form: spans 2 cols */}
          <Box
            gridColumn={{ lg: "span 2" }}
            bg={cardBg}
            border="1px solid"
            borderColor={cardBorder}
            borderRadius="24px"
            p={{ base: 6, md: 10 }}
            backdropFilter="blur(14px)"
          >
            <Heading fontSize={{ base: "22px", md: "28px" }} fontWeight="800" color={textMain} letterSpacing="-0.02em" fontFamily="'DM Sans', sans-serif" mb={6}>
              {t("page_contact_form_title")}
            </Heading>
            <form onSubmit={handleSubmit}>
              <VStack align="stretch" spacing={5}>
                <SimpleGrid columns={{ base: 1, sm: 2 }} gap={5}>
                  <FormControl isRequired>
                    <FormLabel fontSize="12px" fontWeight="700" color={textSub} letterSpacing="0.05em">
                      {t("page_contact_form_name")}
                    </FormLabel>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      bg={inputBg}
                      border="1px solid"
                      borderColor={cardBorder}
                      borderRadius="12px"
                      h="48px"
                      color={textMain}
                      _focus={{ borderColor: "#0057b8", boxShadow: "0 0 0 3px rgba(0,87,184,0.15)" }}
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel fontSize="12px" fontWeight="700" color={textSub} letterSpacing="0.05em">
                      {t("page_contact_form_email")}
                    </FormLabel>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      bg={inputBg}
                      border="1px solid"
                      borderColor={cardBorder}
                      borderRadius="12px"
                      h="48px"
                      color={textMain}
                      _focus={{ borderColor: "#0057b8", boxShadow: "0 0 0 3px rgba(0,87,184,0.15)" }}
                    />
                  </FormControl>
                </SimpleGrid>
                <FormControl>
                  <FormLabel fontSize="12px" fontWeight="700" color={textSub} letterSpacing="0.05em">
                    {t("page_contact_form_topic")}
                  </FormLabel>
                  <Select
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    bg={inputBg}
                    border="1px solid"
                    borderColor={cardBorder}
                    borderRadius="12px"
                    h="48px"
                    color={textMain}
                    _focus={{ borderColor: "#0057b8", boxShadow: "0 0 0 3px rgba(0,87,184,0.15)" }}
                  >
                    <option value="support">{t("page_contact_ch1_t")}</option>
                    <option value="security">{t("page_contact_ch2_t")}</option>
                    <option value="press">{t("page_contact_ch3_t")}</option>
                    <option value="partners">{t("page_contact_ch4_t")}</option>
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="12px" fontWeight="700" color={textSub} letterSpacing="0.05em">
                    {t("page_contact_form_msg")}
                  </FormLabel>
                  <Textarea
                    value={form.msg}
                    onChange={(e) => setForm({ ...form, msg: e.target.value })}
                    bg={inputBg}
                    border="1px solid"
                    borderColor={cardBorder}
                    borderRadius="12px"
                    minH="140px"
                    color={textMain}
                    _focus={{ borderColor: "#0057b8", boxShadow: "0 0 0 3px rgba(0,87,184,0.15)" }}
                  />
                </FormControl>
                <HStack justify="space-between" pt={2} flexWrap="wrap" spacing={4}>
                  <Text fontSize="12px" color={textSub}>
                    {t("page_contact_form_note")}
                  </Text>
                  <Button
                    type="submit"
                    isLoading={submitting}
                    h="48px"
                    px={7}
                    bg={dark ? "white" : "#0a0f1e"}
                    color={dark ? "black" : "white"}
                    borderRadius="12px"
                    fontWeight="800"
                    fontSize="14px"
                    rightIcon={<Icon as={FiSend} />}
                    _hover={{ opacity: 0.9 }}
                  >
                    {t("page_contact_form_send")}
                  </Button>
                </HStack>
              </VStack>
            </form>
          </Box>

          {/* Office info */}
          <VStack align="stretch" spacing={4}>
            <Box
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderRadius="24px"
              p={6}
            >
              <Flex w="42px" h="42px" borderRadius="12px" bg="rgba(0,87,184,0.15)" border="1px solid rgba(0,87,184,0.3)" align="center" justify="center" mb={4}>
                <Icon as={FiMapPin} color="#4a8fe0" boxSize={5} />
              </Flex>
              <Text fontSize="11px" fontWeight="800" color={textSub} letterSpacing="0.15em" textTransform="uppercase" mb={1.5}>
                {t("page_contact_office_t")}
              </Text>
              <Text fontSize="15px" color={textMain} fontWeight="600" lineHeight="1.6">
                {t("page_contact_office_a")}
              </Text>
            </Box>
            <Box
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderRadius="24px"
              p={6}
            >
              <Flex w="42px" h="42px" borderRadius="12px" bg="rgba(34,197,94,0.15)" border="1px solid rgba(34,197,94,0.3)" align="center" justify="center" mb={4}>
                <Icon as={FiClock} color="#22c55e" boxSize={5} />
              </Flex>
              <Text fontSize="11px" fontWeight="800" color={textSub} letterSpacing="0.15em" textTransform="uppercase" mb={1.5}>
                {t("page_contact_hq_t")}
              </Text>
              <Text fontSize="15px" color={textMain} fontWeight="600" lineHeight="1.6">
                {t("page_contact_hq_a")}
              </Text>
            </Box>
          </VStack>
        </SimpleGrid>
      </Container>

      <PublicFooter />
    </Box>
  );
}
