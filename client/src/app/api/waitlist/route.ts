import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !email.includes('@') || email.length > 254) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // TODO: forward to email marketing provider (Mailchimp, ConvertKit, etc.)
    // Example: await mailchimp.lists.addListMember(LIST_ID, { email_address: email, status: 'subscribed' });
    console.info('[waitlist] new signup:', email);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
