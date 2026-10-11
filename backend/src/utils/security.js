const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const b64url = (value) => Buffer.from(value).toString('base64url');
const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [algorithm, salt, key] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !key) return false;
  const derived = await scrypt(password, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error('JWT_SECRET must be configured with at least 32 characters.');
    error.statusCode = 500;
    error.code = 'SERVER_CONFIGURATION_ERROR';
    throw error;
  }
  return secret;
}

function signToken(user, expiresInSeconds = 60 * 60) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ sub: String(user._id), role: user.role, iat: now, exp: now + expiresInSeconds }));
  const content = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', jwtSecret()).update(content).digest('base64url');
  return `${content}.${signature}`;
}

function verifyToken(token) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) throw new Error('Invalid token');
  const [headerPart, payloadPart, signature] = parts;
  const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
  if (header.alg !== 'HS256' || header.typ !== 'JWT') throw new Error('Invalid token');
  const expected = crypto.createHmac('sha256', jwtSecret()).update(`${headerPart}.${payloadPart}`).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error('Invalid token');
  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  if (!payload.sub || !Number.isFinite(payload.exp) || payload.exp <= now) throw new Error('Expired or invalid token');
  return payload;
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, tokenHash };
