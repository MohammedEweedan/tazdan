"use client";

import { useState, useMemo, useEffect } from "react";
import NextLink from "next/link";
import {
  Box, Flex, Text, Input, Icon, HStack, VStack,
  Badge, Button, useColorMode, Container, Heading, SimpleGrid,
  Tooltip, Table, Thead, Tbody, Tr, Th, Td, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalCloseButton, useDisclosure,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiSearch, FiTrendingUp, FiTrendingDown, FiGlobe,
} from "react-icons/fi";
import { motion } from "framer-motion";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";

const BRAND = "#0057b8";
const BRAND_LIGHT = "#4a8fe0";

/* ── Live Prices (Binance public REST) ── */
type TickerMap = Record<string, { price: number; change: number; volume: string }>;

const TRACKED_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT",
  "DOGEUSDT", "AVAXUSDT", "DOTUSDT", "MATICUSDT", "LINKUSDT", "UNIUSDT",
];

const SEED_PRICES: TickerMap = {
  BTCUSDT: { price: 67240.50, change: 2.34, volume: "28.4B" },
  ETHUSDT: { price: 3520.80, change: -0.87, volume: "14.2B" },
  SOLUSDT: { price: 172.40, change: 5.67, volume: "3.2B" },
  BNBUSDT: { price: 594.20, change: 1.12, volume: "1.8B" },
  XRPUSDT: { price: 0.5234, change: -1.23, volume: "1.1B" },
  ADAUSDT: { price: 0.4812, change: 0.45, volume: "0.4B" },
  DOGEUSDT: { price: 0.1547, change: 8.92, volume: "2.1B" },
  AVAXUSDT: { price: 36.78, change: 3.21, volume: "0.6B" },
  DOTUSDT: { price: 7.34, change: -2.10, volume: "0.3B" },
  MATICUSDT: { price: 0.7123, change: 1.89, volume: "0.5B" },
  LINKUSDT: { price: 14.52, change: 0.78, volume: "0.8B" },
  UNIUSDT: { price: 9.87, change: -0.45, volume: "0.4B" },
};

const COIN_META = [
  { sym: "BTC", name: "Bitcoin", k: "BTCUSDT", icon: "₿", color: "#f7931a" },
  { sym: "ETH", name: "Ethereum", k: "ETHUSDT", icon: "Ξ", color: "#627eea" },
  { sym: "BNB", name: "BNB", k: "BNBUSDT", icon: "◆", color: "#f3ba2f" },
  { sym: "SOL", name: "Solana", k: "SOLUSDT", icon: "◎", color: "#9945ff" },
  { sym: "XRP", name: "XRP", k: "XRPUSDT", icon: "✕", color: "#0085c0" },
  { sym: "ADA", name: "Cardano", k: "ADAUSDT", icon: "₳", color: "#0033ad" },
  { sym: "DOGE", name: "Dogecoin", k: "DOGEUSDT", icon: "Ð", color: "#c3a634" },
  { sym: "AVAX", name: "Avalanche", k: "AVAXUSDT", icon: "▲", color: "#e84142" },
  { sym: "DOT", name: "Polkadot", k: "DOTUSDT", icon: "●", color: "#e6007a" },
  { sym: "MATIC", name: "Polygon", k: "MATICUSDT", icon: "⬡", color: "#8247e5" },
  { sym: "LINK", name: "Chainlink", k: "LINKUSDT", icon: "⬢", color: "#375bd2" },
  { sym: "UNI", name: "Uniswap", k: "UNIUSDT", icon: "🦄", color: "#ff007a" },
];

