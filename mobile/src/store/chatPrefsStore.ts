/**
 * chatPrefsStore — per-user chat preferences persisted on-device.
 *
 *   pinnedPartners   — partnerIds the user has pinned to the top of
 *                      the conversation list.
 *   contactPartners  — partnerIds the user has saved as contacts.
 *                      Surfaced in the messages tab as a quick-access
 *                      row independent of recent conversations.
 *   readReceiptsOn   — when false, we suppress the "read"
 *                      double-check on outbound bubbles AND tell the
 *                      server not to broadcast a `message:read`
 *                      event for inbound messages (server side TBD;
 *                      client UX works on its own today).
 *
 * Persisted via expo-secure-store under a single key per slice so a
 * fresh launch restores the user's pins / contacts / toggle without
 * a round-trip.  Migration to a real server-side "contacts" model is
 * a follow-up; this gets us shipping value immediately without a
 * Prisma migration.
 */

import { create } from 'zustand';
import { secureStore } from '@/lib/secureStore';

const KEY_PINS         = 'chat.prefs.pinned.v1';
const KEY_CONTACTS     = 'chat.prefs.contacts.v1';
const KEY_READ_RECEIPT = 'chat.prefs.readReceipts.v1';
const KEY_LAST_SEEN     = 'chat.prefs.lastSeen.v1';

export interface ChatContact {
  id: string;        // partnerId
  handle?: string;   // cached for the contacts row label
  name?: string;     // first + last, when available
  avatarUrl?: string | null;
  addedAt: number;   // epoch ms
}

interface ChatPrefsState {
  hydrated: boolean;
  pinnedPartners: Set<string>;
  contacts: Map<string, ChatContact>;
  readReceiptsOn: boolean;
  lastSeenOn: boolean;

  hydrate: () => Promise<void>;

  togglePin: (partnerId: string) => Promise<void>;
  isPinned: (partnerId: string) => boolean;

  addContact: (c: ChatContact) => Promise<void>;
  removeContact: (partnerId: string) => Promise<void>;
  isContact: (partnerId: string) => boolean;
  contactList: () => ChatContact[];

  setReadReceiptsOn: (on: boolean) => Promise<void>;
  setLastSeenOn: (on: boolean) => Promise<void>;
}

async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await secureStore.get(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function saveJson(key: string, value: unknown): Promise<void> {
  try { await secureStore.set(key, JSON.stringify(value)); } catch { /* noop */ }
}

export const useChatPrefs = create<ChatPrefsState>((set, get) => ({
  hydrated: false,
  pinnedPartners: new Set(),
  contacts: new Map(),
  readReceiptsOn: true,
  lastSeenOn: true,

  hydrate: async () => {
    const [pinsArr, contactsArr, receipts, lastSeen] = await Promise.all([
      loadJson<string[]>(KEY_PINS, []),
      loadJson<ChatContact[]>(KEY_CONTACTS, []),
      loadJson<{ on: boolean }>(KEY_READ_RECEIPT, { on: true }),
      loadJson<{ on: boolean }>(KEY_LAST_SEEN, { on: true }),
    ]);
    set({
      pinnedPartners: new Set(pinsArr),
      contacts: new Map(contactsArr.map((c) => [c.id, c])),
      readReceiptsOn: receipts?.on ?? true,
      lastSeenOn: lastSeen?.on ?? true,
      hydrated: true,
    });
  },

  togglePin: async (partnerId: string) => {
    const next = new Set(get().pinnedPartners);
    if (next.has(partnerId)) next.delete(partnerId);
    else                     next.add(partnerId);
    set({ pinnedPartners: next });
    await saveJson(KEY_PINS, Array.from(next));
  },
  isPinned: (partnerId: string) => get().pinnedPartners.has(partnerId),

  addContact: async (c: ChatContact) => {
    const next = new Map(get().contacts);
    next.set(c.id, { ...c, addedAt: c.addedAt || Date.now() });
    set({ contacts: next });
    await saveJson(KEY_CONTACTS, Array.from(next.values()));
  },
  removeContact: async (partnerId: string) => {
    const next = new Map(get().contacts);
    next.delete(partnerId);
    set({ contacts: next });
    await saveJson(KEY_CONTACTS, Array.from(next.values()));
  },
  isContact: (partnerId: string) => get().contacts.has(partnerId),
  contactList: () => Array.from(get().contacts.values()).sort((a, b) => b.addedAt - a.addedAt),

  setReadReceiptsOn: async (on: boolean) => {
    set({ readReceiptsOn: on });
    await saveJson(KEY_READ_RECEIPT, { on });
  },
  setLastSeenOn: async (on: boolean) => {
    set({ lastSeenOn: on });
    await saveJson(KEY_LAST_SEEN, { on });
  },
}));
