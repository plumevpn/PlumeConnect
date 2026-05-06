/**
 * api/subscriptions/list.js
 * GET /api/subscriptions/list
 * Получить список UUID подписок пользователя
 */

const {
  getUserFromRequest,
  getUserSubscriptions,
} = require('../lib/kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const subscriptions = await getUserSubscriptions(auth.user.email);

    return res.status(200).json({
      subscriptions: subscriptions || [],
      count: subscriptions?.length || 0,
    });
  } catch (err) {
    console.error('[subscriptions/list] Error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
