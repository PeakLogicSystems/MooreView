# mooreVIEW appliance model

Single codebase, two install targets:

| Profile | Platform | Output | Install |
|---------|----------|--------|---------|
| **mvp-suite** | Windows PC | `dist/mooreview-appliance-mvp-suite-*` | `Install mooreVIEW.bat` |
| **iot-link-generic** | Linux / IoT-Link | `dist/mooreview-appliance-iot-link-generic-*.tgz` | `deploy/iot-link/install-generic.sh` |

Both run `MOOREVIEW_DEPLOYMENT=appliance` with **single-tenant login**, feature access matrix, and Mongo audit logging.

## Build (Windows dev machine)

```powershell
cd est-pc

# PC portable folder (WinSCP/USB to another Windows PC)
npm run build:appliance:pc

# IoT-Link Linux tarball (WinSCP/scp to gateway)
npm run build:appliance:iot-link

# Both
npm run build:appliance
```

## PC install

1. Copy `dist/mooreview-appliance-mvp-suite-*` to target PC
2. **Install mooreVIEW.bat**
3. **Start mooreVIEW.bat** → http://127.0.0.1:3090/login
4. Default login: `admin@local` / `ChangeMeAdmin!`
5. Optional: install MongoDB for historian

Bundled project: **duplex-lift-station** (`.est.zip` in `data/projects/`)

## IoT-Link install

1. Upload `mooreview-appliance-iot-link-generic-*.tgz` to `/tmp/`
2. Extract to `/opt/mooreview`:
   ```bash
   mkdir -p /opt/mooreview
   tar xzf /tmp/mooreview-appliance-iot-link-generic-*.tgz -C /opt/mooreview --strip-components=1
   ```
3. Install:
   ```bash
   MOOREVIEW_SOURCE=/opt/mooreview MOOREVIEW_INSTALL_DIR=/opt/mooreview \
     bash /opt/mooreview/deploy/iot-link/install-generic.sh
   ```
4. Open http://\<gateway-ip\>:3090/login

Provisions: Node 20, MongoDB, Mosquitto, systemd `mooreview-iot-link-generic.service`

## Configuration

| Item | PC | IoT-Link |
|------|-----|----------|
| Env file | `.env` in app folder | `/etc/mooreview/env` |
| Data | `./data` | `/var/lib/mooreview` |
| Profile JSON | `deploy/appliance/profiles/mvp-suite.json` | `deploy/appliance/profiles/iot-link-generic.json` |
| Env template | `deploy/appliance/env/.env.mvp-suite.example` | `deploy/appliance/env/.env.iot-link-generic.example` |

## Users and access

- **Login accounts:** System setup → **Features** tab (admin only)
- **Alarm notifications:** Alarms → Notification users (separate from login)
- Default accounts seeded on first boot — change passwords before production

## Updates

**IoT-Link:** `bash deploy/iot-link/update.sh` (preserves `/var/lib/mooreview` and env)

**PC:** copy new bundle over app folder; keep `data/`; re-run `npm install`

## Related

- [deploy/iot-link/README-generic.md](../iot-link/README-generic.md)
- [deploy/windows/README-windows-installer.md](../windows/README-windows-installer.md)
- [docs/EST_PC_PARITY.md](../../docs/EST_PC_PARITY.md)
