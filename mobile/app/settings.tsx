/**
 * Settings — theme + language + account preferences.
 */

import { Alert, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenShell, Panel, PanelRow } from '@/components/ui/ScreenShell';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useI18n, LOCALE_META } from '@/store/i18nStore';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';

export default function Settings() {
  const h = useHaptics();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const toggleTheme = useTheme((s) => s.toggle);
  const setMode = useTheme((s) => s.setMode);
  const locale = useI18n((s) => s.locale);
  const setLocale = useI18n((s) => s.setLocale);
  const user = useAuthStore((s) => s.user);

  return (
    <ScreenShell title="Settings">
      {/* Account info */}
      <Panel style={{ marginTop: 18, padding: 16 }}>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
          ACCOUNT
        </Text>
        <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700', marginTop: 6 }}>
          {user ? `${user.firstName} ${user.lastName}` : 'Not signed in'}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 2 }}>
          {user?.email ?? '—'}
        </Text>
      </Panel>

      {/* Theme */}
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 22, marginLeft: 4 }}>
        APPEARANCE
      </Text>
      <Panel style={{ marginTop: 8 }}>
        <PanelRow
          icon="contrast-outline"
          label={`Theme · ${themeMode === 'dark' ? 'Dark' : 'Light'}`}
          onPress={() => { h.selection(); toggleTheme(); }}
          right={<Ionicons name="swap-horizontal" size={16} color={p.fgFaint} />}
        />
        <PanelRow
          icon="moon-outline"
          label="Use dark"
          last
          onPress={() => { h.selection(); setMode('dark'); }}
          right={themeMode === 'dark'
            ? <Ionicons name="checkmark-circle" size={18} color={p.greenFg} />
            : null}
        />
      </Panel>

      {/* Language */}
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 22, marginLeft: 4 }}>
        LANGUAGE
      </Text>
      <Panel style={{ marginTop: 8 }}>
        {(Object.keys(LOCALE_META) as Array<keyof typeof LOCALE_META>).map((code, i, arr) => (
          <PanelRow
            key={code}
            icon="language-outline"
            label={`${LOCALE_META[code].flag}  ${LOCALE_META[code].label}`}
            last={i === arr.length - 1}
            onPress={() => { h.selection(); setLocale(code); }}
            right={locale === code
              ? <Ionicons name="checkmark-circle" size={18} color={p.greenFg} />
              : null}
          />
        ))}
      </Panel>

      {/* Privacy / about */}
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 22, marginLeft: 4 }}>
        ABOUT
      </Text>
      <Panel style={{ marginTop: 8 }}>
        <PanelRow
          icon="document-text-outline"
          label="Terms of service"
          onPress={() => Alert.alert('Terms', 'Available at https://promrkts.app/terms')}
        />
        <PanelRow
          icon="lock-closed-outline"
          label="Privacy policy"
          onPress={() => Alert.alert('Privacy', 'Available at https://promrkts.app/privacy')}
        />
        <PanelRow
          icon="help-circle-outline"
          label="Help & support"
          last
          onPress={() => Alert.alert('Support', 'Email support@promrkts.app')}
        />
      </Panel>

      <View style={{ alignItems: 'center', marginTop: 28 }}>
        <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '500' }}>
          Promrkts · v0.1.0
        </Text>
      </View>
    </ScreenShell>
  );
}
