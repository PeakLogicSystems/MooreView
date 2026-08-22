'use strict';

(() => {
  const root = document.getElementById('cs-app');
  const main = document.getElementById('cs-main');
  if (!root || !main || !window.api) return;

  const page = root.dataset.page || 'sites';
  const pathSiteId = String(root.dataset.siteId || '').trim();
  const role = root.dataset.role || '';

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function wrapTable(html) {
    return `<div class="cs-table-wrap">${html}</div>`;
  }

  function agentBadge(online) {
    return online
      ? '<span class="badge badge-ok">online</span>'
      : '<span class="badge badge-off">offline</span>';
  }

  function statusBadge(st) {
    const s = String(st || 'ok');
    const cls = s === 'alarm' || s === 'offline' ? 'badge-off'
      : s === 'warn' ? 'badge-muted' : 'badge-ok';
    return `<span class="badge ${cls}">${esc(s)}</span>`;
  }

  function playerUrl(siteId, cameraId) {
    return `/api/sites/${encodeURIComponent(siteId)}/cameras/${encodeURIComponent(cameraId)}/player`;
  }

  document.querySelectorAll('.cs-nav a[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('data-nav') === page
      || (page === 'cameras' && a.getAttribute('data-nav') === 'sites')
      || (page === 'site' && a.getAttribute('data-nav') === 'sites'));
  });
  if (role === 'platform_admin') {
    const admin = document.getElementById('nav-admin');
    if (admin) admin.classList.remove('view-hidden');
  }

  document.getElementById('cs-logout')?.addEventListener('click', async () => {
    try { await api.logout(); } catch { /* ignore */ }
    location.href = '/login';
  });

  document.querySelector('.cs-nav-menu')?.addEventListener('toggle', () => {
    window.MooreviewMobileViewport?.syncChromeTop?.();
  });

  async function renderSites() {
    main.innerHTML = `
      <h1>Sites</h1>
      <p class="cs-lead">Pair site appliances. Cameras sync from the edge — Cloud Studio never scans the LAN.</p>
      <div class="cs-toolbar">
        <label>Site ID <input id="cs-new-site-id" placeholder="plant_a"></label>
        <label>Name <input id="cs-new-site-name" placeholder="Plant A"></label>
        <button type="button" class="btn btn-primary" id="cs-create-site">Create site</button>
        <button type="button" class="btn" id="cs-refresh-sites">Refresh</button>
      </div>
      <div id="cs-pairing-banner"></div>
      <div class="cs-card"><div id="cs-sites-table"></div></div>
      <p class="cs-msg" id="cs-sites-status"></p>`;

    const tableHost = document.getElementById('cs-sites-table');
    const statusEl = document.getElementById('cs-sites-status');
    const banner = document.getElementById('cs-pairing-banner');

    async function load() {
      try {
        const data = await api.listSites();
        const sites = data.sites || [];
        if (!sites.length) {
          tableHost.innerHTML = '<p class="cs-empty">No sites yet for this organization.</p>';
          return;
        }
        tableHost.innerHTML = wrapTable(`<table class="cs-table"><thead><tr>
          <th>Site</th><th>Name</th><th>Tenant</th><th>Agent</th><th>Cameras</th><th></th>
        </tr></thead><tbody>
          ${sites.map((s) => `<tr>
            <td><code>${esc(s.siteId)}</code></td>
            <td>${esc(s.name)}</td>
            <td>${esc(s.tenantId || '—')}</td>
            <td>${agentBadge(!!s.agentOnline)}</td>
            <td>${Number(s.cameraCount) || 0}</td>
            <td>
              <a class="btn" href="/sites/${encodeURIComponent(s.siteId)}/cameras">Cameras</a>
              <button type="button" class="btn btn-danger" data-del="${esc(s.siteId)}">Delete</button>
            </td>
          </tr>`).join('')}
        </tbody></table>`);
        tableHost.querySelectorAll('[data-del]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            if (!confirm(`Delete ${btn.dataset.del}?`)) return;
            await api.deleteSite(btn.dataset.del);
            await load();
          });
        });
        statusEl.textContent = `${sites.length} site(s)`;
      } catch (e) {
        tableHost.innerHTML = `<p class="cs-err">${esc(e.message)}</p>`;
      }
    }

    document.getElementById('cs-refresh-sites').onclick = () => load();
    document.getElementById('cs-create-site').onclick = async () => {
      try {
        const created = await api.createSite({
          siteId: document.getElementById('cs-new-site-id').value.trim() || undefined,
          name: document.getElementById('cs-new-site-name').value.trim() || undefined,
        });
        const pairing = created.pairingCode || '';
        const id = created.site?.siteId || '';
        banner.innerHTML = pairing
          ? `<div class="cs-pairing"><strong>Pairing code for <code>${esc(id)}</code></strong><code>${esc(pairing)}</code></div>`
          : '';
        await load();
      } catch (e) {
        statusEl.innerHTML = `<span class="cs-err">${esc(e.message)}</span>`;
      }
    };
    await load();
  }

  async function renderCameras(siteId) {
    main.innerHTML = `
      <h1>Cameras · <code>${esc(siteId)}</code></h1>
      <p class="cs-lead">Redacted catalog from the site agent.</p>
      <div class="cs-toolbar">
        <a class="btn" href="/sites">← Sites</a>
        <button type="button" class="btn" id="cs-refresh-cams">Refresh</button>
        <span id="cs-agent-badge"></span>
      </div>
      <div class="cs-card"><div id="cs-cams-table"></div></div>
      <div class="cs-card" id="cs-player-card" hidden>
        <h2 id="cs-player-title">Live view</h2>
        <iframe class="player-frame" id="cs-player" title="Live" allow="autoplay"></iframe>
      </div>`;
    const tableHost = document.getElementById('cs-cams-table');
    async function load() {
      const data = await api.siteCameras(siteId);
      document.getElementById('cs-agent-badge').innerHTML = agentBadge(!!data.agentOnline);
      const cams = data.cameras || [];
      if (!cams.length) {
        tableHost.innerHTML = '<p class="cs-empty">No cameras synced yet.</p>';
        return;
      }
      tableHost.innerHTML = wrapTable(`<table class="cs-table"><thead><tr>
        <th>ID</th><th>Name</th><th>Model</th><th>Probe</th><th></th>
      </tr></thead><tbody>
        ${cams.map((c) => `<tr>
          <td><code>${esc(c.cameraId)}</code></td>
          <td>${esc(c.name)}</td>
          <td>${esc(c.model || '—')}</td>
          <td>${esc(c.probeStatus || '—')}</td>
          <td><button type="button" class="btn btn-primary" data-open="${esc(c.cameraId)}" data-name="${esc(c.name || c.cameraId)}">Open live</button></td>
        </tr>`).join('')}
      </tbody></table>`);
      tableHost.querySelectorAll('[data-open]').forEach((btn) => {
        btn.onclick = () => {
          const card = document.getElementById('cs-player-card');
          card.hidden = false;
          document.getElementById('cs-player-title').textContent = `Live · ${btn.dataset.name}`;
          document.getElementById('cs-player').src = playerUrl(siteId, btn.dataset.open);
        };
      });
    }
    document.getElementById('cs-refresh-cams').onclick = () => load().catch((e) => {
      tableHost.innerHTML = `<p class="cs-err">${esc(e.message)}</p>`;
    });
    try { await load(); } catch (e) {
      tableHost.innerHTML = `<p class="cs-err">${esc(e.message)}</p>`;
    }
  }

  async function renderDevices() {
    main.innerHTML = `
      <h1>All devices</h1>
      <p class="cs-lead">Site agents, cameras, and registered devices for this organization.</p>
      <div class="cs-toolbar">
        <button type="button" class="btn" id="cs-refresh-dev">Refresh</button>
        <label>Name <input id="dev-name" placeholder="Opta line 1"></label>
        <label>Site <input id="dev-site" placeholder="plant_a"></label>
        <label>Serial <input id="dev-serial"></label>
        <button type="button" class="btn btn-primary" id="dev-add">Add device</button>
      </div>
      <div class="cs-card"><div id="cs-dev-table"></div></div>`;
    const host = document.getElementById('cs-dev-table');
    async function load() {
      const data = await api.listSiteDevices();
      const devices = data.devices || [];
      if (!devices.length) {
        host.innerHTML = '<p class="cs-empty">No devices yet.</p>';
        return;
      }
      host.innerHTML = wrapTable(`<table class="cs-table"><thead><tr>
        <th>Device</th><th>Name</th><th>Kind</th><th>Site</th><th>Online</th><th>Commissioning</th>
      </tr></thead><tbody>
        ${devices.map((d) => `<tr>
          <td><code>${esc(d.deviceId)}</code></td>
          <td>${esc(d.name)}</td>
          <td>${esc(d.kind)}</td>
          <td>${esc(d.siteId || '—')}</td>
          <td>${agentBadge(!!d.online)}</td>
          <td>${esc(d.commissioning || '—')}</td>
        </tr>`).join('')}
      </tbody></table>`);
    }
    document.getElementById('cs-refresh-dev').onclick = () => load();
    document.getElementById('dev-add').onclick = async () => {
      await api.createSiteDevice({
        name: document.getElementById('dev-name').value.trim(),
        siteId: document.getElementById('dev-site').value.trim(),
        serial: document.getElementById('dev-serial').value.trim(),
        kind: 'controller',
        online: false,
        commissioning: 'pending',
      });
      await load();
    };
    try { await load(); } catch (e) {
      host.innerHTML = `<p class="cs-err">${esc(e.message)}</p>`;
    }
  }

  async function renderFleet() {
    main.innerHTML = `
      <h1>Assets map</h1>
      <p class="cs-lead">Organization assets (status colors for operators).</p>
      <div class="cs-toolbar">
        <label>Name <input id="asset-name"></label>
        <label>Site <input id="asset-site"></label>
        <label>Status
          <select id="asset-status">
            <option value="ok">ok</option>
            <option value="warn">warn</option>
            <option value="alarm">alarm</option>
            <option value="offline">offline</option>
          </select>
        </label>
        <label>X% <input id="asset-x" type="number" value="40" min="0" max="100" style="width:4rem"></label>
        <label>Y% <input id="asset-y" type="number" value="40" min="0" max="100" style="width:4rem"></label>
        <button type="button" class="btn btn-primary" id="asset-add">Add asset</button>
        <button type="button" class="btn" id="asset-refresh">Refresh</button>
      </div>
      <div class="cs-card" id="fleet-map-wrap" style="padding:0;overflow:hidden">
        <div id="fleet-map" style="position:absolute;inset:0"></div>
      </div>
      <div class="cs-card"><div id="asset-table"></div></div>`;
    const map = document.getElementById('fleet-map');
    const table = document.getElementById('asset-table');
    async function load() {
      const data = await api.listFleetAssets();
      const assets = data.assets || [];
      map.innerHTML = assets.map((a) => {
        const color = a.status === 'alarm' || a.status === 'offline' ? '#dc2626'
          : a.status === 'warn' ? '#ea580c' : '#16a34a';
        return `<div title="${esc(a.name)}" style="position:absolute;left:${Number(a.x)||50}%;top:${Number(a.y)||50}%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:${color};box-shadow:0 0 0 3px rgba(15,23,42,.12)"></div>`;
      }).join('');
      table.innerHTML = assets.length
        ? wrapTable(`<table class="cs-table"><thead><tr><th>Name</th><th>Site</th><th>Status</th><th></th></tr></thead><tbody>
            ${assets.map((a) => `<tr>
              <td>${esc(a.name)}</td><td>${esc(a.siteId || '—')}</td><td>${statusBadge(a.status)}</td>
              <td><button type="button" class="btn btn-danger" data-del="${esc(a.assetId)}">Delete</button></td>
            </tr>`).join('')}
          </tbody></table>`)
        : '<p class="cs-empty">No assets yet.</p>';
      table.querySelectorAll('[data-del]').forEach((btn) => {
        btn.onclick = async () => {
          await api.deleteFleetAsset(btn.dataset.del);
          await load();
        };
      });
    }
    document.getElementById('asset-refresh').onclick = () => load();
    document.getElementById('asset-add').onclick = async () => {
      await api.createFleetAsset({
        name: document.getElementById('asset-name').value.trim() || 'Asset',
        siteId: document.getElementById('asset-site').value.trim(),
        status: document.getElementById('asset-status').value,
        x: Number(document.getElementById('asset-x').value),
        y: Number(document.getElementById('asset-y').value),
        kind: 'equipment',
      });
      await load();
    };
    try { await load(); } catch (e) {
      table.innerHTML = `<p class="cs-err">${esc(e.message)}</p>`;
    }
  }

  async function renderPeople() {
    const tenantSlug = root.dataset.tenant || '';
    let canEditMatrix = role === 'platform_admin' || role === 'tenant_admin';
    main.innerHTML = `
      <h1>People</h1>
      <p class="cs-lead">Users and feature access for this organization${tenantSlug ? ` (<code>${esc(tenantSlug)}</code>)` : ''}. <code>tenant_admin</code> always has full access.</p>
      <p class="cs-msg view-hidden" id="people-readonly-msg">You can view role defaults and your own permissions. Only tenant administrators can add users or edit the access matrix.</p>
      ${canEditMatrix ? `
      <h2 class="cs-subhead">Add user</h2>
      <div class="cs-toolbar">
        <label>Email <input id="u-email" type="email" required></label>
        <label>Name <input id="u-name"></label>
        <label>Password <input id="u-pass" type="password" required minlength="1"></label>
        <label>Role
          <select id="u-role">
            <option value="operator">operator</option>
            <option value="technician">technician</option>
            <option value="homeowner">homeowner</option>
            <option value="viewer">viewer</option>
            <option value="tenant_admin">tenant_admin</option>
          </select>
        </label>
        <button type="button" class="btn btn-primary" id="u-add">Add user</button>
      </div>
      <p class="cs-msg" id="u-status"></p>` : ''}
      <h2 class="cs-subhead">Role defaults (below tenant_admin)</h2>
      <p class="panel-hint">Default features applied when a user is created. Per-user overrides below.</p>
      <div class="cs-card cs-features-matrix-wrap"><div id="role-defaults-matrix"></div></div>
      <h2 class="cs-subhead">User access matrix</h2>
      <p class="panel-hint">Checkboxes apply to each user. Admins are not editable here.</p>
      ${canEditMatrix ? '<div class="cs-toolbar"><button type="button" class="btn btn-primary" id="u-matrix-save">Save access matrix</button></div>' : ''}
      <p class="cs-msg" id="u-matrix-status"></p>
      <div class="cs-card cs-features-matrix-wrap"><div id="u-matrix-host"></div></div>`;

    const roleDefaultsHost = document.getElementById('role-defaults-matrix');
    const matrixHost = document.getElementById('u-matrix-host');
    const statusEl = document.getElementById('u-status');
    const matrixStatusEl = document.getElementById('u-matrix-status');
    let featureCatalog = [];
    let tenantUsers = [];

    function featCell(on, { readOnly = false } = {}) {
      if (readOnly) {
        return `<td class="${on ? 'feat-on' : 'feat-off'}">${on ? '✓' : '—'}</td>`;
      }
      return `<td><span class="${on ? 'feat-on' : 'feat-off'}">${on ? '✓' : '—'}</span></td>`;
    }

    function renderRoleDefaultsMatrix() {
      const roles = [
        { id: 'operator', label: 'operator' },
        { id: 'technician', label: 'technician' },
        { id: 'viewer', label: 'viewer' },
        { id: 'homeowner', label: 'homeowner' },
      ];
      const head = featureCatalog.map((f) => `<th title="${esc(f.label)}">${esc(f.label)}</th>`).join('');
      const rows = roles.map((r) => {
        const defaults = window.__mvRoleDefaults?.[r.id] || {};
        const cells = featureCatalog.map((f) => featCell(!!defaults[f.key], { readOnly: true })).join('');
        return `<tr class="is-role-default"><td class="feature-user-col"><strong>${esc(r.label)}</strong><br><span class="muted">role default</span></td>${cells}</tr>`;
      }).join('');
      roleDefaultsHost.innerHTML = `<table class="cs-features-matrix"><thead><tr><th class="feature-user-col">Role</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
    }

    function renderUserMatrix() {
      const editable = canEditMatrix;
      const matrixUsers = tenantUsers.filter((u) => u.role !== 'tenant_admin' && u.role !== 'platform_admin');
      if (!matrixUsers.length) {
        matrixHost.innerHTML = editable
          ? '<p class="cs-empty">No editable users yet — add operator, technician, viewer, or homeowner accounts above.</p>'
          : '<p class="cs-empty">No user access record for your account.</p>';
        return;
      }
      const head = featureCatalog.map((f) => `<th title="${esc(f.label)}">${esc(f.label)}</th>`).join('');
      const rows = matrixUsers.map((u) => {
        const uid = u.userId || u.id;
        const cells = featureCatalog.map((f) => {
          const checked = !!u.features?.[f.key];
          if (!editable) {
            return featCell(checked, { readOnly: true });
          }
          return `<td><input type="checkbox" data-feat-user="${esc(uid)}" data-feat-key="${esc(f.key)}"${checked ? ' checked' : ''} aria-label="${esc(u.email)} ${esc(f.label)}"></td>`;
        }).join('');
        return `<tr data-auth-user-row="${esc(uid)}">
          <td class="feature-user-col"><strong>${esc(u.name || u.email)}</strong><br><span class="muted">${esc(u.email)} · ${esc(u.role)}</span></td>
          ${cells}
        </tr>`;
      }).join('');
      matrixHost.innerHTML = `<table class="cs-features-matrix"><thead><tr><th class="feature-user-col">User</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
    }

    function collectMatrix() {
      const matrix = {};
      tenantUsers.forEach((u) => {
        if (u.role === 'tenant_admin' || u.role === 'platform_admin') return;
        const uid = u.userId || u.id;
        matrix[uid] = { ...(u.features || {}) };
      });
      document.querySelectorAll('[data-feat-user][data-feat-key]').forEach((cb) => {
        const uid = cb.dataset.featUser;
        const key = cb.dataset.featKey;
        if (!matrix[uid]) matrix[uid] = {};
        matrix[uid][key] = cb.checked;
      });
      return matrix;
    }

    async function load() {
      const data = await api.listTenantUsers();
      tenantUsers = data.users || [];
      featureCatalog = data.features || [];
      window.__mvRoleDefaults = data.roleDefaults || {};
      if (data.readOnly != null) canEditMatrix = !data.readOnly;
      document.getElementById('people-readonly-msg')?.classList.toggle('view-hidden', canEditMatrix);
      renderRoleDefaultsMatrix();
      renderUserMatrix();
    }

    if (canEditMatrix) {
      document.getElementById('u-add').onclick = async () => {
        if (statusEl) {
          statusEl.textContent = '';
          statusEl.className = 'cs-msg';
        }
        const email = document.getElementById('u-email').value.trim();
        const password = document.getElementById('u-pass').value;
        const name = document.getElementById('u-name').value.trim();
        const roleVal = document.getElementById('u-role').value;
        if (!email || !password) {
          statusEl.textContent = 'Email and password are required.';
          statusEl.className = 'cs-msg cs-err';
          return;
        }
        try {
          await api.createTenantUser({ email, name, password, role: roleVal });
          document.getElementById('u-email').value = '';
          document.getElementById('u-name').value = '';
          document.getElementById('u-pass').value = '';
          statusEl.textContent = `Added ${email} (${roleVal}).`;
          statusEl.className = 'cs-msg';
          await load();
        } catch (e) {
          statusEl.textContent = e.message || String(e);
          statusEl.className = 'cs-msg cs-err';
        }
      };
      document.getElementById('u-matrix-save').onclick = async () => {
        if (matrixStatusEl) {
          matrixStatusEl.textContent = '';
          matrixStatusEl.className = 'cs-msg';
        }
        try {
          const data = await api.putTenantFeaturesMatrix(collectMatrix());
          tenantUsers = data.users || tenantUsers;
          matrixStatusEl.textContent = `Access matrix saved (${data.updated ?? 'ok'} user(s)).`;
          matrixStatusEl.className = 'cs-msg';
          renderUserMatrix();
        } catch (e) {
          matrixStatusEl.textContent = e.message || String(e);
          matrixStatusEl.className = 'cs-msg cs-err';
        }
      };
    }

    try {
      await load();
    } catch (e) {
      matrixHost.innerHTML = `<p class="cs-err">${esc(e.message)}</p>`;
    }
  }

  async function renderAdmin() {
    main.innerHTML = `
      <h1>Platform admin · Tenants</h1>
      <div class="cs-toolbar">
        <label>Org code <input id="t-org-id" placeholder="acme"></label>
        <label>Name <input id="t-name" placeholder="Acme Inc"></label>
        <button type="button" class="btn btn-primary" id="t-add">Create tenant</button>
        <button type="button" class="btn" id="t-refresh">Refresh</button>
      </div>
      <div class="cs-card"><div id="t-table"></div></div>`;
    const host = document.getElementById('t-table');
    async function load() {
      const data = await api.listAdminTenants();
      const tenants = data.tenants || [];
      host.innerHTML = wrapTable(`<table class="cs-table"><thead><tr>
        <th>ID</th><th>Code</th><th>Name</th><th>CMMS</th><th></th>
      </tr></thead><tbody>
        ${tenants.map((t) => `<tr>
          <td><code>${esc(t.tenantId || t.id || '')}</code></td>
          <td><code>${esc(t.tenantSlug || '')}</code></td>
          <td>${esc(t.name)}</td>
          <td>${t.cmmsEnabled ? statusBadge('ok') : statusBadge('offline')}</td>
          <td>
            <button type="button" class="btn" data-cmms="${esc(t.tenantId)}" data-on="${t.cmmsEnabled ? '0' : '1'}">
              ${t.cmmsEnabled ? 'Disable CMMS' : 'Enable CMMS'}
            </button>
          </td>
        </tr>`).join('')}
      </tbody></table>`);
      host.querySelectorAll('[data-cmms]').forEach((btn) => {
        btn.onclick = async () => {
          await api.patchTenantCmms(btn.dataset.cmms, { enabled: btn.dataset.on === '1' });
          await load();
        };
      });
    }
    document.getElementById('t-refresh').onclick = () => load();
    document.getElementById('t-add').onclick = async () => {
      await api.createAdminTenant({
        tenantSlug: document.getElementById('t-org-id').value.trim(),
        name: document.getElementById('t-name').value.trim(),
      });
      await load();
    };
    try { await load(); } catch (e) {
      host.innerHTML = `<p class="cs-err">${esc(e.message)}</p>`;
    }
  }

  async function renderCmms() {
    main.innerHTML = '<div id="cmms-cloud-root" class="cmms-page cmms-cloud-embed"></div>';
    try {
      const data = await api.tenantCmms();
      if (!data.cmmsEnabled) {
        main.innerHTML = `<h1>CMMS</h1><div class="cs-card"><p><span class="badge badge-off">disabled</span> ${esc(data.message)}</p></div>`;
        return;
      }
      if (data.externalUrl && !data.integrated) {
        main.innerHTML = `<h1>CMMS</h1><div class="cs-card"><p><span class="badge badge-ok">enabled</span> ${esc(data.message)}</p>
          <p><a class="btn btn-primary" href="${esc(data.externalUrl)}" target="_blank" rel="noopener">Open external CMMS</a></p></div>`;
        return;
      }
      if (typeof MooreviewCmms === 'undefined') {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = `/js/cmmsApp.js?v=${encodeURIComponent(root.dataset.version || '')}`;
          s.onload = resolve;
          s.onerror = reject;
          document.body.appendChild(s);
        });
      }
      const host = document.getElementById('cmms-cloud-root');
      if (host) {
        host.innerHTML = '<h1>CMMS</h1>';
        const mount = document.createElement('div');
        mount.id = 'cmms-app-root';
        host.appendChild(mount);
        await MooreviewCmms.mount(mount);
      }
    } catch (e) {
      main.innerHTML = `<h1>CMMS</h1><div class="cs-card"><p class="cs-err">${esc(e.message)}</p></div>`;
    }
  }

  if (page === 'cameras' && pathSiteId) renderCameras(pathSiteId);
  else if (page === 'site' && pathSiteId) location.replace(`/sites/${encodeURIComponent(pathSiteId)}/cameras`);
  else if (page === 'devices') renderDevices();
  else if (page === 'fleet') renderFleet();
  else if (page === 'people') renderPeople();
  else if (page === 'admin') renderAdmin();
  else if (page === 'cmms') renderCmms();
  else renderSites();
})();
