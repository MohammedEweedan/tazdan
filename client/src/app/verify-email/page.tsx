"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Box, Flex, Heading, Text, Button, Icon, Spinner,
} from "@chakra-ui/react";
import { FiCheckCircle, FiAlertCircle, FiMail } from "react-icons/fi";
import { authAPI } from "@/lib/api";
import Logo from "@/components/ui/Logo";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found in the URL.");
      return;
    }
    authAPI.verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage("Your email has been verified successfully!");
      })
      .catch((err: any) => {
        setStatus("error");
        setMessage(err?.response?.data?.error || "Verification failed. The link may have expired.");
      });
  }, [token]);

  const handleResend = async () => {
    setResending(true);
    setResendMsg("");
    try {
      await authAPI.resendVerification();
      setResendMsg("A new verification email has been sent.");
    } catch (err: any) {
      setResendMsg(err?.response?.data?.error || "Failed to resend email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <Box minH="100vh" bg="#0f1117" display="flex" flexDirection="column" alignItems="center" justifyContent="center" px="16px">
      <Box maxW="420px" w="100%">
        <Flex justify="center" mb="32px">
          <Logo h={36} />
        </Flex>

        <Box
          bg="#1a1d27"
          border="1px solid rgba(255,255,255,0.08)"
          borderRadius="20px"
          p="32px"
          textAlign="center"
        >
          {status === "loading" && (
            <>
              <Spinner size="xl" color="#226dff" mb="20px" />
              <Heading fontSize="18px" fontWeight="700" color="#f1f0ee" mb="8px">
                Verifying your email
              </Heading>
              <Text fontSize="14px" color="#8b92a5">{message}</Text>
            </>
          )}

          {status === "success" && (
            <>
              <Icon as={FiCheckCircle} color="#22c55e" boxSize={48} mb="20px" />
              <Heading fontSize="20px" fontWeight="700" color="#f1f0ee" mb="8px">
                Email verified
              </Heading>
              <Text fontSize="14px" color="#8b92a5" mb="24px">{message}</Text>
              <Button
                w="100%"
                h="52px"
                borderRadius="14px"
                bg="#f1f0ee"
                color="#0f172a"
                fontWeight="700"
                fontSize="15px"
                _hover={{ opacity: 0.92 }}
                onClick={() => router.push("/dashboard")}
              >
                Go to Dashboard
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <Icon as={FiAlertCircle} color="#ef4444" boxSize={48} mb="20px" />
              <Heading fontSize="18px" fontWeight="700" color="#f1f0ee" mb="8px">
                Verification failed
              </Heading>
              <Text fontSize="14px" color="#8b92a5" mb="24px">{message}</Text>
              <Flex direction="column" gap="12px">
                <Button
                  w="100%"
                  h="52px"
                  borderRadius="14px"
                  bg="rgba(255,255,255,0.06)"
                  color="#f1f0ee"
                  border="1px solid rgba(255,255,255,0.08)"
                  fontWeight="700"
                  fontSize="15px"
                  leftIcon={<Icon as={FiMail} />}
                  _hover={{ bg: "rgba(255,255,255,0.09)" }}
                  isLoading={resending}
                  onClick={handleResend}
                >
                  Resend verification email
                </Button>
                {resendMsg && (
                  <Text fontSize="13px" color={resendMsg.includes("sent") ? "#22c55e" : "#ef4444"}>
                    {resendMsg}
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
                  onClick={() => router.push("/login")}
                >
                  Back to Login
                </Button>
              </Flex>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
