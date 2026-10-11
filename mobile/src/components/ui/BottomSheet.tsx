/**
 * BottomSheet — the one sheet shell for every modal in the app.
 *
 * Every sheet looks and behaves the same: same height, same rounding, same
 * header (title left, ✕ right), same backdrop. There is no drag handle —
 * the ✕, a backdrop tap or Android back closes it. If you find yourself
 * writing `<Modal transparent ...>` in a screen, stop and use this.
 *
 * Usage:
 *   <BottomSheet visible={open} onClose={() => setOpen(false)} title="Top up">
 *     <YourContent />
 *   </BottomSheet>
 *
 * `footer` renders pinned below the scrolling body (for a primary button).
 * `scroll={false}` when the content brings its own list (FlatList) — it then
 * gets the full body height to scroll in.
 */
import { ui } from '@/theme';
import { useT } from '@/store/i18nStore';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedPalette } from '@/store/themeStore';
import { HeaderIconButton } from '@/components/ui/ScreenHeader';

/** Every sheet opens to this share of the screen height. */
export const SHEET_HEIGHT_PCT = 88;

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Extra header controls, shown before the ✕. */
  right?: ReactNode;
  /** Wrap content in a ScrollView. Default true. */
  scroll?: boolean;
  /** Pinned below the body — e.g. the sheet's primary button. */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function BottomSheet({
  visible, onClose, title, subtitle, right,
  scroll = true, footer, contentStyle, children,
}: Props) {
  const p = useThemedPalette();
  const t = useT();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 16) + 8;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel={t('common.close')}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          {/* The inner Pressable absorbs taps so the sheet stays open
              when content is touched. */}
          <Pressable
            onPress={(e) => e.stopPropagation()}
            accessibilityViewIsModal
            style={{
              height: `${SHEET_HEIGHT_PCT}%`,
              backgroundColor: p.bgElev,
              borderTopLeftRadius: ui.sheetRadius,
              borderTopRightRadius: ui.sheetRadius,
              borderTopWidth: 1, borderColor: p.border,
              overflow: 'hidden',
              shadowColor: p.shadow,
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 1,
              shadowRadius: 22,
              elevation: 24,
            }}
          >
            <SheetHeader title={title} subtitle={subtitle} right={right} onClose={onClose} />

            {scroll ? (
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                  { paddingHorizontal: ui.gutter, paddingTop: 0, paddingBottom: footer ? 16 : bottomPad },
                  contentStyle,
                ]}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={[{ flex: 1, paddingHorizontal: ui.gutter, paddingTop: 0, paddingBottom: footer ? 0 : bottomPad }, contentStyle]}>
                {children}
              </View>
            )}

            {footer ? (
              <View style={{
                paddingHorizontal: ui.gutter, paddingTop: 12, paddingBottom: bottomPad,
                borderTopWidth: 1, borderTopColor: p.border, backgroundColor: p.bgElev,
              }}>
                {footer}
              </View>
            ) : null}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

/** Title (left) + ✕ (right) — the top of every sheet. */
export function SheetHeader({ title, subtitle, right, onClose }: {
  title?: string; subtitle?: string; right?: ReactNode; onClose: () => void;
}) {
  const p = useThemedPalette();
  const t = useT();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: ui.gutter, paddingTop: 14, paddingBottom: 8,
    }}>
      <View style={{ flex: 1 }}>
        {!!title && (
          <Text accessibilityRole="header" numberOfLines={1}
            style={{ color: p.fg, fontSize: 20, fontWeight: '600', letterSpacing: -0.4 }}>
            {title}
          </Text>
        )}
        {!!subtitle && (
          <Text numberOfLines={2} style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
      <HeaderIconButton icon="close" label={t('common.close')} onPress={onClose} />
    </View>
  );
}

/**
 * Section header inside a BottomSheet. Use to group related rows —
 * keeps spacing and typography consistent across every modal.
 */
export function SheetSection({
  label, hint, children,
}: { label: string; hint?: string; children: ReactNode }) {
  const p = useThemedPalette();
  return (
    <View style={{ marginTop: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 }}>
        <Text
          style={{
            color: p.fgMuted, fontSize: 11, fontWeight: '600',
            letterSpacing: 0.8, textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
        {hint && (
          <Text style={{ color: p.fgFaint, fontSize: 11, marginLeft: 8 }}>{hint}</Text>
        )}
      </View>
      {children}
    </View>
  );
}
