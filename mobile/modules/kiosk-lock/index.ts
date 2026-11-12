/**
 * Keep a till device in the app until a manager unlocks it.
 * iOS: Guided Access. Android: lock task (screen pinning).
 * A build without the native module reports "not locked" and never throws.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

type Native = { isLocked(): Promise<boolean>; lock(): Promise<boolean>; unlock(): Promise<boolean> };
const native = requireOptionalNativeModule<Native>('KioskLock');

export const kioskLockAvailable = Boolean(native);
export async function isDeviceLocked(): Promise<boolean> {
  try { return (await native?.isLocked()) ?? false; } catch { return false; }
}
/** True when the app itself locked the device (supervised iOS, or Android pinning started). */
export async function lockDevice(): Promise<boolean> {
  try { return (await native?.lock()) ?? false; } catch { return false; }
}
export async function unlockDevice(): Promise<boolean> {
  try { return (await native?.unlock()) ?? false; } catch { return false; }
}
