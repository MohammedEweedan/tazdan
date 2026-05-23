"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Text,
  Button,
  VStack,
  HStack,
  Icon,
  Divider,
  Flex,
  Spinner,
  Switch,
  FormControl,
  FormLabel,
  Input,
  Select,
  Avatar,
  IconButton,
  InputGroup,
  useToast,
} from "@chakra-ui/react";
import {
  FiUser,
  FiShield,
  FiBell,
  FiLock,
  FiMail,
  FiPhone,
  FiEye,
  FiEyeOff,
  FiCheckCircle,
  FiRefreshCw,
  FiSave,
  FiBell as FiBellIcon,
  FiZap,
  FiChevronRight,
} from "react-icons/fi";
import NextLink from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { userAPI } from "@/lib/api";

// ── Stat cell ─────────────────────────────────────────────────────────
function StatCell({
  label,
  value,
  sub,
  subColor = "#0057b8",
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
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
        mb={0.5}
      >
        {label}
      </Text>
      {sub && (
        <Text fontSize="11px" fontWeight="600" color={subColor}>
          {sub}
        </Text>
      )}
    </Box>
  );
}

// ── Settings card ────────────────────────────────────────────────────
function SettingsCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <Box
      bg="rgba(8,8,22,0.98)"
      border="1px solid"
      borderColor="rgba(255,255,255,0.05)"
      borderRadius="16px"
      overflow="hidden"
    >
      <Flex
        px={5}
        py={4}
        borderBottom="1px solid"
        borderColor="rgba(255,255,255,0.05)"
        align="center"
        gap={3}
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
          <Icon as={icon} color="#3b82f6" boxSize={4} />
        </Box>
        <Text fontSize="14px" fontWeight="700" color="white">
          {title}
        </Text>
      </Flex>
      <Box p={5}>{children}</Box>
    </Box>
  );
}

