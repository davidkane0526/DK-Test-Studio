> **当前开发版 V0.3.53。时间预览接入原生图窗，支持测试和流程批量复制、另存模板和调整顺序。可在 [同源预览](https://davidkane0526.github.io/DK-Test-Studio/core/) 批注。**

# DK Test Studio (DKTS)

**Keithley 4200A-SCS 专用测量程序。** 目标是 **完全基于 DKDS 框架**，以其成熟 Core/插件/更新体系为唯一宿主，复刻 FS-Pro / LabExpress 的页面层级、端口配置、扫描策略和测试流程。**今后 4200A 的研发只在这个仓库中进行，不修改 DKDS。**

> 2026-11-10 开发边界以 [AGENTS.md](AGENTS.md) 和 [用户需求台账](docs/USER_REQUIREMENTS.md) 为准。较早文档可能描述历史方案，不得覆盖本次新要求。

## 当前状态（2026-11-17 单一发行路线）

- [PR #18](https://github.com/davidkane0526/DK-Test-Studio/pull/18) **已经按用户授权合并到 `main`**，合并提交 `cdc159dd`。从此 `main` 的开发目标是由 **只读 DKDS Core 源码构建的 DKTS 宿主**，不是以前独立的 Electron/WebView 壳。禁止未授权修改上游 DKDS。
- DKTS 构建时在临时目录中暂存完整 DKDS Core，保留全部非分析插件、主题、Data Center、科学绘图、通信、更新模块，移除分析插件，只在 DKTS 副本内加入 4200A 工作区。实际 DKDS checkout 不作写入。
- FS-Pro Project → Device → Routine → Page/Spec、Project 层的四个独立 DKDS PlotView、Page 全宽参数编辑，以及 DKDS Data Center / 原始 CSV 接口已有实现。V0.3.25 已将 KXCI 身份/模块识别、扫描方案映射、ACK 逐条读取、DKDS 生命周期定时服务、停止取消及原始 TI 数据发布接入 Core 原生插件。**生产实际输出仍被 Rev F 手册正文核验门禁阻止**，尚未完成真实 4200A 验收，仪器异常恢复也未验收。
- Windows 原生 Electron Core 工作区与多图窗的启动/截图回归在 `8533798df` 通过；Windows Portable 打包、Android API 36 模拟器和 APK 完整 CI 仍应以各次 Actions 最终结果为准。OPPO 平板及真实仪器未验收。
- `npm start` 现在运行 `tools/launch-core-mainline.cjs`：若未设置 `DKTS_DKDS_SOURCE`，会在 DKTS 自己的 `.dkts-cache/` 内获取固定 SHA 的只读 DKDS 上游，暂存真实 Core、执行原生构建并启动 Electron；不会修改用户的 DKDS checkout。`npm run start:legacy` 和 `npm run dist:win:legacy` 保留旧壳作历史对照，**不作为新架构正式发布入口**。新 Core 构建由 [只读 Core 工作流](https://github.com/davidkane0526/DK-Test-Studio/actions/workflows/dkts-framework-contract.yml) 构建。
- 当前改为**单一 DKTS 原生应用身份**：Windows/Android 共用 `V0.3.32 aNNN`，Android 包名为 `studio.dk.test`，使用原 DKTS 固定签名；不再发布 `studio.dk.test.corepreview` 第二套应用。一个 Release 同时包含 Windows Portable、固定签名 APK、硬件能力数据库和校验清单。CSS-only 修改额外把 `DKDS-UI-bundle.json` 放进同一个 Release，且仍会构建完整 EXE/APK。旧 `a159` 等 Core Preview Release 仅保留为历史记录，不再是当前更新源。真实设备安装、热更/全量升级与回退仍待 OPPO/Windows 实机验收。
- 当前源码为 `V0.3.53`，原生插件版本 0.8.42。流程按所含测试类型提供图形选项，单项测试按自身模式提供图形。时间扫描、保持特性与脉冲扫描均可编辑、保存和校验方案。仪器执行路径和实机验收见 [P0 原厂指令审计](docs/P0_ORIGINAL_COMMAND_AUDIT.md)。
- 本轮 UI 阶段 `npm test` **224/224 通过**；DKTS 派生 Unit 与七标签/七列表格契约已加入。当前 Web FS-Pro 与 Core 原生宿主仍使用不同的渲染器，尚未完成真正共享的 UI renderer/DOM/CSS 抽取，因此不能称为像素级一致或 UI 最终完成。真实 Core 插件目录校验 12/12 通过；DKDS SDK 单插件 validator/runtime 均通过，64 个 canonical layout cases 通过；控件几何由 DKTS 派生 Field Unit 变体负责。Chromium 本地截图进程在当前云端环境挂起，尚未取得四视口真实截图，因此 UI 尚未签收。当前 GitHub 仍只有 `main`，本轮未推送。
- V0.3.20 a200 本轮优化 PlotView 标题栏，图形类型改为带选中标记的 DKDS 原生“显示”菜单；数据源和原始 CSV 仍在“数据”菜单。980px 及以下标题栏收敛 S/D/G/B 为单一端口 Popover；数值、页面名称/备注、变量单位的无变化编辑不再触发工作区刷新；Sweep 删除重复说明。已完成 DKDS SDK 插件验证与离线 CSS 几何检查；真实 Windows/Android 视觉验收仍待执行。

## 项目入口

- [不可变的开发边界](AGENTS.md)
- [用户要求、优先级、历史要求](docs/USER_REQUIREMENTS.md)
- [连续开发日志与真实验证范围](docs/DEVELOPMENT_LOG.md)
- [DKDS Core 宿主架构及 FS-Pro 验收](docs/ARCHITECTURE_TARGET.md)
- [DKDS 只读上游与分支核查](docs/UPSTREAM_BRANCH_AUDIT.md)
- [版本和发布约定](docs/RELEASE_VERSIONING.md)
- [开发任务](docs/ROADMAP.md)

## 版本与安装包（单一发行路线）

- 当前应用版本为 `V0.3.53`。仅 CSS 白名单热更新保持 V、递增 a；任何需要完整安装的原生/运行时变更都必须递增 V 和 a。`ui-update.yml` 负责提供单调 aNNN，Core 工作流按同一 Git SHA 读取该编号。
- 每个应用代码变更都构建完整 Windows Portable 和固定签名 Android APK。CSS-only 修改还会生成四文件白名单 `dkds-ui-v2` 热更新包，并与 EXE/APK 放在同一个 `dkts-vX.Y.Z-aNNN` Release。
- 当前资产命名为 `DKTS-Windows-VX.Y.Z-aNNN.exe`、`DKTS-Android-VX.Y.Z-aNNN.apk`，可选 `DKDS-UI-bundle.json`，以及硬件能力数据库、SHA256 和来源清单。
- 原生更新器和 UI 热更新器共用同一个 Release 标签与 V/a 身份；Android 使用原有 `studio.dk.test` 包名及固定签名，不再生成第二个 `corepreview` 应用。历史 Core Preview Releases 保留但不参与新版本更新。
- 2026-11-12 已修正网页版与原生 Page 层级一致：Project 层显示四个独立图窗，进入 Page 显示全宽参数编辑，使用“← 绘图区”返回；[网页 UI Demo](https://davidkane0526.github.io/DK-Test-Studio/) 的 Chromium 回归和 Pages 部署已有通过记录。
- 只有完整 CI、固定签名、资产校验和发布均成功，才能称为可下载版本。真实 Windows/OPPO 设备的覆盖安装、UI 热更、全量升级和失败回退仍须实机验收。

## 本地审计 DKDS 上游（不修改 DKDS）

```sh
node tools/dkds-host-profile.cjs ../DK-Data-Studio dist/dkds-profile.json
node tools/stage-dkds-host.cjs ../DK-Data-Studio dist/dkts-framework-staging
```

第二条仅生成 **DKTS 源码暂存区**，不是可直接交付的 EXE/APK。正式程序必须完成 FS-Pro 工作区、运行时更新源配置、生产构建和实机验证等验收后才能替换旧壳。

## KXCI 测量执行门禁（V0.3.25）
- Core 原生工作区现在通过 DKDS `network.tcp` capability 使用通用 TCP 通信，不另建私有 socket 或第二套连接服务；连接后校验 `KI4200A` 身份与序列号，再读取 `*OPT?`、物理模块型号和额定值。
- KXCI Ethernet 对写入类命令同样返回 `ACK\0`。客户端必须逐条读取并验证 ACK，不能把 ACK 留在 TCP 缓冲区后再读取 `TI` 电流响应。
- 原生工作区已加入 DC SMU 方案编译、启动确认、停止/关闭、故障状态以及原始 TI 行发布到 DKDS Data Center 的受控代码路径；模拟 TCP 回归通过不代表真实仪器输出已验收。
- KXCI Rev F（4200A-KXCI-907-01F）SMU 第 2–5 节已于 2026-11-28 逐条核对。门禁分两路：用户模式逐点 `DV/TI` 受 `safetyPolicies.kxci.allowInstrumentOutput` 控制，当前为 `false`；Optimized DC（System Mode，`ME1` 原生任务）受 `smuSystemModeManualVerified` 与 `allowSystemModeOutput` 控制，当前均为 `true`，在模块身份/额定值核验通过且不需要高压互锁（≤ 21 V）时允许受控实机输出（R-20261128-001）。标准 PMU 脉冲与 Segment Arb 已开放受控实机验收（R-20261128-008）。实装模块、接线和额定值核验通过，方案峰值不超过 21 V，且操作员确认后才会出源。多通道 SMU 原生列表仍关闭。**用户模式逐点真实电压输出仍被禁止。**逐点 `DV/TI` 已通过 DKDS `ui.dom.timeout()` 使用 Core 生命周期管理的延时服务，停止时取消待执行定时器；该方式仍是主机步进模式，不得声称可实现硬件内部 20 ns 扫描。

## 原始数据和仪器安全
不同来源的数据明确标记 instrument-raw、derived 或 imported/preview；软件规划曲线不能冒充 4200A 测量曲线。仪器输出必须通过实际模块检测、端口互斥、量程/功率、联锁、异常停止和原始数据采集验证。CI 构建成功不代表仪器现场验收。

## 网页预览与批注

- [DKTS Core 同源预览](https://davidkane0526.github.io/DK-Test-Studio/core/) 使用最新部署的 main 源码和固定 DKDS Core。可用 [部署信息](https://davidkane0526.github.io/DK-Test-Studio/core/preview.json) 核对当前源码 SHA。

## 网页 UI Demo（旧版参考）
- GitHub Pages（启用 **Settings → Pages → Build and deployment: GitHub Actions** 后）：
  https://davidkane0526.github.io/DK-Test-Studio/
- 手动运行 Actions → **DKTS Web UI Demo** 可生成可下载的 `DKTS-Web-UI-Demo-Offline` 静态网站包。
- 本 Demo 现在由 **`web/fspro-workbench/` 的 FS-Pro 分层测试编辑工作区**构建（此前从旧版卡片页面构建的错误已纠正），使用 X/P 规划模型与 DKDS 绘图内核，只提供离线编辑；不可连接 Keithley 4200A、不可输出电压、不可把示例规划数据当作仪器原始测量。现有 Web UI 与目标 DKDS Core Host 仍不是同一阶段的架构，请勿把网页预览视为新宿主已完成。
- 本地构建：`npm install && node tools/build-ui-system.cjs && node tools/prepare-dkds-plot-vendor.cjs && node tools/build-web-demo.cjs`，再通过静态 HTTP 服务打开 `dist/web-ui-demo/`。


## 云端 ZIP 开发与单一分支策略
- GitHub 仓库只保留 `main`。未经用户明确许可，不创建任何其他分支，不使用 feature/develop/临时分支或 PR 开发流程。
- `.github/workflows/source-zip.yml` 在 main 更新时导出完整、干净的 DKTS 源码 ZIP，以及固定 SHA `20f056851a61d2144e9524c3ed568628d4b8557c` 的 DKDS 只读依赖 ZIP，并附带 manifest 和 SHA-256 校验文件。Actions artifact 名称为 `DKTS-Source-ZIP-<commit SHA>`，保留 30 天。
- 后续以 DKTS ZIP 作为云端工作区基线，DKDS ZIP 仅供只读构建。每轮交付完整 DKTS ZIP；通过测试后直接提交到 main。

- `.github/workflows/dkts-safe-branch-prune.yml` 清理已确认合并的分支，保留仍有独有提交、受保护或仍在审查的分支。


## 云端 ZIP 开发与最终构建（2026-11-16）

- 日常开发以同步后的 main 或该提交的源码 ZIP 为基线。每轮验证覆盖 SDK、Node 和布局。
- GitHub 保留唯一 `main`。每轮验证后推送，自动部署同源网页并归档源码。
- 最终安装包获明确授权时，提交信息带 `[DKTS-FINAL-BUILD]`，由唯一 Core Release Actions 工作流编译 Windows Portable 和 Android APK、做签名与校验并发布。
- 普通 `main` 提交不会触发原生安装包编译；其他大型诊断工作流可手动运行。开发包的 `aNNN` 编号为暂存值，正式版本从 `ui-update.yml` 对应 SHA 确认。

### DKTS Core 同源预览（V0.3.53）

可使用 `tools/build-same-source-preview.cjs` 生成本地同源预览。它由本轮 DKTS 源码和只读 DKDS `20f056851a61d2144e9524c3ed568628d4b8557c` 派生，直接使用 DKDS Core 的 `src/index.html`、Core CSS、生成的 runtime bundles 和本轮 `com.dkts.keithley-4200` 原生插件。它不是 `web/fspro-workbench/` 独立网页 Demo。

Windows 解压后运行 `Start-DKTS-Core-Same-Source-Preview.cmd`，需要 Node.js 20+；D3 7.9.0 已随预览包提供，无需 npm 安装或首次构建，直接在 `127.0.0.1:4173` 本地提供同源 UI。此过程不安装 Electron、不编译 EXE/APK、不推送 GitHub。浏览器预览使用 DKDS web bridge 的浏览器回退能力，不能提供 Electron IPC、原生窗口/文件对话框、安装更新、真实 4200A 连接、KXCI 输出或仪器原始数据采集；也不能替代 Windows Electron/Android 真机截图验收。具体来源与 SHA 见预览包 `PREVIEW-MANIFEST.json`。


## FS-Pro UI baseline (2026-11-17)
The user-selected online FS-Pro Workbench is the single UI reference. The native DKTS editor must expose seven independent Page tabs in this order: Info, Sweep, Target, Strategy, Limits, Page Var, Associate Spec. If the pinned DKDS Unit set cannot express the required structure or interaction, extend DKTS-owned Units or the DKTS-derived Core Unit implementation; do not alter the upstream DKDS repository and do not simplify the FS-Pro page to fit existing Units. Development is staged: complete a coherent UI block, then run unified tests and build one same-source preview. No per-small-change EXE/APK builds; native packages are built only at final sign-off.
