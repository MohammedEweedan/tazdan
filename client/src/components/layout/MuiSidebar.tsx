'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Box,
  Divider,
  IconButton,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Home,
  SwapHoriz,
  ArrowDownward,
  ArrowUpward,
  AccountBalanceWallet,
  Receipt,
  PieChart,
  Timeline,
  Security,
  Settings,
  Logout,
  TrendingUp,
  Menu,
  Close,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/authStore';

const drawerWidth = 280;

interface MuiSidebarProps {
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
}

export default function MuiSidebar({ open, onClose, isMobile }: MuiSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/dashboard/trade', label: 'Trade', icon: SwapHoriz },
    { href: '/dashboard/deposit', label: 'Deposit', icon: ArrowDownward },
    { href: '/dashboard/withdraw', label: 'Withdraw', icon: ArrowUpward },
    { href: '/dashboard/wallet', label: 'Wallets', icon: AccountBalanceWallet },
    { href: '/dashboard/orders', label: 'Orders', icon: Receipt },
    { href: '/dashboard/portfolio', label: 'Portfolio', icon: PieChart },
    { href: '/dashboard/activity', label: 'Activity', icon: Timeline },
    { href: '/dashboard/kyc', label: 'KYC', icon: Security },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    onClose();
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Toolbar sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ 
            width: 40, 
            height: 40, 
            borderRadius: 2, 
            background: 'linear-gradient(135deg, #1976d2, #42a5f5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TrendingUp sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #1976d2, #42a5f5)', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent' }}>
            Global Exchange
          </Typography>
        </Box>
        {isMobile && (
          <IconButton onClick={onClose} sx={{ ml: 'auto' }}>
            <Close />
          </IconButton>
        )}
      </Toolbar>

      {/* User Info */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {(user as any)?.avatarUrl ? (
            <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', bgcolor: 'rgba(125,125,125,0.12)', border: '1px solid rgba(125,125,125,0.2)' }}>
              {(user as any).avatarUrl}
            </Box>
          ) : (
            <Avatar sx={{ width: 40, height: 40 }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </Avatar>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.email}
            </Typography>
            <Badge 
              badgeContent={user?.kycStatus || 'NOT_SUBMITTED'} 
              color={user?.kycStatus === 'APPROVED' ? 'success' : user?.kycStatus === 'PENDING' ? 'warning' : 'error'}
              sx={{ mt: 0.5 }}
            />
          </Box>
        </Box>
      </Box>

      {/* Navigation */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <List sx={{ p: 1 }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
            return (
              <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
                <Tooltip title={item.label} placement="right" arrow>
                  <ListItemButton
                    component={NextLink}
                    href={item.href}
                    selected={isActive}
                    onClick={isMobile ? onClose : undefined}
                    sx={{
                      borderRadius: 2,
                      '&.Mui-selected': {
                        backgroundColor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': {
                          backgroundColor: 'primary.dark',
                        },
                        '& .MuiListItemIcon-root': {
                          color: 'primary.contrastText',
                        },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <item.icon />
                    </ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Bottom Actions */}
      <Box sx={{ borderTop: 1, borderColor: 'divider', p: 1 }}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: 2,
              color: 'error.main',
              '&:hover': {
                backgroundColor: 'error.light',
                color: 'error.contrastText',
              },
              '& .MuiListItemIcon-root': {
                color: 'inherit',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Logout />
            </ListItemIcon>
            <ListItemText primary="Sign Out" />
          </ListItemButton>
        </ListItem>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'persistent'}
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
          position: isMobile ? 'fixed' : 'relative',
          height: isMobile ? '100vh' : 'auto',
          zIndex: isMobile ? 1200 : 1,
        },
      }}
      ModalProps={{
        keepMounted: true, // Better open performance on mobile.
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
