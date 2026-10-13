import { NextRequest, NextResponse } from 'next/server';
import { sendMail, contactConfirmation, escapeHtml } from '@/lib/email';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@tazdan.com';
// Mirrors CONTACT_TOPICS in components/pages/company/ContactForm.tsx (+ legacy 'partnerships').
const TOPICS = new Set(['support', 'kyc', 'security', 'business', 'partners', 'partnerships', 'press', 'other']);
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
/** Single-line text for headers: no CR/LF, capped length. */
const oneLine = (v: string, max: number) => v.replace(/[\r\n]+/g, ' ').slice(0, max);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name  = typeof body?.name  === 'string' ? oneLine(body.name.trim(), 120)  : '';
    const email = typeof body?.email === 'string' ? oneLine(body.email.trim().toLowerCase(), 254) : '';
    const rawTopic = typeof body?.topic === 'string' ? body.topic.trim().toLowerCase() : 'support';
    const topic = TOPICS.has(rawTopic) ? rawTopic : 'other';
    const msg   = typeof body?.msg   === 'string' ? body.msg.trim().slice(0, 5000) : '';

    if (!name || !EMAIL_RE.test(email) || !msg) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Forward to internal support inbox
    await sendMail(
      SUPPORT_EMAIL,
      `[Contact] ${topic} — ${name} <${email}>`,
      `<p><strong>Name:</strong> ${escapeHtml(name)}</p>
       <p><strong>Email:</strong> ${escapeHtml(email)}</p>
       <p><strong>Topic:</strong> ${escapeHtml(topic)}</p>
       <hr/>
       <p>${escapeHtml(msg).replace(/\n/g, '<br/>')}</p>`,
    );

    // Confirmation to the user
    const confirm = contactConfirmation(name, email);
    sendMail(confirm.to, confirm.subject, confirm.html).catch(() => {});

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
