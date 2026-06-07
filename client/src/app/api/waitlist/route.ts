import { NextRequest, NextResponse } from 'next/server';

// Real backend base — falls back to the production API. Persists waitlist
// signups to our own DB (WaitlistEntry) so we can email everyone at launch.
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://api.promrkts.com').replace(/\/$/, '');

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

async function pushToBackend(email: string, source: string | null, locale: string | null): Promise<void> {
  try {
    const base = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
    await fetch(`${base}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source, locale }),
    });
  } catch (err) {
    console.error('[waitlist] backend fetch failed', err);
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

    await Promise.allSettled([pushToBackend(email, source, locale), pushToMailchimp(email)]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
