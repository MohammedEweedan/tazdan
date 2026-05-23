"use client";

import { useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Box, Flex, Heading, Text, Button, Input, InputGroup, Icon, IconButton,
} from "@chakra-ui/react";
import { FiArrowLeft, FiCheckCircle, FiEye, FiEyeOff, FiAlertCircle } from "react-icons/fi";
import { authAPI } from "@/lib/api";
import Logo from "@/components/ui/Logo";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const strength = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  }, [password]);

  const strengthLabel = ["Weak", "Fair", "Good", "Strong"][strength - 1] || "";
  const strengthColor = ["#ef4444", "#f59e0b", "#226dff", "#22c55e"][strength - 1] || "transparent";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Reset failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minH="100vh" bg="#0f1117" display="flex" flexDirection="column" alignItems="center" justifyContent="center" px="16px">
      <Box maxW="420px" w="100%">
        <Flex justify="center" mb="32px">
          <Logo h={36} />
        </Flex>

        <Box bg="#1a1d27" border="1px solid rgba(255,255,255,0.08)" borderRadius="20px" p="32px">
          {!done ? (
            <>
              <Heading fontSize="20px" fontWeight="700" color="#f1f0ee" mb="8px">
                Create new password
              </Heading>
              <Text fontSize="14px" color="#8b92a5" mb="24px">
                Enter a new password for your account. Make sure it is strong and unique.
              </Text>

              <form onSubmit={handleSubmit}>
                <Box mb="16px">
                  <InputGroup>
                    <Input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="New password"
                      h="56px"
                      borderRadius="16px"
                      border="1.5px solid rgba(255,255,255,0.08)"
                      bg="rgba(255,255,255,0.03)"
                      color="#f1f0ee"
                      fontSize="15px"
                      pr="48px"
                      _focus={{ borderColor: "#226dff", boxShadow: "none" }}
                    />
                    <IconButton
                      aria-label="Toggle password"
                      icon={<Icon as={showPw ? FiEyeOff : FiEye} boxSize={18} />}
                      variant="ghost"
                      color="#8b92a5"
                      position="absolute"
                      right="8px"
                      top="50%"
                      transform="translateY(-50%)"
                      zIndex={2}
                      onClick={() => setShowPw(!showPw)}
                    />
                  </InputGroup>
                  {password.length > 0 && (
                    <Flex align="center" mt="8px" gap="8px">
                      <Box flex="1" h="4px" borderRadius="2px" bg="rgba(255,255,255,0.06)">
                        <Box h="100%" w={`${(strength / 4) * 100}%`} bg={strengthColor} borderRadius="2px" transition="all 0.2s" />
                      </Box>
                      <Text fontSize="12px" fontWeight="600" color={strengthColor}>{strengthLabel}</Text>
                    </Flex>
                  )}
                </Box>

                <Box mb="20px">
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Confirm password"
                    h="56px"
                    borderRadius="16px"
                    border="1.5px solid rgba(255,255,255,0.08)"
                    bg="rgba(255,255,255,0.03)"
                    color="#f1f0ee"
                    fontSize="15px"
                    _focus={{ borderColor: "#226dff", boxShadow: "none" }}
                  />
                </Box>

                {error && (
                  <Flex align="center" gap="8px" mb="16px" color="#ef4444">
                    <Icon as={FiAlertCircle} boxSize={16} />
                    <Text fontSize="13px" fontWeight="600">{error}</Text>
                  </Flex>
                )}

                <Button
                  w="100%"
                  h="52px"
                  borderRadius="14px"
                  bg="#f1f0ee"
                  color="#0f172a"
                  fontWeight="700"
                  fontSize="15px"
                  _hover={{ opacity: 0.92 }}
                  isLoading={loading}
                  type="submit"
                >
                  Reset password
                </Button>
              </form>
            </>
          ) : (
            <Box textAlign="center">
              <Icon as={FiCheckCircle} color="#22c55e" boxSize={48} mb="20px" />
              <Heading fontSize="20px" fontWeight="700" color="#f1f0ee" mb="8px">
                Password updated
              </Heading>
              <Text fontSize="14px" color="#8b92a5" mb="24px">
                Your password has been reset successfully. Please log in with your new password.
              </Text>
              <Button
                w="100%"
                h="52px"
                borderRadius="14px"
                bg="#f1f0ee"
                color="#0f172a"
                fontWeight="700"
                fontSize="15px"
                _hover={{ opacity: 0.92 }}
                onClick={() => router.push("/login")}
              >
                Go to Login
              </Button>
            </Box>
          )}

          <Flex align="center" justify="center" mt="24px" gap="6px">
            <Icon as={FiArrowLeft} color="#8b92a5" boxSize={14} />
            <Box as="button" onClick={() => router.push("/login")} color="#226dff" fontSize="14px" fontWeight="700" textDecoration="none">
              Back to Login
            </Box>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
}
