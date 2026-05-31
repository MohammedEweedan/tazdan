/**
 * Observability wrapper — Sentry for the mobile app, build-safe.
 *
 * `@sentry/react-native` requires a native rebuild, so this wrapper resolves
 * it LAZILY: if the package is installed AND EXPO_PUBLIC_SENTRY_DSN is set, it
 * initializes and forwards; otherwise every call is a safe no-op. This means
 * the wiring (initObservability in _layout, captureError at call sites) ships
 * now and starts reporting the instant you:
 *
 *   1. npx expo install @sentry/react-native
 *   2. set EXPO_PUBLIC_SENTRY_DSN in the EAS build profile
 *   3. rebuild with EAS
 *
 * No code changes needed at that point — just install + key + rebuild.
 */

let Sentry: any = null;
let ready = false;

export function initObservability(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || ready) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn,
      tracesSampleRate: Number(process.env.EXPO_PUBLIC_SENTRY_TRACES ?? '0.1'),
      environment: process.env.EXPO_PUBLIC_ENV ?? 'production',
      // Never send balances / amounts / tokens in breadcrumbs.
      beforeSend: (event: any) => {
        if (event.request?.data) delete event.request.data;
        return event;
      },
    });
    ready = true;
  } catch {
    // Package not installed yet — stay a no-op.
    Sentry = null;
  }
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (ready && Sentry) {
    try { Sentry.captureException(err, context ? { extra: context } : undefined); return; } catch { /* fall through */ }
  }
  // Dev fallback so errors aren't silently swallowed when Sentry is off.
  if (__DEV__) console.error('[observability]', err, context ?? '');
}

export function setUserContext(user: { id?: string; email?: string } | null): void {
  if (ready && Sentry) {
    try { Sentry.setUser(user ? { id: user.id, email: user.email } : null); } catch { /* noop */ }
  }
}
