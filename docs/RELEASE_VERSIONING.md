# DKTS 单一发行路线（2026-11-10 起）

## 命名
- 发行应用版本：`Vx.y.z`。来源为 DKTS `package.json`，用于 Windows/Android 的主版本。
- 本次构建/热更号：`aNNN`。同一次 main 提交的 UI 包和完整安装包使用相同 `Vx.y.z aNNN` 与 Git SHA。
- DKDS 上游版本（例如 3.72.3）仅是 **只读框架依赖版本**，绝不作为 DKTS UI、APK、EXE 版本。
- 历史外部插件内部版本（例如 0.8.1）只标识 Plugin API 兼容预览，不能称为 DKTS 应用版本，不能自动覆盖主程序。

## 交付逻辑
- **UI 可热更新**：只替换允许的 index.html/app.js/styles.css，保持 V 不变，更新 aNNN；不要求用户下载完整包。
- **原生宿主/驱动变更**：发布具有相同 V/a 的完整 Windows Portable 和 Android APK；检查兼容后在应用内的更新面板走本地完整安装。不能用 UI 热更假装修改了原生二进制。
- 每次 main 成功提交仍应发布完整的 DKTS 包，供需要重装者下载；不强制 UI 热更用户升级完整包。
- 标题只显示 V；aNNN 仅在版本/更新面板显示。Release/Actions 展示完整 V+a。
- **正式 DKTS 发布资产**：Windows Portable EXE、Android APK、UI bundle、可导出的硬件能力数据库。旧 DKDS `.dkplugin` 与实验性 Core-native `.dkplugin` 不再作为正式 DKTS Release 附件，也不放入 DKDS 内置目录。
- 仍需完成 DKDS-host 的 DKTS 更新服务器来源与 full installer 适配才可发新架构安装包，不能把临时 staging 视作已交付。
- 已发布的 a121/a122 历史 Release 保留用于对照，不追改删除和掩盖其历史双插件问题。

## 2026-11-11 已执行的 Core 主线切换与暂时发布边界
- 用户明确授权把 DKTS PR #18 合并至 `main`（merge `cdc159dd`）；以后新架构只由 DKTS 仓库的只读 DKDS Core 暂存构建，不修改 DKDS。
- 原本 `windows-preview.yml` 的 legacy standalone Windows/Android 发行流程已经替换为依赖真实 Core CI 全部成功的 **Core Preview** 发行流程；已废弃的 DKDS 分支定时签名工作流被删除。历史 Release 仅用于回溯，不代表新 Core。
- 当前 `ui-update.yml` 只为每次 main 更新分配相同 Git SHA 对应的 `aNNN` 修订号并执行测试，不再把旧壳的 UI Bundle 当作 Core 可热更新资源。**这是未完成项，不是取消用户的热更新需求。**
- 在 Core-compatible UI bundle、生产签名、固定包名完整更新、哈希校验与失败回退通过以前，仅提供独立包名 `studio.dk.test.corepreview` 的测试签名 Android 预览和独立 Windows Portable 预览，明示不得覆盖稳定版。之后恢复相同 V/a 的正式双平台完整包和可用热更。
- Release 成功状态、EXE/APK 实际附件和 Android/Windows 真机截图以 Actions 输出为证，不以代码存在推定完成；真机 KXCI 与数据中心全链路仍待验收。
