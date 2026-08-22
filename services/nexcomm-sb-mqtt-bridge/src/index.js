'use strict';

const { startBridge, stopBridge } = require('./bridge');

async function main() {
  const { healthTimer } = await startBridge();

  const shutdown = async (signal) => {
    console.log(`[bridge] ${signal} — shutting down`);
    try {
      await stopBridge(healthTimer);
      process.exit(0);
    } catch (err) {
      console.error('[bridge] shutdown error:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[bridge] fatal:', err);
  process.exit(1);
});
