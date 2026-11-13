# DK Test Studio (DKTS)

**Keithley 4200A-SCS 专用测量程序。** 目标是 **完全基于 DKDS 框架**，以其成熟 Core/插件/更新体系为唯一宿主，复刻 FS-Pro / LabExpress 的页面层级、端口配置、扫描策略和测试流程。**今后 4200A 的研发只在这个仓库中进行，不修改 DKDS。**

> 2026-11-10 开发边界以 [AGENTS.md](AGENTS.md) 和 [用户需求台账](docs/USER_REQUIREMENTS.md) 为准。较早文档可能描述历史方案，不得覆盖本次新要求。

## 当前状态（2026-11-13 单一发行路线）

- [PR #18](https://github.com/davidkane0526/DK-Test-Studio/pull/18) **已经按用户授权合并到 `main`**，合并提交 `cdc159dd`。从此 `main` 的开发目标是由 **只读 DKDS Core 源码构建的 DKTS 宿主**，不是以前独立的 Electron/WebView 壳。禁止未授权修改上游 DKDS。
- DKTS 构建时在临时目录中暂存完整 DKDS Core，保留全部非分析插件、主题、Data Center、科学绘图、通信、更新模块，移除分析插件，只在 DKTS 副本内加入 4200A 工作区。实际 DKDS checkout 不作写入。
- FS-Pro Project → Device → Routine → Page/Spec、Project 层的四个独立 DKDS PlotView、Page 全宽参数编辑，以及 DKDS Data Center / 原始 CSV 接口已有实现。实际 KXCI 输出仍禁用，尚未经过真实 4200A 验收。
- Windows 原生 Electron Core 工作区与多图窗的启动/截图回归在 `8533798df` 通过；Windows Portable 打包、Android API 36 模拟器和 APK 完整 CI 仍应以各次 Actions 最终结果为准。OPPO 平板及真实仪器未验收。
- `npm start` 现在运行 `tools/launch-core-mainline.cjs`：若未设置 `DKTS_DKDS_SOURCE`，会在 DKTS 自己的 `.dkts-cache/` 内获取固定 SHA 的只读 DKDS 上游，暂存真实 Core、执行原生构建并启动 Electron；不会修改用户的 DKDS checkout。`npm run start:legacy` 和 `npm run dist:win:legacy` 保留旧壳作历史对照，**不作为新架构正式发布入口**。新 Core 构建由 [只读 Core 工作流](https://github.com/davidkane0526/DK-Test-Studio/actions/workflows/dkts-framework-contract.yml) 构建。
- 当前改为**单一 DKTS 原生应用身份**：Windows/Android 共用 `V0.3.13 aNNN`，Android 包名为 `studio.dk.test`，使用原 DKTS 固定签名；不再发布 `studio.dk.test.corepreview` 第二套应用。一个 Release 同时包含 Windows Portable、固定签名 APK、硬件能力数据库和校验清单。CSS-only 修改额外把 `DKDS-UI-bundle.json` 放进同一个 Release，且仍会构建完整 EXE/APK。旧 `a159` 等 Core Preview Release 仅保留为历史记录，不再是当前更新源。真实设备安装、热更/全量升级与回退仍待 OPPO/Windows 实机验收。

## 项目入口

- [不可变的开发边界](AGENTS.md)
- [用户要求、优先级、历史要求](docs/USER_REQUIREMENTS.md)
- [连续开发日志与真实验证范围](docs/DEVELOPMENT_LOG.md)
- [DKDS Core 宿主架构及 FS-Pro 验收](docs/ARCHITECTURE_TARGET.md)
- [DKDS 只读上游与分支核查](docs/UPSTREAM_BRANCH_AUDIT.md)
- [版本和发布约定](docs/RELEASE_VERSIONING.md)
- [开发任务](docs/ROADMAP.md)

## 版本与安装包（单一发行路线）

- 统一身份为 `V0.3.13 aNNN`。`aNNN` 沿用 `ui-update.yml` 的历史运行编号，但该文件现在只分配序号，不再发布第二个 UI Release；Core 工作流按同一 Git SHA 读取该编号。
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

## 原始数据和仪器安全
不同来源的数据明确标记 instrument-raw、derived 或 imported/preview；软件规划曲线不能冒充 4200A 测量曲线。仪器输出必须通过实际模块检测、端口互斥、量程/功率、联锁、异常停止和原始数据采集验证。CI 构建成功不代表仪器现场验收。

## 网页 UI Demo（仅界面预览）
- GitHub Pages（启用 **Settings → Pages → Build and deployment: GitHub Actions** 后）：
  https://davidkane0526.github.io/DK-Test-Studio/
- 每次 main 提交还会在 Actions → **DKTS Web UI Demo** 的构建任务中生成可下载的 `DKTS-Web-UI-Demo-Offline` 静态网站包。
- 本 Demo 现在由 **`web/fspro-workbench/` 的 FS-Pro 分层测试编辑工作区**构建（此前从旧版卡片页面构建的错误已纠正），使用 X/P 规划模型与 DKDS 绘图内核，只提供离线编辑；不可连接 Keithley 4200A、不可输出电压、不可把示例规划数据当作仪器原始测量。现有 Web UI 与目标 DKDS Core Host 仍不是同一阶段的架构，请勿把网页预览视为新宿主已完成。
- 本地构建：`npm install && node tools/build-ui-system.cjs && node tools/prepare-dkds-plot-vendor.cjs && node tools/build-web-demo.cjs`，再通过静态 HTTP 服务打开 `dist/web-ui-demo/`。


## 云端 ZIP 开发与单一分支策略
- GitHub 仓库只保留 `main`。未经用户明确许可，不创建任何其他分支，不使用 feature/develop/临时分支或 PR 开发流程。
- `.github/workflows/source-zip.yml` 在 main 更新时导出完整、干净的 DKTS 源码 ZIP，以及固定 SHA `20f056851a61d2144e9524c3ed568628d4b8557c` 的 DKDS 只读依赖 ZIP，并附带 manifest 和 SHA-256 校验文件。Actions artifact 名称为 `DKTS-Source-ZIP-<commit SHA>`，保留 30 天。
- 后续以 DKTS ZIP 作为云端工作区基线，DKDS ZIP 仅供只读构建。每轮交付完整 DKTS ZIP；通过测试后直接提交到 main。

- `.github/workflows/main-only-branch-policy.yml` 在 main 更新后清理所有非 main 分支，并检查仓库最终只剩 `main`。
