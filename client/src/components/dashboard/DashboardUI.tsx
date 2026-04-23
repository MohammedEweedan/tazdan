"use client";

/**
 * Shared design-system primitives for the dashboard.
 * Gives every page the same spacing rhythm, glass cards, headers,
 * section titles, and stat tiles so the product reads as one piece.
 */

import { Box, Flex, HStack, VStack, Text, Icon, useColorMode, Badge } from "@chakra-ui/react";
import { ReactNode } from "react";
import { IconType } from "react-icons";

/* ── Palette helpers ─────────────────────────────────────────── */
export function useDashboardTokens() {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  return {
    dark,
    brand: "#0057b8",
    brandLight: "#4a8fe0",
    pageBg: dark ? "#060a18" : "#f4f7fb",
    panelBg: dark ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.96)",
    panelBorder: dark ? "rgba(255,255,255,0.06)" : "rgba(0,87,184,0.08)",
    panelInner: dark ? "rgba(255,255,255,0.02)" : "rgba(0,87,184,0.03)",
    divider: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
    textMain: dark ? "#f1f5f9" : "#0f172a",
    textSub: dark ? "#94a3b8" : "#64748b",
    textMuted: dark ? "#475569" : "#94a3b8",
    hover: dark ? "rgba(255,255,255,0.04)" : "rgba(0,87,184,0.04)",
    success: "#22c55e",
    danger: "#ef4444",
    warning: "#f59e0b",
  };
}

/* ── Page shell ──────────────────────────────────────────────── */
export function PageShell({ children, maxW = "1440px" }: { children: ReactNode; maxW?: string }) {
  const t = useDashboardTokens();
  return (
    <Box minH="calc(100vh - 60px)" bg={t.pageBg} px={{ base: 3, md: 5, lg: 6 }} py={{ base: 4, md: 6 }}>
      <Box maxW={maxW} mx="auto">{children}</Box>
    </Box>
  );
}

/* ── Page header (title + subtitle + optional actions) ───────── */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const t = useDashboardTokens();
  return (
    <Flex direction={{ base: "column", md: "row" }} justify="space-between" align={{ base: "flex-start", md: "center" }} gap={3} mb={5}>
      <Box>
        {eyebrow && (
          <Text fontSize="10.5px" fontWeight="800" color={t.brand} letterSpacing=".14em" textTransform="uppercase" mb={1}>
            {eyebrow}
          </Text>
        )}
        <Text fontSize={{ base: "22px", md: "28px" }} fontWeight="900" color={t.textMain} letterSpacing="-0.025em" lineHeight="1.1">
          {title}
        </Text>
        {subtitle && (
          <Text fontSize="13.5px" color={t.textSub} mt={1} maxW="640px">
            {subtitle}
          </Text>
        )}
      </Box>
      {right && <Box>{right}</Box>}
    </Flex>
  );
}

/* ── Glass panel (the primary surface) ───────────────────────── */
export function GlassCard({
  children,
  p,
  hover = false,
  inner = false,
  borderColor,
  ...rest
}: {
  children: ReactNode;
  p?: any;
  hover?: boolean;
  inner?: boolean;
  borderColor?: string;
  [k: string]: any;
}) {
  const t = useDashboardTokens();
  return (
    <Box
      bg={inner ? t.panelInner : t.panelBg}
      border="1px solid"
      borderColor={borderColor ?? t.panelBorder}
      borderRadius="16px"
      p={p ?? 4}
      backdropFilter="blur(14px)"
      boxShadow={t.dark ? "0 10px 30px rgba(0,0,0,0.25)" : "0 6px 20px rgba(0,87,184,0.05)"}
      transition="all 0.2s cubic-bezier(0.2,0.8,0.2,1)"
      _hover={hover ? { borderColor: t.brand, transform: "translateY(-1px)", boxShadow: `0 14px 40px ${t.dark ? "rgba(0,87,184,0.2)" : "rgba(0,87,184,0.1)"}` } : undefined}
      {...rest}
    >
      {children}
    </Box>
  );
}

