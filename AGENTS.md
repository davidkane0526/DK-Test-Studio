# DKTS Agent Working Contract — 2026-11-10

**Authoritative project:** `davidkane0526/DK-Test-Studio`.
**Upstream framework only:** `davidkane0526/DK-Data-Studio`.

## Non-negotiable ownership
1. Do NOT write any DKDS source, manifests, plugins, version files, CI, or branches without a new, explicit user instruction authorizing that specific DKDS work. A request to "继续" does not authorize DKDS changes.
2. DKDS must remain a generic framework with generic communications, UI hot updates, and local full-package updater. No bundled, auto-installed, or instrument-specific 4200/Keithley/DKTS plugin. Do not confuse an already installed external plugin with a built-in.
3. All 4200A UI, measurement, KXCI domain logic, capability models, tests and releases belong to DKTS. DKTS must be based on the full DKDS host, not a visually similar independent shell. Retain all upstream non-analysis plugins, including Data Center, theme, memory, SMB, AI, history and LAN web services.
4. Target FS-Pro/LabExpress hierarchy and parameter organization. References: `docs/ARCHITECTURE_TARGET.md`, `docs/USER_REQUIREMENTS.md`. Treat screenshots/manual hierarchy as acceptance specifications, not styling inspiration.
5. No default locked parameter inspector, no click shadows, no closed port panel causing the parameters panel to reopen. Hide None ports in parameters. Responsive wrapping does not change parameter ownership.
6. Every non-continue user instruction must be appended to `docs/USER_REQUIREMENTS.md` with date, original wording when available, an ID, and acceptance criteria **before coding**. Messages containing only `继续` do not need recording. Corrections supersede but never erase previous user instructions.
7. Every development turn must append to `docs/DEVELOPMENT_LOG.md`: requirements addressed, files/commits, tests and real artifacts, regressions, unverified areas, and why any requested detail was deferred. Never present CI success as physical 4200A acceptance.
8. Keep one active DKTS integration branch at a time. After a reviewed/tested merge, close its PR and prune only branches whose ownership and merge status are verified. Do not delete user, backup, dev or archive branches.
9. Preserve true raw instrument data and hardware safety. Do not synthesize readings as real, silently downgrade scan plans, permit concurrent control of the same device, or send unvalidated outputs.
10. Maintain program `Vx.y.z` and development `aNNN` as separate identities. Publish a complete downloadable artifact for each successful development run; offer UI hot update whenever a change is hot-swappable. See `docs/RELEASE_VERSIONING.md`.

## Required proof for a development report
A progress report must state an actual GitHub SHA, what changed, validation outcome, released package URL if published, and what remains unverified. Never claim DKDS changes were completed by editing DKTS documents.
