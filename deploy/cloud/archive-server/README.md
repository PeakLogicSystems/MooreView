# Archive server (cloud 2)

zstd blob + index storage for MooreVIEW Mongo compaction. **No MongoDB.**

## Run

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
export MONGODB_URI=mongodb://127.0.0.1:27017
export MONGODB_DB=mooreview
export ARCHIVE_SERVER_URL=http://archive-host:8090
export ARCHIVE_SERVER_TOKEN=change-me
node scripts/run-archive-compact.js
```

Dry run: `ARCHIVE_COMPACT_DRY_RUN=1 node scripts/run-archive-compact.js`

Requires `zstd` CLI on cloud 1 (or `ARCHIVE_USE_GZIP=1` for dev).

See `docs/ARCHIVE_EXPORT.md` for full spec.
