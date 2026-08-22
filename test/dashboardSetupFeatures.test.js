'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dashboardEjs = fs.readFileSync(
  path.join(__dirname, '../views/dashboard.ejs'),
  'utf8',
);
const connectivityEjs = fs.readFileSync(
  path.join(__dirname, '../views/cellular-sims.ejs'),
  'utf8',
);
const pagesJs = fs.readFileSync(
  path.join(__dirname, '../src/routes/pages.js'),
  'utf8',
);
const expressRouterJs = fs.readFileSync(
  path.join(__dirname, '../src/api/expressRouter.js'),
  'utf8',
);

describe('dashboard Features panel and Tools menu', () => {
  it('exposes user feature access matrix in Features setup tab', () => {
    assert.match(dashboardEjs, /data-setup-tab-btn="features"/);
    const featuresPanel = dashboardEjs.match(
      /<section class="setup-panel[^"]*" data-setup-tab="features">([\s\S]*?)<\/section>/,
    );
    assert.ok(featuresPanel, 'Features setup panel missing');
    const panelHtml = featuresPanel[1];
    assert.match(panelHtml, /setup-features-matrix-host/);
    assert.match(panelHtml, /btn-features-matrix-save/);
    assert.match(panelHtml, /User access|user access/i);
    assert.doesNotMatch(panelHtml, /Reserved for future/);
    assert.doesNotMatch(panelHtml, /id="proj-cloud-sims-enabled"/);
    assert.doesNotMatch(panelHtml, /id="proj-cellular-sims-enabled"/);
    assert.match(connectivityEjs, /id="conn-cloud-sims-enabled"/);
    assert.match(connectivityEjs, /id="conn-cellular-sims-enabled"/);
    assert.match(connectivityEjs, /id="conn-features-save"/);
    assert.match(connectivityEjs, /id="conn-cloud-sims-open"/);
    const toolsMenu = dashboardEjs.match(
      /<nav class="topbar-tools-dropdown[^"]*"[\s\S]*?<\/nav>/,
    );
    assert.ok(toolsMenu, 'Tools dropdown missing');
    assert.doesNotMatch(toolsMenu[0], /data-setup-open="features"/);
    assert.doesNotMatch(toolsMenu[0], /MV Draw/);
    assert.doesNotMatch(toolsMenu[0], /href="\/mv-draw"/);
    assert.match(toolsMenu[0], /href="\/cellular\/sims"/);
    assert.match(toolsMenu[0], /Connectivity/);
    assert.doesNotMatch(toolsMenu[0], /data-popup-open="training"/);
    assert.doesNotMatch(toolsMenu[0], /data-popup-open="help"/);
    assert.doesNotMatch(toolsMenu[0], /data-popup-open="alarms"/);
    assert.doesNotMatch(toolsMenu[0], /data-popup-open="cameras"/);
    assert.doesNotMatch(toolsMenu[0], /data-popup-open="historian"/);
    assert.doesNotMatch(toolsMenu[0], /data-popup-open="report"/);
    assert.match(dashboardEjs, /id="btn-topbar-logout"/);
    assert.match(dashboardEjs, /id="topbar-user-meta"/);
    assert.match(dashboardEjs, /id="btn-camera-admin"/);
    assert.match(dashboardEjs, /id="btn-topbar-alarms"[\s\S]*?data-popup-open="alarms"/);
    assert.match(dashboardEjs, /id="btn-topbar-mv-draw"/);
    assert.match(dashboardEjs, /href="\/mv-draw"[\s\S]*?id="btn-topbar-mv-draw"|id="btn-topbar-mv-draw"[\s\S]*?href="\/mv-draw"/);
    assert.match(dashboardEjs, /class="topbar-action-btn topbar-action-link"[\s\S]*?MV Draw/);
    assert.match(dashboardEjs, /id="camera-menu"[\s\S]*?data-popup-open="cameras"/);
    assert.match(dashboardEjs, /Cameras &#x2192; Administration/);
    assert.match(dashboardEjs, /id="help-menu-details"/);
    const helpMenu = dashboardEjs.match(
      /<nav class="topbar-help-dropdown[^"]*"[\s\S]*?<\/nav>/,
    );
    assert.ok(helpMenu, 'Help dropdown missing');
    assert.match(helpMenu[0], /data-popup-open="training"/);
    assert.match(helpMenu[0], /data-popup-open="help"/);
    assert.match(helpMenu[0], /id="btn-training"/);
    assert.match(helpMenu[0], /id="btn-help"/);
    const historianMenu = dashboardEjs.match(
      /<nav class="topbar-historian-dropdown[^"]*"[\s\S]*?<\/nav>/,
    );
    assert.ok(historianMenu, 'Historian dropdown missing');
    assert.match(historianMenu[0], /data-popup-open="historian"/);
    assert.match(historianMenu[0], /data-popup-open="historian-logger"/);
    assert.match(historianMenu[0], /data-historian-logger-open="pdm"/);
    assert.doesNotMatch(historianMenu[0], /data-setup-open="pdm"/);
    assert.doesNotMatch(historianMenu[0], /data-popup-open="report"/);
    assert.doesNotMatch(historianMenu[0], /data-report-open="roi"/);
    const reportingMenu = dashboardEjs.match(
      /<nav class="topbar-reporting-dropdown[^"]*"[\s\S]*?<\/nav>/,
    );
    assert.ok(reportingMenu, 'Reporting dropdown missing');
    assert.match(reportingMenu[0], /data-popup-open="report"/);
    assert.match(reportingMenu[0], /data-report-open="roi"/);
    assert.doesNotMatch(reportingMenu[0], /data-report-open="cmms"/);
    assert.match(dashboardEjs, /id="btn-topbar-cmms"/);
    assert.match(dashboardEjs, /href="\/cmms"/);
    assert.match(dashboardEjs, /id="historian-pdm-section"/);
    assert.match(dashboardEjs, /id="historian-maintenance-panel"/);
    assert.match(dashboardEjs, /id="btn-report-roi-save"/);
    assert.doesNotMatch(dashboardEjs, /data-setup-tab="logging"/);
    assert.doesNotMatch(dashboardEjs, /data-setup-tab="pdm"/);
    assert.doesNotMatch(dashboardEjs, /data-setup-tab="roi"/);
    assert.match(dashboardEjs, /Historian <span class="topbar-project-caret"/);
    assert.match(dashboardEjs, /Reporting <span class="topbar-project-caret"/);
    assert.doesNotMatch(dashboardEjs, /data-setup-tab-btn="logging"/);
    assert.doesNotMatch(dashboardEjs, /data-setup-tab-btn="pdm"/);
    assert.doesNotMatch(dashboardEjs, /data-setup-tab-btn="roi"/);
    assert.doesNotMatch(dashboardEjs, /data-setup-tab-btn="hmi"/);
    assert.doesNotMatch(dashboardEjs, /id="proj-hmi-composer-mode"/);
    assert.match(dashboardEjs, /data-popup="cameras"/);
    assert.match(dashboardEjs, /data-popup="training"/);
    assert.match(dashboardEjs, /cameraAdminUi\.js/);
    assert.match(pagesJs, /router\.get\('\/cellular\/sims'/);
    assert.match(pagesJs, /router\.get\('\/cmms'/);
    assert.match(pagesJs, /mooreviewApiBase:\s*'\/api'/);
    assert.match(pagesJs, /router\.get\('\/cloud\/sims'/);
    assert.match(expressRouterJs, /createCellularSimRoutes/);
    assert.match(expressRouterJs, /createSysLogRoutes/);
    assert.match(expressRouterJs, /createUserRoutes/);
    assert.match(expressRouterJs, /requireAuth/);
  });
});

describe('MV Draw composer integration', () => {
  it('exposes composer 2D grid / 3D / Plan mode buttons', () => {
    const mvDraw = fs.readFileSync(path.join(__dirname, '../views/mv-draw.ejs'), 'utf8');
    assert.match(mvDraw, /data-composer-mode="grid"/);
    assert.match(mvDraw, /data-composer-mode="3d"/);
    assert.match(mvDraw, /data-composer-mode="plan"/);
  });
});
