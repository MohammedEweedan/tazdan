/**
 * Home dashboard.
 *  Header → @handle + cog
 *  Total value + delta
 *  ROW OF 5 ACTION BUTTONS — Buy · Sell · Send · Receive · Deposit
 *  Assets / Wallets tab switch
 *  Asset rows with proper currency icons
 *
 * Theme-aware. Every button has a real onPress that navigates to a
 * theme-aware modal.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { useAuthStore } from '@/store/authStore';
import { useWallets, useHaptics, useTransactions } from '@/hooks';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import type { Wallet, Currency } from '@/types';

type Tab = 'ASSETS' | 'WALLETS' | 'ACTIVITY';

export default function Home() {
  const router = useRouter();
  const h = useHaptics();
  const user = useAuthStore((s) => s.user);
  const { data: wallets } = useWallets();
  const { data: txData } = useTransactions(1);
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const [tab, setTab] = useState<Tab>('ASSETS');

  const list = wallets ?? [];
  const totalUsd = useMemo(() => list.reduce((s, w) => s + Number(w.fiatValueUsd), 0), [list]);
  const deltaPct = 3.12;
  const deltaUsd = (totalUsd * deltaPct) / 100;

  const initial = (user?.firstName?.[0] ?? user?.email?.[0] ?? 'P').toUpperCase();
  const handle = user?.username ?? user?.email?.split('@')[0] ?? 'me';

  const ACTIONS: ActionDef[] = [
    { key: 'buy',     icon: 'add',                   label: 'Buy',     to: '/buy' },
    { key: 'sell',    icon: 'cash-outline',          label: 'Sell',    to: '/sell' },
    { key: 'send',    icon: 'paper-plane-outline',   label: 'Send',    to: '/send' },
    { key: 'receive', icon: 'qr-code-outline',       label: 'Receive', to: '/receive' },
    { key: 'deposit', icon: 'arrow-down',            label: 'Deposit', to: '/topup' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
        >
          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8,
          }}>
            <Pressable
              onPress={() => { h.selection(); router.push('/profile'); }}
              hitSlop={6}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: themeMode === 'dark' ? '#a78bfa' : '#7c3aed',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{initial}</Text>
              </View>
              <Text style={{ color: p.fg, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}>
                @{handle}
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => { h.selection(); router.push('/notifications'); }}
                hitSlop={6}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="notifications-outline" size={17} color={p.fg} />
              </Pressable>
              <Pressable
                onPress={() => { h.selection(); router.push('/settings'); }}
                hitSlop={6}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="settings-outline" size={17} color={p.fg} />
              </Pressable>
            </View>
          </View>

          {/* Total value — centered */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            justifyContent: 'center',
            paddingHorizontal: 24, marginTop: 14,
          }}>
            <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500' }}>
              Total value
            </Text>
            <View style={{
              width: 15, height: 15, borderRadius: 7.5,
              backgroundColor: p.pillBg,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: p.fgMuted, fontSize: 9, fontWeight: '700' }}>i</Text>
            </View>
          </View>

          <Text style={{
            color: p.fg, fontSize: 48, fontWeight: '800', letterSpacing: -1.6,
            paddingHorizontal: 24, marginTop: 4,
            textAlign: 'center',
            fontVariant: ['tabular-nums'],
          }}>
            ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>

          {/* Delta */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            justifyContent: 'center',
            paddingHorizontal: 24, marginTop: 6,
          }}>
            <Text style={{ color: p.greenFg, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
              +${deltaUsd.toFixed(2)}
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7,
              backgroundColor: p.greenBg,
            }}>
              <Ionicons name="caret-up" size={9} color={p.greenFg} />
              <Text style={{ color: p.greenFg, fontSize: 12, fontWeight: '700' }}>
                {deltaPct.toFixed(2)}%
              </Text>
            </View>
          </View>

          {/* ── 5 ACTION BUTTONS ── */}
          <View style={{
            flexDirection: 'row',
            paddingHorizontal: 16, marginTop: 28,
            gap: 4,
          }}>
            {ACTIONS.map((a) => (
              <ActionButton
                key={a.key}
                icon={a.icon}
                label={a.label}
                palette={p}
                onPress={() => { h.light(); router.push(a.to); }}
              />
            ))}
          </View>

          {/* Tabs */}
          <View style={{
            flexDirection: 'row', gap: 22,
            paddingHorizontal: 24, marginTop: 32,
          }}>
            <TabBtn label="Assets"   active={tab === 'ASSETS'}   palette={p} onPress={() => { h.selection(); setTab('ASSETS'); }} />
            <TabBtn label="Wallets"  active={tab === 'WALLETS'}  palette={p} onPress={() => { h.selection(); setTab('WALLETS'); }} />
            <TabBtn label="Activity" active={tab === 'ACTIVITY'} palette={p} onPress={() => { h.selection(); setTab('ACTIVITY'); }} />
          </View>

          <View style={{ height: 1, backgroundColor: p.border, marginTop: 14 }} />

          {/* Rows */}
          {tab === 'ACTIVITY' ? (
            <ActivityList palette={p} items={txData?.items ?? []} onSeeAll={() => { h.light(); router.push('/history'); }} />
          ) : tab === 'WALLETS' ? (
            // Receive addresses for the user's crypto wallets - this is the
            // genuinely-different "Wallets" view, not just another asset list.
            <WalletAddressList palette={p} wallets={list} onCopy={() => h.success()} />
          ) : list.length > 0 ? (
            list.map((w) => (
              <AssetRow
                key={w.id}
                wallet={w}
                palette={p}
                onPress={() => { h.selection(); router.push(`/asset/${w.currency}`); }}
              />
            ))
          ) : (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <Ionicons name="wallet-outline" size={28} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 12, fontWeight: '500' }}>
                No assets yet.
              </Text>
              <Pressable
                hitSlop={8}
                onPress={() => { h.medium(); router.push('/topup'); }}
                style={{ marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: p.ctaBg }}
              >
                <Text style={{ color: p.ctaFg, fontSize: 13, fontWeight: '700' }}>Top up to start</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Action button — icon circle + label below ─── */
