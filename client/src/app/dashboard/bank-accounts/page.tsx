"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import {
  Box,
  Text,
  Button,
  Input,
  FormControl,
  FormLabel,
  Flex,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  IconButton,
  Checkbox,
  Avatar,
  HStack,
  VStack,
  Spinner,
  useToast,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { useIsAr } from "@/hooks/useIsAr";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiRefreshCw,
  FiBell,
  FiZap,
  FiCreditCard,
  FiCheckCircle,
} from "react-icons/fi";
import { useAuthStore } from "@/stores/authStore";
import { bankAccountAPI } from "@/lib/api";
import { formatDate } from "@/lib/utils";

// ── Stat cell ─────────────────────────────────────────────────────────
function StatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <Box
      px={5}
      py={4}
      borderRight="1px solid"
      borderColor="rgba(255,255,255,0.05)"
      _last={{ borderRight: "none" }}
    >
      {accent && (
        <Box w="24px" h="1.5px" bg={accent} borderRadius="full" mb={3} />
      )}
      <Text
        fontSize="22px"
        fontWeight="800"
        letterSpacing="-.03em"
        fontFamily="'DM Mono', monospace"
        color="white"
        lineHeight={1}
      >
        {value}
      </Text>
      <Text
        fontSize="10px"
        fontWeight="600"
        color="#475569"
        letterSpacing=".08em"
        textTransform="uppercase"
        mt={1.5}
      >
        {label}
      </Text>
    </Box>
  );
}

// ── Account row ───────────────────────────────────────────────────────
function AccountRow({
  account,
  onEdit,
  onDelete,
}: {
  account: any;
  onEdit: (a: any) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Flex
      align="center"
      gap={3}
      px={4}
      py={3}
      borderBottom="1px solid"
      borderColor="rgba(255,255,255,0.04)"
      transition="background 0.15s"
      _hover={{ bg: "rgba(255,255,255,0.02)" }}
      _last={{ borderBottom: "none" }}
    >
      <Box
        w="36px"
        h="36px"
        borderRadius="10px"
        bg="rgba(59,130,246,0.1)"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Box as={FiCreditCard} color="#3b82f6" size={18} />
      </Box>
      <Box flex={1}>
        <Text fontSize="12px" fontWeight="700" color="white">
          {account.bankName}
        </Text>
        <Text fontSize="11px" color="#64748b" fontFamily="'DM Mono', monospace">
          ****{account.accountNumber.slice(-4)}
        </Text>
      </Box>
      <Box flex={1}>
        <Text fontSize="12px" color="#94a3b8">
          {account.accountName}
        </Text>
      </Box>
      <Box flex={1}>
        <Text fontSize="11px" color="#64748b">
          {account.branch || "-"}
        </Text>
      </Box>
      {account.isDefault ? (
        <Box
          px={2}
          py="2px"
          borderRadius="4px"
          bg="rgba(0,87,184,0.1)"
          border="1px solid rgba(0,87,184,0.2)"
        >
          <Text fontSize="9px" fontWeight="700" color="#0057b8" letterSpacing=".06em">
            DEFAULT
          </Text>
        </Box>
      ) : (
        <Box w="60px" />
      )}
      <HStack spacing={1}>
        <IconButton
          aria-label="Edit bank account"
          icon={<FiEdit2 size={14} />}
          size="sm"
          variant="ghost"
          color="#475569"
          _hover={{ color: "white", bg: "rgba(255,255,255,0.04)" }}
          onClick={() => onEdit(account)}
        />
        <IconButton
          aria-label="Delete bank account"
          icon={<FiTrash2 size={14} />}
          size="sm"
          variant="ghost"
          color="#475569"
          _hover={{ color: "#ef4444", bg: "rgba(239,68,68,0.08)" }}
          onClick={() => onDelete(account.id)}
        />
      </HStack>
    </Flex>
  );
}

