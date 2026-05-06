/**
 * api/lib/kv.js — Хелпер для Vercel KV
 * Хранит пользователей, сессии и привязки подписок
 */

const { kv } = require('@vercel/kv');
const crypto = require('crypto');

// ===========================
// ПОЛЬЗОВАТЕЛИ
// ===========================

/**
 * Получить пользователя по email
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function getUser(email) {
  try {
    return await kv.get(`user:${email.toLowerCase()}`);
  } catch (err) {
    console.error('[KV] getUser error:', err);
    return null;
  }
}

/**
 * Создать нового пользователя
 * @param {string} email
 * @param {string} hashedPassword — хэш пароля
 * @param {string} name
 * @returns {Promise<object>}
 */
async function createUser(email, hashedPassword, name) {
  const normalizedEmail = email.toLowerCase();
  const user = {
    email: normalizedEmail,
    password: hashedPassword,
    name,
    created_at: new Date().toISOString(),
    subscriptions: [],
  };

  await kv.set(`user:${normalizedEmail}`, user);
  await kv.sadd('users:all', normalizedEmail);

  return user;
}

/**
 * Обновить данные пользователя
 * @param {string} email
 * @param {object} updates
 */
async function updateUser(email, updates) {
  const user = await getUser(email);
  if (!user) throw new Error('User not found');
  const updated = { ...user, ...updates };
  await kv.set(`user:${email.toLowerCase()}`, updated);
  return updated;
}

/**
 * Проверить существование пользователя
 */
async function userExists(email) {
  const user = await getUser(email);
  return !!user;
}

// ===========================
// ХЭШИРОВАНИЕ ПАРОЛЕЙ
// ===========================

/**
 * Хэшировать пароль с солью
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .createHmac('sha256', process.env.TOKEN_SECRET || 'plume_connect_secret_2026')
    .update(salt + password)
    .digest('hex');
  return `${salt}:${hash}`;
}

/**
 * Проверить пароль против хэша
 */
function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const computedHash = crypto
    .createHmac('sha256', process.env.TOKEN_SECRET || 'plume_connect_secret_2026')
    .update(salt + password)
    .digest('hex');
  return hash === computedHash;
}

// ===========================
// СЕССИИ
// ===========================

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 дней в секундах

/**
 * Создать сессию для пользователя
 * @param {string} email
 * @returns {Promise<string>} токен сессии
 */
async function createSession(email) {
  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    email: email.toLowerCase(),
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + SESSION_TTL * 1000).toISOString(),
  };

  await kv.set(`session:${token}`, session, { ex: SESSION_TTL });
  return token;
}

/**
 * Получить сессию по токену
 * @param {string} token
 * @returns {Promise<object|null>}
 */
async function getSession(token) {
  if (!token) return null;
  try {
    const session = await kv.get(`session:${token}`);
    if (!session) return null;

    // Проверить срок действия
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      await kv.del(`session:${token}`);
      return null;
    }

    return session;
  } catch (err) {
    console.error('[KV] getSession error:', err);
    return null;
  }
}

/**
 * Удалить сессию (logout)
 * @param {string} token
 */
async function deleteSession(token) {
  if (!token) return;
  try {
    await kv.del(`session:${token}`);
  } catch (err) {
    console.error('[KV] deleteSession error:', err);
  }
}

// ===========================
// ПОДПИСКИ ПОЛЬЗОВАТЕЛЯ
// ===========================

/**
 * Добавить UUID подписки к пользователю
 * @param {string} email
 * @param {string} subscriptionUuid
 */
async function addSubscriptionToUser(email, subscriptionUuid) {
  const key = `user_subs:${email.toLowerCase()}`;
  await kv.sadd(key, subscriptionUuid);
}

/**
 * Получить список UUID подписок пользователя
 * @param {string} email
 * @returns {Promise<string[]>}
 */
async function getUserSubscriptions(email) {
  try {
    const key = `user_subs:${email.toLowerCase()}`;
    const members = await kv.smembers(key);
    return members || [];
  } catch (err) {
    console.error('[KV] getUserSubscriptions error:', err);
    return [];
  }
}

/**
 * Удалить подписку из списка пользователя
 * @param {string} email
 * @param {string} subscriptionUuid
 */
async function removeSubscriptionFromUser(email, subscriptionUuid) {
  const key = `user_subs:${email.toLowerCase()}`;
  await kv.srem(key, subscriptionUuid);
}

// ===========================
// ПАРСИНГ ТОКЕНА ИЗ COOKIE
// ===========================

/**
 * Извлечь токен сессии из заголовка Cookie
 * @param {string} cookieHeader
 * @returns {string|null}
 */
function getTokenFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)plume_session=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Сформировать Set-Cookie строку
 * @param {string} token
 * @param {boolean} clear — если true, очистить cookie
 */
function buildCookieHeader(token, clear = false) {
  if (clear) {
    return 'plume_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
  }
  const maxAge = SESSION_TTL;
  return `plume_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

// ===========================
// ПОЛУЧИТЬ ПОЛЬЗОВАТЕЛЯ ИЗ ЗАПРОСА
// ===========================

/**
 * Получить текущего пользователя из request headers (cookie)
 * @param {object} req — Vercel request
 * @returns {Promise<{user:object, token:string}|null>}
 */
async function getUserFromRequest(req) {
  const cookieHeader = req.headers?.cookie || '';
  const token = getTokenFromCookie(cookieHeader);
  if (!token) return null;

  const session = await getSession(token);
  if (!session) return null;

  const user = await getUser(session.email);
  if (!user) return null;

  return { user, token };
}

module.exports = {
  // Users
  getUser,
  createUser,
  updateUser,
  userExists,
  // Passwords
  hashPassword,
  verifyPassword,
  // Sessions
  createSession,
  getSession,
  deleteSession,
  // Subscriptions
  addSubscriptionToUser,
  getUserSubscriptions,
  removeSubscriptionFromUser,
  // Cookie helpers
  getTokenFromCookie,
  buildCookieHeader,
  getUserFromRequest,
};
