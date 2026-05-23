"use client";

import { useEffect, useState, useCallback } from "react";
import NextLink from "next/link";
import {
  Box, Flex, HStack, VStack, Text, Icon, Spinner, useColorMode,
  Modal, ModalOverlay, ModalContent, ModalCloseButton, ModalBody,
  Input, useToast,
} from "@chakra-ui/react";
import {
  FiChevronLeft, FiChevronRight, FiCheck, FiClock,
  FiCreditCard, FiSmartphone, FiHome, FiZap, FiArrowDownLeft,
  FiAlertTriangle, FiInbox, FiCopy, FiSend,
} from "react-icons/fi";
import { FaApple, FaGooglePlay, FaBitcoin, FaPaypal } from "react-icons/fa";
import { motion } from "framer-motion";
import { depositAPI, walletAPI } from "@/lib/api";

/* ─────────────────────────────────────────────────────────────────
   PALETTE
   ───────────────────────────────────────────────────────────────── */
function pal(dark: boolean) {
  return {
    bg:        dark ? "#000000" : "#ffffff",
    bgElev:    dark ? "#111111" : "#f4f4f4",
    bg2:       dark ? "#0a0a0a" : "#fafafa",
    border:    dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.08)",
    fg:        dark ? "#ffffff" : "#000000",
    fgMuted:   dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.50)",
    fgFaint:   dark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.28)",
    pillBg:    dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    ctaBg:     dark ? "#ffffff" : "#000000",
    ctaFg:     dark ? "#000000" : "#ffffff",
    greenFg:   "#22c55e",
    greenBg:   "rgba(34,197,94,0.14)",
    redFg:     "#ef4444",
    amberFg:   "#f59e0b",
    amberBg:   "rgba(245,158,11,0.14)",
    brand:     "#226dff",
    cardBg:    dark ? "#0d0d0d" : "#f5f5f7",
  };
}

/* ─────────────────────────────────────────────────────────────────
   PAYMENT METHOD CATALOGUE
   ───────────────────────────────────────────────────────────────── */
type MethodId =
  | "BANK_TRANSFER" | "CRYPTO" | "CARD" | "APPLE_PAY" | "GOOGLE_PAY"
  | "REVOLUT" | "SKRILL" | "PAYPAL" | "SEPA" | "ACH";

interface MethodDef {
  id: MethodId;
  label: string;
  desc: string;
  iconKind: "FI" | "FA" | "TXT";
  icon: any;
  brandColor?: string;
  status: "ACTIVE" | "SOON";
  eta: string;
  fees: string;
  minAmount: number;
  currencies: string[];
}

