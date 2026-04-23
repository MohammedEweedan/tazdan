"use client";

import {
  Box,
  HStack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react"
import { useLivePrices } from "@/hooks/useLivePrices"
import { useRef, useEffect } from "react";

const scroll = keyframes`
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
`;

const flashGreen = keyframes`
  0%,100% { color: inherit; }
  50%      { color: #00c076; }
`;
const flashRed = keyframes`
  0%,100% { color: inherit; }
  50%      { color: #ff3b30; }
`;

export default function PriceTicker() {
  const { prices, loading } = useLivePrices();
  const bg = useColorModeValue("#f5f5f7", "#0d0d1a");
  const border = useColorModeValue("gray.200", "rgba(255,255,255,0.07)");
  const muted = useColorModeValue("gray.500", "gray.500");

  // duplicate for seamless loop
  const items = [...prices, ...prices];

  const fmt = (n: number) =>
    n < 10
      ? n.toFixed(4)
      : n.toLocaleString("en-US", { maximumFractionDigits: 2 });

  if (loading)
    return (
      <Box h="28px" bg={bg} borderBottom="1px solid" borderColor={border} />
    );

  return (
    <Box
      h="28px"
      bg={bg}
      borderBottom="1px solid"
      borderColor={border}
      overflow="hidden"
      display="flex"
      alignItems="center"
    >
      <Box
        display="flex"
        whiteSpace="nowrap"
        animation={`${scroll} 40s linear infinite`}
        _hover={{ animationPlayState: "paused" }}
        gap={10}
      >
        {items.map((coin, i) => {
          const up = coin.change24h >= 0;
          const flashed = coin.price !== coin.prev;
          return (
            <HStack key={`${coin.id}-${i}`} spacing={2} display="inline-flex">
              <Text fontSize="11px" fontWeight="700" color={muted}>
                {coin.label}
              </Text>
              <Text
                fontSize="11px"
                fontWeight="600"
                animation={
                  flashed
                    ? `${up ? flashGreen : flashRed} 0.6s ease`
                    : undefined
                }
              >
                ${fmt(coin.price)}
              </Text>
              <Text
                fontSize="11px"
                fontWeight="600"
                color={up ? "green.400" : "red.400"}
              >
                {up ? "▲" : "▼"} {Math.abs(coin.change24h).toFixed(2)}%
              </Text>
            </HStack>
          );
        })}
      </Box>
    </Box>
  );
}
