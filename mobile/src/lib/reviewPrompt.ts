/**
 * App-store review prompt, asked only at peak-happiness moments.
 *
 * Rules (Apple's guidelines + retention practice):
 *  • Only after a POSITIVE event (money sent, buy filled, deposit landed) —
 *    never after errors, never on a timer, never on first launch.
 *  • Not before the user's 2nd positive event — first-time flows still
 *    feel risky to the user; the 2nd success is the trust moment.
 *  • Ask at most once per install. iOS hard-caps the system sheet at
 *    3/year anyway; one good ask beats three ignored ones.
 *
 * `maybeAskForReview()` is fire-and-forget safe: every failure path is
 * swallowed — a review prompt must never break a money flow.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const COUNT_KEY = 'review.positiveEvents';
const ASKED_KEY = 'review.asked';
const MIN_EVENTS_BEFORE_ASK = 2;

export async function maybeAskForReview(): Promise<void> {
  try {
    const asked = await AsyncStorage.getItem(ASKED_KEY);
    if (asked) return;

    const count = parseInt((await AsyncStorage.getItem(COUNT_KEY)) ?? '0', 10) + 1;
    await AsyncStorage.setItem(COUNT_KEY, String(count));
    if (count < MIN_EVENTS_BEFORE_ASK) return;

    if (!(await StoreReview.isAvailableAsync())) return;

    // Mark BEFORE requesting — if the OS shows the sheet and the app is
    // backgrounded mid-write we'd rather under-ask than double-ask.
    await AsyncStorage.setItem(ASKED_KEY, '1');
    // Let the success animation/haptic land first; the sheet stepping on
    // the confirmation screen feels like an interruption, not a moment.
    setTimeout(() => { StoreReview.requestReview().catch(() => {}); }, 1500);
  } catch {
    // Never let review plumbing surface to the user.
  }
}