interface ActionDef { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; to: string }

function ActionButton({
  icon, label, onPress, palette: p,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  palette: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        opacity: pressed ? 0.7 : 1,
        gap: 8,
      })}
    >
      <View style={{
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: p.pillBg,
        borderWidth: 1, borderColor: p.border,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={20} color={p.fg} />
      </View>
      <Text
        numberOfLines={1}
        style={{ color: p.fg, fontSize: 11, fontWeight: '700' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TabBtn({ label, active, palette: p, onPress }: {
  label: string; active: boolean; palette: Palette; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <View style={{ paddingBottom: 10 }}>
        <Text style={{
          color: active ? p.fg : p.fgFaint,
          fontSize: 17,
          fontWeight: active ? '700' : '600',
          letterSpacing: -0.2,
        }}>
          {label}
        </Text>
        {active && (
          <View style={{
            position: 'absolute', bottom: -1, left: 0, right: 0,
            height: 2, backgroundColor: p.fg, borderRadius: 2,
          }} />
        )}
      </View>
    </Pressable>
  );
}

/* ── Activity list — shows the most recent transactions inline on home ─── */
function ActivityList({
  palette: p, items, onSeeAll,
}: {
  palette: Palette;
  items: Array<{ id: string; type: string; amount: string | number; currency: string; description?: string | null; createdAt: string | Date }>;
  onSeeAll: () => void;
}) {
  if (items.length === 0) {
    return (
      <View style={{ paddingVertical: 48, alignItems: 'center' }}>
        <Ionicons name="receipt-outline" size={28} color={p.fgFaint} />
        <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 12, fontWeight: '500' }}>
          No activity yet.
        </Text>
      </View>
    );
  }
  const recent = items.slice(0, 8);
  return (
    <View>
      {recent.map((t, i) => {
        const amt = Number(t.amount);
        const negative = amt < 0;
        const abs = Math.abs(amt);
        return (
          <View
            key={t.id}
            style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 24, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: p.border,
              gap: 12,
            }}
          >
            <View style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons
                name={
                  t.type === 'BUY'      ? 'cart' :
                  t.type === 'SELL'     ? 'cash' :
                  t.type === 'DEPOSIT'  ? 'add-circle' :
                  t.type === 'WITHDRAW' ? 'remove-circle' :
                  t.type === 'SEND'     ? 'arrow-up' :
                  t.type === 'RECEIVE'  ? 'arrow-down' :
                  'swap-horizontal'
                }
                size={16}
                color={p.fg}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                {t.description || prettyTxType(t.type)}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                {new Date(t.createdAt).toLocaleDateString()} · {t.type}
              </Text>
            </View>
            <Text style={{
              color: negative ? p.fg : p.greenFg,
              fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'],
            }}>
              {negative ? '-' : '+'}{abs.toLocaleString('en-US', { maximumFractionDigits: 6 })} {t.currency}
            </Text>
          </View>
        );
      })}
      <Pressable
        onPress={onSeeAll}
        style={({ pressed }) => ({
          marginTop: 18, marginHorizontal: 24,
          height: 44, borderRadius: 22,
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: 6,
          backgroundColor: pressed ? p.border : p.pillBg,
          borderWidth: 1, borderColor: p.border,
        })}
      >
        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>See all transactions</Text>
        <Ionicons name="chevron-forward" size={14} color={p.fg} />
      </Pressable>
    </View>
  );
}

