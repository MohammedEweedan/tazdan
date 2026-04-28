/**
 * Authenticated Socket.IO client.
 *
 * Resolves the websocket URL from the API base (strips the trailing
 * `/api`), pulls the latest access token from SecureStore on every
 * connect, and auto-rotates the connection when the token changes
 * (e.g. after refresh). Importing modules just call `getSocket()` and
 * subscribe; they never have to wire connect / reconnect themselves.
 */

import { io, type Socket } from 'socket.io-client';
import { APP, STORAGE_KEYS } from '@/constants';
import { secureStore } from './secureStore';

let socket: Socket | null = null;
let cachedToken: string | null = null;

function wsBase(): string {
  // APP.apiBaseUrl looks like "http://192.168.x.x:5001/api" — strip /api.
  return APP.apiBaseUrl.replace(/\/api\/?$/, '');
}

/**
 * Returns a singleton Socket.IO client. The first call begins
 * connection; subsequent calls reuse the same instance unless the
 * access token has changed (in which case we tear down + reconnect).
 */
export async function getSocket(): Promise<Socket> {
  const token = (await secureStore.get(STORAGE_KEYS.accessToken)) ?? null;

  if (socket && token === cachedToken) return socket;
  // Token rotated — drop the old socket and reconnect with the new one.
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  cachedToken = token;

  socket = io(wsBase(), {
    transports: ['websocket'],
    auth: token ? { token } : undefined,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 5_000,
  });
  return socket;
}

/** Disconnect — call from logout. */
export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
  cachedToken = null;
}