const METHODS: MethodDef[] = [
  {
    id: "BANK_TRANSFER", label: "Bank Transfer", desc: "Wire from your bank account",
    iconKind: "FI", icon: FiHome, brandColor: "#226dff",
    status: "ACTIVE", eta: "1–3 business days", fees: "Free",
    minAmount: 50, currencies: ["USD", "USDT"],
  },
  {
    id: "CRYPTO", label: "Crypto Deposit", desc: "Deposit BTC, ETH, USDT and more on-chain",
    iconKind: "FA", icon: FaBitcoin, brandColor: "#f7931a",
    status: "ACTIVE", eta: "Network confirmations (~10 min)", fees: "Network fee only",
    minAmount: 0, currencies: ["BTC", "ETH", "SOL", "USDT", "BNB", "XRP", "ADA", "DOGE"],
  },
  {
    id: "CARD", label: "Debit / Credit Card", desc: "Visa, Mastercard, AmEx",
    iconKind: "FI", icon: FiCreditCard, brandColor: "#1a73e8",
    status: "SOON", eta: "Instant", fees: "1.99% + $0.30",
    minAmount: 10, currencies: ["USD", "EUR", "GBP"],
  },
  {
    id: "APPLE_PAY", label: "Apple Pay", desc: "One-tap from your iPhone",
    iconKind: "FA", icon: FaApple, brandColor: "#000000",
    status: "SOON", eta: "Instant", fees: "1.5%",
    minAmount: 10, currencies: ["USD", "EUR", "GBP"],
  },
  {
    id: "GOOGLE_PAY", label: "Google Pay", desc: "Instant from your Google wallet",
    iconKind: "FA", icon: FaGooglePlay, brandColor: "#4285f4",
    status: "SOON", eta: "Instant", fees: "1.5%",
    minAmount: 10, currencies: ["USD", "EUR", "GBP"],
  },
  {
    id: "REVOLUT", label: "Revolut", desc: "Direct from Revolut balance",
    iconKind: "TXT", icon: "R", brandColor: "#0075eb",
    status: "SOON", eta: "Instant", fees: "Free",
    minAmount: 10, currencies: ["USD", "EUR", "GBP"],
  },
  {
    id: "SKRILL", label: "Skrill", desc: "Pay with your Skrill account",
    iconKind: "TXT", icon: "S", brandColor: "#7d2fff",
    status: "SOON", eta: "Instant", fees: "1.99%",
    minAmount: 10, currencies: ["USD", "EUR", "GBP"],
  },
  {
    id: "PAYPAL", label: "PayPal", desc: "Pay using your PayPal balance",
    iconKind: "FA", icon: FaPaypal, brandColor: "#003087",
    status: "SOON", eta: "Instant", fees: "2.49%",
    minAmount: 10, currencies: ["USD", "EUR", "GBP"],
  },
  {
    id: "SEPA", label: "SEPA Transfer", desc: "Euro bank transfer (EU)",
    iconKind: "TXT", icon: "€", brandColor: "#003399",
    status: "SOON", eta: "1 business day", fees: "Free",
    minAmount: 10, currencies: ["EUR"],
  },
  {
    id: "ACH", label: "ACH Transfer", desc: "US bank transfer",
    iconKind: "TXT", icon: "$", brandColor: "#1e40af",
    status: "SOON", eta: "2–3 business days", fees: "Free",
    minAmount: 10, currencies: ["USD"],
  },
];

/* ─────────────────────────────────────────────────────────────────
   ICON BLOCK
   ───────────────────────────────────────────────────────────────── */
function MethodIcon({ m, size = 44 }: { m: MethodDef; size?: number }) {
  const bg = m.brandColor ?? "#444";
  if (m.iconKind === "TXT") {
    return (
      <Flex w={`${size}px`} h={`${size}px`} borderRadius="14px" bg={bg}
        align="center" justify="center" flexShrink={0}>
        <Text fontSize={`${Math.round(size * 0.5)}px`} fontWeight="800" color="#fff" lineHeight={1}>
          {m.icon}
        </Text>
      </Flex>
    );
  }
  return (
    <Flex w={`${size}px`} h={`${size}px`} borderRadius="14px" bg={bg}
      align="center" justify="center" flexShrink={0}>
      <Icon as={m.icon} boxSize={`${Math.round(size * 0.46)}px`} color="#fff" />
    </Flex>
  );
}

/* ─────────────────────────────────────────────────────────────────
   METHOD ROW
   ───────────────────────────────────────────────────────────────── */
