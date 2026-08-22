'use strict';

const path = require('path');
const express = require('express');
const { createPageRoutes } = require('./src/routes/pages');
const { createHmiAssetRedirect } = require('./src/routes/staticAssets');

const { version: APP_VERSION } = require('./package.json');
const publicRoot = path.join(__dirname, 'public');
const apiBase = process.env.MOOREVIEW_API_BASE || '';

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.locals.mooreviewApiBase = apiBase;
app.use(createHmiAssetRedirect(publicRoot));
app.use(express.static(publicRoot));
app.use(createPageRoutes({
  appVersion: APP_VERSION,
  product: 'client',
  mooreviewApiBase: apiBase,
}));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    app: 'MooreVIEW',
    product: 'client',
    version: APP_VERSION,
    apiBase: apiBase || '(same origin /api)',
  });
});

const port = +(process.env.PORT || 3080);
app.listen(port, '0.0.0.0', () => {
  console.log(`MooreVIEW Client  http://127.0.0.1:${port}`);
  if (apiBase) console.log(`API base: ${apiBase}`);
  else console.log('API: same host /api (set MOOREVIEW_API_BASE for remote server)');
});

module.exports = { app };
