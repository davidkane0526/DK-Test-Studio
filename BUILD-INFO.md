# DKTS Cloud Workspace snapshot

- **Application version:** `V0.3.47`
- **Development identity:** `a219` (provisional; based on GitHub `main` `a42210e556cee13cc3a7991d25eb835b9c123777`)
- **Previous UI source ZIP:** `DK-Test-Studio-V0.3.44-a212-source.zip`
- **Previous UI source ZIP SHA-256:** `1d419c99922a00868ebd877486768a61b57d2274f2c69fb5f67c2379adf8c077`
- **Pinned read-only DKDS source:** `20f056851a61d2144e9524c3ed568628d4b8557c`
- **Pinned DKDS ZIP SHA-256:** `ebf283772098f0de6182c7472c9360dec88ec40de13248bd930cc2b54af73225`
- **DKTS native plugin:** `0.8.33` (Plugin API 1.19; not the DKTS application version)
- **Provisional staged Android versionCode:** `100219` (real final number is workflow-assigned)

## This round (2026-11-14)

- Baseline source ZIP: `DK-Test-Studio-V0.3.19-a199-source.zip` (not the older a198 source).
- Improved graph PlotView header density: `显示` is a native DKDS Action menu with a checked graph type; `数据` remains a separate native menu with scoped Data Center sources and full-resolution raw CSV export.
- At widths <=980px the Page titlebar uses the existing compact `端口` Popover instead of four inline S/D/G/B controls. Wider hosts keep four controls in one row.
- Avoided needless full Page rebuilds on unchanged numeric, Page name and Page note fields. Page Variable unit is now committed on blur instead of each keystroke.
- Removed redundant Sweep instructional text and success notice, retaining the warning for unready scan configurations.
- Real Chromium CSS-only geometry fixture passed at 1200x768, 744x600 and 390x844; these are **not** Electron host or Android app screenshots.

## Local verification

- Full Node tests: 190/198 passing. Eight test failures depend on absent pinned `d3@7.9.0` and its generated UI assets.
- DKDS SDK 1.19 official plugin package normalizer: PASS for plugin 0.8.7.
- Native plugin VM tests and release identity tests: PASS.
- CSS-only Chromium geometry fixture: PASS for desktop, tablet and phone (not a host acceptance test).
- Real Electron / Windows Portable / Android APK build and physical device acceptance: not performed.
- No GitHub branches created and no push to `main`. DKDS upstream ZIP remains unmodified.

## 2026-11-16 · Final-only GitHub Actions policy checkpoint

- Program identity stays `V0.3.20` (no new native/UI runtime changes); previous local provisional `a200` remains a historical workspace identifier, **not a published Release**.
- Based directly on the complete V0.3.20 a200 source ZIP. DKDS pinned ZIP stays read-only.
- All cloud interim changes remain in a clean DKTS ZIP; no intermediate Windows/Android install builds and no GitHub pushes.
- Unified Core Release only compiles on the final `main` commit containing `[DKTS-FINAL-BUILD]` (no workflow_dispatch for this release). Build-heavy other workflows are manual only. The existing UI workflow retains the monotonic build counter.
- This checkpoint is a workflow configuration update only: **EXE/APK not compiled, GitHub main not updated, no Release published**.
- Focused source regression: 21/21; native plugin VM and host mock PASS; 13 GitHub workflow YAML configurations parsed successfully.

## 2026-11-16 · V0.3.21 a201 / Same-Core desktop browser preview

- Found two SDK geometry violations which prevented real DKDS Core from activating the DKTS TOP plugin: responsive `gap:0` and an unapproved 6-column grid. Corrected to `gap:0px` and the approved `repeat(6,minmax(80px,1fr))` geometry.
- Rendered the **same generated DKDS Core and DKTS native plugin** in browser DOM mode; Project Explorer, four PlotViews and Edit Page loaded with no JavaScript error after the fix. D3 was replaced by a test stub only for the internal screenshot pass (NOT a scientific renderer acceptance test).
- Improved compact headers and made S/D/G/B explicit in desktop selector display.
- Source version 0.3.21 and native plugin 0.8.8; a201 provisional pending actual main Actions.
- Local preview bundle uses the exact DKTS-derived DKDS Core HTML/CSS/JS; D3 7.9.0 must be downloaded on first launch. No EXE/APK compiled, no GitHub push, DKDS upstream untouched.

