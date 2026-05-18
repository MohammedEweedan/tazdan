import { Modal, Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useI18n, useT, LOCALE_META } from '@/store/i18nStore';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function LocalePickerModal({ visible, onClose }: Props) {
  const p = useThemedPalette();
  const h = useHaptics();
  const t = useT();
  const locale = useI18n((s) => s.locale);
  const setLocale = useI18n((s) => s.setLocale);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: p.bg,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <View style={{
            width: 36, height: 4, borderRadius: 2,
            backgroundColor: p.border, alignSelf: 'center', marginBottom: 18,
          }} />

          <Text style={{ color: p.fg, fontSize: 17, fontWeight: '700', marginBottom: 16 }}>
            {t('modal.selectLanguage')}
          </Text>

          <View style={{ gap: 8 }}>
            {(Object.keys(LOCALE_META) as Array<keyof typeof LOCALE_META>).map((code) => {
              const meta = LOCALE_META[code];
              const active = locale === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => { h.selection(); setLocale(code); onClose(); }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    padding: 14, borderRadius: 14,
                    backgroundColor: active ? `${p.ctaBg}18` : pressed ? p.bgElev : p.bgElev,
                    borderWidth: 1.5, borderColor: active ? p.ctaBg : 'transparent',
                  })}
                >
                  <Text style={{ fontSize: 22 }}>{meta.flag}</Text>
                  <Text style={{ flex: 1, color: p.fg, fontSize: 15, fontWeight: active ? '700' : '600' }}>
                    {meta.label}
                  </Text>
                  {active && <Ionicons name="checkmark-circle" size={20} color={p.ctaBg} />}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              marginTop: 16, paddingVertical: 14, borderRadius: 14,
              backgroundColor: pressed ? p.bgElev : p.pillBg,
              borderWidth: 1, borderColor: p.border,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: p.fgMuted, fontSize: 15, fontWeight: '700' }}>
              {t('common.cancel')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
