#!/usr/bin/env node
'use strict';

/**
 * Build IOT-LINK pool .est snapshot and publish to project hub (local and/or MV Cloud).
 *
 * Usage:
 *   node scripts/publish-pool-project.js
 *   node scripts/publish-pool-project.js --local
 *   node scripts/publish-pool-project.js --cloud
 *   node scripts/publish-pool-project.js --local --cloud --seed
 *
 * Cloud publish requires cloudRemote in settings.json (pair appliance) or Studio JWT via
 * MOOREVIEW_CLOUD_API_URL + MOOREVIEW_CLOUD_TOKEN for CI.
 */
require('../src/loadEnv');

const persistence = require('../src/persistence');
const projectHubStore = require('../src/project/projectHubStore');
const projectHubCloudClient = require('../src/project/projectHubCloudClient');
const { packEst } = require('../src/project/projectBundle');
const PACKAGE_VERSION = require('../package.json').version;
const {
  PROJECT_ID,
  buildIotLinkPoolEstDoc,
  seedIotLinkPoolConfig,
} = require('../src/appliance/iotLinkPoolSeed');

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function publishToCloud(doc, meta) {
  const token = String(process.env.MOOREVIEW_CLOUD_TOKEN || '').trim();
  const apiUrl = String(process.env.MOOREVIEW_CLOUD_API_URL || '').trim().replace(/\/+$/, '');
  if (token && apiUrl) {
    const res = await fetch(`${apiUrl}/api/project-hub/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: meta.name, description: meta.description, doc }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Cloud publish failed (${res.status})`);
    return data;
  }
  return projectHubCloudClient.publishToCloud(doc, meta);
}

async function main() {
  const wantLocal = hasFlag('--local') || (!hasFlag('--cloud-only') && !hasFlag('--cloud'));
  const wantCloud = hasFlag('--cloud') || hasFlag('--cloud-only');
  const doSeed = hasFlag('--seed') || hasFlag('--force-seed');
  const force = hasFlag('--force-seed');

  if (doSeed) {
    const seeded = await seedIotLinkPoolConfig(persistence, { force });
    if (seeded.seeded) {
      console.log(`[publish-pool] seeded workspace (${seeded.tagCount} tags)`);
    } else {
      console.log(`[publish-pool] seed skipped: ${seeded.reason}`);
    }
  }

  let doc = persistence.readJson('workspace.est.json', null);
  if (!doc?.tags?.length) {
    doc = buildIotLinkPoolEstDoc();
    console.log('[publish-pool] built pool snapshot from fixtures');
  }

  const name = String(doc.project?.name || PROJECT_ID).trim() || PROJECT_ID;
  const description = 'IOT-LINK pool controller (Speck, Pentair, Opta MQTT)';
  const bundle = packEst(doc, { name, exportedBy: PACKAGE_VERSION });

  if (wantLocal) {
    const entry = projectHubStore.publishDoc(name, bundle, {
      slug: 'iot-link-pool',
      description,
    });
    console.log(`[publish-pool] local repository: ${projectHubStore.HUB_DIR}`);
    console.log(`[publish-pool]   id=${entry.id}  file=${entry.filename}`);
  }

  if (wantCloud) {
    const result = await publishToCloud(bundle, { name, description, slug: 'iot-link-pool' });
    const entry = result.entry || result;
    console.log(`[publish-pool] cloud repository: ${entry.name || name} (v${entry.version || '?'})`);
  }

  if (!wantLocal && !wantCloud) {
    console.error('[publish-pool] specify --local and/or --cloud');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[publish-pool] failed:', e.message || e);
  process.exit(1);
});
