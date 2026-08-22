'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dashboardEjs = fs.readFileSync(
  path.join(__dirname, '../views/dashboard.ejs'),
  'utf8',
);

describe('dashboard ROI calculator', () => {
  it('renders ROI panel in Reports popup, reachable from Reporting menu', () => {
    assert.doesNotMatch(dashboardEjs, /data-setup-tab-btn="roi"/);
    assert.doesNotMatch(dashboardEjs, /data-setup-tab="roi"/);
    assert.match(dashboardEjs, /data-report-open="roi"/);
    assert.match(dashboardEjs, /\/js\/roiCalculator\.js/);
    const roiPanel = dashboardEjs.match(
      /<details class="report-roi-panel" id="report-roi-panel">([\s\S]*?)<\/details>/,
    );
    assert.ok(roiPanel, 'ROI report panel missing');
    const panelHtml = roiPanel[1];
    assert.match(panelHtml, /id="roi-leak-repair-cost"/);
    assert.match(panelHtml, /value="90"/);
    assert.match(panelHtml, /id="roi-pool-energy-monthly"/);
    assert.match(panelHtml, /id="roi-pool-chem-monthly"/);
    assert.match(panelHtml, /id="roi-combined-summary"/);
    assert.match(panelHtml, /id="btn-report-roi-save"/);
  });
});
