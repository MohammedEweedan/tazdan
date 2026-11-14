/**
 * Push for chat messages — the "you have a new message" banner a closed or
 * backgrounded app depends on. Sockets only reach an app that is open.
 *
 * Preferences (User.notificationPrefs.push, all default on):
 *   messages        — chat messages, requests, stickers, support replies
 *   transfers       — PAYMENT messages (money arriving)
 *   messagePreview  — off shows "New message" instead of the text or amount
 * The app's language (`pushLocale`, sent with the push token) picks EN/AR copy.
 *
 * Fire-and-forget: a push failure never fails or delays the send.
 */
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { sendPushToUser } from '../push.service';

type Lang = 'en' | 'ar';

const COPY: Record<Lang, {
  newMessage: string; sticker: string; support: string;
  paid: (amt: string) => string; requested: (amt: string) => string;
}> = {
  en: {
    newMessage: 'New message',
    sticker: 'Sticker',
    support: 'tazdan Support',
    paid: (amt) => `Sent you ${amt}`,
    requested: (amt) => `Requested ${amt}`,
  },
  ar: {
    newMessage: 'رسالة جديدة',
    sticker: 'ملصق',
    support: 'دعم tazdan',
    paid: (amt) => `أرسل لك ${amt}`,
    requested: (amt) => `طلب ${amt}`,
  },
};

type NotifiableMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: string;
  metadata?: unknown;
};

/** Unread chat messages for the app-icon badge (receiver-private `seenAt`). */
export function unreadMessageCount(userId: string): Promise<number> {
  return prisma.message.count({ where: { receiverId: userId, seenAt: null, deletedAt: null } });
}

function amountOf(metadata: unknown): string | null {
  const m = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
  const amount = typeof m.amount === 'number' || typeof m.amount === 'string' ? String(m.amount) : null;
  const currency = typeof m.currency === 'string' ? m.currency : '';
  return amount ? `${amount} ${currency}`.trim() : null;
}

export async function notifyNewMessage(msg: NotifiableMessage): Promise<void> {
  try {
    const [receiver, sender] = await Promise.all([
      prisma.user.findUnique({ where: { id: msg.receiverId }, select: { notificationPrefs: true, expoPushToken: true } }),
      prisma.user.findUnique({ where: { id: msg.senderId }, select: { username: true, firstName: true, lastName: true } }),
    ]);
    if (!receiver?.expoPushToken || !sender) return;

    const prefs = (receiver.notificationPrefs && typeof receiver.notificationPrefs === 'object'
      ? receiver.notificationPrefs : {}) as Record<string, any>;
    const push = prefs.push && typeof prefs.push === 'object' ? prefs.push : {};
    const category = msg.type === 'PAYMENT' ? 'transfers' : 'messages';
    if (push[category] === false) return;

    const lang: Lang = prefs.pushLocale === 'ar' ? 'ar' : 'en';
    const c = COPY[lang];
    const isSupport = sender.username?.toLowerCase() === 'support';
    const title = isSupport
      ? c.support
      : [sender.firstName, sender.lastName].filter(Boolean).join(' ').trim() || (sender.username ? `@${sender.username}` : c.newMessage);

    const amount = amountOf(msg.metadata);
    // Preview off hides amounts too — nothing from the chat on the lock screen.
    let body: string;
    if (push.messagePreview === false) body = c.newMessage;
    else if (msg.type === 'PAYMENT' && amount) body = c.paid(amount);
    else if (msg.type === 'REQUEST' && amount) body = c.requested(amount);
    else if (msg.type === 'STICKER') {
      const emoji = (msg.metadata as Record<string, unknown> | null)?.emoji;
      body = `${typeof emoji === 'string' ? `${emoji} ` : ''}${c.sticker}`;
    } else body = msg.content.length > 160 ? `${msg.content.slice(0, 157)}…` : msg.content;

    await sendPushToUser(msg.receiverId, {
      title,
      body,
      badge: await unreadMessageCount(msg.receiverId),
      priority: 'high',
      data: { kind: 'message', partnerId: msg.senderId, messageId: msg.id },
    });
  } catch (err) {
    logger.warn('[push] message notify failed', { messageId: msg.id, err });
  }
}
