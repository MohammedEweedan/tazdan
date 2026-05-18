"use client";

import { useState } from "react";
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
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", topic: "support", msg: "" });

  const textMain   = dark ? "#ffffff" : "#0a0f1e";
  const textSub    = dark ? "rgba(255,255,255,0.6)" : "#475569";
  const cardBg     = dark ? "rgba(255,255,255,0.03)" : "white";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.1)";
  const inputBg    = dark ? "rgba(255,255,255,0.04)" : "white";
  const glow       = dark ? "rgba(0,87,184,0.15)" : "rgba(0,87,184,0.06)";
  const titleGradient = dark
    ? "linear(to-b, #4a8fe0 0%, #ffffff 55%, rgba(255,255,255,0.5) 100%)"
    : "linear(to-b, #0057b8 0%, #0a0f1e 55%, rgba(10,15,30,0.4) 100%)";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Wire to real endpoint when ready — for now shows success after brief delay
    await new Promise((r) => setTimeout(r, 900));
    setSubmitting(false);
    toast({ title: "Message sent ✓", description: "We'll get back to you within 24 hours.", status: "success", duration: 4000 });
    setForm({ name: "", email: "", topic: "support", msg: "" });
  };

  return (
    <Box minH="100vh" color={textMain} overflowX="clip">
      <PublicNav />

      {/* Hero */}
      <Box position="relative" pt={{ base: "110px", md: "160px" }} pb={{ base: 8, md: 14 }}>
        <Box
          position="absolute" top="20%" left="50%" transform="translateX(-50%)"
          w="800px" h="440px" bg={glow} filter="blur(140px)"
          borderRadius="full" pointerEvents="none"
        />
        <VStack spacing={5} textAlign="center" position="relative" zIndex={1} px={5}>
          <Heading
            as="h1"
            fontWeight="900"
            fontSize={{ base: "42px", md: "72px" }}
            lineHeight="1.0"
            letterSpacing="-0.04em"
            bgGradient={titleGradient}
            bgClip="text"
          >
            Get in touch
          </Heading>
          <Text fontSize={{ base: "15px", md: "18px" }} color={textSub} maxW="520px" lineHeight="1.7">
            Have a question, issue, or idea? We&apos;re here. Pick the channel that works best for you.
          </Text>
        </VStack>
      </Box>

      {/* Support channel cards */}
      <SupportSection />

      {/* Contact form + office info */}
      <Container maxW="1180px" py={{ base: 10, md: 16 }}>
        <SimpleGrid columns={{ base: 1, lg: 3 }} gap={8}>
          {/* Form — spans 2 cols */}
          <Box
            gridColumn={{ lg: "span 2" }}
            bg={cardBg}
            border="1px solid"
            borderColor={cardBorder}
            borderRadius="24px"
            p={{ base: 6, md: 10 }}
          >
            <Heading
              fontSize={{ base: "22px", md: "28px" }}
              fontWeight="800"
              color={textMain}
              letterSpacing="-0.02em"
              mb={6}
            >
              Send us a message
            </Heading>
            <form onSubmit={handleSubmit}>
              <VStack align="stretch" spacing={5}>
                <SimpleGrid columns={{ base: 1, sm: 2 }} gap={5}>
                  <FormControl isRequired>
                    <FormLabel fontSize="12px" fontWeight="700" color={textSub} letterSpacing="0.05em">
                      Name
                    </FormLabel>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      bg={inputBg} border="1px solid" borderColor={cardBorder}
                      borderRadius="12px" h="48px" color={textMain}
                      _focus={{ borderColor: "#0057b8", boxShadow: "0 0 0 3px rgba(0,87,184,0.15)" }}
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel fontSize="12px" fontWeight="700" color={textSub} letterSpacing="0.05em">
                      Email
                    </FormLabel>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      bg={inputBg} border="1px solid" borderColor={cardBorder}
                      borderRadius="12px" h="48px" color={textMain}
                      _focus={{ borderColor: "#0057b8", boxShadow: "0 0 0 3px rgba(0,87,184,0.15)" }}
                    />
                  </FormControl>
                </SimpleGrid>

                <FormControl>
                  <FormLabel fontSize="12px" fontWeight="700" color={textSub} letterSpacing="0.05em">
                    Topic
                  </FormLabel>
                  <Select
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    bg={inputBg} border="1px solid" borderColor={cardBorder}
                    borderRadius="12px" h="48px" color={textMain}
                    _focus={{ borderColor: "#0057b8", boxShadow: "0 0 0 3px rgba(0,87,184,0.15)" }}
                  >
                    <option value="support">General support</option>
                    <option value="kyc">KYC / identity verification</option>
                    <option value="security">Security concern</option>
                    <option value="press">Press &amp; media</option>
                    <option value="partners">Business &amp; partnerships</option>
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="12px" fontWeight="700" color={textSub} letterSpacing="0.05em">
                    Message
                  </FormLabel>
                  <Textarea
                    value={form.msg}
                    onChange={(e) => setForm({ ...form, msg: e.target.value })}
                    bg={inputBg} border="1px solid" borderColor={cardBorder}
                    borderRadius="12px" minH="140px" color={textMain}
                    _focus={{ borderColor: "#0057b8", boxShadow: "0 0 0 3px rgba(0,87,184,0.15)" }}
                  />
                </FormControl>

                <HStack justify="space-between" pt={2} flexWrap="wrap" spacing={4}>
                  <Text fontSize="12px" color={textSub}>
                    We reply within 24 hours on business days.
                  </Text>
                  <Button
                    type="submit"
                    isLoading={submitting}
                    h="48px" px={7}
                    bg={dark ? "white" : "#0a0f1e"}
                    color={dark ? "black" : "white"}
                    borderRadius="12px"
                    fontWeight="800"
                    fontSize="14px"
                    rightIcon={<Icon as={FiSend} />}
                    _hover={{ opacity: 0.9 }}
                  >
                    Send message
                  </Button>
                </HStack>
              </VStack>
            </form>
          </Box>

          {/* Office + hours */}
          <VStack align="stretch" spacing={4}>
            <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="24px" p={6}>
              <Flex
                w="42px" h="42px" borderRadius="12px"
                bg="rgba(0,87,184,0.15)" border="1px solid rgba(0,87,184,0.3)"
                align="center" justify="center" mb={4}
              >
                <Icon as={FiMapPin} color="#4a8fe0" boxSize={5} />
              </Flex>
              <Text fontSize="11px" fontWeight="800" color={textSub} letterSpacing="0.15em" textTransform="uppercase" mb={1.5}>
                Headquarters
              </Text>
              <Text fontSize="15px" color={textMain} fontWeight="600" lineHeight="1.6">
                Tripoli, Libya<br />
                (remote-first team)
              </Text>
            </Box>

            <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="24px" p={6}>
              <Flex
                w="42px" h="42px" borderRadius="12px"
                bg="rgba(34,197,94,0.15)" border="1px solid rgba(34,197,94,0.3)"
                align="center" justify="center" mb={4}
              >
                <Icon as={FiClock} color="#22c55e" boxSize={5} />
              </Flex>
              <Text fontSize="11px" fontWeight="800" color={textSub} letterSpacing="0.15em" textTransform="uppercase" mb={1.5}>
                Support hours
              </Text>
              <Text fontSize="15px" color={textMain} fontWeight="600" lineHeight="1.6">
                Sun – Thu, 9 am – 6 pm EET<br />
                Emergency: 24/7 via email
              </Text>
            </Box>

            {/* FAQ nudge */}
            <Box
              as={NextLink}
              href="/faq"
              display="block"
              bg={dark ? "rgba(0,87,184,0.1)" : "rgba(0,87,184,0.05)"}
              border="1px solid"
              borderColor={dark ? "rgba(0,87,184,0.25)" : "rgba(0,87,184,0.15)"}
              borderRadius="24px"
              p={6}
              cursor="pointer"
              role="group"
              transition="all 0.2s"
              _hover={{ borderColor: "#0057b8", transform: "translateY(-2px)" }}
            >
              <Text fontSize="11px" fontWeight="800" color="#0057b8" letterSpacing="0.15em" textTransform="uppercase" mb={2}>
                Before you write
              </Text>
              <Text fontSize="15px" color={textMain} fontWeight="600" lineHeight="1.6" mb={3}>
                Check our FAQ — most questions are answered there instantly.
              </Text>
              <HStack color="#0057b8" fontWeight="700" fontSize="13px" _groupHover={{ gap: "10px" }} transition="all 0.15s">
                <Text>Browse FAQ</Text>
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
