const bcrypt = require("bcrypt");

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

const passwordByteLength = (password) => Buffer.byteLength(password, "utf8");

const validatePassword = (password) => {
  if (typeof password !== "string") {
    return { valid: false, message: "Password is required." };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  if (passwordByteLength(password) > MAX_PASSWORD_BYTES) {
    return { valid: false, message: `Password must not exceed ${MAX_PASSWORD_BYTES} UTF-8 bytes.` };
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, message: "Password must include uppercase, lowercase, and a number." };
  }

  return { valid: true };
};

const hashPassword = async (password) => {
  const validation = validatePassword(password);
  if (!validation.valid) {
    const error = new Error(validation.message);
    error.code = "INVALID_PASSWORD";
    throw error;
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

const verifyPassword = async (password, hash) => {
  if (typeof password !== "string" || typeof hash !== "string" || !hash) {
    return false;
  }
  if (passwordByteLength(password) > MAX_PASSWORD_BYTES) {
    return false;
  }
  return bcrypt.compare(password, hash);
};

module.exports = {
  BCRYPT_ROUNDS,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_BYTES,
  validatePassword,
  hashPassword,
  verifyPassword
};
