/**
 * dashboard.js — Логика личного кабинета
 * Работает с api.js (AdaptGroup) и auth.js
 */

// ===========================
// STATE
// ===========================
let currentUser = null;
let allPlans = [];
let userSubscriptions = []; // хранятся локально в KV под пользователем
let activeSubUuid = null; // текущая выбранная подписка для devices/history
let historyPage = 0;
let historyTotal = 0;
let pendingFreezeUuid = null;
let pendingTrafficUuid = null;
let pendingUpgradeUuid = null;
const HISTORY_LIMIT = 20;

// ===========================
// INIT
// ===========================
document.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  currentUser = await requireAuth();
  if (!currentUser) return;

  // Set user info in header
  renderUserInfo(currentUser);

  // Init tabs
  initTabs(onTabSwitch);

  // Load plans
  await loadPlans();

  // Load subscriptions
  await loadSubscriptions();

  // Bind logout
  document.getElementById('logoutBtn').addEventListener('click', logoutUser);

  // Bind refresh buttons
  document.getElementById('refreshSubsBtn').addEventListener('click', () => loadSubscriptions(true));
  document.getElementById('refreshDevicesBtn').addEventListener('click', () => {
    const uuid = document.getElementById('devicesSubDropdown').value;
    if (uuid) loadDevices(uuid);
  });
  document.getElementById('refreshHistoryBtn').addEventListener('click', () => {
    const uuid = document.getElementById('historySubDropdown').value;
    if (uuid) loadHistory(uuid, 0);
  });

  // History sub dropdown change
  document.getElementById('historySubDropdown').addEventListener('change', (e) => {
    const uuid = e.target.value;
    if (uuid) loadHistory(uuid, 0);
    else renderHistoryEmpty();
  });

  // Devices sub dropdown change
  document.getElementById('devicesSubDropdown').addEventListener('change', (e) => {
    const uuid = e.target.value;
    if (uuid) loadDevices(uuid);
  });

  // Modal: freeze confirm
  document.getElementById('confirmFreezeBtn').addEventListener('click', async () => {
    if (!pendingFreezeUuid) return;
    await doFreeze(pendingFreezeUuid);
    closeModal('freezeModal');
  });

  // Modal: traffic confirm
  document.getElementById('confirmTrafficBtn').addEventListener('click', async () => {
    if (!pendingTrafficUuid) return;
    const gb = parseInt(document.getElementById('trafficGb').value, 10);
    if (!gb || gb < 1) { showToast('Введите корректное количество GB', 'error'); return; }
    await doPurchaseTraffic(pendingTrafficUuid, gb);
    closeModal('trafficModal');
  });

  // Modal: upgrade confirm
  document.getElementById('confirmUpgradeBtn').addEventListener('click', async () => {
    if (!pendingUpgradeUuid) return;
    const newPlanUuid = document.getElementById('upgradePlanSelect').value;
    if (!newPlanUuid) { showToast('Выберите тариф', 'error'); return; }
    await doUpgrade(pendingUpgradeUuid, newPlanUuid);
    closeModal('upgradeModal');
  });
});

// ===========================
// USER INFO
// ===========================
function renderUserInfo(user) {
  const initials = (user.name || user.email || '?').charAt(0).toUpperCase();
  document.getElementById('userAvatar').textContent = initials;
  document.getElementById('userName').textContent = user.name || 'Пользователь';
  document.getElementById('userEmail').textContent = user.email || '';
  document.getElementById('welcomeText').textContent = `Добро пожаловать, ${user.name || 'пользователь'}!`;
}

// ===========================
// TAB SWITCH HANDLER
// ===========================
function onTabSwitch(tabId) {
  if (tabId === 'subscriptions') {
    // Already loaded, just refresh badge
  }
  if (tabId === 'devices') {
    populateSubDropdown('devicesSubDropdown');
  }
  if (tabId === 'history') {
    populateSubDropdown('historySubDropdown', true);
  }
}

