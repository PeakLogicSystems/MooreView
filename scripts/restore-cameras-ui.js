'use strict';

const fs = require('fs');
const path = require('path');

const estPath = path.join(__dirname, '../views/dashboard.ejs');
const cloudPath = path.join(__dirname, '../../mooreview-cloud/views/dashboard.ejs');

let text = fs.readFileSync(estPath, 'utf8');

if (!text.includes('data-popup-open="cameras"')) {
  text = text.replace(
    /(<button type="button" class="topbar-menu-item view-tab" data-popup-open="drivers" role="menuitem">Drivers<\/button>\r?\n)(\s*<a href="\/io-map")/,
    '$1        <button type="button" class="topbar-menu-item view-tab" data-popup-open="cameras" role="menuitem">Cameras</button>\n$2',
  );
}

const cameraDropdown = `    <details class="topbar-camera-details topbar-project-details" id="camera-menu-details">
      <summary class="topbar-project-trigger topbar-camera-trigger" title="Cameras — open a live view" aria-label="Cameras">
        <span class="topbar-camera-icon" aria-hidden="true">&#x1F4F7;</span>
        <span class="topbar-project-caret" aria-hidden="true">&#x25BE;</span>
      </summary>
      <div class="topbar-camera-dropdown topbar-project-dropdown" id="camera-menu" role="menu" aria-label="Cameras">
        <p class="topbar-camera-empty muted" id="camera-menu-empty">No cameras yet — open <strong>Administration…</strong> to add one.</p>
      </div>
    </details>
`;

if (!text.includes('id="camera-menu-details"')) {
  text = text.replace(
    /(\r?\n    <\/details>\r?\n)(    <div class="topbar-about-meta">)/,
    `$1${cameraDropdown}$2`,
  );
}

if (!text.includes('data-popup="cameras"')) {
  const block = `${fs.readFileSync(cloudPath, 'utf8').split(/\r?\n/).slice(338, 593).join('\n')}\n\n`;
  const marker = '  <div class="app-popup view-hidden" data-popup="hw-wizard"';
  if (!text.includes(marker)) {
    console.error('hw-wizard marker not found');
    process.exit(1);
  }
  text = text.replace(marker, block + marker);
}

if (!text.includes('cameraAdminUi.js')) {
  text = text.replace(
    '  <script src="/js/hardwareWizardUi.js?v=<%= assetV %>"></script>\r\n',
    '  <script src="/js/hardwareWizardUi.js?v=<%= assetV %>"></script>\r\n  <script src="/js/cameraAdminUi.js?v=<%= assetV %>"></script>\r\n',
  );
  if (!text.includes('cameraAdminUi.js')) {
    text = text.replace(
      '  <script src="/js/hardwareWizardUi.js?v=<%= assetV %>"></script>\n',
      '  <script src="/js/hardwareWizardUi.js?v=<%= assetV %>"></script>\n  <script src="/js/cameraAdminUi.js?v=<%= assetV %>"></script>\n',
    );
  }
}

fs.writeFileSync(estPath, text, 'utf8');
console.log('Restored Cameras UI in dashboard.ejs');
