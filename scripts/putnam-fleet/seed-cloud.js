#!/usr/bin/env node
'use strict';

/**
 * Seed Putnam County cloud Studio: tenant + putnam-mle-plant project.
 *
 * Putnam cloud deployment is the MLE WWTP plant only (not the lift-station fleet).
 *
 * Usage (on cloud VM after install-saas.sh):
 *   cp deploy/cloud/.env.putnam.example .env
 *   # edit MONGODB_URI, MOSQUITTO_PASS, etc.
 *   npm run putnam-fleet:seed-cloud
 *
 * Requires MongoDB (MOOREVIEW_CONFIG_URI). Sets MOOREVIEW_TENANT_ID=putnam-county-utilities
 * when not already configured.
 */

process.env.MOOREVIEW_DEPLOYMENT = process.env.MOOREVIEW_DEPLOYMENT || 'cloud';
process.env.MOOREVIEW_TENANT_ID = process.env.MOOREVIEW_TENANT_ID || 'putnam-county-utilities';
process.env.MOOREVIEW_SEED_TENANT = process.env.MOOREVIEW_SEED_TENANT || 'putnam-county-utilities';

const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');

require(path.join(ROOT, 'src/loadEnv'));

const { CONFIG_URI, TENANT_ID } = require(path.join(ROOT, 'src/config'));
const { TENANT, PLANT, fleetManifest } = require('./fleet-data');

const PLANT_PROJECT = fleetManifest().plantProject;
const STARTUP_PROJECT = process.env.MOOREVIEW_STARTUP_PROJECT || PLANT_PROJECT;

async function main() {
  if (CONFIG_URI === 'memory') {
    console.error('[putnam-cloud] MongoDB required (MOOREVIEW_CONFIG_URI / MONGODB_URI).');
    process.exit(1);
  }

  console.log(`[putnam-cloud] tenant scope: ${TENANT_ID}`);
  console.log(`[putnam-cloud] plant only: ${PLANT.name} (${PLANT.gatewayId})`);

  execFileSync(process.execPath, [path.join(__dirname, 'generate-artifacts.js')], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  const configStore = require(path.join(ROOT, 'src/configStore'));
  const mongoBackend = require(path.join(ROOT, 'src/configStore/mongoBackend'));
  const { readFileJson } = require(path.join(ROOT, 'src/configStore/migrateFromFiles'));
  const { safeId } = require(path.join(ROOT, 'src/project/projectIds'));
  const persistence = require(path.join(ROOT, 'src/persistence'));
  const { defaultMqttParcSettings } = require(path.join(ROOT, 'src/parc/mqttParcBootstrap'));

  await configStore.init();

  const doc = readFileJson(path.join('projects', `${PLANT_PROJECT}.est.json`), null);
  if (!doc) {
    throw new Error(`Missing data/projects/${PLANT_PROJECT}.est.json after generate-artifacts`);
  }
  const projectId = safeId(PLANT_PROJECT);
  await mongoBackend.writeProjectSnapshot(projectId, doc, { name: doc?.project?.name || PLANT_PROJECT });

  const prev = persistence.readJson('settings.json', {});
  const settings = {
    ...prev,
    project: {
      ...(prev.project || {}),
      name: STARTUP_PROJECT,
      lastOpenedId: safeId(STARTUP_PROJECT),
    },
    startup: {
      mode: 'saved_project',
      projectId: STARTUP_PROJECT,
      promptOnBoot: false,
    },
    autoStartRuntime: true,
    remoteExecution: true,
    mqttParc: {
      ...defaultMqttParcSettings(prev.mqttParc || {}),
      enabled: true,
      autoDiscoverDrivers: true,
      cloudTenantIngest: true,
    },
  };
  persistence.writeJson('settings.json', settings);
  await mongoBackend.writeDocument('settings.json', settings);
  await persistence.flushConfig();

  const { tenantStore } = require(path.join(ROOT, 'src/tenants/tenantStore'));
  let tenant = tenantStore.getTenant(TENANT.slug);
  if (!tenant) {
    tenant = tenantStore.createTenant({
      tenantSlug: TENANT.slug,
      name: TENANT.name,
      cmmsEnabled: true,
    });
    tenant = tenantStore.getTenant(TENANT.slug);
  }

  const opEmail = (process.env.MOOREVIEW_SEED_OPERATOR_EMAIL || 'operator@putnam.local').toLowerCase();
  const opPass = process.env.MOOREVIEW_SEED_OPERATOR_PASSWORD || 'change-me';
  if (!tenantStore.findUserByEmail(opEmail)) {
    tenantStore.createUser({
      email: opEmail,
      password: opPass,
      name: 'Putnam Operator',
      role: 'tenant_admin',
      tenantId: tenant.tenantId,
      invite: false,
    });
    console.log(`[putnam-cloud] operator user: ${opEmail}`);
  }

  await configStore.shutdown();

  console.log('');
  console.log('[putnam-cloud] Putnam MLE plant cloud seed complete');
  console.log(`  tenant:     ${TENANT.slug} (${TENANT.name})`);
  console.log(`  project:    ${PLANT_PROJECT}`);
  console.log(`  startup:    ${STARTUP_PROJECT}`);
  console.log(`  gateway:    ${PLANT.gatewayId}`);
  console.log(`  mongo key:  ${TENANT_ID}:*`);
  console.log('');
  console.log('Next: restart MooreVIEW cloud runtime, sign in as org putnam-county-utilities,');
  console.log(`      operator ${opEmail} (see MOOREVIEW_SEED_OPERATOR_* in .env),`);
  console.log(`      open Project → ${PLANT_PROJECT}.`);
  console.log('      Pair the IOT-LINK appliance via cloudRemote (gateway ' + PLANT.gatewayId + ').');
  console.log('');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
