# Archive server (cloud 2)

zstd blob + index storage for mooreVIEW Mongo compaction. **No MongoDB.**

## Phase 1 deployment

Build bundle on Windows, upload via WinSCP:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\create-archive-bundle.ps1
```

Full guide: [deploy/cloud/phase1/WINSCP-DEPLOY.md](../phase1/WINSCP-DEPLOY.md)

Install on droplet:

```bash
MOOREVIEW_SOURCE=/opt/mooreview-archive MOOREVIEW_ARCHIVE_DIR=/opt/mooreview-archive \
  MOOREVIEW_SAAS_IP=<cloud-1-private-ip> \
  bash deploy/cloud/debian/install-archive.sh
```

Config: `/etc/mooreview/archive.env` from [phase1/droplet-archive/archive.env.template](../phase1/droplet-archive/archive.env.template)

## Run (manual / dev)

```bash
mkdir -p /data/archive
export ARCHIVE_ROOT=/data/archive
export ARCHIVE_SERVER_TOKEN=change-me
export PORT=8090
node deploy/cloud/archive-server/server.js
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `PUT` | `/archive/{relativePath}` | Store blob; header `X-SHA256` optional verify |
| `HEAD` | `/archive/{relativePath}` | Metadata + checksum |
| `GET` | `/archive/{relativePath}` | Download; supports `Range: bytes=` |

Auth: `Authorization: Bearer $ARCHIVE_SERVER_TOKEN` (optional if token unset — dev only).

## Cloud 1 compact cron

```bash
bash deploy/cloud/debian/enable-phase1-archive-compact.sh
```

Or manual:

```bash
export MONGODB_URI=mongodb+srv://...
export MONGODB_DB=mooreview_cloud
export ARCHIVE_SERVER_URL=http://10.x.x.x:8090
export ARCHIVE_SERVER_TOKEN=change-me
node scripts/run-archive-compact.js
```

Dry run: `ARCHIVE_COMPACT_DRY_RUN=1 node scripts/run-archive-compact.js`

Requires `zstd` CLI on cloud 1 (or `ARCHIVE_USE_GZIP=1` for dev).

See `docs/ARCHIVE_EXPORT.md` for full spec.
