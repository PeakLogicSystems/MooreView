'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let dash = null;
let ioMapData = null;
let pollTimer = null;
let ioPollTimer = null;
let activeTab = 'program';
let programDirty = false;
let tagsDirty = false;
let driversDirty = false;
let selectedIoId = '';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function readJsonFile(input, cb) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      cb(JSON.parse(reader.result));
    } catch (e) {
      alert('Invalid JSON: ' + e.message);
    }
    input.value = '';
  };
  reader.readAsText(file);
}

function setMsg(el, text, ok) {
  if (!el) return;
  el.textContent = text || '';
  el.className = 'msg' + (text ? (ok ? ' msg-ok' : ' msg-err') : '');
}

function liveMap() {
  const m = new Map();
  for (const row of dash?.live || []) m.set(row.id, row);
  return m;
}

function updateBadge() {
  const el = $('#runtime-badge');
  if (!el || !dash?.runtime) return;
  const s = dash.runtime.state || 'idle';
  el.textContent = `${s} · scan ${dash.settings?.scanMs ?? '—'} ms`;
  el.className = 'badge ' + (
    s === 'running' ? 'badge-run' : s === 'paused' ? 'badge-pause' : s === 'error' ? 'badge-err' : 'badge-idle'
  );
}

async function refreshDash() {
  try {
    dash = await api.getDashboard();
    updateBadge();
    if (activeTab === 'tags') renderTagsPanel(true);
    if (activeTab === 'iomap') refreshIoMap(true);
  } catch (e) {
    console.warn('poll', e.message);
  }
}

function startPoll() {
  if (pollTimer) clearInterval(pollTimer);
  refreshDash();
  pollTimer = setInterval(refreshDash, 800);
}

