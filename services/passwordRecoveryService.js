const crypto = require("crypto");
const db = require("../config/db");
const { AppError } = require("../middleware/errorMiddleware");
const { validatePassword, hashPassword, verifyPassword } = require("../utils/password");
const mailService = require("./mailService");
const OTP_MINUTES = Math.min(Math.max(Number(process.env.PASSWORD_RESET_OTP_MINUTES)||10,5),30);
const TOKEN_MINUTES = Math.min(Math.max(Number(process.env.PASSWORD_RESET_TOKEN_MINUTES)||10,5),30);
const MAX_ATTEMPTS = Math.min(Math.max(Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS)||5,3),10);
const GENERIC_MESSAGE = "If an account exists for that email, a verification code has been sent.";
const secret = () => { const v=String(process.env.PASSWORD_RESET_SECRET||""); if(v.length<32) throw new Error("PASSWORD_RESET_SECRET must contain at least 32 characters."); return v; };
const normalizeEmail = (email) => String(email||"").trim().toLowerCase();
const digest = (purpose,value) => crypto.createHmac("sha256",secret()).update(`${purpose}:${value}`,"utf8").digest("hex");
const generateOtp = () => crypto.randomInt(100000,1000000).toString();
const generateResetToken = () => crypto.randomBytes(32).toString("base64url");
const requestResetCode = async ({email}) => {
  const normalized=normalizeEmail(email);
  const found=await db.query(`SELECT id,email FROM wants.users WHERE lower(email)=lower($1) AND status='active' AND deleted_at IS NULL LIMIT 1`,[normalized]);
  const user=found.rows[0];
  if(!user){ await hashPassword(`Dummy${crypto.randomInt(100000,999999)}aA`); return {message:GENERIC_MESSAGE}; }
  const otp=generateOtp();
  const codeHash=digest(`otp:${user.id}`,otp);
  const record=await db.withTransaction(async(client)=>{
    await client.query(`UPDATE wants.password_reset_codes SET used_at=COALESCE(used_at,now()) WHERE user_id=$1 AND used_at IS NULL`,[user.id]);
    const r=await client.query(`INSERT INTO wants.password_reset_codes(user_id,code_hash,expires_at,max_attempts) VALUES($1,$2,now()+($3*interval '1 minute'),$4) RETURNING id`,[user.id,codeHash,OTP_MINUTES,MAX_ATTEMPTS]);
    return r.rows[0];
  });
  try{ await mailService.sendPasswordResetCode({to:user.email,code:otp,expiresMinutes:OTP_MINUTES}); }
  catch(error){ await db.query(`UPDATE wants.password_reset_codes SET used_at=now() WHERE id=$1`,[record.id]).catch(()=>{}); console.error("password_reset_email_failed",{name:error?.name,message:error?.message}); }
  return {message:GENERIC_MESSAGE};
};
const verifyResetCode = async ({email,code}) => db.withTransaction(async(client)=>{
  const r=await client.query(`SELECT pr.id,pr.user_id,pr.code_hash,pr.expires_at,pr.attempt_count,pr.max_attempts FROM wants.password_reset_codes pr JOIN wants.users u ON u.id=pr.user_id WHERE lower(u.email)=lower($1) AND u.status='active' AND u.deleted_at IS NULL AND pr.used_at IS NULL AND pr.verified_at IS NULL ORDER BY pr.created_at DESC LIMIT 1 FOR UPDATE OF pr`,[normalizeEmail(email)]);
  const row=r.rows[0];
  if(!row||new Date(row.expires_at)<=new Date()) throw new AppError("The verification code is invalid or expired.",400,"INVALID_RESET_CODE");
  if(row.attempt_count>=row.max_attempts){ await client.query(`UPDATE wants.password_reset_codes SET used_at=now() WHERE id=$1`,[row.id]); throw new AppError("The verification code is invalid or expired.",400,"INVALID_RESET_CODE"); }
  const supplied=Buffer.from(digest(`otp:${row.user_id}`,String(code)),"hex");
  const stored=Buffer.from(row.code_hash,"hex");
  const valid=supplied.length===stored.length&&crypto.timingSafeEqual(supplied,stored);
  if(!valid){ const attempts=Number(row.attempt_count)+1; await client.query(`UPDATE wants.password_reset_codes SET attempt_count=$2,used_at=CASE WHEN $2>=max_attempts THEN now() ELSE used_at END WHERE id=$1`,[row.id,attempts]); throw new AppError("The verification code is invalid or expired.",400,"INVALID_RESET_CODE"); }
  const resetToken=generateResetToken();
  await client.query(`UPDATE wants.password_reset_codes SET verified_at=now(),reset_token_hash=$2,reset_token_expires_at=now()+($3*interval '1 minute') WHERE id=$1`,[row.id,digest("reset-token",resetToken),TOKEN_MINUTES]);
  return {resetToken,expiresInMinutes:TOKEN_MINUTES};
});
const resetPassword = async ({resetToken,newPassword}) => {
  const validation=validatePassword(newPassword); if(!validation.valid) throw new AppError(validation.message,400,"INVALID_PASSWORD");
  let email;
  await db.withTransaction(async(client)=>{
    const r=await client.query(`SELECT pr.id,pr.user_id,u.email,u.password_hash FROM wants.password_reset_codes pr JOIN wants.users u ON u.id=pr.user_id WHERE pr.reset_token_hash=$1 AND pr.verified_at IS NOT NULL AND pr.used_at IS NULL AND pr.reset_token_expires_at>now() AND u.status='active' AND u.deleted_at IS NULL LIMIT 1 FOR UPDATE OF pr,u`,[digest("reset-token",resetToken)]);
    const row=r.rows[0]; if(!row) throw new AppError("The password reset authorization is invalid or expired.",400,"INVALID_RESET_TOKEN");
    if(await verifyPassword(newPassword,row.password_hash)) throw new AppError("Choose a password you have not used for this account.",400,"PASSWORD_UNCHANGED");
    const passwordHash=await hashPassword(newPassword);
    await client.query(`UPDATE wants.users SET password_hash=$2,updated_at=now() WHERE id=$1`,[row.user_id,passwordHash]);
    await client.query(`UPDATE wants.password_reset_codes SET used_at=COALESCE(used_at,now()) WHERE user_id=$1 AND used_at IS NULL`,[row.user_id]);
    await client.query(`UPDATE wants.user_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1`,[row.user_id]);
    email=row.email;
  });
  mailService.sendPasswordChangedNotice({to:email}).catch(error=>console.error("password_changed_email_failed",{name:error?.name,message:error?.message}));
  return {message:"Password reset successfully. Sign in with your new password."};
};
module.exports={requestResetCode,verifyResetCode,resetPassword};
