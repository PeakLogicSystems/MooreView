#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');

const PORT = Number(process.env.PROTO_SNIFF_PORT) || 3210;

function findPids(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port}"`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (pid > 0) pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

const pids = findPids(PORT);
if (!pids.length) {
  console.log(`No process listening on port ${PORT}.`);
  process.exit(0);
}

for (const pid of pids) {
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
    console.log(`Stopped PID ${pid}`);
  } catch (e) {
    console.error(`Failed to stop PID ${pid}:`, e.message || e);
    process.exit(1);
  }
}
