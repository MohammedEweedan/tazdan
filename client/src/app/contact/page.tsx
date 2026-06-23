"use client";

import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import NextLink from "next/link";
import {
  Box, Heading, Text, VStack, HStack,
  SimpleGrid, Input, Textarea, Button, Select,
  Icon, Flex, FormControl, FormLabel,
  useColorMode, useToast,
} from "@chakra-ui/react";
import { FiClock, FiSend, FiArrowRight } from "react-icons/fi";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import SupportSection from "@/components/ui/SupportSection";
import { publicPageTheme } from "@/components/ui/publicPageTheme";
import { Band, Graphic, PageHero, Reveal } from "@/components/ui/appleKit";

export default function ContactPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", topic: "support", msg: "" });

  const {
    pageBg, textMain, textSub, cardBg, cardBgHover, raisedBg, inputBg,
    cardBorder, strongBorder, accent, accentText, accentSoft, accentBorder,
    shadow,
  } = publicPageTheme(dark);
  const ctaBg     = accent;
  const ctaFg     = "#ffffff";

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
      <PageHero
        eyebrow={t('nav_contact')}
        title={t('contact_page_title')}
        subtitle={t('contact_page_sub')}
      />

      {/* Support channels */}
      <SupportSection />

      {/* Contact form + office */}
      <Band maxW="1180px">
        <SimpleGrid columns={{ base: 1, lg: 3 }} gap={8}>
          {/* Form — spans 2 cols */}
          <Reveal>
          <Box
            gridColumn={{ lg: "span 2" }}
            bg={raisedBg} border="1px solid" borderColor={cardBorder}
            borderRadius="28px" p={{ base: 6, md: 10 }}
            boxShadow="none"
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
                    <FormLabel fontSize="12px" fontWeight="700" color={textSub}>
                      {t('contact_form_name')}
                    </FormLabel>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      bg={inputBg} border="1px solid" borderColor={cardBorder}
                      borderRadius="12px" h="48px" color={textMain}
                      _focus={{ borderColor: accentBorder, boxShadow: dark ? "0 0 0 1px rgba(99,161,219,0.22)" : "0 0 0 1px rgba(79,139,196,0.18)" }}
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel fontSize="12px" fontWeight="700" color={textSub}>
                      {t('contact_form_email')}
                    </FormLabel>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      bg={inputBg} border="1px solid" borderColor={cardBorder}
                      borderRadius="12px" h="48px" color={textMain}
                      _focus={{ borderColor: accentBorder, boxShadow: dark ? "0 0 0 1px rgba(99,161,219,0.22)" : "0 0 0 1px rgba(79,139,196,0.18)" }}
                    />
                  </FormControl>
                </SimpleGrid>

                <FormControl>
                  <FormLabel fontSize="12px" fontWeight="700" color={textSub}>
                    {t('contact_form_topic')}
                  </FormLabel>
                  <Select
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    bg={inputBg} border="1px solid" borderColor={cardBorder}
                    borderRadius="12px" h="48px" color={textMain}
                    _focus={{ borderColor: accentBorder, boxShadow: dark ? "0 0 0 1px rgba(99,161,219,0.22)" : "0 0 0 1px rgba(79,139,196,0.18)" }}
                  >
                    <option value="support">{t('contact_topic_support')}</option>
                    <option value="kyc">{t('contact_topic_kyc')}</option>
                    <option value="security">{t('contact_topic_security')}</option>
                    <option value="press">{t('contact_topic_press')}</option>
                    <option value="partners">{t('contact_topic_partners')}</option>
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="12px" fontWeight="700" color={textSub}>
                    {t('contact_form_msg')}
                  </FormLabel>
                  <Textarea
                    value={form.msg}
                    onChange={(e) => setForm({ ...form, msg: e.target.value })}
                    bg={inputBg} border="1px solid" borderColor={cardBorder}
                    borderRadius="12px" minH="140px" color={textMain}
                    _focus={{ borderColor: accentBorder, boxShadow: dark ? "0 0 0 1px rgba(99,161,219,0.22)" : "0 0 0 1px rgba(79,139,196,0.18)" }}
                  />
                </FormControl>

                <HStack justify="space-between" pt={2} flexWrap="wrap" spacing={4}>
                  <Text fontSize="12px" color={textSub}>{t('contact_form_note')}</Text>
                  <Button
                    type="submit" isLoading={submitting}
                    h="48px" px={7} bg={ctaBg} color={ctaFg}
                    borderRadius="12px" fontWeight="800" fontSize="14px"
                    rightIcon={<Icon as={FiSend} />}
                    boxShadow={dark ? "0 14px 38px rgba(99,161,219,0.22)" : "0 14px 34px rgba(79,139,196,0.18)"}
                    _hover={{ opacity: 0.9, transform: "translateY(-1px)" }}
                  >
                    {t('contact_form_send')}
                  </Button>
                </HStack>
              </VStack>
            </form>
          </Box>
          </Reveal>

          {/* Office + hours */}
          <VStack align="stretch" spacing={4}>
            <Reveal delay={0.04}>
              <Graphic kind="chat" dark={dark} />
            </Reveal>

            <Reveal delay={0.08}>
            <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="22px" p={6}>
              <Flex
                w="42px" h="42px" borderRadius="12px"
                bg={accentSoft}
                border="1px solid" borderColor={accentBorder}
                align="center" justify="center" mb={4}
              >
                <Icon as={FiClock} color={accentText} boxSize={5} />
              </Flex>
              <Text fontSize="15px" color={textMain} fontWeight="600" lineHeight="1.6" whiteSpace="pre-line">
                {t('contact_hours_value')}
              </Text>
            </Box>
            </Reveal>

            {/* FAQ nudge */}
            <Reveal delay={0.12}>
            <Box
              as={NextLink} href="/faq" display="block"
              bg={dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"}
              border="1px solid" borderColor={cardBorder}
              borderRadius="22px" p={6} cursor="pointer" role="group"
              transition="all 0.2s"
              _hover={{ bg: cardBgHover, borderColor: strongBorder, transform: "translateY(-2px)", boxShadow: shadow }}
            >
              <Text fontSize="15px" color={textMain} fontWeight="600" lineHeight="1.6" mb={3}>
                {t('contact_faq_nudge')}
              </Text>
              <HStack color={accentText} fontWeight="800" fontSize="13px" transition="all 0.15s">
                <Text>{t('contact_faq_link')}</Text>
                <Icon as={FiArrowRight} />
              </HStack>
            </Box>
            </Reveal>
          </VStack>
        </SimpleGrid>
      </Band>

      <PublicFooter />
    </Box>
  );
}
