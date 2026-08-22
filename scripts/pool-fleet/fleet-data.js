'use strict';

/** MooreVIEW residential pool cloud — tenant + site metadata. */

const TENANT = {
  tenantId: 'pool-cloud',
  tenantSlug: 'pool-cloud',
  name: 'Pool Cloud',
};

const RESIDENTIAL_SITE = {
  profileId: 'residential-pool',
  name: 'Maple Street Pool',
  slug: 'maple-street',
  address: '742 Maple Street, DeLand, FL 32724',
  lat: 29.0286,
  lng: -81.3031,
  cloudProject: 'pool-cloud-residential',
};

const RESIDENTIAL_DEVICE = {
  name: 'Maple Street — pool gateway',
  slug: 'maple-pool',
  deviceId: 'mv_pool_maple_01',
  driverId: 'pool_gateway',
  fleetAlarmTag: 'FLEET_MAPLE_POOL_ALM',
  category: 'pool',
};

/** Chemistry + status tags surfaced to homeowners (mobile/cloud). */
const TELEMETRY_TAGS = [
  'PH_PV',
  'ORP_PV',
  'COND_PV',
  'POOL_FLOW_OK',
  'PUMP_RPM',
  'MOTOR1_RUN',
  'ALM_PH_LO',
  'ALM_PH_HI',
  'ALM_ORP_LO',
  'ALM_ORP_HI',
  'ALM_FLOW_LO',
  'SITE_ALM',
];

function profileManifest() {
  return {
    profileId: RESIDENTIAL_SITE.profileId,
    name: RESIDENTIAL_SITE.name,
    tenant: TENANT,
    site: RESIDENTIAL_SITE,
    devices: [RESIDENTIAL_DEVICE],
    telemetryTags: TELEMETRY_TAGS,
    homeownerRole: 'homeowner',
    defaultProject: RESIDENTIAL_SITE.cloudProject,
    description: 'Residential pool — water quality and status via cellular gateway uplink',
  };
}

module.exports = {
  TENANT,
  RESIDENTIAL_SITE,
  RESIDENTIAL_DEVICE,
  TELEMETRY_TAGS,
  profileManifest,
};
