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
8. **Use only the GitHub `main` branch for DKTS.** Never create, push, or use a feature, development, temporary, backup, archive, or PR branch unless the user explicitly authorizes that specific branch. Do not use PR branches as a normal development workflow. Work from a clean source ZIP in the cloud workspace and commit tested changes directly to `main`. The repository must contain exactly one branch: `main`.
9. Preserve true raw instrument data and hardware safety. Do not synthesize readings as real, silently downgrade scan plans, permit concurrent control of the same device, or send unvalidated outputs.
10. Maintain program `Vx.y.z` and development `aNNN` as separate identities. Deliver a clean, complete **source ZIP** for each successful cloud development round. Build and publish EXE/APK **only at final sign-off** with the explicit `[DKTS-FINAL-BUILD]` main commit marker. Never compile native packages after each interim change; offer UI hot update when possible. See `docs/RELEASE_VERSIONING.md`.
11. For continuation after a verified GitHub handoff, use the synchronized GitHub `main` and follow [docs/HANDOFF.md](docs/HANDOFF.md). If a newer unpushed, verified DKTS source ZIP exists, use that ZIP inside the same InstaBox. Deliver a clean, complete DKTS source ZIP after each development round. Sync to GitHub `main` only when the final source is ready for the one-time Actions compilation. The separately exported pinned DKDS ZIP is a read-only dependency and must never be edited.

## Required proof for a development report
A progress report must state an actual GitHub SHA, what changed, validation outcome, released package URL if published, and what remains unverified. Never claim DKDS changes were completed by editing DKTS documents.

12. When asked to preview native Windows UI without compiling, stage the **exact pinned DKDS Core and DKTS native plugin** and serve those same frontend assets locally. Do not call a separate FS-Pro imitation a 1:1 native preview. Show the real layout and transparently distinguish unsupported Electron IPC, native dialogs and instrument control. Deliver both the same-source preview and clean source ZIP, without interim GitHub pushes or EXE/APK builds.


## 2026-11-17 UI 阶段开发规则
12. 以用户指定的 LabExpress 2022.01 原厂手册及其工程归档为结构依据。扫描／目标／策略为主标签，限值、变量与关联规格归于扫描下方。见 R-20261117-004。
13. 若 DKDS Unit 组件/API 不满足 FS-Pro 的结构、控件事件或布局要求，先扩展 DKTS 自有 Unit adapter/Unit variant，必要时在 DKTS 派生 Core 构建中修补 Unit；严禁通过改变 FS-Pro 信息架构来迁就现有 Unit。DKDS 上游仓库仍保持只读。
14. UI 采用统一共享实现，Web/Windows/Android 不得分别维护两套视觉结构。宿主适配不得改变页面层级、字段顺序、控件尺寸和交互语义。
15. 开发按完整阶段推进：集中完成一组功能后再运行全量测试、构建一次同源预览并统一截图验收。禁止因单个小修改频繁编译、打包或触发 Actions；EXE/APK 只在最终签收阶段构建。
