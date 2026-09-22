'use client';

import { Box, useColorMode } from '@chakra-ui/react';

/**
 * Theme toggle drawn as a filled disc.
 *
 * The mark is the INVERSE of the surface it sits on, so it is always visible:
 *
 *   light mode → a solid BLACK sun-disc on the light bar
 *   dark mode  → a WHITE crescent on the dark bar
 *
 * (A white disc in light mode — the first pass — was invisible against the
 * bar. Contrast has to come from inverting the surface, not from the icon.)
 *
 * The crescent is drawn, not glyphed: a second offset circle filled with the
 * bar colour bites into the disc. That keeps its weight exact at any size and
 * avoids depending on an icon font's idea of a moon.
 */
export default function ColorModeToggle({ size = 26 }: { size?: number }) {
  const { colorMode, toggleColorMode } = useColorMode();
  const dark = colorMode === 'dark';

  // Surface behind the toggle, used to cut the crescent.
  const bar = dark ? '#11141A' : '#FFFFFF';
  const disc = dark ? '#FFFFFF' : '#0A0A0B';

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
      overflow="hidden"
      bg={disc}
      boxShadow={dark
        ? '0 0 0 1px rgba(255,255,255,0.28), 0 2px 10px rgba(0,0,0,0.5)'
        : '0 0 0 1px rgba(10,15,30,0.18), 0 2px 10px rgba(10,15,30,0.18)'}
      transition="transform .2s ease, box-shadow .2s ease, background .2s ease"
      _hover={{ transform: 'scale(1.08)' }}
      _active={{ transform: 'scale(0.94)' }}
    >
      {dark && (
        <Box
          position="absolute"
          top="-24%"
          right="-32%"
          w={`${size}px`}
          h={`${size}px`}
          borderRadius="50%"
          bg={bar}
        />
      )}
    </Box>
  );
}
