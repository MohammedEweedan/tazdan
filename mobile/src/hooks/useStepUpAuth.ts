/**
 * Step-up authentication for high-value transactions.
 *
 * Policy:
 *   - Any operation whose USD-equivalent value is ≥ STEP_UP_USD must
 *     pass a biometric (Face ID / Touch ID / passcode) prompt before
 *     the network call is dispatched.
 *   - Threshold is set once here so every screen reads the same value
 *     and the bar can be raised/lowered in one place.
 *   - On simulators or devices without enrolled biometrics, the
 *     prompt degrades to the OS passcode (handled by expo-local-auth).
 *   - If the device has no biometrics AND no passcode set, we refuse
 *     the operation rather than silently skipping the gate.
 *
 * Use:
 *   const stepUp = useStepUpAuth();
 *   await stepUp.guard({ usdValue: 1500, reason: 'Send 1,500 USD' });
 *   // Throws StepUpDeniedError if the user cancels — caller should
 *   // catch and abort cleanly.
 */
import { useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

export const STEP_UP_USD = 1000;

export class StepUpDeniedError extends Error {
  constructor(message = 'Biometric verification required') {
    super(message);
    this.name = 'StepUpDeniedError';
  }
}

export interface GuardOpts {
  /** USD-equivalent value of the operation. Use 0 to force-skip the gate. */
  usdValue: number;
  /** Prompt label shown by the OS. Keep short — iOS truncates. */
  reason: string;
  /** Force the gate even below threshold (e.g. exporting a private key). */
  alwaysRequire?: boolean;
}

export function useStepUpAuth() {
  const guard = useCallback(async ({ usdValue, reason, alwaysRequire }: GuardOpts) => {
    if (!alwaysRequire && usdValue < STEP_UP_USD) return; // below threshold

    const [hardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);

    if (!hardware) {
      throw new StepUpDeniedError(
        'This device has no biometric hardware. Use a device with Face ID or Touch ID for high-value transactions.',
      );
    }

    if (!enrolled) {
      // Allow OS passcode fallback (disableDeviceFallback=false), but
      // the OS will return failure if neither biometric nor passcode
      // is configured.
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    });

    if (!result.success) {
      throw new StepUpDeniedError(
        result.error === 'user_cancel' || result.error === 'system_cancel'
          ? 'Verification cancelled'
          : 'Verification failed',
      );
    }
  }, []);

  return { guard, threshold: STEP_UP_USD };
}
