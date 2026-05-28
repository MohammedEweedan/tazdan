/**
 * Sound assets for transaction feedback.
 *
 * Uses the real Apple Pay confirmation and decline MP3 files
 * from assets/sounds/. expo-av resolves require() assets natively
 * on iOS/Android without any base64 encoding needed.
 */

export const SUCCESS_SOUND_ASSET = require('../../assets/sounds/applepay.mp3') as number;
export const DECLINE_SOUND_ASSET = require('../../assets/sounds/applepay-failed.mp3') as number;

/**
 * Returns the require() asset reference for the success (confirmation) sound.
 * Pass directly to `Audio.Sound.createAsync({ ...asset })` via `Asset.fromModule`
 * or use as `{ uri: Asset.fromModule(SUCCESS_SOUND_ASSET).uri }` after loading.
 */
export function getSuccessSoundAsset(): number {
  return SUCCESS_SOUND_ASSET;
}

/**
 * Returns the require() asset reference for the decline (failure) sound.
 */
export function getDeclineSoundAsset(): number {
  return DECLINE_SOUND_ASSET;
}
