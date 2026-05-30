import { NextRequest, NextResponse } from 'next/server';
import { sendMail, contactConfirmation } from '@/lib/email';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@tazdan.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name  = typeof body?.name  === 'string' ? body.name.trim()  : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const topic = typeof body?.topic === 'string' ? body.topic.trim() : 'support';
    const msg   = typeof body?.msg   === 'string' ? body.msg.trim()   : '';

    if (!name || !email || !email.includes('@') || !msg) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Forward to internal support inbox
    await sendMail(
      SUPPORT_EMAIL,
      `[Contact] ${topic} — ${name} <${email}>`,
      `<p><strong>Name:</strong> ${name}</p>
       <p><strong>Email:</strong> ${email}</p>
       <p><strong>Topic:</strong> ${topic}</p>
       <hr/>
       <p>${msg.replace(/\n/g, '<br/>')}</p>`,
    );

    // Confirmation to the user
    const confirm = contactConfirmation(name, email);
    sendMail(confirm.to, confirm.subject, confirm.html).catch(() => {});

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