function setTab(name) {
  activeTab = name;
  $$('#main-tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === name));
  if (ioPollTimer) {
    clearInterval(ioPollTimer);
    ioPollTimer = null;
  }
  if (name === 'program') renderProgramPanel();
  else if (name === 'tags') renderTagsPanel();
  else if (name === 'drivers') renderDriversPanel();
  else if (name === 'iomap') renderIoMapPanel();
}

function mount(html) {
  $('#app').innerHTML = html;
}

/* ——— Program ——— */
async function renderProgramPanel() {
  if (!dash) await refreshDash();
  const programs = dash?.programs || [];
  const active = dash?.activeProgram || 'logic/program.st';
  const source = dash?.program || '';

  const opts = programs.map((p) =>
    `<option value="${escapeHtml(p.path)}" ${p.path === active ? 'selected' : ''}>${escapeHtml(p.path)}</option>`
  ).join('');

  mount(`
    <section class="panel">
      <h2>ST program</h2>
      <div class="toolbar">
        <label>File <select id="prog-select">${opts}</select></label>
        <button type="button" class="btn btn-ghost" id="prog-load">Load</button>
        <button type="button" class="btn btn-ghost" id="prog-fixtures">Load + fixtures</button>
        <button type="button" class="btn" id="prog-validate">Validate</button>
        <button type="button" class="btn" id="prog-save">Save</button>
      </div>
      <textarea id="prog-src" spellcheck="false">${escapeHtml(source)}</textarea>
      <pre id="prog-msg" class="msg"></pre>
    </section>
  `);

  const srcEl = $('#prog-src');
  srcEl.addEventListener('input', () => { programDirty = true; });

  $('#prog-load').onclick = async () => {
    const path = $('#prog-select').value;
    try {
      const r = await api.loadProgram(path, { loadFixtures: false });
      srcEl.value = r.source || '';
      programDirty = false;
      setMsg($('#prog-msg'), `Loaded ${path}`, true);
      await refreshDash();
    } catch (e) { setMsg($('#prog-msg'), e.message, false); }
  };

  $('#prog-fixtures').onclick = async () => {
    const path = $('#prog-select').value;
    try {
      const r = await api.loadProgram(path, { loadFixtures: true });
      srcEl.value = r.source || '';
      programDirty = false;
      setMsg($('#prog-msg'), `Loaded ${path} with fixtures.`, true);
      await refreshDash();
    } catch (e) { setMsg($('#prog-msg'), e.message, false); }
  };

  $('#prog-validate').onclick = async () => {
    try {
      const v = await api.validateProgram(srcEl.value);
      setMsg($('#prog-msg'), v.ok ? 'Program OK.' : (v.errors || []).join('\n'), v.ok);
    } catch (e) { setMsg($('#prog-msg'), e.message, false); }
  };

  $('#prog-save').onclick = async () => {
    const path = $('#prog-select').value;
    try {
      await api.saveProgram(path, srcEl.value);
      await api.putProgram(srcEl.value);
      programDirty = false;
      setMsg($('#prog-msg'), 'Saved.', true);
      await refreshDash();
    } catch (e) { setMsg($('#prog-msg'), e.message, false); }
  };
}

/* ——— Tags ——— */
function renderTagsPanel(fromPoll) {
  if (!dash) return;
  const live = liveMap();
  const tags = dash.tags || [];

  if ($('#tags-panel') && fromPoll) {
    const mode = $('#tags-panel').dataset.mode || 'table';
    if (mode === 'json') return;
    renderTagsBody(tags, live, mode);
    return;
  }

  if (!$('#tags-panel')) {
    mount(`
      <section class="panel" id="tags-panel">
        <h2>Tags <span class="muted">(${tags.length})</span></h2>
        <div class="toolbar">
          <button type="button" class="btn btn-ghost" id="tags-export">Export tags</button>
          <button type="button" class="btn btn-ghost" id="tags-import-btn">Import tags</button>
          <input type="file" id="tags-import-file" accept=".json,application/json" hidden>
          <button type="button" class="btn" id="tags-apply">Apply tags</button>
          <button type="button" class="btn btn-ghost" id="tags-table">Table / JSON</button>
        </div>
        <div id="tags-view"></div>
        <pre id="tags-msg" class="msg"></pre>
      </section>
    `);

    $('#tags-export').onclick = () => downloadJson('tags.json', dash.tags || []);
    $('#tags-import-btn').onclick = () => $('#tags-import-file').click();
    $('#tags-import-file').onchange = () => readJsonFile($('#tags-import-file'), (arr) => {
      if (!Array.isArray(arr)) { alert('Expected JSON array of tags'); return; }
      if ($('#tags-json')) $('#tags-json').value = JSON.stringify(arr, null, 2);
      else renderTagsJsonEditor(arr);
      tagsDirty = true;
      setMsg($('#tags-msg'), 'Imported — click Apply tags.', true);
    });
    $('#tags-apply').onclick = async () => {
      try {
        let list;
        if ($('#tags-json')) {
          list = JSON.parse($('#tags-json').value);
        } else {
          list = dash.tags;
        }
        if (!Array.isArray(list)) throw new Error('Tags must be a JSON array');
        await api.putTags(list);
        tagsDirty = false;
        setMsg($('#tags-msg'), 'Tags applied.', true);
        await refreshDash();
      } catch (e) { setMsg($('#tags-msg'), e.message, false); }
    };
    $('#tags-table').onclick = () => {
      const mode = $('#tags-panel').dataset.mode === 'json' ? 'table' : 'json';
      $('#tags-panel').dataset.mode = mode;
      renderTagsBody(tags, live, mode);
    };
  }

  const mode = $('#tags-panel').dataset.mode || 'table';
  renderTagsBody(tags, live, mode);
}

function renderTagsJsonEditor(arr) {
  const view = $('#tags-view');
  view.innerHTML = `<textarea id="tags-json" spellcheck="false"></textarea>`;
  $('#tags-json').value = JSON.stringify(arr, null, 2);
  $('#tags-json').oninput = () => { tagsDirty = true; };
}

function renderTagsBody(tags, live, mode) {
  const view = $('#tags-view');
  if (mode === 'json') {
    view.innerHTML = `<textarea id="tags-json" spellcheck="false"></textarea>`;
    $('#tags-json').value = JSON.stringify(tags, null, 2);
    $('#tags-json').oninput = () => { tagsDirty = true; };
    return;
  }
  const rows = tags.map((t) => {
    const lv = live.get(t.id);
    const val = lv?.value !== undefined ? lv.value : t.value;
    return `<tr>
      <td>${escapeHtml(t.id)}</td>
      <td>${escapeHtml(t.type)}</td>
      <td>${escapeHtml(t.role)}</td>
      <td class="live-val">${escapeHtml(JSON.stringify(val))}</td>
    </tr>`;
  }).join('');
  view.innerHTML = `<table class="data"><thead><tr><th>ID</th><th>Type</th><th>Role</th><th>Live</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/* ——— Drivers ——— */
async function renderDriversPanel() {
  if (!dash) await refreshDash();
  let presets = [];
  try {
    const r = await api.listDevicePresets();
    presets = r.presets || [];
  } catch { /* ignore */ }

  const drivers = dash?.drivers || [];
  const presetOpts = presets.map((p) =>
    `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label || p.id)}</option>`
  ).join('');

  mount(`
    <section class="panel">
      <h2>Drivers</h2>
      <p class="muted"><strong>Production:</strong> OpenWrt + C++ <code>sdk/</code> (<code>MV_PORT=3090</code>) — see <code>docs/OPENWRT.md</code>. <strong>Pi bench:</strong> SM-I-001 HAL in <code>hal/plugins/</code> (<code>make sm_i001</code>, <code>npm run build-native</code>).</p>
      <div class="toolbar">
        <button type="button" class="btn btn-ghost" id="drv-export">Export drivers</button>
        <button type="button" class="btn btn-ghost" id="drv-import-btn">Import drivers</button>
        <input type="file" id="drv-import-file" accept=".json,application/json" hidden>
        <button type="button" class="btn" id="drv-apply">Apply drivers</button>
        <select id="drv-preset"><option value="">— device preset —</option>${presetOpts}</select>
        <button type="button" class="btn btn-ghost" id="drv-preset-go">Apply preset</button>
      </div>
      <textarea id="drv-json" spellcheck="false">${escapeHtml(JSON.stringify(drivers, null, 2))}</textarea>
      <pre id="drv-msg" class="msg"></pre>
      <h3>Health</h3>
      <pre id="drv-health">${escapeHtml(JSON.stringify(dash?.driverHealth || {}, null, 2))}</pre>
    </section>
  `);

  $('#drv-json').oninput = () => { driversDirty = true; };
  $('#drv-export').onclick = () => {
    try {
      downloadJson('drivers.json', JSON.parse($('#drv-json').value));
    } catch (e) { alert(e.message); }
  };
  $('#drv-import-btn').onclick = () => $('#drv-import-file').click();
  $('#drv-import-file').onchange = () => readJsonFile($('#drv-import-file'), (arr) => {
    if (!Array.isArray(arr)) { alert('Expected JSON array'); return; }
    $('#drv-json').value = JSON.stringify(arr, null, 2);
    driversDirty = true;
    setMsg($('#drv-msg'), 'Imported — click Apply drivers.', true);
  });
  $('#drv-apply').onclick = async () => {
    try {
      const drivers = JSON.parse($('#drv-json').value);
      const r = await api.putDrivers(drivers);
      driversDirty = false;
      const warn = (r.warnings || []).join('\n');
      setMsg($('#drv-msg'), warn || 'Drivers applied.', !warn);
      await refreshDash();
      renderDriversPanel();
    } catch (e) { setMsg($('#drv-msg'), e.message, false); }
  };
  $('#drv-preset-go').onclick = async () => {
    const id = $('#drv-preset').value;
    if (!id) return;
    try {
      await api.applyDevicePreset({ presetId: id });
      setMsg($('#drv-msg'), `Preset ${id} applied.`, true);
      await refreshDash();
      renderDriversPanel();
    } catch (e) { setMsg($('#drv-msg'), e.message, false); }
  };
}

/* ——— I/O Map ——— */
function formatIoValue(point) {
  if (!point) return '—';
  const forced = point.forceInput || point.forceOutput;
  let text;
  if (point.type === 'BOOL') text = point.value ? 'ON' : 'OFF';
  else if (typeof point.value === 'number') {
    text = Number.isInteger(point.value) ? String(point.value) : point.value.toFixed(3);
  } else {
    text = String(point.value ?? '—');
  }
  if (forced && point.logicValue !== undefined) {
    const logic = point.type === 'BOOL'
      ? (point.logicValue ? 'ON' : 'OFF')
      : String(point.logicValue);
    return `${text} (logic ${logic})`;
  }
  return text;
}

function renderIoPoints(data) {
  const host = $('#io-map-panel');
  if (!host) return;
  const runtime = data?.runtime || {};
  const points = data?.points || [];
  host.classList.toggle('io-stopped', !runtime.running);

  if (!points.length) {
    host.innerHTML = '<p class="program-io-empty">No input or output tags. Add I/O tags in the Tags tab and wire drivers here.</p>';
    return;
  }

  const expIo = window.MooreviewExpansionIo || {};
  const { base, bySlot } = expIo.partitionIoTags?.(points) || { base: points, bySlot: new Map() };
  const slots = [...bySlot.keys()].sort((a, b) => a - b);
  const hasExpansion = slots.length > 0;

  const mkPoint = (point) => {
    const forced = point.forceInput || point.forceOutput;
    const isBool = point.type === 'BOOL';
    const on = isBool && !!point.value;
    const highlight = runtime.running && !runtime.paused && on;
    const selected = point.id === selectedIoId ? ' io-map-selected' : '';
    return `<div class="io-point ${isBool ? 'digital' : 'analog'}${isBool ? (highlight ? ' on' : ' off') : ''}${forced ? ' forced' : ''}${selected}"
      data-io-id="${escapeHtml(point.id)}" role="button" tabindex="0">
      <span class="io-name">${escapeHtml(point.label || point.id)}</span>
      <span class="io-tag-id">${escapeHtml(point.id)}</span>
      <span class="io-role">${escapeHtml(point.role)}${point.driverId ? ` · ${escapeHtml(point.driverId)}` : ''}</span>
      <span class="io-val">${escapeHtml(formatIoValue(point))}</span>
      ${forced ? '<span class="io-force-badge">FORCED</span>' : ''}
    </div>`;
  };

  const renderGroup = (groupPoints, opts = {}) => {
    const { sectionTitle = '', flat = false } = opts;
    if (!groupPoints.length) return '';
    const block = `<div class="program-io-digital io-map-grid">${groupPoints.map(mkPoint).join('')}</div>`;
    if (flat) return block;
    return `<div class="program-io-section"><h3>${escapeHtml(sectionTitle)}</h3>${block}</div>`;
  };

  let html = renderGroup(base, hasExpansion && base.length
    ? { sectionTitle: 'On-board I/O' }
    : { flat: true });
  for (const slot of slots) {
    const slotPoints = bySlot.get(slot) || [];
    const title = expIo.expansionSectionTitle?.(slot, slotPoints) || `Expansion ${slot}`;
    html += renderGroup(slotPoints, { sectionTitle: title });
  }
  host.innerHTML = html;

  host.querySelectorAll('[data-io-id]').forEach((el) => {
    el.onclick = () => {
      selectedIoId = el.dataset.ioId;
      host.querySelectorAll('[data-io-id]').forEach((n) => n.classList.remove('io-map-selected'));
      el.classList.add('io-map-selected');
      renderIoWirePanel(data);
    };
  });
}

function renderIoWirePanel(data) {
  const body = $('#io-wire-body');
  if (!body) return;
  if (!selectedIoId) {
    body.innerHTML = '<p class="muted">Select an I/O point to wire a driver.</p>';
    return;
  }
  const point = (data?.points || []).find((p) => p.id === selectedIoId);
  const wired = (data?.wiredTags || []).find((t) => t.id === selectedIoId);
  const driverOpts = (data?.drivers || []).map((d) =>
    `<option value="${escapeHtml(d.id)}" ${(wired?.driverId || point?.driverId) === d.id ? 'selected' : ''}>${escapeHtml(d.id)} (${escapeHtml(d.type)})</option>`
  ).join('');
  const mirrorOpts = (data?.wiredTags || [])
    .filter((t) => t.id !== selectedIoId && t.driverId)
    .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.id)} → ${escapeHtml(t.driverId)}</option>`)
    .join('');
  const addr = wired?.driverAddress || {};
  body.innerHTML = `
    <p><strong>${escapeHtml(selectedIoId)}</strong></p>
    <label>Driver
      <select id="io-wire-driver"><option value="">— none —</option>${driverOpts}</select>
    </label>
    <label>Device ID <input type="text" id="io-wire-device" value="${escapeHtml(addr.deviceId || '')}"></label>
    <label>Field <input type="text" id="io-wire-field" value="${escapeHtml(addr.field || '')}"></label>
    <label>Mirror from wired tag
      <select id="io-wire-mirror"><option value="">— manual —</option>${mirrorOpts}</select>
    </label>
    <button type="button" class="btn" id="io-wire-save">Apply wiring</button>
    <pre id="io-wire-msg" class="msg"></pre>
  `;
  $('#io-wire-save').onclick = async () => {
    try {
      const mirrorFrom = $('#io-wire-mirror').value;
      const bodyReq = mirrorFrom
        ? { mirrorFromTagId: mirrorFrom }
        : {
          driverId: $('#io-wire-driver').value || undefined,
          driverAddress: {
            deviceId: $('#io-wire-device').value.trim(),
            field: $('#io-wire-field').value.trim(),
          },
        };
      await api.patchIoMapTag(selectedIoId, bodyReq);
      setMsg($('#io-wire-msg'), 'Wiring saved.', true);
      await refreshIoMap(false);
      await refreshDash();
    } catch (e) { setMsg($('#io-wire-msg'), e.message, false); }
  };
}

