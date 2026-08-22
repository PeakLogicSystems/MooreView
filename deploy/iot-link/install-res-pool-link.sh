#!/usr/bin/env bash
# Res-Pool-Link appliance install — residential pool & spa + 4 IntelliValves.
# Run as root. See docs/RES_POOL_LINK.md
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export MOOREVIEW_IOT_LINK_ENV_EXAMPLE="${MOOREVIEW_IOT_LINK_ENV_EXAMPLE:-$SCRIPT_DIR/.env.res-pool-link.example}"
exec bash "$SCRIPT_DIR/install.sh"
