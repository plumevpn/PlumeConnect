/**
 * app.js — Общие утилиты Plume Connect
 */

// ===========================
// TOAST NOTIFICATIONS
// ===========================

/**
 * Показать уведомление
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration мс
 */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fas ${icons[type]} toast-icon"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Auto remove
  const timer = setTimeout(() => removeToast(toast), duration);

  toast.addEventListener('click', () => {
    clearTimeout(timer);
    removeToast(toast);
  });
}

function removeToast(toast) {
  toast.classList.add('removing');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

// ===========================
// MODAL HELPERS
// ===========================

function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(overlay => {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    });
  }
});

// ===========================
// TABS
// ===========================

function initTabs(onSwitch) {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = document.getElementById(`tab-${tabId}`);
      if (panel) panel.classList.add('active');

      if (typeof onSwitch === 'function') onSwitch(tabId);
    });
  });
}

// ===========================
// FORMAT HELPERS
// ===========================

/**
 * Форматировать дату
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Форматировать дату со временем
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Форматировать байты в GB
 */
function bytesToGB(bytes) {
  if (!bytes || isNaN(bytes)) return '0 GB';
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

/**
 * Форматировать трафик
 */
function formatTraffic(used, total) {
  if (!total) return 'Безлимит';
  const usedGB = used / (1024 * 1024 * 1024);
  const totalGB = total / (1024 * 1024 * 1024);
  return `${usedGB.toFixed(2)} / ${totalGB.toFixed(2)} GB`;
}

/**
 * Получить процент трафика
 */
function getTrafficPercent(used, total) {
  if (!total) return 0;
  return Math.min(Math.round((used / total) * 100), 100);
}

/**
 * Сокращённый UUID
 */
function shortUuid(uuid) {
  if (!uuid) return '—';
  return uuid.substring(0, 8) + '...' + uuid.substring(uuid.length - 4);
}

/**
 * Скопировать текст в буфер
 */
async function copyToClipboard(text, successMsg = 'Скопировано!') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg, 'success');
    return true;
  } catch {
    // Fallback
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast(successMsg, 'success');
    return true;
  }
}

/**
 * Определить иконку устройства по user agent / платформе
 */
function getDeviceIcon(deviceInfo) {
  if (!deviceInfo) return 'fa-mobile-screen';
  const d = deviceInfo.toLowerCase();
  if (d.includes('windows')) return 'fa-windows fab';
  if (d.includes('mac') || d.includes('ios') || d.includes('iphone') || d.includes('ipad')) return 'fa-apple fab';
  if (d.includes('android')) return 'fa-android fab';
  if (d.includes('linux')) return 'fa-linux fab';
  if (d.includes('router') || d.includes('openwrt')) return 'fa-router';
  return 'fa-mobile-screen';
}

/**
 * Получить статусный badge HTML
 */
function getStatusBadge(status) {
  const map = {
    active: { cls: 'status-active', label: 'Активна' },
    frozen: { cls: 'status-frozen', label: 'Заморожена' },
    expired: { cls: 'status-expired', label: 'Истекла' },
    pending: { cls: 'status-pending', label: 'Ожидает' },
  };
  const s = map[status] || { cls: 'status-pending', label: status || 'Неизвестно' };
  return `<span class="status-badge ${s.cls}">
    <span class="status-badge-dot"></span>
    ${s.label}
  </span>`;
}

// ===========================
// DEBOUNCE
// ===========================
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ===========================
// SCROLL REVEAL (shared)
// ===========================
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScrollReveal);
} else {
  initScrollReveal();
}