/* ── Section header (above a card grid or table) ─────────────── */
export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const t = useDashboardTokens();
  return (
    <Flex justify="space-between" align="center" mb={3}>
      <Box>
        <Text fontSize="14px" fontWeight="800" color={t.textMain} letterSpacing="-0.01em">
          {title}
        </Text>
        {subtitle && (
          <Text fontSize="11.5px" color={t.textSub} mt={0.5}>
            {subtitle}
          </Text>
        )}
      </Box>
      {right}
    </Flex>
  );
}

/* ── Stat tile (compact KPI) ─────────────────────────────────── */
export function StatTile({
  label,
  value,
  hint,
  icon,
  accent,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: IconType;
  accent?: string;
  delta?: { value: string; positive?: boolean };
}) {
  const t = useDashboardTokens();
  const accentColor = accent ?? t.brand;
  return (
    <GlassCard p={4} hover>
      <HStack justify="space-between" align="flex-start" mb={2}>
        <Text fontSize="10.5px" fontWeight="700" color={t.textMuted} letterSpacing=".1em" textTransform="uppercase">
          {label}
        </Text>
        {icon && (
          <Flex
            w="28px"
            h="28px"
            borderRadius="8px"
            bg={`${accentColor}15`}
            color={accentColor}
            align="center"
            justify="center"
          >
            <Icon as={icon} boxSize={3.5} />
          </Flex>
        )}
      </HStack>
      <Text fontSize={{ base: "20px", md: "24px" }} fontWeight="900" color={t.textMain} letterSpacing="-0.025em" lineHeight="1.1" fontFamily="'DM Sans', sans-serif">
        {value}
      </Text>
      <HStack spacing={2} mt={1.5}>
        {delta && (
          <Badge
            bg={delta.positive ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"}
            color={delta.positive ? t.success : t.danger}
            fontSize="10px"
            fontWeight="800"
            px={2}
            py={0.5}
            borderRadius="full"
          >
            {delta.positive ? "▲" : "▼"} {delta.value}
          </Badge>
        )}
        {hint && (
          <Text fontSize="11px" color={t.textMuted}>
            {hint}
          </Text>
        )}
      </HStack>
    </GlassCard>
  );
}

/* ── Data row (for lists of orders, transactions, etc.) ──────── */
export function DataRow({
  left,
  middle,
  right,
  hover = true,
  onClick,
}: {
  left: ReactNode;
  middle?: ReactNode;
  right: ReactNode;
  hover?: boolean;
  onClick?: () => void;
}) {
  const t = useDashboardTokens();
  return (
    <Flex
      align="center"
      gap={3}
      px={3}
      py={2.5}
      borderRadius="10px"
      cursor={onClick ? "pointer" : "default"}
      _hover={hover ? { bg: t.hover } : undefined}
      transition="background 0.15s"
      onClick={onClick}
    >
      <Box minW={0} flex="0 0 auto">{left}</Box>
      {middle !== undefined && <Box flex={1} minW={0}>{middle}</Box>}
      <Box flex="0 0 auto" textAlign="end">{right}</Box>
    </Flex>
  );
}

/* ── Pair icon (letter avatar tinted by colour) ──────────────── */
export function PairAvatar({ symbol, color = "#f7931a", size = 32 }: { symbol: string; color?: string; size?: number }) {
  return (
    <Flex
      w={`${size}px`}
      h={`${size}px`}
      borderRadius="full"
      bg={`${color}22`}
      border="1px solid"
      borderColor={`${color}55`}
      align="center"
      justify="center"
      flexShrink={0}
    >
      <Text fontSize={`${Math.round(size * 0.4)}px`} fontWeight="900" color={color}>
        {symbol.charAt(0).toUpperCase()}
      </Text>
    </Flex>
  );
}

/* ── Coin colour map (used across pages so BTC is always orange) ─ */
export const COIN_COLOR: Record<string, string> = {
  USDT: "#26a17b",
  USDC: "#2775ca",
  BTC: "#f7931a",
  ETH: "#627eea",
  BNB: "#f3ba2f",
  SOL: "#14f195",
  XRP: "#00aae4",
  ADA: "#0033ad",
  DOGE: "#cba44b",
  MATIC: "#8247e5",
  DOT: "#e6007a",
  AVAX: "#e84142",
  USD: "#22c55e",
};

/* ── Tiny loading spinner ────────────────────────────────────── */
export function PageSpinner({ label = "Loading" }: { label?: string }) {
  const t = useDashboardTokens();
  return (
    <Flex minH="40vh" direction="column" align="center" justify="center" gap={3}>
      <Box
        w="28px"
        h="28px"
        borderRadius="full"
        border="2px solid"
        borderColor={t.brand}
        borderTopColor="transparent"
        style={{ animation: "spin 0.8s linear infinite" }}
      />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Text fontSize="11px" color={t.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800">
        {label}
      </Text>
    </Flex>
  );
}

/* ── Sparkline (tiny SVG; deterministic mock if no data) ─────── */
export function Sparkline({ points, up, w = 80, h = 24 }: { points?: number[]; up: boolean; w?: number; h?: number }) {
  const data = points ?? genMockSeries();
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const dx = w / (data.length - 1);
  const path = data
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * dx).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  const color = up ? "#22c55e" : "#ef4444";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={`sg-${up ? "u" : "d"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${w},${h} L0,${h} Z`} fill={`url(#sg-${up ? "u" : "d"})`} />
      <path d={path} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function genMockSeries(n = 24): number[] {
  // Deterministic pseudo-random so the sparkline doesn't flicker on re-render
  let x = 0.5;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    x = (x * 9301 + 49297) % 233280;
    out.push((x / 233280) * 100);
  }
  return out;
}

/* ── Two-column responsive grid helper ───────────────────────── */
export function TwoCol({ left, right, leftSpan = "2fr", rightSpan = "1fr", gap = 4 }: { left: ReactNode; right: ReactNode; leftSpan?: string; rightSpan?: string; gap?: number }) {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: "1fr", lg: `${leftSpan} ${rightSpan}` }}
      gap={gap}
    >
      {left}
      {right}
    </Box>
  );
}

