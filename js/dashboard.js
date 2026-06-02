let allProjects = [];
let allFinance = {};

async function init() {
  const user = await requireAuth('admin');
  if (!user) return;
  renderNavUser(user);
  setupModals();
  setupNewProjectForm();
  setupHoursModal();
  await loadDashboard();
}

async function loadDashboard() {
  try {
    allProjects = await api.projects.list();
    const activeProjects = allProjects.filter(p => p.status === 'active');

    // Load finance summaries
    let totalOutstanding = 0;
    let budgetAttention = 0;
    for (const p of activeProjects) {
      try {
        const fin = await api.finance.summary(p.project_id);
        allFinance[p.project_id] = fin;
        totalOutstanding += fin.totals.outstanding || 0;
        if (fin.phases) {
          budgetAttention += fin.phases.filter(ph =>
            ph.budget_status === 'warning' || ph.budget_status === 'over_budget'
          ).length;
        }
      } catch (_) {}
    }

    document.getElementById('stat-active').textContent = activeProjects.length;
    document.getElementById('stat-outstanding').textContent = formatCurrency(totalOutstanding);
    document.getElementById('stat-budget-attention').textContent = budgetAttention;

    renderProjects(allProjects);
    populateHoursProjectSelect(activeProjects);
  } catch (err) {
    document.getElementById('projects-container').innerHTML =
      `<p class="text-muted">${t('common.error')}</p>`;
  }
}

function renderProjects(projects) {
  const container = document.getElementById('projects-container');
  if (!projects.length) {
    container.innerHTML = `<div class="empty-state"><p data-i18n="dashboard.no_projects">${t('dashboard.no_projects')}</p></div>`;
    return;
  }

  container.innerHTML = '<div class="projects-grid">' +
    projects.map(p => {
      const fin = allFinance[p.project_id];
      const activePhase = p.phases ? p.phases.find(ph => ph.status === 'active') : null;
      const outstanding = fin ? formatCurrency(fin.totals.outstanding) : '—';
      let progressHtml = '';
      let phaseInfo = '';

      if (activePhase && fin) {
        const phFin = fin.phases ? fin.phases.find(ph => ph.phase_id === activePhase.phase_id) : null;
        if (phFin) {
          const pct = Math.min(Math.round((phFin.hours.total / activePhase.budget_hours) * 100), 100);
          const cls = budgetStatusClass(phFin.budget_status);
          progressHtml = `
            <div style="margin-bottom:var(--space-sm)">
              <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px">
                <span>${activePhase.name}</span>
                <span class="text-muted">${pct}%</span>
              </div>
              <div class="progress"><div class="progress-bar ${cls}" style="width:${pct}%"></div></div>
            </div>`;
        }
        phaseInfo = activePhase.name;
      }

      const statusBadge = `<span class="badge badge-${p.status}">${t('project.status.' + p.status)}</span>`;

      return `<div class="project-card">
        <div class="project-card-header">
          <div>
            <div class="project-card-title">${p.name}</div>
            <div class="project-card-meta">${phaseInfo ? phaseInfo + ' · ' : ''}${p.phases ? p.phases.length + ' ' + t('dashboard.phases') : ''}</div>
          </div>
          ${statusBadge}
        </div>
        ${progressHtml}
        <div class="project-card-footer">
          <span class="project-outstanding">${outstanding}</span>
          <div style="display:flex;gap:var(--space-sm)">
            <button class="btn btn-secondary btn-sm" onclick="openHoursModal('${p.project_id}')" data-i18n="dashboard.book_hours">${t('dashboard.book_hours')}</button>
            <a class="btn btn-primary btn-sm" href="project.html?id=${p.project_id}" data-i18n="dashboard.view_project">${t('dashboard.view_project')}</a>
          </div>
        </div>
      </div>`;
    }).join('') + '</div>';
}

function setupNewProjectForm() {
  document.getElementById('btn-new-project').addEventListener('click', () => {
    document.getElementById('np-start-date').value = todayISO();
    openModal('modal-new-project');
  });

  document.getElementById('form-new-project').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await api.projects.create({
        name: document.getElementById('np-name').value.trim(),
        description: document.getElementById('np-description').value.trim(),
        start_date: document.getElementById('np-start-date').value,
      });
      closeModal('modal-new-project');
      e.target.reset();
      toast(t('common.saved'), 'success');
      await loadDashboard();
    } catch (err) {
      toast(err.message || t('common.error'), 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

function populateHoursProjectSelect(projects) {
  const sel = document.getElementById('h-project');
  sel.innerHTML = '<option value="">— selecteer —</option>' +
    projects.map(p => `<option value="${p.project_id}">${p.name}</option>`).join('');
}

function setupHoursModal() {
  document.getElementById('h-date').value = todayISO();

  document.getElementById('h-project').addEventListener('change', async function () {
    const phaseSel = document.getElementById('h-phase');
    phaseSel.innerHTML = '<option value="">Laden…</option>';
    if (!this.value) { phaseSel.innerHTML = '<option value="">— selecteer eerst een project —</option>'; return; }
    try {
      const proj = await api.projects.get(this.value);
      const phases = (proj.phases || []).filter(ph => ph.status !== 'archived');
      phaseSel.innerHTML = phases.map(ph =>
        `<option value="${ph.phase_id}">${ph.name}</option>`
      ).join('');
    } catch (_) { phaseSel.innerHTML = '<option value="">Fout bij laden</option>'; }
  });

  document.querySelectorAll('.duration-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cur = parseInt(document.getElementById('h-minutes').value) || 0;
      document.getElementById('h-minutes').value = cur + parseInt(btn.dataset.min);
      document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('form-hours').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('hours-error');
    errEl.style.display = 'none';
    const minutes = parseInt(document.getElementById('h-minutes').value);
    if (!minutes || minutes % 15 !== 0) {
      errEl.textContent = 'Duur moet een veelvoud van 15 minuten zijn.';
      errEl.style.display = 'block';
      return;
    }
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await api.hours.create({
        phase_id: document.getElementById('h-phase').value,
        date: document.getElementById('h-date').value,
        duration_minutes: minutes,
        category: document.getElementById('h-category').value,
        description: document.getElementById('h-description').value.trim(),
      });
      closeModal('modal-hours');
      e.target.reset();
      document.getElementById('h-date').value = todayISO();
      toast(t('common.saved'), 'success');
    } catch (err) {
      errEl.textContent = err.message || t('common.error');
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
    }
  });
}

function openHoursModal(projectId) {
  openModal('modal-hours');
  const sel = document.getElementById('h-project');
  sel.value = projectId;
  sel.dispatchEvent(new Event('change'));
}

init();
