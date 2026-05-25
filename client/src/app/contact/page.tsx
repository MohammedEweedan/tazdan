"use client";

import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import NextLink from "next/link";
import {
  Box, Container, Heading, Text, VStack, HStack,
  SimpleGrid, Input, Textarea, Button, Select,
  Icon, Flex, FormControl, FormLabel,
  useColorMode, useToast,
} from "@chakra-ui/react";
import { FiMapPin, FiClock, FiSend, FiArrowRight } from "react-icons/fi";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import SupportSection from "@/components/ui/SupportSection";

export default function ContactPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", topic: "support", msg: "" });

  const pageBg    = dark ? "#000000" : "#ffffff";
  const textMain  = dark ? "#ffffff" : "#0a0f1e";
  const textSub   = dark ? "rgba(255,255,255,0.6)" : "#64748b";
  const cardBg    = dark ? "rgba(255,255,255,0.04)" : "#f4f4f4";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const inputBg   = dark ? "rgba(255,255,255,0.04)" : "#f0f0f0";
  const ctaBg     = dark ? "#ffffff" : "#0a0f1e";
  const ctaFg     = dark ? "#000000" : "#ffffff";

  const titleGradient = dark
    ? "linear(to-b, #ffffff 0%, rgba(255,255,255,0.85) 60%, rgba(255,255,255,0.3) 100%)"
    : "linear(to-b, #000000 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.2) 100%)";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('failed');
      toast({ title: t('contact_toast_title'), description: t('contact_toast_desc'), status: "success", duration: 4000 });
      setForm({ name: "", email: "", topic: "support", msg: "" });
    } catch {
      toast({ title: t('common_error'), status: "error", duration: 4000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      {/* Hero */}
      <Box pt={{ base: "120px", md: "160px" }} pb={{ base: 8, md: 14 }} textAlign="center">
        <VStack spacing={5} px={5}>
          <Heading
            as="h1"
            fontWeight="900"
            fontSize={{ base: "48px", md: "80px" }}
            lineHeight="1.0"
            letterSpacing="-0.04em"
            bgGradient={titleGradient}
            bgClip="text"
          >
            {t('contact_page_title')}
          </Heading>
          <Text fontSize={{ base: "15px", md: "18px" }} color={textSub} maxW="520px" lineHeight="1.7">
            {t('contact_page_sub')}
          </Text>
        </VStack>
      </Box>

      {/* Support channels */}
      <SupportSection />

      {/* Contact form + office */}
      <Container maxW="1180px" py={{ base: 10, md: 16 }}>
        <SimpleGrid columns={{ base: 1, lg: 3 }} gap={8}>
          {/* Form — spans 2 cols */}
          <Box
            gridColumn={{ lg: "span 2" }}
            bg={cardBg} border="1px solid" borderColor={cardBorder}
            borderRadius="24px" p={{ base: 6, md: 10 }}
          >
            <Heading
              fontSize={{ base: "22px", md: "28px" }} fontWeight="900"
              color={textMain} letterSpacing="-0.03em" mb={6}
            >
              {t('contact_form_title')}
            </Heading>
            <form onSubmit={handleSubmit}>
              <VStack align="stretch" spacing={5}>
                <SimpleGrid columns={{ base: 1, sm: 2 }} gap={5}>
                  <FormControl isRequired>
                    <FormLabel fontSize="12px" fontWeight="700" color={textSub} letterSpacing="0.05em" textTransform="uppercase">
                      {t('contact_form_name')}
                    </FormLabel>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      bg={inputBg} border="1px solid" borderColor={cardBorder}
                      borderRadius="12px" h="48px" color={textMain}
                      _focus={{ borderColor: textMain, boxShadow: "none" }}
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel fontSize="12px" fontWeight="700" color={textSub} letterSpacing="0.05em" textTransform="uppercase">
                      {t('contact_form_email')}
                    </FormLabel>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      bg={inputBg} border="1px solid" borderColor={cardBorder}
                      borderRadius="12px" h="48px" color={textMain}
                      _focus={{ borderColor: textMain, boxShadow: "none" }}
                    />
                  </FormControl>
                </SimpleGrid>

                <FormControl>
                  <FormLabel fontSize="12px" fontWeight="700" color={textSub} letterSpacing="0.05em" textTransform="uppercase">
                    {t('contact_form_topic')}
                  </FormLabel>
                  <Select
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    bg={inputBg} border="1px solid" borderColor={cardBorder}
                    borderRadius="12px" h="48px" color={textMain}
                    _focus={{ borderColor: textMain, boxShadow: "none" }}
                  >
                    <option value="support">{t('contact_topic_support')}</option>
                    <option value="kyc">{t('contact_topic_kyc')}</option>
                    <option value="security">{t('contact_topic_security')}</option>
                    <option value="press">{t('contact_topic_press')}</option>
                    <option value="partners">{t('contact_topic_partners')}</option>
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="12px" fontWeight="700" color={textSub} letterSpacing="0.05em" textTransform="uppercase">
                    {t('contact_form_msg')}
                  </FormLabel>
                  <Textarea
                    value={form.msg}
                    onChange={(e) => setForm({ ...form, msg: e.target.value })}
                    bg={inputBg} border="1px solid" borderColor={cardBorder}
                    borderRadius="12px" minH="140px" color={textMain}
                    _focus={{ borderColor: textMain, boxShadow: "none" }}
                  />
                </FormControl>

                <HStack justify="space-between" pt={2} flexWrap="wrap" spacing={4}>
                  <Text fontSize="12px" color={textSub}>{t('contact_form_note')}</Text>
                  <Button
                    type="submit" isLoading={submitting}
                    h="48px" px={7} bg={ctaBg} color={ctaFg}
                    borderRadius="12px" fontWeight="800" fontSize="14px"
                    rightIcon={<Icon as={FiSend} />}
                    _hover={{ opacity: 0.9 }}
                  >
                    {t('contact_form_send')}
                  </Button>
                </HStack>
              </VStack>
            </form>
          </Box>

          {/* Office + hours */}
          <VStack align="stretch" spacing={4}>
            {/* <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="24px" p={6}>
              <Flex
                w="42px" h="42px" borderRadius="12px"
                bg={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
                border="1px solid" borderColor={cardBorder}
                align="center" justify="center" mb={4}
              >
                <Icon as={FiMapPin} color={textMain} boxSize={5} />
              </Flex>
              <Text fontSize="11px" fontWeight="800" color={textSub} letterSpacing="0.15em" textTransform="uppercase" mb={1.5}>
                {t('contact_hq_label')}
              </Text>
              <Text fontSize="15px" color={textMain} fontWeight="600" lineHeight="1.6" whiteSpace="pre-line">
                {t('contact_hq_value')}
              </Text>
            </Box> */}

            <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="24px" p={6}>
              <Flex
                w="42px" h="42px" borderRadius="12px"
                bg={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
                border="1px solid" borderColor={cardBorder}
                align="center" justify="center" mb={4}
              >
                <Icon as={FiClock} color={textMain} boxSize={5} />
              </Flex>
              <Text fontSize="11px" fontWeight="800" color={textSub} letterSpacing="0.15em" textTransform="uppercase" mb={1.5}>
                {t('contact_hours_label')}
              </Text>
              <Text fontSize="15px" color={textMain} fontWeight="600" lineHeight="1.6" whiteSpace="pre-line">
                {t('contact_hours_value')}
              </Text>
            </Box>

            {/* FAQ nudge */}
            <Box
              as={NextLink} href="/faq" display="block"
              bg={dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"}
              border="1px solid" borderColor={cardBorder}
              borderRadius="24px" p={6} cursor="pointer" role="group"
              transition="all 0.2s"
              _hover={{ borderColor: dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)", transform: "translateY(-2px)" }}
            >
              <Text fontSize="11px" fontWeight="800" color={textSub} letterSpacing="0.15em" textTransform="uppercase" mb={2}>
                {t('contact_faq_eyebrow')}
              </Text>
              <Text fontSize="15px" color={textMain} fontWeight="600" lineHeight="1.6" mb={3}>
                {t('contact_faq_nudge')}
              </Text>
              <HStack color={textMain} fontWeight="700" fontSize="13px" transition="all 0.15s">
                <Text>{t('contact_faq_link')}</Text>
                <Icon as={FiArrowRight} />
              </HStack>
            </Box>
          </VStack>
        </SimpleGrid>
      </Container>

      <PublicFooter />
    </Box>
  );
}
