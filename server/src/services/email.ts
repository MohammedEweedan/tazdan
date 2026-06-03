import nodemailer from 'nodemailer';
import path from 'path';
import QRCode from 'qrcode';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const REQUIRED_SMTP_ENV = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'] as const;

/* ─────────────────────────────────────────────────────────────
   Senders — each kind of email ships from a purpose-built address
   so users (and inbox filters) can tell auth, onboarding, and money
   movement apart at a glance.

     • noreply@tazdan.com — auth codes / verification / password reset
     • hi@tazdan.com      — welcome & onboarding (the warm one)
     • txn@tazdan.com     — every money movement (buy/sell/send/receive/claim…)

   Each is overridable via env so staging can point them elsewhere.
   Note: when authenticating against a provider that rewrites the From
   header to the mailbox owner (e.g. plain Gmail SMTP), these aliases
   only take effect once SMTP_USER is on the tazdan.com domain or the
   aliases are verified send-as addresses.
─────────────────────────────────────────────────────────────── */
const SENDERS = {
  auth:    process.env.MAIL_FROM_AUTH    || 'noreply@tazdan.com',
  welcome: process.env.MAIL_FROM_WELCOME || 'hi@tazdan.com',
  txn:     process.env.MAIL_FROM_TXN     || 'txn@tazdan.com',
} as const;

type SenderKey = keyof typeof SENDERS;

// Display name shown alongside the address, tuned per sender.
const SENDER_NAME: Record<SenderKey, string> = {
  auth:    'tazdan',
  welcome: 'tazdan',
  txn:     'tazdan',
};

function fromHeader(sender: SenderKey): string {
  return `"${SENDER_NAME[sender]}" <${SENDERS[sender]}>`;
}

function resolveClientUrl(): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.trim();
  if (process.env.CLIENT_URL) {
    // CLIENT_URL may be a comma-separated CORS list — take the first origin.
    const first = process.env.CLIENT_URL.split(',')[0].trim();
    return first;
  }
  return 'https://tazdan.com';
}

const CLIENT_URL = resolveClientUrl();

// Logos are embedded inline as CID attachments so they render in every email
// client (Gmail, Outlook, Apple Mail) without needing a public CDN URL.
// __dirname is:
//   dev  (ts-node)  → <root>/server/src/services/
//   prod (node dist) → <root>/server/dist/services/
// Both resolve to <root>/server/src/assets/ via the logic below.
function resolveAsset(filename: string): string {
  const candidates = [
    path.resolve(__dirname, '..', 'assets', filename),          // ts-node: src/services → src/assets
    path.resolve(__dirname, '..', '..', 'src', 'assets', filename), // compiled: dist/services → src/assets
    path.resolve(process.cwd(), 'src', 'assets', filename),     // fallback: cwd/src/assets
  ];
  const fs = require('fs') as typeof import('fs');
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0]; // best guess; nodemailer will warn if missing
}

const LOGO_BLACK_PATH = resolveAsset('logo-black.png');
const LOGO_WHITE_PATH = resolveAsset('logo-white.png');

// CID values referenced in the HTML via cid:logo-black and cid:logo-white.
const CID_BLACK = 'logo-black@tazdan.com';
const CID_WHITE = 'logo-white@tazdan.com';

const hasCredentials = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
const missingSmtpEnv = REQUIRED_SMTP_ENV.filter((key) => !process.env[key]);

if (!hasCredentials && process.env.NODE_ENV === 'production') {
  console.error('[email] SMTP is not configured in production. Missing env:', missingSmtpEnv.join(', '));
}

const transporter = hasCredentials
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

