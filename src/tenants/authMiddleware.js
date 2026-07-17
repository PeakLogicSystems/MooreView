'use strict';

const { tenantStore } = require('./tenantStore');

const COOKIE = 'mv_session';

function readCookie(req, name) {
  const raw = String(req.headers.cookie || '');
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(raw);
  return m ? decodeURIComponent(m[1]) : '';
}

function extractToken(req) {
  const hdr = String(req.headers.authorization || '');
  if (hdr.startsWith('Bearer ')) return hdr.slice(7).trim();
  const q = String(req.query.token || '').trim();
  if (q) return q;
  return readCookie(req, COOKIE);
}

function attachSession(req, res, next) {
  const token = extractToken(req);
  const sess = tenantStore.sessionFromToken(token);
  req.mvAuth = sess;
  req.mvToken = token || null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.mvAuth) {
    if (req.path.startsWith('/api/') || (req.headers.accept || '').includes('application/json')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const nextUrl = encodeURIComponent(req.originalUrl || '/');
    return res.redirect(`/login?next=${nextUrl}`);
  }
  next();
}

function requirePlatformAdmin(req, res, next) {
  if (!req.mvAuth || req.mvAuth.user.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Platform admin required' });
  }
  next();
}

function requireTenantAccess(req, res, next) {
  if (!req.mvAuth) return res.status(401).json({ error: 'Authentication required' });
  if (req.mvAuth.user.role === 'platform_admin') return next();
  if (!req.mvAuth.tenant) return res.status(403).json({ error: 'No tenant context' });
  next();
}

function activeTenantId(req) {
  if (!req.mvAuth) return null;
  if (req.mvAuth.tenant?.tenantId) return req.mvAuth.tenant.tenantId;
  return req.mvAuth.user.tenantId || null;
}

function setSessionCookie(res, token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

module.exports = {
  COOKIE,
  attachSession,
  requireAuth,
  requirePlatformAdmin,
  requireTenantAccess,
  activeTenantId,
  setSessionCookie,
  clearSessionCookie,
  extractToken,
};
