# DKTS 4200A Reference Materials

Last updated: 2026-11-17

This directory restores the searchable, DKTS-owned 4200A reference documents that were recoverable from the user's Library. Original PDF/DOCX files are supplied separately in the private companion archive **DKTS-4200A-Reference-Bundle-2026-11-17.zip**. The `.extracted.md` files are text extractions for repository search and review; they are not substitutes for the original page layout, figures, screenshots, or tables.

## Included in this repository

- V2 LabExpress-to-DKTS development guide (searchable text extraction).
- V3 4200A reference research report (searchable text extraction).
- V5 implementation specification (searchable text extraction).
- V6 FS-Pro UI hard-constraint specification (searchable text extraction).
- V6 UI implementation specification (searchable text extraction).
- 4200A OPPO Pad Mini / DKDS connection handoff.
- User's 4200 control notes (searchable text extraction).
- `SOURCE_STATUS.md`: exact source inventory, provenance, missing artifacts, and official manual links.

## Copyright and source boundaries

The user's 106-page Chinese **LabExpress User Manual, product version 2022.01 (June 2022)** is included only in the private companion ZIP because the manual itself carries a copyright notice restricting reproduction and redistribution. It is not copied into this public repository, and no full-text extraction is published here.

Tektronix currently lists:
- **4200A-KXCI-907-01F, Revision F**, released 2026-10-09.
- **4200A-PMU-900-01D, Revision D**, released 2026-10-22.

The official pages and download entry points are recorded in `SOURCE_STATUS.md`. The actual Rev F and PMU Rev D PDF files were not recovered/downloaded in this task; do not treat a listing page as the manual PDF.

## Existing historical archive

The 2026-11-11 legacy FS-Pro code snapshot remains under `docs/reference/legacy-fspro-20261109/`. It is an archival comparison source, not an automatically bundled production implementation.

## Safety and validation boundary

These documents are design/reference materials. Their presence does not authorize real SMU/PMU output, prove hardware safety, or establish physical measurement acceptance. Follow the current KXCI revision, installed module identification, instrument firmware, and hardware acceptance gates before enabling source output.

This documentation-only update does not change the DKTS application version and does not trigger the final Windows/Android build.