function useLivePrices(symbols: string[] = TRACKED_SYMBOLS, intervalMs = 8000): TickerMap {
  const [prices, setPrices] = useState<TickerMap>(SEED_PRICES);
  useEffect(() => {
    let alive = true;
    const fetchPrices = async () => {
      try {
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(
          JSON.stringify(symbols)
        )}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const data: Array<{ symbol: string; lastPrice: string; priceChangePercent: string; volume: string }> =
          await res.json();
        if (!alive) return;
        const next: TickerMap = {};
        for (const d of data) {
          const vol = parseFloat(d.volume);
          let volStr = "";
          if (vol >= 1e9) volStr = (vol / 1e9).toFixed(1) + "B";
          else if (vol >= 1e6) volStr = (vol / 1e6).toFixed(1) + "M";
          else if (vol >= 1e3) volStr = (vol / 1e3).toFixed(1) + "K";
          else volStr = vol.toFixed(1);
          next[d.symbol] = {
            price: parseFloat(d.lastPrice),
            change: parseFloat(d.priceChangePercent),
            volume: volStr,
          };
        }
        setPrices((prev) => ({ ...prev, ...next }));
      } catch {
        /* network/CORS error — keep last-good state */
      }
    };
    fetchPrices();
    const id = setInterval(fetchPrices, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [symbols.join(","), intervalMs]);
  return prices;
}

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

const REGIONS = [
  { name: "North America", countries: ["USA", "Canada", "Mexico"], flag: "🇺🇸" },
  { name: "Europe", countries: ["UK", "Germany", "France", "Italy", "Spain"], flag: "🇪🇺" },
  { name: "Middle East & North Africa", countries: ["UAE", "Saudi Arabia", "Egypt", "Morocco"], flag: "🇦🇪" },
  { name: "Asia Pacific", countries: ["Japan", "Singapore", "Australia", "India"], flag: "🇯🇵" },
  { name: "Latin America", countries: ["Brazil", "Argentina", "Colombia"], flag: "🇧🇷" },
  { name: "Africa", countries: ["Nigeria", "Kenya", "South Africa"], flag: "🇳🇬" },
];

export default function MarketsPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const pageBg = dark ? "#000000" : "#fafbfe";
  const cardBg = dark ? "rgba(255,255,255,0.03)" : "white";
  const border = dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.1)";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.6)" : "#475569";
  const textMuted = dark ? "#475569" : "#94a3b8";
  const greenC = "#22c55e";
  const redC = "#ef4444";
  const glow = dark ? "rgba(0,87,184,0.18)" : "rgba(0,87,184,0.08)";

  const [search, setSearch] = useState("");
  const [selectedCoin, setSelectedCoin] = useState<any>(null);
  const { isOpen: isTradeModalOpen, onOpen: onTradeModalOpen, onClose: onTradeModalClose } = useDisclosure();

  const livePrices = useLivePrices();

  const coins = useMemo(() => {
    return COIN_META.map((meta) => {
      const data = livePrices[meta.k] ?? SEED_PRICES[meta.k];
      return {
        ...meta,
        price: data.price,
        change: data.change,
        volume: data.volume,
      };
    });
  }, [livePrices]);

  const filteredCoins = useMemo(() =>
    coins.filter((c) => c.sym.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase())),
    [coins, search]
  );

  const titleGradient = dark
    ? "linear(to-b, #4a8fe0 0%, #ffffff 55%, rgba(255,255,255,0.5) 100%)"
    : "linear(to-b, #0057b8 0%, #0a0f1e 55%, rgba(10,15,30,0.4) 100%)";

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
  };

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      {/* Hero */}
      <Box position="relative" pt={{ base: "110px", md: "160px" }} pb={{ base: 12, md: 20 }}>
        <Box position="absolute" top="20%" left="50%" transform="translateX(-50%)" w={{ base: "600px", md: "900px" }} h="500px" bg={glow} filter="blur(120px)" borderRadius="full" pointerEvents="none" />
        <Container maxW="1100px" position="relative" zIndex={1}>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <VStack spacing={6} textAlign="center">
              <Text fontSize="11px" fontWeight="800" color="#4a8fe0" letterSpacing="0.22em">
                ✦ {t("live_markets_title")}
              </Text>
              <Heading
                as="h1"
                fontFamily="'DM Sans', sans-serif"
                fontWeight="800"
                fontSize={{ base: "40px", md: "72px" }}
                lineHeight="1.0"
                letterSpacing="-0.04em"
                bgGradient={titleGradient}
                bgClip="text"
                maxW="900px"
              >
                {t("markets_title")}
              </Heading>
              <Text fontSize={{ base: "15px", md: "18px" }} color={textSub} maxW="640px" lineHeight="1.7">
                {t("live_markets_subtitle")}
              </Text>
            </VStack>
          </motion.div>
        </Container>
      </Box>

      {/* Search Bar */}
      <Container maxW="1200px" mb={10}>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={itemVariants}
        >
          <Flex align="center" bg={cardBg} border="1px solid" borderColor={border} borderRadius="16px" px={5} h="56px" boxShadow={dark ? "none" : "0 8px 30px rgba(0,87,184,0.08)"}>
            <Icon as={FiSearch} color={textMuted} boxSize={5} mr={3} />
            <Input
              variant="unstyled"
              placeholder={t("search_coins")}
              fontSize="15px"
              color={textMain}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              h="40px"
            />
          </Flex>
        </motion.div>
      </Container>

      {/* Crypto Pairs Table */}
      <Container maxW="1400px" mb={16}>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="24px" overflow="hidden" backdropFilter="blur(16px)" boxShadow={dark ? "none" : "0 20px 60px rgba(0,87,184,0.12)"}>
            <Box overflowX="auto">
              <Table variant="simple">
                <Thead bg={dark ? "rgba(255,255,255,0.02)" : "rgba(0,87,184,0.02)"}>
                  <Tr>
                    <Th textAlign="left" color={textMuted} fontSize="12px" fontWeight="700" textTransform="uppercase" letterSpacing="0.05em" py={6} px={8}>{t("coin_name")}</Th>
                    <Th textAlign="right" color={textMuted} fontSize="12px" fontWeight="700" textTransform="uppercase" letterSpacing="0.05em" py={6} px={8}>{t("coin_price")}</Th>
                    <Th textAlign="right" color={textMuted} fontSize="12px" fontWeight="700" textTransform="uppercase" letterSpacing="0.05em" py={6} px={8}>24h Change</Th>
                    <Th textAlign="right" color={textMuted} fontSize="12px" fontWeight="700" textTransform="uppercase" letterSpacing="0.05em" py={6} px={8}>24h Volume</Th>
                    <Th textAlign="center" color={textMuted} fontSize="12px" fontWeight="700" textTransform="uppercase" letterSpacing="0.05em" py={6} px={8}>Action</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredCoins.map((coin, index) => (
                    <motion.div
                      key={coin.sym}
                      initial="hidden"
                      animate="visible"
                      variants={itemVariants}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Tr
                        borderBottom="1px solid"
                        borderColor={border}
                        cursor="pointer"
                        _hover={{ bg: dark ? "rgba(255,255,255,0.03)" : "rgba(0,87,184,0.03)" }}
                      >
                      <Td py={7} px={8} textAlign="left">
                        <HStack spacing={4}>
                          <Flex w="12" h="12" bg={`${coin.color}15`} borderRadius="12px" align="center" justify="center" border={`1px solid ${coin.color}30`}>
                            <Text fontSize="20px">{coin.icon}</Text>
                          </Flex>
                          <Box>
                            <Text fontSize="16px" fontWeight="700" color={textMain}>{coin.sym}</Text>
                            <Text fontSize="13px" color={textMuted}>{coin.name}</Text>
                          </Box>
                        </HStack>
                      </Td>
                      <Td py={7} px={8} textAlign="right">
                        <Text fontSize="16px" fontWeight="700" color={textMain} fontFamily="monospace">
                          ${fmtPrice(coin.price)}
                        </Text>
                      </Td>
                      <Td py={7} px={8} textAlign="right">
                        <Badge
                          bg={coin.change >= 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}
                          color={coin.change >= 0 ? greenC : redC}
                          variant="subtle"
                          fontSize="13px"
                          px={4}
                          py={1.5}
                          borderRadius="8px"
                          fontWeight="700"
                        >
                          <HStack spacing={1.5}>
                            <Icon as={coin.change >= 0 ? FiTrendingUp : FiTrendingDown} boxSize={3.5} />
                            <Text>{coin.change >= 0 ? "+" : ""}{coin.change.toFixed(2)}%</Text>
                          </HStack>
                        </Badge>
                      </Td>
                      <Td py={7} px={8} textAlign="right">
                        <Text fontSize="16px" fontWeight="600" color={textSub}>${coin.volume}</Text>
                      </Td>
                      <Td py={7} px={8} textAlign="center">
                        <Button
                          size="md"
                          bg={BRAND}
                          color="white"
                          borderRadius="12px"
                          fontWeight="700"
                          fontSize="13px"
                          px={6}
                          py={2}
                          _hover={{ opacity: 0.9, transform: "translateY(-2px)" }}
                          transition="all 0.2s"
                          onClick={() => {
                            setSelectedCoin(coin);
                            onTradeModalOpen();
                          }}
                        >
                          {t("markets_buy")}
                        </Button>
                      </Td>
                    </Tr>
                    </motion.div>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </Box>
        </motion.div>
      </Container>

      {/* TradingView Widgets Section */}
      <Container maxW="1400px" mb={20}>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <VStack spacing={10}>
            <Heading
              fontSize={{ base: "28px", md: "44px" }}
              fontWeight="800"
              letterSpacing="-0.03em"
              textAlign="center"
              fontFamily="'DM Sans', sans-serif"
              color={textMain}
            >
              Market Insights
            </Heading>
            <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6} w="100%">
              {/* TradingView Chart Widget */}
              <Box
                bg={cardBg}
                border="1px solid"
                borderColor={border}
                borderRadius="20px"
                overflow="hidden"
                backdropFilter="blur(12px)"
              >
                <Box h="500px">
                  <iframe
                    src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=BINANCE%3ABTCUSDT&interval=D&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%5D&theme=${dark ? 'dark' : 'light'}&style=1&timezone=Etc%2FUTC`}
                    style={{ width: "100%", height: "100%", border: "none" }}
                    allowFullScreen
                  />
                </Box>
              </Box>

              {/* TradingView News Widget */}
              <Box
                bg={cardBg}
                border="1px solid"
                borderColor={border}
                borderRadius="20px"
                overflow="hidden"
                backdropFilter="blur(12px)"
              >
                <Box h="500px">
                  <iframe
                    src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_news&feedMode=all_symbols&isTransparent=false&displayMode=regular&width=100%&height=500&colorTheme=${dark ? 'dark' : 'light'}&locale=en&symbol=NASDAQ%3AAAPL`}
                    style={{ width: "100%", height: "100%", border: "none" }}
                    allowFullScreen
                  />
                </Box>
              </Box>
            </SimpleGrid>

            {/* TradingView Market Overview Widget */}
            <Box
              bg={cardBg}
              border="1px solid"
              borderColor={border}
              borderRadius="20px"
              overflow="hidden"
              backdropFilter="blur(12px)"
            >
              <Box h="400px">
                <iframe
                  src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_overview&colorTheme=${dark ? 'dark' : 'light'}&dateRange=12M&exchange=CURRENCY&showChart=true&locale=en&largeChartUrl=&isTransparent=false&showSymbolLogo=true&showFloatingTooltip=false&width=100%&height=400&plotLineColorGrowing=%230057b8&gridLineColor=rgba(240%2C%20243%2C%20250%2C%200.8)&scaleFontColor=rgba(120%2C%20123%2C%20134%2C%201)&belowLineFillColorGrowing=rgba(0%2C%2087%2C%20184%2C%200.12)&belowLineFillColorFalling=rgba(0%2C%2087%2C%20184%2C%200.12)&symbol=BINANCE%3ABTCUSDT`}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  allowFullScreen
                />
              </Box>
            </Box>
          </VStack>
        </motion.div>
      </Container>

      {/* Global Markets Section */}
      <Container maxW="1200px" mb={20}>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <VStack spacing={10}>
            <Heading
              fontSize={{ base: "28px", md: "44px" }}
              fontWeight="800"
              letterSpacing="-0.03em"
              textAlign="center"
              fontFamily="'DM Sans', sans-serif"
              color={textMain}
            >
              Global Markets
            </Heading>
            <Text fontSize={{ base: "15px", md: "18px" }} color={textSub} maxW="640px" textAlign="center" lineHeight="1.7">
              Access crypto markets across 120+ countries with localized payment methods and 24/7 support.
            </Text>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={5} w="100%">
              {REGIONS.map((region) => (
                <motion.div
                  key={region.name}
                  initial="hidden"
                  animate="visible"
                  variants={itemVariants}
                >
                  <Box
                    bg={cardBg}
                    border="1px solid"
                    borderColor={border}
                    borderRadius="20px"
                    p={6}
                    backdropFilter="blur(12px)"
                    transition="all 0.3s ease"
                    _hover={{ 
                      transform: "translateY(-6px)", 
                      borderColor: BRAND,
                      boxShadow: dark ? "0 20px 40px rgba(0,87,184,0.2)" : "0 20px 40px rgba(0,87,184,0.15)"
                    }}
                  >
                    <Flex w="12" h="12" bg="rgba(0,87,184,0.1)" borderRadius="12px" align="center" justify="center" mb={4} border="1px solid rgba(0,87,184,0.2)">
                      <Text fontSize="24px">{region.flag}</Text>
                    </Flex>
                    <Heading fontSize="18px" fontWeight="700" color={textMain} letterSpacing="-0.02em" fontFamily="'DM Sans', sans-serif" mb={3}>
                      {region.name}
                    </Heading>
                    <VStack spacing={1} align="start">
                      {region.countries.map((country) => (
                        <Text key={country} fontSize="13px" color={textSub}>
                          • {country}
                        </Text>
                      ))}
                    </VStack>
                  </Box>
                </motion.div>
              ))}
            </SimpleGrid>
          </VStack>
        </motion.div>
      </Container>

      {/* CTA Section */}
      <Container maxW="1100px" mb={20}>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <Box
            borderRadius="32px"
            overflow="hidden"
            position="relative"
            bg="linear-gradient(135deg, #0057b8 0%, #001a3d 100%)"
            p={{ base: 10, md: 16 }}
            textAlign="center"
            boxShadow="0 40px 80px rgba(0,87,184,0.25)"
          >
            <Box position="absolute" inset={0} opacity={0.08} backgroundImage="radial-gradient(circle at 2px 2px, white 1px, transparent 0)" backgroundSize="36px 36px" pointerEvents="none" />
            <VStack spacing={6} position="relative" zIndex={2}>
              <Heading fontSize={{ base: "28px", md: "44px" }} fontWeight="800" color="white" letterSpacing="-0.03em" lineHeight="1.1" fontFamily="'DM Sans', sans-serif" maxW="560px">
                Start Trading Today
              </Heading>
              <Text fontSize={{ base: "15px", md: "18px" }} color="rgba(255,255,255,0.8)" maxW="540px">
                Join 120,000+ traders worldwide and access 400+ trading pairs with institutional-grade liquidity.
              </Text>
              <Button
                as={NextLink}
                href="/register"
                h="52px"
                px={8}
                bg="white"
                color="#0057b8"
                borderRadius="14px"
                fontWeight="800"
                fontSize="14px"
                _hover={{ transform: "scale(1.03)" }}
                transition="all 0.2s"
              >
                {t("cta_button")}
              </Button>
            </VStack>
          </Box>
        </motion.div>
      </Container>

      <PublicFooter />

      {/* Trade Modal - shows coin info and redirects to dashboard */}
      <Modal isOpen={isTradeModalOpen} onClose={onTradeModalClose} size="md" isCentered>
        <ModalOverlay bg="rgba(0, 0, 0, 0.7)" />
        <ModalContent bg={dark ? "#0a0f1e" : "white"} border="1px solid" borderColor={border} borderRadius="20px">
          <ModalHeader color={textMain} fontSize="20px" fontWeight="800">
            Trade {selectedCoin?.sym}
          </ModalHeader>
          <ModalCloseButton color={textMuted} />
          <ModalBody pb={6}>
            <VStack spacing={6}>
              <Box bg={dark ? "rgba(255,255,255,0.05)" : "rgba(0,87,184,0.05)"} borderRadius="12px" p={5}>
                <HStack justify="space-between" mb={3}>
                  <Text color={textSub} fontSize="14px">Current Price</Text>
                  <Text color={textMain} fontSize="20px" fontWeight="700" fontFamily="monospace">
                    ${selectedCoin ? fmtPrice(selectedCoin.price) : '--'}
                  </Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color={textSub} fontSize="14px">24h Change</Text>
                  <Badge
                    bg={selectedCoin?.change >= 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}
                    color={selectedCoin?.change >= 0 ? greenC : redC}
                    fontSize="14px"
                    px={3}
                    py={1}
                    borderRadius="6px"
                    fontWeight="700"
                  >
                    {selectedCoin?.change >= 0 ? "+" : ""}{selectedCoin?.change.toFixed(2)}%
                  </Badge>
                </HStack>
              </Box>

              <VStack spacing={4} align="stretch">
                <Text color={textSub} fontSize="15px" textAlign="center" lineHeight="1.6">
                  Start trading {selectedCoin?.name} ({selectedCoin?.sym}) on our platform with advanced features and real-time order execution.
                </Text>

                <Button
                  as={NextLink}
                  href="/dashboard/trade"
                  w="100%"
                  bg={BRAND}
                  color="white"
                  borderRadius="12px"
                  fontWeight="800"
                  fontSize="16px"
                  py={4}
                  _hover={{ opacity: 0.9 }}
                  onClick={() => {
                    onTradeModalClose();
                  }}
                >
                  Go to Trading Dashboard
                </Button>

                <Button
                  as={NextLink}
                  href="/login"
                  w="100%"
                  bg="transparent"
                  color={BRAND}
                  border="2px solid"
                  borderColor={BRAND}
                  borderRadius="12px"
                  fontWeight="800"
                  fontSize="16px"
                  py={4}
                  _hover={{ bg: "rgba(0,87,184,0.05)" }}
                  onClick={() => {
                    onTradeModalClose();
                  }}
                >
                  Sign In to Trade
                </Button>
              </VStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
