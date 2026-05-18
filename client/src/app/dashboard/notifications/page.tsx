"use client";

import { useEffect, useState } from "react";
import {
  Avatar, AvatarFallback,
  Badge,
  Box, Button, Divider, Flex, HStack, Icon,
  Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay,
  Spinner, Tab, TabList, TabPanel, TabPanels, Tabs as ChakraTabs, Text, VStack,
} from "@chakra-ui/react";
import {
  FiBell, FiCheckCircle, FiChevronRight, FiEye, FiEyeOff,
  FiSend, FiUser, FiUsers,
} from "react-icons/fi";
import { adminAPI } from "@/lib/api";
import {
  PageShell, PageHeader, GlassCard, EmptyState, PageSpinner,
  useDashboardTokens,
} from "@/components/dashboard/DashboardUI";

function formatDate(d: string) {
  return new Date(d).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ReadBadge({ read, total }: { read: number; total: number }) {
  const pct = total > 0 ? Math.round((read / total) * 100) : 0;
  const color = pct >= 75 ? "green" : pct >= 40 ? "yellow" : "red";
  return (
    <Badge colorScheme={color} fontSize="11px" borderRadius="6px" px={2}>
      {read}/{total} read ({pct}%)
    </Badge>
  );
}

function RecipientDrawer({
  broadcastId,
  title,
  onClose,
}: {
  broadcastId: string;
  title: string;
  onClose: () => void;
}) {
  const tok = useDashboardTokens();
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "read" | "unread">("all");

  const load = (p: number, f: typeof filter) => {
    setLoading(true);
    const readParam = f === "read" ? "true" : f === "unread" ? "false" : undefined;
    adminAPI
      .getBroadcastRecipients(broadcastId, p, readParam as any)
      .then((r) => {
        setItems(r.data.items ?? []);
        setPages(r.data.pages ?? 1);
        setPage(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1, filter); }, [broadcastId, filter]);

  return (
    <Modal isOpen onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay bg="rgba(0,0,0,0.6)" />
      <ModalContent bg={tok.cardBg} borderColor={tok.panelBorder} borderWidth="1px" borderRadius="16px">
        <ModalHeader color={tok.textMain} fontSize="15px" fontWeight="800" borderBottom="1px solid" borderColor={tok.panelBorder}>
          <HStack spacing={2}>
            <Icon as={FiUsers} boxSize={4} />
            <Text>Recipients — {title}</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color={tok.textSub} />

        <ModalBody p={0}>
          {/* Filter tabs */}
          <HStack spacing={2} p={4} borderBottom="1px solid" borderColor={tok.panelBorder}>
            {(["all", "read", "unread"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                h="30px"
                variant={filter === f ? "solid" : "ghost"}
                colorScheme={filter === f ? "blue" : undefined}
                color={filter === f ? undefined : tok.textSub}
                _hover={{ bg: tok.hover }}
                textTransform="capitalize"
                fontWeight="700"
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
          </HStack>

          {loading ? (
            <Flex justify="center" py={10}><Spinner color={tok.textSub} /></Flex>
          ) : items.length === 0 ? (
            <EmptyState icon={FiUser} title="No recipients" hint="No users match this filter." />
          ) : (
            <VStack align="stretch" spacing={0} divider={<Divider borderColor={tok.panelBorder} />}>
              {items.map((r) => (
                <Flex key={r.notifId} px={4} py={3} align="center" gap={3}>
                  <Avatar
                    size="sm"
                    src={r.user?.avatarUrl}
                    name={`${r.user?.firstName ?? ""} ${r.user?.lastName ?? ""}`.trim() || r.user?.email}
                  >
                    <AvatarFallback>{(r.user?.firstName?.[0] ?? r.user?.email?.[0] ?? "?").toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <Box flex={1} minW={0}>
                    <Text fontSize="13px" fontWeight="700" color={tok.textMain} noOfLines={1}>
                      {`${r.user?.firstName ?? ""} ${r.user?.lastName ?? ""}`.trim() || r.user?.username || r.user?.email}
                    </Text>
                    <Text fontSize="11px" color={tok.textSub} noOfLines={1}>{r.user?.email}</Text>
                  </Box>
                  <HStack spacing={1}>
                    <Icon as={r.isRead ? FiEye : FiEyeOff} boxSize={3.5} color={r.isRead ? "green.400" : tok.textMuted} />
                    <Text fontSize="11px" color={r.isRead ? "green.400" : tok.textMuted} fontWeight="600">
                      {r.isRead ? "Read" : "Unread"}
                    </Text>
                  </HStack>
                </Flex>
              ))}
            </VStack>
          )}

          {pages > 1 && (
            <HStack justify="center" p={4} borderTop="1px solid" borderColor={tok.panelBorder} spacing={2}>
              <Button size="sm" variant="ghost" color={tok.textSub} isDisabled={page <= 1}
                onClick={() => load(page - 1, filter)} _hover={{ bg: tok.hover }}>Prev</Button>
              <Text fontSize="12px" color={tok.textMuted} fontWeight="700">Page {page} of {pages}</Text>
              <Button size="sm" variant="ghost" color={tok.textSub} isDisabled={page >= pages}
                onClick={() => load(page + 1, filter)} _hover={{ bg: tok.hover }}>Next</Button>
            </HStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default function NotificationsPage() {
  const tok = useDashboardTokens();
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedBroadcast, setSelectedBroadcast] = useState<{ id: string; title: string } | null>(null);

  const load = (p = 1) => {
    setLoading(true);
    adminAPI
      .getNotifications(p)
      .then((r) => {
        setItems(r.data.items ?? r.data.notifications ?? []);
        setPages(r.data.pages ?? 1);
        setPage(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <PageShell><PageSpinner /></PageShell>;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="Broadcast Notifications"
        subtitle={`${items.length} broadcasts shown`}
      />

      <GlassCard p={0}>
        {items.length === 0 ? (
          <EmptyState icon={FiBell} title="No broadcasts yet" hint="Notifications sent to users will appear here." />
        ) : (
          <VStack
            align="stretch"
            spacing={0}
            sx={{ "& > *:not(:last-child)": { borderBottom: "1px solid", borderColor: tok.panelBorder } }}
          >
            {items.map((n: any) => {
              const hasRecipients = !!n.broadcastId;
              return (
                <Box key={n.id} px={5} py={4}>
                  {/* Title + timestamp */}
                  <Flex align="flex-start" gap={3}>
                    <Flex
                      w="40px" h="40px" borderRadius="10px"
                      bg="blue.500" bg-opacity="0.12"
                      align="center" justify="center" flexShrink={0}
                      bgColor="rgba(0,87,184,0.12)"
                    >
                      <Icon as={FiBell} boxSize={4} color="blue.400" />
                    </Flex>

                    <Box flex={1} minW={0}>
                      <HStack spacing={2} mb={1} flexWrap="wrap">
                        <Text fontSize="14px" fontWeight="800" color={tok.textMain}>{n.title}</Text>
                        {n.subtitle && (
                          <Text fontSize="12px" color={tok.textSub} fontWeight="600">— {n.subtitle}</Text>
                        )}
                      </HStack>

                      <Text fontSize="12px" color={tok.textSub} mb={2} noOfLines={2}>
                        {n.description ?? n.message}
                      </Text>

                      {/* Stats row */}
                      <HStack spacing={3} flexWrap="wrap">
                        {n.recipientCount > 0 && (
                          <ReadBadge read={n.readCount} total={n.recipientCount} />
                        )}

                        {n.sender && (
                          <HStack spacing={1}>
                            <Icon as={FiSend} boxSize={3} color={tok.textMuted} />
                            <Text fontSize="11px" color={tok.textMuted}>
                              Sent by <b>{n.sender.name || n.sender.email}</b>
                            </Text>
                          </HStack>
                        )}

                        <Text fontSize="11px" color={tok.textMuted}>
                          {formatDate(n.createdAt)}
                        </Text>
                      </HStack>
                    </Box>

                    {/* Recipients drill-down */}
                    {hasRecipients && (
                      <Button
                        size="sm"
                        variant="ghost"
                        color={tok.textSub}
                        _hover={{ color: tok.textMain, bg: tok.hover }}
                        rightIcon={<FiChevronRight />}
                        fontWeight="700"
                        flexShrink={0}
                        onClick={() => setSelectedBroadcast({ id: n.broadcastId, title: n.title })}
                      >
                        <HStack spacing={1}>
                          <Icon as={FiUsers} boxSize={3.5} />
                          <Text fontSize="12px">{n.recipientCount}</Text>
                        </HStack>
                      </Button>
                    )}
                  </Flex>
                </Box>
              );
            })}
          </VStack>
        )}
      </GlassCard>

      {pages > 1 && (
        <HStack justify="center" mt={4} spacing={2}>
          <Button size="sm" variant="ghost" color={tok.textSub} isDisabled={page <= 1}
            onClick={() => load(page - 1)} _hover={{ color: tok.textMain, bg: tok.hover }}>Prev</Button>
          <Text fontSize="12px" color={tok.textMuted} fontWeight="700">Page {page} of {pages}</Text>
          <Button size="sm" variant="ghost" color={tok.textSub} isDisabled={page >= pages}
            onClick={() => load(page + 1)} _hover={{ color: tok.textMain, bg: tok.hover }}>Next</Button>
        </HStack>
      )}

      {selectedBroadcast && (
        <RecipientDrawer
          broadcastId={selectedBroadcast.id}
          title={selectedBroadcast.title}
          onClose={() => setSelectedBroadcast(null)}
        />
      )}
    </PageShell>
  );
}