function MethodRow({ m, onPick, p }: { m: MethodDef; onPick: () => void; p: ReturnType<typeof pal> }) {
  return (
    <Box
      as="button"
      onClick={onPick}
      w="full" textAlign="left"
      px={5} py={4} display="flex" alignItems="center" gap={4}
      borderBottom={`1px solid ${p.border}`}
      _hover={{ bg: p.bg2 }} transition="background 0.12s"
      _last={{ borderBottom: "none" }}
    >
      <MethodIcon m={m} size={44} />
      <VStack align="start" spacing={0.5} flex={1} minW={0}>
        <HStack spacing={2} align="center">
          <Text fontSize="14px" fontWeight="700" color={p.fg}>{m.label}</Text>
          {m.status === "ACTIVE"
            ? <Box px={1.5} py={0.5} borderRadius="5px" bg={p.greenBg}>
                <Text fontSize="9px" fontWeight="800" color={p.greenFg} letterSpacing="0.06em">LIVE</Text>
              </Box>
            : <Box px={1.5} py={0.5} borderRadius="5px" bg={p.amberBg}>
                <Text fontSize="9px" fontWeight="800" color={p.amberFg} letterSpacing="0.06em">SOON</Text>
              </Box>
          }
        </HStack>
        <Text fontSize="12px" color={p.fgMuted} fontWeight="500" noOfLines={1}>{m.desc}</Text>
        <HStack spacing={3} mt={1}>
          <HStack spacing={1}>
            <Icon as={FiClock} boxSize={3} color={p.fgFaint} />
            <Text fontSize="10.5px" color={p.fgFaint} fontWeight="600">{m.eta}</Text>
          </HStack>
          <Text fontSize="10.5px" color={p.fgFaint} fontWeight="600">·</Text>
          <Text fontSize="10.5px" color={p.fgFaint} fontWeight="600">Fee: {m.fees}</Text>
        </HStack>
      </VStack>
      <Icon as={FiChevronRight} boxSize={4} color={p.fgFaint} flexShrink={0} />
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────────
   BANK TRANSFER FORM
   ───────────────────────────────────────────────────────────────── */
function BankTransferForm({ onClose, p, toast }: {
  onClose: () => void; p: ReturnType<typeof pal>; toast: ReturnType<typeof useToast>;
}) {
  const [currency, setCurrency] = useState<"USD" | "USDT">("USD");
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [senderName, setSenderName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ reference: string; amount: number; currency: string } | null>(null);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) {
      toast({ title: "Enter a valid amount", status: "error", duration: 2500 });
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("currency", currency);
      fd.append("amount", amount);
      fd.append("paymentMethod", "BANK_TRANSFER");
      if (bankName)      fd.append("bankName", bankName);
      if (accountNumber) fd.append("accountNumber", accountNumber);
      if (senderName)    fd.append("senderName", senderName);
      if (notes)         fd.append("notes", notes);
      const res = await depositAPI.create(fd);
      setSuccess({
        reference: res.data?.deposit?.reference ?? res.data?.reference ?? "—",
        amount: Number(amount), currency,
      });
    } catch (e: any) {
      toast({ title: e?.response?.data?.message ?? "Deposit failed", status: "error", duration: 3500 });
    } finally { setLoading(false); }
  };

  if (success) return (
    <VStack spacing={4} align="stretch">
      <Flex w="56px" h="56px" mx="auto" borderRadius="full" bg={p.greenBg}
        align="center" justify="center">
        <Icon as={FiCheck} boxSize={6} color={p.greenFg} />
      </Flex>
      <Text fontSize="20px" fontWeight="800" color={p.fg} textAlign="center" letterSpacing="-0.3px">
        Deposit submitted
      </Text>
      <Text fontSize="13px" color={p.fgMuted} textAlign="center">
        Your {success.amount} {success.currency} deposit is pending. We'll notify you once it's confirmed.
      </Text>
      <Box bg={p.bgElev} border={`1px solid ${p.border}`} borderRadius="12px" px={4} py={3}>
        <Text fontSize="10px" fontWeight="700" color={p.fgFaint} letterSpacing="0.08em" textTransform="uppercase" mb={1}>
          Reference
        </Text>
        <Text fontSize="13px" fontWeight="700" color={p.fg} fontFamily="monospace">{success.reference}</Text>
      </Box>
      <Box as="button" onClick={onClose} h="44px" borderRadius="full"
        bg={p.ctaBg} color={p.ctaFg} fontSize="14px" fontWeight="800"
        _hover={{ opacity: 0.85 }}>
        Done
      </Box>
    </VStack>
  );

  return (
    <VStack spacing={4} align="stretch">
      {/* Currency picker */}
      <Box>
        <Text fontSize="10.5px" fontWeight="700" color={p.fgFaint} letterSpacing="0.07em" textTransform="uppercase" mb={2}>Currency</Text>
        <HStack spacing={2}>
          {(["USD", "USDT"] as const).map(c => (
            <Box key={c} as="button" onClick={() => setCurrency(c)}
              flex={1} h="42px" borderRadius="12px"
              bg={currency === c ? p.ctaBg : p.pillBg}
              color={currency === c ? p.ctaFg : p.fg}
              border={`1px solid ${currency === c ? "transparent" : p.border}`}
              fontSize="13px" fontWeight="700"
              _hover={{ opacity: 0.85 }}>
              {c}
            </Box>
          ))}
        </HStack>
      </Box>

      {/* Amount */}
      <Box>
        <Text fontSize="10.5px" fontWeight="700" color={p.fgFaint} letterSpacing="0.07em" textTransform="uppercase" mb={2}>Amount</Text>
        <Input value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="0.00" type="number" step="any"
          bg={p.bgElev} border={`1px solid ${p.border}`} borderRadius="12px"
          color={p.fg} _placeholder={{ color: p.fgFaint }}
          fontSize="14px" h="44px" px={4}
          _focus={{ borderColor: p.brand, boxShadow: "none" }} />
      </Box>

      {/* Bank details */}
      <Box>
        <Text fontSize="10.5px" fontWeight="700" color={p.fgFaint} letterSpacing="0.07em" textTransform="uppercase" mb={2}>Sender bank (optional)</Text>
        <Input value={bankName} onChange={e => setBankName(e.target.value)}
          placeholder="Bank name"
          bg={p.bgElev} border={`1px solid ${p.border}`} borderRadius="12px"
          color={p.fg} _placeholder={{ color: p.fgFaint }}
          fontSize="14px" h="44px" px={4} mb={2}
          _focus={{ borderColor: p.brand, boxShadow: "none" }} />
        <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)}
          placeholder="Account / IBAN"
          bg={p.bgElev} border={`1px solid ${p.border}`} borderRadius="12px"
          color={p.fg} _placeholder={{ color: p.fgFaint }}
          fontSize="14px" h="44px" px={4} mb={2}
          _focus={{ borderColor: p.brand, boxShadow: "none" }} />
        <Input value={senderName} onChange={e => setSenderName(e.target.value)}
          placeholder="Sender name (must match account holder)"
          bg={p.bgElev} border={`1px solid ${p.border}`} borderRadius="12px"
          color={p.fg} _placeholder={{ color: p.fgFaint }}
          fontSize="14px" h="44px" px={4}
          _focus={{ borderColor: p.brand, boxShadow: "none" }} />
      </Box>

      {/* Notes */}
      <Box>
        <Text fontSize="10.5px" fontWeight="700" color={p.fgFaint} letterSpacing="0.07em" textTransform="uppercase" mb={2}>Notes (optional)</Text>
        <Input value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Reference for our team"
          bg={p.bgElev} border={`1px solid ${p.border}`} borderRadius="12px"
          color={p.fg} _placeholder={{ color: p.fgFaint }}
          fontSize="14px" h="44px" px={4}
          _focus={{ borderColor: p.brand, boxShadow: "none" }} />
      </Box>

      {/* Notice */}
      <Flex bg={p.amberBg} borderRadius="12px" px={4} py={3} gap={3} align="start">
        <Icon as={FiAlertTriangle} boxSize={4} color={p.amberFg} mt={0.5} flexShrink={0} />
        <Text fontSize="11.5px" color={p.fg} fontWeight="500" lineHeight="1.45">
          Send the wire to the platform's bank details (provided after submission). Your deposit will be credited
          once our team confirms the transfer.
        </Text>
      </Flex>

      <Box as="button" onClick={submit}
        h="48px" borderRadius="full"
        bg={loading ? p.pillBg : p.ctaBg}
        color={loading ? p.fgMuted : p.ctaFg}
        fontSize="14px" fontWeight="800"
        display="flex" alignItems="center" justifyContent="center"
        _hover={{ opacity: 0.85 }} transition="all 0.15s"
        {...(loading ? { disabled: true } : {})}>
        {loading ? <Spinner size="sm" /> : "Submit deposit"}
      </Box>
    </VStack>
  );
}

