# DK Test Studio (DKTS)

**Keithley 4200A-SCS 专用测量程序。** 目标是 **完全基于 DKDS 框架**，以其成熟 Core/插件/更新体系为唯一宿主，复刻 FS-Pro / LabExpress 的页面层级、端口配置、扫描策略和测试流程。**今后 4200A 的研发只在这个仓库中进行，不修改 DKDS。**

> 2026-11-10 开发边界以 [AGENTS.md](AGENTS.md) 和 [用户需求台账](docs/USER_REQUIREMENTS.md) 为准。较早文档可能描述历史方案，不得覆盖本次新要求。

## 当前状态（区分实现与目标）

- 已有独立 DKTS V0.3.13 a122 Windows/Android 发布包、UI 热更新、KXCI 基础连接/扫描相关源码、硬件能力数据库和 FS-Pro 风格 UI 的部分实现。历史程序采用独立 WebView/Electron 壳，**不能称为已完整基于 DKDS 框架**。
- DKDS Core 宿主迁移正在 DKTS 单一工作分支进行。使用 **只读、固定 SHA 的 DKDS 上游源码**；保留所有非分析插件及 Core 基础设施，在 DKTS 的临时构建目录中排除分析插件，不修改上游。
- DKDS 已有通用通信、UI 热更新、本地完整更新功能；DKTS 新宿主需要验证其发行来源、签名、热更/全量更新兼容、Windows/Android 真机 UI 和 KXCI 执行安全，**在验证完成前不发布替代当前独立 App 的安装包**。
- 历史 `.dkplugin` 仍在本仓库，供兼容和研发预览，但不再混进每一次正式 DKTS 完整包。这不会将任何 4200A 功能重新加入 DKDS 内置插件。
- 当前 DKDS `4200` 分支的内置插件目录没有 4200A 程序，但这不证明用户安装设备中的旧插件缓存已被清理。旧 DKDS FS-Pro PR 已关闭。

## 项目入口

- [不可变的开发边界](AGENTS.md)
- [用户要求、优先级、历史要求](docs/USER_REQUIREMENTS.md)
- [连续开发日志与真实验证范围](docs/DEVELOPMENT_LOG.md)
- [DKDS Core 宿主架构及 FS-Pro 验收](docs/ARCHITECTURE_TARGET.md)
- [DKDS 只读上游与分支核查](docs/UPSTREAM_BRANCH_AUDIT.md)
- [版本和发布约定](docs/RELEASE_VERSIONING.md)
- [开发任务](docs/ROADMAP.md)

## 目前可用安装包

最后一个经 CI 发布的旧壳版本为 [V0.3.13 a122](https://github.com/davidkane0526/DK-Test-Studio/releases/tag/dkts-preview-v0.3.13-a122)。它**不是**完成迁移后的 DKDS Host 版，须保留在用户需要兼容的旧环境中。后续每次正式发布都有相同的 `Vx.y.z + aNNN` 标识，热更新仅在确实只改变 UI 时使用。实验插件与旧版兼容插件单独验证，不放入 DKTS 应用 Release 的正式资产列表。

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
- 本 Demo 由**现有 DKTS Web UI** 构建，使用真实前端布局/图表控件和离线模拟接口；不可连接 Keithley 4200A、不可输出电压、不可把示例规划数据当作仪器原始测量。现有 Web UI 与目标 DKDS Core Host 仍不是同一阶段的架构，请勿把网页预览视为新宿主已完成。
- 本地构建：`npm install && node tools/build-ui-system.cjs && node tools/prepare-dkds-plot-vendor.cjs && node tools/build-web-demo.cjs`，再通过静态 HTTP 服务打开 `dist/web-ui-demo/`。
