/**
 * Linked Accounts — Shows all linked cards and bank accounts
 * Allows users to manage their payment methods
 */

import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useHaptics } from '@/hooks';
import { cardsService, bankAccountService } from '@/services';
import type { CardEntity, BankAccount } from '@/types';
import { TopGradient } from '@/components/ui/ScreenShell';

import { BottomSheet } from '@/components/ui/BottomSheet';
export default function LinkedAccountsPage() {
  const p = useThemedPalette();
  const t = useT();
  const haptics = useHaptics();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedTab, setSelectedTab] = useState<'cards' | 'bank'>('cards');
  const [editBankModal, setEditBankModal] = useState<BankAccount | null>(null);
  const [deleteBankModal, setDeleteBankModal] = useState<BankAccount | null>(null);

  const { data: cards = [], isLoading: loadingCards } = useQuery({
    queryKey: ['cards'],
    queryFn: cardsService.list,
  });

  const { data: bankAccounts = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: bankAccountService.list,
  });

  const handleSetDefault = async (bank: BankAccount) => {
    try {
      await bankAccountService.setDefault(bank.id);
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      haptics.success();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to set default');
    }
  };

  const handleDeleteBank = async () => {
    if (!deleteBankModal) return;
    try {
      // Delete bank account - for now just show alert since delete API doesn't exist
      Alert.alert('Delete Bank Account', 'This feature is not yet implemented', [
        { text: 'OK', onPress: () => setDeleteBankModal(null) }
      ]);
      setDeleteBankModal(null);
      haptics.success();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to delete bank account');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        {/* Header */}
        <Text style={{ color: p.fg, fontSize: 28, fontWeight: '600', letterSpacing: -0.8, marginBottom: 4 }}>
          {t('profile.row.linkedAccounts')}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500', marginBottom: 20 }}>
          Manage your payment methods
        </Text>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', backgroundColor: p.bgElev, borderRadius: 12, padding: 4, marginBottom: 20 }}>
          <Pressable
            onPress={() => { haptics.selection(); setSelectedTab('cards'); }}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: 10, borderRadius: 10,
              backgroundColor: selectedTab === 'cards' ? p.ctaBg : 'transparent',
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: selectedTab === 'cards' ? p.ctaFg : p.fgMuted, fontSize: 14, fontWeight: '700' }}>
              Cards
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { haptics.selection(); setSelectedTab('bank'); }}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: 10, borderRadius: 10,
              backgroundColor: selectedTab === 'bank' ? p.ctaBg : 'transparent',
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: selectedTab === 'bank' ? p.ctaFg : p.fgMuted, fontSize: 14, fontWeight: '700' }}>
              Bank Accounts
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        {selectedTab === 'cards' ? (
          loadingCards ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <LoadingPulse size={64} icon="card-outline" />
            </View>
          ) : cards.length === 0 ? (
            <View style={{
              backgroundColor: p.bgElev, borderRadius: 16,
              borderWidth: 1, borderColor: p.border,
              padding: 32, alignItems: 'center', marginBottom: 20,
            }}>
              <Ionicons name="card-outline" size={48} color={p.fgMuted} style={{ marginBottom: 12 }} />
              <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
                No cards yet
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                Add a card to start making payments
              </Text>
              <Pressable
                onPress={() => router.push('/cards')}
                style={({ pressed }) => ({
                  paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: p.ctaBg, borderWidth: 1, borderColor: p.ctaBg,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: p.ctaFg, fontSize: 14, fontWeight: '700' }}>
                  Add Card
                </Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }}>
              {cards.map((card) => (
                <View
                  key={card.id}
                  style={{
                    backgroundColor: p.bgElev, borderRadius: 14,
                    borderWidth: 1, borderColor: p.border,
                    padding: 16, marginBottom: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{
                        width: 48, height: 32, borderRadius: 8,
                        backgroundColor: card.tier === 'MASTER' ? '#122050' : card.tier === 'PRO' ? '#2B6BC8' : '#5F99D8',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>VISA</Text>
                      </View>
                      <View>
                        <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>
                          {card.nickname || 'Virtual Card'}
                        </Text>
                        <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 2 }}>
                          •••• {card.last4}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{
                        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                        backgroundColor: card.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      }}>
                        <Text style={{
                          color: card.status === 'ACTIVE' ? '#22c55e' : '#ef4444',
                          fontSize: 11, fontWeight: '700',
                        }}>
                          {card.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <Pressable
                      onPress={() => router.push(`/cards`)}
                      style={({ pressed }) => ({
                        flex: 1, paddingVertical: 10, borderRadius: 8,
                        backgroundColor: p.bg, borderWidth: 1, borderColor: p.border,
                        alignItems: 'center', justifyContent: 'center',
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>Manage</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          )
        ) : (
          loadingBanks ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <LoadingPulse size={64} icon="business-outline" />
            </View>
          ) : bankAccounts.length === 0 ? (
            <View style={{
              backgroundColor: p.bgElev, borderRadius: 16,
              borderWidth: 1, borderColor: p.border,
              padding: 32, alignItems: 'center', marginBottom: 20,
            }}>
              <Ionicons name="business-outline" size={48} color={p.fgMuted} style={{ marginBottom: 12 }} />
              <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
                No bank accounts yet
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                Add a bank account to withdraw funds
              </Text>
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => ({
                  paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: p.ctaBg, borderWidth: 1, borderColor: p.ctaBg,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: p.ctaFg, fontSize: 14, fontWeight: '700' }}>
                  Add Bank Account
                </Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }}>
              {bankAccounts.map((bank) => (
                <View
                  key={bank.id}
                  style={{
                    backgroundColor: p.bgElev, borderRadius: 14,
                    borderWidth: 1, borderColor: bank.isDefault ? p.ctaBg : p.border,
                    padding: 16, marginBottom: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{
                        width: 48, height: 32, borderRadius: 8,
                        backgroundColor: p.bg, borderWidth: 1, borderColor: p.border,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name="business-outline" size={20} color={p.fg} />
                      </View>
                      <View>
                        <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>
                          {bank.bankName}
                        </Text>
                        <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 2 }}>
                          •••• {bank.accountNumber.slice(-4)}
                        </Text>
                      </View>
                    </View>
                    {bank.isDefault && (
                      <View style={{
                        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      }}>
                        <Text style={{ color: p.ctaBg, fontSize: 11, fontWeight: '700' }}>
                          DEFAULT
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    {!bank.isDefault && (
                      <Pressable
                        onPress={() => handleSetDefault(bank)}
                        style={({ pressed }) => ({
                          flex: 1, paddingVertical: 10, borderRadius: 8,
                          backgroundColor: p.bg, borderWidth: 1, borderColor: p.border,
                          alignItems: 'center', justifyContent: 'center',
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>Set Default</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => setDeleteBankModal(bank)}
                      style={({ pressed }) => ({
                        flex: 1, paddingVertical: 10, borderRadius: 8,
                        backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
                        alignItems: 'center', justifyContent: 'center',
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          )
        )}
      </View>

      {/* Delete Bank Account Modal */}
      <BottomSheet visible={!!deleteBankModal} onClose={() => setDeleteBankModal(null)}>
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <Ionicons name="alert-circle" size={28} color="#ef4444" />
            </View>
            <Text style={{ color: p.fg, fontSize: 20, fontWeight: '600', marginBottom: 8 }}>
              Delete Bank Account
            </Text>
            {deleteBankModal && (
              <Text style={{ color: p.fgMuted, fontSize: 14, marginBottom: 20 }}>
                Are you sure you want to delete {deleteBankModal.bankName} (•••• {deleteBankModal.accountNumber.slice(-4)})?
              </Text>
            )}
            <View style={{ gap: 12 }}>
              <Pressable
                onPress={handleDeleteBank}
                style={({ pressed }) => ({
                  height: 56, borderRadius: 28,
                  backgroundColor: '#ef4444',
                  alignItems: 'center', justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Delete</Text>
              </Pressable>
              <Pressable
                onPress={() => setDeleteBankModal(null)}
                style={({ pressed }) => ({
                  height: 56, borderRadius: 28,
                  backgroundColor: p.bgElev,
                  borderWidth: 1, borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
            </View>
          </BottomSheet>
    </SafeAreaView>
  );
}