## Latest verification (2026-11-16)

- Node suite: **193/201 pass**; eight blocked by absent pinned D3 7.9.0 / dependent UI assets.
- Official DKDS Plugin API 1.19 validator, package normalizer and TOP installer: **PASS**, plugin v0.8.8.
- Browser DOM of derived DKDS Core: startup, graph workspace and Page editor **PASS** with a temporary D3 placeholder used only inside the screenshot test; real D3 plots and external downloads were not checked in this sandbox.
- Windows one-click `start-preview.cmd` provided but not executed on Windows in this Linux-only sandbox.
- GitHub and Windows/Android native builds intentionally NOT invoked.

## 2026-11-16 · ZIP-only V0.3.22 a202 draft / FS-Pro refinement

- Baseline: successful GitHub `main` source snapshot `c8ce9172aeeee942a09cf0c75b69356185c7f624` (full DKTS source ZIP), pinned DKDS SHA `20f05685` read-only. No branches created and no GitHub push.
- Native offline scan cursor `pointAt()` now models exact segment endpoints and X point → X repeat → P point → P repeat → outer loop order, with fixed-bias port settings and explicit `planned-only` provenance. **No KXCI instructions are sent.**
- Browser FS-Pro planner now rejects blank scan fields, unsupported bidirectional/hysteresis mode, invalid delays/port limits, and excessive fixed bias. When P scan is disabled, the gate's actual planned fixed bias is retained instead of silently plotting 0.
- Independent web preview: 7 tabs retained; duplicate graph captions removed; frame header contracted to 32px; narrow phones display each six-column sweep row as a 3×2 control grid; toolbar text no longer overlaps the breadcrumb.
- Pinned Core native PlotView: remove artificial `2.25:1` content aspect-ratio restriction and make the existing SDK panel body a single full-height flex owner. This addresses the extra blank lower band seen in *existing* V0.3.21 Android tablet emulator screenshot; **new native rendering not yet verified**.
- Stale Core-host VM test assumptions updated to match the actual current pinned SDK six-column layout and blank Sweep header meta. No modification to DKDS.
- Version bump: source app V0.3.22, native plugin 0.8.9, legacy Android Gradle 0.3.22/versionCode 31. a202 is **provisional**, not a published Release or official Actions identity.
- Complete Node suite: 198/206 pass, 8 blocked by missing pinned D3 7.9.0 and dependent build assets in this offline container. Native model, Core-host mock, version identity tests pass.
- Offline browser screenshots/interaction checks: 1280×800, 744×600, 390×844; no horizontal page overflow; 7 tabs; invalid empty step correctly rejected. Native scoped CSS geometry fixture also passes at desktop/tablet/phone. **These screenshots are of the standalone web editor, not a new DKDS Core or Android render.**
- **Not done:** true pixel-by-pixel FS-Pro benchmark; refreshed native Windows/Android screenshots for the latest graph fix; complete hardware profile verification; KXCI real runner, safe stop, physical raw data, fault recovery; native EXE/APK compile/release. These require separate validation and final build policy.

## 2026-11-16 · V0.3.23 a203 / DKTS Core same-source preview

