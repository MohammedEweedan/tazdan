import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || process.env.MAIL_FROM || 'noreply@promrkts.com';
const CLIENT_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://promrkts.com';

// Hosted logos — swap these URLs for your actual CDN paths
const LOGO_WHITE = `${CLIENT_URL}/logo-white.png`;
const LOGO_BLACK = `${CLIENT_URL}/logo-black.png`;

const hasCredentials = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = hasCredentials
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

/**
 * Base template — reacts to dark/light mode via prefers-color-scheme.
 * Logo switches between logo-white.png (dark) and logo-black.png (light).
 */
function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }

    /* ── Light mode (default) ── */
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    }
    .email-bg   { background-color: #ffffff; }
    .card       { background-color: #f5f5f5; border: 1px solid #e5e5e5; }
    .text-muted { color: #6b7280; }
    .text-main  { color: #0b0f19; }
    .divider    { background-color: #e5e5e5; }
    .code-box   { background-color: #f0f0f0; border: 1px solid #e0e0e0; }
    .code-text  { color: #0b0f19; }
    .btn        { background-color: #0b0f19; color: #ffffff !important; }
    .footer-text{ color: #9ca3af; }
    .logo-light { display: block !important; }
    .logo-dark  { display: none !important; }

    /* ── Dark mode ── */
    @media (prefers-color-scheme: dark) {
      body        { background-color: #080b14 !important; color: #f1f5f9 !important; }
      .email-bg   { background-color: #080b14 !important; }
      .card       { background-color: rgba(255,255,255,0.03) !important; border-color: rgba(255,255,255,0.07) !important; }
      .text-muted { color: #94a3b8 !important; }
      .text-main  { color: #f1f5f9 !important; }
      .divider    { background-color: rgba(255,255,255,0.07) !important; }
      .code-box   { background-color: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.08) !important; }
      .code-text  { color: #f1f5f9 !important; }
      .btn        { background-color: #ffffff !important; color: #0b0f19 !important; }
      .footer-text{ color: #475569 !important; }
      .logo-light { display: none !important; }
      .logo-dark  { display: block !important; }
    }

    /* ── Layout ── */
    .wrapper    { max-width: 560px; margin: 0 auto; padding: 48px 24px; }
    .logo-wrap  { text-align: left; margin-bottom: 40px; }
    .logo-wrap img { height: 28px; width: auto; }
    .card       { border-radius: 20px; padding: 36px 32px; }
    h1 {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.03em;
      margin: 0 0 12px;
      line-height: 1.2;
    }
    p  { font-size: 14px; line-height: 1.7; margin: 0 0 14px; }
    .btn {
      display: inline-block;
      padding: 13px 26px;
      border-radius: 100px;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: -0.01em;
    }
    .btn-wrap   { margin: 28px 0; }
    .divider    { height: 1px; margin: 24px 0; }
    .code-box   { border-radius: 16px; padding: 28px; text-align: center; margin: 24px 0; }
    .code-text  { font-size: 38px; font-weight: 800; letter-spacing: 12px; font-variant-numeric: tabular-nums; font-family: 'Courier New', monospace; }
    .footer     { margin-top: 36px; text-align: left; }
    .footer p   { font-size: 12px; margin: 0 0 4px; }
    .footer a   { color: inherit; text-decoration: underline; }
    ul          { color: #6b7280; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 12px 0 20px; }
    li span     { font-weight: 700; }

    /* Subtle notice box */
    .notice { border-radius: 10px; padding: 14px 16px; margin-top: 12px; background: rgba(0,0,0,0.04); }
    @media (prefers-color-scheme: dark) {
      .notice { background: rgba(255,255,255,0.04) !important; }
      ul      { color: #94a3b8 !important; }
    }
  </style>
</head>
<body>
  <div class="email-bg">
    <div class="wrapper">

      <!-- Logo: switches on dark/light -->
      <div class="logo-wrap">
        <img class="logo-light" src="${LOGO_BLACK}" alt="promrkts" />
        <img class="logo-dark"  src="${LOGO_WHITE}" alt="promrkts" />
      </div>

      <div class="card">
        ${body}
      </div>

      <div class="footer">
        <p class="footer-text">Need help? <a href="mailto:support@promrkts.com">support@promrkts.com</a></p>
        <p class="footer-text">promrkts — money, simplified</p>
      </div>

    </div>
  </div>
</body>
</html>`;
}

/* ─────────────────────────────────────────────────────────────
   Core send
───────────────────────────────────────────────────────────── */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping send:', subject, 'to', to);
    return;
  }
  await transporter.sendMail({
    from: `"promrkts" <${SMTP_FROM}>`,
    to,
    subject,
    html,
  });
}

/* ─────────────────────────────────────────────────────────────
   Welcome — sent AFTER email verification is confirmed
───────────────────────────────────────────────────────────── */
export async function sendWelcomeEmail({
  to,
  firstName,
}: {
  to: string;
  firstName: string;
}) {
  const html = baseTemplate(
    'Welcome to promrkts',
    `<h1 class="text-main">Welcome aboard, ${firstName}.</h1>
    <p class="text-muted">Your email is verified and your promrkts account is live. Below is a short, deliberate first run so you can start trading with confidence — most of it takes under five minutes.</p>

    <div class="divider"></div>

    <p class="text-main" style="font-weight:700; font-size:15px; margin-bottom:6px;">1 &nbsp;Secure your account</p>
    <p class="text-muted" style="margin-top:0;">Enable two-factor authentication. We require it before any deposit, trade, withdrawal or wallet export.</p>
    <div class="btn-wrap" style="margin:14px 0 0;">
      <a href="${CLIENT_URL}/dashboard/security" class="btn">Enable 2FA</a>
    </div>

    <div class="divider"></div>

    <p class="text-main" style="font-weight:700; font-size:15px; margin-bottom:6px;">2 &nbsp;Verify your identity (KYC)</p>
    <p class="text-muted" style="margin-top:0;">Tier 1 unlocks deposits and trading. Tier 2 raises your limits and enables card issuance + self-custody export. Reviews usually complete within a few hours.</p>
    <div class="btn-wrap" style="margin:14px 0 0;">
      <a href="${CLIENT_URL}/dashboard/kyc" class="btn">Start KYC</a>
    </div>

    <div class="divider"></div>

    <p class="text-main" style="font-weight:700; font-size:15px; margin-bottom:6px;">3 &nbsp;Fund your wallet</p>
    <p class="text-muted" style="margin-top:0;">Top up by bank transfer in your local currency, or send crypto to your custodial address — BTC, ETH, SOL, and USDT (ERC-20 / TRC-20) are supported out of the box.</p>
    <div class="btn-wrap" style="margin:14px 0 0;">
      <a href="${CLIENT_URL}/dashboard/wallet" class="btn">Open wallet</a>
    </div>

    <div class="divider"></div>

    <p class="text-main" style="font-weight:700; font-size:15px; margin-bottom:6px;">What you can do here</p>
    <ul>
      <li><span class="text-main">Trade</span> — buy & sell BTC, ETH, SOL and 400+ pairs at live Binance prices.</li>
      <li><span class="text-main">P2P</span> — match with local buyers/sellers in your fiat currency.</li>
      <li><span class="text-main">Send &amp; receive</span> — pay any promrkts @handle instantly, or any external wallet.</li>
      <li><span class="text-main">Self-custody</span> — export your private keys whenever you want full ownership.</li>
    </ul>

    <div class="notice">
      <p class="text-muted" style="margin:0; font-size:13px;">Security reminder: promrkts will never ask for your password, 2FA code, or seed phrase. If anything looks wrong, email <a href="mailto:support@promrkts.com" style="color:inherit;">support@promrkts.com</a> immediately.</p>
    </div>

    <p class="text-muted" style="font-size:13px; margin:24px 0 8px;">Get the app</p>
    <table cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding-right:8px;">
          <a href="https://apps.apple.com" style="display:inline-block; padding:10px 18px; border-radius:100px; border:1px solid currentColor; color:inherit; text-decoration:none; font-size:13px; font-weight:600;">iOS</a>
        </td>
        <td>
          <a href="https://play.google.com" style="display:inline-block; padding:10px 18px; border-radius:100px; border:1px solid currentColor; color:inherit; text-decoration:none; font-size:13px; font-weight:600;">Android</a>
        </td>
      </tr>
    </table>`,
  );
  await sendEmail({
    to,
    subject: `Welcome to promrkts, ${firstName} — let's get you set up`,
    html,
  });
}

/* ─────────────────────────────────────────────────────────────
   Email Verification
   After the user enters this code correctly → call sendWelcomeEmail
───────────────────────────────────────────────────────────── */
export async function sendVerificationEmail({
  to,
  firstName,
  code,
}: {
  to: string;
  firstName: string;
  code: string;
}) {
  const html = baseTemplate(
    'Verify your email — promrkts',
    `<h1 class="text-main">Confirm your email</h1>
    <p class="text-muted">Hi ${firstName}, enter this code to verify your promrkts account.</p>

    <div class="code-box">
      <div class="code-text">${code}</div>
    </div>

    <div class="notice">
      <p class="text-muted" style="margin:0; font-size:13px;">Expires in 24 hours. Didn't sign up? You can safely ignore this.</p>
    </div>`
  );
  await sendEmail({ to, subject: 'Your promrkts verification code', html });
}

/* ─────────────────────────────────────────────────────────────
   Password Reset
───────────────────────────────────────────────────────────── */
export async function sendPasswordResetEmail({
  to,
  firstName,
  token,
}: {
  to: string;
  firstName: string;
  token: string;
}) {
  const resetUrl = `${CLIENT_URL}/auth/reset-password?token=${token}`;
  const html = baseTemplate(
    'Reset your password — promrkts',
    `<h1 class="text-main">Reset your password</h1>
    <p class="text-muted">Hi ${firstName}, we received a request to reset your promrkts password.</p>

    <div class="btn-wrap">
      <a href="${resetUrl}" class="btn">Set New Password</a>
    </div>

    <div class="notice">
      <p class="text-muted" style="margin:0 0 6px; font-size:13px;">Or copy this link:</p>
      <p class="text-muted" style="margin:0; font-size:11px; word-break:break-all;">${resetUrl}</p>
    </div>

    <p class="text-muted" style="font-size:12px; margin-top:16px;">This link expires in 1 hour. Didn't request this? Your account is safe — ignore this email.</p>`
  );
  await sendEmail({ to, subject: 'Reset your promrkts password', html });
}