/* ─────────────────────────────────────────────────────────────────
   COMING SOON PANEL
   ───────────────────────────────────────────────────────────────── */
function ComingSoonPanel({ m, onClose, p, toast }: {
  m: MethodDef; onClose: () => void; p: ReturnType<typeof pal>; toast: ReturnType<typeof useToast>;
}) {
  const [email, setEmail] = useState("");
  const [signed, setSigned] = useState(false);
  return (
    <VStack spacing={4} align="stretch">
      <MethodIcon m={m} size={64} />
      <Text fontSize="20px" fontWeight="800" color={p.fg} letterSpacing="-0.3px">
        {m.label} — coming soon
      </Text>
      <Text fontSize="13px" color={p.fgMuted}>
        {m.label} support is in active development. Get notified when it goes live.
      </Text>
      <Box bg={p.bgElev} border={`1px solid ${p.border}`} borderRadius="14px" p={4}>
        <HStack spacing={3} align="start">
          <Icon as={FiClock} boxSize={4} color={p.fgMuted} mt={0.5} />
          <VStack align="start" spacing={0.5} flex={1}>
            <Text fontSize="11px" fontWeight="700" color={p.fgFaint} letterSpacing="0.07em" textTransform="uppercase">Expected processing</Text>
            <Text fontSize="13px" fontWeight="700" color={p.fg}>{m.eta}</Text>
          </VStack>
        </HStack>
      </Box>
      <Box bg={p.bgElev} border={`1px solid ${p.border}`} borderRadius="14px" p={4}>
        <HStack spacing={3} align="start">
          <Icon as={FiZap} boxSize={4} color={p.fgMuted} mt={0.5} />
          <VStack align="start" spacing={0.5} flex={1}>
            <Text fontSize="11px" fontWeight="700" color={p.fgFaint} letterSpacing="0.07em" textTransform="uppercase">Fees</Text>
            <Text fontSize="13px" fontWeight="700" color={p.fg}>{m.fees}</Text>
          </VStack>
        </HStack>
      </Box>

      {!signed ? (
        <>
          <Input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Notify me at email@example.com" type="email"
            bg={p.bgElev} border={`1px solid ${p.border}`} borderRadius="12px"
            color={p.fg} _placeholder={{ color: p.fgFaint }}
            fontSize="14px" h="44px" px={4}
            _focus={{ borderColor: p.brand, boxShadow: "none" }} />
          <Box as="button"
            onClick={() => {
              if (!email.includes("@")) { toast({ title: "Enter a valid email", status: "error", duration: 2000 }); return; }
              setSigned(true);
              toast({ title: "We'll let you know!", status: "success", duration: 2500 });
            }}
            h="48px" borderRadius="full" bg={p.ctaBg} color={p.ctaFg}
            fontSize="14px" fontWeight="800" _hover={{ opacity: 0.85 }}>
            Notify me when ready
          </Box>
        </>
      ) : (
        <Flex bg={p.greenBg} borderRadius="12px" px={4} py={3} gap={3} align="center">
          <Icon as={FiCheck} boxSize={4} color={p.greenFg} />
          <Text fontSize="13px" color={p.fg} fontWeight="600">You're on the waitlist for {m.label}.</Text>
        </Flex>
      )}
    </VStack>
  );
}

