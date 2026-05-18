import { NextRequest, NextResponse } from 'next/server';

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY ?? '';
const MAILCHIMP_LIST_ID = process.env.MAILCHIMP_LIST_ID ?? '';
// Mailchimp data center is the suffix after the last dash in the API key (e.g. "us21")
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
    body: JSON.stringify({
      email_address: email,
      status: 'subscribed',
      tags: ['waitlist'],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // "Member Exists" is fine — already subscribed
    if ((body as any)?.title !== 'Member Exists') {
      console.error('[waitlist] Mailchimp error', body);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !email.includes('@') || email.length > 254) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    await addToMailchimp(email);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
