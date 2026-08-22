'use strict';

/** ST program editor, library, and scan runtime controls */
window.MooreviewProgram = (function () {
  const { $, esc, on, onChange } = window.MooreviewCore;

  let deps = null;
  let programActivePath = '';
  let programStDir = '';
  let programEditLock = false;
  let programLoadGuardUntil = 0;
  let programTagRefs = [];
  let programCatalog = [];
  let programLoading = false;
  let stEditor = null;

  const ST_NEW_TEMPLATE = '(* New ST program — edit and Save program *)\nIF IsON(DI) THEN TurnON(Q); END_IF;\n';

  function d() {
    return deps;
  }

  function programIoTagList() {
    const tags = d().getTags();
    const refSet = new Set(programTagRefs);
    const list = refSet.size
      ? tags.filter((t) => refSet.has(t.id))
      : tags.filter((t) => t.type === 'BOOL' || t.type === 'INT' || t.type === 'REAL' || t.type === 'PID' || t.type === 'AVG');
    return list.sort((a, b) => {
      const order = { BOOL: 0, INT: 1, REAL: 2 };
      const ta = order[a.type] ?? 9;
      const tb = order[b.type] ?? 9;
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });
  }

  function formatIoTagName(tag) {
    const fmt = window.MooreviewTagDisplay?.formatTag;
    return fmt ? fmt(tag, d().getTags()) : tag.id;
  }

  function formatIoTagSub(tag) {
    const fmt = window.MooreviewTagDisplay?.formatTagSub;
    return fmt ? fmt(tag, d().getTags()) : '';
  }

  function renderProgramTagLegend() {
    const host = $('program-tag-legend');
    if (!host) return;
    const tags = d().getTags();
    const refs = programTagRefs.length ? programTagRefs : programIoTagList().map((t) => t.id);
    if (!refs.length) {
      host.innerHTML = '';
      host.classList.add('view-hidden');
      return;
    }
    host.classList.remove('view-hidden');
    const fmt = window.MooreviewTagDisplay?.formatTag || ((t) => t.id || t);
    const rows = refs.map((id) => {
      const tag = tags.find((t) => t.id === id) || { id, label: '' };
      const main = esc(fmt(tag, tags));
      const sub = formatIoTagSub(tag);
      return `<span class="program-tag-chip" title="${esc(tag.id)}${tag.label ? ` — ${esc(tag.label)}` : ''}">${main}${sub ? `<span class="muted"> · ${esc(sub)}</span>` : ''}</span>`;
    }).join('');
    host.innerHTML = `<span class="muted program-tag-legend-label">Program tags:</span> ${rows}`;
  }

  function isLiveIoPanelOpen() {
    const chrome = document.getElementById('live-io-chrome');
    return chrome && !chrome.classList.contains('view-hidden');
  }

  function renderProgramIoPanel(live, runtime) {
    const host = $('program-io-panel');
    const hint = $('program-io-hint');
    if (!host) return;
    if (!isLiveIoPanelOpen()) return;
    const scanActive = d().runtimeScanActive(runtime);
    host.classList.toggle('io-stopped', !scanActive);
    if (hint) {
      hint.textContent = !runtime?.running
        ? '(stopped — last values shown)'
        : (runtime.paused ? '(paused — values frozen)' : '(runtime active)');
    }
    const list = programIoTagList();
    const digital = list.filter((t) => t.type === 'BOOL');
    const analog = list.filter((t) => t.type === 'INT' || t.type === 'REAL' || t.type === 'PID' || t.type === 'AVG');
    if (!list.length) {
      host.innerHTML = '<p class="program-io-empty">No tags in program. Apply a valid ST file that references DI, Q, AI, etc.</p>';
      return;
    }
    const mkDigital = (tag) => {
      const entry = d().liveEntryFor(tag.id, live);
      const on = d().isDigitalOn(entry);
      const highlight = scanActive && on;
      const forced = entry && (entry.forceInput || entry.forceOutput);
      return `<div class="io-point digital ${highlight ? 'on' : 'off'}${forced ? ' forced' : ''}" data-io="${esc(tag.id)}" data-io-type="BOOL">
        <span class="io-name">${esc(formatIoTagName(tag))}</span>
        ${formatIoTagSub(tag) ? `<span class="io-tag-id muted">${esc(formatIoTagSub(tag))}</span>` : ''}
        <span class="io-role">${esc(tag.role)}</span>
        <span class="io-val" data-io-val>${esc(d().formatIoValue(entry))}</span>
        ${forced ? '<span class="io-force-badge">FORCED</span>' : ''}
      </div>`;
    };
    const mkAnalog = (tag) => {
      const entry = d().liveEntryFor(tag.id, live);
      const forced = entry && (entry.forceInput || entry.forceOutput);
      return `<div class="io-point analog${forced ? ' forced' : ''}" data-io="${esc(tag.id)}" data-io-type="${esc(tag.type)}">
        <span class="io-name">${esc(formatIoTagName(tag))}</span>
        ${formatIoTagSub(tag) ? `<span class="io-tag-id muted">${esc(formatIoTagSub(tag))}</span>` : ''}
        <span class="io-role">${esc(tag.type)} · ${esc(tag.role)}</span>
        <span class="io-val" data-io-val>${esc(d().formatIoValue(entry))}</span>
        ${forced ? '<span class="io-force-badge">FORCED</span>' : ''}
      </div>`;
    };
    host.innerHTML = `
      ${digital.length ? `<div class="program-io-section"><h3>Digital</h3><div class="program-io-digital">${digital.map(mkDigital).join('')}</div></div>` : ''}
      ${analog.length ? `<div class="program-io-section"><h3>Analog (INT / REAL)</h3><div class="program-io-digital">${analog.map(mkAnalog).join('')}</div></div>` : ''}`;
    renderProgramTagLegend();
  }

  function isProgramPopupOpen() {
    const chrome = document.getElementById('program-chrome');
    return chrome && !chrome.classList.contains('view-hidden');
  }

  function updateProgramTrace(trace, runtime) {
    if (!isProgramPopupOpen() || !stEditor || stEditor.isDirty()) {
      if (stEditor?.isDirty()) stEditor.clearTrace();
      return;
    }
    const hasTrace = Array.isArray(trace) && trace.length > 0;
    const active = hasTrace && (d().runtimeScanActive(runtime) || !!runtime?.programOk);
    try {
      stEditor.setTrace(trace || [], active);
    } catch (e) {
      console.error('program trace overlay', e);
      stEditor.clearTrace();
    }
  }

  function updateProgramIoLive(live, runtime) {
    if (!isLiveIoPanelOpen()) return;
    const host = $('program-io-panel');
    if (!host || !host.querySelector('[data-io]')) {
      renderProgramIoPanel(live, runtime);
      return;
    }
    const tags = d().getTags();
    const scanActive = d().runtimeScanActive(runtime);
    host.classList.toggle('io-stopped', !scanActive);
    host.querySelectorAll('[data-io]').forEach((el) => {
      const id = el.dataset.io;
      const tag = tags.find((x) => x.id === id);
      const entry = d().liveEntryFor(id, live);
      if (!tag || !entry) return;
      const forced = entry.forceInput || entry.forceOutput;
      el.classList.toggle('forced', forced);
      if (entry.type === 'BOOL') {
        const on = d().isDigitalOn(entry);
        const highlight = scanActive && on;
        el.classList.toggle('on', highlight);
        el.classList.toggle('off', !highlight);
      }
      const valEl = el.querySelector('[data-io-val]');
      if (valEl) valEl.textContent = d().formatIoValue(entry);
      let badge = el.querySelector('.io-force-badge');
      if (forced && !badge) {
        badge = document.createElement('span');
        badge.className = 'io-force-badge';
        badge.textContent = 'FORCED';
        el.appendChild(badge);
      } else if (!forced && badge) {
        badge.remove();
      }
    });
    const hint = $('program-io-hint');
    if (hint) {
      hint.textContent = !runtime?.running
        ? '(stopped — last values shown)'
        : (runtime.paused ? '(paused — values frozen)' : '(runtime active)');
    }
  }

  async function syncProgramTagRefs() {
    const src = $('program-src')?.value ?? '';
    if (!src.trim()) {
      programTagRefs = [];
      renderProgramTagLegend();
      scheduleDeployEstimate();
      return;
    }
    try {
      const r = await api.validateProgram(src);
      programTagRefs = r.programTags || [];
    } catch {
      programTagRefs = [];
    }
    renderProgramTagLegend();
    scheduleDeployEstimate();
  }

  function updateProgramFolderLabel(stDir, active) {
    const el = $('program-folder');
    if (!el) return;
    const dir = stDir || programStDir;
    if (!dir) {
      el.textContent = '';
      return;
    }
    el.textContent = active
      ? `Programs folder: ${dir} · active: ${active}`
      : `Programs folder: ${dir}`;
  }

  function applyProgramToEditor(r) {
    const prog = $('program-src');
    const errEl = $('program-errors');
    if (!prog) return;
    programActivePath = r.active || programActivePath;
    if (stEditor) {
      stEditor.setValue(r.source || '', { clean: true });
      stEditor.setActivePath(programActivePath);
      stEditor.setBaseline(r.source || '');
    } else {
      prog.value = r.source || '';
      prog.dataset.dirty = '';
    }
    programEditLock = false;
    programLoadGuardUntil = Date.now() + 2500;
    updateProgramFolderLabel(r.stDir || programStDir, r.active);
    if ($('program-active')) $('program-active').textContent = r.active ? `Active: ${r.active}` : '';
    if (r.active && $('program-library')) {
      const sel = $('program-library');
      sel.dataset.userPick = r.active;
      const opt = [...sel.options].find((o) => o.value === r.active);
      if (opt) sel.value = r.active;
    }
    if (errEl) {
      if (r.errors?.length) {
        errEl.textContent = r.errors.join('; ');
        errEl.className = 'inline-msg err';
      } else {
        errEl.textContent = r.ok === false ? 'Loaded (see validation)' : `Loaded ${r.active || ''}`;
        errEl.className = r.ok === false ? 'inline-msg warn' : 'inline-msg ok';
      }
    }
    scheduleDeployEstimate();
  }

  function programHasFixtureBundle(rel) {
    const norm = String(rel || '').replace(/\\/g, '/');
    return /waveshare/i.test(norm)
      || norm.startsWith('opta/')
      || norm.startsWith('opta-mqtt/')
      || norm.startsWith('mqtt/')
      || norm.startsWith('modbus/')
      || norm.startsWith('logic/');
  }

  async function loadFixturesForSelected() {
    const rel = ($('program-library')?.value || programActivePath || '').trim();
    if (!rel) {
      showProgramError('Select a program in Library first.');
      return null;
    }
    if (!programHasFixtureBundle(rel)) {
      showProgramError(`No fixture bundle for ${rel}.`);
      return null;
    }
    if (!window.confirm(
      `Load fixtures for "${rel}"?\n\nThis replaces all tags and drivers with the st/fixtures/ demo bundle.`
    )) {
      return null;
    }
    try {
      const r = await api.loadProgramFixtures(rel);
      if (r.active) programActivePath = r.active;
      await syncProgramTagRefs();
      renderProgramIoPanel(d().getLastLive(), d().getLastRuntime());
      await d().refreshAll();
      const n = r.fixturesLoaded?.tagCount ?? 0;
      showProgramError(`Fixtures loaded (${n} tags).`);
      $('program-errors').className = 'inline-msg ok';
      return r;
    } catch (e) {
      showProgramError(e.message);
      return null;
    }
  }

  async function createTagsFromProgram() {
    const src = $('program-src')?.value ?? '';
    if (!src.trim()) {
      showProgramError('No program source — load a program first.');
      return null;
    }
    try {
      const r = await api.ensureProgramTags(src);
      const parts = [];
      if (r.added?.length) parts.push(`Added ${r.added.length} tag(s): ${r.added.join(', ')}`);
      if (r.labeled?.length) parts.push(`Labels set: ${r.labeled.join(', ')}`);
      const msg = parts.length ? parts.join('. ') : 'All program tags already exist.';
      showProgramError(msg);
      $('program-errors').className = 'inline-msg ok';
      await syncProgramTagRefs();
      renderProgramIoPanel(d().getLastLive(), d().getLastRuntime());
      await d().refreshAll();
      return r;
    } catch (e) {
      showProgramError(e.message);
      return null;
    }
  }

  async function reloadProgramFromDisk({ force = false } = {}) {
    const rel = programActivePath || $('program-library')?.value || '';
    if (!rel) {
      showProgramError('No active program — select one in Library or Open from st/.');
      return null;
    }
    if (!force && stEditor?.isDirty() && !window.confirm('Discard unsaved edits and reload from disk?')) {
      return null;
    }
    programLoading = true;
    programEditLock = true;
    programLoadGuardUntil = Date.now() + 4000;
    try {
      const r = await api.reloadProgram(rel);
      applyProgramToEditor({ ...r, stDir: r.stDir || programStDir });
      await syncProgramTagRefs();
      renderProgramIoPanel(d().getLastLive(), d().getLastRuntime());
      await d().refreshAll();
      return r;
    } catch (e) {
      showProgramError(e.message);
      return null;
    } finally {
      programLoading = false;
      setTimeout(() => {
        if (!$('program-src')?.matches(':focus')) programEditLock = false;
      }, 300);
    }
  }

  async function clearActiveProgram() {
    const rt = d().getLastRuntime?.() || {};
    if (rt.running && !window.confirm('Stop runtime and clear the active program?')) return null;
    if (stEditor?.isDirty() && !window.confirm('Discard unsaved program edits and clear active program?')) {
      return null;
    }
    programLoading = true;
    programEditLock = true;
    programLoadGuardUntil = Date.now() + 4000;
    try {
      const r = await api.clearActiveProgram();
      programActivePath = '';
      applyProgramToEditor({ ...r, active: '', source: '', stDir: r.stDir || programStDir, ok: true, errors: [] });
      if ($('program-library')) {
        $('program-library').value = '';
        $('program-library').dataset.userPick = '';
      }
      programTagRefs = [];
      renderProgramIoPanel(d().getLastLive(), d().getLastRuntime());
      await d().refreshAll();
      return r;
    } catch (e) {
      showProgramError(e.message);
      return null;
    } finally {
      programLoading = false;
      programEditLock = false;
    }
  }

  async function loadProgramFromServer(path, { refresh = true } = {}) {
    const rel = (path || '').trim();
    if (!rel) {
      showProgramError('Select a program in Library, or use Open from st/.');
      return null;
    }
    if (stEditor?.isDirty() && !window.confirm('Discard unsaved program edits and load from server?')) {
      return null;
    }
    programLoading = true;
    programEditLock = true;
    programLoadGuardUntil = Date.now() + 4000;
    try {
      const r = await api.loadProgram(rel, { loadFixtures: false });
      applyProgramToEditor({ ...r, stDir: r.stDir || programStDir });
      await syncProgramTagRefs();
      renderProgramIoPanel(d().getLastLive(), d().getLastRuntime());
      if (refresh) await d().refreshAll();
      return r;
    } catch (e) {
      showProgramError(e.message);
      return null;
    } finally {
      programLoading = false;
      setTimeout(() => {
        if (!$('program-src')?.matches(':focus')) programEditLock = false;
      }, 300);
    }
  }

  function fillProgramPickerList(programs, selected) {
    const sel = $('program-picker-list');
    if (!sel) return;
    const list = programs || [];
    sel.innerHTML = list.length
      ? list.map((p) => `<option value="${esc(p.path)}">${esc(p.path)}</option>`).join('')
      : '<option value="">(no .st files in st/)</option>';
    const pick = selected && list.some((p) => p.path === selected)
      ? selected
      : ($('program-library')?.value || list[0]?.path || '');
    if (pick) sel.value = pick;
  }

  async function openProgramPicker() {
    const dlg = $('program-picker-dialog');
    if (!dlg) return;
    try {
      const opened = await api.openProgramFolder();
      if (opened?.stDir) {
        programStDir = opened.stDir;
        updateProgramFolderLabel(opened.stDir, programActivePath);
      }
    } catch (e) {
      showProgramError(e.message);
    }
    if (!programCatalog.length) {
      try {
        const r = await api.listPrograms();
        programCatalog = r.programs || [];
        if (r.stDir) programStDir = r.stDir;
        updateProgramFolderLabel(r.stDir, r.active);
      } catch (e) {
        showProgramError(e.message);
        return;
      }
    }
    const dirEl = $('program-picker-dir');
    if (dirEl) {
      dirEl.textContent = programStDir
        ? `Programs in: ${programStDir}`
        : 'Programs folder not configured';
    }
    fillProgramPickerList(programCatalog, $('program-library')?.value || programActivePath);
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  function catalogSignature(list) {
    return (list || []).map((p) => p.path).join('\0');
  }

  function fillProgramLibrary(programs, active) {
    const sel = $('program-library');
    const label = $('program-active');
    if (!sel) return;
    const list = programs || [];

    // Rebuilding while the dropdown is open cancels the click — wait until blur.
    if (document.activeElement === sel) return;

    const sig = catalogSignature(list);
    const prev = sel.value;
    const userPick = sel.dataset.userPick || '';
    const needsRebuild = sel.dataset.catalogSig !== sig || sel.options.length === 0;

    if (needsRebuild) {
      sel.dataset.catalogSig = sig;
      const opts = ['<option value="">(none — no active program)</option>'];
      if (list.length) {
        opts.push(...list.map((p) =>
          `<option value="${esc(p.path)}">${esc(p.category)}/${esc(p.name)}</option>`
        ));
      } else {
        opts.push('<option value="" disabled>(no .st files in st/)</option>');
      }
      sel.innerHTML = opts.join('');
    }

    let pick = '';
    if (userPick && list.some((p) => p.path === userPick)) {
      pick = userPick;
    } else if (prev && list.some((p) => p.path === prev)) {
      pick = prev;
    } else if (active && list.some((p) => p.path === active)) {
      pick = active;
    }
    if (sel.value !== pick) sel.value = pick;
    if (label) label.textContent = active ? `Active: ${active}` : 'No active program';
  }

  function suggestNewStPath() {
    const list = programCatalog || [];
    let n = 1;
    while (list.some((p) => p.path === `logic/new_${n}.st`)) n += 1;
    return `logic/new_${n}.st`;
  }

  function newProgramInEditor() {
    if (stEditor?.isDirty() && !window.confirm('Discard unsaved edits and create a new program?')) {
      return;
    }
    const path = window.prompt('New program path under st/ (e.g. logic/my_prog.st):', suggestNewStPath());
    if (!path) return;
    const rel = path.trim().replace(/\\/g, '/');
    if (!/\.st$/i.test(rel)) {
      showProgramError('Path must end with .st');
      return;
    }
    programActivePath = rel;
    programEditLock = true;
    programLoadGuardUntil = Date.now() + 3000;
    if (stEditor) {
      stEditor.setValue(ST_NEW_TEMPLATE, { clean: false });
      stEditor.markDirty();
      stEditor.setActivePath(rel);
      stEditor.setBaseline('');
    } else {
      const prog = $('program-src');
      if (prog) {
        prog.value = ST_NEW_TEMPLATE;
        prog.dataset.dirty = '1';
      }
    }
    if ($('program-active')) $('program-active').textContent = `New: ${rel} (not saved)`;
    if ($('program-library')) {
      const sel = $('program-library');
      const exists = [...sel.options].some((o) => o.value === rel);
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = rel;
        opt.textContent = rel;
        sel.appendChild(opt);
      }
      sel.value = rel;
    }
    $('program-errors').textContent = 'New program — click Save program to write to st/';
    $('program-errors').className = 'inline-msg warn';
    syncProgramTagRefs().then(() => renderProgramIoPanel(d().getLastLive(), d().getLastRuntime()));
  }

  function suggestStPathFromFile(file) {
    const rel = file.webkitRelativePath || file.name || 'program.st';
    const norm = rel.replace(/\\/g, '/');
    const base = norm.split('/').pop() || 'program.st';
    const name = base.toLowerCase().endsWith('.st') ? base : `${base.replace(/\.[^.]+$/, '') || 'program'}.st`;
    if (norm.includes('/')) {
      const dir = norm.slice(0, norm.lastIndexOf('/'));
      return `${dir}/${name}`;
    }
    return `logic/${name}`;
  }

  function showProgramError(msg) {
    const errEl = $('program-errors');
    if (errEl) {
      errEl.textContent = msg;
      errEl.className = 'inline-msg err';
    } else {
      alert(msg);
    }
  }

  function findOptaRemoteDriver() {
    return (d().getDrivers?.() || []).find(
      (drv) => (drv.type === 'opta_remote' || drv.type === 'mqtt_parc') && drv.enabled !== false
    );
  }

  function parcDeviceForOpta(opta, data) {
    if (!opta) return null;
    const id = String(opta.deviceId || '').trim();
    if (!id) return null;
    const devices = data?.parc?.devices || [];
    return devices.find((dev) => dev.deviceId === id) || null;
  }

  function setProgramRuntimeStatusBar({ badge, detail, badgeClass = 'prog-runtime-badge--stopped' }) {
    const badgeEl = $('prog-runtime-badge');
    const detailEl = $('prog-runtime-detail');
    if (badgeEl) {
      badgeEl.textContent = badge;
      badgeEl.className = `prog-runtime-badge ${badgeClass}`;
    }
    if (detailEl) {
      detailEl.textContent = detail || '';
      detailEl.className = badgeClass.includes('error')
        ? 'prog-runtime-detail err-text cell-mono'
        : 'prog-runtime-detail muted cell-mono';
    }
  }

  function formatDeployKb(bytes) {
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  }

  function renderDeployEstimate(est) {
    const el = $('prog-deploy-estimate');
    if (!el) return;
    if (!est?.remoteApplicable) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'prog-deploy-estimate muted cell-mono';
      return;
    }
    el.hidden = false;
    if (!est.ok) {
      el.textContent = `Opta deploy: invalid — ${(est.errors || ['parse error']).join('; ')}`;
      el.className = 'prog-deploy-estimate err cell-mono';
      return;
    }
    const limitLabel = formatDeployKb(est.limit);
    const bcLabel = formatDeployKb(est.bcTotalBytes || est.bcBytes || 0);
    el.textContent = `Parc deploy: ${bcLabel} / ${limitLabel} bytecode · ${est.tagCount} tags · ${formatDeployKb(est.codeBytes || 0)} code + ${formatDeployKb(est.dataBytes || est.bcBytes || 0)} data (${est.pct}%)`;
    el.title = est.overLimit
      ? (est.bcOverLimit
        ? 'Bytecode exceeds Opta limit — trim program or reduce tag count'
        : 'Wire payload exceeds Opta MQTT/HTTP limit — trim program or reflash Opta firmware')
      : `Bytecode ${bcLabel} · wire ${formatDeployKb(est.wireBytes || est.bytes)} · headroom ${formatDeployKb(Math.max(0, est.headroom))}.`;
    el.className = est.overLimit
      ? 'prog-deploy-estimate err cell-mono'
      : (est.pct >= 80 ? 'prog-deploy-estimate warn cell-mono' : 'prog-deploy-estimate muted cell-mono');
  }

  let deployEstimateTimer = null;
  async function syncDeployEstimate() {
    const opta = findOptaRemoteDriver();
    if (!opta) {
      renderDeployEstimate({ remoteApplicable: false });
      return;
    }
    const src = $('program-src')?.value ?? '';
    if (!src.trim()) {
      renderDeployEstimate({ remoteApplicable: true, ok: true, bytes: 0, astBytes: 0, tagCount: 0, limit: 16384, overLimit: false, headroom: 16384, pct: 0 });
      return;
    }
    try {
      const est = await api.deployEstimate(src, opta.id);
      renderDeployEstimate(est);
    } catch (e) {
      renderDeployEstimate({
        remoteApplicable: true,
        ok: false,
        errors: e.errors?.length ? e.errors : [e.message || 'Estimate failed'],
      });
    }
  }

  function scheduleDeployEstimate() {
    clearTimeout(deployEstimateTimer);
    deployEstimateTimer = setTimeout(() => { syncDeployEstimate(); }, 450);
  }

  function updateProgramRemoteUi(data) {
    const remoteCb = $('prog-remote-exec');
    const connectBtn = $('btn-remote-connect');
    const disconnectBtn = $('btn-remote-disconnect');
    const ioViewBtn = $('btn-prog-opta-io-view');
    const ctCalBtn = $('btn-prog-opta-ct-cal');
    const statusEl = $('prog-remote-status');
    if (!remoteCb) return;

    const settings = data?.settings || d().getLastSettings?.() || {};
    const runtime = data?.runtime || d().getLastRuntime?.() || {};
    const remoteOn = settings.remoteExecution === true;
    if (document.activeElement !== remoteCb) remoteCb.checked = remoteOn;

    const opta = findOptaRemoteDriver();
    const healthMap = data?.driverHealth
      ? Object.fromEntries((data.driverHealth || []).map((h) => [h.id, h]))
      : (d().getDriverHealthMap?.() || {});
    const health = opta ? healthMap[opta.id] : null;
    const connected = !!health?.connected;
    const running = !!runtime.running;
    const parcDev = parcDeviceForOpta(opta, data);
    const programError = String(parcDev?.runtime?.programError || '').trim();
    const programName = parcDev?.runtime?.programName || parcDev?.name || '';

    // Connect/Disconnect always visible when an Opta remote driver exists (not only when Remote is on).
    const showOptaLink = !!opta;
    if (connectBtn) {
      connectBtn.hidden = !showOptaLink;
      connectBtn.disabled = !showOptaLink || connected || running;
    }
    if (disconnectBtn) {
      disconnectBtn.hidden = !showOptaLink;
      disconnectBtn.disabled = !showOptaLink || !connected || running;
    }
    if (ioViewBtn) {
      const host = opta ? d().optaHttpHostForDriver?.(opta) : '';
      ioViewBtn.hidden = !showOptaLink;
      ioViewBtn.disabled = !host;
      ioViewBtn.title = host
        ? `Open http://${host}/io-map`
        : 'Wait for Opta telemetry (ethIp) or set host on driver';
    }
    if (ctCalBtn) {
      const host = opta ? d().optaHttpHostForDriver?.(opta) : '';
      ctCalBtn.hidden = !showOptaLink;
      ctCalBtn.disabled = !host;
      ctCalBtn.title = host
        ? `Open http://${host}/ct-cal`
        : 'Wait for Opta telemetry (ethIp) or set host on driver';
    }

    if (statusEl) {
      const link = opta
        ? (opta.type === 'mqtt_parc' ? (opta.deviceId || 'MQTT') : (opta.host || '—'))
        : '';
      if (programError) {
        setProgramRuntimeStatusBar({
          badge: 'Program failed',
          detail: `Opta ${link}: ${programError}`,
          badgeClass: 'prog-runtime-badge--error',
        });
      } else if (!opta) {
        setProgramRuntimeStatusBar({
          badge: running ? 'Running' : 'Stopped',
          detail: remoteOn ? 'Add mqtt_parc driver in Drivers' : '',
          badgeClass: running ? 'prog-runtime-badge--running' : 'prog-runtime-badge--stopped',
        });
      } else if (!remoteOn) {
        setProgramRuntimeStatusBar({
          badge: running ? 'Running' : 'Stopped',
          detail: connected
            ? `Linked ${link} · check Remote to run ST on device`
            : `Not linked (${link}) · Connect, then Remote for ST on Opta`,
          badgeClass: running ? 'prog-runtime-badge--running' : 'prog-runtime-badge--stopped',
        });
      } else if (connected) {
        const runDetail = runtime.remoteScanOnDevice
          ? `ST running on ${link}${programName ? ` · ${programName}` : ''}`
          : `Linked ${link} · deploy with Download & Start`;
        setProgramRuntimeStatusBar({
          badge: runtime.remoteScanOnDevice ? 'Running on Opta' : (running ? 'Running' : 'Stopped'),
          detail: runDetail,
          badgeClass: runtime.remoteScanOnDevice || running
            ? 'prog-runtime-badge--running'
            : 'prog-runtime-badge--stopped',
        });
      } else {
        const err = (health?.message || '').trim();
        setProgramRuntimeStatusBar({
          badge: 'Not linked',
          detail: err
            ? `Opta ${link}: ${err}`
            : `Not linked (${link})`,
          badgeClass: 'prog-runtime-badge--error',
        });
      }
    }
    scheduleDeployEstimate();
    d().updateRuntimeButtons?.(runtime);
  }

  function bindProgramRemoteControls() {
    const remoteCb = $('prog-remote-exec');
    if (remoteCb && !remoteCb._bound) {
      remoteCb._bound = true;
      remoteCb.addEventListener('change', async () => {
        const next = remoteCb.checked;
        const rt = d().getLastRuntime?.() || {};
        if (rt.running) {
          const ok = window.confirm(
            'Stop the runtime before changing Remote mode, then Start again to apply.\n\nStop now?'
          );
          if (!ok) {
            remoteCb.checked = !next;
            return;
          }
          try {
            await api.runtimeStop();
          } catch { /* ignore */ }
        }
        try {
          await api.putSettings({ remoteExecution: next });
          d().patchLastSettings?.({ remoteExecution: next });
          if ($('proj-remote-execution')) $('proj-remote-execution').checked = next;
          if (next && !findOptaRemoteDriver()) {
            alert(
              'Remote is on but no mqtt_parc driver.\n\n'
              + 'Drivers → Device templates → Apply template → Arduino Opta — MQTT Parc ST runtime,\n'
              + 'then Connect before Download & Start.'
            );
          }
          await d().refreshAll();
        } catch (e) {
          remoteCb.checked = !next;
          alert(e.message || 'Could not save remote setting');
        }
      });
    }

    const connect = async () => {
      const opta = findOptaRemoteDriver();
      if (!opta) return alert('No enabled mqtt_parc driver. Apply the Opta MQTT Parc template in Drivers.');
      try {
        await api.connectDriver(opta.id);
        await d().refreshAll();
      } catch (e) {
        alert(e.message || 'Connect failed');
      }
    };

    const disconnect = async () => {
      const opta = findOptaRemoteDriver();
      if (!opta) return;
      try {
        await api.disconnectDriver(opta.id);
        await d().refreshAll();
      } catch (e) {
        alert(e.message || 'Disconnect failed');
      }
    };

    if ($('btn-remote-connect') && !$('btn-remote-connect')._bound) {
      $('btn-remote-connect')._bound = true;
      $('btn-remote-connect').onclick = connect;
    }
    if ($('btn-remote-disconnect') && !$('btn-remote-disconnect')._bound) {
      $('btn-remote-disconnect')._bound = true;
      $('btn-remote-disconnect').onclick = disconnect;
    }
    if ($('btn-prog-opta-io-view') && !$('btn-prog-opta-io-view')._bound) {
      $('btn-prog-opta-io-view')._bound = true;
      $('btn-prog-opta-io-view').onclick = () => {
        const opta = findOptaRemoteDriver();
        if (opta) d().openOptaIoViewForDriver?.(opta);
      };
    }
    if ($('btn-prog-opta-ct-cal') && !$('btn-prog-opta-ct-cal')._bound) {
      $('btn-prog-opta-ct-cal')._bound = true;
      $('btn-prog-opta-ct-cal').onclick = () => {
        const opta = findOptaRemoteDriver();
        if (opta) d().openOptaCtCalForDriver?.(opta);
      };
    }
  }

  function extractUnknownTags(errors, unknownTags) {
    if (Array.isArray(unknownTags) && unknownTags.length) {
      return [...new Set(unknownTags.map((x) => String(x).trim()).filter(Boolean))];
    }
    return [...new Set((errors || [])
      .filter((x) => /^Unknown tag:/i.test(String(x)))
      .map((x) => String(x).replace(/^Unknown tag:\s*/i, '').trim())
      .filter(Boolean))];
  }

  function missingTagsConfirmMessage(unknown, activePath) {
    const ids = unknown.join(', ');
    const motorHint = /motor_hoa/i.test(activePath || '')
      ? '\n\nFor motor_hoa: Load fixtures replaces tags with MOTOR1_* ids (recommended demo).'
      : '';
    return (
      `The program references tag id(s) not in the tag table:\n${ids}\n\n`
      + 'Tag Labels are display names only — ST always uses Tag id (not Label).\n\n'
      + `Create ${unknown.length} missing tag(s) from the program?\n`
      + '(Existing tags like VPI1/VPB1 are unchanged.)'
      + motorHint
    );
  }

  async function createMissingProgramTagsAndStart(src) {
    const created = await api.ensureProgramTags(src);
    await d().refreshAll();
    const put = await api.putProgram(src);
    $('program-src').dataset.dirty = '';
    if (!put.programOk) {
      const still = extractUnknownTags(put.errors, put.unknownTags);
      throw new Error(still.length
        ? `Still missing tags: ${still.join(', ')}`
        : (put.errors?.join('; ') || 'Program validation failed after creating tags'));
    }
    const parts = [];
    if (created.added?.length) parts.push(`Added: ${created.added.join(', ')}`);
    if (created.labeled?.length) parts.push(`Labels: ${created.labeled.join(', ')}`);
    if (parts.length) {
      showProgramError(parts.join(' · '));
      $('program-errors').className = 'inline-msg ok';
    }
    await api.runtimeStart();
    await d().refreshAll();
    showProgramError('Running');
    $('program-errors').className = 'inline-msg ok';
    return true;
  }

  async function offerCreateMissingTagsAndStart(unknown, src, activePath) {
    if (!unknown?.length) return false;
    if (!window.confirm(missingTagsConfirmMessage(unknown, activePath))) return false;
    await createMissingProgramTagsAndStart(src);
    return true;
  }

  function bindRuntimeControls() {
    bindProgramRemoteControls();
    $('btn-start').onclick = async () => {
      const src = $('program-src')?.value ?? '';
      const activePath = programActivePath || $('program-library')?.value || '';
      try {
        const put = await api.putProgram(src);
        $('program-src').dataset.dirty = '';
        if (put.errors?.length) {
          $('program-errors').textContent = put.errors.join('; ');
          $('program-errors').className = 'inline-msg err';
        }
        if (!put.programOk) {
          const unknown = extractUnknownTags(put.errors, put.unknownTags);
          if (await offerCreateMissingTagsAndStart(unknown, src, activePath)) return;
          const msg = put.errors?.length
            ? put.errors.join('; ')
            : 'Program validation failed (unknown tags or syntax). Use Create tags from program or Load fixtures.';
          alert(`Cannot start: ${msg}`);
          return;
        }
        const settings = d().getLastSettings?.() || {};
        if (settings.remoteExecution && !findOptaRemoteDriver()) {
          alert(
            'Remote is on but no mqtt_parc driver.\n\n'
            + 'Drivers → Apply template → Arduino Opta — MQTT Parc ST runtime, then Connect.'
          );
          return;
        }
        await api.runtimeStart();
        await d().refreshAll();
      } catch (e) {
        let msg = e.errors?.length
          ? (e.message || `Program invalid: ${e.errors.join('; ')}`)
          : (e.message || 'Start failed');
        const unknown = extractUnknownTags(e.errors, e.unknownTags);
        try {
          if (await offerCreateMissingTagsAndStart(unknown, src, activePath)) return;
        } catch (e2) {
          msg = e2.message || msg;
        }
        const opta = findOptaRemoteDriver();
        if (opta && (d().getLastSettings?.()?.remoteExecution || $('prog-remote-exec')?.checked)) {
          setProgramRuntimeStatusBar({
            badge: 'Program failed',
            detail: `Opta ${opta.deviceId || opta.id}: ${msg}`,
            badgeClass: 'prog-runtime-badge--error',
          });
        }
        alert(msg);
        showProgramError(msg);
        d().refreshAll().catch(console.error);
      }
    };
    $('btn-pause').onclick = () => api.runtimePause().then(d().refreshAll);
    $('btn-stop').onclick = () => api.runtimeStop().then(d().refreshAll);
  }

  function bindProgramToolbar() {
    bindRuntimeControls();

    on('btn-prog-new', () => newProgramInEditor());
    on('btn-prog-open', () => { openProgramPicker().catch((e) => showProgramError(e.message)); });
    $('program-picker-dialog')?.addEventListener('close', () => {
      const dlg = $('program-picker-dialog');
      if (dlg?.returnValue === 'open') {
        const path = $('program-picker-list')?.value;
        if (path) loadProgramFromServer(path);
      }
    });
    $('program-picker-cancel')?.addEventListener('click', () => {
      $('program-picker-dialog')?.close('cancel');
    });
    on('btn-prog-import', () => $('file-open-st')?.click());
    onChange('file-open-st', (ev) => {
      const f = ev.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const rel = suggestStPathFromFile(f);
        const use = window.prompt('Save opened file under st/ as (relative path):', rel);
        if (!use) return;
        programLoading = true;
        programEditLock = true;
        programLoadGuardUntil = Date.now() + 4000;
        api.importProgram(use.trim(), r.result).then((res) => {
          applyProgramToEditor({ ...res, stDir: res.stDir || programStDir });
          return syncProgramTagRefs().then(() => d().refreshAll());
        }).catch((e) => showProgramError(e.message)).finally(() => {
          programLoading = false;
          setTimeout(() => {
            if (!$('program-src')?.matches(':focus')) programEditLock = false;
          }, 300);
        });
      };
      r.readAsText(f);
      ev.target.value = '';
    });

    on('btn-prog-save', () => {
      const src = $('program-src')?.value ?? '';
      const path = programActivePath || $('program-library')?.value || '';
      if (!path) return showProgramError('No active program path. Load from library or Open program first.');
      api.saveProgram(path, src).then((res) => {
        applyProgramToEditor(res);
        if (stEditor) stEditor.setBaseline(res.source || src);
        $('program-errors').textContent = `Saved to st/${res.active}`;
        $('program-errors').className = 'inline-msg ok';
        return d().refreshAll();
      }).catch((e) => showProgramError(e.message));
    });

    on('btn-prog-save-as', () => {
      const src = $('program-src')?.value ?? '';
      const def = $('program-library')?.value || programActivePath || 'logic/program.st';
      const path = window.prompt('Save under st/ as (relative path, e.g. logic/my_prog.st):', def);
      if (!path) return;
      api.saveProgram(path.trim(), src).then((res) => {
        applyProgramToEditor(res);
        $('program-errors').textContent = `Saved to st/${res.active}`;
        $('program-errors').className = 'inline-msg ok';
        return d().refreshAll();
      }).catch((e) => showProgramError(e.message));
    });

    on('btn-prog-load', () => loadProgramFromServer($('program-library')?.value));

    onChange('program-library', (ev) => {
      const path = (ev.target?.value || '').trim();
      if (path) ev.target.dataset.userPick = path;
    });

    on('btn-prog-load-fixtures', () => { loadFixturesForSelected().catch((e) => showProgramError(e.message)); });

    on('btn-prog-create-tags', () => { createTagsFromProgram().catch((e) => showProgramError(e.message)); });

    on('btn-prog-reload', () => { reloadProgramFromDisk().catch((e) => showProgramError(e.message)); });

    on('btn-prog-clear', () => { clearActiveProgram().catch((e) => showProgramError(e.message)); });

    on('btn-prog-revert', () => {
      if (!stEditor) return;
      if (stEditor.isDirty() && !window.confirm('Discard unsaved edits?')) return;
      stEditor.revert();
      programEditLock = false;
      syncProgramTagRefs().then(() => renderProgramIoPanel(d().getLastLive(), d().getLastRuntime()));
    });

    const progEl = $('program-src');
    if (progEl && window.StEditor) {
      stEditor = StEditor.create(progEl, { statusEl: 'program-edit-status' });
      stEditor.updateGutter();
      progEl.addEventListener('st-edit', () => {
        programEditLock = true;
        clearTimeout(window._progTagRefTimer);
        window._progTagRefTimer = setTimeout(() => {
          syncProgramTagRefs().then(() => renderProgramIoPanel(d().getLastLive(), d().getLastRuntime()));
          scheduleDeployEstimate();
        }, 400);
      });
      progEl.addEventListener('st-save', () => $('btn-prog-save')?.click());
      progEl.addEventListener('focus', () => { programEditLock = true; });
      progEl.addEventListener('blur', () => {
        setTimeout(() => {
          if (!progEl.matches(':focus') && !stEditor.isDirty()) programEditLock = false;
        }, 150);
      });
    }

    if (window.StPidEditor) {
      window.StPidEditor.bindProgramDialog(
        () => d().getTags(),
        () => stEditor,
        () => d().markTagsDirty?.(),
      );
    }

    $('btn-prog-validate').onclick = async () => {
      const r = await api.validateProgram($('program-src').value);
      programTagRefs = r.programTags || [];
      renderProgramIoPanel(d().getLastLive(), d().getLastRuntime());
      $('program-errors').textContent = r.ok ? 'OK' : (r.errors || []).join('; ');
      $('program-errors').className = r.ok ? 'inline-msg ok' : 'inline-msg err';
      await syncDeployEstimate();
    };

    on('btn-prog-apply', () => api.putProgram($('program-src').value).then((r) => {
      if (stEditor) {
        stEditor.setBaseline($('program-src').value);
        stEditor.markClean();
      } else {
        $('program-src').dataset.dirty = '';
      }
      programEditLock = false;
      if (r.active) programActivePath = r.active;
      if (stEditor) stEditor.setActivePath(programActivePath);
      programLoadGuardUntil = Date.now() + 1500;
      $('program-errors').textContent = r.programOk ? 'Loaded for runtime' : (r.errors || []).join('; ');
      $('program-errors').className = r.programOk ? 'inline-msg ok' : 'inline-msg err';
      return syncProgramTagRefs().then(() => d().refreshAll());
    }).catch((e) => showProgramError(e.message)));
    window.MooreviewTagDisplay?.bindAll(document);
    window.addEventListener('mooreview-tag-display', () => {
      renderProgramTagLegend();
      renderProgramIoPanel(d().getLastLive(), d().getLastRuntime());
    });
  }

  function forceReloadFromDashboard(data) {
    programEditLock = false;
    programLoading = false;
    programLoadGuardUntil = 0;
    programTagRefs = data?.programTagRefs || [];
    programCatalog = data?.programs || [];
    if (data?.stDir) programStDir = data.stDir;
    if (data?.activeProgram) programActivePath = data.activeProgram;
    updateProgramFolderLabel(programStDir, programActivePath);
    fillProgramLibrary(programCatalog, programActivePath);
    const prog = $('program-src');
    const src = data?.program ?? '';
    if (prog) {
      if (stEditor) {
        stEditor.setValue(src, { clean: true });
        stEditor.setActivePath(programActivePath);
        stEditor.setBaseline(src);
        stEditor.markClean();
      } else {
        prog.value = src;
      }
      prog.dataset.dirty = '';
    }
  }

  function handleDashboardPoll(data) {
    if (data.programTagRefs?.length) programTagRefs = data.programTagRefs;
    if (data.stDir) programStDir = data.stDir;
    updateProgramFolderLabel(data.stDir, data.activeProgram);
    programCatalog = data.programs || [];
    fillProgramLibrary(programCatalog, data.activeProgram);

    const prog = $('program-src');
    const guard = Date.now() < programLoadGuardUntil;
    const editorDirty = prog?.dataset.dirty === '1';
    if (prog && !programLoading && !prog.matches(':focus') && !editorDirty && !programEditLock && !guard) {
      if (data.activeProgram) programActivePath = data.activeProgram;
      if (!programActivePath || data.activeProgram === programActivePath) {
        if (stEditor) {
          stEditor.setValue(data.program || '', { clean: true });
          stEditor.setActivePath(programActivePath);
          stEditor.setBaseline(data.program || '');
        } else {
          prog.value = data.program || '';
        }
      }
    }
  }

  function init(appDeps) {
    deps = appDeps;
  }

  return {
    init,
    bindProgramToolbar,
    updateProgramRemoteUi,
    syncDeployEstimate,
    renderProgramIoPanel,
    updateProgramIoLive,
    updateProgramTrace,
    syncProgramTagRefs,
    handleDashboardPoll,
    forceReloadFromDashboard,
    getProgramActivePath: () => programActivePath,
    getProgramCatalog: () => programCatalog.slice(),
    setProgramActivePath: (p) => { programActivePath = p; },
    getProgramTagRefs: () => programTagRefs,
    isProgramLoading: () => programLoading,
    isProgramEditLocked: () => programEditLock,
    setStEditorPath: (p) => { if (stEditor) stEditor.setActivePath(p); },
  };
})();
