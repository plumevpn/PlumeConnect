/**
 * api.js — Внутренние функции AdaptGroup API
 * Используются ТОЛЬКО внутри dashboard.js
 * НЕ отображаются пользователю напрямую
 */

const API_BASE = 'https://network-api.adaptgroup.pro';
const API_KEY = 'ADAPTBUC6Y36F7JWKZE5ORWKR7G7Q4S2YALOW7SFFVV4VM5K6XR6PMFHQVPN';
const API_KEY_ID = 1;

/**
 * Базовый вызов API AdaptGroup
 * @param {string} endpoint
 * @param {object} body
 */
async function apiCall(endpoint, body = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': API_KEY,
    },
    body: JSON.stringify({
      api_key_id: API_KEY_ID,
      ...body,
    }),
  });

  if (!response.ok) {
    let errText = '';
    try { errText = await response.text(); } catch {}
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  return await response.json();
}

// ===========================
// 1. Список планов
// ===========================
/**
 * Получить все доступные тарифные планы
 * @returns {Promise<Array>} массив планов
 */
async function getPlans() {
  try {
    const data = await apiCall('/plans/list');
    return data.plans || [];
  } catch (err) {
    console.error('[API] getPlans error:', err);
    return [];
  }
}

// ===========================
// 2. Создать подписку
// ===========================
/**
 * Создать новую подписку
 * @param {string} planUuid — UUID тарифного плана
 * @param {string} externalUserId — email пользователя (как внешний ID)
 * @returns {Promise<object>}
 */
async function createSubscription(planUuid, externalUserId) {
  return await apiCall('/subs/create', {
    plan_uuid: planUuid,
    external_user_id: externalUserId,
  });
}

// ===========================
// 3. Продлить подписку
// ===========================
/**
 * Продлить подписку на один период
 * @param {string} subUuid — UUID подписки
 * @returns {Promise<object>}
 */
async function renewSubscription(subUuid) {
  return await apiCall('/subs/renew', {
    subscription_uuid: subUuid,
  });
}

// ===========================
// 4. Заморозить подписку
// ===========================
/**
 * Заморозить подписку (пауза таймера)
 * @param {string} subUuid — UUID подписки
 * @returns {Promise<object>}
 */
async function freezeSubscription(subUuid) {
  return await apiCall('/subs/freeze', {
    subscription_uuid: subUuid,
  });
}

// ===========================
// 5. Разморозить подписку
// ===========================
/**
 * Разморозить подписку
 * @param {string} subUuid — UUID подписки
 * @returns {Promise<object>}
 */
async function unfreezeSubscription(subUuid) {
  return await apiCall('/subs/unfreeze', {
    subscription_uuid: subUuid,
  });
}

// ===========================
// 6. Повысить тариф
// ===========================
/**
 * Повысить тариф подписки
 * @param {string} subUuid — UUID подписки
 * @param {string} newPlanUuid — UUID нового тарифа
 * @returns {Promise<object>}
 */
async function upgradeSubscription(subUuid, newPlanUuid) {
  return await apiCall('/subs/upgrade', {
    subscription_uuid: subUuid,
    new_plan_uuid: newPlanUuid,
  });
}

// ===========================
// 7. Купить трафик
// ===========================
/**
 * Докупить трафик к подписке
 * @param {string} subUuid — UUID подписки
 * @param {number} gb — количество GB
 * @returns {Promise<object>}
 */
async function purchaseTraffic(subUuid, gb) {
  return await apiCall('/subs/traffic', {
    subscription_uuid: subUuid,
    gb_amount: gb,
  });
}

// ===========================
// 8. Статус подписки
// ===========================
/**
 * Получить полный статус подписки
 * @param {string} subUuid — UUID подписки
 * @returns {Promise<object>}
 */
async function getSubscriptionStatus(subUuid) {
  return await apiCall('/subs/status', {
    subscription_uuid: subUuid,
  });
}

// ===========================
// 9. Список устройств
// ===========================
/**
 * Получить устройства, подключённые к подписке
 * @param {string} subUuid — UUID подписки
 * @returns {Promise<Array>}
 */
async function getDevices(subUuid) {
  try {
    const data = await apiCall('/subs/devices', {
      subscription_uuid: subUuid,
    });
    return data.devices || [];
  } catch (err) {
    console.error('[API] getDevices error:', err);
    return [];
  }
}

// ===========================
// 10. История подключений
// ===========================
/**
 * Получить историю запросов по подписке
 * @param {string} subUuid — UUID подписки
 * @param {number} offset — смещение пагинации
 * @param {number} limit — количество записей
 * @returns {Promise<object>} { requests, total }
 */
async function getConnectionRequests(subUuid, offset = 0, limit = 20) {
  return await apiCall('/subs/requests', {
    subscription_uuid: subUuid,
    offset,
    limit,
  });
}

// ===========================
// 11. Удалить устройство
// ===========================
/**
 * Удалить (отключить) устройство
 * @param {string} subUuid — UUID подписки
 * @param {string|number} deviceId — ID устройства
 * @returns {Promise<object>}
 */
async function deleteDevice(subUuid, deviceId) {
  return await apiCall('/subs/devices/delete', {
    subscription_uuid: subUuid,
    device_id: deviceId,
  });
}

// ===========================
// 12. URL конфигурации
// ===========================
/**
 * Получить URL конфигурации для подключения
 * @param {string} subUuid — UUID подписки
 * @returns {string} URL
 */
function getSubscriptionURL(subUuid) {
  return `${API_BASE}/sub/${subUuid}`;
}
