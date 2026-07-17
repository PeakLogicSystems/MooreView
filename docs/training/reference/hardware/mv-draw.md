# MV Draw

Scaled site-plan layout editor for septic system design. Ships as a MooreVIEW module with a standalone UI at `/mv-draw` and optional embed in `.est` project files.

## Features (current)

- Free-form canvas with pan and zoom
- **Snap & align** — grid/object snap while dragging or placing; multi-select (Shift+click); align and distribute tools
- Septic symbol library (tank, D-box, pump chamber, leach trench, cleanout, building)
- **ATU / lift symbols:** 1,250 gal treatment tank, 1,250 gal 2-compartment trash tank, **1,500 gal dosing tank (duplex pumps)**, simplex lift, duplex lift, quad dual-duplex ATU (dual TPO), drip drainfield, drip irrigation (4 legs + return), drip leg/lateral
- Pipe/trench connections between symbol ports
- Two-point scale calibration on scanned backgrounds
- **Drawing extents** — two-corner site/plot boundary; Fit view, PDF/DXF crop
- Background image upload (PNG/JPG)
- **File menu** — New, Open (server library or local `.mvdraw.json`), Save, Save as, **Help**
- In-app **Help** dialog (<kbd>F1</kbd>) — tools, symbols, snap/align, shortcuts
- Save/load `.mvdraw` projects and MooreVIEW `.est` integration (`mvDraw` section)
- PDF export (vector layout + optional background)
- DXF export (lines, polylines, blocks — basic R12-style)

## Roadmap

- DXF/DWG background import
- Dimension annotations and title block templates
- Setback advisory overlays
- Link diagram nodes to MooreVIEW tags / Parc devices

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/mv-draw/project` | Active project |
| PUT | `/api/mv-draw/project` | Save project |
| POST | `/api/mv-draw/project/new` | Blank project |
| GET | `/api/mv-draw/projects` | List saved projects |
| POST | `/api/mv-draw/project/open` | Open saved project by file name |
| POST | `/api/mv-draw/project/save-as` | Save named project copy |
| GET | `/api/mv-draw/symbols` | Symbol library |
| POST | `/api/mv-draw/background` | Upload background image |
| POST | `/api/mv-draw/export/pdf` | PDF download |
| POST | `/api/mv-draw/export/dxf` | DXF download |

## Project format

```json
{
  "format": "mooreview-mvdraw",
  "version": 1,
  "units": "ft",
  "scale": { "method": "twoPoint", "pixelsPerUnit": 12.5, "unitLabel": "ft" },
  "background": { "type": "image", "path": "uploads/plot.png", "opacity": 0.55 },
  "nodes": [],
  "edges": []
}
```

## Portable packages (`.mvbundle`)

One JSON file carries the full project plus embedded MV Draw background images:

- **MooreVIEW:** **Project → Export project file…** → `name.mvbundle` (tags, drivers, program, HMI, settings, site plan, backgrounds)
- **MV Draw:** **File → Export package…** → `name.mvbundle` (layout + backgrounds)
- **Import:** accepts `.mvbundle`, legacy `.est.json`, and `.mvdraw.json`

```json
{
  "format": "mooreview-bundle",
  "version": 1,
  "kind": "est",
  "name": "my-site",
  "doc": { "... mooreview-est or mooreview-mvdraw ..." },
  "assets": [{ "ref": "uploads/plot.png", "mime": "image/png", "base64": "..." }]
}
```

MooreVIEW `.est` files may still include an optional top-level `mvDraw` object (same shape as inside a bundle `doc`).