/* ─────────────────────────────────────────────────────────────────
   CRYPTO METHOD: pick coin → route to /asset/[currency]
   ───────────────────────────────────────────────────────────────── */
function CryptoPickerPanel({ p }: { p: ReturnType<typeof pal> }) {
  const COINS = [
    { sym: "BTC",  title: "Bitcoin",  glyph: "₿", bg: "#f7931a" },
    { sym: "ETH",  title: "Ethereum", glyph: "Ξ", bg: "#627eea" },
    { sym: "USDT", title: "Tether",   glyph: "₮", bg: "#26a17b" },
    { sym: "SOL",  title: "Solana",   glyph: "◎", bg: "#9945ff" },
    { sym: "BNB",  title: "BNB",      glyph: "⬡", bg: "#f3ba2f" },
    { sym: "XRP",  title: "XRP",      glyph: "✕", bg: "#23292f" },
    { sym: "ADA",  title: "Cardano",  glyph: "₳", bg: "#0033ad" },
    { sym: "DOGE", title: "Dogecoin", glyph: "Ð", bg: "#c3a634" },
  ];
  return (
    <VStack spacing={2} align="stretch">
      <Text fontSize="13px" color={p.fgMuted} mb={2}>
        Select an asset to view your deposit address and QR code.
      </Text>
      {COINS.map(c => (
        <Box key={c.sym} as={NextLink} href={`/asset/${c.sym}`}
          display="flex" alignItems="center" gap={3}
          px={4} py={3} borderRadius="14px"
          bg={p.bgElev} border={`1px solid ${p.border}`}
          _hover={{ bg: p.pillBg }} transition="background 0.12s">
          <Flex w="38px" h="38px" borderRadius="full" bg={c.bg} align="center" justify="center">
            <Text fontSize="16px" fontWeight="700" color={c.bg === "#f3ba2f" ? "#000" : "#fff"}>{c.glyph}</Text>
          </Flex>
          <VStack align="start" spacing={0} flex={1}>
            <Text fontSize="14px" fontWeight="700" color={p.fg}>{c.title}</Text>
            <Text fontSize="11px" color={p.fgMuted} fontWeight="500">{c.sym}</Text>
          </VStack>
          <Icon as={FiChevronRight} boxSize={4} color={p.fgFaint} />
        </Box>
      ))}
    </VStack>
  );
}

