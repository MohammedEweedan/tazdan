import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || process.env.MAIL_FROM || 'noreply@promrkts.com';
const CLIENT_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://promrkts.com';

const hasCredentials = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = hasCredentials
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

function baseTemplate(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b1120; color: #f1f5f9; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
    .logo { text-align: center; margin-bottom: 32px; }
    .logo-text { font-size: 24px; font-weight: 800; color: #4a8fe0; letter-spacing: -0.02em; }
    .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 32px; }
    h1 { font-size: 20px; font-weight: 800; margin: 0 0 16px; color: #f1f5f9; }
    p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 16px; }
    .btn { display: inline-block; padding: 14px 28px; border-radius: 12px; background: linear-gradient(135deg, #0057b8, #4a8fe0); color: #fff; text-decoration: none; font-weight: 700; font-size: 14px; }
    .btn:hover { opacity: 0.92; }
    .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #475569; }
    .footer a { color: #4a8fe0; text-decoration: none; }
    .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 24px 0; }
    .highlight { color: #22c55e; font-weight: 700; }
    .warning { color: #ef4444; font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo"><div class="logo-text">promrkts</div></div>
    <div class="card">
      ${body}
    </div>
    <div class="footer">
      <p>Need help? Contact us at <a href="mailto:support@promrkts.com">support@promrkts.com</a></p>
      <p>promrkts — crypto, simplified</p>
    </div>
  </div>
</body>
</html>`;
}

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

export async function sendWelcomeEmail({
  to,
  firstName,
}: {
  to: string;
  firstName: string;
}) {
  const html = baseTemplate(
    'Welcome to promrkts',
    `<h1>Welcome aboard, ${firstName}!</h1>
    <p>Your promrkts account is ready. Here is how to get started:</p>
    <ul style="color:#94a3b8; font-size:14px; line-height:1.7; padding-left:20px;">
      <li><span class="highlight">Deposit funds</span> — head to your Wallet and top up via bank transfer or crypto.</li>
      <li><span class="highlight">Trade instantly</span> — buy & sell BTC, ETH, SOL and more at live market rates.</li>
      <li><span class="highlight">Send & Receive</span> — transfer to other promrkts users or any external wallet.</li>
      <li><span class="highlight">P2P Marketplace</span> — trade directly with verified peers in your local currency.</li>
    </ul>
    <div style="text-align:center; margin: 28px 0;">
      <a href="${CLIENT_URL}/dashboard" class="btn">Open Dashboard</a>
    </div>
    <div class="divider"></div>
    <p><strong>Download the mobile app</strong></p>
    <p>Take promrkts with you everywhere:</p>
    <div style="text-align:center; margin: 16px 0;">
      <a href="https://apps.apple.com" style="display:inline-block; margin:0 8px; padding:10px 18px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:10px; color:#f1f5f9; text-decoration:none; font-size:13px; font-weight:600;">App Store (iOS)</a>
      <a href="https://play.google.com" style="display:inline-block; margin:0 8px; padding:10px 18px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:10px; color:#f1f5f9; text-decoration:none; font-size:13px; font-weight:600;">Google Play (Android)</a>
    </div>
    <p style="font-size:12px; color:#475569;">Or access the web portal at <a href="${CLIENT_URL}" style="color:#4a8fe0;">${CLIENT_URL}</a></p>`
  );
  await sendEmail({ to, subject: 'Welcome to promrkts — let\'s get started', html });
}

export async function sendVerificationEmail({
  to,
  firstName,
  token,
}: {
  to: string;
  firstName: string;
  token: string;
}) {
  const verifyUrl = `${CLIENT_URL}/auth/verify-email?token=${token}`;
  const html = baseTemplate(
    'Verify your email — promrkts',
    `<h1>Confirm your email</h1>
    <p>Hi ${firstName},</p>
    <p>Please verify your email address to secure your promrkts account and unlock all features.</p>
    <div style="text-align:center; margin: 28px 0;">
      <a href="${verifyUrl}" class="btn">Verify Email</a>
    </div>
    <p style="font-size:12px; color:#475569;">Or copy and paste this link into your browser:</p>
    <p style="font-size:12px; word-break:break-all; color:#475569;">${verifyUrl}</p>
    <p style="font-size:12px; color:#475569; margin-top:16px;">This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>`
  );
  await sendEmail({ to, subject: 'Verify your promrkts email address', html });
}

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
    `<h1>Reset your password</h1>
    <p>Hi ${firstName},</p>
    <p>We received a request to reset the password for your promrkts account. Click the button below to choose a new password.</p>
    <div style="text-align:center; margin: 28px 0;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </div>
    <p style="font-size:12px; color:#475569;">Or copy and paste this link into your browser:</p>
    <p style="font-size:12px; word-break:break-all; color:#475569;">${resetUrl}</p>
    <p style="font-size:12px; color:#475569; margin-top:16px;">This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email — your account remains secure.</p>`
  );
  await sendEmail({ to, subject: 'Reset your promrkts password', html });
}