- Baseline: latest delivered DKTS `V0.3.22 a202` source ZIP; DKDS remains pinned read-only at `20f056851a61d2144e9524c3ed568628d4b8557c` (3.72.3).
- Corrected a real DKDS SDK 1.19 validation failure: PlotView semantic Unit panel body must not use `overflow:hidden`; it now uses `overflow:visible`, with a regression assertion.
- DKTS application `V0.3.23`; native plugin `0.8.10`; Android legacy Gradle `versionCode=32`; local provisional identity `a203` (not an official Actions revision).
- Added `tools/build-same-source-preview.cjs`, `tools/preview-server.cjs` and Windows `Start-DKTS-Core-Same-Source-Preview.cmd`. The generated preview is derived from the exact pinned DKDS Core and this DKTS plugin, not the independent FS-Pro web demo. It binds only to localhost and marks hardware output unavailable.
- Core runtime/style/SDK/plugin generation and official DKDS plugin validation passed (12 plugins). Native model/host tests passed. Full Node suite: 200/208; 8 blocked by missing pinned D3 7.9.0 because npm registry DNS is unavailable in this environment.
- The preview ZIP contains source and generated Core frontend but no `node_modules`, Electron binary, EXE or APK. First Windows launch installs production dependencies (D3 7.9.0) and starts the browser preview. Full browser render was not verified in this offline container.
- No GitHub push, no branch creation, no EXE/APK build, no Release, no DKDS upstream modification. Real Electron/Android visual acceptance and real 4200A measurement acceptance remain open.


## 2026-11-16 · V0.3.24 a204 / Core 原生 KXCI 执行接入与 ACK 安全修正

- 基线：V0.3.23 a203 完整源码 ZIP；DKDS 固定只读 SHA `20f056851a61d2144e9524c3ed568628d4b8557c`。本轮只修改 DKTS。
- Core 原生插件新增 `measurement-runtime.js`，复用共享硬件能力数据库、KXCI 协议、身份控制器、扫描编译器和 KXCI 运行器；通过 DKDS `network.tcp` capability 连接，不创建第二套 TCP 服务。
- 连接设置支持 host/port/预期序列号/timeout/以太网或 Wi-Fi/指定网卡/本地地址；支持 `KI4200A,serial,version` 紧凑身份响应；完成物理模块信息读取后才生成可执行性检查。
- 修复 KXCI Ethernet ACK 缓冲问题：`UL/DE/US/DV/RI/RG` 写入命令均等待并验证 ACK；不再设置 `noReply=true` 丢弃 ACK。原始 TI 响应被逐行保留并发布到 DKDS Data Center。
- 原生 Page 标题栏加入连接/设置与开始/停止操作；开始前显示活动 SMU、测量点数、电压范围，并要求显式确认接线与实际输出。未分配 B 端、非电压源模式、非漏极电流目标等当前运行器不支持的配置会被拒绝。
- 测量点枚举改为惰性生成，避免先将整个 X/P 多层扫描扩展为大数组。Data Center raw table 增加 X/P 电压与点序列字段。
- **输出安全门禁**：官方索引显示最新 KXCI Rev F（2026-10-09），但正文尚未取得/核对；数据库新增 `safetyPolicies.kxci`，`allowInstrumentOutput=false`。DKDS Plugin API 1.19 未提供受支持的主机延时调度接口，且 SDK 校验禁止插件 raw timer。因此生产运行时拒绝真实电压输出与主机逐点扫描。测试中的协议/调度适配器只用于模拟回归，不改变生产数据库。
- **时序限制**：当前 DV/TI 逐点模式是主机步进，不等同于仪器内部扫描，不得声称可达到 20 ns。KXCI 原生扫描命令需在 Rev F 核验后另行实现。
- 应用版本 `V0.3.23 → V0.3.24`；原生插件 `0.8.10 → 0.8.11`；Android legacy `versionCode 32 → 33`；a204 为本地暂存编号。
- 验证：`npm test` **214/214 通过**；DKDS SDK Plugin API 1.19 校验通过；同源预览 `src/index.html`、plugin-index、manifest 和新增 runtime 脚本静态 HTTP 检查均返回 200。
- DKTS source tree SHA-256：`648a66d9d1b45372d75c8a443b3d48303bc11a095a8b4e5f22fc21f5d38e5f58`，与 `PREVIEW-MANIFEST.json` 一致。
- 本轮真实仪器、Windows/Android 安装包、真实 Electron/Android 截图和 FS-Pro 像素级验收尚未完成；未推送 GitHub、未创建分支、未修改 DKDS。


