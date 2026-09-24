# SITRO slicer service

Headless STL slicing service for the SITRO calculator.

## Contract

POST /slice as multipart/form-data:
- file: STL
- material: PLA | PETG | ABS | ASA | PA
- profile: standard | strong | max

Response:
```json
{"ok":true,"printTimeSeconds":1234,"totalWeightGrams":42.1,"material":"PETG","profile":"standard"}
```

## Intended engine

Bambu Studio CLI. The official CLI supports STL input together with full machine/process/filament JSON profiles and `--slice`.

The service is intentionally separate from Vercel: deploy it on a Linux host/container with Bambu Studio installed, then set SLICER_API_URL in the website environment.

## SITRO profiles

- standard: 0.20 mm, 3 walls, 15% infill
- strong: 0.20 mm, 4 walls, 25% infill
- max: 0.20 mm, 6 walls, 40% infill

Before production, export/flatten real Bambu P1S/P2S machine/process/filament profiles and validate CLI output against Bambu Studio GUI.

## Build requirement

Set Docker build arg `BAMBU_APPIMAGE_URL` to the official Linux Bambu Studio AppImage URL for the pinned release. The image extracts the AppImage at build time, so FUSE is not required at runtime.

The service intentionally fails its image build when this URL is absent; this prevents deploying a fake slicer that only returns estimated values.