// ══ BANK ACCOUNTS PAGE ════════════════════════════════════════════════
export default function BankAccountsPage() {
  const { t } = useTranslate();
  const isAr = useIsAr();
  const { user } = useAuthStore();
  const toast = useToast();
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [now, setNow] = useState(new Date());
  const { isOpen, onOpen, onClose } = useDisclosure();

  const cardBg = "rgba(8,8,22,0.98)";
  const cardBorder = "rgba(255,255,255,0.05)";
  const muted = "#64748b";
  const textSub = "#94a3b8";

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const [formData, setFormData] = useState({
    bankName: "",
    accountNumber: "",
    accountName: "",
    branch: "",
    isDefault: false,
  });

  const loadBankAccounts = async () => {
    try {
      const res = await bankAccountAPI.getAll();
      setBankAccounts(res.data.bankAccounts || []);
    } catch (error) {
      console.error('Failed to load bank accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBankAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bankName || !formData.accountNumber || !formData.accountName) {
      toast({ title: "Please fill all required fields", status: "warning", duration: 3000 });
      return;
    }
    setSubmitting(true);
    try {
      if (editingAccount) {
        await bankAccountAPI.update(editingAccount.id, formData);
        toast({ title: "Bank account updated successfully", status: "success", duration: 3000 });
      } else {
        await bankAccountAPI.create(formData);
        toast({ title: "Bank account added successfully", status: "success", duration: 3000 });
      }
      setFormData({ bankName: "", accountNumber: "", accountName: "", branch: "", isDefault: false });
      setEditingAccount(null);
      onClose();
      loadBankAccounts();
    } catch (error: any) {
      toast({ title: error.response?.data?.error || "Failed to save bank account", status: "error", duration: 3000 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (account: any) => {
    setEditingAccount(account);
    setFormData({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      branch: account.branch || "",
      isDefault: account.isDefault,
    });
    onOpen();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bank account?")) return;
    try {
      await bankAccountAPI.delete(id);
      toast({ title: "Bank account deleted successfully", status: "success", duration: 3000 });
      loadBankAccounts();
    } catch (error: any) {
      toast({ title: error.response?.data?.error || "Failed to delete bank account", status: "error", duration: 3000 });
    }
  };

  const openNewModal = () => {
    setEditingAccount(null);
    setFormData({ bankName: "", accountNumber: "", accountName: "", branch: "", isDefault: false });
    onOpen();
  };

  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center" direction="column" gap={4}>
        <Box w="32px" h="32px" borderRadius="full" border="2px solid" borderColor="#3b82f6" borderTopColor="transparent" style={{ animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <Text fontSize="12px" color="#475569" letterSpacing=".08em" textTransform="uppercase">Loading bank accounts</Text>
      </Flex>
    );
  }

  return (
    <Box minH="100vh" color="white" fontFamily="'DM Sans', system-ui, sans-serif">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;600&display=swap');
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
      `}</style>

      {/* ── Top bar ── */}
      <Flex h="48px" borderBottom="1px solid" borderColor="rgba(255,255,255,0.06)" px={6} align="center" justify="space-between" bg="rgba(5,5,18,0.97)" backdropFilter="blur(16px)" position="sticky" top={0} zIndex={200}>
        <HStack spacing={6}>
          <Text fontSize="14px" fontWeight="900" letterSpacing="-0.04em" bgGradient="linear(135deg,#3b82f6,#06b6d4)" bgClip="text" color="transparent">FORTUNI</Text>
          <Box w="1px" h="16px" bg="rgba(255,255,255,0.06)" />
          <Text fontSize="11px" color="#334155" letterSpacing=".04em" fontWeight="600">BANK ACCOUNTS</Text>
        </HStack>
        <HStack spacing={2}>
          <Text fontSize="11px" fontFamily="'DM Mono', monospace" color="#334155">{now.toLocaleTimeString("en-US", { hour12: false })}</Text>
          <Box w="1px" h="14px" bg="rgba(255,255,255,0.06)" />
          <IconButton aria-label="Refresh" icon={<FiRefreshCw />} size="sm" variant="ghost" color="#475569" onClick={loadBankAccounts} _hover={{ color: "white", bg: "rgba(255,255,255,0.04)" }} />
          <Button as={NextLink} href="/dashboard/trade" size="sm" h="28px" px={4} bg="linear-gradient(135deg,#2563eb,#1d4ed8)" color="white" fontSize="11px" fontWeight="700" borderRadius="6px" _hover={{ opacity: 0.9, transform: "translateY(-1px)", boxShadow: "0 4px 16px rgba(37,99,235,0.4)" }} transition="all 0.2s" leftIcon={<FiZap size={11} />}>Trade</Button>
          <Avatar size="xs" name={user?.email} bg="#1d4ed8" />
        </HStack>
      </Flex>

      {/* ── Stats strip ── */}
      <Box borderBottom="1px solid" borderColor="rgba(255,255,255,0.05)" bg={cardBg}>
        <Flex>
          <StatCell label="Total Accounts" value={String(bankAccounts.length)} accent="#3b82f6" />
          <StatCell label="Default Account" value={bankAccounts.find(a => a.isDefault) ? "1" : "0"} accent="#0057b8" />
          <StatCell label="Verified" value={String(bankAccounts.length)} accent="#8b5cf6" />
        </Flex>
      </Box>

      {/* ── Main content ── */}
      <Box p={6} maxW="1200px" mx="auto">
        <Flex justify="space-between" align="center" mb={6}>
          <Box>
            <Text fontSize="10px" color="#334155" letterSpacing=".1em" textTransform="uppercase" mb={1}>Payment Methods</Text>
            <Text fontSize="20px" fontWeight="800" color="white">Bank Accounts</Text>
          </Box>
          <Button onClick={openNewModal} h="36px" px={5} bg="linear-gradient(135deg,#2563eb,#1d4ed8)" color="white" fontSize="13px" fontWeight="700" borderRadius="8px" _hover={{ opacity: 0.92, transform: "translateY(-1px)", boxShadow: "0 8px 24px rgba(37,99,235,0.4)" }} transition="all 0.2s" leftIcon={<FiPlus size={14} />}>Add Account</Button>
        </Flex>

        {bankAccounts.length === 0 ? (
          <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" p={12} textAlign="center">
            <VStack spacing={4}>
              <Box w="48px" h="48px" borderRadius="12px" bg="rgba(59,130,246,0.1)" display="flex" alignItems="center" justifyContent="center" mb={2}>
                <FiCreditCard color="#3b82f6" size={24} />
              </Box>
              <Text fontSize="14px" fontWeight="700" color="white">No bank accounts added yet</Text>
              <Text fontSize="13px" color={textSub}>Add your bank account to enable withdrawals and deposits</Text>
              <Button onClick={openNewModal} h="40px" px={5} bg="rgba(59,130,246,0.15)" color="#3b82f6" fontSize="13px" fontWeight="700" border="1px solid rgba(59,130,246,0.3)" borderRadius="8px" _hover={{ bg: "rgba(59,130,246,0.22)" }} leftIcon={<FiPlus size={14} />}>Add First Account</Button>
            </VStack>
          </Box>
        ) : (
          <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" overflow="hidden">
            {/* Header */}
            <Flex px={4} py={3} bg="rgba(255,255,255,0.015)" borderBottom="1px solid" borderColor="rgba(255,255,255,0.04)">
              {["Bank", "Account Number", "Name", "Branch", "Status", ""].map((h, i) => (
                <Text key={h} fontSize="9px" fontWeight="700" color="#1e293b" letterSpacing=".1em" textTransform="uppercase" flex={i === 0 || i === 2 ? 1 : i === 1 ? "0 0 140px" : i === 5 ? "0 0 100px" : "0 0 80px"}>{h}</Text>
              ))}
            </Flex>
            {/* Rows */}
            {bankAccounts.map((account) => (
              <AccountRow key={account.id} account={account} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </Box>
        )}

        {/* Security notice */}
        <Box mt={6} p={4} bg="rgba(59,130,246,0.06)" border="1px solid rgba(59,130,246,0.15)" borderRadius="10px">
          <Flex gap={3} align="flex-start">
            <Box as={FiCheckCircle} color="#3b82f6" size={16} mt="2px" flexShrink={0} />
            <Box>
              <Text fontSize="12px" fontWeight="700" color="#3b82f6" mb={0.5}>Security Notice</Text>
              <Text fontSize="11px" color={textSub} lineHeight={isAr ? 1.75 : 1.6}>Your bank account information is encrypted and stored securely. We only use this information for processing deposits and withdrawals.</Text>
            </Box>
          </Flex>
        </Box>
      </Box>

      {/* ── Modal ── */}
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay bg="rgba(0,0,0,0.7)" backdropFilter="blur(4px)" />
        <ModalContent bg="#0d0d1f" border="1px solid rgba(255,255,255,0.08)" borderRadius="16px">
          <ModalHeader borderBottom="1px solid rgba(255,255,255,0.05)" pb={4}>
            <Text fontSize="16px" fontWeight="700" color="white">{editingAccount ? "Edit Bank Account" : "Add Bank Account"}</Text>
          </ModalHeader>
          <ModalCloseButton color="#475569" _hover={{ color: "white" }} />
          <ModalBody py={5}>
            <form onSubmit={handleSubmit}>
              <VStack spacing={4} align="stretch">
                <FormControl isRequired>
                  <FormLabel fontSize="11px" color="#475569" letterSpacing=".05em" textTransform="uppercase" mb={1.5}>Bank Name</FormLabel>
                  <Input placeholder="e.g., Chase Bank" value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} bg="rgba(255,255,255,0.03)" border="1px solid rgba(255,255,255,0.07)" color="white" fontSize="13px" borderRadius="8px" h="40px" _hover={{ borderColor: "rgba(255,255,255,0.12)" }} _focus={{ borderColor: "#3b82f6" }} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="11px" color="#475569" letterSpacing=".05em" textTransform="uppercase" mb={1.5}>Account Number</FormLabel>
                  <Input placeholder="Enter your full account number" value={formData.accountNumber} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} bg="rgba(255,255,255,0.03)" border="1px solid rgba(255,255,255,0.07)" color="white" fontSize="13px" borderRadius="8px" h="40px" _hover={{ borderColor: "rgba(255,255,255,0.12)" }} _focus={{ borderColor: "#3b82f6" }} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="11px" color="#475569" letterSpacing=".05em" textTransform="uppercase" mb={1.5}>Account Name</FormLabel>
                  <Input placeholder="Name on the account" value={formData.accountName} onChange={(e) => setFormData({ ...formData, accountName: e.target.value })} bg="rgba(255,255,255,0.03)" border="1px solid rgba(255,255,255,0.07)" color="white" fontSize="13px" borderRadius="8px" h="40px" _hover={{ borderColor: "rgba(255,255,255,0.12)" }} _focus={{ borderColor: "#3b82f6" }} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="11px" color="#475569" letterSpacing=".05em" textTransform="uppercase" mb={1.5}>Branch (Optional)</FormLabel>
                  <Input placeholder="Branch name or location" value={formData.branch} onChange={(e) => setFormData({ ...formData, branch: e.target.value })} bg="rgba(255,255,255,0.03)" border="1px solid rgba(255,255,255,0.07)" color="white" fontSize="13px" borderRadius="8px" h="40px" _hover={{ borderColor: "rgba(255,255,255,0.12)" }} _focus={{ borderColor: "#3b82f6" }} />
                </FormControl>
                <Checkbox isChecked={formData.isDefault} onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })} colorScheme="blue" size="sm">
                  <Text fontSize="12px" color={textSub}>Set as default bank account</Text>
                </Checkbox>
                <HStack spacing={3} pt={2}>
                  <Button type="submit" isLoading={submitting} h="40px" flex={1} bg="linear-gradient(135deg,#2563eb,#1d4ed8)" color="white" fontSize="13px" fontWeight="700" borderRadius="8px" _hover={{ opacity: 0.92 }}>{editingAccount ? "Update" : "Add"} Account</Button>
                  <Button variant="ghost" onClick={onClose} h="40px" flex={1} color={textSub} fontSize="13px" fontWeight="600" _hover={{ bg: "rgba(255,255,255,0.04)" }}>Cancel</Button>
                </HStack>
              </VStack>
            </form>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