// ══ SETTINGS PAGE ════════════════════════════════════════════════════
export default function SettingsPage() {
  const { user, fetchUser } = useAuthStore();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [now, setNow] = useState(new Date());
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    language: "en",
    notifications: { email: true, push: true, sms: false },
    security: { twoFactorEnabled: false, loginAlerts: true, sessionTimeout: 30 },
    preferences: { theme: "dark", currency: "USD", timezone: "UTC" },
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const cardBg = "rgba(255,255,255,0.03)";
  const cardBorder = "rgba(255,255,255,0.07)";
  const muted = "#64748b";
  const textSub = "#94a3b8";

  useEffect(() => {
    const load = async () => {
      try {
        if (user) {
          setFormData({
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            phone: user.phone || "",
            language: "en",
            notifications: { email: true, push: true, sms: false },
            security: {
              twoFactorEnabled: user.twoFactorEnabled || false,
              loginAlerts: true,
              sessionTimeout: 30,
            },
            preferences: { theme: "dark", currency: "USD", timezone: "UTC" },
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, toast]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast({
        title: "Settings saved successfully",
        description: "Your preferences have been updated",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      await fetchUser();
    } catch {
      toast({
        title: "Error saving settings",
        description: "Please try again",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please check your passwords",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast({
        title: "Password changed successfully",
        description: "Your password has been updated",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      toast({
        title: "Error changing password",
        description: "Please check your current password",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status: string, type: "kyc" | "2fa") => {
    const colors: Record<string, { bg: string; color: string }> = {
      APPROVED: { bg: "rgba(0,87,184,0.1)", color: "#0057b8" },
      PENDING: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b" },
      NOT_SUBMITTED: { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
      ENABLED: { bg: "rgba(0,87,184,0.1)", color: "#0057b8" },
      DISABLED: { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
    };
    const label =
      type === "kyc"
        ? status || "NOT_SUBMITTED"
        : status
          ? "ENABLED"
          : "DISABLED";
    const style = colors[label] || colors.NOT_SUBMITTED;
    return (
      <Box
        px={2}
        py="2px"
        borderRadius="4px"
        bg={style.bg}
        border="1px solid"
        borderColor={style.color + "30"}
      >
        <Text fontSize="10px" fontWeight="700" color={style.color} letterSpacing=".06em">
          {label}
        </Text>
      </Box>
    );
  };

  if (loading) {
    return (
      <Flex
        minH="100vh"
        align="center"
        justify="center"
        direction="column"
        gap={4}
      >
        <Box
          w="32px"
          h="32px"
          borderRadius="full"
          border="2px solid"
          borderColor="#3b82f6"
          borderTopColor="transparent"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <Text
          fontSize="12px"
          color="#475569"
          letterSpacing=".08em"
          textTransform="uppercase"
        >
          Loading settings
        </Text>
      </Flex>
    );
  }

  return (
    <Box
      minH="100vh"
      fontFamily="'DM Sans', system-ui, sans-serif"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;600&display=swap');
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
      `}</style>

      {/* ── Top bar ── */}
      <Flex
        h="48px"
        borderBottom="1px solid"
        borderColor="rgba(255,255,255,0.06)"
        px={6}
        align="center"
        justify="space-between"
        bg="rgba(5,5,18,0.97)"
        backdropFilter="blur(16px)"
        position="sticky"
        top={0}
        zIndex={200}
      >
        <HStack spacing={6}>
          <Text
            fontSize="14px"
            fontWeight="900"
            letterSpacing="-0.04em"
            bgGradient="linear(135deg,#3b82f6,#06b6d4)"
            bgClip="text"
            color="transparent"
          >
            FORTUNI
          </Text>
          <Box w="1px" h="16px" bg="rgba(255,255,255,0.06)" />
          <Text
            fontSize="11px"
            color="#334155"
            letterSpacing=".04em"
            fontWeight="600"
          >
            SETTINGS
          </Text>
        </HStack>

        <HStack spacing={2}>
          <Text
            fontSize="11px"
            fontFamily="'DM Mono', monospace"
            color="#334155"
          >
            {now.toLocaleTimeString("en-US", { hour12: false })}
          </Text>
          <Box w="1px" h="14px" bg="rgba(255,255,255,0.06)" />
          <IconButton
            aria-label="Refresh"
            icon={<FiRefreshCw />}
            size="sm"
            variant="ghost"
            color="#475569"
            _hover={{ color: "white", bg: "rgba(255,255,255,0.04)" }}
          />
          <Button
            as={NextLink}
            href="/dashboard/trade"
            size="sm"
            h="28px"
            px={4}
            bg="linear-gradient(135deg,#2563eb,#1d4ed8)"
            color="white"
            fontSize="11px"
            fontWeight="700"
            borderRadius="6px"
            _hover={{
              opacity: 0.9,
              transform: "translateY(-1px)",
              boxShadow: "0 4px 16px rgba(37,99,235,0.4)",
            }}
            transition="all 0.2s"
            leftIcon={<FiZap size={11} />}
          >
            Trade
          </Button>
          <Avatar size="xs" name={user?.email} bg="#1d4ed8" />
        </HStack>
      </Flex>

      {/* ── Main content ── */}
      <Box p={6} maxW="1200px" mx="auto">
        {/* Header */}
        <Flex justify="space-between" align="center" mb={6}>
          <Box>
            <Text fontSize="10px" color="#334155" letterSpacing=".1em" textTransform="uppercase" mb={1}>
              Account
            </Text>
            <Text fontSize="20px" fontWeight="800" color="white">
              Settings
            </Text>
          </Box>
          <Button
            onClick={handleSaveSettings}
            isLoading={saving}
            h="36px"
            px={5}
            bg="linear-gradient(135deg,#2563eb,#1d4ed8)"
            color="white"
            fontSize="13px"
            fontWeight="700"
            borderRadius="8px"
            _hover={{
              opacity: 0.92,
              transform: "translateY(-1px)",
              boxShadow: "0 8px 24px rgba(37,99,235,0.4)",
            }}
            transition="all 0.2s"
            leftIcon={<FiSave size={14} />}
          >
            Save Changes
          </Button>
        </Flex>

        <Flex gap={6} direction={{ base: "column", lg: "row" }}>
          {/* Left column */}
          <VStack spacing={6} flex={1} align="stretch">
            {/* Profile */}
            <SettingsCard title="Profile Information" icon={FiUser}>
              <VStack spacing={4} align="stretch">
                <Flex justify="center" mb={2}>
                  <Avatar size="lg" name={user?.email} bg="#1d4ed8" />
                </Flex>
                <FormControl>
                  <FormLabel fontSize="11px" color="#475569" letterSpacing=".05em" textTransform="uppercase" mb={1.5}>
                    First Name
                  </FormLabel>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    bg="rgba(255,255,255,0.03)"
                    border="1px solid rgba(255,255,255,0.07)"
                    color="white"
                    fontSize="13px"
                    borderRadius="8px"
                    h="40px"
                    _placeholder={{ color: "#1e293b" }}
                    _hover={{ borderColor: "rgba(255,255,255,0.12)" }}
                    _focus={{ borderColor: "#3b82f6" }}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="11px" color="#475569" letterSpacing=".05em" textTransform="uppercase" mb={1.5}>
                    Last Name
                  </FormLabel>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    bg="rgba(255,255,255,0.03)"
                    border="1px solid rgba(255,255,255,0.07)"
                    color="white"
                    fontSize="13px"
                    borderRadius="8px"
                    h="40px"
                    _hover={{ borderColor: "rgba(255,255,255,0.12)" }}
                    _focus={{ borderColor: "#3b82f6" }}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="11px" color="#475569" letterSpacing=".05em" textTransform="uppercase" mb={1.5}>
                    Email
                  </FormLabel>
                  <Input
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    type="email"
                    bg="rgba(255,255,255,0.03)"
                    border="1px solid rgba(255,255,255,0.07)"
                    color="white"
                    fontSize="13px"
                    borderRadius="8px"
                    h="40px"
                    _hover={{ borderColor: "rgba(255,255,255,0.12)" }}
                    _focus={{ borderColor: "#3b82f6" }}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="11px" color="#475569" letterSpacing=".05em" textTransform="uppercase" mb={1.5}>
                    Phone
                  </FormLabel>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    bg="rgba(255,255,255,0.03)"
                    border="1px solid rgba(255,255,255,0.07)"
                    color="white"
                    fontSize="13px"
                    borderRadius="8px"
                    h="40px"
                    _hover={{ borderColor: "rgba(255,255,255,0.12)" }}
                    _focus={{ borderColor: "#3b82f6" }}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="11px" color="#475569" letterSpacing=".05em" textTransform="uppercase" mb={1.5}>
                    Language
                  </FormLabel>
                  <Select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    bg="rgba(255,255,255,0.03)"
                    border="1px solid rgba(255,255,255,0.07)"
                    color="white"
                    fontSize="13px"
                    borderRadius="8px"
                    h="40px"
                    _hover={{ borderColor: "rgba(255,255,255,0.12)" }}
                    _focus={{ borderColor: "#3b82f6" }}
                  >
                    <option value="en" style={{ background: "#0d0d1f" }}>English</option>
                    <option value="ar" style={{ background: "#0d0d1f" }}>العربية</option>
                  </Select>
                </FormControl>
              </VStack>
            </SettingsCard>

            {/* Preferences */}
            <SettingsCard title="Preferences" icon={FiBell}>
              <VStack spacing={4} align="stretch">
                <Text fontSize="12px" fontWeight="700" color="white" mb={1}>
                  Notifications
                </Text>
                {[
                  { key: "email", label: "Email Notifications" },
                  { key: "push", label: "Push Notifications" },
                  { key: "sms", label: "SMS Notifications" },
                ].map(({ key, label }) => (
                  <Flex key={key} justify="space-between" align="center">
                    <Text fontSize="13px" color={textSub}>
                      {label}
                    </Text>
                    <Switch
                      isChecked={formData.notifications[key as keyof typeof formData.notifications]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          notifications: { ...formData.notifications, [key]: e.target.checked },
                        })
                      }
                      colorScheme="blue"
                      size="sm"
                    />
                  </Flex>
                ))}
                <Divider borderColor="rgba(255,255,255,0.05)" my={2} />
                <FormControl>
                  <FormLabel fontSize="11px" color="#475569" letterSpacing=".05em" textTransform="uppercase" mb={1.5}>
                    Currency
                  </FormLabel>
                  <Select
                    value={formData.preferences.currency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, currency: e.target.value },
                      })
                    }
                    bg="rgba(255,255,255,0.03)"
                    border="1px solid rgba(255,255,255,0.07)"
                    color="white"
                    fontSize="13px"
                    borderRadius="8px"
                    h="40px"
                    _hover={{ borderColor: "rgba(255,255,255,0.12)" }}
                  >
                    <option value="USD" style={{ background: "#0d0d1f" }}>USD</option>
                    <option value="EUR" style={{ background: "#0d0d1f" }}>EUR</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="11px" color="#475569" letterSpacing=".05em" textTransform="uppercase" mb={1.5}>
                    Timezone
                  </FormLabel>
                  <Select
                    value={formData.preferences.timezone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, timezone: e.target.value },
                      })
                    }
                    bg="rgba(255,255,255,0.03)"
                    border="1px solid rgba(255,255,255,0.07)"
                    color="white"
                    fontSize="13px"
                    borderRadius="8px"
                    h="40px"
                    _hover={{ borderColor: "rgba(255,255,255,0.12)" }}
                  >
                    <option value="UTC" style={{ background: "#0d0d1f" }}>UTC</option>
                    <option value="UTC-5" style={{ background: "#0d0d1f" }}>UTC-5 (EST)</option>
                  </Select>
                </FormControl>
              </VStack>
            </SettingsCard>
          </VStack>

          {/* Right column */}
          <VStack spacing={6} flex={1} align="stretch">
            {/* Security */}
            <SettingsCard title="Security" icon={FiShield}>
              <VStack spacing={4} align="stretch">
                <Flex justify="space-between" align="center">
                  <Text fontSize="13px" color={textSub}>
                    Two-Factor Authentication
                  </Text>
                  <Switch
                    isChecked={formData.security.twoFactorEnabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        security: { ...formData.security, twoFactorEnabled: e.target.checked },
                      })
                    }
                    colorScheme="blue"
                    size="sm"
                  />
                </Flex>
                <Flex justify="space-between" align="center">
                  <Text fontSize="13px" color={textSub}>
                    Login Alerts
                  </Text>
                  <Switch
                    isChecked={formData.security.loginAlerts}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        security: { ...formData.security, loginAlerts: e.target.checked },
                      })
                    }
                    colorScheme="blue"
                    size="sm"
                  />
                </Flex>
                <FormControl>
                  <FormLabel fontSize="11px" color="#475569" letterSpacing=".05em" textTransform="uppercase" mb={1.5}>
                    Session Timeout (min)
                  </FormLabel>
                  <Select
                    value={formData.security.sessionTimeout}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        security: { ...formData.security, sessionTimeout: parseInt(e.target.value) },
                      })
                    }
                    bg="rgba(255,255,255,0.03)"
                    border="1px solid rgba(255,255,255,0.07)"
                    color="white"
                    fontSize="13px"
                    borderRadius="8px"
                    h="40px"
                    _hover={{ borderColor: "rgba(255,255,255,0.12)" }}
                  >
                    <option value={15} style={{ background: "#0d0d1f" }}>15 min</option>
                    <option value={30} style={{ background: "#0d0d1f" }}>30 min</option>
                    <option value={60} style={{ background: "#0d0d1f" }}>1 hour</option>
                    <option value={120} style={{ background: "#0d0d1f" }}>2 hours</option>
                  </Select>
                </FormControl>
                <Divider borderColor="rgba(255,255,255,0.05)" my={2} />
                <Text fontSize="12px" fontWeight="700" color="white" mb={1}>
                  Change Password
                </Text>
                <FormControl>
                  <FormLabel fontSize="11px" color="#475569" letterSpacing=".05em" textTransform="uppercase" mb={1.5}>
                    Current Password
                  </FormLabel>
                  <InputGroup>
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      bg="rgba(255,255,255,0.03)"
                      border="1px solid rgba(255,255,255,0.07)"
                      color="white"
                      fontSize="13px"
                      borderRadius="8px"
                      h="40px"
                      _hover={{ borderColor: "rgba(255,255,255,0.12)" }}
                      _focus={{ borderColor: "#3b82f6" }}
                    />
                    <IconButton
                      aria-label="Toggle password visibility"
                      icon={<Icon as={showPassword ? FiEyeOff : FiEye} />}
                      onClick={() => setShowPassword(!showPassword)}
                      variant="ghost"
                      color="#475569"
                      _hover={{ color: "white" }}
                    />
                  </InputGroup>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="11px" color="#475569" letterSpacing=".05em" textTransform="uppercase" mb={1.5}>
                    New Password
                  </FormLabel>
                  <InputGroup>
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      bg="rgba(255,255,255,0.03)"
                      border="1px solid rgba(255,255,255,0.07)"
                      color="white"
                      fontSize="13px"
                      borderRadius="8px"
                      h="40px"
                      _hover={{ borderColor: "rgba(255,255,255,0.12)" }}
                      _focus={{ borderColor: "#3b82f6" }}
                    />
                    <IconButton
                      aria-label="Toggle password visibility"
                      icon={<Icon as={showConfirmPassword ? FiEyeOff : FiEye} />}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      variant="ghost"
                      color="#475569"
                      _hover={{ color: "white" }}
                    />
                  </InputGroup>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="11px" color="#475569" letterSpacing=".05em" textTransform="uppercase" mb={1.5}>
                    Confirm Password
                  </FormLabel>
                  <Input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    bg="rgba(255,255,255,0.03)"
                    border="1px solid rgba(255,255,255,0.07)"
                    color="white"
                    fontSize="13px"
                    borderRadius="8px"
                    h="40px"
                    _hover={{ borderColor: "rgba(255,255,255,0.12)" }}
                    _focus={{ borderColor: "#3b82f6" }}
                  />
                </FormControl>
                <Button
                  onClick={handleChangePassword}
                  isLoading={saving}
                  h="40px"
                  bg="rgba(59,130,246,0.15)"
                  color="#3b82f6"
                  fontSize="13px"
                  fontWeight="700"
                  border="1px solid rgba(59,130,246,0.3)"
                  borderRadius="8px"
                  _hover={{ bg: "rgba(59,130,246,0.22)" }}
                  leftIcon={<FiLock size={14} />}
                >
                  Change Password
                </Button>
              </VStack>
            </SettingsCard>

            {/* Account Status */}
            <SettingsCard title="Account Status" icon={FiCheckCircle}>
              <VStack spacing={4} align="stretch">
                <Flex justify="space-between" align="center">
                  <HStack spacing={3}>
                    <Box w="6px" h="6px" borderRadius="full" bg="#3b82f6" />
                    <Text fontSize="13px" color={textSub}>
                      KYC Verification
                    </Text>
                  </HStack>
                  {statusBadge(user?.kycStatus || "PENDING", "kyc")}
                </Flex>
                <Flex justify="space-between" align="center">
                  <HStack spacing={3}>
                    <Box w="6px" h="6px" borderRadius="full" bg="#0057b8" />
                    <Text fontSize="13px" color={textSub}>
                      Two-Factor Auth
                    </Text>
                  </HStack>
                  {statusBadge(user?.twoFactorEnabled ? "ENABLED" : "DISABLED", "2fa")}
                </Flex>
                <Flex justify="space-between" align="center">
                  <HStack spacing={3}>
                    <Box w="6px" h="6px" borderRadius="full" bg="#8b5cf6" />
                    <Text fontSize="13px" color={textSub}>
                      Email Verification
                    </Text>
                  </HStack>
                  <Box
                    px={2}
                    py="2px"
                    borderRadius="4px"
                    bg="rgba(0,87,184,0.1)"
                    border="1px solid rgba(0,87,184,0.2)"
                  >
                    <Text fontSize="10px" fontWeight="700" color="#0057b8" letterSpacing=".06em">
                      VERIFIED
                    </Text>
                  </Box>
                </Flex>
                {user?.kycStatus !== "APPROVED" && (
                  <Box
                    mt={3}
                    p={3}
                    bg="rgba(245,158,11,0.06)"
                    border="1px solid rgba(245,158,11,0.18)"
                    borderRadius="8px"
                  >
                    <Flex gap={2} align="flex-start">
                      <Icon as={FiBellIcon} color="#f59e0b" boxSize={3.5} mt="2px" flexShrink={0} />
                      <Box>
                        <Text fontSize="11px" fontWeight="700" color="#f59e0b" mb={0.5}>
                          Complete KYC Verification
                        </Text>
                        <Text fontSize="10px" color={textSub} lineHeight={1.5}>
                          Verify your identity to unlock full trading features
                        </Text>
                        <Button
                          as={NextLink}
                          href="/dashboard/kyc"
                          mt={2}
                          size="xs"
                          h="24px"
                          px={3}
                          bg="rgba(245,158,11,0.15)"
                          color="#f59e0b"
                          fontSize="11px"
                          fontWeight="700"
                          border="1px solid rgba(245,158,11,0.25)"
                          borderRadius="6px"
                          _hover={{ bg: "rgba(245,158,11,0.22)" }}
                        >
                          Verify Now
                        </Button>
                      </Box>
                    </Flex>
                  </Box>
                )}
              </VStack>
            </SettingsCard>
          </VStack>
        </Flex>
      </Box>
    </Box>
  );
}
