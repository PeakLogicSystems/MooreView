'use strict';

const $ = (id) => document.getElementById(id);

let pollTimer = null;
let activeTab = 'packets';

async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });
  } catch {
    throw new Error(
      'Cannot reach the proto-sniff server. In a terminal run: cd est-pc/tools/net-capture && npm start — then open http://127.0.0.1:3210 (do not open index.html as a file).',
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function setBadge(state) {
  const el = $('state-badge');
  el.textContent = state;
  el.className = `badge ${state}`;
}

function showError(msg) {
  const el = $('error-banner');
  if (!msg) {
    el.classList.remove('show');
    el.textContent = '';
    return;
  }
  el.textContent = msg;
  el.classList.add('show');
}

function endpointLine(rec) {
  const ip = rec.ip;
  if (!ip) {
    if (rec.arp) return `ARP ${rec.arp.senderIp} → ${rec.arp.targetIp}`;
    return '—';
  }
  return `${ip.srcIp}:${ip.srcPort || '—'} → ${ip.dstIp}:${ip.dstPort || '—'}`;
}

function hintLine(app) {
  if (!app) return '—';
  if (app.decoded?.protocol) {
    const d = app.decoded;
    if (d.protocol === 'http') return `${d.role} ${d.method || ''} ${d.path || d.status || ''}`.trim();
    if (d.protocol === 'mqtt') return `${d.messageType} ${d.topic || ''}`.trim();
    if (d.protocol === 'modbus-tcp') return d.functionName;
  }
  if (app.unknown) {
    const u = app.unknown;
    return `${u.contentClass || 'unknown'} · H=${u.entropy} · ${u.prefixHex4 || ''}`;
  }
  return app.scheme || '—';
}

function renderPackets(data) {
  const body = $('packets-body');
  const empty = $('packets-empty');
  body.innerHTML = '';
  if (!data.packets?.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  for (const row of data.packets) {
    const rec = row.record;
    const app = rec.stream?.application || rec.application;
    const tr = document.createElement('tr');
    tr.className = 'packet-row';
    tr.innerHTML = `
      <td class="mono">${row.id}</td>
      <td class="mono">${rec.ts?.slice(11, 23) || '—'}</td>
      <td class="mono">${endpointLine(rec)}</td>
      <td><span class="tag">${app?.scheme || '—'}</span></td>
      <td class="mono">${hintLine(app)}</td>
    `;
    const detailTr = document.createElement('tr');
    const detailTd = document.createElement('td');
    detailTd.colSpan = 5;
    const pre = document.createElement('pre');
    pre.className = 'detail';
    pre.textContent = JSON.stringify(rec, null, 2);
    detailTd.appendChild(pre);
    detailTr.appendChild(detailTd);
    detailTr.style.display = 'none';

    tr.addEventListener('click', () => {
      const open = detailTr.style.display !== 'none';
      detailTr.style.display = open ? 'none' : 'table-row';
      pre.classList.toggle('open', !open);
    });

    body.appendChild(tr);
    body.appendChild(detailTr);
  }
}

function renderFlows(data) {
  const list = $('flows-list');
  const empty = $('flows-empty');
  list.innerHTML = '';
  if (!data.flows?.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  for (const f of data.flows) {
    const schemes = Object.entries(f.schemes || {}).map(([k, v]) => `${k}(${v})`).join(', ');
    const card = document.createElement('div');
    card.className = 'flow-card';
    card.innerHTML = `
      <h3>${f.key}</h3>
      <div class="flow-meta">
        ${f.packets} pkts · ${f.bytes} bytes · ${f.l4}
        ${f.lengthStats ? ` · sizes ${f.lengthStats.min}–${f.lengthStats.max} (μ=${f.lengthStats.mean})` : ''}
      </div>
      <div class="flow-meta">Schemes: ${schemes || '—'}</div>
      <div class="flow-meta mono">Top prefixes: ${(f.topPrefixes || []).map((p) => `${p.prefix}×${p.count}`).join(', ') || '—'}</div>
    `;
    list.appendChild(card);
  }
}

function renderProposal(doc) {
  const list = $('proposal-list');
  const empty = $('proposal-empty');
  list.innerHTML = '';
  const flows = doc?.flowProposals || [];
  if (!flows.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  for (const p of flows) {
    const card = document.createElement('div');
    card.className = 'flow-card';
    card.innerHTML = `
      <h3>${p.flow || 'flow'}</h3>
      <div class="flow-meta">
        <span class="tag">${p.proposedFraming || p.classification || '—'}</span>
        <span class="tag">${p.confidence || '—'} confidence</span>
        ${p.port ? `<span class="tag">port ${p.port}</span>` : ''}
      </div>
      ${p.evidence?.length ? `<div class="flow-meta">Evidence: ${p.evidence.join('; ')}</div>` : ''}
      ${p.decodePseudocode ? `<pre class="detail open" style="margin-top:0.5rem">${p.decodePseudocode}</pre>` : ''}
      ${p.sampleAnalysis ? `<pre class="detail open" style="margin-top:0.5rem">${JSON.stringify(p.sampleAnalysis, null, 2)}</pre>` : ''}
    `;
    list.appendChild(card);
  }
}

async function loadSettings() {
  const { settings } = await api('/api/settings');
  $('target-host').value = settings.targetHost || '';
  $('bpf').value = settings.bpf || '';
  $('promiscuous').checked = settings.promiscuous !== false;
  if (settings.iface) $('iface').value = settings.iface;
  return settings;
}

async function loadInterfaces() {
  try {
    const data = await api('/api/interfaces');
    const sel = $('iface');
    const current = sel.value;
    sel.innerHTML = '<option value="auto">Auto-detect</option>';
    for (const iface of data.interfaces || []) {
      if (iface.internal) continue;
      const opt = document.createElement('option');
      opt.value = iface.name;
      opt.textContent = `${iface.name} (${iface.address})`;
      sel.appendChild(opt);
    }
    if (data.suggested) {
      const match = [...sel.options].find((o) => o.value === data.suggested.name);
      if (match) sel.value = data.suggested.name;
    } else if (current) sel.value = current;
  } catch {
    /* optional */
  }
}

function renderCaptureReadiness(capture) {
  const el = $('capture-hint');
  if (!el || !capture) return;
  el.textContent = capture.message || '';
  el.style.color = capture.ready ? 'var(--ok)' : 'var(--warn)';
}

async function refreshStatus() {
  const { status, settings, capture } = await api('/api/status');
  setBadge(status.state);
  $('stat-packets').textContent = status.packetCount;
  $('stat-flows').textContent = status.flowCount;
  $('stat-unknown').textContent = status.unknownCount;
  $('stat-backend').textContent = status.backend || '—';
  $('stat-promisc').textContent = status.promiscuous === false ? 'off' : 'on';
  $('stat-bpf').textContent = status.bpf || `host ${settings.targetHost}`;

  renderCaptureReadiness(capture);

  $('btn-start').disabled = status.state === 'capturing' || status.state === 'stopping';
  $('btn-stop').disabled = status.state !== 'capturing';
  $('btn-clear').disabled = status.state === 'capturing';

  if (status.error) showError(status.error);
  else if (status.state !== 'error') showError('');

  return status;
}

async function refreshPackets() {
  const scheme = $('scheme-filter').value;
  const q = scheme ? `?limit=200&scheme=${encodeURIComponent(scheme)}` : '?limit=200';
  const data = await api(`/api/packets${q}`);
  renderPackets(data);
}

async function refreshFlows() {
  const data = await api('/api/flows');
  renderFlows(data);
}

async function refreshProposal() {
  const doc = await api('/api/proposal');
  renderProposal(doc);
}

async function refreshActiveTab() {
  if (activeTab === 'packets') await refreshPackets();
  else if (activeTab === 'flows') await refreshFlows();
  else await refreshProposal();
}

async function poll() {
  try {
    const status = await refreshStatus();
    await refreshActiveTab();
    const ms = status.state === 'capturing' ? 1000 : 3000;
    clearTimeout(pollTimer);
    pollTimer = setTimeout(poll, ms);
  } catch (e) {
    showError(e.message);
    pollTimer = setTimeout(poll, 5000);
  }
}

async function saveSettings() {
  const targetHost = $('target-host').value.trim();
  const iface = $('iface').value;
  const bpf = $('bpf').value.trim() || null;
  const promiscuous = $('promiscuous').checked;
  await api('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ targetHost, iface, bpf, promiscuous }),
  });
}

$('btn-save').addEventListener('click', async () => {
  try {
    await saveSettings();
    showError('');
  } catch (e) {
    showError(e.message);
  }
});

$('btn-start').addEventListener('click', async () => {
  try {
    await saveSettings();
    await api('/api/capture/start', { method: 'POST', body: '{}' });
    showError('');
    await poll();
  } catch (e) {
    showError(e.message);
  }
});

$('btn-stop').addEventListener('click', async () => {
  try {
    await api('/api/capture/stop', { method: 'POST', body: '{}' });
    await poll();
  } catch (e) {
    showError(e.message);
  }
});

$('btn-clear').addEventListener('click', async () => {
  try {
    await api('/api/capture/clear', { method: 'POST', body: '{}' });
    await poll();
  } catch (e) {
    showError(e.message);
  }
});

$('btn-refresh-packets').addEventListener('click', () => refreshPackets());
$('scheme-filter').addEventListener('change', () => refreshPackets());

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.tab;
    $(`panel-${activeTab}`).classList.add('active');
    refreshActiveTab();
  });
});

if (window.location.protocol === 'file:') {
  document.addEventListener('DOMContentLoaded', () => {
    showError('Opened as a local file — the API will not work. Run npm start and open http://127.0.0.1:3210');
  });
}

(async function init() {
  await loadSettings();
  await loadInterfaces();
  await poll();
})();
