import { NextRequest, NextResponse } from 'next/server';

// Real backend base — persists waitlist signups to our own DB (WaitlistEntry)
// so we can email everyone at launch.
//
// This route runs on Vercel (the marketing site is hosted there), so it must
// reach the API over the PUBLIC origin. We pin api.promrkts.com directly rather
// than depend on NEXT_PUBLIC_API_URL (which has historically been misconfigured
// to a dead `api.tazdan.com`, silently dropping every signup). Override with
// WAITLIST_API_BASE in the Vercel project env if the API ever moves.
const API_BASE = (
  process.env.WAITLIST_API_BASE || 'https://api.promrkts.com'
).replace(/\/$/, '');

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY ?? '';
const MAILCHIMP_LIST_ID = process.env.MAILCHIMP_LIST_ID ?? '';
const MAILCHIMP_DC = MAILCHIMP_API_KEY.split('-').pop() ?? 'us1';

async function pushToMailchimp(email: string): Promise<void> {
  if (!MAILCHIMP_API_KEY || !MAILCHIMP_LIST_ID) return;
  try {
    const res = await fetch(
      `https://${MAILCHIMP_DC}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64')}`,
        },
        body: JSON.stringify({ email_address: email, status: 'subscribed', tags: ['waitlist'] }),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if ((body as { title?: string })?.title !== 'Member Exists') {
        console.error('[waitlist] Mailchimp error', body);
      }
    }
  } catch (err) {
    console.error('[waitlist] Mailchimp fetch failed', err);
  }
}

// Returns true only when the backend persisted the signup. The backend is the
// source of truth for the launch mailout AND triggers the confirmation email,
// so a failure here must surface to the caller (don't swallow it) — otherwise
// the form shows a false "success" while nothing is saved and no email sends.
async function pushToBackend(email: string, source: string | null, locale: string | null): Promise<boolean> {
  try {
    // The host nginx on api.promrkts.com AUTO-PREFIXES /api (it rewrites
    // `/<path>` → `/api/<path>`). So we call the BARE path `/waitlist` — nginx
    // turns it into `/api/waitlist`, the backend's actual route. Appending /api
    // here would double it to `/api/api/waitlist` → 404 (the original bug).
    const res = await fetch(`${API_BASE}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source, locale }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error('[waitlist] backend responded', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[waitlist] backend fetch failed', err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const source = typeof body?.source === 'string' ? body.source.slice(0, 40) : 'landing';
    const locale = typeof body?.locale === 'string' ? body.locale.slice(0, 10) : null;

    if (!email || !email.includes('@') || email.length > 254) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // Mailchimp is best-effort (fire-and-forget). The backend save is required:
    // it persists the signup and fires the confirmation email.
    pushToMailchimp(email).catch(() => {});
    const saved = await pushToBackend(email, source, locale);

    if (!saved) {
      return NextResponse.json(
        { error: 'Could not save your signup right now. Please try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
