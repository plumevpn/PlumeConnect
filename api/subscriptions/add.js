/**
 * api/subscriptions/add.js
 * POST /api/subscriptions/add
 * Привязать UUID подписки к аккаунту пользователя
 */

const {
  getUserFromRequest,
  addSubscriptionToUser,
} = require('../lib/kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const { subscription_uuid } = req.body || {};

    if (!subscription_uuid || typeof subscription_uuid !== 'string') {
      return res.status(400).json({ error: 'Не указан subscription_uuid' });
    }

    await addSubscriptionToUser(auth.user.email, subscription_uuid.trim());

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[subscriptions/add] Error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
