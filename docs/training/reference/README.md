# Training reference pack

Single folder with **copies** of all MooreVIEW training reference material (curriculum + cited guides).

Regenerate after doc updates:

```powershell
cd est-pc
powershell -File scripts\sync-training-reference.ps1
```

## Layout

| Folder | Contents |
|--------|----------|
| **curriculum/** | Full course, instructor guide, quiz answer key, CBM PDF (if present) |
| **platform/** | Integration guides: cameras, Parc/MQTT, BACnet/IP, EZ Meter facility PQ, CMMS, PdM proactive CMMS, lift-station PdM, archive export, baseline test, architecture, cellular SIMs, HAL, edge vs cloud parity |
| **hardware/** | Firmware and field-device READMEs (Opta, Parc ST, cellular Opta gateway, MV Draw, Sequent HAL) |

## In-app access

Learners use **Tools â†’ Training (F2)**. Trainers use the **Instructor** tab. This folder is for offline printing, WinSCP to classroom PCs, and instructor prep.

## Missing sources

See [MISSING-SOURCES.md](./MISSING-SOURCES.md) for paths cited in training but not yet in the repo.

Built: 2026-08-03T05:55:34.6180690-04:00
