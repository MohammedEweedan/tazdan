"use client";

import { Box, useColorModeValue } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

// Crypto Icons as SVG Components
const BtcIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" width="24" height="24" fill={color}>
    <circle cx="16" cy="16" r="16" fillOpacity="0.1" />
    <path d="M22.5 14.24c.313-2.09-1.28-3.212-3.456-3.962l.707-2.836-1.726-.43-.688 2.762c-.454-.113-.92-.22-1.385-.326l.693-2.776-1.725-.43-.707 2.834c-.376-.086-.745-.17-1.104-.26l-2.381-.594-.46 1.842s1.28.293 1.253.311c.698.174.825.636.803 1.002l-.804 3.228c.048.012.11.03.179.058l-1.127 4.52c-.085.212-.302.53-.79.41l-.857 1.974 2.248.56c.418.105.828.215 1.231.318l-.714 2.866 1.724.43.707-2.838c.472.128.93.247 1.378.357l-.705 2.825 1.726.43.714-2.861c2.948.558 5.164.333 6.098-2.334.752-2.146-.038-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538z" />
  </svg>
);

const EthIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" width="24" height="24" fill={color}>
    <circle cx="16" cy="16" r="16" fillOpacity="0.1" />
    <path d="M16 4l7.5 12.2L16 12.9 8.5 16.2 16 4z" fillOpacity="0.9" />
    <path d="M16 27.9l7.5-10.3L16 21.9l-7.5-4.3L16 27.9z" fillOpacity="0.6" />
    <path d="M16 4v8.9l7.5 3.3L16 4z" fillOpacity="0.5" />
    <path d="M16 12.9L8.5 16.2 16 4v8.9z" fillOpacity="0.7" />
  </svg>
);

const UsdtIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" width="24" height="24" fill={color}>
    <circle cx="16" cy="16" r="16" fillOpacity="0.1" />
    <path d="M17.9 13.4v-2.3h5.3V7.5H8.9v3.6h5.3v2.3c-4.4.2-7.7 1.1-7.7 2.1s3.3 1.9 7.7 2.1v7.6h2.8v-7.6c4.3-.2 7.7-1.1 7.7-2.1s-3.3-1.9-7.7-2.1z" />
    <circle cx="16" cy="16" r="3" fill={color} fillOpacity="0.3" />
  </svg>
);

const SolIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" width="24" height="24" fill={color}>
    <rect width="32" height="32" rx="16" fillOpacity="0.1" />
    <path d="M6 10h20l-3 3H3l3-3zm0 12h20l-3 3H6l3-3zm3-6h20l-3 3H9l3-3z" />
    <circle cx="16" cy="16" r="2" fill={color} fillOpacity="0.5" />
  </svg>
);

const BnbIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" width="24" height="24" fill={color}>
    <circle cx="16" cy="16" r="16" fillOpacity="0.1" />
    <path d="M16 2l6 6-6 6-6-6 6-6zm0 26l-6-6 6-6 6 6-6 6z" fillOpacity="0.9" />
    <path d="M16 11l-4.5 4.5L16 20l4.5-4.5L16 11z" fillOpacity="0.6" />
  </svg>
);

const AdaIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" width="24" height="24" fill={color}>
    <circle cx="16" cy="16" r="16" fillOpacity="0.1" />
    <ellipse cx="16" cy="16" rx="8" ry="12" fillOpacity="0.2" />
    <circle cx="16" cy="8" r="3" />
    <circle cx="16" cy="24" r="3" />
    <circle cx="10" cy="16" r="2.5" />
    <circle cx="22" cy="16" r="2.5" />
  </svg>
);

const XrpIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" width="24" height="24" fill={color}>
    <circle cx="16" cy="16" r="16" fillOpacity="0.1" />
    <path d="M24 10l-4 6 4 6h-4l-4-6 4-6h4zM8 10l4 6-4 6h4l4-6-4-6H8z" fillOpacity="0.9" />
    <rect x="14" y="14" width="4" height="4" rx="1" />
  </svg>
);

const DogeIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" width="24" height="24" fill={color}>
    <circle cx="16" cy="16" r="16" fillOpacity="0.1" />
    <ellipse cx="16" cy="18" rx="10" ry="8" />
    <circle cx="11" cy="14" r="2" fillOpacity="0.3" />
    <circle cx="21" cy="14" r="2" fillOpacity="0.3" />
    <circle cx="16" cy="20" r="3" fillOpacity="0.2" />
    <path d="M8 16c-2 2-2 6 0 8" stroke={color} strokeWidth="1.5" fill="none" />
  </svg>
);

const orb = keyframes`to{transform:translate(-50%,-50%) rotate(360deg)}`;
const orbRev = keyframes`to{transform:translate(-50%,-50%) rotate(-360deg)}`;
const gPulse = keyframes`
  0%,100%{box-shadow:0 0 80px rgba(37,99,235,.3),inset 0 0 60px rgba(37,99,235,.15)}
  50%{box-shadow:0 0 130px rgba(37,99,235,.5),inset 0 0 90px rgba(37,99,235,.28)}`;
const gridDrift = keyframes`to{background-position:22px 22px}`;
const ringA = keyframes`to{transform:translate(-50%,-50%) rotateX(72deg) rotateZ(360deg)}`;
const ringB = keyframes`to{transform:translate(-50%,-50%) rotateX(72deg) rotateZ(-360deg)}`;
const glow1 = keyframes`0%{transform:translate(0,0) scale(1)}100%{transform:translate(40px,30px) scale(1.15)}`;

