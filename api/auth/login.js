/**
 * api/auth/login.js
 * POST /api/auth/login
 * Вход пользователя в систему
 */

const {
  getUser,
  createSession,
  verifyPassword,
  buildCookieHeader,
} = require('../lib/kv');

// Rate limiting store (in-memory, per cold-start)
// For production — use Vercel KV rate limiter
const loginAttempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return true;
  }

  if (record.count >= MAX_ATTEMPTS) {
    return false;
  }

  record.count++;
  return true;
}

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Rate limiting
  const clientIp =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      error: 'Слишком много попыток входа. Попробуйте через 15 минут.',
    });
  }

  try {
    const { email, password } = req.body || {};

    // ── Validate inputs ──────────────────────────────
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Введите email' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Введите пароль' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ── Find user ─────────────────────────────────────
    const user = await getUser(normalizedEmail);

    // Use constant-time comparison style — always check password
    // even if user not found to prevent timing attacks
    const passwordHash = user?.password || 'invalid:hash';
    const passwordValid = verifyPassword(password, passwordHash);

    if (!user || !passwordValid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // ── Create session ────────────────────────────────
    const token = await createSession(normalizedEmail);

    // ── Set cookie ────────────────────────────────────
    res.setHeader('Set-Cookie', buildCookieHeader(token));

    // ── Respond ───────────────────────────────────────
    return res.status(200).json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        created_at: user.created_at,
      },
    });

  } catch (err) {
    console.error('[login] Error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера. Попробуйте позже.' });
  }
};
