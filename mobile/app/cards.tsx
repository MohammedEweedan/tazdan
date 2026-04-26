/**
 * Linked cards — list user's cards. Theme-aware.
 */

import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenShell, CTAButton, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useCards, useHaptics } from '@/hooks';

export default function Cards() {
  const h = useHaptics();
  const p = useThemedPalette();
  const { data: cards } = useCards();

  return (
    <ScreenShell title="Linked cards">
      {(!cards || cards.length === 0) ? (
        <View style={{ alignItems: 'center', paddingVertical: 64 }}>
          <Ionicons name="card-outline" size={40} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', marginTop: 14 }}>
            No cards yet.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12, marginTop: 14 }}>
          {cards.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => { h.selection(); }}
              style={({ pressed }) => ({
                borderRadius: 20,
                backgroundColor: pressed ? p.border : p.bgElev,
                borderWidth: 1, borderColor: p.border,
                padding: 18,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 14,
                  backgroundColor: p.pillBg,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: p.border,
                }}>
                  <Ionicons name="card" size={20} color={p.fg} />
                </View>
                <View style={{
                  paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9,
                  backgroundColor: p.greenBg,
                }}>
                  <Text style={{ color: p.greenFg, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }}>
                    {c.status}
                  </Text>
                </View>
              </View>
              <Text style={{
                color: p.fg, fontSize: 18, fontWeight: '800',
                letterSpacing: 1.4, marginTop: 18, fontVariant: ['tabular-nums'],
              }}>
                •••• •••• •••• {c.last4}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                <View>
                  <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>
                    HOLDER
                  </Text>
                  <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                    {c.cardHolder}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>
                    DAILY LIMIT
                  </Text>
                  <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                    ${Number(c.dailyLimit).toLocaleString('en-US')}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ marginTop: 28 }}>
        <CTAButton
          label="Order new card"
          icon="add-circle"
          onPress={() => {
            h.medium();
            Alert.alert('Order card', 'New card issuance is coming soon. Contact support to enable beta access.');
          }}
        />
      </View>
    </ScreenShell>
  );
}
