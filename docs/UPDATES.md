# MooreVIEW updates (no WinSCP)

One workflow: **push from your PC → pull on the target**. GitHub is the transfer layer.

| Repo | Folder | Deploy target |
|------|--------|---------------|
| `mooreview-pc` | `est-pc/` | MVP Suite, IOT-LINK (`/opt/mooreview`) |
| `mooreview-cloud` | `mooreview-cloud/` | Cloud droplet (`/home/mooreview`) |
| `mooreview-est` | `est/` | Embedded Linux / OpenWrt (`/opt/mooreview`) |

## Dev machine (Windows)

From `est-pc`:

```powershell
# Test, sync runtime into mooreview-cloud, push both repos
powershell -File scripts/publish-update.ps1

# Optional: pull on droplet immediately after push
powershell -File scripts/publish-update.ps1 -RemoteUpdate root@mooreview-cloud
```

Manual steps (same result):

```powershell
cd C:\Users\public\data\est-pc
npm test
powershell -File scripts\sync-runtime-to-cloud.ps1
git push origin main

cd C:\Users\public\data\mooreview-cloud
git push origin main
```

For embedded `est/`:

```powershell
cd C:\Users\public\data\est
npm test
git push origin main
```

## Target host (Linux)

All targets use the same script (preserves `data/`, `/etc/mooreview/*`, restarts systemd):

```bash
sudo bash deploy/update-from-github.sh
```

### Cloud droplet (`/home/mooreview`)

First-time: use `deploy/cloud/debian/install-saas.sh` (or clone repo there).

Updates:

```bash
ssh root@mooreview-cloud
sudo bash /home/mooreview/deploy/update-from-github.sh
```

Defaults: repo `RoyMooreACE/mooreview-cloud`, service `mooreview-saas`.

### IOT-LINK / appliance (`/opt/mooreview`)

```bash
ssh root@<gateway-ip>
sudo MOOREVIEW_INSTALL_DIR=/opt/mooreview bash /opt/mooreview/deploy/update-from-github.sh
```

Defaults: repo `RoyMooreACE/mooreview-pc`.

### Embedded `est` (`/opt/mooreview`, port 3080)

```bash
ssh root@<device>
sudo bash /opt/mooreview/deploy/update-from-github.sh
```

Defaults: repo `RoyMooreACE/mooreview-est`, service `mooreview-runtime`.

Override repo/branch:

```bash
sudo MOOREVIEW_GITHUB_REPO=YourOrg/mooreview-pc \
     MOOREVIEW_GITHUB_BRANCH=main \
     bash deploy/update-from-github.sh
```

## Tagged releases (optional)

Tag `est-pc` on GitHub — Actions build and attach bundles:

```powershell
cd C:\Users\public\data\est-pc
git tag v2.3.9
git push origin v2.3.9
```

On a target without git (or pinned version):

```bash
sudo bash deploy/update-from-github.sh --release v2.3.9
```

Assets: `mooreview-appliance-<ver>.tgz`, `mooreview-cloud-<ver>.tgz`, `mooreview-est-<ver>.tgz`.

## One-time: convert tarball install → git pull

If the host was installed from a `.tgz` (no `.git` yet), the update script clones from GitHub, rsyncs code over the install dir (keeps `data/`), then tracks git for future pulls.

## GitHub setup

1. Push `est-pc` → `RoyMooreACE/mooreview-pc` (or your org)
2. Push `mooreview-cloud` → `RoyMooreACE/mooreview-cloud`
3. Push `est` → `RoyMooreACE/mooreview-est`
4. On each server, clone once **or** run update script after first tarball install
5. For private cloud repo in Release workflow: set repo secret `CLOUD_REPO_TOKEN`

## What this replaces

| Old | New |
|-----|-----|
| WinSCP bundle upload | `git push` + `update-from-github.sh` on host |
| `create-cloud-bundle.ps1` + scp | `publish-update.ps1` or Release asset |
| USB / sneakernet | SSH + git pull (or `--release`) |

Keep `create-cloud-bundle.ps1` for air-gapped sites only.

## Troubleshooting

```bash
# Cloud health
curl -sS http://127.0.0.1:3100/health

# Service logs
journalctl -u mooreview-saas -n 50 --no-pager
journalctl -u mooreview-iot-link-generic -n 50 --no-pager

# Dry run
sudo bash deploy/update-from-github.sh --dry-run
```

Private repo on target: `export GITHUB_TOKEN=ghp_...` before running update (read-only token is enough).
