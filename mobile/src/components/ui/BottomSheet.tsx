/**
 * BottomSheet — uniform bottom-sheet shell for every modal in the app.
 *
 * The whole point: deposits, transfers, biometric prompts, dispute
 * forms, payment-method pickers — they ALL look the same. One layout,
 * one rounding, one drag handle, one backdrop. If you find yourself
 * writing `<Modal transparent ...>` in a screen, stop and use this.
 *
 * Usage:
 *   <BottomSheet visible={open} onClose={() => setOpen(false)} title="Top up">
 *     <YourContent />
 *   </BottomSheet>
 *
 * The component handles:
 *   - Backdrop tap to dismiss
 *   - Keyboard avoidance
 *   - Status bar matching backdrop
 *   - Drag-handle visual affordance
 *   - Header with title + optional right slot
 *   - Theme-aware bg / border / divider
 *   - Safe-area aware bottom padding
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemedPalette } from '@/store/themeStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  /** Wrap content in a ScrollView. Default true. Disable when the sheet
   *  contains its own list (FlatList) — nested scrolling breaks. */
  scroll?: boolean;
  /** Max height as percent of screen. Default 92. */
  maxHeightPct?: number;
  /** Show drag handle. Default true. */
  handle?: boolean;
  /** Show close button (X) in the header right. Default true. */
  closeButton?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function BottomSheet({
  visible, onClose, title, subtitle, right,
  scroll = true, maxHeightPct = 92, handle = true, closeButton = true,
  contentStyle, children,
}: Props) {
  const p = useThemedPalette();
  const insets = useSafeAreaInsets();

  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll
    ? {
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: 'handled' as const,
        contentContainerStyle: [{ paddingHorizontal: 20, paddingTop: 6 }, contentStyle],
      }
    : { style: [{ flex: 0, paddingHorizontal: 20, paddingTop: 6 }, contentStyle] };

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
            style={{
              backgroundColor: p.bg,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderTopWidth: 1, borderColor: p.border,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              maxHeight: `${maxHeightPct}%`,
              shadowColor: p.shadow,
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 1,
              shadowRadius: 22,
              elevation: 24,
            }}
          >
            {handle && (
              <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
                <View
                  style={{
                    width: 44, height: 4, borderRadius: 2,
                    backgroundColor: p.divider,
                  }}
                />
              </View>
            )}

            {(title || subtitle || closeButton || right) && (
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12,
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  {title && (
                    <Text
                      style={{
                        color: p.fg, fontSize: 19, fontWeight: '600',
                        letterSpacing: -0.4,
                      }}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                  )}
                  {subtitle && (
                    <Text
                      style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 2 }}
                      numberOfLines={2}
                    >
                      {subtitle}
                    </Text>
                  )}
                </View>
                {right}
                {closeButton && (
                  <Pressable
                    onPress={onClose}
                    hitSlop={10}
                    style={{
                      width: 32, height: 32, borderRadius: 16,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: p.pillBg,
                    }}
                  >
                    <Ionicons name="close" size={16} color={p.fg} />
                  </Pressable>
                )}
              </View>
            )}

            {/* @ts-ignore - conditional ScrollView/View */}
            <Body {...bodyProps}>{children}</Body>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
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
