"use client";

import { useEffect, useState } from "react";
import {
  Box, Flex, Text, VStack, HStack, Icon, Button,
} from "@chakra-ui/react";
import {
  FiBell, FiCheckCircle, FiDollarSign, FiShield, FiAlertTriangle, FiInfo,
  FiSend, FiShoppingBag,
} from "react-icons/fi";
import { notificationAPI } from "@/lib/api";
import {
  PageShell, PageHeader, GlassCard, EmptyState, PageSpinner,
  useDashboardTokens,
} from "@/components/dashboard/DashboardUI";

const TYPE_ICONS: Record<string, any> = {
  deposit: FiDollarSign,
  withdrawal: FiDollarSign,
  transfer: FiSend,
  kyc: FiShield,
  trade: FiShoppingBag,
  security: FiAlertTriangle,
  info: FiInfo,
};
const TYPE_COLORS: Record<string, string> = {
  deposit: "#22c55e",
  withdrawal: "#ef4444",
  transfer: "#0057b8",
  kyc: "#0057b8",
  trade: "#f59e0b",
  security: "#ef4444",
  info: "#64748b",
};

export default function NotificationsPage() {
  const tok = useDashboardTokens();
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = (p = 1) => {
    setLoading(true);
    notificationAPI
      .getAll(p)
      .then((r) => {
        setItems(r.data.notifications || []);
        setUnread(r.data.unreadCount || 0);
        setPages(r.data.pages || 1);
        setPage(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    await notificationAPI.markRead(id).catch(() => {});
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    await notificationAPI.markAllRead().catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  };

  if (loading) return <PageShell><PageSpinner /></PageShell>;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread · ${items.length} shown` : "All caught up"}
        right={
          unread > 0 && (
            <Button
              size="sm"
              h="36px"
              px={3}
              variant="ghost"
              color={tok.textSub}
              _hover={{ color: tok.textMain, bg: tok.hover }}
              leftIcon={<FiCheckCircle />}
              fontWeight="700"
              onClick={markAllRead}
            >
              Mark all read
            </Button>
          )
        }
      />

      <GlassCard p={0}>
        {items.length === 0 ? (
          <EmptyState icon={FiBell} title="No notifications yet" hint="New alerts from trades, deposits and security will appear here." />
        ) : (
          <VStack
            align="stretch"
            spacing={0}
            sx={{ "& > *:not(:last-child)": { borderBottom: "1px solid", borderColor: tok.panelBorder } }}
          >
            {items.map((n: any) => {
              const IconComp = TYPE_ICONS[n.type] || FiBell;
              const color = TYPE_COLORS[n.type] || tok.textSub;
              return (
                <Flex
                  key={n.id}
                  px={5}
                  py={3.5}
                  align="flex-start"
                  gap={3}
                  cursor={n.isRead ? "default" : "pointer"}
                  onClick={() => !n.isRead && markRead(n.id)}
                  opacity={n.isRead ? 0.7 : 1}
                  _hover={{ bg: tok.hover }}
                  transition="background 0.15s"
                  position="relative"
                >
                  <Flex
                    w="38px"
                    h="38px"
                    borderRadius="10px"
                    bg={`${color}18`}
                    color={color}
                    align="center"
                    justify="center"
                    flexShrink={0}
                  >
                    <Icon as={IconComp} boxSize={4} />
                  </Flex>
                  <Box flex={1} minW={0}>
                    <HStack spacing={2} mb={0.5}>
                      <Text fontSize="13px" fontWeight="800" color={tok.textMain}>{n.title}</Text>
                      {!n.isRead && <Box w="7px" h="7px" borderRadius="full" bg={color} />}
                    </HStack>
                    <Text fontSize="12px" color={tok.textSub} mb={1}>{n.message}</Text>
                    <Text fontSize="10.5px" color={tok.textMuted}>
                      {new Date(n.createdAt).toLocaleString()}
                    </Text>
                  </Box>
                </Flex>
              );
            })}
          </VStack>
        )}
      </GlassCard>

      {pages > 1 && (
        <HStack justify="center" mt={4} spacing={2}>
          <Button
            size="sm"
            variant="ghost"
            color={tok.textSub}
            isDisabled={page <= 1}
            onClick={() => load(page - 1)}
            _hover={{ color: tok.textMain, bg: tok.hover }}
          >
            Prev
          </Button>
          <Text fontSize="12px" color={tok.textMuted} fontWeight="700">
            Page {page} of {pages}
          </Text>
          <Button
            size="sm"
            variant="ghost"
            color={tok.textSub}
            isDisabled={page >= pages}
            onClick={() => load(page + 1)}
            _hover={{ color: tok.textMain, bg: tok.hover }}
          >
            Next
          </Button>
        </HStack>
      )}
    </PageShell>
  );
}
