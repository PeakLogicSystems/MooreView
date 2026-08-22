'use strict';

const path = require('path');
const express = require('express');
const { createPageRoutes } = require('./src/routes/pages');
const { createHmiAssetRedirect } = require('./src/routes/staticAssets');

const { version: APP_VERSION } = require('./package.json');
const publicRoot = path.join(__dirname, 'public');
/** Default cloud SaaS API; override with MOOREVIEW_API_BASE if needed. */
const DEFAULT_API_BASE = 'https://mooreview.io/api';
const apiBase = process.env.MOOREVIEW_API_BASE || DEFAULT_API_BASE;

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.locals.mooreviewApiBase = apiBase;
app.use(createHmiAssetRedirect(publicRoot));
app.use(express.static(publicRoot));
app.use(createPageRoutes({
  appVersion: APP_VERSION,
  product: 'opta-parc',
  mooreviewApiBase: apiBase,
}));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    app: 'MooreVIEW',
    product: 'opta-parc',
    version: APP_VERSION,
    apiBase,
  });
});

const port = +(process.env.PORT || 3081);
app.listen(port, '0.0.0.0', () => {
  console.log(`MooreVIEW Opta Parc  http://127.0.0.1:${port}`);
  console.log(`API base: ${apiBase}`);
});

module.exports = { app };
