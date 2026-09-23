import { Pressable, View } from 'react-native';
import { Text } from './Text';
import { BottomSheet } from './BottomSheet';
import { Ionicons } from '@expo/vector-icons';
import { useI18n, useT, LOCALE_META } from '@/store/i18nStore';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks/useHaptics';

export function LocalePickerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const p = useThemedPalette();
  const h = useHaptics();
  const t = useT();
  const locale = useI18n((s) => s.locale);
  const setLocale = useI18n((s) => s.setLocale);
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('modal.selectLanguage')}>
      <View accessibilityRole="radiogroup" style={{ gap: 8, paddingBottom: 8 }}>
        {(Object.keys(LOCALE_META) as Array<keyof typeof LOCALE_META>).map((code) => {
          const meta = LOCALE_META[code];
          const active = locale === code;
          return (
            <Pressable key={code} accessibilityRole="radio" accessibilityLabel={meta.label} accessibilityState={{ checked: active }}
              onPress={() => { h.selection(); setLocale(code); onClose(); }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: active ? p.accentSoft : pressed ? p.bgRaised : p.bg, borderWidth: 1, borderColor: active ? p.accentBorder : p.border })}>
              <Text style={{ fontSize: 22 }}>{meta.flag}</Text>
              <Text style={{ flex: 1, color: p.fg, fontSize: 15, fontWeight: active ? '600' : '500' }}>{meta.label}</Text>
              {active && <Ionicons name="checkmark-circle" size={20} color={p.accentText} />}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
