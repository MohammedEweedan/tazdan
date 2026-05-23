/**
 * AnimatedTabIndicator — text tab strip with a brand-color underline
 * that springs between tabs on change.
 */

import { useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { brand, type Palette, useTheme } from '@/store/themeStore';
import { useHaptics } from '@/hooks';

export interface TabDef<T extends string = string> {
  key: T;
  label: string;
  badge?: number;
}

interface Props<T extends string = string> {
  tabs: TabDef<T>[];
  active: T;
  onChange: (key: T) => void;
  palette: Palette;
}

export function AnimatedTabIndicator<T extends string>({
  tabs, active, onChange, palette: p,
}: Props<T>) {
  const themeMode = useTheme((s) => s.mode);
  const accent = themeMode === 'dark' ? brand.primaryDark : brand.primary;
  const h = useHaptics();
  const layoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const [, force] = useState(0);

  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const initializedRef = useRef(false);

  const handleLayout = (key: string) => (e: LayoutChangeEvent) => {
    const { x: lx, width: lw } = e.nativeEvent.layout;
    layoutsRef.current[key] = { x: lx, width: lw };
    if (!initializedRef.current && layoutsRef.current[active]) {
      const l = layoutsRef.current[active];
      x.value = l.x;
      width.value = l.width;
      initializedRef.current = true;
    }
    force((n) => n + 1);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: width.value,
  }));

  const onTabPress = (key: T) => {
    h.selection();
    const l = layoutsRef.current[key];
    if (l) {
      x.value = withSpring(l.x, { damping: 18, stiffness: 220, mass: 0.6 });
      width.value = withSpring(l.width, { damping: 18, stiffness: 220, mass: 0.6 });
    }
    onChange(key);
  };

  return (
    <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
      <View style={{ flexDirection: 'row', gap: 24, position: 'relative' }}>
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onTabPress(tab.key)}
              hitSlop={6}
              onLayout={handleLayout(tab.key)}
              style={{ paddingBottom: 12 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{
                  color: isActive ? p.fg : p.fgFaint,
                  fontSize: 16,
                  fontWeight: isActive ? '700' : '600',
                  letterSpacing: -0.2,
                }}>
                  {tab.label}
                </Text>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <View style={{
                    minWidth: 18, height: 18, borderRadius: 9,
                    paddingHorizontal: 5,
                    backgroundColor: isActive ? `${accent}33` : p.pillBg,
                    borderWidth: 1, borderColor: isActive ? `${accent}66` : p.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{
                      color: isActive ? accent : p.fgMuted,
                      fontSize: 10, fontWeight: '700',
                    }}>
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}

        <Reanimated.View
          style={[{
            position: 'absolute',
            bottom: 0, left: 0,
            height: 3,
            borderRadius: 2,
            backgroundColor: accent,
          }, animatedStyle]}
        />
      </View>
      <View style={{ height: 1, backgroundColor: p.border, marginTop: 0 }} />
    </View>
  );
}
