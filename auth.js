/**
 * auth.js — Фронтенд-логика авторизации
 * Общение с /api/auth/* эндпоинтами
 */

// ===========================
// CHECK SESSION
// ===========================

/**
 * Проверить текущую сессию
 * @returns {Promise<object|null>} данные пользователя или null
 */
async function checkSession() {
  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

// ===========================
// LOGIN
// ===========================

/**
 * Войти в аккаунт
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success:boolean, user?:object, error?:string}>}
 */
async function loginUser(email, password) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || 'Ошибка входа' };
    }

    return { success: true, user: data.user };
  } catch (err) {
    return { success: false, error: 'Ошибка соединения с сервером' };
  }
}

// ===========================
// REGISTER
// ===========================

/**
 * Зарегистрировать нового пользователя
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success:boolean, user?:object, error?:string}>}
 */
async function registerUser(name, email, password) {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || 'Ошибка регистрации' };
    }

    return { success: true, user: data.user };
  } catch (err) {
    return { success: false, error: 'Ошибка соединения с сервером' };
  }
}

// ===========================
// LOGOUT
// ===========================

/**
 * Выйти из аккаунта
 * @returns {Promise<void>}
 */
async function logoutUser() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // ignore
  }
  window.location.href = 'login.html';
}

// ===========================
// REQUIRE AUTH (для защищённых страниц)
// ===========================

/**
 * Требовать авторизацию. Если нет сессии — редирект на login
 * @returns {Promise<object>} данные пользователя
 */
async function requireAuth() {
  const user = await checkSession();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}
