const nodemailer = require("nodemailer");
let transporter;
const brand = () => String(process.env.APP_BRAND_NAME || "DESCRAVE").trim();
const getTransporter = () => {
  if (transporter) return transporter;
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "");
  if (!host || !user || !pass) throw new Error("SMTP_HOST, SMTP_USER and SMTP_PASS are required.");
  transporter = nodemailer.createTransport({ host, port, secure: String(process.env.SMTP_SECURE || "true").toLowerCase() === "true", auth: { user, pass }, pool: true, maxConnections: 3, maxMessages: 100 });
  return transporter;
};
const fromAddress = () => `${String(process.env.MAIL_FROM_NAME || "DESCRAVE").trim()} <${String(process.env.MAIL_FROM_ADDRESS || "passwordrecovery@descrave.com").trim()}>`;
const sendPasswordResetCode = async ({ to, code, expiresMinutes }) => {
  const name = brand();
  await getTransporter().sendMail({
    from: fromAddress(), to, subject: `Your ${name} password reset code`,
    text: [`Your ${name} password reset code is:`, "", code, "", `This code expires in ${expiresMinutes} minutes.`, "If you did not request this, ignore this email.", "Never share this code with anyone."].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17171c"><p style="font-size:12px;letter-spacing:2px;font-weight:700;color:#777">${name} ACCOUNT SECURITY</p><h1 style="font-size:28px;margin:12px 0">Reset your password</h1><p>Enter this verification code in ${name}:</p><div style="font-size:36px;letter-spacing:8px;font-weight:800;padding:18px 0">${code}</div><p>This code expires in <strong>${expiresMinutes} minutes</strong>.</p><p style="color:#666">If you did not request this, ignore this email. Never share this code with anyone.</p></div>`,
  });
};
const sendPasswordChangedNotice = async ({ to }) => {
  const name = brand();
  await getTransporter().sendMail({ from: fromAddress(), to, subject: `Your ${name} password was changed`, text: `Your ${name} password was changed. If you did not make this change, contact support immediately.`, html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17171c"><p style="font-size:12px;letter-spacing:2px;font-weight:700;color:#777">${name} ACCOUNT SECURITY</p><h1>Password changed</h1><p>Your ${name} password was changed successfully.</p><p>If you did not make this change, contact support immediately.</p></div>` });
};
const verifyMailConnection = async () => getTransporter().verify();
module.exports = { sendPasswordResetCode, sendPasswordChangedNotice, verifyMailConnection };
