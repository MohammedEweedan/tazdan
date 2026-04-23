"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Container, Heading, Text, VStack, HStack, Flex,
  Button, Card, CardBody, Badge, Spinner, Center,
  useColorModeValue, Icon,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiArrowLeft } from "react-icons/fi";
import { agentAPI } from "@/lib/api";

const statusColorScheme: Record<string, string> = {
  PENDING: "yellow",
  CONFIRMED: "blue",
  COMPLETED: "green",
  REJECTED: "red",
  CANCELLED: "gray",
};

export default function AgentHistoryPage() {
  const router = useRouter();
  const { t } = useTranslate();
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const mutedText = useColorModeValue("gray.500", "gray.400");

  useEffect(() => {
    agentAPI.getMyTransactions().then((res: any) => {
      setTxns(res.data.transactions || res.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Center minH="60vh"><Spinner size="lg" color="brand.500" /></Center>;

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

      <Heading size="lg" mb={5}>{t("agent_history_title")}</Heading>

      {txns.length === 0 ? (
        <Card variant="outline">
          <CardBody py={8} textAlign="center">
            <Text color={mutedText}>{t("agent_no_history")}</Text>
          </CardBody>
        </Card>
      ) : (
        <VStack spacing={3}>
          {txns.map((tx: any) => (
            <Card key={tx.id} variant="outline" w="100%">
              <CardBody>
                <Flex justify="space-between" align="start" mb={2}>
                  <HStack>
                    <Badge colorScheme={tx.type === "DEPOSIT" ? "green" : "red"}>{tx.type}</Badge>
                    <Badge colorScheme={statusColorScheme[tx.status] || "gray"}>{tx.status}</Badge>
                  </HStack>
                  <Text fontWeight={700} fontSize="lg">
                    {parseFloat(tx.amount).toFixed(2)} {tx.currency}
                  </Text>
                </Flex>
                {tx.agent && (
                  <Text fontSize="xs" color={mutedText}>
                    Agent: {tx.agent.name} · {tx.agent.city}
                  </Text>
                )}
                <HStack fontSize="xs" color={mutedText} mt={1}>
                  <Text>Ref: {tx.reference}</Text>
                  <Text>·</Text>
                  <Text>
                    {new Date(tx.createdAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </Text>
                </HStack>
              </CardBody>
            </Card>
          ))}
        </VStack>
      )}
    </Container>
  );
}