export function getEmailStatus() {
  return {
    smtpConfigured: hasCredentials,
    missingEnv: missingSmtpEnv,
    senders: SENDERS,
  };
}

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

    /* ──────────────────────────────────────────────────────────
       tazdan identity — pure monochrome. Black, white, and greys
       only; no colour casts. Surfaces lean on subtle grey gradients
       so the brand reads the same in light and dark. Every gradient
       carries a flat background-color fallback for Outlook (which
       drops linear-gradient and only honours the solid colour).
    ────────────────────────────────────────────────────────────── */

    /* ── Light mode (default) ── */
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f4f5;
      color: #18181b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    }
    .email-bg   { background-color: #f4f4f5; background-image: linear-gradient(180deg, #ffffff 0%, #f4f4f5 100%); }
    .card       { background-color: #ffffff; border: 1px solid #e4e4e7; }
    .hero       { background-color: #18181b; background-image: linear-gradient(120deg, #000000 0%, #27272a 55%, #52525b 100%); }
    .hero-text  { color: #fafafa !important; }
    .hero-sub   { color: #d4d4d8 !important; }
    .text-muted { color: #71717a; }
    .text-main  { color: #18181b; }
    .divider    { background-color: #e4e4e7; }
    .code-box   { background-color: #f4f4f5; background-image: linear-gradient(135deg, #fafafa 0%, #e4e4e7 100%); border: 1px solid #e4e4e7; }
    .code-text  { color: #18181b; }
    .btn        { background-color: #18181b; background-image: linear-gradient(120deg, #000000 0%, #3f3f46 100%); color: #ffffff !important; }
    .btn-ghost  { color: #18181b !important; border-color: #d4d4d8 !important; }
    .footer-text{ color: #a1a1aa; }
    .logo-light { display: block !important; }
    .logo-dark  { display: none !important; }

    /* ── Dark mode ── */
    @media (prefers-color-scheme: dark) {
      body        { background-color: #000000 !important; color: #f4f4f5 !important; }
      .email-bg   { background-color: #000000 !important; background-image: linear-gradient(180deg, #0a0a0a 0%, #000000 100%) !important; }
      .card       { background-color: #0c0c0d !important; background-image: linear-gradient(180deg, #141416 0%, #0a0a0b 100%) !important; border-color: #27272a !important; }
      .hero       { background-color: #1c1c1f !important; background-image: linear-gradient(120deg, #27272a 0%, #3f3f46 55%, #52525b 100%) !important; }
      .hero-text  { color: #fafafa !important; }
      .hero-sub   { color: #d4d4d8 !important; }
      .text-muted { color: #a1a1aa !important; }
      .text-main  { color: #f4f4f5 !important; }
      .divider    { background-color: #27272a !important; }
      .code-box   { background-color: #18181b !important; background-image: linear-gradient(135deg, #27272a 0%, #18181b 100%) !important; border-color: #3f3f46 !important; }
      .code-text  { color: #fafafa !important; }
      .btn        { background-color: #fafafa !important; background-image: linear-gradient(120deg, #ffffff 0%, #d4d4d8 100%) !important; color: #09090b !important; }
      .btn-ghost  { color: #f4f4f5 !important; border-color: #3f3f46 !important; }
      .footer-text{ color: #52525b !important; }
      .logo-light { display: none !important; }
      .logo-dark  { display: block !important; }
    }

    /* ── Layout ── */
    .wrapper    { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
    .logo-wrap  { text-align: left; margin-bottom: 28px; padding-left: 4px; }
    .logo-wrap img { height: 26px; width: auto; max-width: 110px; }
    .card       { border-radius: 24px; overflow: hidden; }
    .card-pad   { padding: 36px 32px; }

    /* Gradient hero band that crowns the card */
    .hero       { padding: 22px 32px; }
    .hero-text  { font-size: 13px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; margin: 0; }
    .hero-sub   { font-size: 13px; font-weight: 500; letter-spacing: 0.01em; margin: 4px 0 0; }

    h1 {
      font-size: 23px;
      font-weight: 800;
      letter-spacing: -0.03em;
      margin: 0 0 12px;
      line-height: 1.2;
    }
    p  { font-size: 14px; line-height: 1.7; margin: 0 0 14px; }
    .btn {
      display: inline-block;
      padding: 14px 28px;
      border-radius: 100px;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: -0.01em;
    }
    .btn-ghost {
      display: inline-block;
      padding: 10px 18px;
      border-radius: 100px;
      border: 1px solid;
      text-decoration: none;
      font-weight: 600;
      font-size: 13px;
    }
    .btn-wrap   { margin: 28px 0; }
    .divider    { height: 1px; margin: 24px 0; border: 0; }
    .code-box   { border-radius: 18px; padding: 30px; text-align: center; margin: 24px 0; }
    .code-text  { font-size: 40px; font-weight: 800; letter-spacing: 14px; font-variant-numeric: tabular-nums; font-family: 'SF Mono', 'Courier New', monospace; }
    .footer     { margin-top: 32px; text-align: left; padding-left: 4px; }
    .footer p   { font-size: 12px; margin: 0 0 4px; }
    .footer a   { color: inherit; text-decoration: underline; }
    ul          { color: #71717a; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 12px 0 20px; }
    li span     { font-weight: 700; }

    /* Subtle notice box */
    .notice { border-radius: 12px; padding: 14px 16px; margin-top: 12px; background: rgba(0,0,0,0.04); }
    @media (prefers-color-scheme: dark) {
      .notice { background: rgba(255,255,255,0.05) !important; }
      ul      { color: #a1a1aa !important; }
    }
  </style>
</head>
<body>
  <div class="email-bg">
    <div class="wrapper">

      <!-- Logo: CID-embedded so it renders without a CDN. Dark/light via media query. -->
      <div class="logo-wrap">
        <img class="logo-light" src="cid:${CID_BLACK}" alt="tazdan" />
        <img class="logo-dark"  src="cid:${CID_WHITE}" alt="tazdan" />
      </div>

      <div class="card">
        <!-- Gradient hero band — the brand signature on every email -->
        <div class="hero">
          <p class="hero-text">tazdan</p>
          <p class="hero-sub">money, simplified</p>
        </div>
        <div class="card-pad">
          ${body}
        </div>
      </div>

      <div class="footer">
        <p class="footer-text">Need help? <a href="mailto:support@tazdan.com">support@tazdan.com</a></p>
        <p class="footer-text">© tazdan — money, simplified</p>
      </div>

    </div>
  </div>
</body>
</html>`;
}

/* ─────────────────────────────────────────────────────────────
   Core send
───────────────────────────────────────────────────────────── */
// Domains that must never receive real emails (simulation, load-test, CI).
const SUPPRESSED_DOMAINS = ['tazdan.sim', 'tazdan.test', 'test.com', 'example.com', 'localhost'];

function isSuppressed(address: string): boolean {
  const domain = address.split('@')[1]?.toLowerCase() ?? '';
  return SUPPRESSED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export async function sendEmail({
  to,
  subject,
  html,
  sender = 'welcome',
}: {
  to: string;
  subject: string;
  html: string;
  /** Which branded address this email ships from. Defaults to the warm `hi@`. */
  sender?: SenderKey;
}) {
  if (isSuppressed(to)) {
    return; // silently drop — simulation/test address
  }
  if (!transporter) {
    console.warn(
      '[email] SMTP not configured — skipping send:',
      subject,
      'to',
      to,
      'missing',
      missingSmtpEnv.join(', ') || 'unknown',
    );
    return;
  }
  await transporter.sendMail({
    from:    fromHeader(sender),
    to,
    subject,
    html,
    // Inline attachments — referenced via cid: in the HTML so logos render
    // in every client without needing a public CDN URL. Gmail, Outlook, and
    // Apple Mail all support CID-embedded images in HTML email.
    attachments: [
      {
        filename:    'logo-black.png',
        path:        LOGO_BLACK_PATH,
        cid:         CID_BLACK,
        contentDisposition: 'inline',
      },
      {
        filename:    'logo-white.png',
        path:        LOGO_WHITE_PATH,
        cid:         CID_WHITE,
        contentDisposition: 'inline',
      },
    ],
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
    'Welcome to tazdan',
    `<h1 class="text-main">Welcome aboard, ${firstName}.</h1>
    <p class="text-muted">Your email is verified and your tazdan account is live. Below is a short, deliberate first run so you can start trading with confidence — most of it takes under five minutes.</p>

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
      <li><span class="text-main">Send &amp; receive</span> — pay any tazdan @handle instantly, or any external wallet.</li>
      <li><span class="text-main">Self-custody</span> — export your private keys whenever you want full ownership.</li>
    </ul>

    <div class="notice">
      <p class="text-muted" style="margin:0; font-size:13px;">Security reminder: tazdan will never ask for your password, 2FA code, or seed phrase. If anything looks wrong, email <a href="mailto:support@tazdan.com" style="color:inherit;">support@tazdan.com</a> immediately.</p>
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
    subject: `Welcome to tazdan, ${firstName} — let's get you set up`,
    html,
    sender: 'welcome',
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
    'Verify your email — tazdan',
    `<h1 class="text-main">Confirm your email</h1>
    <p class="text-muted">Hi ${firstName}, enter this code to verify your tazdan account.</p>

    <div class="code-box">
      <div class="code-text">${code}</div>
    </div>

    <div class="notice">
      <p class="text-muted" style="margin:0; font-size:13px;">Expires in 24 hours. Didn't sign up? You can safely ignore this.</p>
    </div>`
  );
  await sendEmail({ to, subject: 'Your tazdan verification code', html, sender: 'auth' });
}

/* ─────────────────────────────────────────────────────────────
   Waitlist Confirmation
───────────────────────────────────────────────────────────── */
export async function sendWaitlistConfirmation({ to }: { to: string }) {
  const html = baseTemplate(
    "You're on the waitlist — tazdan",
    `<h1 class="text-main">You're on the list.</h1>
    <p class="text-muted">Thanks for joining the tazdan early-access waitlist. You'll be among the first to know when we open your region — and you'll get <strong class="text-main">0% fees for your first 6 months</strong>.</p>

    <div class="divider"></div>

    <p class="text-main" style="font-weight:700; font-size:15px; margin-bottom:6px;">What happens next?</p>
    <p class="text-muted">We're onboarding users region by region. When your spot is ready you'll receive an invitation with a direct link to create your account.</p>
    <p class="text-muted">In the meantime, share your link with friends — each referral moves you up the queue automatically.</p>

    <div class="divider"></div>

    <p class="text-muted" style="font-size:13px; margin:0;">Questions? Reply to this email or visit <a href="${CLIENT_URL}/faq" style="color:inherit;">tazdan.com/faq</a>.</p>`,
  );
  await sendEmail({ to, subject: "You're on the tazdan waitlist", html, sender: 'welcome' });
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
    'Reset your password — tazdan',
    `<h1 class="text-main">Reset your password</h1>
    <p class="text-muted">Hi ${firstName}, we received a request to reset your tazdan password.</p>

    <div class="btn-wrap">
      <a href="${resetUrl}" class="btn">Set New Password</a>
    </div>

    <div class="notice">
      <p class="text-muted" style="margin:0 0 6px; font-size:13px;">Or copy this link:</p>
      <p class="text-muted" style="margin:0; font-size:11px; word-break:break-all;">${resetUrl}</p>
    </div>

    <p class="text-muted" style="font-size:12px; margin-top:16px;">This link expires in 1 hour. Didn't request this? Your account is safe — ignore this email.</p>`
  );
  await sendEmail({ to, subject: 'Reset your tazdan password', html, sender: 'auth' });
}
/* ─────────────────────────────────────────────────────────────
   Withdrawal Confirmed
───────────────────────────────────────────────────────────── */
export async function sendWithdrawalConfirmed({
  to, firstName, asset, amount, txHash, toAddress, network,
}: {
  to: string; firstName: string; asset: string; amount: string;
  txHash: string; toAddress: string; network: string;
}) {
  const confirmTimes: Record<string, string> = {
    ETH: '~1 minute', ERC20: '~1 minute',
    BTC: '~60 minutes', SOL: '~30 seconds', TRON: '~1 minute', TRC20: '~1 minute',
  };
  const eta = confirmTimes[network.toUpperCase()] ?? confirmTimes[asset.toUpperCase()] ?? '~5 minutes';
  const shortHash = txHash.length > 20 ? `${txHash.slice(0, 10)}…${txHash.slice(-8)}` : txHash;
  const shortAddr = toAddress.length > 20 ? `${toAddress.slice(0, 10)}…${toAddress.slice(-8)}` : toAddress;

  const html = baseTemplate(
    `Withdrawal sent — ${amount} ${asset}`,
    `<h1 class="text-main">Withdrawal sent</h1>
    <p class="text-muted">Hi ${firstName}, your ${amount} ${asset} has been broadcast to the ${network} network.</p>

    <div class="divider"></div>

    <ul>
      <li><span class="text-main">Amount</span> — ${amount} ${asset}</li>
      <li><span class="text-main">Network</span> — ${network}</li>
      <li><span class="text-main">To</span> — <span style="font-family:monospace;font-size:13px;">${shortAddr}</span></li>
      <li><span class="text-main">Tx hash</span> — <span style="font-family:monospace;font-size:13px;">${shortHash}</span></li>
      <li><span class="text-main">Estimated confirmation</span> — ${eta}</li>
    </ul>

    <div class="notice">
      <p class="text-muted" style="margin:0; font-size:13px;">This withdrawal cannot be reversed once broadcast. If you did not initiate this, contact <a href="mailto:support@tazdan.com" style="color:inherit;">support@tazdan.com</a> immediately.</p>
    </div>`,
  );
  await sendEmail({ to, subject: `Withdrawal sent — ${amount} ${asset}`, html, sender: 'txn' });
}

/* ─────────────────────────────────────────────────────────────
   Deposit Confirmed
───────────────────────────────────────────────────────────── */
export async function sendDepositConfirmed({
  to, firstName, asset, amount, txHash,
}: {
  to: string; firstName: string; asset: string; amount: string; txHash: string;
}) {
  const shortHash = txHash.length > 20 ? `${txHash.slice(0, 10)}…${txHash.slice(-8)}` : txHash;
  const html = baseTemplate(
    `${amount} ${asset} arrived`,
    `<h1 class="text-main">${amount} ${asset} received</h1>
    <p class="text-muted">Hi ${firstName}, your deposit has been confirmed and is now available in your tazdan wallet.</p>

    <div class="divider"></div>

    <ul>
      <li><span class="text-main">Amount</span> — ${amount} ${asset}</li>
      <li><span class="text-main">Tx hash</span> — <span style="font-family:monospace;font-size:13px;">${shortHash}</span></li>
    </ul>

    <div class="btn-wrap">
      <a href="${CLIENT_URL}/dashboard/wallet" class="btn">View wallet</a>
    </div>`,
  );
  await sendEmail({ to, subject: `${amount} ${asset} arrived in your wallet`, html, sender: 'txn' });
}

/* ─────────────────────────────────────────────────────────────
   P2P Trade Update
───────────────────────────────────────────────────────────── */
const TRADE_STATUS_MAP: Record<string, { label: string; note: string }> = {
  IN_PROGRESS:     { label: 'Trade started',                        note: 'The trade is now active. Transfer the agreed fiat amount and mark payment sent in the app.' },
  PAYMENT_PENDING: { label: 'Awaiting payment',                     note: 'The seller is waiting for your payment. Complete the transfer and tap "Mark Payment Sent".' },
  PAYMENT_SENT:    { label: 'Buyer marked payment sent',            note: 'Check your account. Once you confirm receipt, release the crypto to complete the trade.' },
  COMPLETED:       { label: 'Trade completed — funds released',     note: 'Crypto has been released to the buyer. The trade is now closed.' },
  DISPUTED:        { label: 'Trade dispute opened',                 note: 'Our support team has been notified and will review the trade within 24 hours.' },
  CANCELLED:       { label: 'Trade cancelled',                      note: 'This trade has been cancelled. Any held funds have been returned.' },
};

export async function sendP2PTradeUpdate({
  to, firstName, status, asset, amount, tradeId,
}: {
  to: string; firstName: string; status: string; asset: string; amount: string; tradeId: string;
}) {
  const info = TRADE_STATUS_MAP[status] ?? { label: status.replace(/_/g, ' '), note: '' };
  const html = baseTemplate(
    `Trade update — ${info.label}`,
    `<h1 class="text-main">${info.label}</h1>
    <p class="text-muted">Hi ${firstName},</p>
    <p class="text-muted">${info.note}</p>

    <div class="divider"></div>

    <ul>
      <li><span class="text-main">Asset</span> — ${amount} ${asset}</li>
      <li><span class="text-main">Trade ID</span> — <span style="font-family:monospace;font-size:13px;">${tradeId.slice(0, 8)}…</span></li>
    </ul>

    <div class="btn-wrap">
      <a href="${CLIENT_URL}/dashboard/p2p/${tradeId}" class="btn">View trade</a>
    </div>`,
  );
  await sendEmail({ to, subject: `P2P trade update — ${info.label}`, html, sender: 'txn' });
}

/* ─────────────────────────────────────────────────────────────
   KYC Status Update
───────────────────────────────────────────────────────────── */
export async function sendKYCStatusUpdate({
  to, firstName, status, tier, reasonCode,
}: {
  to: string; firstName: string;
  status: 'APPROVED' | 'REJECTED' | 'RESUBMIT_REQUIRED';
  tier?: string; reasonCode?: string;
}) {
  const tierPerks: Record<string, string> = {
    TIER_1: 'Deposits, P2P trading, and crypto buy/sell are now unlocked.',
    TIER_2: 'Virtual Visa card issuance, higher daily limits, and off-ramp are now unlocked.',
    TIER_3: 'Full access — institutional limits and private-key export are now available.',
  };

  let subject: string;
  let body: string;

  if (status === 'APPROVED') {
    subject = `KYC approved — you're now ${tier ?? 'verified'}`;
    body = `<h1 class="text-main">Identity verified ✓</h1>
    <p class="text-muted">Hi ${firstName}, your identity has been successfully verified.</p>
    ${tier ? `<div class="notice"><p class="text-muted" style="margin:0;">${tierPerks[tier] ?? 'Your account limits have been upgraded.'}</p></div>` : ''}
    <div class="btn-wrap" style="margin-top:24px;">
      <a href="${CLIENT_URL}/dashboard" class="btn">Go to dashboard</a>
    </div>`;
  } else if (status === 'REJECTED') {
    subject = 'KYC verification unsuccessful';
    body = `<h1 class="text-main">Verification unsuccessful</h1>
    <p class="text-muted">Hi ${firstName}, we were unable to verify your identity at this time.</p>
    ${reasonCode ? `<div class="notice"><p class="text-muted" style="margin:0; font-size:13px;">Reason: <strong>${reasonCode}</strong></p></div>` : ''}
    <p class="text-muted" style="margin-top:16px;">Please contact <a href="mailto:support@tazdan.com" style="color:inherit;">support@tazdan.com</a> if you believe this is an error or need help resubmitting your documents.</p>`;
  } else {
    subject = 'Action required — please resubmit your KYC documents';
    body = `<h1 class="text-main">Documents need updating</h1>
    <p class="text-muted">Hi ${firstName}, we need you to resubmit one or more documents to complete your verification.</p>
    ${reasonCode ? `<div class="notice"><p class="text-muted" style="margin:0; font-size:13px;">Reason: <strong>${reasonCode}</strong></p></div>` : ''}
    <div class="btn-wrap" style="margin-top:24px;">
      <a href="${CLIENT_URL}/dashboard/kyc" class="btn">Resubmit documents</a>
    </div>`;
  }

  await sendEmail({ to, subject, html: baseTemplate(subject, body) });
}

/* ─────────────────────────────────────────────────────────────
   Transactional confirmations — buy, sell, swap, transfer

   These are sent automatically by exchange / wallet / transfer
   controllers immediately after each money-movement settles.
   Subject lines stay terse so they read well in iOS push previews.
───────────────────────────────────────────────────────────── */

function formatTime(d: Date = new Date()): string {
  return d.toUTCString();
}

function receiptCta(id: string): string {
  return `<div class="btn-wrap" style="margin-top:24px;">
      <a href="${CLIENT_URL}/dashboard/history/${id}" class="btn">View receipt</a>
    </div>`;
}

/* ── Buy confirmed ──────────────────────────────────────────── */
export async function sendBuyConfirmed({
  to, firstName, asset, amount, fiatSpent, fiatCurrency, rate, fees, orderId,
}: {
  to: string; firstName: string; asset: string; amount: string;
  fiatSpent: string; fiatCurrency: string; rate: string; fees: string; orderId: string;
}) {
  const subject = `Bought ${amount} ${asset} for ${fiatSpent} ${fiatCurrency}`;
  const html = baseTemplate(
    subject,
    `<h1 class="text-main">Trade filled</h1>
    <p class="text-muted">Hi ${firstName}, your buy order has been filled. The ${asset} is now in your tazdan wallet.</p>

    <div class="divider"></div>

    <ul>
      <li><span class="text-main">Bought</span> — ${amount} ${asset}</li>
      <li><span class="text-main">Paid</span> — ${fiatSpent} ${fiatCurrency}</li>
      <li><span class="text-main">Rate</span> — 1 ${asset} = ${rate} ${fiatCurrency}</li>
      <li><span class="text-main">Fees</span> — ${fees} ${fiatCurrency}</li>
      <li><span class="text-main">Order ID</span> — <span style="font-family:monospace;font-size:13px;">${orderId.slice(0, 12)}…</span></li>
      <li><span class="text-main">Time</span> — ${formatTime()}</li>
    </ul>

    ${receiptCta(orderId)}

    <div class="notice">
      <p class="text-muted" style="margin:0; font-size:13px;">If you did not place this order, contact <a href="mailto:support@tazdan.com" style="color:inherit;">support@tazdan.com</a> immediately.</p>
    </div>`,
  );
  await sendEmail({ to, subject, html, sender: 'txn' });
}

/* ── Sell confirmed ─────────────────────────────────────────── */
export async function sendSellConfirmed({
  to, firstName, asset, amount, fiatReceived, fiatCurrency, rate, fees, orderId,
}: {
  to: string; firstName: string; asset: string; amount: string;
  fiatReceived: string; fiatCurrency: string; rate: string; fees: string; orderId: string;
}) {
  const subject = `Sold ${amount} ${asset} for ${fiatReceived} ${fiatCurrency}`;
  const html = baseTemplate(
    subject,
    `<h1 class="text-main">Trade filled</h1>
    <p class="text-muted">Hi ${firstName}, your sell order has been filled. ${fiatReceived} ${fiatCurrency} has been credited to your tazdan wallet.</p>

    <div class="divider"></div>

    <ul>
      <li><span class="text-main">Sold</span> — ${amount} ${asset}</li>
      <li><span class="text-main">Received</span> — ${fiatReceived} ${fiatCurrency}</li>
      <li><span class="text-main">Rate</span> — 1 ${asset} = ${rate} ${fiatCurrency}</li>
      <li><span class="text-main">Fees</span> — ${fees} ${fiatCurrency}</li>
      <li><span class="text-main">Order ID</span> — <span style="font-family:monospace;font-size:13px;">${orderId.slice(0, 12)}…</span></li>
      <li><span class="text-main">Time</span> — ${formatTime()}</li>
    </ul>

    ${receiptCta(orderId)}

    <div class="notice">
      <p class="text-muted" style="margin:0; font-size:13px;">If you did not place this order, contact <a href="mailto:support@tazdan.com" style="color:inherit;">support@tazdan.com</a> immediately.</p>
    </div>`,
  );
  await sendEmail({ to, subject, html, sender: 'txn' });
}

/* ── Swap confirmed ─────────────────────────────────────────── */
export async function sendSwapConfirmed({
  to, firstName, fromAsset, fromAmount, toAsset, toAmount, rate, fees, orderId,
}: {
  to: string; firstName: string;
  fromAsset: string; fromAmount: string;
  toAsset:   string; toAmount:   string;
  rate: string; fees: string; orderId: string;
}) {
  const subject = `Swapped ${fromAmount} ${fromAsset} → ${toAmount} ${toAsset}`;
  const html = baseTemplate(
    subject,
    `<h1 class="text-main">Swap complete</h1>
    <p class="text-muted">Hi ${firstName}, your in-wallet swap has settled. The new balance is reflected in your tazdan wallet.</p>

    <div class="divider"></div>

    <ul>
      <li><span class="text-main">From</span> — ${fromAmount} ${fromAsset}</li>
      <li><span class="text-main">To</span> — ${toAmount} ${toAsset}</li>
      <li><span class="text-main">Rate</span> — 1 ${fromAsset} = ${rate} ${toAsset}</li>
      <li><span class="text-main">Fees</span> — ${fees}</li>
      <li><span class="text-main">Order ID</span> — <span style="font-family:monospace;font-size:13px;">${orderId.slice(0, 12)}…</span></li>
      <li><span class="text-main">Time</span> — ${formatTime()}</li>
    </ul>

    ${receiptCta(orderId)}`,
  );
  await sendEmail({ to, subject, html, sender: 'txn' });
}

/* ── Internal transfer sent (sender copy) ───────────────────── */
export async function sendTransferSent({
  to, firstName, recipientHandle, asset, amount, fiatEquiv, note, transferId,
}: {
  to: string; firstName: string; recipientHandle: string;
  asset: string; amount: string; fiatEquiv?: string; note?: string; transferId: string;
}) {
  const subject = `Sent ${amount} ${asset} to @${recipientHandle}`;
  const html = baseTemplate(
    subject,
    `<h1 class="text-main">Transfer sent</h1>
    <p class="text-muted">Hi ${firstName}, you sent ${amount} ${asset} to <strong class="text-main">@${recipientHandle}</strong>. The recipient has been notified.</p>

    <div class="divider"></div>

    <ul>
      <li><span class="text-main">Amount</span> — ${amount} ${asset}${fiatEquiv ? ` <span class="text-muted">(${fiatEquiv})</span>` : ''}</li>
      <li><span class="text-main">To</span> — @${recipientHandle}</li>
      ${note ? `<li><span class="text-main">Note</span> — ${note}</li>` : ''}
      <li><span class="text-main">Transfer ID</span> — <span style="font-family:monospace;font-size:13px;">${transferId.slice(0, 12)}…</span></li>
      <li><span class="text-main">Time</span> — ${formatTime()}</li>
    </ul>

    ${receiptCta(transferId)}

    <div class="notice">
      <p class="text-muted" style="margin:0; font-size:13px;">Internal transfers settle instantly and cannot be reversed. If this wasn't you, contact <a href="mailto:support@tazdan.com" style="color:inherit;">support@tazdan.com</a> immediately.</p>
    </div>`,
  );
  await sendEmail({ to, subject, html, sender: 'txn' });
}

/* ─────────────────────────────────────────────────────────────
   Claim-link transfers — recipient invitation + sender notification

   The recipient email is the entire first-touch surface for users who
   don't yet have a tazdan account. It needs to feel like opening a
   real gift, not a "you have funds" robocall. Plain language, big
   amount, one button, no jargon. Sender's avatar/handle on top frames
   the trust.
───────────────────────────────────────────────────────────── */
function fmtDate(d: Date): string {
  try {
    return d.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return d.toISOString();
  }
}

export async function sendClaimLinkPending({
  to, senderFirst, senderHandle, asset, amount, note, claimUrl, expiresAt, hasPin,
}: {
  to: string; senderFirst: string; senderHandle: string;
  asset: string; amount: string; note?: string | null;
  claimUrl: string; expiresAt: Date; hasPin: boolean;
}) {
  const who = senderHandle ? `@${senderHandle}` : (senderFirst || 'A tazdan user');
  const subject = `${who} sent you ${amount} ${asset}`;

  // Generate QR code as data URI for inline embedding
  const qrDataUri = await QRCode.toDataURL(claimUrl, {
    width: 220,
    margin: 2,
    color: { dark: '#09090b', light: '#ffffff' },
  });

  const html = baseTemplate(
    subject,
    `<h1 class="text-main">You have ${amount} ${asset} waiting.</h1>
    <p class="text-muted">${who} just sent you money on tazdan. Tap the button below to claim it — you can sign up in seconds if you don't have an account yet, and the funds land in your wallet instantly.</p>

    <div class="divider"></div>

    <ul>
      <li><span class="text-main">Amount</span> — ${amount} ${asset}</li>
      <li><span class="text-main">From</span> — ${who}</li>
      ${note ? `<li><span class="text-main">Note</span> — ${note}</li>` : ''}
      <li><span class="text-main">Expires</span> — ${fmtDate(expiresAt)}</li>
      ${hasPin ? `<li><span class="text-main">Security</span> — The sender set a PIN. Ask them for the 4–8 digit code.</li>` : ''}
    </ul>

    <div class="btn-wrap" style="margin-top:24px;">
      <a href="${claimUrl}" class="btn">Claim ${amount} ${asset}</a>
    </div>

    <div style="text-align:center; margin:28px 0;">
      <p class="text-muted" style="font-size:12px; font-weight:600; margin-bottom:12px; text-transform:uppercase; letter-spacing:1px;">Or scan with your camera</p>
      <img src="${qrDataUri}" alt="Scan to claim" width="220" height="220" style="border-radius:16px; border:1px solid #e4e4e7; background:#ffffff;" />
      <p class="text-muted" style="font-size:11px; margin-top:8px;">Scan with the tazdan app or any QR scanner</p>
    </div>

    <div class="notice">
      <p class="text-muted" style="margin:0; font-size:13px;">This link is only valid for you. If you can't tap the button, copy this URL into your browser: <a href="${claimUrl}" style="color:inherit; word-break:break-all;">${claimUrl}</a></p>
    </div>

    <p class="text-muted" style="font-size:12px; margin-top:18px;">
      Don't recognise the sender? You can safely ignore this — the funds will return to them automatically after the expiry date.
    </p>`,
  );
  await sendEmail({ to, subject, html, sender: 'txn' });
}

export async function sendClaimLinkClaimedSenderCopy({
  to, senderFirst, claimerLabel, asset, amount, linkId,
}: {
  to: string; senderFirst: string; claimerLabel: string;
  asset: string; amount: string; linkId: string;
}) {
  const subject = `${claimerLabel} claimed your ${amount} ${asset}`;
  const html = baseTemplate(
    subject,
    `<h1 class="text-main">Claim collected.</h1>
    <p class="text-muted">Hi ${senderFirst}, the claim link you sent has been picked up. The ${amount} ${asset} has now been delivered.</p>

    <div class="divider"></div>

    <ul>
      <li><span class="text-main">Amount</span> — ${amount} ${asset}</li>
      <li><span class="text-main">Claimed by</span> — ${claimerLabel}</li>
      <li><span class="text-main">Time</span> — ${formatTime()}</li>
      <li><span class="text-main">Reference</span> — <span style="font-family:monospace;font-size:13px;">${linkId.slice(0, 12)}…</span></li>
    </ul>

    ${receiptCta(linkId)}`,
  );
  await sendEmail({ to, subject, html, sender: 'txn' });
}

/* ── Internal transfer received (recipient copy) ────────────── */
export async function sendTransferReceived({
  to, firstName, senderHandle, asset, amount, fiatEquiv, note, transferId,
}: {
  to: string; firstName: string; senderHandle: string;
  asset: string; amount: string; fiatEquiv?: string; note?: string; transferId: string;
}) {
  const subject = `You received ${amount} ${asset} from @${senderHandle}`;
  const html = baseTemplate(
    subject,
    `<h1 class="text-main">You received ${amount} ${asset}</h1>
    <p class="text-muted">Hi ${firstName}, <strong class="text-main">@${senderHandle}</strong> sent you ${amount} ${asset}. It's already in your tazdan wallet.</p>

    <div class="divider"></div>

    <ul>
      <li><span class="text-main">Amount</span> — ${amount} ${asset}${fiatEquiv ? ` <span class="text-muted">(${fiatEquiv})</span>` : ''}</li>
      <li><span class="text-main">From</span> — @${senderHandle}</li>
      ${note ? `<li><span class="text-main">Note</span> — ${note}</li>` : ''}
      <li><span class="text-main">Transfer ID</span> — <span style="font-family:monospace;font-size:13px;">${transferId.slice(0, 12)}…</span></li>
      <li><span class="text-main">Time</span> — ${formatTime()}</li>
    </ul>

    ${receiptCta(transferId)}`,
  );
  await sendEmail({ to, subject, html, sender: 'txn' });
}