/* ─────────────────────────────────────────────────────────────────
   RECENT DEPOSITS LIST
   ───────────────────────────────────────────────────────────────── */
function RecentDeposits({ p }: { p: ReturnType<typeof pal> }) {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => {
    depositAPI.getAll(1).then(r => setItems(r.data?.deposits ?? r.data?.data ?? [])).catch(() => setItems([]));
  }, []);
  if (items === null) return <Spinner size="sm" color={p.fgMuted} />;
  if (items.length === 0) return (
    <VStack py={8} spacing={2}>
      <Icon as={FiInbox} boxSize={6} color={p.fgFaint} />
      <Text fontSize="13px" color={p.fgMuted}>No deposits yet.</Text>
    </VStack>
  );
  return (
    <VStack spacing={0} align="stretch">
      {items.slice(0, 6).map((d, i) => {
        const status = d.status as string;
        const sCol =
          status === "CONFIRMED" || status === "COMPLETED" ? p.greenFg :
          status === "REJECTED" || status === "CANCELLED"  ? p.redFg   : p.amberFg;
        const sBg =
          status === "CONFIRMED" || status === "COMPLETED" ? p.greenBg :
          status === "REJECTED" || status === "CANCELLED"  ? "rgba(239,68,68,0.14)" : p.amberBg;
        return (
          <HStack key={d.id ?? i} px={5} py={3.5} spacing={3}
            borderTop={i === 0 ? "none" : `1px solid ${p.border}`}>
            <Flex w="34px" h="34px" borderRadius="full" bg={p.pillBg}
              border={`1px solid ${p.border}`} align="center" justify="center">
              <Icon as={FiArrowDownLeft} boxSize={3.5} color={p.fg} />
            </Flex>
            <VStack align="start" spacing={0} flex={1} minW={0}>
              <Text fontSize="13px" fontWeight="700" color={p.fg} noOfLines={1}>
                {d.amount} {d.currency} · {d.paymentMethod ?? "BANK"}
              </Text>
              <Text fontSize="11px" color={p.fgMuted} fontWeight="500" mt={0.5}>
                {new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · Ref {d.reference ?? d.id?.slice(0, 8)}
              </Text>
            </VStack>
            <Box px={2} py={1} borderRadius="6px" bg={sBg}>
              <Text fontSize="10px" fontWeight="800" color={sCol} letterSpacing="0.06em">{status}</Text>
            </Box>
          </HStack>
        );
      })}
    </VStack>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────────────────────────────── */
export default function DepositPage() {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const p    = pal(dark);
  const toast = useToast();
  const [active, setActive] = useState<MethodDef | null>(null);

  return (
    <Box bg={p.bg} minH="100vh" pb={16}>
      <Box maxW="720px" mx="auto" px={{ base: 5, lg: 6 }} pt={6}>

        {/* Header */}
        <HStack spacing={3} mb={6}>
          <Flex as={NextLink} href="/"
            w="38px" h="38px" borderRadius="full"
            bg={p.pillBg} border={`1px solid ${p.border}`}
            align="center" justify="center"
            _hover={{ bg: p.bgElev }} transition="background 0.12s">
            <Icon as={FiChevronLeft} boxSize={4} color={p.fg} />
          </Flex>
          <Text fontSize="22px" fontWeight="800" color={p.fg} letterSpacing="-0.3px">
            Deposit
          </Text>
        </HStack>

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Methods card */}
          <Box bg={p.cardBg} border={`1px solid ${p.border}`} borderRadius="20px" overflow="hidden" mb={5}>
            <Text px={5} pt={4} pb={3} fontSize="10.5px" fontWeight="700"
              color={p.fgFaint} letterSpacing="0.08em" textTransform="uppercase">
              Choose a method
            </Text>
            {METHODS.map(m => (
              <MethodRow key={m.id} m={m} onPick={() => setActive(m)} p={p} />
            ))}
          </Box>

          {/* Recent deposits */}
          <Box bg={p.cardBg} border={`1px solid ${p.border}`} borderRadius="20px" overflow="hidden">
            <Text px={5} pt={4} pb={3} fontSize="10.5px" fontWeight="700"
              color={p.fgFaint} letterSpacing="0.08em" textTransform="uppercase">
              Recent Deposits
            </Text>
            <RecentDeposits p={p} />
          </Box>
        </motion.div>
      </Box>

      {/* Method modal */}
      <Modal isOpen={!!active} onClose={() => setActive(null)} isCentered size="md" scrollBehavior="inside">
        <ModalOverlay backdropFilter="blur(8px)" bg="rgba(0,0,0,0.6)" />
        <ModalContent bg={p.bg} border={`1px solid ${p.border}`} borderRadius="24px" mx={4}>
          <ModalCloseButton color={p.fgMuted} top={4} right={4} />
          <ModalBody p={6}>
            {active && (
              <>
                {/* Header */}
                {active.id !== "BANK_TRANSFER" && active.id !== "CRYPTO" && active.status === "ACTIVE" && (
                  <HStack spacing={3} mb={5}>
                    <MethodIcon m={active} size={44} />
                    <VStack align="start" spacing={0}>
                      <Text fontSize="16px" fontWeight="800" color={p.fg}>{active.label}</Text>
                      <Text fontSize="12px" color={p.fgMuted} fontWeight="500">{active.desc}</Text>
                    </VStack>
                  </HStack>
                )}

                {active.id === "BANK_TRANSFER" && (
                  <>
                    <HStack spacing={3} mb={5}>
                      <MethodIcon m={active} size={44} />
                      <VStack align="start" spacing={0}>
                        <Text fontSize="16px" fontWeight="800" color={p.fg}>{active.label}</Text>
                        <Text fontSize="12px" color={p.fgMuted} fontWeight="500">{active.desc}</Text>
                      </VStack>
                    </HStack>
                    <BankTransferForm onClose={() => setActive(null)} p={p} toast={toast} />
                  </>
                )}

                {active.id === "CRYPTO" && (
                  <>
                    <HStack spacing={3} mb={5}>
                      <MethodIcon m={active} size={44} />
                      <VStack align="start" spacing={0}>
                        <Text fontSize="16px" fontWeight="800" color={p.fg}>{active.label}</Text>
                        <Text fontSize="12px" color={p.fgMuted} fontWeight="500">{active.desc}</Text>
                      </VStack>
                    </HStack>
                    <CryptoPickerPanel p={p} />
                  </>
                )}

                {active.status === "SOON" && (
                  <ComingSoonPanel m={active} onClose={() => setActive(null)} p={p} toast={toast} />
                )}
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
