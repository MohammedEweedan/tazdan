/**
 * Expo push notification service.
 *
 * Sends push notifications to mobile clients via the Expo Push API.
 * Tokens are stored in User.expoPushToken and registered by the mobile
 * app after login via POST /api/notifications/register-token.
 *
 * Receipts are validated in batches to detect bad tokens and clear them
 * from the database automatically.
 */
import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const expo = new Expo();

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
}

/**
 * Send a push notification to a single user by userId.
 * Silently no-ops if the user has no registered push token.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { expoPushToken: true },
  });
  if (!user?.expoPushToken) return;
  await sendPushToToken(user.expoPushToken, userId, payload);
}

/**
 * Send to multiple users — batches into a single Expo API call.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (!userIds.length) return;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, expoPushToken: { not: null } },
    select: { id: true, expoPushToken: true },
  });

  const messages: ExpoPushMessage[] = users
    .filter((u) => u.expoPushToken && Expo.isExpoPushToken(u.expoPushToken))
    .map((u) => ({
      to: u.expoPushToken!,
      sound: 'default' as const,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      badge: payload.badge,
    }));

  if (!messages.length) return;

  try {
    const chunks = expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...chunkTickets);
    }

    // Check for invalid tokens and remove them
    const invalidTokens: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error') {
        logger.warn('[push] ticket error', { details: ticket.details, message: (ticket as any).message });
        if ((ticket as any).details?.error === 'DeviceNotRegistered') {
          const token = messages[i]?.to;
          if (token) invalidTokens.push(token as string);
        }
      }
    });

    if (invalidTokens.length) {
      await prisma.user.updateMany({
        where: { expoPushToken: { in: invalidTokens } },
        data: { expoPushToken: null },
      });
    }
  } catch (err) {
    logger.warn('[push] send failed', { err });
  }
}

async function sendPushToToken(token: string, userId: string, payload: PushPayload): Promise<void> {
  if (!Expo.isExpoPushToken(token)) {
    await prisma.user.update({ where: { id: userId }, data: { expoPushToken: null } });
    return;
  }

  try {
    const [ticket] = await expo.sendPushNotificationsAsync([{
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      badge: payload.badge,
    }]);

    if (ticket.status === 'error' && (ticket as any).details?.error === 'DeviceNotRegistered') {
      await prisma.user.update({ where: { id: userId }, data: { expoPushToken: null } });
    }
  } catch (err) {
    logger.warn('[push] send to token failed', { userId, err });
  }
}

// ── Convenience helpers for common events ────────────────────────────

export async function pushDepositConfirmed(userId: string, asset: string, amount: string) {
  await sendPushToUser(userId, {
    title: `${amount} ${asset} received`,
    body: 'Your deposit has been confirmed and credited to your wallet.',
    data: { type: 'deposit_confirmed', asset, amount },
  });
}

export async function pushWithdrawalSent(userId: string, asset: string, amount: string) {
  await sendPushToUser(userId, {
    title: 'Withdrawal sent',
    body: `Your ${amount} ${asset} is on its way.`,
    data: { type: 'withdrawal_sent', asset, amount },
  });
}

export async function pushP2PTradeUpdate(userIds: string[], status: string, asset: string, amount: string, tradeId: string) {
  const labels: Record<string, { title: string; body: string }> = {
    PAYMENT_SENT:    { title: 'Payment sent',          body: `Buyer has marked payment sent for ${amount} ${asset}.` },
    PAYMENT_CONFIRMED:{ title: 'Payment confirmed',    body: `Seller confirmed your payment. Crypto is on its way.` },
    COMPLETED:       { title: 'Trade complete',        body: `${amount} ${asset} trade has been completed.` },
    DISPUTED:        { title: 'Trade disputed',        body: 'A dispute has been opened. Support will review within 24h.' },
    CANCELLED:       { title: 'Trade cancelled',       body: `Your ${amount} ${asset} trade was cancelled.` },
  };
  const msg = labels[status] ?? { title: 'Trade update', body: `Trade status: ${status}` };
  await sendPushToUsers(userIds, { ...msg, data: { type: 'p2p_trade', status, tradeId } });
}

export async function pushKYCUpdate(userId: string, status: 'APPROVED' | 'REJECTED' | 'RESUBMIT_REQUIRED') {
  const msgs = {
    APPROVED:          { title: 'KYC approved ✓',          body: 'Your identity has been verified. You can now trade.' },
    REJECTED:          { title: 'KYC unsuccessful',         body: 'Verification could not be completed. Check your email for details.' },
    RESUBMIT_REQUIRED: { title: 'Action required',          body: 'Please resubmit your documents to complete verification.' },
  };
  await sendPushToUser(userId, { ...msgs[status], data: { type: 'kyc_update', status } });
}
