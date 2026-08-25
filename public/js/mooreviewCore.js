'use strict';

/** Shared DOM / string helpers for MooreView client modules */
window.MooreviewCore = {
  $(id) {
    return document.getElementById(id);
  },
  esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  },
  on(id, fn) {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
  },
  onChange(id, fn) {
    const el = document.getElementById(id);
    if (el) el.onchange = fn;
  },
};
