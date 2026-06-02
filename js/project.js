const projectId = new URLSearchParams(window.location.search).get('id');
let currentProject = null;
let currentFinance = null;

async function init() {
  if (!projectId) { window.location.href = 'dashboard-iris.html'; return; }
  const user = await requireAuth('admin');
  if (!user) return;
  renderNavUser(user);
  setupModals();
  setupTabs();
  await loadProject();
  setupForms();

  document.getElementById('btn-edit-project').addEventListener('click', openEditProjectModal);
  document.getElementById('btn-invite-client').addEventListener('click', () => openModal('modal-invite'));
  document.getElementById('btn-new-phase').addEventListener('click', () => openPhaseModal());
  document.getElementById('btn-book-hours').addEventListener('click', () => openHoursModal());
  document.getElementById('btn-new-travel').addEventListener('click', () => openTravelModal());
  document.getElementById('btn-new-expense').addEventListener('click', () => openExpenseModal());
  document.getElementById('btn-new-invoice').addEventListener('click', () => openInvoiceModal());
  document.getElementById('btn-upload-doc').addEventListener('click', () => openDocModal('upload'));
  document.getElementById('btn-new-link').addEventListener('click', () => openDocModal('link'));
}

async function loadProject() {
  try {
    currentProject = await api.projects.get(projectId);
    currentFinance = await api.finance.summary(projectId);

    document.title = currentProject.name + ' — Studio Iris van Gelder';
    document.getElementById('project-title').textContent = currentProject.name;

    renderOverview();
    renderPhases();
    renderHours();
    renderCosts();
    renderInvoices();
    renderDocuments();
    renderLog();
    populatePhaseSelects();
  } catch (err) {
    toast(err.message || t('common.error'), 'error');
  }
}

function renderOverview() {
  const p = currentProject;
  document.getElementById('project-details').innerHTML = `
    <dl style="display:grid;grid-template-columns:auto 1fr;gap:var(--space-sm) var(--space-md)">
      <dt class="text-muted">Status</dt><dd><span class="badge badge-${p.status}">${t('project.status.' + p.status)}</span></dd>
      <dt class="text-muted">Startdatum</dt><dd>${formatDate(p.start_date)}</dd>
      ${p.description ? `<dt class="text-muted">Omschrijving</dt><dd>${p.description}</dd>` : ''}
    </dl>`;

  const members = p.members || [];
  document.getElementById('members-list').innerHTML = members.length
    ? `<ul style="list-style:none;padding:0">${members.map(m => `
        <li style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-sm) 0;border-bottom:1px solid var(--color-sand-light)">
          <div>
            <div>${m.name}</div>
            <div class="text-muted" style="font-size:0.82rem">${m.email}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="removeMember('${m.user_id}')" data-i18n="common.delete">Verwijderen</button>
        </li>`).join('')}</ul>`
    : `<p class="text-muted">Nog geen klanten gekoppeld.</p>`;
}

