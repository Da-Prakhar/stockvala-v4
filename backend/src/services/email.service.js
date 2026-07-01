import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { BrokerSetting } from '../models/index.js';

dotenv.config();

// ─── Cached company info (refreshed every 5 min) ───
let _company = null;
let _companyFetchedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getCompany() {
  if (_company && Date.now() - _companyFetchedAt < CACHE_TTL) return _company;
  try {
    // Try category-based storage first (new format)
    const rows = await BrokerSetting.findAll({ where: { category: 'company' } });
    if (rows.length > 0) {
      const s = {};
      rows.forEach(r => { s[r.key] = r.value; });
      _company = {
        name: s.companyName || process.env.EMAIL_FROM_NAME || '',
        email: s.email || process.env.EMAIL_FROM || '',
        phone: s.phone || '',
        address: s.address || '',
        logoUrl: s.logoUrl || null,
        website: s.website || process.env.LANDING_URL || '',
      };
    } else {
      // Fallback: legacy single-key format
      const row = await BrokerSetting.findOne({ where: { key: 'company' } });
      if (row) {
        const parsed = JSON.parse(row.value);
        _company = {
          name: parsed.companyName || process.env.EMAIL_FROM_NAME || '',
          email: parsed.email || process.env.EMAIL_FROM || '',
          phone: parsed.phone || '',
          address: parsed.address || '',
          logoUrl: parsed.logoUrl || null,
          website: parsed.website || process.env.LANDING_URL || '',
        };
      }
    }
  } catch (e) {
    // DB not ready or table missing — use env defaults
  }
  if (!_company) {
    _company = {
      name: process.env.EMAIL_FROM_NAME || '',
      email: process.env.EMAIL_FROM || '',
      phone: '',
      address: '',
      logoUrl: null,
      website: process.env.LANDING_URL || '',
    };
  }
  _companyFetchedAt = Date.now();
  return _company;
}

// ─── Transporter (supports DB-driven SMTP config) ───
let _transporter = null;
let _smtpConfig = null;
let _smtpFetchedAt = 0;
const SMTP_CACHE_TTL = 5 * 60 * 1000;

async function getSmtpConfig() {
  if (_smtpConfig && Date.now() - _smtpFetchedAt < SMTP_CACHE_TTL) return _smtpConfig;
  try {
    // Try category-based storage first (new format)
    const rows = await BrokerSetting.findAll({ where: { category: 'smtp' } });
    if (rows.length > 0) {
      const s = {};
      rows.forEach(r => { s[r.key] = r.value; });
      if (s.host && s.user && s.password) {
        _smtpConfig = {
          host: s.host,
          port: parseInt(s.port) || 465,
          user: s.user,
          password: s.password,
          fromName: s.fromName || '',
          fromEmail: s.fromEmail || s.user,
        };
        _smtpFetchedAt = Date.now();
        return _smtpConfig;
      }
    } else {
      // Fallback: legacy single-key 'smtp' format
      const row = await BrokerSetting.findOne({ where: { key: 'smtp' } });
      if (row) {
        const parsed = JSON.parse(row.value);
        if (parsed.host && parsed.user && parsed.password) {
          _smtpConfig = {
            host: parsed.host,
            port: parseInt(parsed.port) || 465,
            user: parsed.user,
            password: parsed.password,
            fromName: parsed.fromName || '',
            fromEmail: parsed.fromEmail || parsed.user,
          };
          _smtpFetchedAt = Date.now();
          return _smtpConfig;
        }
      }
    }
  } catch (e) { /* DB not ready */ }

  // Fall back to .env
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    _smtpConfig = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASSWORD,
      fromName: process.env.EMAIL_FROM_NAME || '',
      fromEmail: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    };
  }
  _smtpFetchedAt = Date.now();
  return _smtpConfig;
}

