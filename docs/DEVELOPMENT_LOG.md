# DKTS 开发日志（累积，不删除失败记录）

每次实质开发均追加：时间、需求 ID、DKTS GitHub SHA/PR、测试与发布、失败和未验收项。此文件不是仪器实测日志；以前开发记录只做可核查的追溯摘要，不能声称包含全部历史聊天文字。

## 2026-11-10 / 所有权与架构纠偏（进行中）
- 需求：R-20261110-001。DKTS 专属开发；DKDS 只通用通信、热更新和本地完整更新；删除内置 4200；保留非分析插件并复刻 FS-Pro；需求/日志入 GitHub。
- 已完成：审计 DKDS `4200` 分支，发现源插件目录仅有通用插件、`builtin.connectivity-center` 以及禁止内置 4200 的回归测试。关闭 DKDS 业务开发 PR [#16](https://github.com/davidkane0526/DK-Data-Studio/pull/16)；未合并其代码、未修改 DKDS 源码。
- 新的 DKTS 统一开发分支 `work/dkts-framework-migration`，新增架构规范、用户需求台账、开发日志和 DKDS 上游只读核查方案。
- 待证实：用户机器上安装的 4200 是外部插件、旧安装缓存或实际旧发行包；不能凭当前 GitHub 源码断言已从用户机器删除。DKDS 的其他历史远程分支尚未删除。完整 DKDS Host 在 DKTS 内替代现有独立 WebView 壳尚未实现、不可宣称完成。

## 2026-11-10 / DKTS 只读框架与发布治理验证（PR #14）
- 需求 R-20261110-001、R-20261108-001，代码分支 `work/dkts-framework-migration`，首批提交 [1027b183](https://github.com/davidkane0526/DK-Test-Studio/commit/1027b1834a1ff0bad43c70739ad375c00ed48dff)，PR [#14](https://github.com/davidkane0526/DK-Test-Studio/pull/14)。
- 使用只读 DKDS `4200` SHA `20f05685`，上游实际为 17 个内置插件；在 DKTS **副本中**保留 11 个非分析插件，排除 6 个分析工作台/算法。保留插件包括通信、数据中心、主题、Status、Pulse import、Pulse Sampler 等；原始 DKDS checkout `git status --porcelain` 为空。
- 新增 `tools/dkds-host-profile.cjs`、`tools/stage-dkds-host.cjs` 和只读框架 CI，生成完整 DKDS 框架 DKTS 暂存源码和可审计插件清单。CI [框架核查](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/42769073733) **成功**。该暂存源码 **不能作为完成的 Windows/Android 新宿主发布**，更新源/FS-Pro UI/实机验证仍是阻塞项。
- 正式 DKTS Release 从六个相互混淆的资源改为四个明确资源：Windows Portable、Android APK、UI Bundle、硬件能力数据库；legacy/native `.dkplugin` 留在 DKTS 研发预览源，不混入 DKTS 正式安装包。具体发布后仍须逐一验证 Release。
- 已添加 GitHub 跟踪事项：[DKDS/分支归属 #15](https://github.com/davidkane0526/DK-Test-Studio/issues/15)、[DKDS Core 迁移 #16](https://github.com/davidkane0526/DK-Test-Studio/issues/16)、[FS-Pro 和测量 #17](https://github.com/davidkane0526/DK-Test-Studio/issues/17)。
- 未完成：DKDS 多余远程分支删除（连接器无删除操作）、已安装旧 4200 插件来源核验、真正 DKDS 宿主版 DKTS 运行/更新器接线与 FS-Pro 全量界面验证。未主动修改任何 DKDS 仓库源码。

## 2026-11-10 / 早期可核查记录
- [DKTS PR #12](https://github.com/davidkane0526/DK-Test-Studio/pull/12) → `9731cc57`：Core-native 离线 X/P editor、参数行、None 端口、热更 a121；CI 与 Release 成功。**不足**：独立版未真正继承 DKDS 主宿主。
- [DKTS PR #13](https://github.com/davidkane0526/DK-Test-Studio/pull/13) → `1a615606`：原生插件 v0.8.1、分段预览大数据表、KXCI 规划规则一致、原生/旧插件分发区分，V0.3.13 a122 完整包 6 项资产发布。**不足**：旧版插件仍打包供兼容，易造成用户对两种分发的混淆；最新要求需要统一。
- [V0.3.13 a122 Release](https://github.com/davidkane0526/DK-Test-Studio/releases/tag/dkts-preview-v0.3.13-a122)：Windows/Android/两种 DKDS 插件/UI Bundle/硬件能力数据库；CI 成功不构成真实 4200A 接线和输出验收。
- DKDS `4200` 分支 HEAD 曾验证为 `20f05685`、通用通信插件存在，源码清单无内置 Keithley 插件，但不代表本地历史安装无遗留。

## 长期日志模板（每次继续追加）

### YYYY-MM-DD HH:mm +08:00 — <变更>
- 需求 ID / 原话链接：
- DKTS commit / PR：
- 修改文件与原因：
- 单元、集成、真实桌面/Android 视觉测试：
- 构建与 Release 下载链接：
- 真实仪器验证（是否实际连接、型号、版本、只读/输出，原始数据证据）：
- 未完成、风险和回退方法：

## 2026-11-10 / DKDS Core Preview 宿主真实 Routine/Page 层级（PR #18 开发分支）
- 在现有 `feat/dkts-core-host-boot` 分支中进一步开发 DKTS 自有 native plugin（不触碰 DKDS）：新增 Routine 实体、页面归属、从历史 schema-1 项目的无 Routine 快照自动迁移，支持添加 Routine、在当前 Routine 添加 Page、跨 Routine 跳转。新增输出/耐久/保持/PUND/ARB 等离线类型列表，但尚未实现这些测试的仪器执行。
- 导航在真正 DKDS Core 的 UnitTemplates 面板中实现，不采用 iframe 或重新复制旧卡片 UI。原始科学 PlotView、Data Center、Prime 等 DKDS Core 组件仍由宿主维护。
- 扩展 Core mock integration 验证新建 Routine 与子 Page 映射。CI 结果以后续 GitHub Actions 为准。只有 Core Preview 分支代码已变更；不能说主线 APK/EXE 已迁移。

## 2026-11-10 / 原生 Core Spec 实体与 Page 关联（开发分支）
- 在 PR #18 内增加真正的 `specs` 项目对象、`associateSpecId` 关联、老 schema-1 快照缺省值迁移及 Spec ID/名称校验，不只是占位复选框。
- 采用 DKDS 原生 UnitTemplates 面板/选择器展现独立 Spec 列表、新建及取消 Page 关联动作。扩展实际 mock Core 宿主测试，网页与原生业务对象结构保持可逐步映射。仍不具备真实 4200A 测量或最终用户机器的 UI 验证。

## 2026-11-10 / 真实 DKDS Core Electron 启动错误及修复
- 在 [Windows/Android 真实 Core 预览 CI #42800809168](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/42800809168) 中，Windows Electron 实际启动未通过，错误为 `UNIT_TEMPLATE_UNKNOWN_VARIANT: panel:standard`。此前仅用简化 mock 测试，未校验 DKDS SDK 组件变体。
- 查阅上游只读 DKDS SHA `20f05685` 的 `sdk/unit-template-catalog.json`，确认 Panel 合法变体为 plain、headed、portable、control-card、plot-card、accepted-portable；Workspace 的 standard 是合法变体，必须区分。现将新建的 Project Explorer、Routine、Spec 三个 Panel 改为 `headed`，保留 Workspace `standard`。
- 将 SDK 变体约束加入 DKTS 自有 Core mock 测试，后续若回归 panel:standard 则直接失败。Android 预览和其他真实启动后续继续验证；不提前宣称修复完成。

## 2026-11-10 / 第二次真实 Electron 启动约束：布局几何值
- [Core 实际构建 #42801280014](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/42801280014) Windows 启动仍失败，错误：`UNIT_LAYOUT_GEOMETRY_VALUE_FORBIDDEN: identity.geometry:grid-template-columns:repeat(auto-fit,minmax(120px,1fr))`。
- 查证固定 SHA DKDS 的 `sdk/unit-template-geometry-values.json`，该表达式不是 SDK 注册允许的几何值。删除 DKTS 插件中 5 处未注册的手写布局几何，改为 DKDS 官方 `form-grid-2`、`form-grid-4`、`row-wrap` 响应式布局 Unit，采用宿主维护的移动端断点与尺寸规范。新增 Mock 校验禁止原生插件返回 `geometry` 手写值。仅修改 DKTS 分支，没有改 DKDS。

## 2026-11-10 / Output Sweep 复用原生 X/P 扫描工作台
- 原生 DKDS Core `output` 测试类型虽然已注册，但其参数区错误被分流至“仅离线草稿”，没有呈现 Xsweep/Psweep 编辑器。已将 Output Sweep 与 I–V / Transfer 一同使用 DKDS Unit 原生扫描编辑器。
- Core mock 回归增加新建 Output Page、分配 SMU、核查 Xsweep Panel 的检查。仅离线参数规划，不允许 4200A 真实执行。进一步真机验证仍必要。

## 2026-11-10 / Windows Core 实际截图发现中性空主界面，默认 SUPER 启动修复
- 检查成功构建 #42801595891 的真实 1200×760 Electron 截图，画面显示“尚未指定 / 当前主界面不可用”，尽管 4200A 插件状态为 active、SUPER identity 正确。早期 smoke 只检查加载状态和非空截图，没有检查当前真实 Activity，因此通过得过早。
- 根因：固定 SHA 的 DKDS `package-runtime.js` 通过 manifest `workspace.defaultSuper===true` 决定启动关键插件，而 DKTS 原生插件未声明该字段。即使派生文件里注入 fallback SUPER ID，插件可被延期加载，宿主启动选择时仍可能显示中性页面。故只在 **DKTS 自己的原生插件 manifest** 及内嵌 manifest 中设置 `workspace.defaultSuper:true`，保证首次启动进入关键加载序列。未修改 DKDS。
- 加强真 Electron smoke：必须确认 `activeActivity==='dkts-keithley-4200'`，而且中性主界面不可见，否则不再把构建判为成功。下一轮完整 Windows/Android 预览结果以 CI 为准。

## 2026-11-10 / 实机截图复核：FS-Pro 树与图布局改善
- 修复默认 SUPER 后的 [真实 Windows Core 截图](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/42804640677) 显示 4200A 工作区确实可进入，但 Project Explorer 和新建操作仍是横向拉伸的大块按钮，不符合用户明确要求的 FS-Pro 层级。
- 仅在 DKTS 原生插件中把 primary 内容改用 DKDS Core SDK 的 `sidebar-main-compact` 栅格，在左侧放 `stack-compact` 工程树，右侧放继承 DKDS PlotView 的 Data/Graph 内容。不增加手写 CSS 或重复框架。新增 Mock 布局断言并继续以真实 Electron 截图验证，不能预先宣称达到像素级一致。
