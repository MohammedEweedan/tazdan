/**
 * Root error boundary — the difference between "a screen hiccuped" and
 * "the app died to a white screen and the user deleted it".
 *
 * Any uncaught render error is reported to observability (Sentry when
 * configured) and replaced with a friendly recovery screen. "Try again"
 * remounts the subtree by bumping a key — state-driven crashes (a bad
 * cache entry, a malformed API payload) usually clear on remount.
 *
 * Deliberately styled with raw values, not the theme store: if the theme
 * provider itself is what crashed, the fallback must still render.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { captureError } from '@/lib/observability';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  resetKey: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    captureError(error, { componentStack: info.componentStack ?? 'unknown' });
  }

  private reset = () => {
    this.setState((s) => ({ hasError: false, resetKey: s.resetKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.root}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected error. Your funds and account are safe —
            this is a display issue only.
          </Text>
          <Pressable
            onPress={this.reset}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#16181C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emoji: { fontSize: 40, marginBottom: 16 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 10 },
  body: { color: '#9BA1A8', fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 28 },
  button: {
    backgroundColor: '#63a1db',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
  },
  buttonLabel: { color: '#0C0D10', fontSize: 15, fontWeight: '700' },
});
