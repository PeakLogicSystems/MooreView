'use strict';



function esc(s) {

  return String(s ?? '')

    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;');

}



function isCloudSimsFeatureEnabled() {

  return window.MOOREVIEW_CLOUD_SIMS_ENABLED === true;

}



const CLOUD_SIMS_DISABLED_MSG = 'Cloud Sim management is disabled on this appliance.';



function renderDisabledState() {

  const statusEl = document.getElementById('cloud-sims-status');

  const wrap = document.getElementById('cloud-sims-table-wrap');

  const createSection = document.querySelector('.cloud-sims-create');

  if (statusEl) statusEl.textContent = 'Disabled';

  if (createSection) createSection.classList.add('view-hidden');

  if (wrap) {

    wrap.innerHTML = `<div class="cloud-sims-disabled panel">

      <p><strong>${esc(CLOUD_SIMS_DISABLED_MSG)}</strong></p>

      <p class="panel-hint">Enable it in <strong>System setup → Features</strong>, click <strong>Apply all settings</strong>, then return here.</p>

      <p><a href="/cellular/sims" class="btn primary">Open Connectivity…</a></p>

    </div>`;

  }

}



function defaultDeviceIdForType(type, sensorCount) {
  if (type === 'jxct_soil') return Number(sensorCount) === 1 ? 'dragino_jxct_01' : 'dragino_jxct_x4';
  if (type === 'pool_chemistry') return 'dragino_pool_chem';
  return '';
}

function syncSimFormForType() {
  const typeEl = document.getElementById('sim-type');
  const wrap = document.getElementById('sim-sensor-count-wrap');
  const deviceEl = document.getElementById('sim-device-id');
  if (!typeEl) return;
  const type = typeEl.value;
  if (wrap) wrap.classList.toggle('view-hidden', type !== 'jxct_soil');
  if (deviceEl && !deviceEl.dataset.userEdited) {
    const sensorCount = document.getElementById('sim-sensor-count')?.value || '4';
    deviceEl.placeholder = defaultDeviceIdForType(type, sensorCount) || 'auto-generated if blank';
  }
}

function statusBadge(status) {

  const cls = {

    running: 'cloud-sim-badge-running',

    stopped: 'cloud-sim-badge-stopped',

    starting: 'cloud-sim-badge-starting',

    error: 'cloud-sim-badge-error',

  }[status] || 'cloud-sim-badge-stopped';

  return `<span class="cloud-sim-badge ${cls}">${esc(status)}</span>`;

}



function renderTable(sims) {

  const wrap = document.getElementById('cloud-sims-table-wrap');

  if (!wrap) return;

  if (!sims.length) {

    wrap.innerHTML = '<p class="muted">No sim instances yet. Create one above.</p>';

    return;

  }

  const rows = sims.map((sim) => {

    const canStart = sim.status !== 'running';

    const canStop = sim.status === 'running' || sim.status === 'starting';

    return `<tr data-sim-id="${esc(sim.id)}">

      <td>${esc(sim.name)}</td>

      <td>${esc(sim.tenantId)}</td>

      <td><code>${esc(sim.mqttDeviceId)}</code></td>

      <td>${esc(sim.type)}</td>

      <td>${statusBadge(sim.status)}</td>

      <td class="cell-mono">${sim.lastPublishAt || sim.runner?.lastPublishAt || '—'}</td>

      <td class="cloud-sims-actions">

        ${canStart ? `<button type="button" class="btn btn-sm cloud-sim-start" data-id="${esc(sim.id)}">Start</button>` : ''}

        ${canStop ? `<button type="button" class="btn btn-sm cloud-sim-stop" data-id="${esc(sim.id)}">Stop</button>` : ''}

        <button type="button" class="btn btn-sm cloud-sim-delete" data-id="${esc(sim.id)}" ${canStop ? 'disabled title="Stop sim first"' : ''}>Delete</button>

      </td>

    </tr>`;

  }).join('');

  wrap.innerHTML = `<table class="cloud-sims-table">

    <thead><tr>

      <th>Name</th><th>Tenant</th><th>Device ID</th><th>Type</th><th>Status</th><th>Last publish</th><th>Actions</th>

    </tr></thead>

    <tbody>${rows}</tbody>

  </table>`;

}



