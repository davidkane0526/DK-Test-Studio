# 2026-11-11 DKDS FS-Pro legacy reference archive

**Archival snapshot only; not executable or approved for DKTS production use.**

- Exact source repository: `davidkane0526/DK-Data-Studio`
- Exact source branch: `feat/4200a-fspro-rebuild`
- Exact source commit: `5424cdbec972d5e7d7c6f206695a40258326df56` (2026-11-09)
- Target: DKTS development branch `feat/dkts-core-host-boot`, archive under `docs/reference/legacy-fspro-20261109/`
- Scope: full `src/4200a-fspro/` source subtree, two `docs/4200A` design/review files, and one visual test `tests/test-4200a-ui-visual.cjs`, preserving original relative paths. All other unrelated DKDS historical code is deliberately excluded.
- User requirements and the assessment of what to use: [DKTS Issue #20](https://github.com/davidkane0526/DK-Test-Studio/issues/20).
- Authoritative design inputs: user's 106-page `LabExpress User Manual(SC).pdf`, `DKTS_FSPro_V6_UI_spec_retry.pdf`, and V6 35-point UI acceptance list if recovered. Full `DKTS_FSPro_V6_full_retry.zip` remains unverified in the present workspace.
- **Do not auto-bundle these files.** No copying `src/4200a-fspro` directly to DKTS runtime without comparison to current DKTS + DKDS Core and manual. No DKDS upstream changes authorized.
- UI corrections: plot/results is a distinct main workbench, Edit Page is a separate parameter editor, `Sweep / Target / Strategy` top-level only, `Limits / Page Var / Associate Spec` inside Sweep.
- Do not claim this archive represents a functional Windows/Android DKTS release, working updater, or hardware-validated test.

This snapshot only preserves the **4200A-specific useful historical code**. The old DKDS branch also includes 1,218 commits ahead of DKDS main and unrelated changes; those are NOT copied into DKTS.
