/**
 * api/auth/register.js
 * POST /api/auth/register
 * Регистрация нового пользователя
 */

const {
  userExists,
  createUser,
  createSession,
  hashPassword,
  buildCookieHeader,
} = require('../lib/kv');

// Email validation regex
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    const { name, email, password } = req.body || {};

    // ── Validate inputs ──────────────────────────────
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Имя должно содержать минимум 2 символа' });
    }

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Введите корректный email' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    // ── Check if email already taken ─────────────────
    const exists = await userExists(normalizedEmail);
    if (exists) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }

    // ── Hash password ─────────────────────────────────
    const hashedPassword = hashPassword(password);

    // ── Create user ───────────────────────────────────
    const user = await createUser(normalizedEmail, hashedPassword, normalizedName);

    // ── Create session ────────────────────────────────
    const token = await createSession(normalizedEmail);

    // ── Set cookie ────────────────────────────────────
    res.setHeader('Set-Cookie', buildCookieHeader(token));

    // ── Respond (never send password) ─────────────────
    return res.status(201).json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        created_at: user.created_at,
      },
    });

  } catch (err) {
    console.error('[register] Error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера. Попробуйте позже.' });
  }
};