function renderPhases() {
  const phases = (currentProject.phases || []).sort((a, b) => a.order - b.order);
  const fin = currentFinance;

  if (!phases.length) {
    document.getElementById('phases-list').innerHTML = `<div class="empty-state"><p>Nog geen fases aangemaakt.</p></div>`;
    return;
  }

  document.getElementById('phases-list').innerHTML = phases.map(ph => {
    const phFin = fin && fin.phases ? fin.phases.find(f => f.phase_id === ph.phase_id) : null;
    const hoursTotal = phFin ? phFin.hours.total : 0;
    const pct = ph.budget_hours ? Math.min(Math.round(hoursTotal / ph.budget_hours * 100), 100) : 0;
    const status = phFin ? phFin.budget_status : 'on_track';
    return `
    <div class="accordion-item">
      <button class="accordion-toggle">
        <span style="display:flex;align-items:center;gap:var(--space-md)">
          <span>${ph.name}</span>
          <span class="badge badge-${ph.status}">${t('phase.status.' + ph.status)}</span>
        </span>
        <span class="chevron">▼</span>
      </button>
      <div class="accordion-body">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-md);margin-bottom:var(--space-md)">
          <div><div class="text-muted" style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Budget</div>
               <div style="font-family:var(--font-display);font-size:1.1rem">${ph.budget_hours || 0} u</div></div>
          <div><div class="text-muted" style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Geboekt</div>
               <div style="font-family:var(--font-display);font-size:1.1rem">${formatMinutes((hoursTotal * 60))}</div></div>
          <div><div class="text-muted" style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em">Tarief</div>
               <div style="font-family:var(--font-display);font-size:1.1rem">${formatCurrency(ph.hourly_rate)}/u</div></div>
        </div>
        <div style="margin-bottom:var(--space-md)">
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px">
            <span>${t('budget.' + status)}</span><span>${pct}%</span>
          </div>
          ${progressBar(hoursTotal, ph.budget_hours, status)}
        </div>
        <div style="display:flex;gap:var(--space-sm)">
          <button class="btn btn-secondary btn-sm" onclick="openPhaseModal('${ph.phase_id}')">${t('common.edit')}</button>
          <button class="btn btn-ghost btn-sm" onclick="archivePhase('${ph.phase_id}')">Archiveren</button>
        </div>
      </div>
    </div>`;
  }).join('');

  setupAccordions();
}

function renderHours() {
  const phases = (currentProject.phases || []).filter(ph => ph.status !== 'archived');
  if (!phases.length) {
    document.getElementById('hours-list').innerHTML = `<div class="empty-state"><p>Geen fases beschikbaar.</p></div>`;
    return;
  }

  // Render grouped per phase, hours loaded per accordion open
  document.getElementById('hours-list').innerHTML = phases.map(ph => `
    <div class="accordion-item" data-phase-id="${ph.phase_id}">
      <button class="accordion-toggle" onclick="loadPhaseHours('${ph.phase_id}')">
        <span>${ph.name}</span><span class="chevron">▼</span>
      </button>
      <div class="accordion-body" id="hours-${ph.phase_id}">
        <p class="text-muted">Klik om uren te laden.</p>
      </div>
    </div>`).join('');

  setupAccordions();
}

