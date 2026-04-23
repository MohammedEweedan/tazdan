'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Badge,
  Fab,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  AccountBalanceWallet,
  SwapHoriz,
  ArrowDownward,
  ArrowUpward,
  Settings,
  Menu,
  Close,
  Home,
  TrendingUp,
  Logout,
  Security,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/authStore';
import MuiSidebar from './MuiSidebar';

export default function MobileFooter() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const mainNavItems = [
    { href: '/dashboard/wallet', label: 'Wallet', icon: AccountBalanceWallet },
    { href: '/dashboard/trade', label: 'Trade', icon: SwapHoriz },
    { href: '/dashboard/deposit', label: 'Deposit', icon: ArrowDownward },
    { href: '/dashboard/withdraw', label: 'Withdraw', icon: ArrowUpward },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  ];

  const handleSidebarOpen = () => {
    setSidebarOpen(true);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    logout();
    handleSidebarClose();
  };

  return (
    <>
      {/* Mobile Footer Navigation */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <BottomNavigation
          sx={{
            width: '100%',
            height: 70,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 0,
              px: 1,
              '& .MuiSvgIcon-root': {
                fontSize: 24,
              },
            },
          }}
          value={mainNavItems.findIndex(item => pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href)))}
        >
          {mainNavItems.map((item, index) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
            return (
              <BottomNavigationAction
                key={item.href}
                component={NextLink}
                href={item.href}
                label={item.label}
                icon={<item.icon />}
                value={index}
                showLabel
                sx={{
                  color: isActive ? 'primary.main' : 'text.secondary',
                  '&.Mui-selected': {
                    color: 'primary.main',
                  },
                  '& .MuiBottomNavigationAction-label': {
                    fontSize: '0.7rem',
                    '&.Mui-selected': {
                      fontSize: '0.75rem',
                    },
                  },
                }}
              />
            );
          })}
        </BottomNavigation>
      </Box>

      {/* Floating Menu Button */}
      <Fab
        color="primary"
        aria-label="menu"
        onClick={handleSidebarOpen}
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 80,
          left: 16,
          zIndex: 999,
          width: 48,
          height: 48,
        }}
      >
        <Menu />
      </Fab>

      {/* Mobile Sidebar Drawer */}
      <MuiSidebar
        open={sidebarOpen}
        onClose={handleSidebarClose}
        isMobile={true}
      />
    </>
  );
}
