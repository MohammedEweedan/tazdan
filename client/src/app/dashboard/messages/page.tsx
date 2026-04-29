"use client";

import { useEffect, useState, useRef } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Icon, Input, Avatar, Spinner, useToast,
} from "@chakra-ui/react";
import {
  FiMessageSquare, FiSend, FiArrowLeft, FiCheckCircle, FiChevronRight, FiInbox,
} from "react-icons/fi";
import { messageAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import {
  PageShell, PageHeader, GlassCard, EmptyState, useDashboardTokens,
} from "@/components/dashboard/DashboardUI";

export default function MessagesPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const tok = useDashboardTokens();
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [content, setContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Poll for new messages every 5s while in a conversation
  useEffect(() => {
    if (!selectedPartner) return;
    const id = setInterval(() => loadMessages(selectedPartner.id, false), 5000);
    return () => clearInterval(id);
  }, [selectedPartner]);

  const loadConversations = async () => {
    try {
      const res = await messageAPI.getConversations();
      setConversations(res.data.conversations || []);
    } catch {} finally { setLoading(false); }
  };

  const loadMessages = async (partnerId: string, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await messageAPI.getMessages(partnerId);
      setMessages(res.data.messages || []);
    } catch {} finally { if (showLoading) setLoading(false); }
  };

  const open = async (partner: any) => {
    setSelectedPartner(partner);
    await loadMessages(partner.id);
  };

  const send = async () => {
    if (!content.trim() || !selectedPartner) return;
    setSending(true);
    try {
      await messageAPI.send({ receiverId: selectedPartner.id, content: content.trim() });
      setContent("");
      await loadMessages(selectedPartner.id, false);
    } catch (e: any) {
      toast({ title: "Failed to send", description: e?.response?.data?.error || "Try again", status: "error", duration: 3000 });
    } finally { setSending(false); }
  };

  const [showStickers, setShowStickers] = useState(false);
  const STICKERS = [
    '👍','❤️','😂','🔥','🎉','👏','😭','🤔','👀','🙏',
    '🚀','💯','✅','⭐','👋','🤝','💪','😎','🥳','😍',
    '🤯','😤','🫡','🥷','💀','👑','🎯','🏆','🎁','💸',
    '📈','📉','🌍','🌙','☀️','🔒','⚡','💎','🍀','🦅',
  ];

  const sendSticker = async (sticker: string) => {
    if (!selectedPartner) return;
    setSending(true);
    try {
      await messageAPI.send({ receiverId: selectedPartner.id, content: sticker });
      setShowStickers(false);
      await loadMessages(selectedPartner.id, false);
    } catch (e: any) {
      toast({ title: "Failed to send", description: e?.response?.data?.error || "Try again", status: "error", duration: 3000 });
    } finally { setSending(false); }
  };

  const fmtTime = (d: string) => {
    const date = new Date(d);
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Community"
        title="Messages"
        subtitle="Chat with counterparts, agents and P2P partners."
      />

      <GlassCard p={0} overflow="hidden">
        <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "320px 1fr" }} h="calc(100vh - 220px)" minH="500px">
          {/* Conversation list */}
          <Box
            display={{ base: selectedPartner ? "none" : "block", lg: "block" }}
            borderRight={{ lg: "1px solid" }}
            borderColor={tok.panelBorder}
            overflowY="auto"
            sx={{ "&::-webkit-scrollbar": { width: "6px" }, "&::-webkit-scrollbar-thumb": { background: tok.panelBorder, borderRadius: "3px" } }}
          >
            <Flex
              px={4}
              py={3}
              justify="space-between"
              align="center"
              borderBottom="1px solid"
              borderColor={tok.panelBorder}
              position="sticky"
              top={0}
              bg={tok.panelBg}
              zIndex={1}
            >
              <HStack spacing={2}>
                <Icon as={FiMessageSquare} color={tok.brand} boxSize={4} />
                <Text fontSize="12px" fontWeight="800" color={tok.textMain} letterSpacing=".04em">
                  INBOX
                </Text>
              </HStack>
              <Text fontSize="10px" color={tok.textMuted} fontWeight="700">
                {conversations.length} {conversations.length === 1 ? "chat" : "chats"}
              </Text>
            </Flex>

            {loading && !selectedPartner ? (
              <Flex h="200px" align="center" justify="center"><Spinner color={tok.brand} /></Flex>
            ) : conversations.length === 0 ? (
              <EmptyState
                icon={FiInbox}
                title="No messages yet"
                hint="Conversations from P2P trades, payment flows and direct messages will show up here."
              />
            ) : (
              <VStack align="stretch" spacing={0}>
                {conversations.map((c: any) => {
                  const active = selectedPartner?.id === c.partner?.id;
                  return (
                    <Flex
                      key={c.partner?.id}
                      p={3}
                      gap={3}
                      align="center"
                      cursor="pointer"
                      bg={active ? (tok.dark ? "rgba(0,87,184,0.15)" : "rgba(0,87,184,0.06)") : "transparent"}
                      borderLeft="3px solid"
                      borderLeftColor={active ? tok.brand : "transparent"}
                      _hover={{ bg: active ? undefined : tok.hover }}
                      transition="all 0.15s"
                      onClick={() => open(c.partner)}
                    >
                      {c.partner?.avatarUrl ? (
                        <Flex
                          w="32px" h="32px" borderRadius="full"
                          bg={tok.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}
                          border="1px solid" borderColor={tok.panelBorder}
                          align="center" justify="center"
                          fontSize="18px"
                        >
                          {c.partner.avatarUrl}
                        </Flex>
                      ) : (
                        <Avatar
                          size="sm"
                          name={`${c.partner?.firstName || ""} ${c.partner?.lastName || ""}`}
                          bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
                          color="white"
                          fontSize="11px"
                          fontWeight="900"
                        />
                      )}
                      <Box flex={1} minW={0}>
                        <Flex justify="space-between" align="center">
                          <Text fontSize="13px" fontWeight="800" color={tok.textMain} noOfLines={1}>
                            {c.partner?.firstName} {c.partner?.lastName}
                          </Text>
                          <Text fontSize="10px" color={tok.textMuted}>
                            {c.lastMessage ? fmtTime(c.lastMessage.createdAt) : ""}
                          </Text>
                        </Flex>
                        <Flex justify="space-between" align="center">
                          <Text fontSize="11.5px" color={tok.textSub} noOfLines={1} flex={1}>
                            {c.lastMessage?.content || "No messages"}
                          </Text>
                          {c.unreadCount > 0 && (
                            <Flex
                              w="20px"
                              h="20px"
                              borderRadius="full"
                              bg={tok.brand}
                              align="center"
                              justify="center"
                              ml={2}
                              flexShrink={0}
                              boxShadow={`0 0 12px ${tok.brand}aa`}
                            >
                              <Text fontSize="9px" fontWeight="900" color="white">
                                {c.unreadCount}
                              </Text>
                            </Flex>
                          )}
                        </Flex>
                      </Box>
                      <Icon as={FiChevronRight} color={tok.textMuted} boxSize={3.5} display={{ base: "block", lg: "none" }} />
                    </Flex>
                  );
                })}
              </VStack>
            )}
          </Box>

          {/* Chat area */}
          <Flex direction="column" display={{ base: selectedPartner ? "flex" : "none", lg: "flex" }}>
            {!selectedPartner ? (
              <Flex flex={1} align="center" justify="center">
                <EmptyState
                  icon={FiMessageSquare}
                  title="Select a conversation"
                  hint="Pick someone on the left to start chatting."
                />
              </Flex>
            ) : (
              <>
                {/* Chat header */}
                <Flex
                  px={4}
                  py={3}
                  borderBottom="1px solid"
                  borderColor={tok.panelBorder}
                  align="center"
                  gap={3}
                  bg={tok.panelBg}
                >
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => { setSelectedPartner(null); setMessages([]); loadConversations(); }}
                    color={tok.textSub}
                    display={{ base: "flex", lg: "none" }}
                    minW="auto"
                    px={1.5}
                  >
                    <FiArrowLeft />
                  </Button>
                  {selectedPartner?.avatarUrl ? (
                    <Flex
                      w="32px" h="32px" borderRadius="full"
                      bg={tok.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}
                      border="1px solid" borderColor={tok.panelBorder}
                      align="center" justify="center"
                      fontSize="18px"
                    >
                      {selectedPartner.avatarUrl}
                    </Flex>
                  ) : (
                    <Avatar
                      size="sm"
                      name={`${selectedPartner.firstName} ${selectedPartner.lastName}`}
                      bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
                      color="white"
                      fontSize="11px"
                      fontWeight="900"
                    />
                  )}
                  <Box>
                    <Text fontSize="13px" fontWeight="800" color={tok.textMain}>
                      {selectedPartner.firstName} {selectedPartner.lastName}
                    </Text>
                    <Text fontSize="10.5px" color={tok.textMuted}>
                      @{selectedPartner.username || "user"}
                    </Text>
                  </Box>
                </Flex>

                {/* Messages */}
                <Box flex={1} overflowY="auto" p={4} bg={tok.panelInner}>
                  <VStack spacing={2} align="stretch">
                    {messages.map((msg: any) => {
                      const isMe = msg.senderId === user?.id;
                      return (
                        <Flex key={msg.id} justify={isMe ? "flex-end" : "flex-start"}>
                          <Box
                            maxW="75%"
                            px={3.5}
                            py={2}
                            borderRadius={isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px"}
                            bg={isMe
                              ? `linear-gradient(135deg, ${tok.brand}, #003d82)`
                              : tok.dark
                                ? "rgba(255,255,255,0.06)"
                                : "white"}
                            color={isMe ? "white" : tok.textMain}
                            border={isMe ? "none" : "1px solid"}
                            borderColor={isMe ? "transparent" : tok.panelBorder}
                            boxShadow={isMe ? `0 4px 14px ${tok.brand}44` : "none"}
                          >
                            <Text fontSize="13px" lineHeight="1.5">{msg.content}</Text>
                            <Flex justify="flex-end" align="center" gap={1} mt={1}>
                              <Text fontSize="9.5px" color={isMe ? "rgba(255,255,255,0.7)" : tok.textMuted}>
                                {fmtTime(msg.createdAt)}
                              </Text>
                              {isMe && msg.isRead && <Icon as={FiCheckCircle} boxSize={2.5} color="rgba(255,255,255,0.75)" />}
                            </Flex>
                          </Box>
                        </Flex>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </VStack>
                </Box>

                {/* Composer */}
                <Flex
                  p={3}
                  gap={2}
                  borderTop="1px solid"
                  borderColor={tok.panelBorder}
                  bg={tok.panelBg}
                >
                  <Input
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Type a message…"
                    bg={tok.panelInner}
                    border="1px solid"
                    borderColor={tok.panelBorder}
                    color={tok.textMain}
                    fontSize="13px"
                    borderRadius="12px"
                    h="42px"
                    _focus={{ borderColor: tok.brand, boxShadow: `0 0 0 1px ${tok.brand}` }}
                    _placeholder={{ color: tok.textMuted }}
                  />
                  <Button
                    onClick={() => setShowStickers((s) => !s)}
                    h="42px"
                    w="42px"
                    minW="42px"
                    borderRadius="12px"
                    variant="ghost"
                    color={tok.textSub}
                    fontSize="20px"
                  >
                    {showStickers ? '✕' : '🙂'}
                  </Button>
                  <Button
                    onClick={send}
                    isLoading={sending}
                    isDisabled={!content.trim()}
                    h="42px"
                    w="42px"
                    minW="42px"
                    borderRadius="12px"
                    bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
                    color="white"
                    _hover={{ transform: "translateY(-1px)", boxShadow: `0 6px 16px ${tok.brand}66` }}
                    _disabled={{ opacity: 0.4, cursor: "not-allowed" }}
                    transition="all 0.15s"
                  >
                    <FiSend />
                  </Button>
                </Flex>
                {showStickers && (
                  <Flex flexWrap="wrap" gap={2} pt={2}>
                    {STICKERS.map((s) => (
                      <Box
                        key={s}
                        as="button"
                        onClick={() => sendSticker(s)}
                        w="36px" h="36px" borderRadius="10px"
                        bg={tok.panelInner}
                        border="1px solid"
                        borderColor={tok.panelBorder}
                        display="flex" alignItems="center" justifyContent="center"
                        fontSize="18px"
                        cursor="pointer"
                        _hover={{ borderColor: tok.brand, bg: tok.hover }}
                        transition="all 0.15s"
                      >
                        {s}
                      </Box>
                    ))}
                  </Flex>
                )}
              </>
            )}
          </Flex>
        </Box>
      </GlassCard>
    </PageShell>
  );
}
