'use strict';
/**
 * Resolve MooreVIEW REST root for facility / sample 3D pages.
 * Appliance: /api · Cloud Studio: /api/studio
 * Override: ?mvApi=… · window.MV_API_BASE · parent.MOOREVIEW_API_BASE
 */
(function initMvLiveApiRoot(global) {
  function fromQuery() {
    try {
      const q = new URLSearchParams(global.location.search || '');
      return String(q.get('mvApi') || q.get('apiBase') || '').trim();
    } catch {
      return '';
    }
  }
  function fromParent() {
    try {
      if (global.parent && global.parent !== global && global.parent.MOOREVIEW_API_BASE) {
        return String(global.parent.MOOREVIEW_API_BASE).trim();
      }
    } catch { /* cross-origin */ }
    return '';
  }
  let root = String(global.MV_API_BASE || '').trim() || fromQuery() || fromParent();
  if (!root) {
    // Cloud Studio paths usually include /studio
    const path = String(global.location.pathname || '');
    root = (/\/studio\b/i.test(path) || /mooreview\.io/i.test(global.location.host || ''))
      ? '/api/studio'
      : '/api';
  }
  global.MV_API_BASE = root.replace(/\/$/, '');
  global.addEventListener('message', (ev) => {
    const data = ev?.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'mooreview-api-base' && typeof data.apiBase === 'string' && data.apiBase.trim()) {
      global.MV_API_BASE = data.apiBase.trim().replace(/\/$/, '');
    }
  });
}(typeof window !== 'undefined' ? window : globalThis));
