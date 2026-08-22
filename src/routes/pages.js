'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { EST_VERSION } = require('../project/estFile');
const { isCloudSimsEnabled } = require('../cloud/cloudSimsEnabled');
const { isCellularSimsEnabled } = require('../cellular/cellularSimsEnabled');

const PUBLIC_JS = path.join(__dirname, '../../public/js');
const PUBLIC_CSS = path.join(__dirname, '../../public/css');

/** Cache-bust static assets when any primary UI bundle changes (not only app.js). */
function assetVersion(appVersion) {
  const files = [
    path.join(PUBLIC_JS, 'app.js'),
    path.join(PUBLIC_JS, 'mvDrawApp.js'),
    path.join(PUBLIC_CSS, 'mv-draw.css'),
    path.join(PUBLIC_CSS, 'pc.css'),
  ];
  let mtime = 0;
  for (const file of files) {
    try {
      mtime = Math.max(mtime, Math.floor(fs.statSync(file).mtimeMs));
    } catch {
      /* optional file */
    }
  }
  return mtime ? `${appVersion}.${mtime}` : appVersion;
}

function createPageRoutes({ appVersion, product, deployment }) {
  const router = express.Router();
  const dep = deployment || 'appliance';
  router.get('/', (req, res) => {
    res.render('dashboard', dashboardViewLocals({ appVersion, product, deployment: dep }));
  });
  router.get('/mv-draw', (req, res) => {
    const embedded = String(req.query.embedded || '').trim() === '1'
      || String(req.query.embedded || '').toLowerCase() === 'true';
    res.render('mv-draw', dashboardViewLocals({ appVersion, product, deployment: dep, embedded }));
  });
  router.get('/io-map', (req, res) => {
    res.render('io-map', dashboardViewLocals({ appVersion, product, deployment: dep }));
  });
  router.get('/cellular/sims', (req, res) => {
    res.render('cellular-sims', {
      ...dashboardViewLocals({ appVersion, product, deployment: dep }),
      homeUrl: '/',
      mooreviewApiBase: '/api',
      connectivityBuild: process.env.MOOREVIEW_CONNECTIVITY_BUILD || '',
    });
  });
  router.get('/cloud/sims', (req, res) => {
    res.render('cloud-sims', dashboardViewLocals({ appVersion, product, deployment: dep }));
  });
  router.get('/cmms', (req, res) => {
    res.render('cmms', dashboardViewLocals({ appVersion, product, deployment: dep }));
  });
  return router;
}

function dashboardViewLocals({ appVersion, product, deployment, embedded }) {
  const dep = deployment || 'appliance';
  return {
    title: dep === 'cloud' ? 'MooreVIEW Cloud Studio' : 'MooreVIEW',
    assetV: assetVersion(appVersion),
    appVersion,
    product: product || 'mvp-suite',
    deployment: dep,
    isCloud: dep === 'cloud',
    embedded: !!embedded,
    companyName: 'The Purple Standard',
    estVersion: EST_VERSION,
    cloudSimsEnabled: isCloudSimsEnabled(),
    cellularSimsEnabled: isCellularSimsEnabled(),
  };
}

module.exports = { createPageRoutes, dashboardViewLocals };
