'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let dash = null;
let pollTimer = null;
let projectName = 'project';
let activeTab = 'project';
let programDirty = false;
let tagsDirty = false;
let driversDirty = false;

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
    projectName = dash.settings?.project?.name || dash.project?.name || projectName;
    updateBadge();
    if (activeTab === 'tags') renderTagsPanel(true);
    if (activeTab === 'runtime') renderRuntimePanel(true);
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
  if (name === 'project') renderProjectPanel();
  else if (name === 'program') renderProgramPanel();
  else if (name === 'tags') renderTagsPanel();
  else if (name === 'drivers') renderDriversPanel();
  else if (name === 'runtime') renderRuntimePanel();
}

function mount(html) {
  $('#app').innerHTML = html;
}

/* ——— Project ——— */
async function renderProjectPanel() {
  let projects = [];
  try {
    const r = await api.listProjects();
    projects = r.projects || [];
  } catch { /* ignore */ }

  const options = projects.map((p) =>
    `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name || p.id)}</option>`
  ).join('');

  mount(`
    <section class="panel">
      <h2>Project</h2>
      <p class="muted">Portable <code>.est</code> files contain tags, drivers, program, and settings.</p>
      <div class="toolbar">
        <label>Project name <input type="text" id="proj-name" value="${escapeHtml(projectName)}" size="20"></label>
        <button type="button" class="btn" id="proj-new">New project</button>
        <button type="button" class="btn" id="proj-open-est">Open .est</button>
        <input type="file" id="proj-est-file" accept=".est,.json,application/json" hidden>
        <button type="button" class="btn" id="proj-save-est">Save .est</button>
        <button type="button" class="btn btn-ghost" id="proj-workspace">Save workspace</button>
        <button type="button" class="btn btn-ghost" id="proj-save-lib">Save to library</button>
      </div>
      <div class="toolbar">
        <select id="proj-lib"><option value="">— open from library —</option>${options}</select>
        <button type="button" class="btn btn-ghost" id="proj-open-lib">Open</button>
        <button type="button" class="btn btn-danger" id="proj-del-lib">Delete</button>
      </div>
      <pre id="proj-msg" class="msg"></pre>
    </section>
  `);

  $('#proj-new').onclick = async () => {
    const name = $('#proj-name').value.trim() || 'untitled';
    try {
      await api.newProject(name);
      projectName = name;
      setMsg($('#proj-msg'), `New project "${name}" loaded.`, true);
      await refreshDash();
    } catch (e) { setMsg($('#proj-msg'), e.message, false); }
  };

  $('#proj-open-est').onclick = () => $('#proj-est-file').click();
  $('#proj-est-file').onchange = () => readJsonFile($('#proj-est-file'), async (doc) => {
    try {
      const r = await api.openEst(doc);
      projectName = r.project?.name || doc.project?.name || projectName;
      $('#proj-name').value = projectName;
      setMsg($('#proj-msg'), `Opened .est — ${r.tagCount} tags, ${r.driverCount} drivers.`, true);
      programDirty = false;
      await refreshDash();
      renderProgramPanel();
    } catch (e) { setMsg($('#proj-msg'), e.message, false); }
  });

  $('#proj-save-est').onclick = async () => {
    const name = $('#proj-name').value.trim() || projectName;
    try {
      const blob = await api.saveEstBlob(name);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${name.replace(/[^\w.-]+/g, '_')}.est`;
      a.click();
      setMsg($('#proj-msg'), 'Downloaded .est file.', true);
    } catch (e) { setMsg($('#proj-msg'), e.message, false); }
  };

  $('#proj-workspace').onclick = async () => {
    const name = $('#proj-name').value.trim() || projectName;
    try {
      await api.saveWorkspace({ name });
      setMsg($('#proj-msg'), 'Workspace saved on device.', true);
    } catch (e) { setMsg($('#proj-msg'), e.message, false); }
  };

  $('#proj-save-lib').onclick = async () => {
    const name = $('#proj-name').value.trim() || projectName;
    try {
      const r = await api.saveProject(name);
      setMsg($('#proj-msg'), `Saved to library (${r.id}).`, true);
      renderProjectPanel();
    } catch (e) { setMsg($('#proj-msg'), e.message, false); }
  };

  $('#proj-open-lib').onclick = async () => {
    const id = $('#proj-lib').value;
    if (!id) return;
    try {
      const r = await api.openProject(id);
      projectName = r.project?.name || projectName;
      $('#proj-name').value = projectName;
      setMsg($('#proj-msg'), 'Opened from library.', true);
      await refreshDash();
    } catch (e) { setMsg($('#proj-msg'), e.message, false); }
  };

  $('#proj-del-lib').onclick = async () => {
    const id = $('#proj-lib').value;
    if (!id || !confirm('Delete this saved project?')) return;
    try {
      await api.deleteProject(id);
      setMsg($('#proj-msg'), 'Deleted.', true);
      renderProjectPanel();
    } catch (e) { setMsg($('#proj-msg'), e.message, false); }
  };
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

/* ——— Runtime ——— */
function renderRuntimePanel(fromPoll) {
  if (!dash) return;
  const rt = dash.runtime || {};
  const scanMs = dash.settings?.scanMs ?? 100;

  if ($('#rt-panel') && fromPoll) {
    $('#rt-status').textContent = JSON.stringify(rt, null, 2);
    return;
  }

  if (!$('#rt-panel')) {
    mount(`
      <section class="panel" id="rt-panel">
        <h2>Runtime</h2>
        <div class="toolbar">
          <button type="button" class="btn" id="rt-start">Start</button>
          <button type="button" class="btn btn-ghost" id="rt-pause">Pause</button>
          <button type="button" class="btn btn-ghost" id="rt-resume">Resume</button>
          <button type="button" class="btn btn-danger" id="rt-stop">Stop</button>
          <label>Scan ms <input type="number" id="rt-scan" min="10" max="10000" value="${scanMs}"></label>
          <button type="button" class="btn btn-ghost" id="rt-scan-save">Apply scan</button>
        </div>
        <pre id="rt-status"></pre>
        <pre id="rt-msg" class="msg"></pre>
      </section>
    `);

    $('#rt-start').onclick = async () => {
      try {
        await api.runtimeStart();
        setMsg($('#rt-msg'), 'Running.', true);
        await refreshDash();
      } catch (e) { setMsg($('#rt-msg'), e.message, false); }
    };
    $('#rt-pause').onclick = () => api.runtimePause().then(refreshDash);
    $('#rt-resume').onclick = () => api.runtimeResume().then(refreshDash);
    $('#rt-stop').onclick = () => api.runtimeStop().then(refreshDash);
    $('#rt-scan-save').onclick = async () => {
      try {
        await api.putSettings({ scanMs: +$('#rt-scan').value });
        setMsg($('#rt-msg'), 'Scan interval saved.', true);
        await refreshDash();
      } catch (e) { setMsg($('#rt-msg'), e.message, false); }
    };
  }

  $('#rt-status').textContent = JSON.stringify(rt, null, 2);
  if ($('#rt-scan')) $('#rt-scan').value = scanMs;
}

/* ——— Help ——— */
function initHelp() {
  const dialog = $('#help-dialog');
  const nav = $('#help-nav');
  const body = $('#help-body');
  const topics = window.ST_MVP_HELP || [];

  nav.innerHTML = topics.map((t, i) =>
    `<button type="button" data-i="${i}" class="${i === 0 ? 'active' : ''}">${escapeHtml(t.title)}</button>`
  ).join('');

  function show(i) {
    const t = topics[i];
    if (!t) return;
    $('#help-title').textContent = t.title;
    body.innerHTML = t.html;
    $$('#help-nav button').forEach((b, j) => b.classList.toggle('active', j === i));
  }

  nav.onclick = (e) => {
    const btn = e.target.closest('button[data-i]');
    if (btn) show(+btn.dataset.i);
  };

  $('#btn-help').onclick = () => { show(0); dialog.showModal(); };
  $('#help-close').onclick = () => dialog.close();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') { e.preventDefault(); show(0); dialog.showModal(); }
  });
}

/* ——— Router ——— */
function onHash() {
  const tab = (location.hash.slice(1) || 'project').split('/')[0];
  if (['project', 'program', 'tags', 'drivers', 'runtime'].includes(tab)) setTab(tab);
  else setTab('project');
}

window.addEventListener('hashchange', onHash);
window.addEventListener('beforeunload', (e) => {
  if (programDirty || tagsDirty || driversDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

initHelp();
startPoll();
onHash();
