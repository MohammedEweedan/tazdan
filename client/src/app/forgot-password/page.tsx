"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  Box, Flex, Heading, Text, Button, Input, Icon,
} from "@chakra-ui/react";
import { FiArrowLeft, FiCheckCircle, FiMail } from "react-icons/fi";
import { authAPI } from "@/lib/api";
import Logo from "@/components/ui/Logo";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError("");
    setLoading(true);
    try {
      await authAPI.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Something went wrong.");
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
          {!sent ? (
            <>
              <Heading fontSize="20px" fontWeight="700" color="#f1f0ee" mb="8px">
                Reset your password
              </Heading>
              <Text fontSize="14px" color="#8b92a5" mb="24px">
                Enter the email address associated with your account and we'll send you a reset link.
              </Text>

              <form onSubmit={handleSubmit}>
                <Box mb="16px" position="relative">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    h="56px"
                    borderRadius="16px"
                    border="1.5px solid rgba(255,255,255,0.08)"
                    bg="rgba(255,255,255,0.03)"
                    color="#f1f0ee"
                    fontSize="15px"
                    pl="48px"
                    _focus={{ borderColor: "#4a8fe0", boxShadow: "none" }}
                  />
                  <Box position="absolute" left="16px" top="50%" transform="translateY(-50%)" color="#8b92a5">
                    <Icon as={FiMail} size={25} />
                  </Box>
                </Box>

                {error && (
                  <Text fontSize="13px" fontWeight="600" color="#ef4444" mb="12px">
                    {error}
                  </Text>
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
                  Send reset link
                </Button>
              </form>
            </>
          ) : (
            <Box textAlign="center">
              <Icon as={FiCheckCircle} color="#22c55e" size={20} mb="20px" />
              <Heading fontSize="18px" fontWeight="700" color="#f1f0ee" mb="8px">
                Check your email
              </Heading>
              <Text fontSize="14px" color="#8b92a5" mb="24px">
                If an account exists for <strong>{email}</strong>, you will receive a password reset link within a few minutes.
              </Text>
              <Button
                w="100%"
                h="52px"
                borderRadius="14px"
                bg="rgba(255,255,255,0.06)"
                color="#f1f0ee"
                border="1px solid rgba(255,255,255,0.08)"
                fontWeight="700"
                fontSize="15px"
                _hover={{ bg: "rgba(255,255,255,0.09)" }}
                onClick={() => { setSent(false); setEmail(""); }}
              >
                Resend email
              </Button>
            </Box>
          )}

          <Flex align="center" justify="center" mt="24px" gap="6px">
            <Icon as={FiArrowLeft} color="#8b92a5" size={20} />
            <Box as={NextLink} href="/login" color="#4a8fe0" fontSize="14px" fontWeight="700" textDecoration="none">
              Back to Login
            </Box>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
}
