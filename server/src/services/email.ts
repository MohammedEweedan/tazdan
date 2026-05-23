import nodemailer from 'nodemailer';
import path from 'path';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
// From address — defaults to the branded sender. Override in .env with SMTP_FROM.
const SMTP_FROM = process.env.SMTP_FROM || process.env.MAIL_FROM || 'hi@fortuni.com';
const CLIENT_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://fortuni.com';

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
const CID_BLACK = 'logo-black@fortuni.com';
const CID_WHITE = 'logo-white@fortuni.com';

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
    .logo-wrap img { height: 24px; width: auto; max-width: 100px; }
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

      <!-- Logo: CID-embedded so it renders without a CDN. Dark/light via media query. -->
      <div class="logo-wrap">
        <img class="logo-light" src="cid:${CID_BLACK}" alt="fortuni" />
        <img class="logo-dark"  src="cid:${CID_WHITE}" alt="fortuni" />
      </div>

      <div class="card">
        ${body}
      </div>

      <div class="footer">
        <p class="footer-text">Need help? <a href="mailto:support@fortuni.com">support@fortuni.com</a></p>
        <p class="footer-text">fortuni — money, simplified</p>
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
    from:    `"fortuni" <${SMTP_FROM}>`,
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
    'Welcome to fortuni',
    `<h1 class="text-main">Welcome aboard, ${firstName}.</h1>
    <p class="text-muted">Your email is verified and your fortuni account is live. Below is a short, deliberate first run so you can start trading with confidence — most of it takes under five minutes.</p>

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
      <li><span class="text-main">Send &amp; receive</span> — pay any fortuni @handle instantly, or any external wallet.</li>
      <li><span class="text-main">Self-custody</span> — export your private keys whenever you want full ownership.</li>
    </ul>

    <div class="notice">
      <p class="text-muted" style="margin:0; font-size:13px;">Security reminder: fortuni will never ask for your password, 2FA code, or seed phrase. If anything looks wrong, email <a href="mailto:support@fortuni.com" style="color:inherit;">support@fortuni.com</a> immediately.</p>
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
    subject: `Welcome to fortuni, ${firstName} — let's get you set up`,
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
    'Verify your email — fortuni',
    `<h1 class="text-main">Confirm your email</h1>
    <p class="text-muted">Hi ${firstName}, enter this code to verify your fortuni account.</p>

    <div class="code-box">
      <div class="code-text">${code}</div>
    </div>

    <div class="notice">
      <p class="text-muted" style="margin:0; font-size:13px;">Expires in 24 hours. Didn't sign up? You can safely ignore this.</p>
    </div>`
  );
  await sendEmail({ to, subject: 'Your fortuni verification code', html });
}

/* ─────────────────────────────────────────────────────────────
   Waitlist Confirmation
───────────────────────────────────────────────────────────── */
export async function sendWaitlistConfirmation({ to }: { to: string }) {
  const html = baseTemplate(
    "You're on the waitlist — fortuni",
    `<h1 class="text-main">You're on the list.</h1>
    <p class="text-muted">Thanks for joining the fortuni early-access waitlist. You'll be among the first to know when we open your region — and you'll get <strong class="text-main">0% fees for your first 6 months</strong>.</p>

    <div class="divider"></div>

    <p class="text-main" style="font-weight:700; font-size:15px; margin-bottom:6px;">What happens next?</p>
    <p class="text-muted">We're onboarding users region by region. When your spot is ready you'll receive an invitation with a direct link to create your account.</p>
    <p class="text-muted">In the meantime, share your link with friends — each referral moves you up the queue automatically.</p>

    <div class="divider"></div>

    <p class="text-muted" style="font-size:13px; margin:0;">Questions? Reply to this email or visit <a href="${CLIENT_URL}/faq" style="color:inherit;">fortuni.com/faq</a>.</p>`,
  );
  await sendEmail({ to, subject: "You're on the fortuni waitlist", html });
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
    'Reset your password — fortuni',
    `<h1 class="text-main">Reset your password</h1>
    <p class="text-muted">Hi ${firstName}, we received a request to reset your fortuni password.</p>

    <div class="btn-wrap">
      <a href="${resetUrl}" class="btn">Set New Password</a>
    </div>

    <div class="notice">
      <p class="text-muted" style="margin:0 0 6px; font-size:13px;">Or copy this link:</p>
      <p class="text-muted" style="margin:0; font-size:11px; word-break:break-all;">${resetUrl}</p>
    </div>

    <p class="text-muted" style="font-size:12px; margin-top:16px;">This link expires in 1 hour. Didn't request this? Your account is safe — ignore this email.</p>`
  );
  await sendEmail({ to, subject: 'Reset your fortuni password', html });
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
      <p class="text-muted" style="margin:0; font-size:13px;">This withdrawal cannot be reversed once broadcast. If you did not initiate this, contact <a href="mailto:support@fortuni.com" style="color:inherit;">support@fortuni.com</a> immediately.</p>
    </div>`,
  );
  await sendEmail({ to, subject: `Withdrawal sent — ${amount} ${asset}`, html });
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
    <p class="text-muted">Hi ${firstName}, your deposit has been confirmed and is now available in your fortuni wallet.</p>

    <div class="divider"></div>

    <ul>
      <li><span class="text-main">Amount</span> — ${amount} ${asset}</li>
      <li><span class="text-main">Tx hash</span> — <span style="font-family:monospace;font-size:13px;">${shortHash}</span></li>
    </ul>

    <div class="btn-wrap">
      <a href="${CLIENT_URL}/dashboard/wallet" class="btn">View wallet</a>
    </div>`,
  );
  await sendEmail({ to, subject: `${amount} ${asset} arrived in your wallet`, html });
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
  await sendEmail({ to, subject: `P2P trade update — ${info.label}`, html });
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
    <p class="text-muted" style="margin-top:16px;">Please contact <a href="mailto:support@fortuni.com" style="color:inherit;">support@fortuni.com</a> if you believe this is an error or need help resubmitting your documents.</p>`;
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
