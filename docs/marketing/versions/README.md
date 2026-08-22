# mooreVIEW marketing — version archive

Published PDFs and source Markdown for every released version, kept for review and comparison.

## Layout

```
versions/
  MooreVIEW-Product-Description/
    v1.1/
      MooreVIEW-Product-Description.md
      MooreVIEW-Product-Description.pdf
      manifest.json
    v1.2/
      ...
  MooreVIEW-Pricing-Guide/
    v2.1/
    v2.2/
    v2.4/
  MooreVIEW-Subscription-Sell-Sheet/
    v1.1/
  MooreVIEW-Infrastructure-Projections/
    v1.0/
  ...
```

The **latest** working copies remain in `docs/marketing/` (e.g. `MooreVIEW-Product-Description.pdf`).

## Build commands

| Command | Purpose |
|---------|---------|
| `npm run build:product-description-pdf` | Latest product description → main PDF + archive |
| `npm run build:product-description-pdf:v1.1` | Rebuild v1.1 from archived source into `versions/` |
| `npm run build:marketing-pdfs` | Build all six marketing PDFs + archive each current version |
| `npm run archive-marketing-versions` | Copy current sources/PDFs into version folders only |

Each `manifest.json` records build date, archive time, and PDF size.