async function loadPhaseHours(phaseId) {
  const container = document.getElementById('hours-' + phaseId);
  if (container.dataset.loaded) return;
  container.dataset.loaded = '1';
  try {
    const hours = await api.hours.list({ phase_id: phaseId });
    const active = hours.filter(h => !h.is_deleted);
    if (!active.length) { container.innerHTML = `<p class="text-muted">Geen uren geboekt.</p>`; return; }
    container.innerHTML = `<div class="table-wrapper"><table>
      <thead><tr>
        <th>${t('common.date')}</th><th>${t('hours.description')}</th>
        <th>${t('hours.category')}</th><th>Duur</th><th>${t('common.actions')}</th>
      </tr></thead>
      <tbody>${active.map(h => `<tr>
        <td>${formatDate(h.date)}</td>
        <td>${h.description || '—'}</td>
        <td>${t('hours.' + (h.category === 'within_budget' ? 'within_budget' : h.category === 'non_billable' ? 'non_billable' : 'extra'))}</td>
        <td>${formatMinutes(h.duration_minutes)}</td>
        <td style="display:flex;gap:var(--space-xs)">
          <button class="btn btn-ghost btn-sm" onclick="editHour(${JSON.stringify(h).replace(/"/g, '&quot;')})">${t('common.edit')}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteHour('${h.hour_id}', '${phaseId}')">${t('common.delete')}</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>
    <div style="margin-top:var(--space-sm);font-size:0.85rem;color:var(--color-taupe)">
      Totaal: ${formatMinutes(active.reduce((s, h) => s + h.duration_minutes, 0))}
    </div>`;
  } catch (_) { container.innerHTML = `<p class="text-muted">${t('common.error')}</p>`; }
}

function renderCosts() {
  const fin = currentFinance;
  if (!fin) return;

  // Travel
  const travelRows = (fin.phases || []).flatMap(ph =>
    (ph.travel_costs_detail || []).map(t => ({ ...t, phase_name: ph.name }))
  );
  document.getElementById('travel-list').innerHTML = travelRows.length
    ? `<div class="table-wrapper"><table>
        <thead><tr><th>Datum</th><th>Omschrijving</th><th>Fase</th><th>Bedrag</th><th></th></tr></thead>
        <tbody>${travelRows.map(r => `<tr>
          <td>${formatDate(r.date)}</td><td>${r.description}</td><td>${r.phase_name}</td>
          <td>${formatCurrency(r.total)}</td>
          <td><button class="btn btn-danger btn-sm" onclick="deleteTravel('${r.travel_id}')">${t('common.delete')}</button></td>
        </tr>`).join('')}</tbody></table></div>`
    : `<div class="empty-state"><p>Geen reiskosten.</p></div>`;

  // Expenses
  const expRows = (fin.phases || []).flatMap(ph =>
    (ph.expenses_detail || []).map(e => ({ ...e, phase_name: ph.name }))
  );
  document.getElementById('expenses-list').innerHTML = expRows.length
    ? `<div class="table-wrapper"><table>
        <thead><tr><th>Datum</th><th>Omschrijving</th><th>Fase</th><th>Bedrag</th><th></th></tr></thead>
        <tbody>${expRows.map(r => `<tr>
          <td>${formatDate(r.date)}</td><td>${r.description}</td><td>${r.phase_name}</td>
          <td>${formatCurrency(r.amount)}</td>
          <td><button class="btn btn-danger btn-sm" onclick="deleteExpense('${r.expense_id}')">${t('common.delete')}</button></td>
        </tr>`).join('')}</tbody></table></div>`
    : `<div class="empty-state"><p>Geen voorschotten.</p></div>`;
}

function renderInvoices() {
  const fin = currentFinance;
  if (!fin) return;
  const rows = (fin.phases || []).flatMap(ph =>
    (ph.invoices_detail || []).map(i => ({ ...i, phase_name: ph.name }))
  );
  document.getElementById('invoices-list').innerHTML = rows.length
    ? `<div class="table-wrapper"><table>
        <thead><tr><th>Datum</th><th>Omschrijving</th><th>Fase</th><th>Bedrag</th><th>Klant</th><th></th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${formatDate(r.invoice_date)}</td>
          <td>${r.description || '—'}</td>
          <td>${r.phase_name}</td>
          <td>${formatCurrency(r.amount)}</td>
          <td>
            <input type="checkbox" ${r.visible_to_client ? 'checked' : ''}
              onchange="toggleInvoiceVisible('${r.invoice_id}', this.checked)" />
          </td>
          <td style="display:flex;gap:var(--space-xs)">
            ${r.pdf_file_id ? `<button class="btn btn-secondary btn-sm" onclick="downloadInvoice('${r.invoice_id}')">PDF</button>` : ''}
            <button class="btn btn-danger btn-sm" onclick="deleteInvoice('${r.invoice_id}')">${t('common.delete')}</button>
          </td>
        </tr>`).join('')}</tbody></table></div>`
    : `<div class="empty-state"><p>Geen factuurmomenten.</p></div>`;
}

async function renderDocuments() {
  try {
    const docs = await api.documents.list(projectId);
    document.getElementById('documents-list').innerHTML = docs.length
      ? `<div class="doc-list">${docs.map(d => `
          <div class="doc-item">
            <div class="doc-info">
              <div class="doc-name">${d.name}</div>
              <div class="doc-meta">${t('document.types.' + d.type)} · ${formatDate(d.uploaded_at)}</div>
            </div>
            <div style="display:flex;gap:var(--space-sm);flex-shrink:0">
              ${d.storage_type === 'link'
                ? `<a class="btn btn-secondary btn-sm" href="${d.external_url}" target="_blank" rel="noopener">${t('document.open')}</a>`
                : `<button class="btn btn-secondary btn-sm" onclick="downloadDoc('${d.document_id}')">${t('document.download')}</button>`}
              <button class="btn btn-danger btn-sm" onclick="deleteDoc('${d.document_id}')">${t('common.delete')}</button>
            </div>
          </div>`).join('')}</div>`
      : `<div class="empty-state"><p>${t('portaal.no_documents')}</p></div>`;
  } catch (_) {}
}

