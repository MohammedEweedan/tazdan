import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ShaderLines } from '@/components/ui/ShaderLines';
import { Text } from '@/components/ui/Text';

export default function DevShaderScreen() {
  const [shaderOn, setShaderOn] = useState(true);
  const [mode, setMode] = useState<'dark' | 'light'>('dark');

  const isDark = mode === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0b0e' : '#f4f8fc' }]}>
      {shaderOn && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <ShaderLines opacity={1} mode={mode} />
        </View>
      )}

      <View
        style={[
          styles.overlay,
          { backgroundColor: isDark ? 'rgba(10,11,14,0.35)' : 'rgba(244,248,252,0.15)' },
        ]}
        pointerEvents="none"
      />

      <View style={styles.center} pointerEvents="none">
        <ActivityIndicator size="large" color="#63A1DB" style={styles.loader} />
        <Text style={[styles.title, { color: isDark ? '#fff' : '#0f1c2e' }]}>Loading</Text>
        <Text style={[styles.sub, { color: isDark ? 'rgba(255,255,255,0.48)' : 'rgba(15,28,46,0.5)' }]}>
          ShaderLines live test · {mode}
        </Text>
      </View>

      {/* Mode toggle — top center */}
      <Pressable
        onPress={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))}
        style={[styles.devBtn, styles.topBtn]}
        hitSlop={12}
      >
        <Text style={styles.devText}>{isDark ? 'Mode: DARK' : 'Mode: LIGHT'}</Text>
      </Pressable>

      {/* Shader off — bottom left */}
      <Pressable
        onPress={() => setShaderOn(false)}
        style={[styles.devBtn, styles.leftBtn, !shaderOn && styles.activeBtn]}
        hitSlop={12}
      >
        <Text style={styles.devText}>Shader OFF</Text>
      </Pressable>

      {/* Shader on — bottom right */}
      <Pressable
        onPress={() => setShaderOn(true)}
        style={[styles.devBtn, styles.rightBtn, shaderOn && styles.activeBtn]}
        hitSlop={12}
      >
        <Text style={styles.devText}>Shader ON</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  sub: {
    fontSize: 13,
    fontWeight: '500',
  },
  devBtn: {
    position: 'absolute',
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: 'rgba(99,161,219,0.35)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  topBtn: {
    top: 64,
    alignSelf: 'center',
  },
  leftBtn: {
    bottom: 42,
    left: 20,
  },
  rightBtn: {
    bottom: 42,
    right: 20,
  },
  activeBtn: {
    backgroundColor: '#63A1DB',
  },
  devText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
});
