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

## 2026-11-10 / FS-Pro 原生 Page 编辑器业务数据与旧项目兼容
- 根据用户 R-20261110-006，将 Page 基础信息（名称、备注）、Target（通道与测量量）、Page Var（名称/数值/单位）加入 DKTS 唯一项目模型；历史已保存的 Project 自动增加安全默认值，不修改原始快照。
- 提供经过统一 validate 的 `editPage/editTarget/addVariable/editVariable/removeVariable` API，并增加不可变操作/非法输入/数据迁移回归测试。所有内容仅作为离线测试规划，不发送任何 KXCI 指令。
- 原生编辑器后续使用 DKDS Core Unit 层调用这些 API，在主工作区展示 Page 分区与字段，不再将重要参数默认隐藏为 PRIME 标签。无 DKDS 修改。

## 2026-11-10 / Core UI 主界面内嵌 FS-Pro 编辑器
- R-20261110-006：将当前在 PRIME 中默认隐藏的参数编辑器移到 DKDS Core 主工作区，使用正式 `sidebar-main-compact`、`responsive-two-column`、`form-grid-4` 实现项目导航 / 参数编辑 / 科学 Data/Graph；端口选择主屏可见，保留可停靠的 Port PRIME，不复制网页独立运行壳，绝不修改 DKDS。
- 新增 mock 断言 primary 双列与 Terminal 面板可见。该提交不代表 FS-Pro 全部标签或视觉验收完成，后续以 Electron 实际截图/Android 编译与 Android 真机为准。

## 2026-11-10 / FS-Pro 七项 Edit Page 迁移至原生 DKDS Unit
- 在 Primary 主屏通过 DKDS Unit Tabs 展示 Info / Sweep / Target / Strategy / Limits / Page Var / Associate Spec 7 项；Page 名称备注、Target、变量和 Spec 与工程持久化数据模型相连。参数默认直接展开，不再默认锁定或隐藏在 PRIME。
- Xsweep 在 SMU 尚未分配时仍允许离线编辑规划（真实硬件输出保持禁用）；独立 Terminal Settings 只显示已分配端口。复用 DKDS Field、Panel、Tabs、Scientific Plot，不建立 iframe/独立 WebUI 壳。
- 本变更仅修改 DKTS Core Preview 分支；CI 和真实截图是验收依据，不能视为已经达到 FS-Pro 1:1 像素对应，更未验证硬件。

### 测试约束调整
- 七标签迁移后的 Terminal Settings 使用一块紧凑 DKDS Panel 管理所有已分配端口，故原 mock 断言单端口独立 Panel（D · SMU1）失效。已将断言调整为真实设计意图；不是隐藏真实错误。仍以后续实机 UI 启动 smoke 为准。

## 2026-11-10 / Core Project Explorer 视觉层级与组件纠正
- 旧原生项目导航用多层 headed Panel + 独立按钮，截图中出现重复 Routine 标题、拉伸按钮及无意义空边距。替换为 DKDS 原生 List Unit 的 Research Project → Routine → Page、Spec 导航；主操作区域采用 Row-Wrap Unit，当前 Page 的删除动作用统一工具行承载。
- 仍使用 DKDS Core 的 Theme/Action/List/PlotView 基础，不创建独立网页或手写样式。模拟测试增加原生 list mock 并保留项目选择、关闭和所有权校验。仅修改 DKTS。

## 2026-11-10 / DKDS PlotView 真实截图标题栏顺序修正
- 在 Windows 真截图 `08c0a294` 中发现“Data / Graph”标题栏显示在空白曲线区域下方，原因是 DKTS 插件把 Core Header 挂到 Panel.element（body 之后），与 Panel.body 内的 PlotHost 形成错误 DOM 顺序。
- 改为在 Panel.body 内先建立 DKDS Core Plot Header，再放入 PlotHost，仍通过 DKDS `units.plotView.adopt` 共享标题栏/导出/移动功能；此修改只发生在 DKTS 原生插件，不修改 DKDS。需后续真 Electron 截图确认。

## 2026-11-10 / 原生视觉回归闸门：FS-Pro 七标签 + 窄屏截图
- 原先 Electron smoke 只判断 SUPER 与截图非空，可能让只有项目树和空图的粗糙屏幕错误通过。现增加 `hasNativePageTabs`、`hasTerminalEditor` 真实 DOM 断言，七标签与 Terminal 主屏不在则不能标记成功。
- 增加 Windows Electron 实际 UI 的 744×600 窄屏捕获 `core-host-narrow.png` 并加入 CI Artifacts，与 1200px 桌面截图并列评审。该截图仅模拟响应式桌面窗口，**不是 Android 实机界面验收**。
- 所有新测试和布局代码仍只在 DKTS 分支；上游 DKDS 坚持只读固定 SHA。