/* ── Simple pill tab bar ─────────────────────────────────────── */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const t = useDashboardTokens();
  return (
    <HStack spacing={1} p={1} bg={t.panelInner} border="1px solid" borderColor={t.panelBorder} borderRadius="12px">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Box
            as="button"
            key={o.value}
            onClick={() => onChange(o.value)}
            px={3}
            py={1.5}
            borderRadius="9px"
            fontSize="12px"
            fontWeight="800"
            bg={active ? (t.dark ? "rgba(255,255,255,0.08)" : "white") : "transparent"}
            color={active ? t.brand : t.textSub}
            boxShadow={active ? (t.dark ? "0 2px 10px rgba(0,87,184,0.15)" : "0 2px 8px rgba(0,87,184,0.08)") : "none"}
            transition="all 0.15s"
            _hover={{ color: t.textMain }}
          >
            {o.label}
          </Box>
        );
      })}
    </HStack>
  );
}

/* ── Vertical separator ──────────────────────────────────────── */
export function VDiv() {
  const t = useDashboardTokens();
  return <Box w="1px" alignSelf="stretch" bg={t.divider} />;
}

/* ── Horizontal separator ───────────────────────────────────── */
export function HDiv({ my = 3 }: { my?: any }) {
  const t = useDashboardTokens();
  return <Box h="1px" w="100%" bg={t.divider} my={my} />;
}

/* ── Empty state ─────────────────────────────────────────────── */
export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: IconType }) {
  const t = useDashboardTokens();
  return (
    <VStack spacing={3} py={10} textAlign="center">
      {icon && (
        <Flex w="44px" h="44px" borderRadius="full" bg={`${t.brand}14`} align="center" justify="center">
          <Icon as={icon} color={t.brand} boxSize={5} />
        </Flex>
      )}
      <Text fontSize="14px" fontWeight="800" color={t.textMain}>{title}</Text>
      {hint && <Text fontSize="12px" color={t.textSub} maxW="320px">{hint}</Text>}
    </VStack>
  );
}
