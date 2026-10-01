import {createHash, createHmac, randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'sitro_admin_session';
export const ADMIN_SESSION_SECONDS = 4 * 60 * 60;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 30 * 60 * 1000;
const loginAttempts = new Map();

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function sessionSecret(env) {
  const explicit = String(env.ADMIN_SESSION_SECRET || '');
  if (explicit.length >= 32) return explicit;
  return createHash('sha256').update(`${env.ADMIN_PASSWORD || ''}:${env.GITHUB_TOKEN || ''}:sitro-admin-session`).digest('hex');
}

function signature(value, env) {
  return createHmac('sha256', sessionSecret(env)).update(value).digest('base64url');
}

function cookies(req) {
  return Object.fromEntries(String(req?.headers?.cookie || '').split(';').map(part => part.trim().split('=').map(decodeURIComponent)).filter(parts => parts.length === 2));
}

export function createAdminSession(env, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({version: 1, expiresAt: now + ADMIN_SESSION_SECONDS * 1000, nonce: randomBytes(16).toString('hex')})).toString('base64url');
  return `${payload}.${signature(payload, env)}`;
}

export function verifyAdminSession(req, env, now = Date.now()) {
  const token = cookies(req)[ADMIN_SESSION_COOKIE];
  if (!token) return false;
  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra || !safeEqual(suppliedSignature, signature(payload, env))) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session?.version === 1 && Number(session.expiresAt) > now;
  } catch {
    return false;
  }
}

export function setAdminSession(res, env) {
  res.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(createAdminSession(env))}; Max-Age=${ADMIN_SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`);
}

export function clearAdminSession(res) {
  res.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`);
}

export function requestClientKey(req) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req?.socket?.remoteAddress || 'unknown');
}

export function loginRetryAfter(req, now = Date.now()) {
  const state = loginAttempts.get(requestClientKey(req));
  if (!state) return 0;
  if (state.blockedUntil > now) return Math.ceil((state.blockedUntil - now) / 1000);
  if (now - state.startedAt > LOGIN_WINDOW_MS) loginAttempts.delete(requestClientKey(req));
  return 0;
}

export function recordLoginFailure(req, now = Date.now()) {
  const key = requestClientKey(req);
  const current = loginAttempts.get(key);
  const state = !current || now - current.startedAt > LOGIN_WINDOW_MS ? {count: 0, startedAt: now, blockedUntil: 0} : current;
  state.count += 1;
  if (state.count >= MAX_LOGIN_ATTEMPTS) state.blockedUntil = now + LOGIN_BLOCK_MS;
  loginAttempts.set(key, state);
  return state.blockedUntil > now ? Math.ceil((state.blockedUntil - now) / 1000) : 0;
}

export function clearLoginFailures(req) {
  loginAttempts.delete(requestClientKey(req));
}

export function createPasswordConfig(password, now = new Date()) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return {version: 2, algorithm: 'scrypt', salt, hash, updatedAt: now.toISOString()};
}

export function verifyPasswordConfig(password, config) {
  if (!config?.hash || !config?.salt) return false;
  if (config.version === 2 && config.algorithm === 'scrypt') {
    return safeEqual(scryptSync(String(password), config.salt, 64).toString('hex'), config.hash);
  }
  const legacy = createHash('sha256').update(`${config.salt}:${password}`).digest('hex');
  return safeEqual(legacy, config.hash);
}

export function passwordEquals(password, expected) {
  return typeof password === 'string' && Boolean(password) && safeEqual(password, expected || '');
}

export function hasTrustedOrigin(req) {
  const origin = String(req?.headers?.origin || '');
  if (!origin) return true;
  try {
    const host = String(req?.headers?.host || '').toLowerCase();
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}
