'use strict';

const { WebSocketServer } = require('ws');
const { LIVE_WS_INTERVAL_MS } = require('../config');

const LIVE_WS_PATH = '/api/live';

function wsIntervalMs(tagCount) {
  if (tagCount <= 500) return LIVE_WS_INTERVAL_MS;
  if (tagCount <= 2000) return Math.max(LIVE_WS_INTERVAL_MS, 500);
  return Math.max(LIVE_WS_INTERVAL_MS, 1000);
}

function buildLivePayload(deps, { includeHealth = true } = {}) {
  const { tagStore, driverManager, scanEngine } = deps;
  return {
    runtime: scanEngine.status(),
    live: tagStore.liveSnapshotSlim(),
    tagCount: tagStore.count(),
    ...(includeHealth ? { driverHealth: driverManager.health() } : {}),
  };
}

function bindLiveClient(wss, ws, deps) {
  ws.send(JSON.stringify(buildLivePayload(deps, { includeHealth: true })));

  const tagCount = deps.tagStore.count();
  const intervalMs = wsIntervalMs(tagCount);
  let tick = 0;
  let healthTick = 0;

  const iv = setInterval(() => {
    if (ws.readyState !== ws.OPEN) return;
    tick += 1;
    healthTick += 1;
    const includeHealth = tick === 1 || healthTick >= 8;
    if (includeHealth) healthTick = 0;
    try {
      ws.send(JSON.stringify(buildLivePayload(deps, { includeHealth })));
    } catch {
      /* ignore send errors on closed socket */
    }
  }, intervalMs);

  ws.on('close', () => clearInterval(iv));
  ws.on('error', () => clearInterval(iv));
}

/**
 * Push live tag/runtime updates over WebSocket at /api/live (same path as embedded est).
 * Uses noServer + manual upgrade routing so go2rtc (/api/go2rtc/...) is not rejected.
 * HTTP GET /api/live remains available as a fallback.
 */
function attachLiveWebSocket(httpServer, deps) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const pathname = new URL(String(req.url || '/'), 'http://127.0.0.1').pathname;
    if (pathname !== LIVE_WS_PATH) return;

    wss.handleUpgrade(req, socket, head, (ws) => {
      bindLiveClient(wss, ws, deps);
    });
  });

  return wss;
}

module.exports = {
  attachLiveWebSocket,
  buildLivePayload,
  wsIntervalMs,
  LIVE_WS_PATH,
};
