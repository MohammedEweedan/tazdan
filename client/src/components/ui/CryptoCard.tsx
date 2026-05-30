"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Box, Flex, Text, HStack, VStack, Input, IconButton, 
  useColorMode, Spinner, Badge, InputGroup, InputLeftElement,
  Icon, chakra, shouldForwardProp,
  Button,
} from "@chakra-ui/react";
import { FiSearch, FiPlus, FiTrash2, FiTrendingUp, FiTrendingDown, FiChevronRight, FiStar } from "react-icons/fi";
import { motion, AnimatePresence, isValidMotionProp } from "framer-motion";
import { useLivePrices } from "@/hooks/useLivePrices";
import TradingViewWidget from "./TradingViewWidget";

const MotionBox = chakra(motion.div, {
  shouldForwardProp: (prop) => isValidMotionProp(prop) || shouldForwardProp(prop),
});

const MotionFlex = chakra(motion.div, {
  shouldForwardProp: (prop) => isValidMotionProp(prop) || shouldForwardProp(prop),
});

const DEFAULT_TICKERS = ["bitcoin", "ethereum", "solana", "tether"];

const CryptoCard = () => {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const [tickers, setTickers] = useState<string[]>([]);
  const [activeId, setActiveId] = useState("bitcoin");
  const [search, setSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { prices, loading } = useLivePrices(tickers.length > 0 ? tickers : DEFAULT_TICKERS);

  useEffect(() => {
    const saved = localStorage.getItem("fav_tickers");
    if (saved) {
      setTickers(JSON.parse(saved));
    } else {
      setTickers(DEFAULT_TICKERS);
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearching(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const saveTickers = (newTickers: string[]) => {
    setTickers(newTickers);
    localStorage.setItem("fav_tickers", JSON.stringify(newTickers));
  };

  const addTicker = (id: string, sym: string) => {
    if (!tickers.includes(id)) {
      saveTickers([...tickers, id]);
    }
    setActiveId(id);
    setSearch("");
    setIsSearching(false);
  };

  const removeTicker = (id: string) => {
    const newTickers = tickers.filter(t => t !== id);
    saveTickers(newTickers);
    if (activeId === id && newTickers.length > 0) {
      setActiveId(newTickers[0]);
    }
  };

  const activePrice = prices.find(p => p.id === activeId);
  const brand = "#0057b8";

  return (
    <Box
      w="100%"
      maxW="420px"
      position="relative"
      zIndex={10}
    >
      <MotionBox
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        // @ts-ignore
        transition={{ duration: 0.6, cubicBezier: [0.16, 1, 0.3, 1] }}
        bg={dark ? "rgba(10, 10, 26, 0.85)" : "white"}
        border="1px solid"
        borderColor={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
        borderRadius="32px"
        p={6}
        boxShadow={dark ? "0 25px 50px -12px rgba(0, 0, 0, 0.5)" : "0 25px 50px -12px rgba(0, 87, 184, 0.1)"}
        backdropFilter="blur(24px)"
      >
        <VStack spacing={6} align="stretch">
          <HStack justify="space-between" align="center">
            <HStack spacing={2}>
              <Box w="10px" h="10px" borderRadius="full" bg={brand} boxShadow={`0 0 10px ${brand}`} />
              <Text fontSize="sm" fontWeight="800" color={brand} letterSpacing="0.1em" textTransform="uppercase">
                promrkts Live
              </Text>
            </HStack>
            <Badge colorScheme="green" variant="subtle" borderRadius="full" px={3} py={0.5} fontSize="9px" fontWeight="700">
              STABLE
            </Badge>
          </HStack>

          <Box position="relative" ref={searchRef}>
            <InputGroup size="md">
              <InputLeftElement pointerEvents="none">
                <FiSearch color={dark ? "gray.500" : "gray.400"} />
              </InputLeftElement>
              <Input
                placeholder="Search symbol (e.g. BTC, ETH, SOL)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setIsSearching(true)}
                borderRadius="16px"
                bg={dark ? "rgba(255,255,255,0.04)" : "gray.50"}
                border="1px solid"
                borderColor={dark ? "rgba(255,255,255,0.08)" : "gray.100"}
                fontSize="sm"
                _focus={{ 
                  boxShadow: `0 0 0 2px ${brand}33`,
                  borderColor: brand,
                  bg: dark ? "rgba(255,255,255,0.06)" : "white"
                }}
              />
            </InputGroup>

            <AnimatePresence>
              {isSearching && search && (
                <MotionBox
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  position="absolute"
                  top="110%"
                  left={0}
                  right={0}
                  bg={dark ? "#1a1a2e" : "white"}
                  borderRadius="16px"
                  boxShadow="2xl"
                  border="1px solid"
                  borderColor={dark ? "whiteAlpha.100" : "gray.100"}
                  maxH="300px"
                  overflowY="auto"
                  zIndex={100}
                  p={2}
                >
                  <VStack align="stretch" spacing={0}>
                    {prices
                      .filter(p => p.symbol.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
                      .map(p => (
                        <Box
                          key={p.id}
                          px={4}
                          py={3}
                          cursor="pointer"
                          borderRadius="10px"
                          _hover={{ bg: dark ? "whiteAlpha.100" : "gray.50" }}
                          onClick={() => addTicker(p.id, p.symbol)}
                        >
                          <HStack justify="space-between">
                            <VStack align="start" spacing={0}>
                              <Text fontSize="sm" fontWeight="800">{p.symbol}</Text>
                              <Text fontSize="xs" color="gray.500">{p.id.toUpperCase()}</Text>
                            </VStack>
                            <Icon as={FiChevronRight} color="gray.500" />
                          </HStack>
                        </Box>
                      ))}
                    {prices.filter(p => p.symbol.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                      <Box px={4} py={3}>
                        <Text fontSize="xs" color="gray.500">No matching assets found</Text>
                      </Box>
                    )}
                  </VStack>
                </MotionBox>
              )}
            </AnimatePresence>
          </Box>

          <Box overflowX="auto" pb={1} sx={{ "&::-webkit-scrollbar": { display: "none" } }}>
            <HStack spacing={2}>
              {prices.map((p) => (
                <MotionBox
                  key={p.id}
                  layout
                  onClick={() => setActiveId(p.id)}
                  cursor="pointer"
                  px={4}
                  py={2}
                  borderRadius="14px"
                  bg={activeId === p.id ? brand : (dark ? "rgba(255,255,255,0.04)" : "gray.50")}
                  color={activeId === p.id ? "white" : (dark ? "whiteAlpha.700" : "gray.500")}
                  fontWeight="700"
                  fontSize="xs"
                  transition="all 0.2s"
                  position="relative"
                  border="1px solid"
                  borderColor={activeId === p.id ? brand : (dark ? "rgba(255,255,255,0.04)" : "transparent")}
                  _hover={{
                    bg: activeId === p.id ? brand : (dark ? "rgba(255,255,255,0.08)" : "gray.100")
                  }}
                >
                  <HStack spacing={1}>
                    {activeId === p.id && <Icon as={FiStar} boxSize={3} fill="white" />}
                    <Text>{p.symbol}</Text>
                  </HStack>
                  {tickers.length > 1 && activeId === p.id && (
                    <Box
                      position="absolute"
                      top="-4px"
                      right="-4px"
                      bg="red.500"
                      borderRadius="full"
                      p="2px"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTicker(p.id);
                      }}
                      _hover={{ transform: "scale(1.1)" }}
                    >
                      <FiTrash2 size={8} color="white" />
                    </Box>
                  )}
                </MotionBox>
              ))}
            </HStack>
          </Box>

          <AnimatePresence mode="wait">
            {loading ? (
              <Flex h="100px" align="center" justify="center" key="loading">
                <Spinner size="lg" color={brand} thickness="3px" speed="0.8s" />
              </Flex>
            ) : activePrice ? (
              <MotionBox
                key={activeId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                // @ts-ignore
                transition={{ duration: 0.3 }}
              >
                <VStack align="start" spacing={1}>
                  <HStack w="100%" justify="space-between" align="baseline">
                    <Text fontSize="4xl" fontWeight="900" letterSpacing="-1.5px" color={dark ? "white" : "gray.800"}>
                      ${activePrice.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                    <HStack spacing={1} bg={activePrice.change24h >= 0 ? "green.50015" : "red.50015"} px={2} py={1} borderRadius="8px">
                      <Icon 
                        as={activePrice.change24h >= 0 ? FiTrendingUp : FiTrendingDown} 
                        color={activePrice.change24h >= 0 ? "green.400" : "red.400"} 
                        boxSize={3}
                      />
                      <Text 
                        fontSize="xs" 
                        fontWeight="800" 
                        color={activePrice.change24h >= 0 ? "green.400" : "red.400"}
                      >
                        {activePrice.change24h >= 0 ? "+" : ""}{activePrice.change24h.toFixed(2)}%
                      </Text>
                    </HStack>
                  </HStack>
                  <Text fontSize="10px" color="gray.500" fontWeight="800" letterSpacing="0.05em">
                    MARKET PRICE · {activePrice.label}
                  </Text>
                </VStack>
              </MotionBox>
            ) : null}
          </AnimatePresence>

          <Box 
            h="260px" 
            borderRadius="24px" 
            overflow="hidden" 
            bg={dark ? "rgba(0,0,0,0.2)" : "gray.50"}
            border="1px solid"
            borderColor={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}
            position="relative"
          >
            {activePrice && (
              <TradingViewWidget 
                symbol={`BINANCE:${activePrice.symbol}USDT`} 
                containerId={`tv-card-${activeId}`} 
              />
            )}
          </Box>

          <Button
            w="100%"
            h="52px"
            bg={brand}
            color="white"
            borderRadius="16px"
            fontWeight="800"
            fontSize="sm"
            rightIcon={<FiChevronRight />}
            _hover={{
              bg: "#004ea7",
              transform: "translateY(-2px)",
              boxShadow: `0 12px 24px ${brand}44`
            }}
            transition="all 0.2s"
          >
            Open Trade Terminal
          </Button>
        </VStack>
      </MotionBox>

      {/* Decorative background elements */}
      <Box 
        position="absolute" 
        top="-20px" 
        right="-20px" 
        w="100px" 
        h="100px" 
        bg={brand} 
        opacity={0.1} 
        filter="blur(40px)" 
        zIndex={-1} 
      />
      <Box 
        position="absolute" 
        bottom="-20px" 
        left="-20px" 
        w="150px" 
        h="150px" 
        bg="purple.500" 
        opacity={0.05} 
        filter="blur(50px)" 
        zIndex={-1} 
      />
    </Box>
  );
};

export default CryptoCard;
