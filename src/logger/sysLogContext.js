'use strict';

const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

function runWithContext(ctx, fn) {
  return storage.run(ctx || {}, fn);
}

function getContext() {
  return storage.getStore() || {};
}

function mergeContext(patch) {
  const cur = getContext();
  return { ...cur, ...(patch || {}) };
}

/** Cloud gateway / auth middleware attaches user on req; normalize for syslog. */
function userFromRequest(req) {
  if (!req || typeof req !== 'object') return null;
  if (req.mvAuth?.user && typeof req.mvAuth.user === 'object') {
    const u = req.mvAuth.user;
    return {
      id: String(u.userId || u.id || '').trim() || null,
      email: String(u.email || '').trim() || null,
      name: String(u.name || u.displayName || '').trim() || null,
      role: String(u.role || '').trim() || null,
    };
  }
  if (req.mooreviewUser && typeof req.mooreviewUser === 'object') {
    const u = req.mooreviewUser;
    return {
      id: String(u.id || u.userId || '').trim() || null,
      email: String(u.email || '').trim() || null,
      name: String(u.name || u.displayName || '').trim() || null,
      role: String(u.role || '').trim() || null,
    };
  }
  const h = req.headers || {};
  const id = String(h['x-mooreview-user-id'] || h['x-user-id'] || '').trim();
  const email = String(h['x-mooreview-user-email'] || h['x-user-email'] || '').trim();
  const name = String(h['x-mooreview-user-name'] || '').trim();
  const role = String(h['x-mooreview-user-role'] || '').trim();
  if (!id && !email && !name) return null;
  return {
    id: id || null,
    email: email || null,
    name: name || null,
    role: role || null,
  };
}

module.exports = {
  runWithContext,
  getContext,
  mergeContext,
  userFromRequest,
};