function showLoadError(message) {

  const statusEl = document.getElementById('cloud-sims-status');

  const wrap = document.getElementById('cloud-sims-table-wrap');

  if (statusEl) statusEl.textContent = 'Error';

  if (wrap) wrap.innerHTML = `<p class="error-text">${esc(message)}</p>`;

}



async function refresh() {

  if (!isCloudSimsFeatureEnabled()) {

    renderDisabledState();

    return;

  }

  const statusEl = document.getElementById('cloud-sims-status');

  try {

    const [data, mgr] = await Promise.all([

      window.api.getCloudSims(),

      window.api.getCloudSimsStatus(),

    ]);

    renderTable(data.sims || []);

    if (statusEl) {

      statusEl.textContent = `${mgr.runningCount || 0} running · store ${mgr.store?.backend || '?'} · ${mgr.mqtt?.brokerUrl || 'no broker'}`;

    }

  } catch (e) {

    showLoadError(e.message || 'Failed to load sims');

  }

}



async function onCreate(ev) {

  ev.preventDefault();

  const msg = document.getElementById('cloud-sims-create-msg');

  msg.textContent = '';

  const body = {

    name: document.getElementById('sim-name').value.trim(),

    tenantId: document.getElementById('sim-tenant').value.trim(),

    type: document.getElementById('sim-type').value,

    config: { intervalMs: Number(document.getElementById('sim-interval').value) || 2000 },

  };

  if (body.type === 'jxct_soil') {
    body.config.sensorCount = Number(document.getElementById('sim-sensor-count')?.value) || 4;
  }

  const deviceId = document.getElementById('sim-device-id').value.trim();

  if (deviceId) body.mqttDeviceId = deviceId;

  try {

    await window.api.createCloudSim(body);

    msg.textContent = 'Sim created.';

    ev.target.reset();

    document.getElementById('sim-tenant').value = 'demo-tenant';

    document.getElementById('sim-interval').value = '2000';

    const deviceEl = document.getElementById('sim-device-id');
    if (deviceEl) delete deviceEl.dataset.userEdited;

    await refresh();

  } catch (e) {

    msg.textContent = e.message || 'Create failed';

  }

}



async function onTableClick(ev) {

  const btn = ev.target.closest('button[data-id]');

  if (!btn) return;

  const id = btn.dataset.id;

  try {

    if (btn.classList.contains('cloud-sim-start')) await window.api.startCloudSim(id);

    if (btn.classList.contains('cloud-sim-stop')) await window.api.stopCloudSim(id);

    if (btn.classList.contains('cloud-sim-delete')) {

      if (!window.confirm('Delete this sim instance?')) return;

      await window.api.deleteCloudSim(id);

    }

    await refresh();

  } catch (e) {

    window.alert(e.message || 'Action failed');

    await refresh();

  }

}



async function onSeedWebsiteDemo() {

  const msg = document.getElementById('cloud-sims-seed-msg');

  if (msg) msg.textContent = 'Seeding…';

  try {

    const data = await window.api.seedWebsiteDemoSims({ start: true });

    const summary = (data.results || []).map((r) => `${r.action} ${r.sim?.mqttDeviceId}${r.started ? ' (running)' : ''}`).join(' · ');

    if (msg) msg.textContent = summary || 'Done.';

    await refresh();

  } catch (e) {

    if (msg) msg.textContent = e.message || 'Seed failed';

  }

}



document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('cloud-sims-create-form')?.addEventListener('submit', onCreate);

  document.getElementById('cloud-sims-refresh')?.addEventListener('click', refresh);

  document.getElementById('cloud-sims-table-wrap')?.addEventListener('click', onTableClick);

  document.getElementById('cloud-sims-seed-website')?.addEventListener('click', onSeedWebsiteDemo);

  document.getElementById('sim-type')?.addEventListener('change', syncSimFormForType);

  document.getElementById('sim-sensor-count')?.addEventListener('change', syncSimFormForType);

  document.getElementById('sim-device-id')?.addEventListener('input', (ev) => {

    const el = ev.target;

    if (el.value.trim()) el.dataset.userEdited = '1';

    else delete el.dataset.userEdited;

  });

  syncSimFormForType();

  refresh();

});


