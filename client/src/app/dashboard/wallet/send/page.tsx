"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Container, Heading, Text, VStack, HStack, Flex,
  Button, Input, Textarea, Card, CardBody, Divider,
  useColorModeValue, useToast, FormControl, FormLabel, Icon,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiArrowLeft, FiSend } from "react-icons/fi";
import { transferAPI } from "@/lib/api";

export default function SendPage() {
  const router = useRouter();
  const { t } = useTranslate();
  const toast = useToast();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const mutedText = useColorModeValue("gray.500", "gray.400");

  const amtNum = parseFloat(amount) || 0;
  const fee = amtNum * 0.001;
  const total = amtNum + fee;

  const isEmail = recipient.includes("@");

  const handleSend = async () => {
    if (!recipient || !amtNum) return;
    setSubmitting(true);
    try {
      await transferAPI.send({
        ...(isEmail ? { recipientEmail: recipient } : { recipientPhone: recipient }),
        amount: amtNum,
        note: note || undefined,
      });
      toast({ title: t("common_success"), status: "success", duration: 3000 });
      router.push("/dashboard");
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("common_error"), status: "error", duration: 4000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxW="lg" py={6} px={4}>
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<FiArrowLeft />}
        onClick={() => router.back()}
        mb={4}
      >
        Back
      </Button>

      <Heading size="lg" mb={5}>{t("send_title")}</Heading>

      <VStack spacing={4} mb={5}>
        <FormControl isRequired>
          <FormLabel fontSize="sm">{t("send_recipient")}</FormLabel>
          <Input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="email@example.com or +218..."
          />
        </FormControl>

        <FormControl isRequired>
          <FormLabel fontSize="sm">{t("send_amount")}</FormLabel>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            size="lg"
          />
        </FormControl>

        <FormControl>
          <FormLabel fontSize="sm">{t("send_note")}</FormLabel>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </FormControl>
      </VStack>

      {amtNum > 0 && (
        <Card variant="outline" mb={5}>
          <CardBody>
            <VStack spacing={2} fontSize="sm">
              <HStack justify="space-between" w="100%">
                <Text color={mutedText}>{t("send_amount")}</Text>
                <Text fontWeight={600}>{amtNum.toFixed(4)} USDT</Text>
              </HStack>
              <HStack justify="space-between" w="100%">
                <Text color={mutedText}>{t("send_fee")} (0.1%)</Text>
                <Text>{fee.toFixed(4)} USDT</Text>
              </HStack>
              <Divider />
              <HStack justify="space-between" w="100%">
                <Text fontWeight={700}>{t("send_total")}</Text>
                <Text fontWeight={700} color="brand.500">{total.toFixed(4)} USDT</Text>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      )}

      <Button
        colorScheme="brand"
        size="lg"
        w="100%"
        borderRadius="xl"
        leftIcon={<FiSend />}
        isLoading={submitting}
        loadingText={t("send_sending")}
        onClick={handleSend}
        isDisabled={!recipient || !amtNum}
      >
        {t("send_button")}
      </Button>
    </Container>
  );
}
