"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import NextLink from "next/link";
import {
  Box, Flex, Text, Icon, Center, useColorMode, Avatar, HStack, VStack,
  Menu, MenuButton, MenuList, MenuItem, MenuDivider,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiHome, FiRepeat, FiCreditCard, FiSettings, FiInbox,
  FiArrowDownCircle, FiArrowUpCircle, FiShield,
  FiLogOut, FiChevronLeft, FiChevronRight, FiShoppingBag, FiUser,
  FiMessageSquare, FiBarChart2, FiGift, FiPieChart, FiLock, FiSend,
} from "react-icons/fi";
import { useAuthStore } from "@/stores/authStore";
import { TextLogo, IconLogo } from "@/components/ui/Logo";
import ColorModeToggle from "@/components/ui/ColorModeToggle";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

const SIDEBAR_W = 240;
const SIDEBAR_COLLAPSED_W = 68;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslate();
  const { isAuthenticated, isLoading, fetchUser, user, logout } = useAuthStore();
  const { colorMode } = useColorMode();
  const [collapsed, setCollapsed] = useState(false);

  const dk = colorMode === "dark";
  const brand = "#0057b8";
  const sidebarBg = dk ? "#080c1c" : "#ffffff";
  const sidebarBorder = dk ? "rgba(255,255,255,0.06)" : "rgba(0,87,184,0.08)";
  const contentBg = dk ? "#060a18" : "#f4f7fb";
  const mobileNavBg = dk ? "rgba(8,12,28,0.97)" : "rgba(255,255,255,0.97)";
  const textPrimary = dk ? "#f1f5f9" : "#0f172a";
  const textSecondary = dk ? "#64748b" : "#64748b";
  const textMuted = dk ? "#334155" : "#94a3b8";
  const hoverBg = dk ? "rgba(255,255,255,0.04)" : "rgba(0,87,184,0.04)";
  const activeBg = dk ? "rgba(0,87,184,0.12)" : "rgba(0,87,184,0.08)";

  useEffect(() => { fetchUser(); }, [fetchUser]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
    if (!isLoading && isAuthenticated && user?.role === "ADMIN") router.push("/admin");
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <Center minH="100vh" bg={contentBg}>
        <Flex direction="column" align="center" gap={4}>
          <Box w="32px" h="32px" borderRadius="full" border="2px solid" borderColor={brand} borderTopColor="transparent" style={{ animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <Text fontSize="12px" color={textMuted} letterSpacing=".08em" textTransform="uppercase">Loading</Text>
        </Flex>
      </Center>
    );
  }

  if (!isAuthenticated) return null;

  const isAgent = user?.role === "AGENT";
  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase() || "U";
  const userEmoji = (user as any)?.avatarUrl;

  type NavSection = { title?: string; items: { href: string; icon: any; label: string; badge?: string }[] };

  const navSections: NavSection[] = isAgent
    ? [
        {
          title: "Menu",
          items: [
            { href: "/dashboard", icon: FiHome, label: t("nav_home") },
            { href: "/dashboard/agent-panel", icon: FiInbox, label: t("nav_queue") },
            { href: "/dashboard/trade", icon: FiRepeat, label: t("nav_trade") },
          ],
        },
        {
          title: "Finance",
          items: [
            { href: "/dashboard/wallet", icon: FiCreditCard, label: t("nav_wallet") },
            { href: "/dashboard/deposit", icon: FiArrowDownCircle, label: t("nav_deposit") },
            { href: "/dashboard/withdraw", icon: FiArrowUpCircle, label: t("nav_withdraw") },
          ],
        },
        {
          title: "Account",
          items: [
            { href: "/dashboard/profile", icon: FiUser, label: "My Profile" },
            { href: "/dashboard/settings", icon: FiSettings, label: t("nav_settings") },
          ],
        },
      ]
    : [
        {
          title: "Trade",
          items: [
            { href: "/dashboard", icon: FiHome, label: t("nav_home") },
            { href: "/dashboard/trade", icon: FiRepeat, label: t("nav_trade") },
            { href: "/markets", icon: FiBarChart2, label: t("nav_markets") },
            { href: "/dashboard/p2p", icon: FiShoppingBag, label: "P2P Market" },
            { href: "/dashboard/portfolio", icon: FiPieChart, label: "Portfolio" },
          ],
        },
        {
          title: "Money",
          items: [
            { href: "/dashboard/wallet", icon: FiCreditCard, label: t("nav_wallet") },
            { href: "/dashboard/send", icon: FiSend, label: "Send" },
            { href: "/dashboard/cards", icon: FiCreditCard, label: "Cards" },
            { href: "/dashboard/deposit", icon: FiArrowDownCircle, label: t("nav_deposit") },
            { href: "/dashboard/withdraw", icon: FiArrowUpCircle, label: t("nav_withdraw") },
          ],
        },
        {
          title: "Community",
          items: [
            { href: "/dashboard/messages", icon: FiMessageSquare, label: "Messages" },
            { href: "/dashboard/referrals", icon: FiGift, label: "Referrals" },
          ],
        },
        {
          title: "Account",
          items: [
            { href: "/dashboard/profile", icon: FiUser, label: "My Profile" },
            { href: "/dashboard/settings", icon: FiSettings, label: t("nav_settings") },
          ],
        },
      ];

  // Mobile bottom nav (5 key items)
  const mobileNavItems = isAgent
    ? [
        { href: "/dashboard", icon: FiHome, label: t("nav_home") },
        { href: "/dashboard/agent-panel", icon: FiInbox, label: t("nav_queue") },
        { href: "/dashboard/trade", icon: FiRepeat, label: t("nav_trade") },
        { href: "/dashboard/wallet", icon: FiCreditCard, label: t("nav_wallet") },
        { href: "/dashboard/settings", icon: FiSettings, label: t("nav_settings") },
      ]
    : [
        { href: "/dashboard", icon: FiHome, label: t("nav_home") },
        { href: "/dashboard/trade", icon: FiRepeat, label: t("nav_trade") },
        { href: "/dashboard/wallet", icon: FiCreditCard, label: t("nav_wallet") },
        { href: "/dashboard/p2p", icon: FiShoppingBag, label: "P2P" },
        { href: "/dashboard/settings", icon: FiSettings, label: "More" },
      ];

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const sideW = collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W;

  return (
    <Box minH="100vh" bg={contentBg}>
      {/* ── Desktop Sidebar ── */}
      <Box
        as="aside"
        position="fixed"
        top={0}
        left={0}
        bottom={0}
        w={`${sideW}px`}
        bg={sidebarBg}
        borderRight="1px solid"
        borderColor={sidebarBorder}
        display={{ base: "none", lg: "flex" }}
        flexDir="column"
        zIndex={200}
        overflowY="auto"
        overflowX="hidden"
        transition="width 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)"
        sx={{
          "&::-webkit-scrollbar": { width: "0px" },
          // subtle top glow for flair
          "&::before": {
            content: '""',
            position: "absolute",
            top: "-80px",
            left: "-40px",
            width: "220px",
            height: "220px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,87,184,0.18), transparent 60%)",
            pointerEvents: "none",
            filter: "blur(30px)",
          },
        }}
      >
        {/* Logo */}
        <Flex
          h="68px"
          align="center"
          px={collapsed ? 0 : 5}
          borderBottom="1px solid"
          borderColor={sidebarBorder}
          flexShrink={0}
          justify={collapsed ? "center" : "space-between"}
          position="relative"
        >
          <AnimatePresence mode="wait" initial={false}>
            {collapsed ? (
              <motion.div
                key="icon"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.2 }}
              >
                <IconLogo size={28} variant="color" />
              </motion.div>
            ) : (
              <motion.div
                key="full"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                style={{ display: "flex", alignItems: "center" }}
              >
                <TextLogo h={28} variant="color" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapse toggle pinned to the right, visible in both states */}
          <Box
            as="button"
            onClick={() => setCollapsed(!collapsed)}
            position={collapsed ? "absolute" : "static"}
            right={collapsed ? "-10px" : undefined}
            top={collapsed ? "50%" : undefined}
            transform={collapsed ? "translateY(-50%)" : undefined}
            p={1}
            w={collapsed ? "22px" : undefined}
            h={collapsed ? "22px" : undefined}
            borderRadius={collapsed ? "full" : "8px"}
            bg={collapsed ? sidebarBg : "transparent"}
            border={collapsed ? "1px solid" : "none"}
            borderColor={sidebarBorder}
            color={textMuted}
            display="flex"
            alignItems="center"
            justifyContent="center"
            _hover={{ bg: hoverBg, color: brand, transform: collapsed ? "translateY(-50%) scale(1.08)" : "scale(1.08)" }}
            transition="all 0.15s"
            zIndex={2}
          >
            <Icon as={collapsed ? FiChevronRight : FiChevronLeft} boxSize={3.5} />
          </Box>
        </Flex>

        {/* Nav Sections */}
        <VStack spacing={1} flex={1} py={3} px={collapsed ? 2 : 3} align="stretch">
          {navSections.map((section, si) => (
            <Box key={si} mb={2}>
              <AnimatePresence initial={false}>
                {!collapsed && section.title && (
                  <motion.div
                    key={`title-${si}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Text
                      fontSize="9.5px"
                      fontWeight="800"
                      color={textMuted}
                      letterSpacing=".14em"
                      textTransform="uppercase"
                      px={3}
                      mb={2}
                      mt={si > 0 ? 3 : 0}
                    >
                      {section.title}
                    </Text>
                  </motion.div>
                )}
              </AnimatePresence>
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Flex
                    key={item.href}
                    as={NextLink}
                    href={item.href}
                    align="center"
                    gap={3}
                    h="40px"
                    px={collapsed ? 0 : 3}
                    mb="2px"
                    borderRadius="10px"
                    bg={active
                      ? dk
                        ? "linear-gradient(135deg, rgba(0,87,184,0.22), rgba(0,87,184,0.08))"
                        : "linear-gradient(135deg, rgba(0,87,184,0.12), rgba(0,87,184,0.04))"
                      : "transparent"}
                    color={active ? brand : textSecondary}
                    fontWeight={active ? 700 : 500}
                    fontSize="13px"
                    transition="all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)"
                    _hover={{
                      bg: active
                        ? dk
                          ? "linear-gradient(135deg, rgba(0,87,184,0.28), rgba(0,87,184,0.1))"
                          : "linear-gradient(135deg, rgba(0,87,184,0.14), rgba(0,87,184,0.05))"
                        : hoverBg,
                      color: active ? brand : textPrimary,
                      transform: collapsed ? "scale(1.08)" : "translateX(2px)",
                    }}
                    position="relative"
                    justify={collapsed ? "center" : "flex-start"}
                    title={collapsed ? item.label : undefined}
                    boxShadow={active ? `0 0 0 1px ${dk ? "rgba(0,87,184,0.25)" : "rgba(0,87,184,0.18)"} inset` : "none"}
                  >
                    {active && (
                      <Box
                        as={motion.div}
                        layoutId="active-rail"
                        position="absolute"
                        left={0}
                        top="50%"
                        w="3px"
                        h="22px"
                        borderRadius="0 4px 4px 0"
                        bg={brand}
                        boxShadow={`0 0 12px ${brand}`}
                        style={{ transform: "translateY(-50%)" }}
                      />
                    )}
                    <Icon
                      as={item.icon}
                      boxSize={4}
                      flexShrink={0}
                      filter={active ? `drop-shadow(0 0 6px ${brand})` : "none"}
                      transition="filter 0.18s"
                    />
                    <AnimatePresence initial={false}>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -6 }}
                          transition={{ duration: 0.15 }}
                          style={{ lineHeight: 1, whiteSpace: "nowrap" }}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Flex>
                );
              })}
            </Box>
          ))}
        </VStack>

        {/* Collapsed-state mini user chip at bottom (full chip lives in topbar) */}
        <Box borderTop="1px solid" borderColor={sidebarBorder} p={collapsed ? 2 : 3} flexShrink={0}>
          <Flex
            as={NextLink}
            href="/dashboard/profile"
            align="center"
            gap={3}
            p={collapsed ? 1 : 2}
            borderRadius="10px"
            _hover={{ bg: hoverBg, transform: collapsed ? "scale(1.08)" : "translateX(2px)" }}
            transition="all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)"
            justify={collapsed ? "center" : "flex-start"}
          >
            {userEmoji ? (
              <Flex w="32px" h="32px" borderRadius="full" bg={dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"} border="1px solid" borderColor={sidebarBorder} align="center" justify="center" fontSize="18px">
                {userEmoji}
              </Flex>
            ) : (
              <Avatar size="sm" name={initials} bg={`linear-gradient(135deg, ${brand}, #003d82)`} color="white" fontSize="12px" fontWeight="700" />
            )}
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <Text fontSize="12px" fontWeight="700" color={textPrimary} noOfLines={1}>
                    {user?.firstName} {user?.lastName}
                  </Text>
                  <Text fontSize="10px" color={textMuted} noOfLines={1}>{user?.email}</Text>
                </motion.div>
              )}
            </AnimatePresence>
          </Flex>
        </Box>
      </Box>

      {/* ── Main Content ── */}
      <Box
        ml={{ base: 0, lg: `${sideW}px` }}
        transition="margin-left 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)"
        pb={{ base: "80px", lg: 0 }}
        minH="100vh"
      >
        {/* Top bar */}
        <Flex
          h="60px"
          px={{ base: 4, lg: 6 }}
          align="center"
          justify="space-between"
          bg={dk ? "rgba(8,12,28,0.88)" : "rgba(255,255,255,0.88)"}
          backdropFilter="blur(18px)"
          borderBottom="1px solid"
          borderColor={sidebarBorder}
          position="sticky"
          top={0}
          zIndex={50}
          gap={2}
        >
          {/* Left: breadcrumb / page hint (empty for now, keeps symmetry on mobile) */}
          <Box>
            <Box display={{ base: "block", lg: "none" }}>
              <IconLogo size={26} variant="color" />
            </Box>
          </Box>

          {/* Right: utilities + notifications + avatar menu + logout */}
          <HStack spacing={2}>
            <LanguageSwitcher />
            <ColorModeToggle />

            {/* Profile avatar — opens dropdown with account + logout */}
            <Menu placement="bottom-end">
              <MenuButton
                as={Box}
                role="button"
                display="inline-flex"
                alignItems="center"
                gap={2}
                px={2}
                py={1.5}
                borderRadius="full"
                border="1px solid"
                borderColor={sidebarBorder}
                bg={dk ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"}
                cursor="pointer"
                _hover={{ borderColor: brand, transform: "translateY(-1px)", boxShadow: `0 6px 20px ${dk ? "rgba(0,87,184,0.25)" : "rgba(0,87,184,0.15)"}` }}
                transition="all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)"
              >
                {userEmoji ? (
                  <Flex w="24px" h="24px" borderRadius="full" bg={dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"} border="1px solid" borderColor={sidebarBorder} align="center" justify="center" fontSize="14px">
                    {userEmoji}
                  </Flex>
                ) : (
                  <Avatar size="xs" name={initials} bg={`linear-gradient(135deg, ${brand}, #003d82)`} color="white" fontSize="10px" fontWeight="800" />
                )}
              </MenuButton>
              <MenuList
                bg={sidebarBg}
                borderColor={sidebarBorder}
                boxShadow="0 16px 40px rgba(0,0,0,0.25)"
                py={1.5}
                minW="220px"
                borderRadius="14px"
              >
                <Box px={3} pt={1.5} pb={2.5}>
                  <Text fontSize="13px" fontWeight="800" color={textPrimary} noOfLines={1}>
                    {user?.firstName} {user?.lastName}
                  </Text>
                  <Text fontSize="11px" color={textMuted} noOfLines={1}>{user?.email}</Text>
                </Box>
                <MenuDivider borderColor={sidebarBorder} my={1} />
                <MenuItem as={NextLink} href="/dashboard/profile" icon={<Icon as={FiUser} />} fontSize="13px" fontWeight="600" _hover={{ bg: hoverBg, color: brand }} bg="transparent" color={textPrimary}>
                  My Profile
                </MenuItem>
                <MenuItem as={NextLink} href="/dashboard/settings" icon={<Icon as={FiSettings} />} fontSize="13px" fontWeight="600" _hover={{ bg: hoverBg, color: brand }} bg="transparent" color={textPrimary}>
                  Settings
                </MenuItem>
                <MenuItem as={NextLink} href="/dashboard/security" icon={<Icon as={FiLock} />} fontSize="13px" fontWeight="600" _hover={{ bg: hoverBg, color: brand }} bg="transparent" color={textPrimary}>
                  Security
                </MenuItem>
                <MenuItem as={NextLink} href="/dashboard/kyc" icon={<Icon as={FiShield} />} fontSize="13px" fontWeight="600" _hover={{ bg: hoverBg, color: brand }} bg="transparent" color={textPrimary}>
                  Identity / KYC
                </MenuItem>
              </MenuList>
            </Menu>

            {/* Dedicated Logout button (top-right) */}
            <Flex
              as="button"
              onClick={() => { logout(); router.push("/login"); }}
              align="center"
              gap={2}
              h="36px"
              px={3}
              borderRadius="10px"
              border="1px solid"
              borderColor={dk ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.25)"}
              bg={dk ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.04)"}
              color="#ef4444"
              fontSize="12px"
              fontWeight="700"
              _hover={{ bg: "rgba(239,68,68,0.12)", transform: "translateY(-1px)", boxShadow: "0 6px 18px rgba(239,68,68,0.22)" }}
              transition="all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)"
            >
              <Icon as={FiLogOut} boxSize={3.5} />
              <Text display={{ base: "none", md: "inline" }}>Sign out</Text>
            </Flex>
          </HStack>
        </Flex>
        {children}
      </Box>

      {/* ── Mobile Bottom Nav ── */}
      <Flex
        as="nav"
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        zIndex={100}
        bg={mobileNavBg}
        backdropFilter="blur(20px) saturate(180%)"
        borderTop="1px solid"
        borderColor={sidebarBorder}
        justify="space-around"
        px={1}
        pt={1.5}
        pb="max(6px, env(safe-area-inset-bottom))"
        display={{ base: "flex", lg: "none" }}
      >
        {mobileNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Flex
              key={item.href}
              as={NextLink}
              href={item.href}
              direction="column"
              align="center"
              gap="2px"
              py={1}
              px={2}
              borderRadius="10px"
              color={active ? brand : textMuted}
              fontWeight={active ? 700 : 500}
              transition="all 0.15s"
              _hover={{ color: brand }}
              position="relative"
              minW="52px"
            >
              {active && (
                <Box position="absolute" top="-1.5px" left="50%" transform="translateX(-50%)"
                  w="20px" h="2px" borderRadius="full" bg={brand} />
              )}
              <Icon as={item.icon} boxSize="18px" />
              <Text fontSize="9px" letterSpacing=".02em" lineHeight={1}>{item.label}</Text>
            </Flex>
          );
        })}
      </Flex>
    </Box>
  );
}