function renderIoMapPanel() {
  mount(`
    <section class="panel" id="iomap-panel">
      <h2>I/O Map</h2>
      <p class="muted">Input and output tags with live values. Select a point to wire driver I/O — hardware agnostic, no HMI bindings.</p>
      <div class="io-map-layout">
        <div id="io-map-panel" class="program-io-panel"><p class="program-io-empty">Loading…</p></div>
        <aside class="io-wire-panel" aria-label="Driver wiring">
          <h3>Wiring</h3>
          <div id="io-wire-body"><p class="muted">Select an I/O point.</p></div>
        </aside>
      </div>
      <pre id="iomap-msg" class="msg"></pre>
    </section>
  `);
  refreshIoMap(false);
  if (ioPollTimer) clearInterval(ioPollTimer);
  ioPollTimer = setInterval(() => refreshIoMap(true), 800);
}

async function refreshIoMap(fromPoll) {
  try {
    ioMapData = await api.getIoMap();
    if (fromPoll && activeTab === 'iomap' && $('#io-map-panel')?.querySelector('[data-io-id]')) {
      const points = ioMapData.points || [];
      const byId = new Map(points.map((p) => [p.id, p]));
      $('#io-map-panel').querySelectorAll('[data-io-id]').forEach((el) => {
        const point = byId.get(el.dataset.ioId);
        if (!point) return;
        const valEl = el.querySelector('.io-val');
        if (valEl) valEl.textContent = formatIoValue(point);
        if (point.type === 'BOOL') {
          const on = !!point.value;
          const highlight = ioMapData.runtime?.running && !ioMapData.runtime?.paused && on;
          el.classList.toggle('on', highlight);
          el.classList.toggle('off', !highlight);
        }
      });
      return;
    }
    renderIoPoints(ioMapData);
    renderIoWirePanel(ioMapData);
  } catch (e) {
    setMsg($('#iomap-msg'), e.message, false);
  }
}

/* ——— Runtime mini controls ——— */
function bindRuntimeControls() {
  $('#rt-start').onclick = async () => {
    try {
      await api.runtimeStart();
      await refreshDash();
      if (activeTab === 'iomap') await refreshIoMap(false);
    } catch (e) { alert(e.message); }
  };
  $('#rt-stop').onclick = async () => {
    try {
      await api.runtimeStop();
      await refreshDash();
      if (activeTab === 'iomap') await refreshIoMap(false);
    } catch (e) { alert(e.message); }
  };
}

/* ——— Router ——— */
function onHash() {
  const tab = (location.hash.slice(1) || 'program').split('/')[0];
  if (['program', 'tags', 'drivers', 'iomap'].includes(tab)) setTab(tab);
  else setTab('program');
}

window.addEventListener('hashchange', onHash);
window.addEventListener('beforeunload', (e) => {
  if (programDirty || tagsDirty || driversDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

bindRuntimeControls();
startPoll();
onHash();