// ===========================
// PLANS TAB
// ===========================
async function loadPlans() {
  const grid = document.getElementById('plansGrid');
  grid.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Загружаем тарифы...</p></div>`;

  try {
    allPlans = await getPlans();
  } catch {
    allPlans = [];
  }

  if (!allPlans || allPlans.length === 0) {
    // Use static fallback plans
    allPlans = getStaticPlans();
  }

  renderPlansGrid(allPlans);
}

function getStaticPlans() {
  return [
    { uuid: 'static-14d', name: '14 дней', price: 88, duration_days: 14, popular: false },
    { uuid: 'static-1m', name: '1 месяц', price: 141, duration_days: 30, popular: false },
    { uuid: 'static-3m', name: '3 месяца', price: 242, duration_days: 90, popular: true },
    { uuid: 'static-6m', name: '6 месяцев', price: 363, duration_days: 180, popular: false },
    { uuid: 'static-12m', name: '12 месяцев', price: 601, duration_days: 365, popular: false },
  ];
}

function renderPlansGrid(plans) {
  const grid = document.getElementById('plansGrid');

  if (!plans || plans.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <h3>Тарифы временно недоступны</h3>
        <p>Попробуйте обновить страницу позже</p>
      </div>`;
    return;
  }

  grid.innerHTML = plans.map(plan => {
    const priceRaw = plan.price || plan.price_rub || 0;
    const days = plan.duration_days || plan.days || 30;
    const perDay = priceRaw ? (priceRaw / days).toFixed(1) : '—';
    const isPopular = plan.popular || plan.is_popular || false;

    return `
    <div class="plan-card ${isPopular ? 'popular' : ''}">
      ${isPopular ? '<div class="popular-badge">🔥 Популярный</div>' : ''}
      <div class="plan-period">${plan.name || `${days} дней`}</div>
      <div class="plan-price"><span class="currency">₽</span>${priceRaw || '—'}</div>
      <div class="plan-per-day">≈ ${perDay}₽/день</div>
      <button class="btn btn-${isPopular ? 'green' : 'ghost'} btn-full btn-sm" 
        onclick="handleCreateSubscription('${plan.uuid}', '${plan.name || days + ' дней'}')">
        <i class="fas fa-plus"></i>
        Подключить
      </button>
    </div>`;
  }).join('');
}

async function handleCreateSubscription(planUuid, planName) {
  if (!currentUser) return;

  // Prevent duplicate call on static plans
  if (planUuid.startsWith('static-')) {
    showToast('Для оформления подписки воспользуйтесь Telegram-ботом или обратитесь в поддержку', 'info', 5000);
    return;
  }

  showToast(`Создаём подписку "${planName}"...`, 'info');

  try {
    const result = await createSubscription(planUuid, currentUser.email);

    if (result && (result.uuid || result.subscription_uuid || result.subscription)) {
      showToast(`Подписка "${planName}" создана!`, 'success');
      // Save subscription UUID to KV through our API
      const subUuid = result.uuid || result.subscription_uuid || result.subscription?.uuid;
      if (subUuid) {
        await saveSubscriptionToUser(subUuid);
        await loadSubscriptions(true);
      }
    } else {
      showToast(result?.error || 'Ошибка создания подписки', 'error');
    }
  } catch (err) {
    showToast('Ошибка соединения при создании подписки', 'error');
  }
}

/**
 * Сохранить UUID подписки к пользователю через наш API
 */
async function saveSubscriptionToUser(subUuid) {
  try {
    await fetch('/api/subscriptions/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ subscription_uuid: subUuid }),
    });
  } catch {
    // Store in localStorage as fallback
    const stored = JSON.parse(localStorage.getItem('plume_subs') || '[]');
    if (!stored.includes(subUuid)) {
      stored.push(subUuid);
      localStorage.setItem('plume_subs', JSON.stringify(stored));
    }
  }
}

// ===========================
// SUBSCRIPTIONS TAB
// ===========================
async function loadSubscriptions(forceRefresh = false) {
  const list = document.getElementById('subsList');
  list.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Загружаем подписки...</p></div>`;

  // Get subscription UUIDs for user
  let subUuids = [];
  try {
    const res = await fetch('/api/subscriptions/list', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      subUuids = data.subscriptions || [];
    }
  } catch {
    // Fallback to localStorage
    subUuids = JSON.parse(localStorage.getItem('plume_subs') || '[]');
  }

  if (!subUuids || subUuids.length === 0) {
    userSubscriptions = [];
    renderSubscriptionsBadge(0);
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔄</div>
        <h3>Нет активных подписок</h3>
        <p>Выберите тариф на вкладке "Тарифы", чтобы начать использовать VPN</p>
        <button class="btn btn-green" onclick="switchTab('plans')">
          <i class="fas fa-box"></i> Выбрать тариф
        </button>
      </div>`;
    return;
  }

  // Load status for each subscription
  const statusPromises = subUuids.map(uuid => getSubscriptionStatus(uuid).catch(() => null));
  const statuses = await Promise.all(statusPromises);

  userSubscriptions = statuses
    .map((status, i) => ({
      uuid: subUuids[i],
      ...(status?.subscription || status || {}),
    }))
    .filter(Boolean);

  renderSubscriptionsBadge(userSubscriptions.length);
  renderSubscriptionsList(userSubscriptions);
}

