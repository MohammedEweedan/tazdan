"use client";

import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import {
  Modal, ModalOverlay, ModalContent, ModalBody, ModalCloseButton,
  Box, VStack, HStack, Heading, Text, Input, Button, Icon,
  useColorMode,
} from "@chakra-ui/react";
import { FiArrowRight, FiCheck } from "react-icons/fi";

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const bg     = dark ? "#0a0a0a" : "#ffffff";
  const fg     = dark ? "#ffffff" : "#000000";
  const muted  = dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.50)";
  const border = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const inputBg = dark ? "rgba(255,255,255,0.04)" : "#f4f4f4";
  const ctaBg  = dark ? "#ffffff" : "#0a0f1e";
  const ctaFg  = dark ? "#000000" : "#ffffff";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) { setErrorMsg(t("waitlist_error")); return; }
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg(t("waitlist_error"));
    }
  }

  function handleClose() {
    onClose();
    setTimeout(() => {
      if (status !== "success") { setEmail(""); setStatus("idle"); setErrorMsg(""); }
    }, 300);
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="md" motionPreset="slideInBottom">
      <ModalOverlay bg="rgba(0,0,0,0.6)" backdropFilter="blur(8px)" />
      <ModalContent
        bg={bg}
        border="1px solid"
        borderColor={border}
        borderRadius="28px"
        mx={4}
        overflow="hidden"
        boxShadow={dark ? "0 40px 80px rgba(0,0,0,0.7)" : "0 40px 80px rgba(0,0,0,0.15)"}
      >
        <ModalCloseButton
          top={5} right={5}
          color={muted}
          _hover={{ color: fg, bg: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}
          borderRadius="full"
        />
        <ModalBody p={{ base: 7, md: 10 }}>
          <VStack spacing={6} align="stretch">
            {/* Header */}
            <VStack spacing={2} align="start">
              <Text fontSize="11px" fontWeight="800" letterSpacing="0.14em" color={muted} textTransform="uppercase">
                {t("waitlist_eyebrow")}
              </Text>
              <Heading
                fontSize={{ base: "26px", md: "32px" }}
                fontWeight="900"
                letterSpacing="-0.04em"
                color={fg}
                lineHeight="1.1"
                whiteSpace="pre-line"
              >
                {t("waitlist_title")}
              </Heading>
              <Text fontSize="14px" color={muted} lineHeight="1.6">
                {t("waitlist_sub")}
              </Text>
            </VStack>

            {/* Stats */}
            <HStack spacing={5} pt={1}>
              {([
                { n: t("waitlist_stat1_n"), label: t("waitlist_stat1_l") },
                { n: t("waitlist_stat2_n"), label: t("waitlist_stat2_l") },
                { n: t("waitlist_stat3_n"), label: t("waitlist_stat3_l") },
              ] as { n: string; label: string }[]).map(({ n, label }) => (
                <VStack key={label} spacing={0} align="start">
                  <Text fontSize="18px" fontWeight="900" color={fg} letterSpacing="-0.04em">{n}</Text>
                  <Text fontSize="11px" color={muted}>{label}</Text>
                </VStack>
              ))}
            </HStack>

            <Box h="1px" bg={border} />

            {/* Form / Success */}
            {status === "success" ? (
              <HStack
                bg={dark ? "rgba(255,255,255,0.04)" : "#f4f4f4"}
                border="1px solid"
                borderColor={border}
                borderRadius="16px"
                px={5}
                py={4}
                spacing={3}
              >
                <Box
                  w={9} h={9} bg={fg} borderRadius="full"
                  display="flex" alignItems="center" justifyContent="center" flexShrink={0}
                >
                  <Icon as={FiCheck} color={bg} boxSize={4} />
                </Box>
                <VStack spacing={0} align="start">
                  <Text fontWeight="800" color={fg} fontSize="15px">{t("waitlist_success_title")}</Text>
                  <Text fontSize="13px" color={muted}>{t("waitlist_success_sub")}</Text>
                </VStack>
              </HStack>
            ) : (
              <Box as="form" onSubmit={handleSubmit}>
                <VStack spacing={3} align="stretch">
                  <Input
                    type="email"
                    placeholder={t("waitlist_placeholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    bg={inputBg}
                    border="1px solid"
                    borderColor={border}
                    color={fg}
                    borderRadius="14px"
                    h="52px"
                    px={5}
                    fontSize="15px"
                    _placeholder={{ color: muted }}
                    _focus={{ outline: "none", borderColor: fg }}
                  />
                  <Button
                    type="submit"
                    isLoading={status === "loading"}
                    h="52px"
                    bg={ctaBg}
                    color={ctaFg}
                    borderRadius="14px"
                    fontWeight="800"
                    fontSize="15px"
                    rightIcon={<Icon as={FiArrowRight} />}
                    _hover={{ opacity: 0.88 }}
                    transition="opacity 0.15s"
                  >
                    {t("waitlist_btn")}
                  </Button>
                  {(status === "error" || errorMsg) && (
                    <Text fontSize="13px" color="red.400" textAlign="left">
                      {errorMsg || t("waitlist_error")}
                    </Text>
                  )}
                </VStack>
              </Box>
            )}

            <Text fontSize="11.5px" color={dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.30)"} textAlign="center">
              {t("waitlist_disclaimer")}
            </Text>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
