"use client";

import { Box, useColorMode } from "@chakra-ui/react";
import { motion } from "framer-motion";

/**
 * Animated SVG background paths, adapted for our Chakra / no-Tailwind stack.
 *
 * Renders two mirrored layers of strokes that continuously draw themselves.
 * Designed to sit behind a hero heading as an absolute-positioned layer.
 *
 * Usage:
 *   <Box position="relative">
 *     <BackgroundPaths />
 *     <Heading>...</Heading>
 *   </Box>
 */

function FloatingPaths({ position, stroke }: { position: number; stroke: string }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${
      189 + i * 6
    } -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${
      343 - i * 6
    }C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${
      875 - i * 6
    } ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <Box position="absolute" inset={0} pointerEvents="none">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 696 316"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        style={{ color: stroke }}
      >
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.1 + path.id * 0.03}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.3, 0.6, 0.3],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </Box>
  );
}

export function BackgroundPaths() {
  const { colorMode } = useColorMode();
  const stroke = colorMode === "dark" ? "#ffffff53" : "#1149cc53";

  return (
    <Box
      position="absolute"
      inset={0}
      overflow="hidden"
      pointerEvents="none"
      zIndex={0}
      aria-hidden
    >
      <FloatingPaths position={1} stroke={stroke} />
      <FloatingPaths position={-1} stroke={stroke} />
    </Box>
  );
}

export default BackgroundPaths;