function renderSubscriptionsBadge(count) {
  const badge = document.getElementById('subsBadge');
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function renderSubscriptionsList(subs) {
  const list = document.getElementById('subsList');

  if (!subs || subs.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔄</div>
        <h3>Нет подписок</h3>
        <p>Перейдите на вкладку "Тарифы" для оформления</p>
      </div>`;
    return;
  }

  list.innerHTML = subs.map(sub => renderSubCard(sub)).join('');
}

function renderSubCard(sub) {
  const uuid = sub.uuid || sub.subscription_uuid || '?';
  const status = sub.status || 'unknown';
  const planName = sub.plan_name || sub.plan?.name || 'Подписка';
  const expiresAt = sub.expires_at || sub.end_date;
  const trafficUsed = sub.traffic_used || sub.bytes_used || 0;
  const trafficTotal = sub.traffic_limit || sub.bytes_total || 0;
  const trafficPercent = getTrafficPercent(trafficUsed, trafficTotal);
  const subUrl = getSubscriptionURL(uuid);
  const isFrozen = status === 'frozen';
  const isActive = status === 'active';
  const isExpired = status === 'expired';

  return `
  <div class="sub-card" id="sub-${uuid}">
    <div class="sub-header">
      <div>
        <div class="sub-title">${planName}</div>
        <div class="sub-uuid">UUID: ${shortUuid(uuid)}</div>
      </div>
      ${getStatusBadge(status)}
    </div>

    <div class="sub-info-grid">
      <div class="sub-info-item">
        <div class="sub-info-label">Истекает</div>
        <div class="sub-info-value">${formatDate(expiresAt)}</div>
      </div>
      <div class="sub-info-item">
        <div class="sub-info-label">Трафик</div>
        <div class="sub-info-value">${trafficTotal > 0 ? formatTraffic(trafficUsed, trafficTotal) : 'Безлимит'}</div>
        ${trafficTotal > 0 ? `<div class="traffic-bar"><div class="traffic-fill" style="width:${trafficPercent}%"></div></div>` : ''}
      </div>
      <div class="sub-info-item">
        <div class="sub-info-label">Устройства</div>
        <div class="sub-info-value">${sub.devices_count || '—'}</div>
      </div>
    </div>

    <div class="sub-url">
      <i class="fas fa-link" style="color:var(--slate-300);font-size:12px;flex-shrink:0;"></i>
      <input type="text" value="${subUrl}" readonly title="URL конфигурации" />
      <button class="btn btn-ghost btn-sm" onclick="copyToClipboard('${subUrl}', 'URL скопирован!')" title="Скопировать URL">
        <i class="fas fa-copy"></i>
      </button>
    </div>

    <div class="sub-actions">
      <button class="btn btn-green btn-sm" onclick="doRenew('${uuid}')">
        <i class="fas fa-rotate-right"></i> Продлить
      </button>
      ${isActive ? `
        <button class="btn btn-outline-green btn-sm" onclick="openFreezeModal('${uuid}')">
          <i class="fas fa-pause"></i> Заморозить
        </button>
      ` : ''}
      ${isFrozen ? `
        <button class="btn btn-outline-green btn-sm" onclick="doUnfreeze('${uuid}')">
          <i class="fas fa-play"></i> Разморозить
        </button>
      ` : ''}
      <button class="btn btn-ghost btn-sm" onclick="openUpgradeModal('${uuid}')">
        <i class="fas fa-arrow-up"></i> Повысить
      </button>
      <button class="btn btn-ghost btn-sm" onclick="openTrafficModal('${uuid}')">
        <i class="fas fa-database"></i> Трафик
      </button>
    </div>
  </div>`;
}

// ===========================
// SUBSCRIPTION ACTIONS
// ===========================

async function doRenew(subUuid) {
  showToast('Продлеваем подписку...', 'info');
  try {
    const result = await renewSubscription(subUuid);
    if (result && !result.error) {
      showToast('Подписка продлена!', 'success');
      await loadSubscriptions(true);
    } else {
      showToast(result?.error || 'Ошибка продления', 'error');
    }
  } catch {
    showToast('Ошибка соединения', 'error');
  }
}

function openFreezeModal(subUuid) {
  pendingFreezeUuid = subUuid;
  openModal('freezeModal');
}

async function doFreeze(subUuid) {
  showToast('Замораживаем подписку...', 'info');
  try {
    const result = await freezeSubscription(subUuid);
    if (result && !result.error) {
      showToast('Подписка заморожена', 'success');
      await loadSubscriptions(true);
    } else {
      showToast(result?.error || 'Ошибка заморозки', 'error');
    }
  } catch {
    showToast('Ошибка соединения', 'error');
  }
  pendingFreezeUuid = null;
}

async function doUnfreeze(subUuid) {
  showToast('Размораживаем подписку...', 'info');
  try {
    const result = await unfreezeSubscription(subUuid);
    if (result && !result.error) {
      showToast('Подписка активирована', 'success');
      await loadSubscriptions(true);
    } else {
      showToast(result?.error || 'Ошибка разморозки', 'error');
    }
  } catch {
    showToast('Ошибка соединения', 'error');
  }
}

function openTrafficModal(subUuid) {
  pendingTrafficUuid = subUuid;
  document.getElementById('trafficGb').value = 10;
  openModal('trafficModal');
}

async function doPurchaseTraffic(subUuid, gb) {
  showToast(`Покупаем ${gb} GB трафика...`, 'info');
  try {
    const result = await purchaseTraffic(subUuid, gb);
    if (result && !result.error) {
      showToast(`${gb} GB добавлено!`, 'success');
      await loadSubscriptions(true);
    } else {
      showToast(result?.error || 'Ошибка покупки трафика', 'error');
    }
  } catch {
    showToast('Ошибка соединения', 'error');
  }
  pendingTrafficUuid = null;
}

function openUpgradeModal(subUuid) {
  pendingUpgradeUuid = subUuid;
  const select = document.getElementById('upgradePlanSelect');
  select.innerHTML = allPlans
    .filter(p => !p.uuid.startsWith('static-'))
    .map(p => `<option value="${p.uuid}">${p.name || p.uuid}</option>`)
    .join('');
  if (select.innerHTML === '') {
    select.innerHTML = '<option value="">Тарифы недоступны</option>';
  }
  openModal('upgradeModal');
}

async function doUpgrade(subUuid, newPlanUuid) {
  showToast('Повышаем тариф...', 'info');
  try {
    const result = await upgradeSubscription(subUuid, newPlanUuid);
    if (result && !result.error) {
      showToast('Тариф повышен!', 'success');
      await loadSubscriptions(true);
    } else {
      showToast(result?.error || 'Ошибка повышения тарифа', 'error');
    }
  } catch {
    showToast('Ошибка соединения', 'error');
  }
  pendingUpgradeUuid = null;
}

// ===========================
// DEVICES TAB
// ===========================
function populateSubDropdown(dropdownId, withEmpty = false) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  if (withEmpty) {
    dropdown.innerHTML = '<option value="">— выберите подписку —</option>';
  } else {
    dropdown.innerHTML = '';
  }

  userSubscriptions.forEach(sub => {
    const uuid = sub.uuid || '';
    const name = sub.plan_name || sub.plan?.name || 'Подписка';
    const option = document.createElement('option');
    option.value = uuid;
    option.textContent = `${name} (${shortUuid(uuid)})`;
    dropdown.appendChild(option);
  });

  if (!withEmpty && userSubscriptions.length > 0) {
    const firstUuid = userSubscriptions[0].uuid;
    dropdown.value = firstUuid;

    // Auto-load for devices
    if (dropdownId === 'devicesSubDropdown') {
      const devicesSubSelect = document.getElementById('devicesSubSelect');
      const devicesHint = document.getElementById('devicesHint');
      if (devicesSubSelect) devicesSubSelect.style.display = 'block';
      if (devicesHint) devicesHint.style.display = 'none';
      loadDevices(firstUuid);
    }
  }

  if (withEmpty && userSubscriptions.length === 0) {
    dropdown.innerHTML = '<option value="">Нет подписок</option>';
  }
}

async function loadDevices(subUuid) {
  const list = document.getElementById('devicesList');
  list.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Загружаем устройства...</p></div>`;

  try {
    const devices = await getDevices(subUuid);

    if (!devices || devices.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📱</div>
          <h3>Нет подключённых устройств</h3>
          <p>Подключитесь к VPN, используя ссылку конфигурации из раздела "Мои подписки"</p>
        </div>`;
      return;
    }

    list.innerHTML = devices.map(device => renderDeviceCard(device, subUuid)).join('');
  } catch {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Ошибка загрузки</h3>
        <p>Не удалось загрузить список устройств. Попробуйте позже.</p>
      </div>`;
  }
}

function renderDeviceCard(device, subUuid) {
  const deviceId = device.id || device.device_id || '';
  const deviceName = device.name || device.device_name || 'Устройство';
  const platform = device.platform || device.os || device.user_agent || '';
  const lastSeen = device.last_seen || device.last_connection;
  const iconClass = getDeviceIcon(platform);

  return `
  <div class="device-card" id="device-${deviceId}">
    <div class="device-icon">
      <i class="${iconClass.includes('fab') ? iconClass : 'fas ' + iconClass}"></i>
    </div>
    <div class="device-info">
      <div class="device-name">${deviceName}</div>
      <div class="device-meta">${platform || 'Неизвестная платформа'}${lastSeen ? ' · ' + formatDateTime(lastSeen) : ''}</div>
    </div>
    <button class="btn btn-danger btn-sm" onclick="handleDeleteDevice('${subUuid}', '${deviceId}', this)">
      <i class="fas fa-trash"></i>
      Отключить
    </button>
  </div>`;
}

async function handleDeleteDevice(subUuid, deviceId, btn) {
  if (!confirm('Отключить это устройство?')) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    const result = await deleteDevice(subUuid, deviceId);
    if (result && !result.error) {
      showToast('Устройство отключено', 'success');
      const card = document.getElementById(`device-${deviceId}`);
      if (card) card.remove();
    } else {
      showToast(result?.error || 'Ошибка при отключении', 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-trash"></i> Отключить';
    }
  } catch {
    showToast('Ошибка соединения', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-trash"></i> Отключить';
  }
}

// ===========================
// HISTORY TAB
// ===========================
async function loadHistory(subUuid, offset = 0) {
  const content = document.getElementById('historyContent');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Загружаем историю...</p></div>`;

  try {
    const result = await getConnectionRequests(subUuid, offset, HISTORY_LIMIT);
    const requests = result?.requests || result?.data || [];
    historyTotal = result?.total || result?.count || requests.length;
    historyPage = Math.floor(offset / HISTORY_LIMIT);

    if (!requests || requests.length === 0) {
      renderHistoryEmpty();
      return;
    }

    renderHistoryTable(requests, subUuid, offset);
  } catch {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Ошибка загрузки истории</h3>
        <p>Попробуйте позже</p>
      </div>`;
  }
}

function renderHistoryEmpty() {
  const content = document.getElementById('historyContent');
  content.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📊</div>
      <h3>История пуста</h3>
      <p>Здесь будут отображаться данные о подключениях</p>
    </div>`;
}

function renderHistoryTable(requests, subUuid, currentOffset) {
  const content = document.getElementById('historyContent');

  const rows = requests.map(req => {
    const ts = req.created_at || req.timestamp || req.date;
    const proto = req.protocol || req.type || '—';
    const server = req.server || req.server_name || req.node || '—';
    const bytes = req.bytes || req.traffic || 0;
    const status = req.status || 'ok';
    return `
    <tr>
      <td>${formatDateTime(ts)}</td>
      <td><code style="font-size:12px;color:var(--plume-green);">${proto}</code></td>
      <td>${server}</td>
      <td>${bytes > 0 ? bytesToGB(bytes) : '—'}</td>
      <td>${getStatusBadge(status === 'ok' || status === 'success' || status === 'active' ? 'active' : 'expired')}</td>
    </tr>`;
  }).join('');

  const totalPages = Math.ceil(historyTotal / HISTORY_LIMIT);
  const currentPage = Math.floor(currentOffset / HISTORY_LIMIT);

  let paginationHtml = '';
  if (totalPages > 1) {
    let btns = '';
    for (let i = 0; i < totalPages; i++) {
      btns += `<button class="${i === currentPage ? 'active' : ''}" 
        onclick="loadHistory('${subUuid}', ${i * HISTORY_LIMIT})">${i + 1}</button>`;
    }
    paginationHtml = `
      <div class="pagination">
        <button ${currentPage === 0 ? 'disabled' : ''} onclick="loadHistory('${subUuid}', ${(currentPage - 1) * HISTORY_LIMIT})">
          <i class="fas fa-chevron-left"></i>
        </button>
        ${btns}
        <button ${currentPage >= totalPages - 1 ? 'disabled' : ''} onclick="loadHistory('${subUuid}', ${(currentPage + 1) * HISTORY_LIMIT})">
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>`;
  }

  content.innerHTML = `
    <div class="history-table-wrapper">
      <table class="history-table">
        <thead>
          <tr>
            <th>Дата/Время</th>
            <th>Протокол</th>
            <th>Сервер</th>
            <th>Трафик</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${paginationHtml}`;
}

// ===========================
// HELPERS
// ===========================
function switchTab(tabId) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.click();
}
