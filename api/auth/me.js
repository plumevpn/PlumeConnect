/**
 * api/auth/me.js
 * GET /api/auth/me
 * Проверка текущей сессии — возвращает данные пользователя
 */

const { getUserFromRequest } = require('../lib/kv');

module.exports = async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    const result = await getUserFromRequest(req);

    if (!result) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const { user } = result;

    // Return user data (without password)
    return res.status(200).json({
      user: {
        email: user.email,
        name: user.name,
        created_at: user.created_at,
      },
    });

  } catch (err) {
    console.error('[me] Error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
