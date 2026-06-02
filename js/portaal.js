async function init() {
  const user = await requireAuth('client');
  if (!user) return;
  renderNavUser(user);
  setupModals();
  setupPinChange();
  await loadOverview();
}

async function loadOverview() {
  const content = document.getElementById('portaal-content');
  try {
    const data = await api.client.overview();
    const project = data.project;
    const finance = data.finance;
    const documents = data.documents || [];
    const terms = data.terms;

    content.innerHTML = `
      <div class="portaal-project-header">
        <h1>${project.name}</h1>
        <div class="project-status">
          <span class="badge badge-${project.status}">${t('project.status.' + project.status)}</span>
          ${project.description ? `<span>· ${project.description}</span>` : ''}
        </div>
      </div>

      <!-- Phases -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">${t('portaal.hours')}</h2>
        </div>
        ${renderPhases(finance)}
      </div>

      <!-- Financial totals -->
      <div class="section">
        <div class="three-col" style="margin-bottom:var(--space-lg)">
          <div class="stat-card">
            <span class="stat-value">${formatCurrency(finance.totals.subtotal)}</span>
            <span class="stat-label">Subtotaal</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">${formatCurrency(finance.totals.invoiced)}</span>
            <span class="stat-label">${t('portaal.invoiced')}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">${formatCurrency(finance.totals.outstanding)}</span>
            <span class="stat-label">${t('portaal.outstanding')}</span>
          </div>
        </div>
      </div>

      <!-- Invoices -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">${t('portaal.invoices')}</h2>
        </div>
        ${renderInvoices(finance)}
      </div>

      <!-- Documents -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">${t('portaal.documents')}</h2>
        </div>
        ${renderDocuments(documents)}
      </div>

      <!-- Terms -->
      ${terms ? `
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">${t('portaal.terms')}</h2>
        </div>
        <div class="card" style="display:flex;align-items:center;justify-content:space-between">
          <span class="text-muted">Algemene voorwaarden Studio Iris van Gelder</span>
          <button class="btn btn-secondary btn-sm" onclick="openTerms()" data-i18n="portaal.view_terms">${t('portaal.view_terms')}</button>
        </div>
      </div>` : ''}

      <!-- Settings -->
      <div class="section">
        <hr />
        <div style="display:flex;justify-content:flex-end;gap:var(--space-sm);margin-top:var(--space-md)">
          <button class="btn btn-ghost btn-sm" onclick="openModal('modal-change-pin')" data-i18n="settings.change_pin">${t('settings.change_pin')}</button>
        </div>
      </div>
    `;

    // Store terms data for later
    window._termsData = terms;

  } catch (err) {
    content.innerHTML = `<p class="text-muted">${t('common.error')}: ${err.message}</p>`;
  }
}

function renderPhases(finance) {
  if (!finance || !finance.phases || !finance.phases.length) return `<div class="empty-state"><p>Geen fases beschikbaar.</p></div>`;
  return finance.phases.map(ph => {
    const pct = ph.budget_hours ? Math.min(Math.round(ph.hours.total / ph.budget_hours * 100), 100) : 0;
    const cls = budgetStatusClass(ph.budget_status);
    return `
    <div class="phase-block">
      <div class="phase-block-header">
        <span class="phase-block-title">${ph.name}</span>
        <span class="badge ${budgetStatusBadge(ph.budget_status)}">${t('budget.' + ph.budget_status)}</span>
      </div>
      <div style="margin-bottom:var(--space-md)">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px">
          <span>${ph.hours.within_budget} u ${t('hours.within_budget').toLowerCase()}</span>
          <span class="text-muted">${pct}% van ${ph.budget_hours} u</span>
        </div>
        <div class="progress"><div class="progress-bar ${cls}" style="width:${pct}%"></div></div>
      </div>
      <div class="phase-stats">
        <div class="phase-stat-item">
          <div class="phase-stat-label">${t('portaal.invoiced')}</div>
          <div class="phase-stat-value">${formatCurrency(ph.invoiced)}</div>
        </div>
        <div class="phase-stat-item">
          <div class="phase-stat-label">${t('portaal.outstanding')}</div>
          <div class="phase-stat-value">${formatCurrency(ph.outstanding)}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderInvoices(finance) {
  const rows = (finance.phases || []).flatMap(ph =>
    (ph.invoices_detail || []).filter(i => i.visible_to_client).map(i => ({ ...i, phase_name: ph.name }))
  );
  if (!rows.length) return `<div class="empty-state"><p>${t('portaal.no_invoices')}</p></div>`;
  return `<div class="doc-list">${rows.map(i => `
    <div class="doc-item">
      <div class="doc-info">
        <div class="doc-name">${formatDate(i.invoice_date)} — ${formatCurrency(i.amount)}</div>
        <div class="doc-meta">${i.phase_name}${i.description ? ' · ' + i.description : ''}</div>
      </div>
      ${i.pdf_file_id ? `<button class="btn btn-secondary btn-sm" onclick="downloadInvoice('${i.invoice_id}')">${t('portaal.download_invoice')}</button>` : ''}
    </div>`).join('')}</div>`;
}

function renderDocuments(docs) {
  const sorted = [...docs].sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
  if (!sorted.length) return `<div class="empty-state"><p>${t('portaal.no_documents')}</p></div>`;
  return `<div class="doc-list">${sorted.map(d => `
    <div class="doc-item">
      <div class="doc-info">
        <div class="doc-name">${d.name}</div>
        <div class="doc-meta">${t('document.types.' + d.type)} · ${formatDate(d.uploaded_at)}</div>
      </div>
      ${d.storage_type === 'link'
        ? `<a class="btn btn-secondary btn-sm" href="${d.external_url}" target="_blank" rel="noopener">${t('document.open')}</a>`
        : `<button class="btn btn-secondary btn-sm" onclick="downloadDoc('${d.document_id}')">${t('document.download')}</button>`}
    </div>`).join('')}</div>`;
}

async function downloadDoc(docId) {
  try {
    const d = await api.documents.getDownloadUrl(docId);
    window.open(d.url, '_blank');
  } catch (_) {}
}

async function downloadInvoice(invoiceId) {
  try {
    const d = await api.documents.getInvoiceUrl(invoiceId);
    window.open(d.url, '_blank');
  } catch (_) {}
}

async function openTerms() {
  try {
    const terms = window._termsData || await api.terms.get();
    const d = await api.documents.getDownloadUrl(terms.file_id);
    window.open(d.url, '_blank');
  } catch (_) {}
}

function setupPinInputs(container) {
  const inputs = container.querySelectorAll('input[data-pin]');
  inputs.forEach((input, i) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '');
      if (input.value && i < inputs.length - 1) inputs[i + 1].focus();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !input.value && i > 0) inputs[i - 1].focus();
    });
  });
  return () => Array.from(inputs).map(i => i.value).join('');
}

function setupPinChange() {
  const getOldPin = setupPinInputs(document.getElementById('old-pin-inputs'));
  const getNewPin = setupPinInputs(document.getElementById('new-pin-inputs'));

  document.getElementById('form-change-pin').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('pin-change-error');
    errEl.style.display = 'none';
    const oldPin = getOldPin();
    const newPin = getNewPin();
    if (newPin.length !== 4) {
      errEl.textContent = t('activate.invalid');
      errEl.style.display = 'block';
      return;
    }
    try {
      await api.auth.changePin(oldPin, newPin);
      closeModal('modal-change-pin');
      e.target.reset();
      toast(t('common.saved'), 'success');
    } catch (err) {
      errEl.textContent = err.message || t('common.error');
      errEl.style.display = 'block';
    }
  });
}

init();
