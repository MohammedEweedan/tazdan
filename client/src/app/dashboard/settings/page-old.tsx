'use client';

import { useState } from 'react';
import {
  Box, Heading, Text, Button, Input, FormControl, FormLabel, Switch,
  Tabs, TabList, TabPanels, Tab, TabPanel, useColorModeValue, useColorMode,
  useToast, VStack, HStack, Divider, Image,
} from '@chakra-ui/react';
import { useTranslate, useTolgee } from '@tolgee/react';
import { userAPI, authAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export default function SettingsPage() {
  const { t } = useTranslate();
  const tolgee = useTolgee(['language']);
  const toast = useToast();
  const { colorMode, toggleColorMode } = useColorMode();
  const { user, fetchUser } = useAuthStore();
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [qrCode, setQrCode] = useState('');

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      await userAPI.updateProfile({ firstName, lastName, phone });
      toast({ title: t('common_success'), status: 'success' });
      fetchUser();
    } catch (error: any) {
      toast({ title: error.response?.data?.error || t('common_error'), status: 'error' });
    } finally { setProfileLoading(false); }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast({ title: 'Password must be at least 8 characters', status: 'warning' }); return; }
    setPasswordLoading(true);
    try {
      await userAPI.changePassword({ currentPassword, newPassword });
      toast({ title: t('common_success'), status: 'success' });
      setCurrentPassword(''); setNewPassword('');
    } catch (error: any) {
      toast({ title: error.response?.data?.error || t('common_error'), status: 'error' });
    } finally { setPasswordLoading(false); }
  };

  const handleToggle2FA = async () => {
    setTwoFALoading(true);
    try {
      if (user?.twoFactorEnabled) {
        await authAPI.disable2FA();
        toast({ title: '2FA disabled', status: 'info' });
        setQrCode('');
      } else {
        const res = await authAPI.enable2FA();
        setQrCode(res.data.qrCode || '');
        toast({ title: 'Scan QR code with your authenticator app', status: 'info' });
      }
      fetchUser();
    } catch (error: any) {
      toast({ title: error.response?.data?.error || t('common_error'), status: 'error' });
    } finally { setTwoFALoading(false); }
  };

  const switchLanguage = (lang: string) => {
    tolgee.changeLanguage(lang);
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <Box>
      <Heading size="lg" mb={6}>{t('settings_title')}</Heading>

      <Tabs colorScheme="brand">
        <TabList>
          <Tab>{t('settings_profile')}</Tab>
          <Tab>{t('settings_security')}</Tab>
          <Tab>{t('settings_language')} & {t('settings_theme')}</Tab>
        </TabList>

        <TabPanels>
          {/* Profile Tab */}
          <TabPanel px={0}>
            <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" p={6} maxW="lg">
              <form onSubmit={handleProfileUpdate}>
                <VStack spacing={4} align="stretch">
                  <FormControl>
                    <FormLabel fontSize="sm">{t('auth_first_name')}</FormLabel>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">{t('auth_last_name')}</FormLabel>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">{t('auth_phone')}</FormLabel>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </FormControl>
                  <Button type="submit" colorScheme="brand" isLoading={profileLoading}>{t('settings_save')}</Button>
                </VStack>
              </form>
            </Box>
          </TabPanel>

          {/* Security Tab */}
          <TabPanel px={0}>
            <VStack spacing={6} align="stretch" maxW="lg">
              <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" p={6}>
                <Heading size="sm" mb={4}>{t('settings_change_password')}</Heading>
                <form onSubmit={handlePasswordChange}>
                  <VStack spacing={4} align="stretch">
                    <FormControl isRequired>
                      <FormLabel fontSize="sm">{t('settings_current_password')}</FormLabel>
                      <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel fontSize="sm">{t('settings_new_password')}</FormLabel>
                      <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} />
                    </FormControl>
                    <Button type="submit" colorScheme="brand" isLoading={passwordLoading}>{t('settings_save')}</Button>
                  </VStack>
                </form>
              </Box>

              <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" p={6}>
                <HStack justify="space-between" mb={4}>
                  <Box>
                    <Heading size="sm">{user?.twoFactorEnabled ? t('settings_disable_2fa') : t('settings_enable_2fa')}</Heading>
                    <Text fontSize="sm" color="subtle-text" mt={1}>Add an extra layer of security to your account</Text>
                  </Box>
                  <Button colorScheme={user?.twoFactorEnabled ? 'red' : 'green'} size="sm" isLoading={twoFALoading} onClick={handleToggle2FA}>
                    {user?.twoFactorEnabled ? 'Disable' : 'Enable'}
                  </Button>
                </HStack>
                {qrCode && (
                  <Box textAlign="center" mt={4}>
                    <Image src={qrCode} alt="2FA QR Code" mx="auto" boxSize="200px" />
                    <Text fontSize="xs" color="subtle-text" mt={2}>Scan with Google Authenticator or Authy</Text>
                  </Box>
                )}
              </Box>
            </VStack>
          </TabPanel>

          {/* Language & Theme Tab */}
          <TabPanel px={0}>
            <VStack spacing={6} align="stretch" maxW="lg">
              <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" p={6}>
                <Heading size="sm" mb={4}>{t('settings_language')}</Heading>
                <HStack spacing={3}>
                  <Button variant={tolgee.getLanguage() === 'en' ? 'solid' : 'outline'} colorScheme="brand" onClick={() => switchLanguage('en')}>English</Button>
                  <Button variant={tolgee.getLanguage() === 'ar' ? 'solid' : 'outline'} colorScheme="brand" onClick={() => switchLanguage('ar')}>العربية</Button>
                </HStack>
              </Box>

              <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" p={6}>
                <Heading size="sm" mb={4}>{t('settings_theme')}</Heading>
                <HStack justify="space-between">
                  <Text fontSize="sm">{colorMode === 'dark' ? t('settings_dark_mode') : t('settings_light_mode')}</Text>
                  <Switch isChecked={colorMode === 'dark'} onChange={toggleColorMode} colorScheme="brand" />
                </HStack>
              </Box>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