const coins = [
  { key: "BTC", orbit: 1, Icon: BtcIcon },
  { key: "ETH", orbit: 1, Icon: EthIcon },
  { key: "USDT", orbit: 2, Icon: UsdtIcon },
  { key: "BNB", orbit: 2, Icon: BnbIcon },
  { key: "SOL", orbit: 3, Icon: SolIcon },
  { key: "ADA", orbit: 3, Icon: AdaIcon },
  { key: "XRP", orbit: 4, Icon: XrpIcon },
  { key: "DOGE", orbit: 4, Icon: DogeIcon },
];

const orbits = [
  { size: "280px", dur1: "8s", anim1: orb, dur2: "8s" },
  { size: "340px", dur1: "11s", anim1: orbRev, dur2: "11s" },
  { size: "400px", dur1: "14s", anim1: orb, dur2: "14s" },
  { size: "460px", dur1: "17s", anim1: orbRev, dur2: "17s" },
];

// Pre-compute values outside component to avoid re-renders
const ORBIT_BG_LIGHT = "white";
const ORBIT_BG_DARK = "rgba(0,0,0,0.6)";
const BORDER_LIGHT = "gray.200";
const BORDER_DARK = "gray.700";

export default function CryptoSphere() {
  const iconColor = useColorModeValue("#1a202c", "#ffffff");
  const orbitBg = useColorModeValue(ORBIT_BG_LIGHT, ORBIT_BG_DARK);
  const borderColor = useColorModeValue(BORDER_LIGHT, BORDER_DARK);

  return (
    <Box
      position="relative"
      w="520px"
      h="520px"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      {/* Ambient glow behind globe */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%,-50%)"
        w="320px"
        h="320px"
        borderRadius="full"
        bg="radial-gradient(circle,rgba(37,99,235,.18),transparent 65%)"
        animation={`${glow1} 8s ease-in-out infinite alternate`}
        pointerEvents="none"
      />

      {/* Orbit tracks + coins - reduced to 2 orbits for performance */}
      {orbits.slice(0, 2).map((orbit, orbitIndex) => {
        const orbitCoins = coins.filter((c) => c.orbit === orbitIndex + 1);

        return (
          <Box
            key={orbitIndex}
            position="absolute"
            top="50%"
            left="50%"
            w={orbit.size}
            h={orbit.size}
            borderRadius="full"
            border="1px solid rgba(255,255,255,0.08)"
            transform="translate(-50%, -50%)"
            animation={`${orbit.anim1} ${orbit.dur1} linear infinite`}
          >
            {orbitCoins.map((coin, i) => {
              const angle = (i / orbitCoins.length) * Math.PI * 2;
              const radius = parseInt(orbit.size) / 2 - 24;

              return (
                <Box
                  key={coin.key}
                  position="absolute"
                  top="50%"
                  left="50%"
                  transform={`
                    rotate(${angle}rad)
                    translate(${radius}px)
                    rotate(${-angle}rad)
                  `}
                  style={{ transformOrigin: "center center" }}
                >
                  <Box
                    w="48px"
                    h="48px"
                    borderRadius="full"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    bg={orbitBg}
                    boxShadow="0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)"
                    border="1px solid"
                    borderColor={borderColor}
                    transition="all 0.3s"
                    _hover={{ transform: "scale(1.1)", boxShadow: "0 8px 30px rgba(37,99,235,0.4)" }}
                  >
                    <coin.Icon color={iconColor} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        );
      })}

      {/* Globe */}
      <Box position="relative" w="200px" h="200px">
        {/* Rings - reduced to 1 for performance */}
        {[
          { w: "260px", h: "85px", dur: "9s", anim: ringA, opacity: 0.25 },
        ].map((r, ri) => (
          <Box
            key={ri}
            position="absolute"
            top="50%"
            left="50%"
            w={r.w}
            h={r.h}
            border="1px solid"
            borderColor={`rgba(59,130,246,${r.opacity})`}
            borderRadius="full"
            animation={`${r.anim} ${r.dur} linear infinite`}
            transform="translate(-50%, -50%)"
          />
        ))}

        {/* Ball - simplified, reduced animations */}
        <Box
          w="200px"
          h="200px"
          borderRadius="full"
          bg="radial-gradient(circle at 38% 32%,#1e3a6e 0%,#0d1b3e 45%,#050d20 100%)"
          border="1px solid rgba(59,130,246,0.25)"
          overflow="hidden"
          position="relative"
          zIndex={1}
          boxShadow="0 0 60px rgba(37,99,235,0.2), inset 0 0 40px rgba(0,0,0,0.5)"
        >
          {/* Grid lines - static, no animation */}
          <Box
            position="absolute"
            inset={0}
            borderRadius="full"
            opacity={0.2}
            backgroundImage="repeating-linear-gradient(0deg,transparent,transparent 20px,rgba(59,130,246,0.4) 21px),repeating-linear-gradient(90deg,transparent,transparent 20px,rgba(59,130,246,0.4) 21px)"
          />
          {/* Shine */}
          <Box
            position="absolute"
            top="12%"
            left="18%"
            w="40%"
            h="30%"
            bg="radial-gradient(ellipse,rgba(255,255,255,0.12),transparent)"
            borderRadius="full"
          />
          {/* Atmosphere edge */}
          <Box
            position="absolute"
            inset={0}
            borderRadius="full"
            bg="radial-gradient(circle at 75% 75%,rgba(6,182,212,0.1),transparent 50%)"
          />
          {/* Inner glow */}
          <Box
            position="absolute"
            inset="15%"
            borderRadius="full"
            bg="radial-gradient(circle,rgba(37,99,235,0.15),transparent 70%)"
          />
        </Box>
      </Box>
    </Box>
  );
}
