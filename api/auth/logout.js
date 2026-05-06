/**
 * api/auth/logout.js
 * POST /api/auth/logout
 * Выход из аккаунта — удаляет сессию и очищает cookie
 */

const {
  getTokenFromCookie,
  deleteSession,
  buildCookieHeader,
} = require('../lib/kv');

module.exports = async function handler(req, res) {
  // Allow POST and GET (for link-based logout)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    // Extract token from cookie
    const cookieHeader = req.headers?.cookie || '';
    const token = getTokenFromCookie(cookieHeader);

    // Delete session from KV (if token exists)
    if (token) {
      await deleteSession(token);
    }

    // Clear cookie
    res.setHeader('Set-Cookie', buildCookieHeader(null, true));

    return res.status(200).json({ success: true, message: 'Вы вышли из аккаунта' });

  } catch (err) {
    console.error('[logout] Error:', err);
    // Even on error — clear the cookie
    res.setHeader('Set-Cookie', buildCookieHeader(null, true));
    return res.status(200).json({ success: true });
  }
};
