import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
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

// Public and it sends mail: a tight per-IP budget so it cannot be used to
// mail-bomb an address or burn the sender's reputation.
const waitlistLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: Number(process.env.WAITLIST_RATE_PER_HOUR ?? 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many signups from this network. Try again later.' },
});

waitlistRouter.post('/', waitlistLimiter, async (req: Request, res: Response) => {
  try {
    const email = typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';
    const source = typeof req.body?.source === 'string' ? req.body.source.slice(0, 40) : null;
    const locale = typeof req.body?.locale === 'string' ? req.body.locale.slice(0, 10) : null;

    if (!email || !email.includes('@') || email.length > 254) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    // Persist to our own DB first — this is the source of truth for the
    // launch-day mailout. A repeat signup is a no-op and sends nothing: it
    // used to re-send the confirmation every time, so anyone could make us
    // mail an address over and over.
    const existing = await prisma.waitlistEntry.findUnique({ where: { email }, select: { id: true } });
    let created = false;
    if (!existing) {
      try {
        await prisma.waitlistEntry.create({ data: { email, source, locale } });
        created = true;
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err; // a parallel signup won the race
      }
    }

    if (created) {
      // Best-effort external sync + confirmation; never block the signup on them.
      addToMailchimp(email).catch((err) => console.error('[waitlist] Mailchimp failed:', err));
      sendWaitlistConfirmation({ to: email }).catch((err) =>
        console.error('[waitlist] confirmation email failed:', err),
      );
    }

    // Same answer either way, so the endpoint does not reveal who signed up.
    return res.json({ success: true });
  } catch (err) {
    console.error('[waitlist] error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});
