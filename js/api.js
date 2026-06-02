const API_BASE = (function () {
  const stored = localStorage.getItem('gas_url');
  return stored || 'https://script.google.com/macros/s/JOUW_URL_HIER/exec';
})();

// Warn once if GAS URL is not configured
if (!API_BASE) {
  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9999',
      'background:#B85C52', 'color:#fff', 'padding:10px 16px',
      'font-family:system-ui,sans-serif', 'font-size:13px', 'text-align:center',
    ].join(';');
    banner.innerHTML = '⚠️ GAS-URL nog niet ingesteld. Voer in de browser-console in: '
      + '<code style="background:rgba(0,0,0,.25);padding:2px 6px;border-radius:3px">'
      + "localStorage.setItem('gas_url', 'https://script.google.com/macros/s/JOUW_ID/exec')"
      + '</code> en herlaad de pagina.';
    document.body.prepend(banner);
  });
}

async function apiCall(action, method = 'GET', params = {}) {
  const token = sessionStorage.getItem('session_token') || localStorage.getItem('session_token');
  // GAS does not expose custom HTTP headers — always pass the token as a parameter.
  const headers = { 'Content-Type': 'application/json' };

  let url = API_BASE + '?action=' + encodeURIComponent(action);
  let options = { method, headers };

  if (method === 'GET') {
    if (token) url += '&session_token=' + encodeURIComponent(token);
    for (const [k, v] of Object.entries(params)) {
      url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v);
    }
  } else {
    // For POST, embed token in the JSON body under a distinct key
    const body = { ...params };
    if (token) body.session_token = token;
    options.body = JSON.stringify(body);
  }

  if (!API_BASE) throw new Error('GAS-URL niet ingesteld. Zie de rode balk bovenaan.');

  let response;
  try {
    response = await fetch(url, options);
  } catch (networkErr) {
    throw new Error('Kan de server niet bereiken. Controleer de GAS-URL en je internetverbinding.');
  }

  // GAS always returns 200; errors are in the JSON body
  let data;
  try {
    data = await response.json();
  } catch (_) {
    throw new Error(`Onverwacht antwoord van de server (HTTP ${response.status}). Controleer de GAS deployment-URL.`);
  }

  if (!data.success) {
    if (data.error === 'SESSION_EXPIRED' || data.error === 'UNAUTHORIZED') {
      sessionStorage.removeItem('session_token');
      localStorage.removeItem('session_token');
      window.location.href = '/index.html';
      return;
    }
    throw new Error(data.error || 'Onbekende fout');
  }

  return data.data;
}

const api = {
  auth: {
    invite: (email, name) => apiCall('auth.invite', 'POST', { email, name }),
    activate: (token, pin) => apiCall('auth.activate', 'POST', { token, pin }),
    login: (email, pin) => apiCall('auth.login', 'POST', { email, pin }),
    setupAdmin: (email, pin) => apiCall('auth.setup_admin', 'POST', { email, pin }),
    logout: () => apiCall('auth.logout', 'POST'),
    me: () => apiCall('auth.me', 'GET'),
    changePin: (old_pin, new_pin) => apiCall('auth.change_pin', 'POST', { old_pin, new_pin }),
    updatePlayerid: (onesignal_player_id) => apiCall('auth.update_player_id', 'POST', { onesignal_player_id }),
    updateLanguage: (language) => apiCall('auth.update_language', 'POST', { language }),
    updateOnboarding: () => apiCall('auth.onboarding_done', 'POST'),
  },
  projects: {
    list: () => apiCall('projects.list', 'GET'),
    get: (project_id) => apiCall('projects.get', 'GET', { project_id }),
    create: (data) => apiCall('projects.create', 'POST', data),
    update: (data) => apiCall('projects.update', 'POST', data),
    addMember: (project_id, user_id) => apiCall('projects.add_member', 'POST', { project_id, user_id }),
    removeMember: (project_id, user_id) => apiCall('projects.remove_member', 'POST', { project_id, user_id }),
  },
  phases: {
    create: (data) => apiCall('phases.create', 'POST', data),
    update: (data) => apiCall('phases.update', 'POST', data),
    archive: (phase_id) => apiCall('phases.archive', 'POST', { phase_id }),
  },
  hours: {
    list: (params) => apiCall('hours.list', 'GET', params),
    create: (data) => apiCall('hours.create', 'POST', data),
    update: (data) => apiCall('hours.update', 'POST', data),
    delete: (hour_id, reason) => apiCall('hours.delete', 'POST', { hour_id, reason }),
    log: (project_id) => apiCall('hours.log', 'GET', { project_id }),
  },
  travel: {
    create: (data) => apiCall('travel.create', 'POST', data),
    delete: (travel_id) => apiCall('travel.delete', 'POST', { travel_id }),
  },
  expenses: {
    create: (data) => apiCall('expenses.create', 'POST', data),
    uploadReceipt: (expense_id, file_base64, filename) =>
      apiCall('expenses.upload_receipt', 'POST', { expense_id, file_base64, filename }),
    delete: (expense_id) => apiCall('expenses.delete', 'POST', { expense_id }),
  },
  invoices: {
    create: (data) => apiCall('invoices.create', 'POST', data),
    uploadPdf: (invoice_id, file_base64, filename) =>
      apiCall('invoices.upload_pdf', 'POST', { invoice_id, file_base64, filename }),
    update: (data) => apiCall('invoices.update', 'POST', data),
    delete: (invoice_id) => apiCall('invoices.delete', 'POST', { invoice_id }),
  },
  documents: {
    list: (project_id) => apiCall('documents.list', 'GET', { project_id }),
    createLink: (data) => apiCall('documents.create_link', 'POST', data),
    upload: (data) => apiCall('documents.upload', 'POST', data),
    delete: (document_id) => apiCall('documents.delete', 'POST', { document_id }),
    getDownloadUrl: (document_id) => apiCall('documents.get_download_url', 'GET', { document_id }),
    getInvoiceUrl:  (invoice_id)  => apiCall('documents.get_download_url', 'GET', { document_id: invoice_id, type: 'invoice' }),
  },
  terms: {
    get: () => apiCall('terms.get', 'GET'),
    upload: (file_base64, filename) => apiCall('terms.upload', 'POST', { file_base64, filename }),
  },
  finance: {
    summary: (project_id) => apiCall('finance.summary', 'GET', { project_id }),
  },
  client: {
    overview: () => apiCall('client.overview', 'GET'),
  },
};
