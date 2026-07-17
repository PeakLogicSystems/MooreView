# MooreVIEW CMMS Integration v1

MooreVIEW is the **authoritative source** for alarm MQTT integration. CMMS systems (including TPS CMMS) **subscribe** to MooreVIEW-published topics; MooreVIEW does not adapt to undocumented CMMS formats.

## Direction

```
Tag alarm → alarm:transition → cmmsAlarmPublisher → MQTT broker → CMMS subscriber
```

## MQTT topics

Given `topicPrefix` (default `mooreview/v1`) and `siteId` (default `local`):

| Topic | Purpose |
|-------|---------|
| `{topicPrefix}/{siteId}/alarms` | Alarm transition event only |
| `{topicPrefix}/{siteId}/alarm-notify` | Alarm + filtered notification recipients |

**Examples** (site `plant-a`):

- `mooreview/v1/plant-a/alarms`
- `mooreview/v1/plant-a/alarm-notify`

QoS defaults to **1**. Broker URL defaults to `mqtt://127.0.0.1:1883` (same as Parc).

## JSON schema: `mooreview-cmms-integration-v1`

### Envelope (both topics)

```json
{
  "schema": "mooreview-cmms-integration-v1",
  "publishedAt": "2026-06-14T18:30:00.000Z",
  "siteId": "plant-a",
  "tenantId": "local",
  "source": "mooreview",
  "projectName": "line_a",
  "alarm": {
    "tagId": "TANK1_LEVEL",
    "level": "outerHigh",
    "previousLevel": "innerHigh",
    "value": 92.5,
    "since": 1718389800123
  }
}
```

### `alarm-notify` topic (adds recipients)

```json
{
  "schema": "mooreview-cmms-integration-v1",
  "publishedAt": "2026-06-14T18:30:00.000Z",
  "siteId": "plant-a",
  "tenantId": "local",
  "source": "mooreview",
  "projectName": "line_a",
  "alarm": {
    "tagId": "TANK1_LEVEL",
    "level": "outerHigh",
    "previousLevel": "innerHigh",
    "value": 92.5,
    "since": 1718389800123
  },
  "recipients": [
    {
      "id": "uuid",
      "email": "operator@plant.test",
      "role": "operator",
      "active": true,
      "profile": {
        "displayName": "Pat Operator",
        "firstName": "Pat",
        "lastName": "Operator",
        "title": "Shift lead",
        "department": "Operations",
        "phone": "",
        "mobile": "+15550100",
        "locale": "en-US",
        "timezone": "America/New_York",
        "alarmNotifications": {
          "enabled": true,
          "email": true,
          "sms": false,
          "push": false,
          "minLevel": "inner",
          "emailAddress": "",
          "phone": "+15550100",
          "quietHours": {
            "enabled": false,
            "start": "22:00",
            "end": "07:00",
            "timezone": "America/New_York"
          }
        }
      },
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

Recipients are MooreVIEW **public user** rows, filtered by `shouldNotifyForLevel` and quiet hours (same rules as local email/SMS queue).

## Alarm levels

`innerLow`, `innerHigh`, `outerLow`, `outerHigh`, `alarm` (BOOL), `normal` (clear — not published on transition into alarm).

## MooreVIEW configuration

### UI

**Alarms → Notification users… → CMMS / MQTT integration**

- Enable CMMS MQTT publish
- Broker URL, site ID, tenant ID, topic prefix, client ID
- Toggle each topic

### `data/settings.json`

```json
{
  "cmmsIntegration": {
    "enabled": true,
    "brokerUrl": "mqtt://127.0.0.1:1883",
    "topicPrefix": "mooreview/v1",
    "siteId": "plant-a",
    "tenantId": "acme",
    "clientId": "mooreview-cmms",
    "qos": 1,
    "publishAlarmTopic": true,
    "publishNotifyTopic": true
  }
}
```

### API

`PUT /api/settings` with body `{ "cmmsIntegration": { ... } }`

## TPS CMMS implementer notes

TPS CMMS today ingests IoT via HTTP/MongoDB rules (`routes/iot.js`). To consume MooreVIEW alarms:

1. Subscribe to `mooreview/v1/{siteId}/alarm-notify` on your MQTT broker.
2. On message, parse `schema === "mooreview-cmms-integration-v1"`.
3. Create or update a work order from `alarm` + optional `recipients[0]` assignee hints.
4. Map `alarm.level` to CMMS priority: e.g. `outerHigh`/`alarm` → `high` or `critical`.

See `C:\Users\Public\data\tpscmms\docs\MOOREVIEW_CMMS.md` for a minimal subscriber checklist.

## Cloud multi-tenant (mooreview-cloud)

On the **cloud platform**, TPS CMMS is a first-class module enabled **per tenant** by platform administration — not bundled for every signup.

| Mode | CMMS availability |
|------|-------------------|
| **Integrated appliance** (est-pc) | CMMS UI runs in-process; always available locally; cloud entitlement N/A |
| **Standalone edge + cloud CMMS** | Edge publishes MQTT v1; cloud TPS CMMS subscriber ingests with `tenantId` from payload |
| **Cloud tenant** | CMMS API/UI gated by `tenants.cmms.enabled`; platform admin enables via `PATCH /api/admin/tenants/:id/cmms` |

Tenant users see CMMS routes only when `cmmsEnabled` is true on `GET /api/tenant` / `GET /api/auth/me`. MooreVIEW CMMS Integration v1 MQTT from edge appliances is unchanged — cloud ingest does not require the tenant UI flag, but product UI should respect entitlement.

See `mooreview-cloud/docs/CMMS_ENTITLEMENT.md` for API details.

## Code references (est-pc)

| File | Role |
|------|------|
| `src/integrations/cmmsAlarmPublisher.js` | Payload builder + MQTT publish |
| `src/settings/cmmsIntegrationSettings.js` | Settings normalization |
| `src/runtime/applianceServices.js` | `alarm:transition` hook |
| `src/users/userProfileSchema.js` | Recipient profile shape |
