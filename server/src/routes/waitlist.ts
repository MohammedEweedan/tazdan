import { Router, Request, Response } from 'express';
import { sendWaitlistConfirmation } from '../services/email';

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

    if (!email || !email.includes('@') || email.length > 254) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    await addToMailchimp(email);

    sendWaitlistConfirmation({ to: email }).catch((err) =>
      console.error('[waitlist] confirmation email failed:', err),
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[waitlist] error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});
