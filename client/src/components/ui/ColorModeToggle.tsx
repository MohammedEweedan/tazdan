'use client';

import { Box, Icon, useColorMode } from '@chakra-ui/react';
import { FiMoon, FiSun } from 'react-icons/fi';

/** A conventional sun/moon control with the same visual language as the nav. */
export default function ColorModeToggle({ size = 26 }: { size?: number }) {
  const { colorMode, toggleColorMode } = useColorMode();
  const dark = colorMode === 'dark';
  const fg = dark ? '#FFFFFF' : '#0A0A0B';
  const border = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const hoverBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.055)';
  const iconSize = Math.max(14, Math.round(size * 0.46));

  return (
    <Box
      as="button"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleColorMode}
      position="relative"
      w={`${size}px`}
      h={`${size}px`}
      borderRadius="50%"
      flexShrink={0}
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      bg="transparent"
      color={fg}
      border="1px solid"
      borderColor={border}
      transition="transform .18s ease, background .18s ease, border-color .18s ease"
      _hover={{ bg: hoverBg, borderColor: fg, transform: 'translateY(-1px)' }}
      _active={{ transform: 'scale(0.96)' }}
    >
      <Icon as={dark ? FiSun : FiMoon} boxSize={`${iconSize}px`} strokeWidth="2" />
    </Box>
  );
}
