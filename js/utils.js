function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCurrency(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatMinutes(minutes) {
  if (!minutes) return '0:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h + ':' + String(m).padStart(2, '0') + ' u';
}

function formatHoursDecimal(minutes) {
  return (minutes / 60).toFixed(2);
}

function generateId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

function toast(message, type = '') {
  const container = document.getElementById('toast-container') || (() => {
    const el = document.createElement('div');
    el.id = 'toast-container';
    el.className = 'toast-container';
    document.body.appendChild(el);
    return el;
  })();

  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function setupModals() {
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) backdrop.classList.remove('open');
    });
  });
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-backdrop').classList.remove('open');
    });
  });
}

function budgetStatusClass(status) {
  if (status === 'over_budget') return 'over';
  if (status === 'warning') return 'warn';
  return '';
}

function budgetStatusBadge(status) {
  const map = {
    on_track: 'badge-active',
    warning: 'badge-warning',
    over_budget: 'badge-over'
  };
  return map[status] || 'badge-planned';
}

function budgetPercent(hoursTotal, budgetHours) {
  if (!budgetHours) return 0;
  return Math.min(Math.round((hoursTotal / budgetHours) * 100), 100);
}

function progressBar(hoursTotal, budgetHours, status) {
  const pct = budgetPercent(hoursTotal, budgetHours);
  const cls = budgetStatusClass(status);
  return `<div class="progress"><div class="progress-bar ${cls}" style="width:${pct}%"></div></div>`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setupAccordions() {
  document.querySelectorAll('.accordion-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.accordion-item').classList.toggle('open');
    });
  });
}

function setupTabs(containerSelector) {
  document.querySelectorAll(containerSelector || '.section-tabs').forEach(tabs => {
    tabs.querySelectorAll('.section-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.querySelectorAll('.section-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.target;
        document.querySelectorAll('.tab-panel').forEach(panel => {
          panel.classList.toggle('active', panel.id === target);
        });
      });
    });
  });
}

function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') element.className = v;
    else if (k.startsWith('on')) element.addEventListener(k.slice(2), v);
    else element.setAttribute(k, v);
  }
  children.forEach(child => {
    if (typeof child === 'string') element.appendChild(document.createTextNode(child));
    else if (child) element.appendChild(child);
  });
  return element;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