async function renderLog() {
  try {
    const logs = await api.hours.log(projectId);
    document.getElementById('log-list').innerHTML = logs.length
      ? `<div class="table-wrapper"><table>
          <thead><tr><th>Tijdstip</th><th>Veld</th><th>Oud</th><th>Nieuw</th><th>Reden</th></tr></thead>
          <tbody>${logs.map(l => `<tr>
            <td>${formatDate(l.changed_at)}</td>
            <td>${l.field_changed}</td>
            <td class="text-muted">${l.old_value}</td>
            <td>${l.new_value}</td>
            <td>${l.reason || '—'}</td>
          </tr>`).join('')}</tbody></table></div>`
      : `<div class="empty-state"><p>Geen wijzigingen geregistreerd.</p></div>`;
  } catch (_) {}
}

function populatePhaseSelects() {
  const phases = (currentProject.phases || []).filter(ph => ph.status !== 'archived');
  const opts = phases.map(ph => `<option value="${ph.phase_id}">${ph.name}</option>`).join('');
  const optNone = '<option value="">— geen koppeling —</option>';

  ['h-phase', 'tr-phase', 'exp-phase', 'inv2-phase'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
  const docPhase = document.getElementById('doc-phase');
  if (docPhase) docPhase.innerHTML = optNone + opts;
}

// ── Phase modal ──────────────────────────────────

function openPhaseModal(phaseId) {
  const phase = phaseId ? (currentProject.phases || []).find(p => p.phase_id === phaseId) : null;
  document.getElementById('phase-modal-title').textContent = phase ? t('phase.edit') : t('phase.new');
  document.getElementById('ph-id').value = phase ? phase.phase_id : '';
  document.getElementById('ph-name').value = phase ? phase.name : '';
  document.getElementById('ph-budget').value = phase ? phase.budget_hours : '';
  document.getElementById('ph-rate').value = phase ? phase.hourly_rate : '';
  document.getElementById('ph-status').value = phase ? phase.status : 'planned';
  document.getElementById('ph-order').value = phase ? phase.order : (currentProject.phases || []).length + 1;
  openModal('modal-new-phase');
}

async function archivePhase(phaseId) {
  if (!confirm(t('common.confirm_delete'))) return;
  try {
    await api.phases.archive(phaseId);
    toast(t('common.saved'), 'success');
    await loadProject();
  } catch (err) { toast(err.message, 'error'); }
}

// ── Hours modal ──────────────────────────────────

function openHoursModal(phaseId) {
  document.getElementById('h-hour-id').value = '';
  document.getElementById('hours-modal-title').textContent = t('hours.title');
  document.getElementById('reason-group').style.display = 'none';
  document.getElementById('h-date').value = todayISO();
  document.getElementById('h-minutes').value = '';
  document.getElementById('h-description').value = '';
  if (phaseId) document.getElementById('h-phase').value = phaseId;
  openModal('modal-hours');
}

function editHour(h) {
  document.getElementById('h-hour-id').value = h.hour_id;
  document.getElementById('hours-modal-title').textContent = t('hours.edit');
  document.getElementById('reason-group').style.display = 'block';
  document.getElementById('h-reason').value = '';
  document.getElementById('h-phase').value = h.phase_id;
  document.getElementById('h-date').value = h.date ? h.date.slice(0, 10) : '';
  document.getElementById('h-minutes').value = h.duration_minutes;
  document.getElementById('h-category').value = h.category;
  document.getElementById('h-description').value = h.description || '';
  openModal('modal-hours');
}

async function deleteHour(hourId, phaseId) {
  const reason = prompt(t('hours.reason') + ':');
  if (reason === null) return;
  if (!reason.trim()) { toast(t('hours.reason_required'), 'error'); return; }
  try {
    await api.hours.delete(hourId, reason);
    toast(t('common.saved'), 'success');
    delete document.getElementById('hours-' + phaseId).dataset.loaded;
    await loadPhaseHours(phaseId);
  } catch (err) { toast(err.message, 'error'); }
}

// ── Travel modal ─────────────────────────────────

function openTravelModal() {
  document.getElementById('tr-date').value = todayISO();
  document.getElementById('tr-type').value = 'fixed';
  document.getElementById('tr-fixed-fields').style.display = 'block';
  document.getElementById('tr-km-fields').style.display = 'none';
  openModal('modal-travel');
}

async function deleteTravel(id) {
  if (!confirm(t('common.confirm_delete'))) return;
  try { await api.travel.delete(id); toast(t('common.saved'), 'success'); await loadProject(); }
  catch (err) { toast(err.message, 'error'); }
}

// ── Expense modal ────────────────────────────────

function openExpenseModal() {
  document.getElementById('exp-date').value = todayISO();
  openModal('modal-expense');
}

async function deleteExpense(id) {
  if (!confirm(t('common.confirm_delete'))) return;
  try { await api.expenses.delete(id); toast(t('common.saved'), 'success'); await loadProject(); }
  catch (err) { toast(err.message, 'error'); }
}

// ── Invoice modal ────────────────────────────────

function openInvoiceModal() {
  document.getElementById('inv2-date').value = todayISO();
  openModal('modal-invoice');
}

async function toggleInvoiceVisible(invoiceId, visible) {
  try { await api.invoices.update({ invoice_id: invoiceId, visible_to_client: visible }); }
  catch (err) { toast(err.message, 'error'); }
}

async function downloadInvoice(invoiceId) {
  try {
    const d = await api.documents.getInvoiceUrl(invoiceId);
    window.open(d.url, '_blank');
  } catch (_) {}
}

async function deleteInvoice(id) {
  if (!confirm(t('common.confirm_delete'))) return;
  try { await api.invoices.delete(id); toast(t('common.saved'), 'success'); await loadProject(); }
  catch (err) { toast(err.message, 'error'); }
}

// ── Document modal ───────────────────────────────

function openDocModal(storageType) {
  document.getElementById('doc-storage-type').value = storageType;
  document.getElementById('doc-modal-title').textContent = storageType === 'link' ? t('document.link') : t('document.upload');
  document.getElementById('doc-upload-field').style.display = storageType === 'upload' ? 'block' : 'none';
  document.getElementById('doc-link-field').style.display = storageType === 'link' ? 'block' : 'none';
  openModal('modal-document');
}

async function downloadDoc(docId) {
  try {
    const d = await api.documents.getDownloadUrl(docId);
    window.open(d.url, '_blank');
  } catch (_) {}
}

async function deleteDoc(id) {
  if (!confirm(t('common.confirm_delete'))) return;
  try { await api.documents.delete(id); toast(t('common.saved'), 'success'); await renderDocuments(); }
  catch (err) { toast(err.message, 'error'); }
}

// ── Edit project ─────────────────────────────────

function openEditProjectModal() {
  document.getElementById('ep-name').value = currentProject.name;
  document.getElementById('ep-description').value = currentProject.description || '';
  document.getElementById('ep-status').value = currentProject.status;
  openModal('modal-edit-project');
}

async function removeMember(userId) {
  if (!confirm(t('common.confirm_delete'))) return;
  try {
    await api.projects.removeMember(projectId, userId);
    toast(t('common.saved'), 'success');
    await loadProject();
  } catch (err) { toast(err.message, 'error'); }
}

// ── Forms ────────────────────────────────────────

function setupForms() {
  // Edit project
  document.getElementById('form-edit-project').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api.projects.update({
        project_id: projectId,
        name: document.getElementById('ep-name').value.trim(),
        description: document.getElementById('ep-description').value.trim(),
        status: document.getElementById('ep-status').value,
      });
      closeModal('modal-edit-project');
      toast(t('common.saved'), 'success');
      await loadProject();
    } catch (err) { toast(err.message, 'error'); }
  });

  // Invite
  document.getElementById('form-invite').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('invite-error');
    errEl.style.display = 'none';
    try {
      const data = await api.auth.invite(
        document.getElementById('inv-email').value.trim(),
        document.getElementById('inv-name').value.trim()
      );
      await api.projects.addMember(projectId, data.user_id);
      closeModal('modal-invite');
      e.target.reset();
      toast('Uitnodiging verstuurd', 'success');
      await loadProject();
    } catch (err) {
      errEl.textContent = err.message || t('common.error');
      errEl.style.display = 'block';
    }
  });

  // Phase form
  document.getElementById('form-phase').addEventListener('submit', async e => {
    e.preventDefault();
    const phaseId = document.getElementById('ph-id').value;
    const data = {
      project_id: projectId,
      phase_id: phaseId || undefined,
      name: document.getElementById('ph-name').value.trim(),
      budget_hours: parseFloat(document.getElementById('ph-budget').value) || 0,
      hourly_rate: parseFloat(document.getElementById('ph-rate').value) || 0,
      status: document.getElementById('ph-status').value,
      order: parseInt(document.getElementById('ph-order').value) || 1,
    };
    try {
      if (phaseId) await api.phases.update(data);
      else await api.phases.create(data);
      closeModal('modal-new-phase');
      toast(t('common.saved'), 'success');
      await loadProject();
    } catch (err) { toast(err.message, 'error'); }
  });

  // Hours form
  document.querySelectorAll('.duration-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cur = parseInt(document.getElementById('h-minutes').value) || 0;
      document.getElementById('h-minutes').value = cur + parseInt(btn.dataset.min);
    });
  });

  document.getElementById('form-hours').addEventListener('submit', async e => {
    e.preventDefault();
    const hourId = document.getElementById('h-hour-id').value;
    const minutes = parseInt(document.getElementById('h-minutes').value);
    if (!minutes || minutes % 15 !== 0) { toast('Duur moet veelvoud van 15 zijn.', 'error'); return; }
    const errEl = document.getElementById('hours-error');
    errEl.style.display = 'none';
    try {
      if (hourId) {
        const reason = document.getElementById('h-reason').value.trim();
        if (!reason) { errEl.textContent = t('hours.reason_required'); errEl.style.display = 'block'; return; }
        await api.hours.update({
          hour_id: hourId,
          phase_id: document.getElementById('h-phase').value,
          date: document.getElementById('h-date').value,
          duration_minutes: minutes,
          category: document.getElementById('h-category').value,
          description: document.getElementById('h-description').value.trim(),
          reason,
        });
      } else {
        await api.hours.create({
          phase_id: document.getElementById('h-phase').value,
          date: document.getElementById('h-date').value,
          duration_minutes: minutes,
          category: document.getElementById('h-category').value,
          description: document.getElementById('h-description').value.trim(),
        });
      }
      closeModal('modal-hours');
      e.target.reset();
      toast(t('common.saved'), 'success');
      // Reload hours for the current phase
      const phaseId = document.getElementById('h-phase').value;
      const container = document.getElementById('hours-' + phaseId);
      if (container) { delete container.dataset.loaded; loadPhaseHours(phaseId); }
    } catch (err) { errEl.textContent = err.message || t('common.error'); errEl.style.display = 'block'; }
  });

  // Travel type toggle
  document.getElementById('tr-type').addEventListener('change', function () {
    document.getElementById('tr-fixed-fields').style.display = this.value === 'fixed' ? 'block' : 'none';
    document.getElementById('tr-km-fields').style.display = this.value === 'per_km' ? 'block' : 'none';
  });

  document.getElementById('form-travel').addEventListener('submit', async e => {
    e.preventDefault();
    const type = document.getElementById('tr-type').value;
    const data = {
      phase_id: document.getElementById('tr-phase').value,
      date: document.getElementById('tr-date').value,
      type,
      description: document.getElementById('tr-description').value.trim(),
    };
    if (type === 'fixed') data.amount = parseFloat(document.getElementById('tr-amount').value);
    else { data.km = parseFloat(document.getElementById('tr-km').value); data.km_rate = parseFloat(document.getElementById('tr-km-rate').value); }
    try { await api.travel.create(data); closeModal('modal-travel'); e.target.reset(); toast(t('common.saved'), 'success'); await loadProject(); }
    catch (err) { toast(err.message, 'error'); }
  });

  // Expense file preview
  document.getElementById('exp-receipt').addEventListener('change', function () {
    document.getElementById('exp-file-name').textContent = this.files[0] ? this.files[0].name : '';
  });

  document.getElementById('form-expense').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const result = await api.expenses.create({
        phase_id: document.getElementById('exp-phase').value,
        date: document.getElementById('exp-date').value,
        description: document.getElementById('exp-description').value.trim(),
        amount: parseFloat(document.getElementById('exp-amount').value),
      });
      const file = document.getElementById('exp-receipt').files[0];
      if (file) {
        const b64 = await readFileAsBase64(file);
        await api.expenses.uploadReceipt(result.expense_id, b64, file.name);
      }
      closeModal('modal-expense'); e.target.reset(); toast(t('common.saved'), 'success'); await loadProject();
    } catch (err) { toast(err.message, 'error'); }
  });

  // Invoice file preview
  document.getElementById('inv2-pdf').addEventListener('change', function () {
    document.getElementById('inv2-file-name').textContent = this.files[0] ? this.files[0].name : '';
  });

  document.getElementById('form-invoice').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const result = await api.invoices.create({
        phase_id: document.getElementById('inv2-phase').value,
        invoice_date: document.getElementById('inv2-date').value,
        amount: parseFloat(document.getElementById('inv2-amount').value),
        description: document.getElementById('inv2-description').value.trim(),
        visible_to_client: document.getElementById('inv2-visible').checked,
      });
      const file = document.getElementById('inv2-pdf').files[0];
      if (file) {
        const b64 = await readFileAsBase64(file);
        await api.invoices.uploadPdf(result.invoice_id, b64, file.name);
      }
      closeModal('modal-invoice'); e.target.reset(); toast(t('common.saved'), 'success'); await loadProject();
    } catch (err) { toast(err.message, 'error'); }
  });

  // Document file preview
  document.getElementById('doc-file').addEventListener('change', function () {
    document.getElementById('doc-file-name').textContent = this.files[0] ? this.files[0].name : '';
  });

  document.getElementById('form-document').addEventListener('submit', async e => {
    e.preventDefault();
    const storageType = document.getElementById('doc-storage-type').value;
    try {
      const data = {
        project_id: projectId,
        phase_id: document.getElementById('doc-phase').value || undefined,
        name: document.getElementById('doc-name').value.trim(),
        type: document.getElementById('doc-type').value,
      };
      if (storageType === 'link') {
        data.external_url = document.getElementById('doc-url').value.trim();
        await api.documents.createLink(data);
      } else {
        const file = document.getElementById('doc-file').files[0];
        if (!file) { toast('Selecteer een bestand.', 'error'); return; }
        data.file_base64 = await readFileAsBase64(file);
        data.filename = file.name;
        await api.documents.upload(data);
      }
      closeModal('modal-document'); e.target.reset(); toast(t('common.saved'), 'success'); await renderDocuments();
    } catch (err) { toast(err.message, 'error'); }
  });
}

init();