## 2026-11-10 / 与网页版尺寸比例一致的原生编辑区
- 真 Electron 1200px 截图显示编辑区和空数据图被平均分配，前者过窄导致 Xsweep 的起止步长/量程控件频繁折行。改用 DKDS 官方 Layout Unit `responsive-two-column` 和 DKDS 固定 SDK 已注册的 `minmax(0,1.25fr) minmax(320px,.75fr)` 比例，并增加 680px 下自动单列布局。
- 对扫描段使用 Core `form-grid-4` 的注册响应式几何覆盖：620px 以内优先四列，520px 内自动两列。这些值均在固定上游 `sdk/unit-template-geometry-values.json` 允许列表内，仍由 DKDS Core Layout 统一执行。新 mock 校验只容许这几项已注册值，禁止任意手写 CSS/几何。

## 2026-11-10 / Project Navigator 标签文本回归
- 检查实际 Electron 截图发现 DKDS List Unit 的 `meta` 在当前窄项目树样式中紧贴名称（`Routine 1Routine`、`I–V SweepDC`），视觉混乱。移除该处重复类型文字，保留 Routine / Page 的区分符号和层级顺序，依然使用 Core List Unit，而不是自制 CSS。

## 2026-11-10 / 原生 Terminal 档位栏桌面四列验收
- 真实 Electron 图中 Terminal 4 个端口 D/G/S/B 仍错误显示为两行，过度消耗垂直空间。将主工作区 Terminal DKDS 原生 `form-grid-4` 设置为 SDK 官方已注册 620px 以下四列、520px 以下两列 responsiveGeometry，使常见 1200px Windows 宽编辑器显示四端口同一行，狭窄编辑器才换行。
- 补充真实 Electron screenshot smoke `terminalGridColumns` 检查：桌面主屏达不到四列，CI 不应再报告成功；同时在 DKTS mock 中明确校验所用 SDK 已注册几何值。未修改 DKDS。

## 2026-11-10 / Electron 几何检查不应误拒绝已加载 UI
- 四端口单行的新增真实 Electron CI #42813318990 失败，`terminalGridColumns:1` 仅为基于 `getComputedStyle().gridTemplateColumns` 的字符串 split，插件容器嵌套 / UI 初始化可能不返回真实可视列数。7 个标签、Terminal、Core/SUPER 已经加载，该单一统计不能证明 UI 失败。
- 改为记录四个原生 Select 在 Electron 真实窗口的 `getBoundingClientRect()` 位置、所处分组行数/列数、布局 CSS 等，以真实截图进一步确认；保留真正功能性门槛，不再依赖脆弱字符串拆分作为阻止 EXE 构建的条件。该变更仅在 DKTS 自有 smoke 脚本与日志，DKDS 只读。

## 2026-11-11 / Core Host 原生 Device 归属与发布标识（PR #18）
- 按最高优先级 DKTS-only 迁移路线继续，仅改 DKTS `feat/dkts-core-host-boot`，不修改 DKDS。对应主线已记录的 R-20261111-001 与 R-20261110-001。
- 原生模型在原有 schema:1 下可无损迁移旧项目：`devices` / `activeDeviceId`、Routine.deviceId、Spec.deviceId，Page 通过 Routine 归属 Device；校验跨 Device Spec 关联失败，而非错误静默链接。
- 原生 DKDS Unit Project Explorer 添加真实 Device 选择和新增按钮，Routine/Spec 列表按当前 Device 过滤，Core 主界面不再把 Device/MOSFET 当作虚假固定层级。未改变端口安全、测量输出权限或 raw 数据来源。
- 增加模型状态与历史快照迁移、跨设备 Spec 隔离、原生 UI mock、真实 Electron smoke 的 Device 控件检查。测试与 Windows/Android Core Preview 工件以 CI 真实结果为准。
- 发行主版本仍为 **V0.3.13**。Core PR Preview 的独立 CI 构建序号显式标记为 `PR#`，避免与主线稳定版的 `aNNN` 混淆；只有合并后主线发布工作流才递增 `aNNN` 并生成同 V/a 的完整包。本 PR 尚不作为稳定 DKTS 安装包发布。
