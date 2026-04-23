"use client";

import { Box, Image, useColorModeValue } from "@chakra-ui/react";
import { motion } from "framer-motion";

const MotionBox = motion(Box);

interface Props {
  logo: string;
  radius: number;
  speed: number;
  index: number;
}

export default function OrbitalCoin({ logo, radius, speed, index }: Props) {
  const orbitColor = useColorModeValue("blackAlpha.800", "whiteAlpha.900");

  const angleOffset = (index / 6) * Math.PI * 2;

  return (
    <MotionBox
      position="absolute"
      top="50%"
      left="50%"
      transform="translate(-50%, -50%)"
      animate={{ rotate: 360 }}
      transition={{
        repeat: Infinity,
        duration: speed,
        ease: "linear",
      }}
    >
      <Box
        position="absolute"
        transform={`rotate(${angleOffset}rad) translate(${radius}px)`}
      >
        <Box
          w="48px"
          h="48px"
          borderRadius="full"
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg={orbitColor}
          boxShadow="lg"
          backdropFilter="blur(8px)"
        >
          <Image
            src={logo}
            alt="crypto logo"
            w="28px"
            h="28px"
            objectFit="contain"
          />
        </Box>
      </Box>
    </MotionBox>
  );
}
