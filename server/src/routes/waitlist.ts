import { Router, Request, Response } from 'express';
import { sendWaitlistConfirmation } from '../services/email';
import { prisma } from '../utils/prisma';

export const waitlistRouter = Router();

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY ?? '';
const MAILCHIMP_LIST_ID = process.env.MAILCHIMP_LIST_ID ?? '';
const MAILCHIMP_DC = MAILCHIMP_API_KEY.split('-').pop() ?? 'us1';

async function addToMailchimp(email: string): Promise<void> {
  if (!MAILCHIMP_API_KEY || !MAILCHIMP_LIST_ID) return;

  const url = `https://${MAILCHIMP_DC}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64')}`,
    },
    body: JSON.stringify({ email_address: email, status: 'subscribed', tags: ['waitlist'] }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (body?.title !== 'Member Exists') {
      console.error('[waitlist] Mailchimp error', body);
    }
  }
}

waitlistRouter.post('/', async (req: Request, res: Response) => {
  try {
    const email = typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';
    const source = typeof req.body?.source === 'string' ? req.body.source.slice(0, 40) : null;
    const locale = typeof req.body?.locale === 'string' ? req.body.locale.slice(0, 10) : null;

    if (!email || !email.includes('@') || email.length > 254) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    // Persist to our own DB first — this is the source of truth for the
    // launch-day mailout. Idempotent: a repeat signup just no-ops.
    await prisma.waitlistEntry.upsert({
      where: { email },
      create: { email, source, locale },
      update: {}, // already on the list — keep the original signup timestamp
    });

    // Best-effort external sync + confirmation; never block the signup on them.
    addToMailchimp(email).catch((err) => console.error('[waitlist] Mailchimp failed:', err));
    sendWaitlistConfirmation({ to: email }).catch((err) =>
      console.error('[waitlist] confirmation email failed:', err),
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[waitlist] error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});
