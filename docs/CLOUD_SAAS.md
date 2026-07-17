# Multi-tenant Cloud SaaS

Cloud Studio on port **3100** includes:

- Full Studio (ST, projects, HMI, drivers, historian)
- Multi-tenant auth (organization ID + email + password)
- Sites + remote cameras (agent hub)
- Devices, Assets map, People, CMMS entitlement, Tenant admin

## Seed accounts (first boot)

| Role | Organization ID | Email | Password |
|------|-----------------|-------|----------|
| Operator | `demo` | `operator@demo.local` | `demo` |
| Platform admin | `demo` (optional) | `admin@demo.local` | `ChangeMeAdmin!` |

Override with `MOOREVIEW_SEED_*` env vars in `saas.env`.

## Key routes

| Path | Purpose |
|------|---------|
| `/login` | Org login |
| `/` | Full Studio dashboard |
| `/sites` | Sites + pairing + cameras |
| `/sites/devices` | All devices |
| `/fleet` | Assets map |
| `/people` | Users |
| `/cmms` | CMMS entitlement status |
| `/admin/tenants` | Platform tenant admin |

Data: `data/cloud_tenants.json`, `data/cloud_sites.json`.