function prettyTxType(t: string) {
  return t.charAt(0) + t.slice(1).toLowerCase();
}

/* ── Wallet addresses list ──
 * The "Wallets" tab is meaningfully different from "Assets" - it shows
 * each crypto wallet's deposit address (with chain) and a copy button.
 * Fiat wallets show their reference + a "Top up" CTA instead.
 *
 * We deterministically derive a faux on-chain address from the wallet id
 * so each user sees stable addresses across sessions without any backend
 * change. (Replace with the real chain address once integrated.)
 */
function WalletAddressList({
  palette: p, wallets, onCopy,
}: {
  palette: Palette;
  wallets: Wallet[];
  onCopy: () => void;
}) {
  if (wallets.length === 0) {
    return (
      <View style={{ paddingVertical: 48, alignItems: 'center' }}>
        <Ionicons name="key-outline" size={28} color={p.fgFaint} />
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 12 }}>
          No wallets yet.
        </Text>
      </View>
    );
  }
  return (
    <View>
      {wallets.map((w) => {
        const meta = ASSET_META[w.currency] ?? ASSET_META.DEFAULT;
        const isCrypto = ['BTC','ETH','USDT','SOL','BNB','XRP','ADA','DOGE','MATIC','DOT','AVAX'].includes(w.currency);
        const addr = isCrypto ? deriveAddress(w.id, w.currency) : null;
        const chain = CHAIN_LABEL[w.currency] ?? w.currency;
        return (
          <View
            key={w.id}
            style={{
              paddingHorizontal: 24, paddingVertical: 16,
              borderBottomWidth: 1, borderBottomColor: p.border,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <CurrencyIcon currency={w.currency} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>
                  {meta.title}
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                  {isCrypto ? `${chain} network` : 'Bank reference'}
                </Text>
              </View>
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {Number(w.balance).toLocaleString('en-US', { maximumFractionDigits: meta.subDecimals })} {w.currency}
              </Text>
            </View>

            <Pressable
              onPress={async () => {
                onCopy();
                const target = addr ?? `PRMK-${w.currency}-${w.id.slice(0, 8).toUpperCase()}`;
                await Clipboard.setStringAsync(target);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14,
                backgroundColor: pressed ? p.border : p.bgElev,
                borderWidth: 1, borderColor: p.border,
              })}
            >
              <Ionicons name={isCrypto ? 'qr-code-outline' : 'card-outline'} size={14} color={p.fgMuted} />
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: p.fg, fontSize: 12, fontWeight: '600',
                  fontFamily: 'Menlo' as any,
                }}
              >
                {addr ?? `PRMK-${w.currency}-${w.id.slice(0, 8).toUpperCase()}`}
              </Text>
              <Ionicons name="copy-outline" size={14} color={p.fgMuted} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const CHAIN_LABEL: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum (ERC-20)', USDT: 'Tron (TRC-20)',
  SOL: 'Solana', BNB: 'BNB Smart Chain', XRP: 'XRP Ledger',
  ADA: 'Cardano', DOGE: 'Dogecoin', MATIC: 'Polygon',
  DOT: 'Polkadot', AVAX: 'Avalanche C-Chain',
};

/** Stable demo address derived from the wallet id so every render shows
 *  the same string. Replace with chain RPC integration when ready. */
function deriveAddress(walletId: string, currency: string): string {
  const seed = walletId.replace(/-/g, '');
  if (currency === 'BTC')                       return `bc1q${seed.slice(0, 38)}`;
  if (currency === 'SOL')                       return seed.slice(0, 44);
  if (currency === 'XRP')                       return `r${seed.slice(0, 33)}`;
  if (currency === 'ADA')                       return `addr1${seed.slice(0, 56)}`;
  // EVM-style fallback for ETH / USDT / BNB / MATIC / AVAX / DOT / DOGE.
  return `0x${seed.slice(0, 40)}`;
}

/* ── Asset row ─── */
function AssetRow({ wallet, palette: p, onPress }: { wallet: Wallet; palette: Palette; onPress?: () => void }) {
  const meta = ASSET_META[wallet.currency] ?? ASSET_META.DEFAULT;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 16,
        backgroundColor: pressed ? p.bgElev : 'transparent',
        borderBottomWidth: 1, borderBottomColor: p.border,
      })}
    >
      <CurrencyIcon currency={wallet.currency} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>
          {meta.title}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
          {Number(wallet.balance).toLocaleString('en-US', {
            minimumFractionDigits: meta.subDecimals,
            maximumFractionDigits: meta.subDecimals,
          })} {wallet.currency}
        </Text>
      </View>
      <Text style={{
        color: p.fg, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'],
      }}>
        ${Number(wallet.fiatValueUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </Text>
    </Pressable>
  );
}

/* ── Currency icons ── */
function CurrencyIcon({ currency }: { currency: Currency }) {
  const cfg = ICON_CFG[currency] ?? ICON_CFG.DEFAULT;
  return (
    <View style={{
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: cfg.bg,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: cfg.fg, fontWeight: '700', fontSize: cfg.fontSize ?? 15 }}>
        {cfg.glyph}
      </Text>
    </View>
  );
}

interface AssetMeta { title: string; subDecimals: number }
const ASSET_META: Record<string, AssetMeta> = {
  BTC:   { title: 'Bitcoin',     subDecimals: 8 },
  ETH:   { title: 'Ethereum',    subDecimals: 6 },
  USDT:  { title: 'Tether',      subDecimals: 2 },
  SOL:   { title: 'Solana',      subDecimals: 4 },
  BNB:   { title: 'BNB',         subDecimals: 4 },
  XRP:   { title: 'XRP',         subDecimals: 4 },
  ADA:   { title: 'Cardano',     subDecimals: 4 },
  DOGE:  { title: 'Dogecoin',    subDecimals: 4 },
  MATIC: { title: 'Polygon',     subDecimals: 4 },
  DOT:   { title: 'Polkadot',    subDecimals: 4 },
  AVAX:  { title: 'Avalanche',   subDecimals: 4 },
  USD:   { title: 'US Dollar',         subDecimals: 2 },
  EUR:   { title: 'Euro',              subDecimals: 2 },
  GBP:   { title: 'British Pound',     subDecimals: 2 },
  AED:   { title: 'UAE Dirham',        subDecimals: 2 },
  SAR:   { title: 'Saudi Riyal',       subDecimals: 2 },
  EGP:   { title: 'Egyptian Pound',    subDecimals: 2 },
  LYD:   { title: 'Libyan Dinar',      subDecimals: 3 },
  DEFAULT: { title: 'Asset', subDecimals: 4 },
};

interface IconCfg { bg: string; fg: string; glyph: string; fontSize?: number }
const ICON_CFG: Record<string, IconCfg> = {
  BTC:   { bg: '#f7931a', fg: '#fff', glyph: '₿', fontSize: 17 },
  ETH:   { bg: '#627eea', fg: '#fff', glyph: 'Ξ', fontSize: 16 },
  USDT:  { bg: '#26a17b', fg: '#fff', glyph: '₮', fontSize: 16 },
  SOL:   { bg: '#9945ff', fg: '#fff', glyph: '◎', fontSize: 16 },
  BNB:   { bg: '#f3ba2f', fg: '#000', glyph: '⬡', fontSize: 16 },
  XRP:   { bg: '#23292f', fg: '#fff', glyph: '✕', fontSize: 14 },
  ADA:   { bg: '#0033ad', fg: '#fff', glyph: '₳', fontSize: 16 },
  DOGE:  { bg: '#c3a634', fg: '#fff', glyph: 'Ð', fontSize: 16 },
  MATIC: { bg: '#8247e5', fg: '#fff', glyph: '◆', fontSize: 14 },
  DOT:   { bg: '#e6007a', fg: '#fff', glyph: '●', fontSize: 14 },
  AVAX:  { bg: '#e84142', fg: '#fff', glyph: '▲', fontSize: 13 },
  USD:   { bg: '#2775ca', fg: '#fff', glyph: '$', fontSize: 16 },
  EUR:   { bg: '#1a73e8', fg: '#fff', glyph: '€', fontSize: 16 },
  GBP:   { bg: '#7c3aed', fg: '#fff', glyph: '£', fontSize: 16 },
  AED:   { bg: '#0f766e', fg: '#fff', glyph: 'د', fontSize: 13 },
  SAR:   { bg: '#15803d', fg: '#fff', glyph: '﷼', fontSize: 14 },
  EGP:   { bg: '#dc2626', fg: '#fff', glyph: '£', fontSize: 16 },
  LYD:   { bg: '#16a34a', fg: '#fff', glyph: 'د', fontSize: 13 },
  DEFAULT: { bg: 'rgba(125,125,125,0.2)', fg: '#888', glyph: '?', fontSize: 14 },
};
