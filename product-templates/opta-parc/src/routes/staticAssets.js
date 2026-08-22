'use strict';

const path = require('path');
const fs = require('fs');

function createHmiAssetRedirect(publicRoot) {
  return (req, res, next) => {
    if (!req.path.startsWith('/hmi/svg/library/')) return next();
    const rel = req.path.replace(/^\/hmi\//, 'hmi/');
    const file = path.join(publicRoot, rel);
    if (fs.existsSync(file)) return next();
    res.status(404).send('HMI asset not found (run fork without -SkipHmiAssets or copy library)');
  };
}

module.exports = { createHmiAssetRedirect };