async function getTransporter() {
  const smtp = await getSmtpConfig();
  if (!smtp) return null;

  // Re-create transporter if config changed
  const key = `${smtp.host}:${smtp.port}:${smtp.user}`;
  if (_transporter && _transporter._configKey === key) return _transporter;

  _transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.password },
  });
  _transporter._configKey = key;
  return _transporter;
}

const sendEmail = async (to, subject, text, html) => {
  try {
    const company = await getCompany();
    const smtp = await getSmtpConfig();
    const transport = await getTransporter();
    if (transport) {
      const fromName = smtp?.fromName || company.name;
      const fromEmail = smtp?.fromEmail || smtp?.user || company.email;
      await transport.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        text,
        html,
      });
      console.log(`[Email] ✅ Sent to ${to}: ${subject}`);
    } else {
      console.log(`[Email] ⚠️ (Mock — no SMTP configured) To: ${to} | Subject: ${subject}`);
    }
    return { success: true };
  } catch (error) {
    console.error(`[Email] ❌ Failed to send to ${to}:`, error.message);
    throw error;
  }
};

// ═══════════════════════════════════════════════════════════
//  HTML TEMPLATE ENGINE
// ═══════════════════════════════════════════════════════════

function baseLayout(company, content, previewText = '') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>${company.name}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  body { margin:0; padding:0; background:#0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
  .wrapper { width:100%; background:#0f172a; padding:40px 0; }
  .container { max-width:600px; margin:0 auto; }
  .card { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius:16px; border:1px solid #334155; overflow:hidden; }
  .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #6366f1 100%); padding:32px 40px; text-align:center; }
  .header h1 { margin:0; color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.5px; }
  .header .logo-text { font-size:28px; font-weight:800; color:#ffffff; text-decoration:none; letter-spacing:-1px; }
  .body { padding:40px; }
  .body h2 { color:#f1f5f9; font-size:22px; font-weight:700; margin:0 0 8px; }
  .body p { color:#94a3b8; font-size:15px; line-height:1.7; margin:0 0 16px; }
  .body .highlight { color:#e2e8f0; font-weight:600; }
  .btn { display:inline-block; background:linear-gradient(135deg, #3b82f6, #8b5cf6); color:#ffffff !important; text-decoration:none; padding:14px 36px; border-radius:10px; font-size:15px; font-weight:600; letter-spacing:0.3px; margin:8px 0; }
  .btn:hover { opacity:0.9; }
  .info-box { background:#1e293b; border:1px solid #334155; border-radius:12px; padding:20px; margin:20px 0; }
  .info-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #1e293b; }
  .info-label { color:#64748b; font-size:13px; }
  .info-value { color:#e2e8f0; font-size:13px; font-weight:600; }
  .divider { height:1px; background:linear-gradient(to right, transparent, #334155, transparent); margin:24px 0; }
  .footer { padding:24px 40px; text-align:center; border-top:1px solid #1e293b; }
  .footer p { color:#475569; font-size:12px; line-height:1.6; margin:0 0 4px; }
  .footer a { color:#3b82f6; text-decoration:none; }
  .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; }
  .badge-success { background:rgba(34,197,94,0.15); color:#22c55e; }
  .badge-danger { background:rgba(239,68,68,0.15); color:#ef4444; }
  .badge-warning { background:rgba(234,179,8,0.15); color:#eab308; }
  .badge-info { background:rgba(59,130,246,0.15); color:#3b82f6; }
  .icon-circle { width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; font-size:28px; }
  @media only screen and (max-width:620px) {
    .body { padding:24px 20px; }
    .header { padding:24px 20px; }
    .footer { padding:20px; }
  }
</style>
</head>
<body>
${previewText ? `<div style="display:none;max-height:0;overflow:hidden">${previewText}</div>` : ''}
<div class="wrapper">
<div class="container">
<div class="card">
  <div class="header">
    <a href="${company.website}" class="logo-text" style="color:#ffffff;text-decoration:none;">${company.name}</a>
  </div>
  <div class="body">
    ${content}
  </div>
  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} ${company.name}. All rights reserved.</p>
    ${company.address ? `<p>${company.address}</p>` : ''}
    <p style="margin-top:8px;">
      <a href="${company.website}">Website</a>
      ${company.phone ? ` &middot; <a href="tel:${company.phone}">${company.phone}</a>` : ''}
      ${company.email ? ` &middot; <a href="mailto:${company.email}">${company.email}</a>` : ''}
    </p>
  </div>
</div>
</div>
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════
//  EMAIL FUNCTIONS
// ═══════════════════════════════════════════════════════════

export const sendWelcomeEmail = async (email, firstName) => {
  const company = await getCompany();
  const subject = `Welcome to ${company.name}! 🎉`;
  const text = `Hello ${firstName}, Welcome to ${company.name}. We are excited to have you on board!`;

  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(34,197,94,0.15);">🎉</div>
      <h2>Welcome aboard, ${firstName}!</h2>
      <p>Your account has been created successfully. You're now part of the ${company.name} trading community.</p>
    </div>
    <div class="divider"></div>
    <p style="color:#e2e8f0;font-weight:600;margin-bottom:12px;">Here's what you can do next:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #1e293b;">
          <table><tr>
            <td style="width:36px;vertical-align:top;"><div style="width:28px;height:28px;border-radius:8px;background:rgba(59,130,246,0.15);text-align:center;line-height:28px;font-size:14px;">1</div></td>
            <td style="padding-left:12px;"><span style="color:#e2e8f0;font-size:14px;font-weight:600;">Complete KYC Verification</span><br/><span style="color:#64748b;font-size:13px;">Upload your ID documents to unlock all features</span></td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #1e293b;">
          <table><tr>
            <td style="width:36px;vertical-align:top;"><div style="width:28px;height:28px;border-radius:8px;background:rgba(139,92,246,0.15);text-align:center;line-height:28px;font-size:14px;">2</div></td>
            <td style="padding-left:12px;"><span style="color:#e2e8f0;font-size:14px;font-weight:600;">Create a Trading Account</span><br/><span style="color:#64748b;font-size:13px;">Choose from Forex, MCX, or NSE account types</span></td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;">
          <table><tr>
            <td style="width:36px;vertical-align:top;"><div style="width:28px;height:28px;border-radius:8px;background:rgba(34,197,94,0.15);text-align:center;line-height:28px;font-size:14px;">3</div></td>
            <td style="padding-left:12px;"><span style="color:#e2e8f0;font-size:14px;font-weight:600;">Fund & Start Trading</span><br/><span style="color:#64748b;font-size:13px;">Deposit funds and begin your trading journey</span></td>
          </tr></table>
        </td>
      </tr>
    </table>
    <div style="text-align:center;margin-top:24px;">
      <a href="${company.website}/login" class="btn">Go to Dashboard →</a>
    </div>
  `, `Welcome to ${company.name}! Your account is ready.`);

  return sendEmail(email, subject, text, html);
};

export const sendPasswordResetEmail = async (email, resetUrl) => {
  const company = await getCompany();
  const subject = `Reset Your ${company.name} Password`;
  const text = `You requested a password reset. Click the link to reset: ${resetUrl}\nThis link expires in 24 hours.`;

  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(234,179,8,0.15);">🔐</div>
      <h2>Password Reset Request</h2>
      <p>We received a request to reset the password for your ${company.name} account. Click the button below to set a new password.</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${resetUrl}" class="btn">Reset My Password →</a>
    </div>
    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:6px 0;"><span style="color:#64748b;font-size:13px;">⏰ Link expires in:</span></td>
          <td style="padding:6px 0;text-align:right;"><span style="color:#eab308;font-size:13px;font-weight:600;">24 hours</span></td>
        </tr>
        <tr>
          <td style="padding:6px 0;"><span style="color:#64748b;font-size:13px;">📧 Requested for:</span></td>
          <td style="padding:6px 0;text-align:right;"><span style="color:#e2e8f0;font-size:13px;font-weight:600;">${email}</span></td>
        </tr>
      </table>
    </div>
    <div class="divider"></div>
    <p style="color:#64748b;font-size:13px;text-align:center;">If you didn't request this reset, you can safely ignore this email. Your password won't change until you click the button above.</p>
    <p style="color:#475569;font-size:12px;text-align:center;margin-top:12px;">Can't click the button? Copy and paste this URL into your browser:<br/><a href="${resetUrl}" style="color:#3b82f6;word-break:break-all;font-size:11px;">${resetUrl}</a></p>
  `, `Reset your ${company.name} password — link expires in 24 hours.`);

  return sendEmail(email, subject, text, html);
};

export const sendEmailVerificationEmail = async (email, verificationUrl) => {
  const company = await getCompany();
  const subject = `Verify Your Email — ${company.name}`;
  const text = `Please verify your email by clicking the link: ${verificationUrl}`;

  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(59,130,246,0.15);">✉️</div>
      <h2>Verify Your Email</h2>
      <p>Please confirm your email address to activate your ${company.name} account and access all features.</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${verificationUrl}" class="btn">Verify Email Address →</a>
    </div>
    <div class="divider"></div>
    <p style="color:#64748b;font-size:13px;text-align:center;">If you didn't create this account, please ignore this email.</p>
  `, `Verify your email to activate your ${company.name} account.`);

  return sendEmail(email, subject, text, html);
};

export const sendDepositConfirmationEmail = async (email, depositData) => {
  const company = await getCompany();
  const subject = `Deposit Confirmed — ${company.name}`;
  const text = `Your deposit of ${depositData.amount} has been received and credited to your account.`;

  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(34,197,94,0.15);">💰</div>
      <h2>Deposit Confirmed!</h2>
      <p>Great news! Your deposit has been processed and credited to your account.</p>
    </div>
    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Amount</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#22c55e;font-size:16px;font-weight:700;">${depositData.currency || '$'}${depositData.amount}</span></td>
        </tr>
        ${depositData.method ? `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Method</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#e2e8f0;font-size:13px;font-weight:600;">${depositData.method}</span></td>
        </tr>` : ''}
        ${depositData.accountLogin ? `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Trading Account</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#e2e8f0;font-size:13px;font-weight:600;">#${depositData.accountLogin}</span></td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 0;"><span style="color:#64748b;font-size:13px;">Status</span></td>
          <td style="padding:8px 0;text-align:right;"><span class="badge badge-success">Completed</span></td>
        </tr>
      </table>
    </div>
    <div style="text-align:center;margin-top:24px;">
      <a href="${company.website}/login" class="btn">View Account →</a>
    </div>
  `, `Your deposit of ${depositData.currency || '$'}${depositData.amount} has been confirmed.`);

  return sendEmail(email, subject, text, html);
};

export const sendWithdrawalConfirmationEmail = async (email, withdrawalData) => {
  const company = await getCompany();
  const subject = `Withdrawal Approved — ${company.name}`;
  const text = `Your withdrawal of ${withdrawalData.amount} has been approved and is being processed.`;

  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(59,130,246,0.15);">🏦</div>
      <h2>Withdrawal Approved!</h2>
      <p>Your withdrawal request has been approved and is being processed.</p>
    </div>
    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Amount</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#3b82f6;font-size:16px;font-weight:700;">${withdrawalData.currency || '$'}${withdrawalData.amount}</span></td>
        </tr>
        ${withdrawalData.method ? `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Method</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#e2e8f0;font-size:13px;font-weight:600;">${withdrawalData.method}</span></td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 0;"><span style="color:#64748b;font-size:13px;">Status</span></td>
          <td style="padding:8px 0;text-align:right;"><span class="badge badge-success">Approved</span></td>
        </tr>
      </table>
    </div>
    <p style="color:#64748b;font-size:13px;text-align:center;">Funds will typically arrive within 1-3 business days depending on your withdrawal method.</p>
  `, `Your withdrawal of ${withdrawalData.currency || '$'}${withdrawalData.amount} has been approved.`);

  return sendEmail(email, subject, text, html);
};

export const sendKycSubmissionEmail = async (email) => {
  const company = await getCompany();
  const subject = `KYC Documents Received — ${company.name}`;
  const text = `We have received your KYC documents. They will be reviewed within 24-48 hours.`;

  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(139,92,246,0.15);">📋</div>
      <h2>Documents Received!</h2>
      <p>We've received your KYC verification documents and they are now in our review queue.</p>
    </div>
    <div class="info-box" style="text-align:center;">
      <span class="badge badge-warning">Under Review</span>
      <p style="color:#94a3b8;font-size:13px;margin:12px 0 0;">Typical review time: <span style="color:#e2e8f0;font-weight:600;">24-48 hours</span></p>
    </div>
    <p style="color:#94a3b8;font-size:14px;">We'll notify you by email once the review is complete. If we need additional documents, we'll reach out.</p>
  `, `Your KYC documents are being reviewed.`);

  return sendEmail(email, subject, text, html);
};

export const sendKycApprovedEmail = async (email) => {
  const company = await getCompany();
  const subject = `KYC Approved ✅ — ${company.name}`;
  const text = `Congratulations! Your KYC verification has been approved. You now have full access to all features.`;

  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(34,197,94,0.15);">✅</div>
      <h2>KYC Verified!</h2>
      <p>Congratulations! Your identity has been verified successfully. You now have full access to all ${company.name} features.</p>
    </div>
    <div class="info-box" style="text-align:center;">
      <span class="badge badge-success">Verified</span>
    </div>
    <div class="divider"></div>
    <p style="color:#e2e8f0;font-weight:600;margin-bottom:8px;">You can now:</p>
    <p style="color:#94a3b8;font-size:14px;">• Deposit and withdraw funds without restrictions<br/>• Create and manage trading accounts<br/>• Access copy trading and MAM/PAMM features<br/>• Enjoy higher account limits</p>
    <div style="text-align:center;margin-top:24px;">
      <a href="${company.website}/login" class="btn">Start Trading →</a>
    </div>
  `, `Your KYC has been approved — you now have full access!`);

  return sendEmail(email, subject, text, html);
};

export const sendKycRejectedEmail = async (email, reason) => {
  const company = await getCompany();
  const subject = `KYC Review Update — ${company.name}`;
  const text = `Your KYC documents need attention. Reason: ${reason}. Please resubmit corrected documents.`;

  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(239,68,68,0.15);">⚠️</div>
      <h2>Documents Need Attention</h2>
      <p>We reviewed your KYC documents but couldn't verify them. Please review the feedback below and resubmit.</p>
    </div>
    <div class="info-box">
      <p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Reason for rejection:</p>
      <p style="color:#f87171;font-size:14px;font-weight:500;margin:0;">${reason || 'Documents were unclear or incomplete.'}</p>
    </div>
    <div class="divider"></div>
    <p style="color:#94a3b8;font-size:14px;">📸 <span style="color:#e2e8f0;font-weight:600;">Tips for resubmission:</span></p>
    <p style="color:#94a3b8;font-size:13px;">• Ensure documents are clear and not blurry<br/>• All four corners of the document must be visible<br/>• Documents must be current and not expired<br/>• Name on documents must match your account</p>
    <div style="text-align:center;margin-top:24px;">
      <a href="${company.website}/login" class="btn">Resubmit Documents →</a>
    </div>
  `, `Your KYC documents need attention — please resubmit.`);

  return sendEmail(email, subject, text, html);
};

export const sendWithdrawalRejectedEmail = async (email, reason) => {
  const company = await getCompany();
  const subject = `Withdrawal Update — ${company.name}`;
  const text = `Your withdrawal request was not approved. Reason: ${reason}`;

  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(239,68,68,0.15);">🏦</div>
      <h2>Withdrawal Not Approved</h2>
      <p>Unfortunately, your withdrawal request could not be processed at this time.</p>
    </div>
    <div class="info-box">
      <p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Reason:</p>
      <p style="color:#f87171;font-size:14px;font-weight:500;margin:0;">${reason || 'Please contact support for details.'}</p>
    </div>
    <div class="divider"></div>
    <p style="color:#94a3b8;font-size:13px;text-align:center;">If you believe this is an error, please contact our support team for assistance.</p>
    <div style="text-align:center;margin-top:16px;">
      <a href="${company.website}/login" class="btn">Contact Support →</a>
    </div>
  `, `Your withdrawal request needs attention.`);

  return sendEmail(email, subject, text, html);
};

export const sendSupportTicketNotificationEmail = async (email, ticketData) => {
  const company = await getCompany();
  const subject = `Ticket Update: ${ticketData.subject || 'Your Ticket'} — ${company.name}`;
  const text = `There has been an update to your support ticket. Please check your dashboard.`;

  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(59,130,246,0.15);">💬</div>
      <h2>Ticket Update</h2>
      <p>There's been an update to your support ticket.</p>
    </div>
    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${ticketData.subject ? `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Subject</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#e2e8f0;font-size:13px;font-weight:600;">${ticketData.subject}</span></td>
        </tr>` : ''}
        ${ticketData.status ? `<tr>
          <td style="padding:8px 0;"><span style="color:#64748b;font-size:13px;">Status</span></td>
          <td style="padding:8px 0;text-align:right;"><span class="badge badge-info">${ticketData.status}</span></td>
        </tr>` : ''}
      </table>
    </div>
    <div style="text-align:center;margin-top:24px;">
      <a href="${company.website}/login" class="btn">View Ticket →</a>
    </div>
  `, `Update on your support ticket.`);

  return sendEmail(email, subject, text, html);
};

export const sendLoginAlertEmail = async (email, loginData) => {
  const company = await getCompany();
  const subject = `New Login Detected — ${company.name}`;
  const text = `A new login was detected on your account from ${loginData.ip || 'unknown'}.`;

  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(234,179,8,0.15);">🔔</div>
      <h2>New Login Detected</h2>
      <p>A new login to your ${company.name} account was detected.</p>
    </div>
    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Time</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#e2e8f0;font-size:13px;">${new Date().toLocaleString()}</span></td>
        </tr>
        ${loginData.ip ? `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">IP Address</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#e2e8f0;font-size:13px;font-weight:600;">${loginData.ip}</span></td>
        </tr>` : ''}
        ${loginData.userAgent ? `<tr>
          <td style="padding:8px 0;"><span style="color:#64748b;font-size:13px;">Device</span></td>
          <td style="padding:8px 0;text-align:right;"><span style="color:#e2e8f0;font-size:13px;">${loginData.userAgent}</span></td>
        </tr>` : ''}
      </table>
    </div>
    <p style="color:#64748b;font-size:13px;text-align:center;">If this wasn't you, please change your password immediately and contact support.</p>
  `, `New login detected on your ${company.name} account.`);

  return sendEmail(email, subject, text, html);
};

export const sendTwoFactorOtpEmail = async (email, otp, firstName) => {
  const company = await getCompany();
  const subject = `Your ${company.name} Login Verification Code`;
  const text = `Your 2FA code is: ${otp}. It expires in 10 minutes. Do not share this code with anyone.`;

  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(59,130,246,0.15);">🔐</div>
      <h2>Login Verification</h2>
      <p>Hi ${firstName || 'there'}, use the code below to complete your login to ${company.name}.</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <div style="display:inline-block;background:#ffffff;border:2px solid #3b82f6;border-radius:16px;padding:20px 48px;">
        <span style="font-size:36px;font-weight:800;color:#1e293b;letter-spacing:10px;font-family:monospace;">${otp}</span>
      </div>
    </div>
    <div class="info-box" style="text-align:center;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:6px 0;"><span style="color:#64748b;font-size:13px;">⏰ Expires in:</span></td>
          <td style="padding:6px 0;text-align:right;"><span style="color:#eab308;font-size:13px;font-weight:600;">10 minutes</span></td>
        </tr>
      </table>
    </div>
    <div class="divider"></div>
    <p style="color:#64748b;font-size:13px;text-align:center;">If you did not attempt to log in, please change your password immediately and contact support.</p>
  `, `Your ${company.name} login verification code — expires in 10 minutes.`);

  return sendEmail(email, subject, text, html);
};

const sendGenericEmail = async (to, subject, htmlBody) => {
  return sendEmail(to, subject, '', htmlBody);
};

export const sendDepositSubmittedEmail = async (email, firstName, depositData) => {
  const company = await getCompany();
  const subject = `Deposit Request Received — ${company.name}`;
  const text = `Hi ${firstName}, your deposit request of $${depositData.amount} has been received and is under review.`;
  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(59,130,246,0.15);">📥</div>
      <h2>Deposit Request Received</h2>
      <p>Hi ${firstName || 'there'}, we've received your deposit request and it is now under review by our team.</p>
    </div>
    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Amount</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#3b82f6;font-size:16px;font-weight:700;">$${depositData.amount}</span></td>
        </tr>
        ${depositData.id ? `<tr><td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Reference #</span></td><td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#e2e8f0;font-size:13px;font-weight:600;">${depositData.id}</span></td></tr>` : ''}
        <tr>
          <td style="padding:8px 0;"><span style="color:#64748b;font-size:13px;">Status</span></td>
          <td style="padding:8px 0;text-align:right;"><span class="badge badge-warning">Under Review</span></td>
        </tr>
      </table>
    </div>
    <p style="color:#94a3b8;font-size:14px;text-align:center;">We'll notify you once your deposit is approved. This typically takes less than 24 hours.</p>
    <div style="text-align:center;margin-top:24px;"><a href="${company.website}/fund" class="btn">View Status →</a></div>
  `, `Your deposit request of $${depositData.amount} is under review.`);
  return sendEmail(email, subject, text, html);
};

export const sendDepositRejectedEmail = async (email, firstName, depositData) => {
  const company = await getCompany();
  const subject = `Deposit Request Update — ${company.name}`;
  const text = `Hi ${firstName}, your deposit request of $${depositData.amount} was not approved. Reason: ${depositData.reason || 'Please contact support.'}`;
  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(239,68,68,0.15);">❌</div>
      <h2>Deposit Not Approved</h2>
      <p>Hi ${firstName || 'there'}, unfortunately your deposit request could not be processed at this time.</p>
    </div>
    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Amount</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#e2e8f0;font-size:16px;font-weight:700;">$${depositData.amount}</span></td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Status</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span class="badge badge-danger">Rejected</span></td>
        </tr>
      </table>
      ${depositData.reason ? `<div style="margin-top:16px;padding:12px;background:rgba(239,68,68,0.08);border-radius:8px;border-left:3px solid #ef4444;"><p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;">Reason:</p><p style="color:#f87171;font-size:14px;font-weight:500;margin:0;">${depositData.reason}</p></div>` : ''}
    </div>
    <p style="color:#94a3b8;font-size:14px;text-align:center;">If you believe this is an error or need assistance, please contact our support team.</p>
    <div style="text-align:center;margin-top:24px;"><a href="${company.website}/support" class="btn">Contact Support →</a></div>
  `, `Your deposit request of $${depositData.amount} was not approved.`);
  return sendEmail(email, subject, text, html);
};

export const sendWithdrawalSubmittedEmail = async (email, firstName, withdrawalData) => {
  const company = await getCompany();
  const subject = `Withdrawal Request Received — ${company.name}`;
  const text = `Hi ${firstName}, your withdrawal request of $${withdrawalData.amount} has been submitted and is under review.`;
  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(139,92,246,0.15);">🏦</div>
      <h2>Withdrawal Request Submitted</h2>
      <p>Hi ${firstName || 'there'}, your withdrawal request has been submitted and is being reviewed by our team.</p>
    </div>
    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Amount</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#a855f7;font-size:16px;font-weight:700;">$${withdrawalData.amount}</span></td>
        </tr>
        ${withdrawalData.id ? `<tr><td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Reference #</span></td><td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#e2e8f0;font-size:13px;font-weight:600;">${withdrawalData.id}</span></td></tr>` : ''}
        <tr>
          <td style="padding:8px 0;"><span style="color:#64748b;font-size:13px;">Status</span></td>
          <td style="padding:8px 0;text-align:right;"><span class="badge badge-warning">Under Review</span></td>
        </tr>
      </table>
    </div>
    <p style="color:#94a3b8;font-size:14px;text-align:center;">Withdrawals are typically processed within 1-3 business days. We'll email you once it's approved.</p>
    <div style="text-align:center;margin-top:24px;"><a href="${company.website}/fund" class="btn">View Status →</a></div>
  `, `Your withdrawal request of $${withdrawalData.amount} is under review.`);
  return sendEmail(email, subject, text, html);
};

export const sendCopyTradeFollowEmail = async (email, firstName, tradeData) => {
  const company = await getCompany();
  const subject = `Now Copying ${tradeData.masterName} — ${company.name}`;
  const text = `Hi ${firstName}, you are now copying ${tradeData.masterName} with an allocation of $${tradeData.allocation}.`;
  const html = baseLayout(company, `
    <div style="text-align:center;">
      <div class="icon-circle" style="background:rgba(168,85,247,0.15);">📈</div>
      <h2>Copy Trading Active!</h2>
      <p>Hi ${firstName || 'there'}, you're now copying <strong style="color:#a855f7;">${tradeData.masterName}</strong>. Trades will be mirrored to your account automatically.</p>
    </div>
    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Master Trader</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#e2e8f0;font-size:13px;font-weight:600;">${tradeData.masterName}</span></td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Allocation</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#a855f7;font-size:15px;font-weight:700;">$${tradeData.allocation}</span></td>
        </tr>
        ${tradeData.copyRatio ? `<tr><td style="padding:8px 0;border-bottom:1px solid #334155;"><span style="color:#64748b;font-size:13px;">Copy Ratio</span></td><td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;"><span style="color:#e2e8f0;font-size:13px;font-weight:600;">${tradeData.copyRatio}x</span></td></tr>` : ''}
        <tr>
          <td style="padding:8px 0;"><span style="color:#64748b;font-size:13px;">Status</span></td>
          <td style="padding:8px 0;text-align:right;"><span class="badge badge-success">Active</span></td>
        </tr>
      </table>
    </div>
    <div style="padding:16px;background:rgba(234,179,8,0.08);border-radius:8px;border-left:3px solid #eab308;margin-top:16px;">
      <p style="color:#fbbf24;font-size:13px;margin:0;">⚠️ <strong>Risk Reminder:</strong> Past performance does not guarantee future results. Only invest what you can afford to lose.</p>
    </div>
    <div style="text-align:center;margin-top:24px;"><a href="${company.website}/copy-trading" class="btn">View Copy Trading →</a></div>
  `, `You are now copying ${tradeData.masterName} on ${company.name}.`);
  return sendEmail(email, subject, text, html);
};

export default {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendTwoFactorOtpEmail,
  sendDepositConfirmationEmail,
  sendWithdrawalConfirmationEmail,
  sendDepositSubmittedEmail,
  sendDepositRejectedEmail,
  sendWithdrawalSubmittedEmail,
  sendWithdrawalRejectedEmail,
  sendCopyTradeFollowEmail,
  sendKycSubmissionEmail,
  sendKycApprovedEmail,
  sendKycRejectedEmail,
  sendSupportTicketNotificationEmail,
  sendLoginAlertEmail,
  sendGenericEmail,
};