## 2026-11-16 · V0.3.25 a205 / DKDS 生命周期定时服务接入

- 基线：V0.3.24 a204 工作区；DKDS 固定只读 SHA `20f056851a61d2144e9524c3ed568628d4b8557c`。仅修改 DKTS。
- 更正上一轮 SDK 接口判断：DKDS Plugin API 1.19 明确提供 `ctx.ui.dom.timeout()`，并由 Core 管理 timer 生命周期；原生插件新增 `ui.dom` Core 依赖，使用该接口实现逐点 DV/TI 延时，不创建 raw `setTimeout`/`setInterval`。
- KXCI runner 在停止时取消未完成的 DKDS timer，随后执行活动 SMU 关闭；补充缺失定时服务时拒绝执行的负向测试，以及 timer 取消、SMU-off ACK 和真实 TI 模拟数据发布的正向回归。
- 原生插件版本 `0.8.11 → 0.8.12`；应用版本 `V0.3.24 → V0.3.25`；Android legacy `versionCode 33 → 34`；`a205` 为本地暂存编号，非正式 Actions 编号。
- 生产 `safetyPolicies.kxci.allowInstrumentOutput` 继续为 `false`。最新 Rev F 手册正文仍未完成核对，真实仪器输出仍被阻止；本轮测试使用模拟 TCP 和测试专用策略覆盖，不代表实机测量通过。
- 逐点 DV/TI 是主机步进模式，不等同于仪器内部扫描，不宣称达到 20 ns。真实 KXCI、硬件联锁、异常恢复、Electron/Android 截图及 FS-Pro 像素级验收仍待完成。
- 验证：`npm test` **216/216 通过**；DKDS SDK Plugin API 1.19 `validate`、`test-runtime` 通过，`test-layout` 64/64 通过；同源预览首页、plugin-index、插件 manifest/runtime 和品牌资源静态 HTTP 检查均返回 200。
- 同源预览源码树 SHA-256 以 `PREVIEW-MANIFEST.json` 为准；生成哈希已排除 Git 忽略的 Android WebView 构建资产。D3 7.9.0 直接随预览包提供，Windows 启动不再要求 npm install 或首次构建。Chromium 截图在当前容器未能完成，故不宣称浏览器视觉验收。
- 未推送 GitHub、未创建分支、未修改 DKDS、未编译 EXE/APK。

## 2026-11-17 · V0.3.27 a207 · FS-Pro seven-tab Unit reconstruction
- App source `V0.3.27`, plugin `0.8.14`, Android legacy `versionCode 36`; a207 provisional.
- Reference baseline `docs/reference/fspro-accepted-20261116/BASELINE-MANIFEST.json`.
- DKDS pinned SHA 20f056851a61d2144e9524c3ed568628d4b8557c, read-only, untouched.
- UI stage: seven independent tabs and FS-Pro sweep columns implemented; DKTS-derived Unit extension is active for Tabs/Field/Layout. `npm test` 224/224; official DKDS SDK validator/runtime pass; layout harness 64/64.
- Web FS-Pro and Core still use different host renderers; shared renderer/DOM/CSS extraction is not complete. Real Chromium screenshots could not be captured in this cloud container because Chromium hangs even on `about:blank`; therefore this is not a final visual sign-off or OEM FS-Pro pixel match.
- This is a source/UI preview only; not a published Release or native app. No EXE/APK build, GitHub push, new branch, or DKDS upstream modification.

## 2026-11-23 · V0.3.39 统一 Core 发布

- 发布基线：GitHub main `cb247cc35e00b8a634bee5a8edcbdd7bb2da534f`，原生插件 0.8.26。正式构建序号由本次发布提交对应的 UI workflow 分配。
- 发布内容：Windows Portable、固定证书签名的 Android APK、完整源码归档、独立 DKDS 插件及能力数据库。以发布资产中的 `PROVENANCE.txt` 和 `SHA256SUMS.txt` 核对源提交及校验和。
