'use client';

import { IconButton, useColorMode, useColorModeValue } from '@chakra-ui/react';
import { FiSun, FiMoon } from 'react-icons/fi';

export default function ColorModeToggle() {
  const { toggleColorMode } = useColorMode();
  const icon = useColorModeValue(<FiMoon />, <FiSun />);
  const label = useColorModeValue('Switch to dark mode', 'Switch to light mode');

  return (
    <IconButton
      aria-label={label}
      icon={icon}
      onClick={toggleColorMode}
      variant="ghost"
      size="sm"
    />
  );
}
