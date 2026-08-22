'use strict';

/** Opta Parc defaults to mooreview.io cloud API. Override via env or inject. */
window.MOOREVIEW_API_BASE = window.MOOREVIEW_API_BASE
  || (typeof MOOREVIEW_API_BASE_INJECT !== 'undefined' ? MOOREVIEW_API_BASE_INJECT : '')
  || 'https://mooreview.io/api';
