import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'hi@promrkts.com';

const transporter =
  SMTP_HOST && SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })
    : null;

function base(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title}</title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;padding:0;background:#ffffff;color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}
  .bg{background:#ffffff}.card{background:#f5f5f5;border:1px solid #e5e5e5;border-radius:20px;padding:36px 32px}
  .muted{color:#6b7280}.main{color:#0b0f19}.divider{background:#e5e5e5;height:1px;margin:24px 0}
  .btn{display:inline-block;padding:13px 26px;border-radius:100px;text-decoration:none;font-weight:700;font-size:14px;background:#0b0f19;color:#ffffff!important}
  .wrap{max-width:560px;margin:0 auto;padding:48px 24px}
  .logo{font-size:20px;font-weight:900;letter-spacing:-0.04em;margin-bottom:40px}
  h1{font-size:22px;font-weight:800;letter-spacing:-0.03em;margin:0 0 12px;line-height:1.2}
  p{font-size:14px;line-height:1.7;margin:0 0 14px}
  .footer{margin-top:36px}.footer p{font-size:12px;color:#9ca3af;margin:0 0 4px}
  .notice{border-radius:10px;padding:14px 16px;background:rgba(0,0,0,0.04);margin-top:12px}
  @media(prefers-color-scheme:dark){
    body{background:#080b14!important;color:#f1f5f9!important}
    .bg{background:#080b14!important}
    .card{background:rgba(255,255,255,0.03)!important;border-color:rgba(255,255,255,0.07)!important}
    .muted{color:#94a3b8!important}.main{color:#f1f5f9!important}
    .divider{background:rgba(255,255,255,0.07)!important}
    .btn{background:#ffffff!important;color:#0b0f19!important}
    .footer p{color:#475569!important}
    .notice{background:rgba(255,255,255,0.04)!important}
  }
</style>
</head>
<body><div class="bg"><div class="wrap">
<div class="logo">promrkts</div>
<div class="card">${body}</div>
<div class="footer">
  <p>Need help? <a href="mailto:support@promrkts.com" style="color:inherit">support@promrkts.com</a></p>
  <p>promrkts — money, simplified</p>
</div>
</div></div></body></html>`;
}

export async function sendMail(to: string, subject: string, html: string) {
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping:', subject, 'to', to);
    return;
  }
  await transporter.sendMail({ from: `"promrkts" <${SMTP_FROM}>`, to, subject, html });
}

export function waitlistConfirmation(email: string) {
  const html = base(
    'You\'re on the waitlist — promrkts',
    `<h1 class="main">You're on the list. 🎉</h1>
    <p class="muted">Thanks for joining the promrkts early-access waitlist. You'll be among the first to know when we open your region — and you'll get <strong class="main">0% fees for your first 6 months</strong>.</p>
    <div class="divider"></div>
    <p class="main" style="font-weight:700;font-size:15px;margin-bottom:6px;">What happens next?</p>
    <p class="muted">We're onboarding users region by region. When your spot is ready you'll receive an invitation with a direct link to create your account.</p>
    <p class="muted">In the meantime, share your referral link with friends — each referral moves you up the list automatically.</p>
    <div class="divider"></div>
    <p class="muted" style="font-size:13px;margin:0;">Questions? Reply to this email or visit <a href="https://promrkts.com/faq" style="color:inherit">promrkts.com/faq</a>.</p>`,
  );
  return { to: email, subject: 'You\'re on the promrkts waitlist', html };
}

export function contactConfirmation(name: string, email: string) {
  const html = base(
    'We received your message — promrkts',
    `<h1 class="main">We got your message, ${name}.</h1>
    <p class="muted">Thanks for reaching out to promrkts support. Our team will review your message and get back to you at <strong class="main">${email}</strong> within 4 hours on business days.</p>
    <div class="divider"></div>
    <p class="main" style="font-weight:700;font-size:15px;margin-bottom:6px;">Need a faster answer?</p>
    <p class="muted">Browse our <a href="https://promrkts.com/faq" style="color:inherit">FAQ</a> — most common questions are answered there instantly. You can also reach us via the promrkts mobile app once you have an account.</p>
    <div class="notice">
      <p class="muted" style="margin:0;font-size:13px;">promrkts will never ask for your password, 2FA code, or seed phrase via email. If you receive a suspicious message, contact us at <a href="mailto:security@promrkts.com" style="color:inherit">security@promrkts.com</a>.</p>
    </div>`,
  );
  return { to: email, subject: 'We received your message — promrkts support', html };
}
