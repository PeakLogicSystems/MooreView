#!/bin/bash
set -euo pipefail
cd /home/mooreview
echo "=== repair code ==="
grep -n ensureHvacSplitHmi src/project/estFile.js 2>/dev/null || echo "MISSING ensureHvacSplitHmi"
ls -la src/hmi/hvacSplitScreen.js data/projects/opta-split-hvac.est.json 2>&1 || true
echo "=== library zip ==="
python3 <<'PY'
import zipfile, json, os
for p in [
  "data/projects/opta-split-hvac.est.zip",
  "data/tenants/219c5c35-8415-4409-a13c-9059d698c998/projects/opta-split-hvac.est.zip",
]:
    print("\n", p)
    if not os.path.exists(p):
        print("  MISSING")
        continue
    d = json.loads(zipfile.ZipFile(p).read("project.json"))
    h = d.get("settings", {}).get("hmi", {})
    print("  3d:", h.get("layout", {}).get("facility3dUrl"))
    for s in h.get("screens", []):
        print(" ", s.get("number"), s.get("name"), s.get("svg") or "(no svg)")
PY
echo "=== assets ==="
ls -la public/hmi/svg/demos/opta-split-hvac/ 2>&1 || echo "SVG dir missing"
ls -la public/samples/opta-split-hvac-ortho-3d.html 2>&1 || echo "3d html missing"
echo "=== service ==="
systemctl is-active mooreview-saas || true
