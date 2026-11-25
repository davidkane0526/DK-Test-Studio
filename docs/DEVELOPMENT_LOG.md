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

## 2026-11-10 / 网页 UI Demo 与 DKTS 分支治理（实现提交待验证）
- 需求：R-20261110-002、R-20261110-003（GitHub Issue #19）。
- 在 DKTS 内新增从现有 Web UI 生成静态站点的工具、纯离线演示适配器、GitHub Pages/Actions 流水线及安全回归测试。演示不修改 DKDS，不允许连接 4200A 或执行任何输出，也不将规划曲线伪装成仪器采集。
- 加入对 main 已完全包含、非保护且无活跃 PR 的历史分支的保守自动清理；其他有独有提交分支保留用于后续归并审查。删除结果以 GitHub Actions 实际输出为准，不在本日志预先声称清理成功。
- 待验证：Actions 网站构建、GitHub Pages 是否已开启以及真实可访问地址；桌面/Android 实机视觉测试、真正 DKDS Core Host 迁移及实际 KXCI 安全运行。此次只交付 UI 预览构建，不是新原生安装包验收。


## 2026-11-10 / 网页 UI Demo 初次运行结果及浏览器检查
- DKTS 提交 [ecf42750](https://github.com/davidkane0526/DK-Test-Studio/commit/ecf42750bf0b8e5a07015dce153b7e71e4e43916)：网页资源构建、离线安全测试与 Actions artifact 成功。 [网页构建 #42784784297](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/42784784297)。
- Pages 部署**失败（404）**，明确为仓库尚未启用 GitHub Pages：需有权限的维护者从 GitHub Settings > Pages 将 Source 设置为 GitHub Actions。网页打包产物已在本次构建工件可下载，不可声称线上地址已可访问。
- [分支治理 #42784784170](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/42784784170) 成功删除已完全并入 main 的 `feat/kxci-native-smu-runner-ui-compact`，从 19 条减到 18 条；17 条有独有提交或保护关系的分支暂保留，不能把删除工作视为全部完成。
- 继续新增真实 Chromium 桌面和平板视觉交互测试：检查测试卡片、Xsweep/Psweep、禁用测量输出、无模拟 raw 行及无 `/api` 仪器请求；产出截图工件。测试结果以后续 CI 为准。

## 2026-11-10 / Chromium 回归与分支清理补充
- 初次 Chromium 运行进入真实桌面端 I–V 工作区，但断言只接受“等待仪器返回原始数据”，实际 UI 空数据提示为“暂无该测试方式的实测数据”。属测试文案匹配问题，不能据此声称网页功能通过；现已修正并重新触发测试。
- 分支清理升级为两项可核查的删除依据：① 已完全合并于 main 的历史分支；② 已合并 PR 对应分支、合并记录证明且该分支 HEAD 与合并时 PR HEAD 完全一致。活跃 PR、保护分支、备份和未审查的独有提交均保留。删除结果仍以 workflow 回报为准。

## 2026-11-10 / 自包含网页 Demo 与中文截图可读性
- 已用 GitHub Actions Chromium 渲染桌面 I–V 和平板 I–V/Psweep 页面，交互检查及无仪器请求检查通过；生成 4 张截图。容器截图审查发现 Ubuntu 浏览器环境缺少中文 CJK 字体，中文标题显示方框；已在 CI 浏览器步骤增加 `fonts-noto-cjk` 安装，待下一轮验证。
- 增加单文件 HTML 构建器，将当前网页、CSS、DKDS/D3 脚本和安全离线适配器打包为一个无需 Web 服务器的 HTML 文件，Actions 输出单独可下载工件；本地导出的首份 HTML 另已生成。该工件不替代未来真正 DKDS Core Host 开发。

## 2026-11-10 / 用户拒绝网页回退，FS-Pro 工作区纠正
- 需求 R-20261110-004。此前 `ce90a57c` 静态网页 Demo 的 build 脚本直接拷贝旧 `web/index.html` 及被拒绝的 a97 视觉回退样式；虽然 CI/Pages 成功，但**网页 UI 选型错误**。用户明确拒绝，必须保留此失败记录，不得再把旧界面作为新 Demo 首页。
- 基于 LabExpress/FS-Pro 公开界面资料和既有用户层级要求，新增 `web/fspro-workbench/` 的独立可复用 Page/Scan 编辑器：Project Explorer、Routine/Page、Info/Sweep/Target/Strategy/Limits/Page Var/Associate Spec、嵌套 X/P 扫描、端口独立量程/限流和固定偏置。构建器改从该新页面生成 Pages/单文件 HTML，完全阻止旧卡片 UI 误发。
- 运行时仅规划，不允许仪器连接或虚构原始数据。数据绘图视图继续引入现有 DKDS 科学绘图分发内核（空数据），规划曲线有清楚标识。FS-Pro 外观/层级尚须与完整厂商手册和用户确认截图进一步核对，不把此次演示当作 1:1 完成，也不把它称为真正的 DKDS Core Host 应用。
- 增加 Node 规划/安全边界回归、真实 Chromium 桌面/平板截图与交互测试。实际测试/Pages/附件以 GitHub Actions 报告为准；未合并的 Core Host 预览 PR #18、Windows/Android 新宿主应用仍是后续工作。没有修改 DKDS。

## 2026-11-10 / FS-Pro 与原生 DKDS 扫描契约对齐
- 网页 Xsweep/Psweep 规划器此前采用 `Math.floor(...)` 估算点数，可能默默截断无法到达的指定终点，例如 0→2 V、0.3 V 步长。这会造成网页预览与原生 DKDS/KXCI 规划不一致。
- 修正为与 `integrations/dkds-native/model.js` 一致的严格终点整除检查；单点段必须 0 步长；单段上限 4096 点。新增网页与 DKDS 原生插件模型双层循环总点数一致性测试。仍为离线规划，未授权仪器输出。

## 2026-11-10 / FS-Pro Project→Routine→Page 实体化
- 修复网页 Demo「＋ Routine」此前复用「＋ Page」弹窗、没有真正 Routine 对象的错误。新增 `routines` 数据模型、`routineId` 页面所有权、按 Routine 分组的项目树、真实 Breadcrumb 与新增 Routine / Page 操作。
- 规划草稿改存 localStorage，兼容旧 sessionStorage；导出项目包含 Routine 与 Page 的归属关系。新增桌面、平板 Chromium 交互断言，以 CI 为最终判定。此项仅在 DKTS 网页工作区实现，Core 宿主尚需进一步集成，未修改 DKDS。

## 2026-11-10 / FS-Pro 真实 Spec 对象与 Page↔Spec 关联
- 网页此前只有“Associate Spec”复选框，没有 Spec 实体。新增单独的 Spec 集合、项目树入口、Spec 选择器及可持久化的 `associateSpecId`，项目导出带 Spec 和 Routine 与 Page 所有权。
- 保持只规划、无测量输出、无虚构原始采集。新增 Chromium 测试要求新建 Spec 并验证 Page 关联。该层目前实现于 DKTS Web FS-Pro 预览，Core 宿主尚未集成 Spec，同样不声称像素级 1:1 验收。

## 2026-11-11 / FS-Pro Device 归属与发行版本
- 需求 R-20261111-001（用户原话已由 `3319f73` 入账）。DKTS Web 工作区将固定的 MOSFET 占位文字改为可创建/切换的 Device 实体，Routine 与 Spec 按设备归属隔离，Page 仍归属于 Routine。
- 对浏览器历史本地状态补充向后兼容的 Device ID，导出的规划 JSON 升级 v2 并包含 devices/routines/specs/pages；增加 Node 静态检查和 Chromium 桌面/平板的跨设备 Spec 隔离测试。
- 主程序 V0.3.13 不变；GitHub Actions 负责自动递增 `aNNN` 并发布匹配的 Windows/Android 全量包与 UI bundle，实际成功情况以工作流与 Release 为准。网页仍为离线预览，DKDS Core PR #18 及实机 4200A 均尚未验收。
- 未修改 DKDS。
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


## 2026-11-11 / DKDS Core Android 预览补充 API 36 实际启动闸门
- 仅在 DKTS 的 `feat/dkts-core-host-boot` 修改 CI，不修改 DKDS。之前 Android Core 预览工作流只编译 ARM64 debug APK、检查包名和插件目录，不能证明 WebView/React Native 宿主能成功启动。
- 增加同一 debug APK 的 arm64-v8a + x86_64 ABI 构建，Android 16/API36 x86_64 模拟器执行 APK 安装、按 Manifest launchable-activity 启动、应用进程存活、截图非空和崩溃日志检查，并保留真实截图与日志为独立 Actions artifact。
- 模拟器检查不等于用户 OPPO ARM64 平板实机验证，也不代表有 4200A 输出控制、原始数据采集或完整 UI 手势验收。若 CI 失败必须记录具体步骤并修复，不能凭 APK 编译成功宣称 Android 完成。
- V0.3.13 不变；PR 构建号独立于 main 的 aNNN，合并到 main 并通过发布闸门后才由主线自动分配新 a 编号。

## 2026-11-11 / PR 与 main 兼容检查：修复旧原生插件断言
- PR 与 `cbc15ed` 主线同步后，main 的 `DKTS Core-native DKDS Plugin` CI 运行，发现单元测试仍以旧源码变量 `t/controls` 检测 Terminal 固定偏置条件，实际 Core 版本自此前改为 `term/grid`；这是静态断言版本漂移，不是重新引入重复 X/P 参数。
- 将正则断言对齐当前真实实现 `if(term.role==='CONDITION')numericField(grid,term.logical,'bias',...)`，仍要求仅 Condition 端口显示 Fixed Bias，Xsweep/Psweep 均由扫描段单一数据模型负责。其余安全验证不修改。
- 运行结果需以后续相同 SHA 的完整 CI 为准；如有其他失败继续定位，不能将全部工作流声明通过。

## 2026-11-11 / PR 外部插件安全扫描文本误报修复
- 与 main 同步后的原生插件 CI `#80` 在更正端口断言后继续失败。原因是静态黑名单 `/\\biframe\\b/` 把源码注释中的字面单词当成实际 iframe 代码；源文件没有创建 iframe，也没有调用私有 transport/fetch。
- 仅改写注释，使静态禁止 iframe/私有联网的断言保持原强度。未新增 iframe、未绕过原生 API 约束，也不改变测量安全策略。接下来的 CI 仍需独立判定。

## 2026-11-11 / 真实 Electron 截图审查：删除重复设备提示与双重高亮
- 下载并人工检查 Actions Core Preview PR58 工件中的 1200×760 与 744×600 真 Electron 截图及 report.json。证实启动 DKTS 真 DKDS Host、设备选择、七项 Page tab、Terminal 四列都存在，且状态栏/主题/数据中心/通信存活。截图仍显导航挤压、设备标题重复、Routine 与 Page 双选中等视觉问题；因此不能把“截图非空”当作 FS-Pro UI 1:1 完成。
- 在 DKTS 原生插件中只移除 Project Header 对已显示在 Device selector 中的设备名重复提示，并将 Routine 作为不高亮的祖先节点，仅 Page 选中显示焦点。保留所有 DKDS Unit API，不增加自制 CSS、点击阴影或独立网页壳。
- Core mock 补充重复元信息/双重选中回归断言；变化须以后续真 Windows/Android 截图再次核对。DKDS 上游未修改。

## 2026-11-11 / Android 16 启动脚本 POSIX Shell 兼容修复
- PR58 Android Core Preview 在双 ABI 编译及 API36 模拟器启动后失败，GitHub Actions 日志明确报 `/usr/bin/sh: set: Illegal option -o pipefail`。该 emulator-runner 的 `script` 默认用 `/bin/sh` 而不是 Bash，故尚未安装 APK，不能把失败误认为应用崩溃。
- 将该脚本的 `set -euo pipefail` 改成 POSIX 兼容的 `set -eu`，保留后续 APK 安装、Manifest Activity 启动、进程、截图和崩溃检查。其他安全逻辑、仪器输出和 DKDS 均未修改。

## 2026-11-11 / Android Core 预览脱离 Metro 的离线打包修正
- 审核 GitHub Actions 的 PR53 真实 APK `app-debug.apk`（约 55 MB）。APK 含 `assets/dkds/index.html` 与 Android ARM64 native libraries，但 **没有 `assets/index.android.bundle`**。故 Debug APK 虽可安装，其 React Native 宿主在无 Metro 环境下不能被认定为独立可用；仅用应用进程存活或非空截图可能产生误报。
- Core Android 预览切换为 `assembleRelease`，仍使用自动生成的 **Android Debug 测试签名**及隔离包名 `studio.dk.test.corepreview`，不使用正式 DKTS 稳定签名，也不上传到正式 Release。
- CI 强制验证 Android arm64/x86_64 native libraries、`assets/index.android.bundle`、debug signer、API36 模拟器实际安装启动、React Native 明确的离线加载/崩溃错误与截图文件。编译、签名和安装是否成功以下次 CI 为准，绝不把此预览称为正式版。
- 原始 DKDS 仓库仍只读；没有向实机 Keithley 4200A 输出电压，没有采集仪器 raw 数据。正式版版本仍 V0.3.13 a135，Core PR 只记录自己的 CI 序号。

## 2026-11-11 / 离线 Android 工作流 YAML 修复（未到编译阶段）
- `4551786` 的 Core Android 工作流 #66 未创建任何 job，GitHub 判定 YAML 无效。核查发现程序化文本替换把正则表达式中的 `$'` 误解析为 JavaScript replacement suffix，引入重复工作流尾段和不闭合的 grep 字符串。
- 不从受损文件继续补丁，而是从此前正常解析的 `5db82b` 工作流重建，使用 callback replacement 避免 `$'` 特殊展开；改用无需行尾 `$` 的 `grep -Fxq` 精确检查 `assets/index.android.bundle`。增加关键工作流步骤的数量检查，确保无重复 Android Job 和 heredoc。
- 重新提交后的 CI 必须正常解析、执行 Release JS Bundle 检查和 Android 16 启动，不能把错误提交的构建视为完成。

## 2026-11-11 / Core CI 去重避免 Windows/Android 大包重复构建
- 原 Core framework workflow 同时监听 `push: feat/dkts-core-host-boot` 与 `pull_request: main`；同一 PR 提交导致重复执行相同的 Windows Portable 和 Android Core APK 编译，浪费 CI 资源并制造难以对应的构建报告。
- 改为 `push: main`、`pull_request: main` 和手动 dispatch。PR 分支通过 GitHub PR 的同一合并候选代码进行完整框架/Windows/Android 测试，主线合并后仍自动复验；同一个 PR 提交不再触发双份重型构建。Core Preview Contract 的轻量分支 push 测试不受影响。

## 2026-11-11 / Android Core Preview 实际安装闸门修复
- 复查同一 PR 代码的 Framework Contract #69（SHA `4ee6344`）。Windows Electron 真启动/截图/Portable job 成功，DKDS 只读合约成功，Android `assembleRelease` 与离线 JS Bundle/双 ABI/APK 签名检查成功，但 API36 模拟器脚本在安装前失败。
- 根因：`reactivecircus/android-emulator-runner@v2` 将 `script:` 多行每一行独立用 `/bin/sh -c` 启动，`apk=...` 和 `package=...` 变量在下一行丢失，随后 `test -s "$apk"` 失败。此前已消除 `pipefail` 非 POSIX 兼容问题，但没有解决逐行独立 Shell 的根因。
- 仅修改 DKTS：新增 `tools/run-core-android-smoke.sh`，让 CI 通过 **单条** `script: bash tools/run-core-android-smoke.sh` 执行，从 manifest 解析真实 Activity、校验包名、离线 APK 安装、启动、pidof、截图、React Native 错误与 crash log；新增 `tests/core-android-offline-smoke.test.cjs` 回归，检查单 Shell 调用、Release JS Bundle 与 Bash 语法。相应失败日志/截图按 CI artifact 保留。
- 仍不把模拟器启动视为用户 OPPO 真机验收或 Keithley 实际采集/安全控制。DKDS 仓库未写入。程序主版本 `V0.3.13` 不变，`aNNN` 只在主线 Release 流水线分配；本次属于 Core Host PR 预览构建，正式稳定版最新已验证为 `V0.3.13 a135`。
- 回归是否通过以本次新 SHA 的 CI 结果为准，未事先宣称成功。

## 2026-11-11 / DKDS SDK 兼容性工作流固定只读上游 SHA
- 在 `c159238` 的 `Validate DK Test Studio #518` 中，Node Ubuntu / Node Windows 与能力数据库检查均成功，但 `DKDS Plugin API 1.19 compatibility` 的 `Checkout DK Data Studio SDK` 连续三次执行 `git fetch ... +refs/heads/4200*:...` 失败，未进入 SDK 验证阶段；因此不能将整套 CI 宣称通过。
- Core framework 读取的 DKDS 上游已固定为 `20f056851a61d2144e9524c3ed568628d4b8557c` 并通过只读检查。将旧 `.github/workflows/ci.yml` 中浮动 `ref:'4200'` 改为该精确 SHA，同时设置 `persist-credentials:false`，避免 SDK 检出与真实 DKDS Core 宿主针对不同版本、避免残留跨库授权。
- 不修改 DKDS，保留外部插件验证闸门的完整步骤。新工作流结果仍需下次相同 SHA 的成功日志确认。

## 2026-11-11 / Android 16 独立 Core Host 实际启动成功与截图质量追踪
- Core Host Framework Contract #70（PR merge SHA `9e7de859`）**全部成功**：Windows Electron 原生 Core 真实启动、双尺寸截图、Portable 预览构建；DKDS 只读检查；Android arm64/x86_64 独立 Release APK（包含 `assets/index.android.bundle`）完成构建、签名校验，并在 API36 emulator 安装与冷启动成功。
- 下载并检查 #70 的 Android Emulator Artifact（`DKTS-Core-Android-Emulator-V0.3.13-PR70`）：`startup.txt` 显示 `Status: ok`, `LaunchState: COLD`, `MainActivity`，`pid.txt` 有进程号，`runtime-errors.txt` 与 `crash.log` 均为空。但 `screen.png` **被 Android 首次 immersive-fullscreen 系统提示“Viewing full screen / Got it”遮挡**，属于真实 UI 验收盲点，虽然背后 DKDS Core 4200A Page 已可见。
- DKTS-only 改进：在 Core Preview 启动前静默确认 Android 全屏引导；用 UI hierarchy 检测并在固定 320×640 的模拟器上有条件关闭提示，拒绝残留系统遮挡；分别截取真实 320×640 窄屏和 1024×768 平板横屏，校验 PNG 真实尺寸、进程存活并保留文件。增加静态回归测试。UI 是否符合 FS-Pro 层级/手势仍需核查新截图，不因这次修改预先声称完成。
- GitHub PR 保持 draft；仅 DKTS 仓库发生变更。稳定发行仍为 V0.3.13 a135，预览 Build 使用 V0.3.13 PR CI 运行号，更新与 Keithley 4200A 实机数据尚未验收。

## 2026-11-11 / Windows Core 真截图：去掉重复的 4200A Page Header
- 下载并直接检查 Windows Core Preview #70 的 `core-host.png`（1200×760）。窗口上方 DKDS Host 原生 Activity Bar 已有 `4200A`；下方 42px 高的 `analysis-page-header` 再次显示 `4200A`，占据宝贵工作区高度。该 Header 是 DKTS 插件手动 `units.pageHeader.create(...title:'4200A')` 构建，并不是框架强制插入。
- 对照固定只读 DKDS Core 的 `src/core/ui/modules/composition/unit-template-foundation.js` 和 `src/styles/structure/plugin-workspace.css`：SUPER 根页面的 import 操作本就隐藏，Page Header 与 Host 的 Activity Bar 重复。因此在 DKTS 原生插件移除这一无用 Header/空动作槽，**仍使用 DKDS 的 page.create/body、Workspace Unit、Tab、PlotView、Theme 等原生服务**，不改 DKDS 样式或宿主。
- Core mock 新增禁用冗余 Page Header 的检查；真 Electron smoke 检测可见的同名 `analysis-page-header` 并拒绝回归。具体尺寸效果以后续截图为准，不把代码检查当作视觉验收。
- V0.3.13 程序版本保持不变，Core PR 仍为预览，不改变当前正式版 a135。

## 2026-11-11 / Android Core 窄屏布局修正，保持 DKDS Unit 规范
- Core Host Framework Contract #72 **全通过**（https://github.com/davidkane0526/DK-Test-Studio/actions/runs/42967419152），下载 Android 模拟器实际 `phone.png`（320×640）与 `tablet-landscape.png`（1024×768）人工复核。系统全屏弹窗已经消失，安装、Activity/进程、错误日志正常。但 320px 手机上 Project Explorer 和参数编辑器仍被固定 150px/150px 双列割裂，严重影响可用性；1024px 横屏基本正常。
- 查固定只读 DKDS Core `src/core/ui/modules/composition/unit-template-layout-spec.js`：`sidebar-main-compact` 的原始 recipe 在宽度 <=760 时强制 `150px minmax(0,1fr)`，并不会进一步自动切为单列。继续使用相同宿主 `sidebar-main-compact` Layout Unit，只按 SDK 允许的 `responsiveGeometry: [{maxWidth:620,geometry:{gridTemplateColumns:'minmax(0,1fr)'}}]` 显式覆盖。DKDS Runtime 的 `LayoutUnitRuntime.bindLayout` 在 recipe 后应用该合法 Geometry，故 <=620px Project Explorer 与参数编辑器纵向排列；宽屏仍继承 235px 紧凑侧栏，未引入插件 CSS/iframe。
- 在 Core native mock 中精确检查此 override，不放松其它几何白名单；Android 模拟器增加窄屏顶端、窄屏实际手势滑动后、1024×768 平板三张截图。后续 CI 和真实图必须验证 320px 不再左右分栏且参数可触达。此计划仅改善 DKTS Core 预览，不修改 DKDS 上游。

## 2026-11-11 / Android 16 双尺寸实际截图复核及平板冷启动
- Core Framework Contract #73（https://github.com/davidkane0526/DK-Test-Studio/actions/runs/42969177415）**全部通过**：Windows Electron 真启动/预览 EXE、Android 双 ABI 离线 APK/模拟器、DKDS 只读框架。下载并人工检查 320×640 `phone.png`、`phone-scrolled.png`、1024×768 `tablet-landscape.png`，新手机布局确认纵向：Project Explorer 占整行，下面是 Edit Page/Terminal，滑动后扫描段参数确实可见；没有全屏 onboarding 遮挡，进程有效，runtime-errors/crash 为空。
- 发现 1024×768 平板截图仍处于之前手机上滑后的页面滚动位置，导致顶端 Project/Device/Terminal 上半区被截断。这是测试脚本的跨视口滚动状态污染，不能作为平板完整界面证据，也不等于应用自身闪退或丢失数据。
- 修改 DKTS-only `run-core-android-smoke.sh`：手机原始与滑动后的截图结束后设置 tablet 1024×768，`am force-stop` 再按 Manifest Activity 冷启动并单独记录 tablet-startup.txt、PID、截图、错误检查，确保平板首屏视觉对照有可重复的起始滚动位置。增加静态 regression。DKDS 不作任何变更。
- 主版本继续 V0.3.13，稳定 Release 仍 a135；PR Preview CI 编号与正式 a 编号分离。安卓实体平板和仪器真实输出仍未验收。

## 2026-11-11 / FS-Pro UI 结构及旧 DKDS 分支只读审计（R-20261111-002）
- 逐字需求已记录于本分支 `docs/USER_REQUIREMENTS.md`，跟踪 [Issue #20](https://github.com/davidkane0526/DK-Test-Studio/issues/20)；继续遵守仅开发 DKTS、DKDS 不作任何变动。
- 当前主线 `V0.3.13 a135`，`main` SHA `cbc15ed`；DKDS Core 宿主 PR #18 未合并，尚不能声称三端共用同一实装 UI。CI 绿色和网页演示不等于视觉验收或真机测量验收。
- 已核对当前 Web 演示 `web/fspro-workbench/index.html`：Data/Graph 仍与 Edit Page 参数区域并列；Limits/Page Var/Associate Spec 被放到一级标签；存在大量英文界面字段。依据用户 106 页 LabExpress 手册及 V6 规范，以上均需结构级修正。
- 旧 DKDS 分支 `feat/4200a-fspro-rebuild` 固定源 SHA `5424cdb`；对 DKDS main 有 1,218 个 ahead commits，含无关历史修改，**不能直接合并**。
- 在 DKTS 开发分支 `feat/dkts-core-host-boot` 的 `docs/reference/legacy-fspro-20261109/` 归档原分支 `src/4200a-fspro/` 整个子树、两份 docs/4200A 设计文档和一份 UI 视觉测试，共 22 个原始文件，并创建 `ARCHIVE_README.md`。此举只影响 DKTS 开发分支，未修改 DKDS 主分支/旧分支，也未删除任何分支；原始代码保留作对照，不自动参与构建。
- 原厂 `LabExpress User Manual(SC).pdf`（106 页）与 V6 UI PDF 规范可以在项目资料中读取；完整 V6 ZIP 当前未定位，不能谎称已找到。
- **实际状态**：本轮完成只读核查、项目需求/日志存档、旧文件归档。并未实现新 UI、未发布新版本、未执行 FS-Pro 35 条视觉验收、未进行真实仪器测量。下一步须以 106 页原厂手册为主，将图表从 Edit Page 中解耦，并将同一实现接入三端 Core Host。

## 2026-11-11 / R-20261111-003 图表层级、Core 与分支清理
- 用户接受网页截图的绝大部分样式，只纠正图表父层与 Page 参数切换。原话见 USER_REQUIREMENTS.md；不能再回退为卡片版或重做已经认可的样式。
- Web：web/fspro-workbench/index.html 将 data-pane 从 work-split 提升为 main-pane 同级子区域；app.js 的 editorOpen 默认 false，Page 点击显示参数，工程根/Routine/Device 可返回图表；styles.css 保留原样式，增加屏幕适配。
- 新增独立 PR Chromium 实际截图与互动验证，检查 desktop/tablet 的初始图表、Page 编辑、工程返回及不请求仪器 API；Actions #42974232833 success。
- 真正的 DKDS Core 派生宿主仍在 PR #18。integrations/dkds-native/plugin.js 让真实 ScientificPlot/Data Center 的图表在原生 Core Unit 工作区与参数编辑成为独立同级；只有选中测试时显示编辑，并整理 Routine/Page 行和主图尺寸。原生插件测试成功，Electron 宿主启动截图成功，但视觉尚不如用户认可的 Web，不能声称三端完成。
- GitHub Actions #42975051700 将三条无活跃 PR 的旧分支各自建立 archive/dkts-20261111-* tag 后安全删除，保留 unique commits。现仅 main、feat/dkts-core-host-boot（PR #18）、fix/native-update-cache-integrity（PR #8）三条分支。
- 未动 DK-Data-Studio；没有稳定包新 Release，没有 OPPO 真机 UI 验收，没有真实 KXCI 仪器输出核验。

## 2026-11-11 [R-20261111-005] Core 数据图/原始数据/更新器审计
- 查实正式 GitHub Pages `web/fspro-workbench` 是静态演示，四宫格 1 是自绘扫描规划 SVG、2~4 是空图框，不属于 DKDS Core 全功能绘图；**正式 Web 不等于 Core 结果**，暂不重新绘制此前用户认可的参数 UI。
- 在 `integrations/dkds-native/plugin.js` 上采用四个 Core PlotView/ScientificPlot，增加各图窗独立 `ctx.data.sources.list()` 已分配源选择与 Artifact revision 缓存，使用 `ctx.data.artifacts.columnMetadata/readColumnRange` 有界显示，不抽样保存为原始数据。数据变化事件刷新图窗。
- 在 Core Unit 中加入逐图窗“导出原始 CSV”操作：通过 `ctx.data.artifacts.get()` 取得 canonical 全量 DataTable、`ctx.data.model.rows()` 不抽稀并通过 `ctx.io.saveCsv()` 交给 DKDS 通用 IO。大于 250000 行时拒绝在此控件分配全部行并明确引导 Data Center 自有完整导出，绝不静默截断；PlotView image export 仍由 DKDS 拥有。
- 新增 `integrations/dkds-native/measurement-data.js`：只接受完成/停止/失败的真实 `4200A-KXCI-TI` 行，验证 runId、仪器 serial、顺序及真实响应，保留原始响应/多端口电流/状态，创建规范 DataTable 并 `ctx.data.artifacts.publish()`；新增测试 `tests/dkts-kxci-data-center.test.cjs`。**目前没有将此数据发布函数与真实 4200A controller 完成闭环连接**，不应声称已经实测入库。
- Core 打包程序同步加入 `measurement-data.js`，其 manifest 和 VM mock 注册代码一并更新。更新器安全审计工具 `tools/verify-dkds-updater-parity.cjs` 在 `tools/stage-dkds-host.cjs` 中校验真实只读上游：Windows/Android 完整包校验和缓存重复校验、APK signer、UI 备份恢复；测试专用人工 fixture 明确依赖注入以保留生产 fail-closed。此检查不代表 DKTS 特定正式发布资产/安装器已验收。
- [PR #8](https://github.com/davidkane0526/DK-Test-Studio/pull/8) 已在原 PR 留下保留与取舍审计，**关闭但未合并，原分支仍存在，供用户删除**；其自动 stamp 违反 V+a 规则，旧 minShell 不适配新宿主。PR #18 仍是 draft、不作为正式稳定安装包。
- 验收区分：Core 模拟 API 测试不代表真实 Electron/Android/4200A 端到端；正式 GitHub Pages 仍不具备 Core Data Center 数据导出。不能将当前 PR 的 aNNN CI 编号称作正式新架构版本。

## 2026-11-11 [R-20261111-006] UI 难点修复与实际验收记录
- 以 PR #18 真实 head 与 GitHub CI 为单一事实来源恢复先前超时工作。成功构建 `dd909979` 的 Windows DKDS Core / Android Core 两端预览，真实 Electron 截图 `core-host.png`、`core-host-page.png`、窄屏图和 Android API 36 手机/平板截图均已检查；Windows 和 Android 模拟器启动检查通过。稳定版并未升级，预览包不替代正式版。
- 原始图窗用真正 SDK `units.plotGroup.create` + 四个 `adoptPlot`、`units.scientificPlot.create`、`units.table.mount`，离线不伪造测量曲线；图窗类型/分配数据源与 1/2/4 布局保存到 DKDS project slice；独立图窗源读取严格按 KXCI 原始列类型匹配，原始 CSV 从 Data Center 全量 DataTable 走 DKDS IO，曲线预览可抽稀但原始数据不可抽稀。
- `c43408d7` / `452220eb`：修复 Android 320px 窄屏 PlotView 标题栏拥挤；把“数据源选择+导出完整原始 CSV”合并到真正 DKDS Action menu，只保留简短图形类型选择。用真实 Android 截图确认先前版本拥挤情况，新的渲染版本仍需视觉复测。
- `cbebfc74`：新增页面与器件/流程名称中文化，不强制重命名既有项目快照。
- `96e8e8a6` / `701880ab`：修复此前错误的“Page 编辑与 PlotGroup 同层左右并排”，改为 Project 顶层 PlotGroup 与独立 Page 参数编辑**相互替代**，移除额外响应式双列，同时添加架构回归测试，不再用 CSS 修补双列。
- `c0b7f856`：Page 顶栏增加“← 绘图区”明确返回 Project 图表工作区。图窗继续使用 DKDS 标准标题栏、悬浮/停靠和 Unit Action，不更改上游 DKDS。
- 已验证历史 `dd909979` 的所有 CI（含 Android 模拟器和真实 Electron）success；最新 UI 修改需要以最终对应 SHA 的完整 Core CI 和新截图为准。明确区分 CI、Electron/模拟器验收与 OPPO 真机/真实 4200A 调试。PR #18 仍是 draft，正式 stable 未被覆盖。用户之前认可的网页版参数 UI 本轮未重绘。

## 2026-11-11 / [R-20261111-007] PR #18 主线合并与发布治理（本轮记录）
- 用户原话：`继续，不过你可以直接合并 PR #18到main。现在的main没有意义，也不是我想要的`。用户明确授权后，将 DKTS PR [#18](https://github.com/davidkane0526/DK-Test-Studio/pull/18) 从 Draft 转为 Ready 并使用 merge commit 合并入 `main`，合并 SHA [cdc159dd](https://github.com/davidkane0526/DK-Test-Studio/commit/cdc159ddba33a4c96ad25478956f400720101fc3)。
- 新主线目标：DKDS Core 原生宿主，保留所有非分析插件、数据中心、DKDS PlotGroup/ScientificPlot、主题与通信；不修改 DKDS 上游。旧 root Electron/WebView 壳不得再冒充新主线发布。
- 图形/UI 原生烟雾测试修正 [480901264](https://github.com/davidkane0526/DK-Test-Studio/commit/480901264d39a77dcc985826668b7f031cd84376)、[8533798df](https://github.com/davidkane0526/DK-Test-Studio/commit/8533798dfee8ea9dded3ecf066b16b95c7d9e843)：为真实四个图窗加入可测试标记；修正“← 绘图区”错误匹配为图窗标题。Core Windows Electron 启动和截图通过；[CI #152](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43053026582) 实际生成 Windows Core Portable EXE、独立 Android Core 测试 APK 和模拟器截图。真实 OPPO Android 与 4200A 仪器输出未经验收。
- 移除失效的 DKDS 临时 FS-Pro 分支定时签名工作流 [4a7a3c049](https://github.com/davidkane0526/DK-Test-Studio/commit/4a7a3c04933c8ccfaf714b7c7d4fdd06565ddef6)；改造旧 Full Package 发布流水线为仅接收完整 Core CI 成功的独立预览版。由于 `workflow_run` 发布时 GitHub 返回 HTTP 403（[发布流程 #160](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43054712969)），已增加在 Release 调用前保存 EXE、APK、SHA256 和 provenance 的 Actions 构建工件兜底 [1730a593](https://github.com/davidkane0526/DK-Test-Studio/commit/1730a5938dc147a1bf667170395ba38ecb1284f1)。**403 尚未修复，不得声称 Release 已成功**。
- UI 修订 workflow 保留 `V0.3.13 aNNN` 身份，但旧独立壳 UI bundle 与新 DKDS Core 热更格式不兼容，暂停旧 bundle 自动投放，禁止不兼容更新；仍需实现原生热更/校验/回退及正式签名更新。
- 新默认源代码启动入口 [877c0b5e](https://github.com/davidkane0526/DK-Test-Studio/commit/877c0b5e72d00aeda90ad23287b938f31504d628) 及 [147434fa](https://github.com/davidkane0526/DK-Test-Studio/commit/147434fa7d0f2e8e20dbb6f68099390d3f0a436f)：`npm start` 从固定 SHA 的只读 DKDS 派生真正 Core；旧入口显式移为 `start:legacy`，旧 Windows 构建命令显式 `dist:win:legacy`。自动缓存源码保存在 DKTS `.dkts-cache`，不向 DKDS 原仓库写入。此新启动脚本已做静态契约测试，**尚未在用户 Windows 实机直接执行验收**。
- 迁移发布自动化后，8 条旧回归测试继续假定历史 standalone 工作流仍是新主线，产生失败。已将这些测试转为明确区分 legacy 与真实 Core 并加入防误发/独立包名/Android 模拟器/四图窗契约；[主项目 CI #619](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43055088988) 的 Windows、Linux、插件兼容及能力数据库全部成功，[Core Revision a157](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43055089021) 成功。以上成功仅对应 SHA `c375e204`，后续文档/工作流提交仍须各自检查，不将之前失败隐去。
- 未完成：Android OPPO 平板真实 UI 与更新、真实 Keithley KXCI 输出/失联安全停止、来源规范一致的 Data Center 数据全生命周期、正式 Android 签名及兼容 UI 热更/回退、GitHub Release 的 HTTP 403 权限阻塞。旧分支清理仍按用户要求谨慎进行，当前改动仅 DKTS 仓库。

## 2026-11-12 / Core 发布已成功、FS-Pro 页面修复与 Android 签名安全（进行中）
- 确认 [Core Preview a159 Release](https://github.com/davidkane0526/DK-Test-Studio/releases/tag/dkts-core-preview-v0.3.13-a159) 实际存在 Windows Portable、Android TEST-SIGNED APK、`SHA256SUMS.txt`、`PROVENANCE.txt`，发布 [Action #43057145072](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43057145072) 成功；a158 也已发布。前一日志中记录的 403 属于当时失败事件，不能继续把 Release 表述为未发布。发布成功不等于真实 OPPO 平板与 4200A 现场验收。
- [f90883b16](https://github.com/davidkane0526/DK-Test-Studio/commit/f90883b16c9f6f4852f348fc92da274299a8cd95)：网页 CI 从有 DNS 故障的 Ubuntu apt 强依赖中恢复；[2fc5f6b87](https://github.com/davidkane0526/DK-Test-Studio/commit/2fc5f6b876cbbed2b5d1257feb1445c9d4625299)：工程级四图窗与 Page 全宽编辑互斥、增加返回绘图区按钮，只改路由/容器不重画参数；[d24280715](https://github.com/davidkane0526/DK-Test-Studio/commit/d242807151133db703d296d7ccfd26ef946d7352)：修复 Device 切换后自动测试误点击隐藏返回按钮。最终 [Web CI #43061154863](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43061154863) 的 Chromium 图窗、Page/Device/Spec 交互与 Pages 部署成功。
- [41671fe3f](https://github.com/davidkane0526/DK-Test-Studio/commit/41671fe3f7b4e834910611beb27139991f747986)：Core Preview 的 Android 版本码绑定工作流 run number，避免版本码一直为 1，增加输入保护与断言。[017926f2](https://github.com/davidkane0526/DK-Test-Studio/commit/017926f23732a586342ad8bebdb52e7b694fa9ba)：在真正 DKDS Core APK 构建任务之外设置独立的、可选的原 DKTS 固定密钥签名 job，使用可信已固定的签名指纹和包名/版本校验，秘密仅传给签名步骤。[0c9fe9ac](https://github.com/davidkane0526/DK-Test-Studio/commit/0c9fe9ac03047c907c7d36bbe761f178f5b6aee7)：Core Preview Release 在存在可信签名 Artifact 时优先固定签名，否则仍标记 TEST-SIGNED，不虚构签名成功。完整签名 CI 结果仍待验证。
- [b23ed534](https://github.com/davidkane0526/DK-Test-Studio/commit/b23ed534ba6d66c405b66c3219c8ff703b71569a)：网页截图 CI 为中文字体增加 Github Noto CJK 源下载校验，不将字体文件放入用户安装包，避免 apt DNS 故障导致 UI 检查失败。
- 本次仅修改 DKTS 仓库；没有提交任何 DKDS 上游文件。剩余验收：签名步骤和最终固定签名 Release、Core 热更新与完整升级回退、Android OPPO 真机界面、4200A KXCI 输出安全与 Data Center 完整原始数据链路。

- 2026-11-12 Core 主线完整发行触发纠偏：取消只针对部分路径的 `push.paths` 过滤器，确保 DKTS `main` 每一次提交都会触发真正 DKDS Core 的 Windows/Android 构建；保留 UI 修订 `aNNN` 与 Core 发行相同 SHA 的校验。变更和回归断言只在 DKTS，DKDS 上游未动。此前未触发 Core 的旧提交不会被冒称已有对应完整包；新规则从此次提交起生效。

- 2026-11-12 自动发行授权策略：连续 Core 发布器工作流的源码构建/发布前置工件检查已通过，但 `workflow_run` 下用 `GITHUB_TOKEN` 执行 `gh release create` 再次遇到 HTTP 403（如 [#43064728361](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43064728361)）。新增可选的 `secrets.DKTS_RELEASE_TOKEN` 作为**仅发布步骤**使用的授权覆盖；未配置时仍用 GitHub 内置 token，失败不伪报成功，已验证的 EXE/APK/SHA256 仍保存于 Actions Artifacts。只有具备该仓库 Release 写权限的凭据才可能解决服务器侧拒绝；未实际配置/验收前不宣称 403 已解决。

- 2026-11-12 API36 Android 实际失败根因复核：下载并解包 [Core 模拟器异常工件 PR166](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43065040925)，`runtime-errors.txt` 与 `crash.log` 中仅出现 `FATAL EXCEPTION: UiAutomation`，栈为 `android.accessibilityservice.AccessibilityInteractionClient` 的 `Bad file descriptor`；`activity-state.txt` 显示 DKTS 包 `studio.dk.test.corepreview` 的 `MainActivity` 仍为 topResumed，模拟器截屏亦已采集。这是 Android `uiautomator dump` 辅助进程崩溃，并非 DKTS 原生主进程崩溃。修复：`runtime-errors.txt` 只对 React Native 离线 Bundle 错误全局拒绝，Android 原生进程崩溃按 `crash.log` 的 `Process: studio.dk.test.corepreview` 精确匹配；仍保留完整日志和图片工件。加入自动化防误判测试；修复是否成功以新 Core CI 为准。

## 2026-11-12 / DKTS Core 同一主分支发布入口收敛（持续验证）
- 原先 `.github/workflows/windows-preview.yml` 使用 `workflow_run` 触发，其 APK/EXE 和固定证书校验已经成功，但 `gh release create` 在独立工作流令牌中多次返回 HTTP 403。现在将发布步骤（下载同 SHA 原生包、严格证书指纹和 SHA-256 检查、保留 Artifacts、建立 Release）移入 `.github/workflows/dkts-framework-contract.yml` 同次 `main push` 的 `publish-core-preview` job。要求 DKDS 只读框架、Windows Electron/Portable、Android 模拟器均成功；固定签名任务独立运行，签名密钥永远不传给 DKDS 源码编译任务。此前的跨工作流发布 YAML 已移除，避免重复、冲突的发行入口。
- 回归契约改为针对新的同一 push 发行架构；Windows/Android 仍采用 `V0.3.13 aNNN`，不得将已测试的 APK/EXE 与另一次提交混合。没有对应成功发布的 Release 时只报告 Actions Artifact，不宣称完成正式发布。所有修改仅 DKTS，DKDS 上游未修改。

- 2026-11-12 正式交付材料补齐：在 DKTS Core 的同一主分支发行任务中，使用 `tools/export-hardware-capabilities.cjs` 导出 `DKTS-4200A-Hardware-Capability-Database-v1.json`，要求 schema 为 `dkts.4200a.hardware-capabilities.v1` 且正文完整，并把该可移交其他 AI 检查的硬件能力与安全数据库列入 Release 附件和 `SHA256SUMS.txt`。不得从 DKDS 上游获取或修改数据库，数据库来自 DKTS 已测试的单一源码。新 CI 结果仍需实测。

## 2026-11-12 / 用户反馈 UI 极差后的原生 Core 工作区重整（视觉验收待执行）
- 新增用户需求 [R-20261112-008]，原话“UI极其糟糕”。针对实际 Core Windows 1200×768、Page 编辑与 744×600 窄屏截图定位：原 DKDS Core sidebar-main-compact 在窄屏把工程栏压至 150px，项目操作分散，图窗高度超过可用区域，布局缺乏明确约束。已有 CI 只证明进程启动成功，不等于界面合格。
- DKTS 侧新增 `integrations/dkds-native/ui-shell.js` 作为插件所加载的原生 UI 附加模块，CSS 严格作用于 `#dktsKeithley4200Page [data-dkts-*]`，不修改 DKDS 的主题、全局组件或绘图引擎；使用 DKDS 官方 `sidebar-main-standard`、`content-actions` 与 PlotGroup，桌面工程栏规范为约 252px；≤900px 采用工程导航抽屉，支持标题栏“项目”、遮罩及 Escape 关闭，避免 150px 侧栏永久占据画布。
- 工程器件/流程/规格新建集中到 DKDS Action Menu，不再散落三行按钮；页面类型选择及添加整合到同行。仍保留实际 DKDS 项目切换与数据持久化、四个独立 PlotView 和各自的源/绘图菜单、原生科学绘图/手势、Page 全宽编辑和原生数字键盘。PlotGroup 采用紧凑密度，图窗高度受视口约束。无虚构曲线、不放开实际 KXCI 输出，DKDS 只读。
- 同时更新真正的 DKDS Core mock 宿主测试与 Electron 截图烟测，要求桌面侧栏尺寸在合理范围、窄屏导航默认收起且工作区获得完整宽度。增加独立 drawer DOM/键盘回退测试。构建、真实截图和 Android 模拟器结果必须进一步核查，通过前不称为 UI 完成或正式版。

- 2026-11-12 严格 SDK 校验修正：第一版 CSS/遮罩由 `ui-shell.js` 直接创建 DOM，在 [Core-native SDK 1.19 检查](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43160278647) 被明确拒绝：`raw document DOM is not part of the Plugin API 1.19.0 development contract`。**不绕过该校验。**现改为 `plugin.json.styles=["ui-shell.css"]` 注册 DKTS 插件作用域 CSS，使用 DKDS SDK `units.layout.create(...,{variant:"identity"})` 创建遮罩与 Unit-owned 属性，移除原生 `document.createElement`、独立样式注入及窗口尺寸强行覆盖。所有 CSS 规则仅匹配 `#dktsKeithley4200Page [data-dkts-*]`，不设置宿主状态栏/窗口视口高度，不重绘 DKDS 按钮、表单、PlotView 边框或主题。四图窗高度改由 SDK `PlotView detailGeometry` (`contentAspectRatio:2.05`，最小164px，上限300px)与 PlotGroup 自身的高度策略管理。真实 SDK 重新验证与截图仍待 CI 结果确认。

- 2026-11-12 SDK 视觉归属二次修正：SDK 明确拒绝非主题插件 CSS 的 `background/color/box-shadow`，并非仅拒绝裸 DOM。删去插件覆盖配色/阴影，改由 DKDS 正式 `units.panel.create(main,{variant:"control-card",header:false})` 提供工程导航表面及主题；插件 CSS 只声明插件域的网格、滚动和抽屉位置。任何可运行 UI 都必须通过 SDK 检查，否则不作为验收通过。


## 2026-11-12 / Core 原生更新器 staging 修复与 V/a 计数统一（待 GitHub CI）
- 以 GitHub `main` SHA `75456dfc72462623e4425098d3108c237e686802` 为新基线，不再沿用早先 `22e9bac` 快照。该主线的 Core Framework Contract run `43190682770` 在 `stage-dkds-host.cjs` 失败，日志指向 `desktop/ui-hot-update.js` 的 `buildIdPattern` 精确替换锚点：JavaScript 正则源码被多转义一层，无法匹配固定 DKDS SHA 的真实文件。已修正 `buildIdPattern`、`releasePattern` 和 UI bundle build ID 的转义，并让轻量 fixture 显式跳过完整 updater patch；生产 staging 默认仍 fail-closed，完整 patch 由固定上游源码和 staged contract 验证。
- 复核历史发布后发现 `dkts-framework-contract.yml` 的 run number `179` 小于已有 `ui-update.yml` a 编号 `184`。若继续用 Core workflow 自己的 run number，会使同一 V 下 aNNN 倒退，且 Android `versionCode` 与 Release 标签错配。现将 `ui-update.yml` 的主线 run number 设为唯一单调 aNNN；Core workflow 在相同 `head_sha` 上查询 UI workflow run number，并将其传入 Windows `package.json.dktsBuildId`、Android `versionCode=100000+N`、Release tag 和 UI bundle。PR/手动构建仅用于 CI，不发布正式 Core Preview。
- Core Release notes 新增 `Build identity: aNNN` 与 `Android versionCode: 100000+N` 两项身份声明。Windows/Android 更新器仅接受同时满足这两项声明、V/a 标签与资产名、SHA-256 的 Core 资产；Android 另校验 package/version/versionCode/当前签名。历史旧 Release 缺少身份声明时会被跳过，避免旧标签导致重复安装。版本面板显示 V+a，主标题仍只显示 V。
- 在 Framework Contract 中新增 `tests/test-staged-core-updater.cjs`，直接加载真正 DKDS staged Windows updater，测试同 V 新 a、数值排序、历史 Release 拒绝、资产名与 SHA-256；同时静态检查 Android signer/versionCode 和更新面板身份。
- 本地使用 DKDS 固定 SHA `20f056851a61d2144e9524c3ed568628d4b8557c` 执行 `stage-dkds-host.cjs` 成功，生成测试身份 `V0.3.13 a185` / Android `versionCode 100185`；staged updater contract **PASS**；相关 45 项 Node 回归 **45/45 PASS**；两份修改后的 GitHub Actions YAML 通过 Ruby YAML 解析。完整 `npm test` 当前在本地容器为 192/200 PASS，8 项失败均因此容器未安装 `npm install` 依赖、缺少仓库要求的 D3 7.9.0 vendor 源，并非上述 45 项回归；需由 GitHub CI 在正常依赖安装后验证。
- 本轮尚未完成 Windows/Android 原生编译、固定签名安装、应用内更新与失败回退实机验收；当前修改仍待新 SHA 的 GitHub Actions 结果确认。所有改动仅在 DKTS；DKDS 仓库和固定上游 SHA 均未写入。


## 2026-11-12 / Windows staging line-ending compatibility
- PR #22 的 Ubuntu Framework staging 和 staged updater contract 已通过；Windows Core Preview 随后发现另一项跨平台问题：GitHub Windows runner 将固定 DKDS 文本文件检出为 CRLF，导致多行 `replaceExact` 锚点无法命中。已在 DKTS staging 副本的 `replaceExact` 读取阶段统一归一化 CRLF/CR 为 LF，并在轻量 fixture 中加入 CRLF 输入回归测试。只转换 DKTS 暂存副本，不修改 DKDS 上游工作区。等待 Windows/Android Core Preview 重跑验证。


## 2026-11-13 / 单一 main 与 ZIP 云端开发流程（进行中）
- 用户明确要求 GitHub 仓库只保留一个 `main`，未经明确许可不得创建其他分支；后续开发以完整项目 ZIP 为云端工作基线，每轮交付完整、干净的项目 ZIP。已将该要求写入 [R-20261113-001] 与 `AGENTS.md`，覆盖此前“保留 archive/backup 分支”的旧规则。
- 审核 PR #22：修复 DKTS Core 的 Windows/Android/热更新统一 `V0.3.13 aNNN` 身份、稳定包名 `studio.dk.test`、固定签名门槛和同一 Release 资产契约。PR run [43364536174](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43364536174) 的 Ubuntu/Windows 198 项测试、DKDS SDK 1.19、只读上游检查、Windows Electron/Portable、Android API 36 模拟器及 staged updater contract 均通过。签名发布任务因 PR 事件而跳过；不代表正式 Release、OPPO 真机或 4200A 实测。
- 已将 PR #22 squash 合并至 `main`，提交 `f9548c09ec592b5c1d20214754c0ffa0c3a35744`。此操作只涉及 DKTS，DKDS 上游未修改。
- 新增 `.github/workflows/source-zip.yml`，提交 `0c09fc952d221ee50c0bbc99faaed8e18946a33c`，用于从指定 main SHA 导出 DKTS 源码 ZIP、固定 SHA 的 DKDS 只读依赖 ZIP、manifest 与 SHA256 校验文件。首次加入 workflow 的 push 未触发该新 workflow，需由后续 main push 验证其产物。
- main push 的 Core workflow run [43377803530](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43377803530) 成功，但本次仅文档/workflow 变更，Core 原生构建、签名、发布任务按路径分类跳过；没有产生新的 EXE/APK Release。
- 分支审计发现旧分支 `fix/native-update-cache-integrity` 虽落后 main 330 个提交，但包含当前 main 尚未覆盖的 Windows 缓存 EXE 每次执行前 SHA-256 复核、Android 缓存 APK 每次安装前 SHA-256 复核及对应回归测试。**不得整支合并**，应将这两项安全修复移植到当前 V/a 更新器并验证后再清理该分支。其余 `feat/unified-update-release` 已落后 main、三个 `ops/source-archive*` 仅包含临时归档 workflow；PR #22 对应分支在合并后也应删除。
- 下一步：触发并下载 source ZIP artifact；在云端 ZIP 工作区移植 Windows/Android 更新缓存完整性校验并补齐测试；随后执行完整回归、更新日志、清理所有非 main 分支，交付最新完整 ZIP。真实 Windows/OPPO 设备更新回退及 4200A 实测仍未完成。


## 2026-11-13 / ZIP 云端工作流、更新缓存回归与单一 main 清理
- 开发基线来自 main 提交 `e495eb16bbdcca90dd863d7e4b506b087a72c31f` 的源码归档。通过 GitHub Actions 下载完整 DKTS 源码 ZIP 与固定 SHA 的 DKDS 只读依赖 ZIP，在云端工作目录解压开发；最终归档只包含受版本控制的源文件，不含 `.git`、node_modules 或临时构建缓存。
- 旧分支 `fix/native-update-cache-integrity` 的初步检查曾将旧 standalone updater 的缓存校验与当前 Core 混淆，现已纠正：DKTS 实际 Core 路径使用固定 DKDS SHA `20f056851a61d2144e9524c3ed568628d4b8557c`。`tools/verify-dkds-updater-parity.cjs` 和本地生成的 `DKTS_FRAMEWORK_STAGING.json` 已验证 10 项安全能力：Windows 下载/缓存 SHA-256、缓存大小、安装回退、UI SHA/上一版本恢复；Android 缓存 SHA-256、签名、UI SHA/上一版本恢复。旧分支实现不应整支合并。
- 扩展 `tests/test-staged-core-updater.cjs`，明确断言 Windows 缓存 EXE 在调用替换程序前重新校验 SHA-256；Android 缓存 APK 在打开系统安装器前重新校验文件大小和 SHA-256，并校验 buildId/versionCode。也增加单一 main 与 ZIP 归档工作流的治理测试。
- 本地以 `DKTS_BUILD_NUMBER=190` 对固定 DKDS SHA 执行 profile/staging：保留 11 个非分析插件、排除 6 个分析插件；得到 `V0.3.13 a190`、Android `versionCode=100190`；staged updater contract **PASS**。针对更新器、版本身份、发布契约、热更新、需求治理等 9 组目标测试 **44/44 PASS**；需求治理单测 **3/3 PASS**；两个 Actions YAML 语法检查通过。
- 完整本地 Node 测试因源码 ZIP 不包含依赖缓存，未执行 `npm install`，出现 **189/197 PASS**。8 项失败均由缺失的 D3 7.9.0 vendor 和依赖该文件的构建产物引起；未将其误报为代码通过。GitHub CI run [43379001775](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43379001775) 的 Ubuntu 与 Windows Node 测试、DKDS Plugin API 1.19、能力数据库导出均通过。
- 已加入 `.github/workflows/source-zip.yml` 和 `.github/workflows/main-only-branch-policy.yml`。源码归档 run [43379001880](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43379001880) 成功；分支清理 run [43379001843](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43379001843) 成功。GitHub API 再次确认只剩 `main`，当前主线提交为 `bb429d429fdc9ab813170f801a790e0b26f2a913`。
- 归档 artifact `DKTS-Source-ZIP-bb429d429fdc9ab813170f801a790e0b26f2a913`（artifact ID `14015975729`）成功下载并验证：DKTS ZIP 242 个文件、无 `.git`；DKTS ZIP SHA-256 `c23d8cdc810d263e1640101ae250efa1213070deb2fd88226522aaac8a4e3478`；固定 DKDS 只读 ZIP SHA-256 `ebf283772098f0de6182c7472c9360dec88ec40de13248bd930cc2b54af73225`（以随包 `SHA256SUMS.txt` 为准）。
- Core workflow [43379001760](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43379001760) 已通过框架只读检查；截至本日志写入时，Windows Portable 和 Android API 36 构建仍在运行，因此不宣称已有新的 a190 正式 Release。真实 Windows/OPPO 真机更新回退及 4200A 实测仍未完成。


- 2026-11-13 文档核对补记：当前 main 文档/路线图跟进提交为 `c2697bdb7cb71ff2dbfa91a95deb4ff3f9694676`；其源码归档 run [43379435241](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43379435241) 成功，artifact ID `14015687629`，bundle SHA-256 `cf49d96e248eb181622c0405e944dd6534e21f61757176a7b274823204fa8688`。DKDS pinned ZIP SHA-256 已核对为 `ebf283772098f0de6182c7472c9360dec88ec40de13248bd930cc2b54af73225`。此跟进提交不修改应用运行时代码；Core 应用构建仍以代码提交 `bb429d42` 对应的 `a190` run 为准。


## 2026-11-13 / V0.3.13 a190 发布与 Android 系统状态栏修正
- Core build run [43379001760](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/43379001760) 最终全部成功：Windows Electron 实际启动与 Portable 构建、Android APK 编译、Android API 36 模拟器安装/启动、固定 DKTS 签名、DKDS 上游未修改检查、统一 Release 发布均通过。
- 已发布 [DK Test Studio V0.3.13 a190](https://github.com/davidkane0526/DK-Test-Studio/releases/tag/dkts-v0.3.13-a190)：Windows EXE SHA-256 `48a88345a2f32d2992770b25ef0b171080dd44441fefb7abc30f31e6a272c9c3`；Android APK SHA-256 `3fe009329d6954567b25e5bffb74481ca069f304c86a1daf9437223a6e4bd9ea`；同一 Release 附带 4200A 能力数据库、SHA256SUMS 和 PROVENANCE。应用包版本仍为 `V0.3.13`。
- Windows 真 Electron 截图与 report.json 证明 DKTS 4200A Core 工作区加载、4 个 DKDS PlotView 子窗口和 Page 编辑器可见；Android 手机竖屏与平板横屏 API 36 模拟器均启动成功，`crash.log` 和 `runtime-errors.txt` 为空。**这仅是模拟器/CI 验证，不是用户真机或 4200A 实测。**
- 检查 Android 模拟器截图发现系统顶部状态栏仍显示时间、Wi-Fi/网络、电量图标，与用户此前要求隐藏系统状态栏、增加垂直空间不符。追补记录为 [R-20261103-002]。
- 在 DKTS ZIP 工作区中仅修改 `tools/stage-dkds-host.cjs`：给派生 `mobile/app.json` 写入 `expo.androidStatusBar.hidden=true`；DKDS 固定上游只读。新增 staged contract 断言，要求生成的 DKTS Android 配置隐藏系统状态栏。固定 DKDS 的 `mobile/app.json`、Windows updater、Android updater 文件 SHA-256 前后相同。
- 本地使用 `DKTS_BUILD_NUMBER=193` 暂存：`V0.3.13 a193`、Android `versionCode=100193`；保留 11 个非分析插件、排除 6 个分析插件；staged updater contract **PASS**；目标回归测试 **45/45 PASS**。Android API 36 新截图仍待下一次 main CI 构建确认，未提前宣称状态栏已隐藏成功。


## 2026-11-13 / ZIP 云端继续开发：Android 状态栏宿主修正与 V0.3.14 a194
- 本轮基线为 `DK-Test-Studio-V0.3.13-source-bfcace90.zip`，SHA-256 `d10cb8ef94ca034569561357b4b53dbc58f7f9edaacfa67f44f193f1b037cf51`；解压至独立云端工作目录。DKDS 依赖固定为 `20f056851a61d2144e9524c3ed568628d4b8557c`，只读。未创建或使用 Git 分支。
- 复核发现此前只给 DKTS 派生 `mobile/app.json` 设置 `expo.androidStatusBar.hidden=true`，但 DKDS `mobile/App.tsx` 仍挂载 `<StatusBar style=... />`，没有 `hidden` 属性，可能在运行时重新显示系统状态栏。仅在 DKTS staging 脚本中将挂载组件改为 `<StatusBar hidden style=... />`，同时保留 `androidStatusBar.hidden=true`；DKDS 上游文件未修改。
- 新增 staged updater contract 断言，检查最终派生 `mobile/App.tsx` 确实使用 hidden 属性；修复轻量 staging fixture 对缺失 `mobile/App.tsx` 的兼容，不影响真实固定上游必需的完整 staged contract。
- 该修改位于 React Native 宿主/Android 配置，不能通过 CSS 热更新交付。按用户原始版本规则将 `package.json` 从 `0.3.13` 升级到 `0.3.14`，同步 legacy Android `versionName=0.3.14` / `versionCode=25`，版本身份为 `V0.3.14 a194`。`a194` 是本地云端暂存编号；正式编号仍需 main 上对应 SHA 的 `ui-update.yml` 运行号确认。
- 同步修正 README、Release 更新契约、版本台账、CI artifact 名称和版本测试；新增 `R-20261113-002`。
- 验证：DKTS 派生 staging 成功，保留 11 个非分析插件、排除 6 个分析插件；staged updater contract **PASS**；版本身份、DKDS framework staging、staged updater、原生更新器、发布契约和需求治理等目标 Node 测试 **34/34 PASS**。全量 Node 测试 **190/198 PASS**，8 项失败均由缺失的 D3 7.9.0 vendor 引起；本云端运行环境无 `node_modules`、npm registry 安装超时，不能据此宣称完整测试通过。五个 GitHub Actions YAML 文件通过 PyYAML 解析，关键 JS 文件通过 `node --check`。
- 尚未完成：当前云端环境没有 Android SDK、Gradle 或 Emulator，故未构建 APK，也未取得 API 36 手机/平板截图；系统状态栏隐藏仅完成源代码/配置层修正，必须等 Android CI 或真实设备验证后才能验收。未生成正式签名 APK/EXE，未创建 GitHub Release。


## 2026-11-13 / V0.3.15 a195：DKTS 原生 UI 第一轮结构重构（ZIP 云端工作区）
- 工作基线：用户交付的 `DK-Test-Studio-V0.3.14-a194-source.zip`，SHA-256 `3a59313fa862bc81061354be195ae9a106e818383b66c6809ec0da2ba866281d`；DKDS 固定只读 SHA `20f056851a61d2144e9524c3ed568628d4b8557c`（依赖 ZIP SHA-256 `ebf283772098f0de6182c7472c9360dec88ec40de13248bd930cc2b54af73225`）。本轮在独立云端工作目录解压 ZIP 后开发，未从 GitHub 创建或切换分支。
- UI 根因之一是原生插件同时创建 Page 顶部 Terminal 端口映射和可停靠端口 PRIME，导致四个逻辑端口出现重复入口。现删除端口 PRIME，`wb.compose` 与 TOP workspace 的 `prime` 均为空，保留 FS-Pro Page 顶部唯一 Terminal strip。
- Xsweep/Psweep 扫描段由“每段一个嵌套 Panel”改为六列连续 DKDS Unit Layout 行：起始、结束、步长、档位、点间延迟、删除；使用 SDK 接受的响应式 Geometry，宽屏单行、<=620px 两列、<=310px 单列。段间分隔由 Core Divider Unit 提供，插件 CSS 不声明颜色、背景、边框或阴影。
- 消除参数重复：Strategy 是整体循环、Xsweep/Psweep 重复次数及 Psweep 启用状态的唯一入口；Limits 是每个已分配端口量程模式、测量档位、限流/限压的唯一入口；Sweep 仅编辑 X/P 端口角色、扫描段和必要的源输出模式/固定偏置；Info 不再重复显示循环参数。
- Project Explorer 当前 Routine 与 Page 选中态均绑定项目状态。Target/变量字段进一步中文化。保留 DKDS Unit、PlotGroup、PlotView、ScientificPlot、Data Center、原始 CSV 导出和 Core Theme，不修改 DKDS 上游。
- 完整安装版本从 `0.3.14` 升为 `0.3.15`，云端暂存编号 `a195`；外部 DKDS 插件内部版本从 `0.8.1` 升为 `0.8.2`。a195 尚未由 main 上同 SHA 的 `ui-update.yml` 运行号确认，不是正式 Release。
- 验证：`node --check` 通过；`tests/test-dkds-native-plugin.cjs` 通过；`tests/test-dkds-native-host.cjs` 通过；固定 DKDS SDK 1.19 `dkds-plugin.js validate` 通过；DKTS 生成插件包、官方 SDK repack、DKDS 官方安装包 normalizer 检查通过；DKDS staging 成功（17 项插件中保留 11、排除 6），并确认 V0.3.15 / a195 / Android versionCode 100195 / plugin 0.8.2。DKDS 只读目录与固定 ZIP 逐文件比对 1,328 项，missing=0、changed=0；未修改上游内容。
- 回归：Core UI shell、DKDS framework contract、Core release identity 共 14/14 通过；Android shell 中与版本/状态栏相关的选定 3/3 通过。完整 `node --test tests/*.test.cjs` 为 190/198 通过，剩余 8 项均因源码 ZIP 未包含 npm `node_modules/d3@7.9.0`，导致 Android 资产同步、DKDS 共享壳生成和网页 Demo 构建类测试无法启动；修正 V0.3.15 后的 Release identity 测试已通过。没有用伪造 D3 文件绕过。
- 未完成：当前环境无完整 npm 依赖、Electron 运行环境、Android SDK/Gradle/模拟器，未能构建正式 Windows EXE/Android APK，未能生成新版本真实 Electron/Android 截图。因此这轮只算源码结构重构和 SDK/mock 验证通过，**不算视觉验收通过**。下一步必须在具备依赖的 CI 中构建并截取 1200×768 桌面、744×600 平板、320×640 手机页面，逐项检查导航、Page 编辑、端口条、扫描段、Limits、四图窗与触控滚动。
- 本轮未提交 GitHub、未推送 main、未创建任何分支；DKDS 仓库未修改。


## 2026-11-13 / V0.3.16 a196：DKTS 原生 UI 第二轮重构（ZIP 云端工作区）

- 基线：`DK-Test-Studio-V0.3.15-a195-source.zip`，实际 ZIP SHA-256 `955d226618f6a436fcfecaca8bdd61a068a5d940427ee4dbc59314f138cccc49`。DKDS 固定只读依赖 `20f056851a61d2144e9524c3ed568628d4b8557c`，本轮未修改。
- Project Explorer 增加可见 Test Library，10 种测试类型均可直接创建 Page，取消原先“选择类型下拉框 + 加号”的两步入口。Routine 显示页面数，Page 显示测试类型。
- Page Header 增加 Device/Routine 上下文，工程绘图区增加项目级摘要。Terminal 映射保留唯一入口并改用更紧凑的 section header。
- 扫描参数加入 DKDS Summary/Metric 点数摘要；Xsweep/Psweep 的新增段入口移动到各自面板标题栏；扫描行使用对齐的列标题、固定删除操作列和更宽的档位列。窄屏保留字段标签，宽屏使用列标题避免重复标签。
- DKTS 主工作区侧栏宽度及 900px 响应式断点改由 DKDS Unit Layout 声明，移除 CSS 对主网格的 `!important` 强制覆盖；插件 CSS 只管理 DKTS 领域布局，不接管 Core 组件绘制。
- 版本：原生插件 `0.8.3`，应用 `V0.3.16`，暂存编号 `a196`，Android 暂存 versionCode `100196`。原生插件运行时变更需要完整安装，故 V 递增；a196 尚待 main 对应 Actions 确认。
- 验证：`node --check integrations/dkds-native/plugin.js` 通过；`tests/test-dkds-native-plugin.cjs` 通过；`tests/test-dkds-native-host.cjs` 通过；固定 DKDS 源码中的 Plugin API 1.19 validator 通过。真实 Electron/Android 截图、完整构建和签名尚未完成，不能宣称视觉验收通过。
- 治理：未创建分支、未推送 GitHub、未修改 DKDS。


## 2026-11-13 / V0.3.17 a197：第三轮原生 UI 信息架构纠正（ZIP 云端工作区）

### 基线与边界
- 基线：`DK-Test-Studio-V0.3.16-a196-source.zip`，SHA-256 `7f12606d72ffaabe51d6ab82a7be5048cdea9c44946512bf9dfc9d2a90e1b9b9`。
- DKDS 只读依赖：固定提交 `20f056851a61d2144e9524c3ed568628d4b8557c`，未修改上游文件。
- 未创建 GitHub 分支，未推送 GitHub；当前工作仅在 ZIP 解压后的云端工作目录。

### 本轮修改
- Edit Page 主标签收敛为 Sweep、Target、Strategy 三项。
- 页面名称与备注移到主标签上方的 Page Info 区域；页面标题工具栏保留项目导航、返回绘图区和离线规划校验，移除无功能的禁用“测试”按钮。
- Limits、Page Var、Associate Spec 作为 Sweep 下方三栏；桌面三列、平板两列、窄屏单列，使用 DKDS Unit Layout 合法几何值和断点。
- S/D/G/B 端口选择器移入 Page 标题工具栏，按 Source/Drain/Gate/Body 排列，使用 DKDS Divider 与规划动作分隔，不再保留单独 Terminal 卡片。端口参数源模式/固定偏置归入 Input Setting；量程模式、测量档位和限流/限压归入 Limits。仍只为已分配 SMU 显示参数，None 不进入参数区。
- Project Explorer 测试类型改为单一“＋ Page”菜单，仍保留十种测试类型，减少十个常驻按钮的侧栏占用。
- 数值字段改为桌面失焦提交、触控设备使用 DKDS 科学键盘，避免每次输入字符都触发整页重渲染导致焦点丢失。
- 更新 DKTS 应用版本至 `V0.3.17`、本地暂存编号 `a197`、Android 暂存 `versionCode=100197`、原生插件版本 `0.8.4`。正式 aNNN 仍需 main 上同 SHA 的 Actions 运行号确认。

### 验证
- `node --check`：通过。
- DKDS SDK Plugin API 1.19 validate：通过。
- DKTS 原生 `.dkplugin` 生成及 DKDS 官方安装器规范化：通过。
- `tests/test-dkds-native-plugin.cjs`：通过。
- `tests/test-dkds-native-host.cjs`：通过，覆盖三项主标签、Sweep 三栏、十种测试类型菜单、Page Var 新增/编辑、Associate Spec 创建/关联、None 过滤、X/P 扫描、绘图和数据中心。
- DKDS Unit Layout 几何：7/7 值及 2/2 断点均存在于固定 SDK 白名单。
- DKTS Core staging：通过，确认 `V0.3.17`、`a197`、`versionCode=100197`；staged updater contract 通过。
- 完整 Node 测试：190/198 通过；8 项因环境缺少固定依赖 `d3@7.9.0` 而阻塞。尝试 npm 安装时 registry DNS 返回 `EAI_AGAIN`，未用假依赖绕过。
- 本环境没有可用 Electron、Android SDK/Gradle/模拟器；Chromium headless 无法完成启动。因此没有完成实际 Windows/Android 渲染截图、APK/EXE 构建或签名。**本轮只确认结构与宿主契约，不宣称视觉验收完成。**


## 2026-11-13 / V0.3.18 a198：原生 UI 第四轮重构（ZIP 云端工作区）

### 基线与边界
- 基线为 `DK-Test-Studio-V0.3.17-a197-source.zip`，SHA-256：`4798554800ac59326f034ce5ad8e6044635078eb94c94440c6088a6d8a4f9336`。
- DKDS 固定依赖 SHA：`20f056851a61d2144e9524c3ed568628d4b8557c`，只作为只读 SDK 和安装器校验来源。本轮没有修改 DKDS。
- 本轮在云端独立工作目录中修改 DKTS；没有创建 GitHub 分支、没有推送提交。

### UI 修改
- 取消 Sweep Setup 中的 Xsweep/Psweep 端口选择器，避免与 Page 标题栏的 S/D/G/B 物理端口映射形成双重入口。
- 在每个已分配 SMU 的端口行增加“端口用途”选择，支持固定偏置、Xsweep、Psweep；角色变更经模型验证，保持 X/P 唯一。固定偏置只在 Condition 行显示，X/P 行提示扫描段编辑位置。
- 桌面和平板继续使用 Page 标题栏 S/D/G/B 下拉；手机宽度隐藏四个下拉，改用单一“端口”动作打开 DKDS Core Popover，四个逻辑端口在同一编辑草稿中修改，点击“应用”后一次性校验和保存。
- Project Explorer 改用 DKDS `sidebar-main-compact` 标准布局（235px），保留 900px 以下导航抽屉断点。
- Page Info 与各面板标题、字段进一步中文化；测试类型只读显示，不虚构设备类型/极性等尚未进入项目模型的数据。
- 四个 PlotView 内容比例改为 2.25:1，内容高度约束 132–220px；图窗外层最小高度从 220px 降至 176px，手机进一步降至 160px。
- Core Electron smoke 脚本新增 390px 手机 Page 编辑器及端口 Popover 截图检查；此脚本需在带 Electron/Android SDK 的 CI 环境执行，本地未伪造截图。

### 版本
- DKTS 完整应用版本：`V0.3.18`。
- 本地暂存开发编号：`a198`，正式编号仍由 main 上同 SHA 的 `ui-update.yml` 分配。
- Android 暂存 `versionCode=100198`，`versionName=0.3.18`。
- DKTS 原生插件内部版本：`0.8.5`，DKDS Plugin API `1.19.0`。

### 本地验证
- `tests/test-dkds-native-plugin.cjs`：通过。
- `tests/test-dkds-native-host.cjs`：通过，覆盖端口角色分配、手机端四端口草稿应用、限流科学计数法键盘、X/P 扫描段、项目持久化及数据/绘图路径。
- `tests/core-ui-shell.test.cjs`：通过，覆盖 SDK compact sidebar、导航抽屉、手机端端口入口及图窗几何。
- `tests/core-release-identity.test.cjs` 与 `tests/release-identity.test.cjs`：通过，确认 V0.3.18、ui-update workflow run-name 与 aNNN/versionCode 规则一致。
- 完整 DKDS installer normalizer 校验使用固定 DKDS 源码执行；updater parity 的 10 项静态契约检查通过。
- 完整 `npm test`：190/198 通过；剩余 8 项依赖固定 D3 7.9.0，因当前容器访问 npm Registry 时 DNS 返回 `EAI_AGAIN`，无法同步 D3 并构建 Web/Android 资产。未用其他 D3 版本或假文件绕过。
- 真实 Electron 截图、Android APK/Windows EXE 构建和真机安装仍待 CI。


## 2026-11-13 / V0.3.19 a199：Sweep 信息密度与 Target 端口可用性

### 基线与边界
- 从用户上一轮交付的 `DK-Test-Studio-V0.3.18-a198-source.zip` 解压到独立云端工作目录。基线 ZIP SHA-256：`8d92080df48422aef2f07ef8c50e85ff0c7cd85ca6fca7cdb883daf56327d86b`。DKDS 固定只读提交 `20f056851a61d2144e9524c3ed568628d4b8557c`，未修改上游。
- 未创建 GitHub 分支，未推送 `main`。本地 `a199` 是暂存编号，不是已发布的正式 Actions 编号。

### 本轮修改
- 将扫描概览从四个独立 Metric surface 改为单行 DKDS Summary strip，保留 X/P 点数、循环次数、总点数与“离线规划/不发送仪器输出”的状态提示，减少参数区纵向占用。
- 将 Sweep 下方 Limits、Page Var、Associate Spec 从三等分三列改为 DKDS `two-card-grid` 两列结构：Limits 独占左侧列；Page Var 与 Associate Spec 纵向排列在右侧列；DKDS recipe 在 680px 以下自动切换单列。该调整避免 1200px 桌面扣除 235px 侧栏后，Limits 每个端口的 4 个字段被挤入约 1/3 宽度。
- Limits 按已分配端口分组：端口标识单独一行，档位模式、测量档位、限流/限压采用双列 DKDS Form Grid；多端口间使用 Core Divider。
- Page Info 删除重复的只读测试类型字段，测试类型继续由 Page titlebar meta 显示；仅保留可编辑 Page 名称和备注。
- Target 端口选择改用 `model.visible(p)` 过滤，仅列出已分配 SMU。所有物理端口为 None 时，端口字段禁用并显示“无可用端口”；如果当前目标尚未分配但其他端口已分配，则要求从已分配端口中选择，不展示 None。
- Psweep 未启用时，Strategy 的 Psweep 重复次数输入禁用，避免用户编辑当前不生效的外层扫描参数。
- 更新 DKTS 应用版本 `V0.3.19`、本地暂存身份 `a199`、Android 暂存 versionCode `100199`、原生插件版本 `0.8.6`，同步构建脚本、插件 normalizer 检查、Release identity tests、README、Roadmap、Build Info 和版本日志。

### 验证与未完成项
- `node --check integrations/dkds-native/plugin.js`：通过。
- `tests/test-dkds-native-plugin.cjs`：通过。
- `tests/test-dkds-native-host.cjs`：通过，覆盖两列布局、Summary strip、None 端口过滤、已分配 Target 选择、Psweep 禁用状态、端口事务、X/P 扫描段、PlotGroup 和 Data Center。
- 尚未执行完整 `npm test`、DKDS 官方包 normalizer、Electron 真实截图、Windows Portable 构建和 Android APK 构建；当前容器无 npm node_modules / D3 7.9.0、Electron、Android SDK、Gradle 与 ADB。不得宣称真实 UI 截图验收通过。
- DKDS 只读依赖没有写入；GitHub 仍未同步本地 ZIP 工作区，本轮未创建分支、未推送。


## 2026-11-14 / V0.3.20 a200：第六轮原生 UI 优化

### 基线与范围
- 直接从上一轮交付 `DK-Test-Studio-V0.3.19-a199-source.zip` 解压。DKDS 只读固定来源为 `20f056851a61d2144e9524c3ed568628d4b8557c`。
- 仅修改 DKTS 原生插件、作用域 CSS、对应测试/构建身份及开发文档；未创建 GitHub 分支、未推送 `main`、未修改 DKDS。

### 已实现
- 四图窗标题中的图形类型选择由占据较大宽度的 Select 改为 DKDS 原生菜单，保持单独数据源/原始 CSV 菜单；选中图形类型有明确标识。
- Page 顶栏在 <=980px 时使用已有端口 Popover，在更宽的桌面使用 S/D/G/B 一行下拉框，避免 744px 平板标题栏拥堵。
- 数值、页面名称、备注输入的无变化失焦不再触发项目持久化与整个编辑区重建；页面变量单位从 onChange 改为 onBlur，避免输入中途失焦。
- 扫描概览只在配置异常时显示提示，不再重复占据面板高度；测量指令和安全数据库保持不变。
- 原生插件升级为 0.8.7，应用版本升级到 V0.3.20，临时开发编号 a200，Android versionCode 暂存 100200，Gradle versionName 0.3.20 / versionCode 29。

### 验证状态
- Node 完整测试 190/198 通过，8 项因本地缺少固定 d3@7.9.0 及生成资产失败，均非已确认代码回归。
- 固定 DKDS SDK 1.19 插件规范化安装检查通过，原生 VM 插件测试、更新身份测试通过。
- Chromium set_content 对 DKTS 作用域 CSS 进行了 1200x768、744x600、390x844 三种尺寸的 DOM 几何检查，未出现水平溢出。**这是 CSS 几何夹具，不是 Electron 或 Android 原生运行截图，不能作为视觉验收。**
- 未编译 Windows Portable 或固定签名 Android APK；真实宿主图像与 OPPO 真机验证仍未完成。


## 2026-11-16 / 基线 V0.3.20 a200：最终构建触发策略调整

- 用户最新要求 [R-20261116-001]：继续 ZIP 云端开发；只在源码定稿后通过 GitHub Actions 编译安装包，禁止开发过程中重复编译。
- 本次只调整 DKTS 仓库工作流触发与验证策略，未修改 DKDS、测量逻辑、UI 运行时或 GitHub 分支。
- 统一 Core Release 的 push 启动条件加上 `[DKTS-FINAL-BUILD]` 明确标记，普通 main 提交不启动 Windows/Android 构建；正式 Core Release 不开放 workflow_dispatch；其他独立 CI 的 workflow_dispatch 仅用于用户要求的手动诊断。
- 其他会编译或构建前端的 CI/Preview/Smoke 工作流变为仅手动执行；无源码编译的 ui-update 身份计数、source-zip 归档与单一 main 分支策略保持独立。
- 本轮没有进行正式 EXE/APK 编译，没有 GitHub push 和 Release；仍以 V0.3.20 a200 为安装包基线，后续定稿按正式 main 同 SHA 流水线分配 aNNN。

## 2026-11-16 / V0.3.21 a201：同源 DKDS Core 浏览器预览与真实宿主 UI 修复

- 使用只读 DKDS `20f0568` 派生源和当前 DKTS 原生插件生成同源浏览器预览。
- 修复此前静态测试未发现的 TOP 激活失败：SDK Unit Layout 拒绝 `responsive gap:'0'` 与未批准的六列 `gridTemplateColumns`。已使用 SDK 接受值，真实 Core DOM 冒烟测试通过。
- 面板标题去除多余 meta，标题栏端口下拉显示 S/D/G/B 标识。
- 不创建分支、不修改 DKDS、不编译 Windows/Android 安装包、不推送 GitHub。


## 2026-11-16 / R-20261116-003 · V0.3.22 a202 源码阶段：扫描顺序与原生图窗细化

- **基线与许可**：从 GitHub `main` 提交 `c8ce9172aeeee942a09cf0c75b69356185c7f624` 的成功 `source-zip` 工件取得完整 DKTS 源码；固定 DKDS `20f056851a61d2144e9524c3ed568628d4b8557c` 仅作为只读参照。只写 DKTS 文件，不新建分支，不推送 GitHub，不运行 Windows/Android 编译。用户原文及验收项见 `R-20261116-003`。
- **原生扫描序列**：`integrations/dkds-native/model.js` 新增只读 `pointAt(page,index)`，按完整循环→Psweep 重复→Psweep 点→Xsweep 重复→Xsweep 点的嵌套次序逆向定位单个计划点，支持多扫描段、精确终点、零步长单点、固定偏置、离线来源标记；大扫描计划不生成总长度数组，不执行 KXCI。`tests/native-sweep-order.test.cjs` 新增三项专项测试，包括 32 点顺序、段边界、安全拒绝。
- **网页参数安全**：`web/fspro-workbench/plan.js` 严格解析输入并验证扫描模式、速度、点间延迟、量程、限流、固定偏置；`app.js` 不再使用 `Number('')` 将被清空的输入隐式改为 0。关闭 Psweep 时按已设定固定栅压规划。HTML 中尚不支持的双向/回滞扫描选项禁用；网页始终 `executable:false`。
- **网页排布**：`web/fspro-workbench/styles.css` 收紧绘图区总标题、4 个独立子窗标题和空白内边距，删除图窗内容中重复标题；手机扫描表格以三列两行显示六个操作控件，工具条按钮禁止换行；七标签和数据图四宫格不删减。Chromium 1280×800、744×600、390×844 DOM/交互/截图通过，但该静态 Demo 并非真正 DKDS 原生验收。
- **原生图窗**：从 **当前提交实际 Android tablet emulator** 截图发现 4 图窗上下分层空白，检查固定 DKDS PlotView 的 `applyContentGeometry()`，确认 DKTS 传入 `contentAspectRatio:2.25` 会按宽度强制设定内容高度。仅在 DKTS `integrations/dkds-native/plugin.js` 撤销该过度约束、标识 rawHost，在 `ui-shell.css` 使 SDK 的单层 Panel body 及曲线/表格内容共用伸展布局。**模拟器旧截图只能支持问题诊断；修改后尚未真实原生截图，不能宣称根治。**
- **回归**：此前 `tests/test-dkds-native-host.cjs` 静态预期仍为过时六列几何与不应重复显示的 `meta:'D · SMU'`，与 V0.3.21 源码不一致，修复这些旧测试，并断言新的自适应 PlotView 不再带固定详情比例；`test-dkds-native-plugin.cjs` 对应检查通过。
- **版本**：修改原生插件代码，应以完整包升级发放。当前源码版本 V0.3.22、插件 0.8.9、本地 **临时** a202；正式 aNNN 必须由后续最终 `main` 同 SHA 的 Actions 分配。未创建、未上传 EXE/APK 或 GitHub Release。
- **测试**：`npm test` 198/206 通过，8 项因为离线环境缺少 `d3@7.9.0`，不能假称通过。`node tests/test-dkds-native-plugin.cjs`、`node tests/test-dkds-native-host.cjs`、`node --test tests/native-sweep-order.test.cjs tests/core-release-identity.test.cjs` 均通过。Chromium 页面渲染几何与原生 CSS-only 三设备夹具通过。
- **未解决**：FS-Pro 逐像素比对、真正相同 Core 的新截图、真实 4200A KXCI 测量循环、硬件级安全校验、双平台编译与签名。禁止把离线序列数据冒充测量记录。DKDS 上游文件未修改。


## 2026-11-16 / R-20261116-004 · V0.3.23 a203：DKTS Core 同源预览交付与 PlotView SDK 校验修正

### 基线与范围
- 以用户上一轮收到的完整 `V0.3.22 a202` DKTS ZIP 为工作基线；DKDS 固定只读来源为 `20f056851a61d2144e9524c3ed568628d4b8557c`（3.72.3）。只修改 DKTS；不创建分支、不推送 GitHub、不编译 Windows Portable/Android APK。
- 用户新增明确要求：每轮除源码 ZIP 外，必须交付 `DKTS-Core-Same-Source-Preview`，不能用独立 FS-Pro Web Demo 替代。需求已记录在 `R-20261116-004`。

### 本轮修改
- **修复 DKDS SDK 1.19 插件校验失败**：实际运行派生 Core `npm run plugin:validate` 时发现上一轮 `integrations/dkds-native/ui-shell.css` 对 semantic Unit panel body 使用 `overflow:hidden`，官方 validator 明确拒绝，因为会裁切 PlotView 语义内容。改为 `overflow:visible`，保留 flex 填充关系；在 `tests/test-dkds-native-plugin.cjs` 增加回归断言。此问题说明仅运行静态/VM 测试不足以替代真实 SDK 校验。
- **版本升级**：应用 `V0.3.22 → V0.3.23`；原生插件 `0.8.9 → 0.8.10`；Android legacy Gradle `versionCode 31 → 32`。本地暂存身份 `a203`，正式 `aNNN` 仍需由最终 main 同 SHA 的 `ui-update.yml` 分配。
- **新增同源预览构建工具**：`tools/build-same-source-preview.cjs` 从固定 DKDS 源码与本轮 DKTS 原生插件生成完整派生 Core 前端；保留真实 `src/index.html`、Core CSS、生成 runtime bundles、插件索引、11 个非分析插件，并排除 6 个分析插件。只在预览副本中增加 `dktsDesktopPreview=1` 主机布局选择，不修改生产 DKDS 源码。
- **新增本地预览服务器**：`tools/preview-server.cjs` 仅绑定 `127.0.0.1`，提供 Core 静态文件、来源健康端点和路径穿越防护。`Start-DKTS-Core-Same-Source-Preview.cmd` 作为 Windows 一键入口；首次运行安装固定 D3 7.9.0 等生产依赖（`npm install --omit=dev`），不安装 Electron dev binary，不编译 EXE/APK。
- **独立预览包**：输出 `DKTS-Core-Same-Source-Preview-V0.3.23-a203.zip`，含本轮派生 Core、DKTS 插件、Windows 启动脚本、localhost server、README 和 `PREVIEW-MANIFEST.json`。预览 manifest 记录 DKTS 源码树 SHA、DKDS 固定 SHA、插件版本和不支持的原生能力。

### 验证结果
- `node tools/build-dkds-native-plugin.cjs`：通过，生成 Plugin API 1.19 `.dkplugin` 包。
- `node tests/test-dkds-native-plugin.cjs`：通过。
- `node tests/test-dkds-native-host.cjs`：通过。
- `node tests/core-ui-shell.test.cjs`：通过。
- `node tests/dkds-framework-contract.test.cjs`：3/3 通过。
- `node --test tests/native-sweep-order.test.cjs tests/core-release-identity.test.cjs tests/same-source-preview.test.cjs`：10/10 通过，包含 X/P 点序、端点、端口安全、预览绑定与 HTTP 服务器路径防护。
- 派生 Core `runtime:build`、`styles:build`、`sdk:authoring`、`plugin:index`、`plugin:validate`、`brand:assets` 与 `prepare-build`：全部通过；`plugin:validate` 报告 12 个插件通过。
- `node --test tests/*.test.cjs`：200/208 通过；8 项因本容器无法访问 npm Registry（DNS `EAI_AGAIN`），缺少固定 D3 7.9.0 及派生网页/Android 资源而受阻。未用 stub 或其他 D3 版本绕过。
- 本地预览服务器 health、Core index、Core CSS、generated plugin index HTTP 检查通过；浏览器完整启动/真实 D3 绘图因上述依赖缺失未在本容器验收。Windows 一键脚本将在用户 Windows 环境联网安装依赖后启动。

### 明确未完成
- 同源浏览器预览不提供 Electron IPC、原生文件对话框、原生更新安装、真实 4200A 通信、KXCI 输出或原始测量采集；不能替代真实 Electron/Android 截图与真机验收。
- FS-Pro 像素级对照、真实仪器安全输出/停止、原始数据采集与异常恢复仍未完成。没有编译 EXE/APK，没有 GitHub push/Release，没有修改 DKDS 上游。

## 2026-11-16 · V0.3.24 a204 · Core 原生 KXCI 接入、ACK 修正与双门禁

### 基线与范围
- 基于上一轮交付的 DKTS V0.3.23 a203 源码快照继续开发；DKDS 仅使用固定只读 SHA `20f056851a61d2144e9524c3ed568628d4b8557c`。
- 本轮只修改 DKTS，不修改 DKDS；GitHub 不推送、不创建分支，仓库仍只保留 `main`。不编译 Windows EXE/Android APK。

### 本轮实现
- 原生插件升至 `0.8.11`，将硬件能力、KXCI 协议、身份控制器、扫描规划、KXCI runner 和 Data Center 发布器纳入 `com.dkts.keithley-4200` 插件脚本顺序。修复旧共享模块仍注册为 `com.dkds.keithley-4200` 的所有权错误。
- Core Page 标题栏加入一个紧凑的连接/设置菜单、连接状态和开始/停止操作。工作区按保存的连接设置自动尝试连接；默认地址为 `169.254.111.118:1225`、预期序列号 `1498377`，并支持 Ethernet/Wi-Fi/指定网卡。
- 身份解析接受完整制造商前缀和用户实测的紧凑 `KI4200A,1498377,V1.14` 格式。连接后枚举逻辑选件、物理模块型号与额定值。
- **KXCI ACK 缓冲修复**：KXCI Ethernet 写入命令返回 NUL 终止 ACK。`UL/DE/US/DV/RI/RG` 现在逐条读取并验证 ACK，不能使用 `noReply=true` 遗留响应字节，否则下一条 `GN result` 或 `TI` 可能误读旧 ACK。
- 原生 Page→Xsweep/Psweep 映射、点序列和 Data Center 原始数据列已接通到可测试运行时；增加 X/P 电压、点序、扫描段、循环/重复等字段。点序列改为惰性生成，避免预先分配整个嵌套扫描数组。
- 用户确认是启动测量的必要条件；异常停止后如果 SMU-off ACK 未获确认，运行时拒绝断开连接并阻止下一次测试。模拟回归验证了这一路径。

### 不能开放真实输出的原因
- 官方手册索引列出最新 KXCI Rev F（2026-10-09），但完整正文尚未取得并完成 Rev E→F 命令、响应、范围和时序逐项核对。数据库新增 `safetyPolicies.kxci`，生产 `allowInstrumentOutput=false`。
- DKDS Plugin API 1.19 不向插件开放受支持的主机延时调度器，SDK 校验禁止插件 raw timer。当前主机逐点 `DV/TI` runner 不能在生产插件中按要求调度，因此生产 `executionAdapterAvailable=false`。测试注入的 wait adapter 仅用于模拟 TCP 回归，不改变生产门禁。
- 主机逐点 `DV/TI` 不等于仪器内部扫描，不能据此宣称 20 ns。下一阶段必须先核验 Rev F，再实现仪器原生扫描命令或正式支持的 Core 调度契约。

### 验证与交付
- `npm test`：**214/214 通过，0 失败**。
- DKDS SDK 1.19 原生插件校验通过；DKDS 插件目录校验通过。
- 同源预览已从本轮源码与固定 DKDS Core SHA 重新生成，预览中的 `plugin.js`、`plugin.json`、`measurement-runtime.js`、`identity-core.js`、`kxci-measurement.js` 与源码哈希逐项一致；静态 HTTP 资源检查返回 200。
- 浏览器截图因当前容器的 Chromium 管理策略拒绝本地/虚拟域名页面，未取得可用于视觉验收的截图；因此本轮不宣称 FS-Pro 像素级复刻完成。
- 交付 `DK-Test-Studio-V0.3.24-a204-source.zip`、`DKTS-Core-Same-Source-Preview-V0.3.24-a204.zip` 和包含固定 DKDS 只读依赖的完整云端包。a204 为本地暂存编号，正式 aNNN 以最终同 SHA 的发布工作流为准。


## 2026-11-16 · V0.3.25 a205 · DKDS 生命周期定时服务接入

- 复核 DKDS Plugin API 1.19 SDK 定义，确认 `ctx.ui.dom.timeout(fn, delay)` 存在，且由 DKDS DOM Runtime 管理 timer 生命周期；上一轮关于“插件无受支持延时调度接口”的判断错误。
- 原生插件 manifest 新增 `ui.dom` Core 依赖；`measurement-runtime.js` 默认使用 DKDS DOM timer，测试注入 wait 仅用于确定性模拟。
- KXCI runner 的等待任务暴露 cancel，stop 会取消 pending timer 并立即进入 SMU shutdown；所有输出关闭命令仍逐条读取并确认 ACK。
- 专项测试 7/7 通过：包含缺少 DOM timer 时拒绝执行、默认 Core timer 正常完成两点 TI 测量、stop 取消待执行 timer、未确认 SMU-off ACK 时拒绝断开、Data Center 原始 TI 发布。完整 `npm test` **216/216 通过**。
- DKDS SDK 1.19 插件 `validate` 与 `test-runtime` 通过；`test-layout` 64 个 canonical cases 全部通过。
- 应用版本 `V0.3.25`，原生插件 `0.8.12`，Android legacy `versionCode 34`，临时编号 `a205`。生产 `allowInstrumentOutput=false` 未改变，Rev F 手册正文未核验，真实测量仍未授权。
- 同源预览按 a205 源码重新生成，静态 HTTP 首页、plugin-index、manifest、原生插件脚本和品牌资源返回 200；D3 7.9.0 直接随包提供，启动不再依赖 npm 安装或首次构建。Chromium 截图在当前容器未能完成，未宣称视觉验收。
- 未推送 GitHub、未创建分支、未修改 DKDS、未编译 EXE/APK。FS-Pro 像素级复刻、真实 Electron/Android 截图、硬件异常恢复仍未验收。

## 2026-11-16 / V0.3.26 a206（暂定）：恢复并冻结 FS-Pro 视觉基线

- 用户明确要求先恢复并锁定 FS-Pro 视觉基线，暂停新增功能。仅修改 DKTS 原生插件显示编排、Scoped CSS、回归测试和文档，不修改 DKDS 上游或 KXCI 执行器。
- 根因：DKDS Unit Action 容器拥有 Core 内联 display:flex，DKTS 原来的 CSS display:none 无效；导航、移动端端口按钮与桌面四端口选择同时出现。仅在三个已拥有的语义可见性选择器上使用 !important，不触碰 Core 网格/配色。
- Page 恢复为单一标题（不含 Device/Routine subtitle 与直流重复标识）、独立 Terminal strip、Page Info 与三主标签。X/P 扫描优先；Psweep 关闭时仍保留可启用卡。修复 Xsweep 列标题创建成空 SDK Identity Layout 的错误，改用 DKDS Note Unit。紧凑的扫描汇总移至后方内容尺寸 Panel。
- 项目导航取消“工程/项目”重复两行；工程绘图区取消重复眉标和图窗数量 meta。保存旧版已认可的 Web 文件及参考截图 SHA 供后续审查；新回归不以静态组件存在冒充像素一致。
- 发布：V0.3.26、a206 均为本地暂存，插件 0.8.13。真正 aNNN 只能来自将来 main SHA 的 ui-update.yml；无 EXE/APK、无 GitHub 推送、无 DKDS 修改。

- 本轮追加修复：宽屏扫描表格出现“总列标题 + 每个输入字段标签”重复问题。DKDS Core 样式层级覆盖了普通 display:none；只针对 `.dkts-sweep-segment .dkds-field-label-row` 在宽于 620px 的扫描容器中隐藏字段标签，手机小容器仍保留完整可访问标签。
- 真实 DKDS Core 生成代码经 Chromium 渲染四档（1591×900、1280×800、744×600、390×844）：端口/导航断点、X→P→Terminal 顺序、宽屏无重复标签、手机字段标签、汇总高度、横向溢出均通过；保留截图和 `VISUAL-REPORT.json`。这只是 Core 浏览器运行证据，不是原厂逐像素差异或 Electron/Android 真机验收。
- 完整 Node 测试 `npm test`：**220/220 通过**（与既有 216 项加四项基线锁测试一致）。原生功能/协议没有扩展；不得把测试数量当作 FS-Pro 像素级完成度。


## 2026-11-17 · UI 阶段重构开始（基线 a206，目标 V0.3.27 / a207）
- 用户原话 [R-20261117-001] 已写入 `docs/USER_REQUIREMENTS.md`；开发规约已写入 `AGENTS.md`；七标签结构已纠正 `docs/FS_PRO_VISUAL_BASELINE_LOCK.md` 和 `docs/UI_ARCHITECTURE.md`。
- 当前工作区基线：完整 DKTS `V0.3.26 a206` 源码 ZIP；固定 DKDS 3.72.3 SHA `20f056851a61d2144e9524c3ed568628d4b8557c`，只读。不得回退到 GitHub `main` 的 V0.3.21。
- 本阶段目标：把 FS-Pro 七标签、Page Info、Sweep 表格、Terminal Settings/Fixed Bias、Target/Strategy/Limits/Page Var/Associate Spec 重构为唯一原生 UI；若 DKDS Unit 不足，扩展 DKTS Unit adapter/派生 Core Unit，而不是删改 FS-Pro 信息架构。
- 开发节奏：先完成一整个 UI 阶段，再统一运行 Node/SDK 测试、构建一次 `DKTS-Core-Same-Source-Preview`、执行四种视口真实截图检查；本阶段不触发 EXE/APK 编译，不推送 GitHub，不创建分支，不修改 DKDS 上游。
- 尚未验收：本日志记录的是本阶段计划与文档修订，不代表 UI 已完成；需在代码修改和真实 Core 渲染后更新结果。


## 2026-11-17 · V0.3.27 a207 · 七标签 UI 与 DKTS 派生 Unit 阶段验收

### 已完成的代码与文档
- 以完整 `V0.3.26 a206` ZIP 为可写基线；基线 SHA-256 `642e60a9cb24924ad42ed3c92b1d769be961c588efa5fce71cc5b379d8738601`。DKDS 3.72.3 固定 SHA `20f056851a61d2144e9524c3ed568628d4b8557c` 只读。
- 将 Page Editor 实现为独立七标签 `Info / Sweep / Target / Strategy / Limits / Page Var / Associate Spec`；Info 内容只在 Info 标签中显示。
- Xsweep/Psweep 使用 `# / Start (V) / Stop (V) / Step (V) / Range (A) / Speed / 操作` 七列，扫描端口和重复次数放在各自标题栏；Psweep 未启用时保留启用入口和固定偏置说明。
- Terminal 只显示 Source/Drain/Gate 三个映射；None/GNDU 不进入测量参数行和 Target 通道。Terminal Settings、Fixed Bias 分离。
- 编辑器和四个独立 PlotView 使用同一 Core 工作区并列布局；返回绘图区时扩展绘图区。
- **未完成项**：`web/fspro-workbench/` 与 `integrations/dkds-native/plugin.js` 当前仍分别实现 Web DOM renderer 和 Core Unit renderer；虽然七标签、字段顺序与域模型已对齐，但尚未抽取完全共享的 UI renderer/DOM/CSS。不得把本阶段称为 same-renderer 或像素级完成。
- 新增 `tools/patch-dkts-derived-units.cjs`：只对派生 DKDS Core 副本扩展 FS-Pro Tabs、Field 和 Layout Unit variant/recipe；DKDS 上游字节不修改。
- 已把用户原话及“Unit 不满足则扩展 Unit、阶段完成后统一验证、不做小改动频繁编译、不在 UI 阶段构建 EXE/APK”写入需求台账、`AGENTS.md`、UI 架构和视觉基线文档。
- 修正了 SDK 对插件直接设置 textarea 控件 `min-height` 的拒绝：控件几何移至 DKTS 派生 Core 的 FS-Pro Field Unit theme，插件只声明领域结构。

### 统一验证
- `npm test`：**224/224 通过**。
- 派生 Core 插件目录 validator：**12 个插件通过**。
- SDK `dkds-plugin.js validate`：首次发现插件 CSS 直接设置 textarea `min-height`，已移至 DKTS 派生 Field Unit theme；修正后需重新运行并记录最终结果。
- 同源预览已从当前源码和固定 DKDS SHA 重新生成；health、Core index、Core CSS、D3、generated plugin index 与 DKTS 插件脚本 HTTP 检查：200。`PREVIEW-MANIFEST.json` 中源码树 SHA-256 与当前源码树重新计算值一致。
- 当前环境的系统 Chromium headless 截图进程挂起，未产出 V0.3.27 四视口截图；因此本轮**不宣称真实视觉截图验收通过或像素级复刻完成**。需要在可用 Chromium/Electron 宿主重新执行 1591×900、1280×800、744×600、390×844 截图叠加。

### 交付边界
- 本地源码身份 `V0.3.27 a207`，原生插件 `0.8.14`，Android legacy `versionCode 36`；a207 是暂存编号，不是正式 Release 编号。
- 未编译 EXE/APK，未推送 GitHub，未创建分支，未修改 DKDS 上游。
- 真实 4200A 输出仍受 KXCI Rev F 手册与硬件验收门禁约束。


## 2026-11-17 · V0.3.28 a208 · FS-Pro 工作区与可安装 Unit 插件

- 实施 R-20261117-002。以 a207 源码 ZIP 为工作基线，继续固定只读 DKDS 3.72.3（20f056851a61d2144e9524c3ed568628d4b8557c）。读取核对的 GitHub main 为 c8ce9172aeeee942a09cf0c75b69356185c7f624。
- 线上 FS-Pro 的工程绘图区与 Page 编辑器互斥。DKTS 恢复该流程，保留四个已挂载的 PlotView，进入 Page 时独占工作区。增加 Project 工具条、面包屑、常驻两列测试库，保留 Device/Routine/Page 数据结构。
- 七个编辑标签使用标准 DKDS Tabs Unit 的逐项 onClick。扫描表头与输入行使用一致的列定义，端口与重复次数按横排显示。窄屏按容器宽度改用有标签的行内字段。工具和表单继续使用标准 Unit。
- 删除派生 Core 的 Unit 注册和事件补丁。独立插件通过固定 SDK 校验和运行时合同测试。DKTS 分发的 FS-Pro 外观由 DKTS 派生宿主 Theme 层提供，安装到标准 DKDS 使用宿主主题。现场通过 DKDS 导入插件的操作仍待验收。
- 公开同源预览用真实 DKTS Core 派生宿主。HTTPS 入口 https://4174-agq6fanpizxnfznur35ehkm4ye.instabox.tech/ 无需账号或令牌；仅开放浏览器资产，60 分钟和 256 MiB 应用响应预算。会话为 Free。原生连接需要配置用户自己的地址和预期序列号；空白配置处于离线状态。测量协议和实际输出未启用。
- 云端 Node 223/223，通过原生插件和宿主 mock、DKDS SDK validate 和 test-runtime。外部 Chromium 1591×900、1280×800、744×600、390×844 通过七标签、导航、编辑器/图窗互斥与横向溢出检查，资源响应及 JS 错误均为空。相同分辨率附线上范本、真实截图、overlay 和 diff。四个图窗已保留，参考版的默认规划波形、顶部宿主样式和逐像素一致性未验收。Windows Electron、Android 与真实仪器仍待实测。
- 未推送 main，未创建分支，未编译 Windows EXE 或 Android APK。a208 为源码暂存编号，插件版本 0.8.15。



## 2026-11-17 · V0.3.29 a209 · 中英切换和页面批注修整

- 依据 R-20261117-003，以 a208 完整源码 ZIP 开发。GitHub main 核对基线 c8ce9172aeeee942a09cf0c75b69356185c7f624；固定只读 DKDS 20f056851a61d2144e9524c3ed568628d4b8557c。
- 在标准 DKDS 4200A 工作区的次级命令区注册中英按钮。默认简体中文，Core 插件设置保存偏好。切换保留当前页面、标签、编辑内容及图窗状态。390px 使用项目工具条的同一命令作为窄屏入口。宿主系统文案和工程数据归原有来源。
- 编辑器用单行标题，统一操作组间距，保存集中在 Core 顶栏。端子选择按 S/D/G 显示白字填充，扫描段删除控件居中。Info 等配置保留七标签并调整表单宽度和留白。
- 工程导航使用节点对齐、缩进与引导线，修正流程增多后列表压缩。流程与页面支持右键和更多按钮。流程菜单可回到绘图区和新增测试，页面菜单可编辑、进入信息或确认删除。
- 界面注明扫描段指定量程优先，选择沿用端子时按端子量程模式，电流保护单独校验。参考现有网页及概伦公开的 LabExpress 资料；原厂完整编辑器画面与各字段尚待逐项复核。
- 云端 Node 223/223，原生插件/宿主 mock 和 SDK validate/test-runtime 均通过。独立插件 0.8.16。公开同源预览继续由 Free 工作区承担，服务限制 60 分钟和 256 MiB。验收截图与浏览器报告随本次交付。
- 真正的 Windows Electron、Android 和仪器验收仍待进行。无 GitHub 推送或安装包编译。



## 2026-11-17 · V0.3.30 a210 · LabExpress 编辑分层和逐测试执行

- 实施 R-20261117-004，以完整 a209 ZIP 为工作基线。GitHub main 只读核对为 c8ce9172aeeee942a09cf0c75b69356185c7f624，DKDS 固定只读 SHA 为 20f056851a61d2144e9524c3ed568628d4b8557c。
- 结构证据：历史原厂手册的工程归档 FSPro_Rebuild_Baseline.md 和 Issue #20 保存了主标签、输入设置与下部三栏。用户提供的工程树图作为树形布局依据。当前本地和免费沙盒未找到中文 106 页 PDF 本体，无法验证手册截图像素、未支持字段或完整操作逐项一致。
- 顶部仅保留 4200A 所属语言命令；移除项目工具栏重复入口、侧栏重复绘图区入口和编辑页校验／执行／返回按钮。标题、导航行垂直居中，端子映射靠标题右侧。扁平下拉显示 SMU 名称，独立端子名标记沿用白字填充。
- 扫描页复原三主标签、输入设置内的 X/P 行、固定偏置、限值／变量／关联规格和最下方端子量程与保护。分段默认显示 Auto，量程与保护规则仍由既有计划验证。
- 每个测试右侧的执行按钮使用标准 DKDS 对话框选择次数。运行前校验次数、扫描草稿、计划与仪器可用性。非法扫描段保留输入、标注原因并可从执行入口定位。次数用于该次执行的独立计划；真实输出仍由实际模块、安全门禁和显式确认控制。
- Node 223/223、SDK validate/test-runtime 与 native mock 通过。公开页面继续使用原 HTTPS 地址，Free 沙盒 60 分钟及 256 MiB 响应上限。交付实际 Chromium 截图、完整源码、同源预览和独立插件 0.8.17。Windows Electron、Android 与真实仪器尚待验收。



## 2026-11-17 · V0.3.31 a211 · 工程树、端子及扫描联动

- R-20261117-005。以完整 a210 源码 ZIP 开始。依据本地 LabExpress 中文原厂手册印刷第 4、14–15 页（PDF 第 8、18–19 页）核对工程层级、扫描/目标/策略、输入设置与下方参数。手册留在本机。
- 工程树直接显示全部器件及各自的流程和测试；移除独立「测试工程」行。流程菜单保存独立循环次数；单页执行次数使用已有流程。整套流程编排未接入。
- 工程导航与绘图区标题在桌面与控件严格同高。主标签组使用平面样式；用 DKDS 原生悬浮提示呈现说明；规格使用单一选择字段。增大模板区上方间距。
- 端子映射保留在标题右侧，扫描角色选择已映射且可用的逻辑端子。端子名统一强调，SMU 文本沿用平面 Unit。扫描终止值变更后自动接续后续起点，并修正非零步进符号。精确终点、点数、限值和运行门禁保持校验。
- 文件：原生插件 model、渲染和布局，DKTS 派生主题，插件/发布身份与回归测试。只读 DKDS 固定提交 20f056851a61d2144e9524c3ed568628d4b8557c。开发期间查得 DKTS GitHub main 为 355e515fad7fdfbb03b10d2270b308543fc175ba；本轮未推送。
- npm 223/223、原生模型和宿主契约通过；DKDS SDK 插件及运行时验证通过。真实 Chromium 公共同源预览覆盖 1621×747、1280×800、744×600、390×844。桌面验证标题同高、悬浮提示、重复保存、分段联动及追加器件/流程后原测试可访问。四尺寸验证页面与离线执行门禁。
- 交付完整源码 ZIP、同源预览 ZIP、独立插件与校验清单。InstaBox 使用现有免费机器，预览限制 60 分钟与 256 MiB。未编译 EXE/APK；真实 4200A、原生 Windows/Android 宿主展示及整套流程执行尚未实装验收。

## 2026-11-17 / 4200A 参考资料恢复与私有归档（资料整理，不构建应用）
- 需求：R-20261117-001。仅 DKTS；保持唯一 `main`，不修改 DKDS，不创建分支；恢复可找回的 V2/V3/V5/V6、连接交接资料及用户上传的 LabExpress 手册。
- 已从 Library 找回：V2 PDF/DOCX、V3 PDF/DOCX、V5 PDF/DOCX、V6 UI 规范 PDF、V6 UI 实施 DOCX、4200 control.docx、OPPO Pad Mini/DKDS 连接交接 Markdown；本轮另收到 LabExpress 中文用户手册 2022.01（106 页）。
- 在 `docs/reference/4200a/` 新增来源目录、资料状态和 DKTS 自有文档的可检索文本摘录。LabExpress 原厂手册具有版权限制，仅进入私有交付 ZIP，不公开上传 PDF 或全文。官方 Tektronix 页面已核实 KXCI Rev F（4200A-KXCI-907-01F，2026-10-09）与 PMU Rev D（4200A-PMU-900-01D，2026-10-22）；两份 PDF 本身未下载，不作为已纳入文件。
- 未找回：`FSPro_4200A_Agent_Dev_Pack_V5.zip`、`DKTS_FSPro_V6_full_retry.zip`、`keithley-main.zip`。不以重建内容冒充原件。官方 KXCI 示例仓库链接已记录。
- 本轮不修改应用代码/版本，不运行 Windows/Android 最终构建，不执行真实 4200A 输出或测量。GitHub 参考资料 commit SHA 与私有 ZIP 的最终文件清单、SHA-256 将在后续交付记录中补齐。


## 2026-11-17 / 4200A 参考资料归档交付核验
- GitHub 资料恢复提交：[`0887ffb5124a72cff7ebca33f0bc63ed516ed124`](https://github.com/davidkane0526/DK-Test-Studio/commit/0887ffb5124a72cff7ebca33f0bc63ed516ed124)，直接提交到唯一 `main`；分支检查结果仅有 `main`。新增 9 个参考资料文件并更新用户需求/开发日志；未修改 DKDS，未改应用代码/版本，未触发应用构建。
- 私有交付包：`DKTS-4200A-Reference-Bundle-2026-11-17.zip`；27 个文件；13,782,750 bytes；ZIP 完整性检查 PASS；SHA-256 `f8b37d42220e68a186827a3cc02fa687bf88551549094f6357c1206cb6ed9349`。
- 私有 ZIP 含用户上传的 106 页 LabExpress 手册及找回的 V2/V3/V5/V6 PDF/DOCX、连接交接 Markdown、4200 控制笔记和检索文本。原厂 LabExpress 手册未公开上传到 GitHub；GitHub 仅保存书目/版权说明和 DKTS 自有规范的文本摘录。
- 尚缺原始 V5 Agent Dev Pack ZIP、V6 完整 ZIP、`keithley-main.zip`、官方 KXCI Rev F PDF、官方 PMU Rev D PDF；没有伪造或重建这些原件。
- 本 ZIP 是 4200A 参考资料包，不是完整 DKTS 应用源代码包，也不是 Windows/Android 安装包。

## 2026-11-17 · V0.3.32 a212 · 量程、工作区界面和 GitHub 交接

- R-20261117-006。a211 源码 ZIP 作为编辑基线，保留 GitHub 父提交 355e515 的参考资料及资源。
- 收紧工程导航缩进，参考端移入输入设置标题右侧，端子颜色统一。固定偏置同行，端子量程标题对齐。目标与策略表单减少重复，连接菜单使用单轮廓，执行对话框使用红色确认。
- 量程来自已核验的实装通道，按型号、前放和电压档逐段筛选。离线仅提供 Auto，显式保留旧值。目标沿用端子或扫描段设置，对遗留独立目标档位给出校验提示。
- 新增 docs/HANDOFF.md，继续复用现有 Free InstaBox。正式工件和源码归档由同一 GitHub SHA 的 Actions 生成。真实 4200A 输出仍受生产门禁限制，未进行实机测量。

- 224 项 Node 测试通过，独立插件与宿主契约通过，DKDS SDK 验证、运行时及 64 个布局用例通过。Chromium 在 1621×747 和 390×844 实测布局、端子颜色、离线档位及执行对话框。
- 统一 Release 自动附同 SHA 完整源码和独立 DKDS 插件，资产校验覆盖 EXE、APK、能力数据库和新增文件。Actions 构建结果和正式编号以 GitHub 该 SHA 的运行记录为准。

## 2026-11-18 · V0.3.33 a213 · 浏览器批注、跨电脑交接、正式发布

- 需求 R-20261118-001、R-20261118-002。基于 DKTS `main` 的 `c6d7187d9f323cdcfc1d1a48a3ad194c417bdd5b`，继续使用同一免费 InstaBox `box-fe583e` 和 Node.js 22。原生插件 0.8.20，DKDS 上游仍固定为只读 `20f056851a61d2144e9524c3ed568628d4b8557c`。
- 参数页：扫描端子下拉收窄、输入设置划分扫描与可编辑字段的视觉层级。端子量程的首行为 SMU 与字段名，次行为电极与输入。工程导航标题左对齐，保留高亮执行入口和设置／数据图切换。
- 工程：顶栏共享物理端口映射，原测试保留自身参数。旧项目以迁移时的当前测试作为共享映射，并归档其他测试原映射。启动连接使用保存的地址与序列号，连接后识别 SMU／PMU。手动端口扫描在活动测量期间禁用。离线四个 SMU 仅供规划，PMU 识别与映射未启用 PMU 输出。
- 绘图：流程和单项测试各自保存图窗选择；单击测试显示数据图与历史，双击进入参数。历史读取 DKDS Data Center 的真实记录并可放入指定图窗。无测试 ID 的旧数据保留在总览。结构对照使用归档中引用 LabExpress 2022.01 原厂手册 PDF 第 23–27 页的 Frame、叠图和 Data Viewer 资料。本实例未找到原厂 PDF，原图对照待补。
- 预览：Node 全量 224 项、插件与宿主契约、DKDS SDK 校验与运行时通过。InstaBox Chromium 1651×871、1280×800、744×600、390×844 验证端口宽度、量程两行、导航、图窗与设置往返、顶部按钮和历史区域。目标图窗分配和范围隔离通过宿主测试。
- Windows 启动验收修正：上一 SHA 的 Electron 已加载正确插件和四个图窗，等待超时由启动阶段仍要求旧的七标签编辑器、端子区和侧栏宽度所致。启动时验收现行数据页和共享端口，进入设置后再检查三个主标签及端子字段。正式 EXE、固定签名 APK 和 Release 以本轮标记提交对应的 Actions 为准，实机测量及升级回退仍待验收。

## 2026-11-18 · V0.3.34 a214 · 批注复核、保持特性和脉冲扫描

- 需求 R-20261118-003。起点为 GitHub `main` 的 `06a40a66a48d74d32bf61b79bd24a0cfe2eeb276` 和 [V0.3.33 a198](https://github.com/davidkane0526/DK-Test-Studio/releases/tag/dkts-v0.3.33-a198)。仍使用原免费 InstaBox `box-fe583e` 和固定只读 DKDS `20f056851a61d2144e9524c3ed568628d4b8557c`。
- 工程导航设置／数据图改成有提示的图标，移除页内重复返回键，可双击重命名器件。顶栏次级命令统一间距，共享端口以竖线分组。历史浏览按测试、时间、状态和行数呈现，图窗选项按工程、流程和测试范围生成；V–t 曲线只使用真实时间列和电压列。
- 保持特性增加偏置阶段、读出时间轴、线性／对数取点与 SMU 电流保护。脉冲扫描增加基线／幅值扫描、平顶、周期、边沿、测量窗口与 PMU 采样预算。两种方案由 `model.js` 统一校验和保存，保留原有生产执行门禁。
- [4200A 能力与时序界面](TIMING_AND_4200A_UI.md) 记录了已实现界面、实装模块约束、待增交互及时间表、Measure Event、硬件同步和采样回传的接续顺序。LabExpress 参考库内 V6 转录。原厂截图、KXCI Rev F 和 PMU Rev D 正文差异及真实 4200A 行为仍待核验。
- Node 224/224 通过，独立插件、宿主契约、DKDS SDK 校验与运行时通过。InstaBox Chromium 在 1651×871、1280×800、744×600 和 390×844 验证两种参数页、保存后重入、非法读出窗提示、图标切换和无横向溢出，宽屏同时验证器件双击重命名和端口分隔。包和统一 Release 以本轮同 SHA 的 Actions 为准。

## 2026-11-18 · V0.3.35 a215 · 独立 DC 测试参数页

- 需求 R-20261118-004。使用现有 Free InstaBox，源码基线 V0.3.34 a214 与 GitHub main 99015c7e7efe4827cc31a25aa6aec68f747226af 一致。DKDS 3.72.3 继续固定只读 20f056851a61d2144e9524c3ed568628d4b8557c。
- 核对 LabExpress 2022.01 印刷第 14–16、34–36 页，Keithley 4200A-SMU-900-01A 第 5 节、KXCI 4200A-KXCI-907-01E 第 5 节。新类型使用 DKDS Unit，并按 D、G、S、已分配 B 排列；第一行是源模式、信号产生法及参数，第二行用 Ref 和扫描角色。Ref Node、参考值及 Outputs 同组。扫描页底部依次是限值、变量、关联规格；Target 有公式、Plot、Page Var、Quote Var；Strategy 可选全局、局部积分和延迟设置。DC 的 B 端映射仅保存在该测试内。原 I–V 数据模型、编辑器和执行路径通过回归检查。
- 扫描支持 Constant、Linear Step、Linear Points、Log Points、List、Generator；按角色提供选项。偏置表达式支持四则运算、页面变量、scale()，Generator 另识别 getx()/getp()。DC 保存时检查参考关系、角色、源输出规划范围及测量输出。Target 公式和 Plot 绑定保存为配置。真实目标公式求值、仪器执行、KXCI Rev F 正文对照和实机验收待接入或验证。
- Node 224/224、独立插件模型及 Core 宿主契约通过；DKDS SDK 1.19 validate、test-runtime、64 个 test-layout 用例通过。Chromium 同源 Core 1651×930、1280×800、744×600、390×844 检查分行、Ref、方法切换、跨标签保存、重开和原 I–V 编辑器，桌面和窄屏均检查 B 映射，窄屏经端口弹层设置。首轮 SDK 检查发现插件 CSS 持有边框与背景，已移到 DKTS Core 主题后通过。验收截图与源码和预览 ZIP 同批交付。
- 发布身份 V0.3.35 a215（开发暂存），原生插件 0.8.22。GitHub 未推送，未编译 EXE/APK。提供完整源码 ZIP、同源预览 ZIP、DKDS 插件和 SHA-256 清单。

## 2026-11-18 · GitHub Pages 批注入口与主线同步

- R-20261118-005，以 a215 的 GitHub 提交 `fa8a8c585610170ec39e043c5c3f11a8a0142ffe` 为基线。每轮修改验证后同步唯一的 main，直接使用该提交的源码归档接续开发。
- `core-pages.yml` 使用固定只读 DKDS Core 和同一 SHA 的 DKTS 插件生成静态网页，部署到现有 GitHub Pages 的 `/core/`。根地址继续提供旧 Demo，其原手动工作流保留离线产物。发布目录只复制浏览器资产，以 `/core/preview.json` 记录部署 SHA。
- Node 224/224 全部通过。Chromium 按 GitHub 项目子目录验证旧 Demo 根入口、Core 入口、DC 编辑器与 Ref 控件。验证部署目录排除原生宿主、测试和仓库元数据。线上部署以同 SHA 的 Core Web Preview Actions 结果为准。
- 此轮交付为网页部署流程与文档，应用版本维持 V0.3.35。Windows/Android 构建仍需明确最终构建授权，真实仪器与原生端安装验收留给对应测试轮次。

## 2026-11-18 · V0.3.36 a216 · 九条 DC 网页批注

- R-20261118-006，基线为 GitHub main 8ef823bc08701f0d33c178ebc8acdf8809d36f6e。修改 DKTS 的项目模型、Core 插件及布局。新建项目和流程自带 I–V 扫描和 DC 测试；已有项目保留已有测试与参数。新 DC 默认漏极 D 为 Linear Step / Xsweep，栅极 G 为 Constant / Condition。
- 顶部将测试类型、Ref Node、Ref (V)、Outputs 放在同一组。器件、极性、组别和名称退出参数页，新测试名称仍可在工程菜单编辑。保留旧数据的表达式极性语义。
- 核对 LabExpress 2022.01 第 14、33、35–36 页和 4200A SMU 用户手册第 3 节。DC 优化加速与逐点拥有独立选项。逐点显示分段量程、首点保持、超限与扫描方向。离线量程为 Auto，实装 SMU 核验后才列出适用档位。当前交付支持编辑、校验和保存，实机执行与 Target 公式求值待接入。
- 缩窄 Ref，SMU 与端子同排，隐藏角色文字并使模式及角色下拉对齐。为 DC 底部的变量面板覆盖其旧的内容对齐规则，使并排三栏同高。顶栏使用「端口」和统一字体。
- Node 224/224、插件及宿主契约、DKDS SDK validate/test-runtime/test-layout（64 项）通过。Chromium 验证 1621×747、1280×800、744×600、390×844 的默认测试、端子行、顶部顺序、预设切换和保存，无横向溢出。发布固定同源预览与同 SHA 源码归档；最终安装包留待发布授权。\

## 2026-11-18 · V0.3.37 a217 · 图窗、DC 扫描段与时间扫描

- R-20261118-007。基线为 GitHub main `fb29d4402a9e92ac69722a2c4682123e4246aa37`。沿用 Free InstaBox `box-fe583e` 和只读 DKDS `20f056851a61d2144e9524c3ed568628d4b8557c`，DKTS 插件升级至 0.8.24。
- `integrations/dkds-native/plugin.js` 与 DKTS 主题同步修改工程导航、工具栏、四宫格和 DC 页。四宫格使用 Core 网格的等高行，桌面下历史数据仍可见。DC 参考参数移到策略标签右侧。端子、模式和逐段参数分列，每个端子统一设置方法，新增时只扩展逐段参数。旧项目的混合方法可读，应用前须显式选择共享方法。
- `model.js` 与插件接入 Time Xsweep、分段偏置、独立切换和采样步长、循环、Measure Event 与离线校验。依据库内 LabExpress 2022.01 结构转录，原厂截图与真实 4200A 时序仍待核验。实机执行接口留待固件与同步能力验证。
- Node 224/224、独立插件和 Core 宿主契约、DKDS SDK 校验与运行时通过。InstaBox Chromium 覆盖 1651×871、1280×800、744×600 和 390×844，验证图窗等高与完整高度、历史区、DC 分段和导航、时序编辑与参数检查。固定网页及完整源码 ZIP 使用本轮 main 的同一提交。

## 2026-11-18 · V0.3.38 a218 · DC 参数对齐和 IVT 编辑区

- R-20261118-008。以 GitHub main `78f8ff6e3bb0a8d48723b41a170ddbe2f767bcb0` 接续。沿用 Free InstaBox `box-fe583e` 和只读 DKDS `20f056851a61d2144e9524c3ed568628d4b8557c`，DKTS 插件为 0.8.25。
- `integrations/dkds-native/ui-shell.css` 和 DKTS 派生主题使顶部测试类型、Ref 与端子行使用同一列宽。两道分隔线及 Outputs 和段输入的右缘对齐。窄屏按组换行，使用水平分隔。调整端子身份显示、方法组留白和分段按钮中心。顶栏连接、端口、语言使用 DKDS secondary 按钮，实测高度 34 px，圆角 7 px。
- 核对概伦公开资料第 2 页的 IVT 波形，结合仓库 V5、V6 转录的手册第 42–43 页独立 Table Input 和第 61–66 页 FastIV 测量事件。新增独立时间电压表和单循环计划时序预览，编辑后同步更新偏置阶跃、读出窗口和校验结果。该环境没有手册原 PDF，待对完整原界面验证，4200A 时序执行待实机核对。 [概伦 FS-Pro 公开资料](https://www.primarius-tech.com/uploads/20230307/EN_FS-Pro.pdf)
- Node 224/224、插件与宿主契约、DKDS SDK 校验、运行时、64 个布局用例通过。Chromium 覆盖 1651×871、1280×800、1150×720、1024×768、744×600 和 390×844，验证 DC 对齐及分段、宽窄重排和时序预览对参数编辑的联动。网页和源码归档以同一 main SHA 部署。

## 2026-11-18 · V0.3.39 a219 · DC 边距和 DKDS 明暗主题

- R-20261118-009。基线为 GitHub main `aa2322d7ea977b4e0b65960a52cb087c1b097b03`，沿用 Free InstaBox `box-fe583e` 和只读 DKDS `20f056851a61d2144e9524c3ed568628d4b8557c`，插件版本 0.8.26。
- DC 顶部与正文的滚动槽改为双侧保留。在验收浏览器中，参数卡片原左 12 px、右 22 px，修改后等宽 20 px。参考与扫描角色共用子网格行。桌面参考框由约 96 px 调到 110 px，标签间隔 12 px，端子标记、端子名和物理资源同排。标题改为「类型」，输入设置标题阴影随主题切换。
- 修正自定义背景、文字和分隔线对 DKDS 公开主题变量的引用。时间扫描画布订阅主题修订，随亮暗模式与主题配置重绘。仪器控制和原生安装包未在本轮验收。
- Node 224/224、独立插件、宿主契约与 DKDS SDK 的校验、运行时及 64 个布局用例通过。Chromium 验证 1651×871、1280×800、744×600、390×844 的明暗切换和几何，覆盖有无纵向滚动的情况。桌面另核对 DK Data Studio、Thin Glass 和 Aurora Pop 三种主题的明暗背景，并验证默认主题下的时间扫描预览重绘。网页和完整源码归档使用同一 main SHA。

## 2026-11-23 · V0.3.39 统一 Core 发布

- R-20261123-001。GitHub 最近发布的版本为 V0.3.34 a199。以已验证的 GitHub main `cb247cc35e00b8a634bee5a8edcbdd7bb2da534f` 为发布基线，更新发布记录并触发统一 Core 工作流。
- 基线的 Node 224/224、插件、SDK 和浏览器验证见 a219 记录。Windows 和 Android 产物由本次工作流生成，4200A 实机测量仍待验收。

## 2026-11-24 · V0.3.40 a220 · 网页显示、面板手柄与时序设置

- R-20261124-001。以 GitHub main `ba60a4630fbd7fb838d9762b4d0f3f1385351fef` 为基线。上一版最终构建已作为 V0.3.39 a206 预发行。同源网页采用 a219 开发编号。本轮 DKTS Core 插件为 0.8.27。
- DKTS 派生局域网服务规范化 `/app/`，并在既有配对规则下提供 Core 主题和平台脚本及品牌资源。浏览器预览保留真实的 Web 宿主识别。连接、端口扫描和语言采用同一组共享 DKDS 工具栏 Unit，窄屏用「映射」区分工程端口映射。
- 工程导航宽度、测试模板高度和历史数据高度采用 DKDS SplitPane；支持拖动和保存偏好。PlotGroup 的四宫格保持 2×2，窄图窗的标题与操作由 Unit 响应式换行。
- Time Xsweep 增加单周期与重复、可编辑的终止时间、切换段数和单周期采样点。终止时间与最后一行时长双向联动。脉冲设置包含基本和高级分区，旧方案中的测量起止值迁移为延迟和时长。Auto 使用可用平顶窗口估算采样预算，固件行为和实际输出待仪器验收。
- Node 224/224、原生插件模型与宿主契约、SDK 1.19 验证／运行时／64 项布局通过。同源 Chromium 覆盖 1651、1280、744、390、320 px，检查主题、三处拖动、窄屏图窗标题和菜单、时序保存及旧参数兼容。配对局域网测试将主题脚本从 404 修复为 200，桌面和窄屏页面资源加载正常。移动布局用 Chromium 触摸环境验证。Windows/Android 新安装包和 4200A 实机待验收。

## 2026-11-24 · V0.3.41 a221 · 顶栏与仪器时序复核

- R-20261124-002。基线为已部署的 DKTS main `f590d06cedd73b1b35882900a8db03a6c1b52ed8`。插件 0.8.28，DKDS 只读基线仍为 `20f056851a61d2144e9524c3ed568628d4b8557c`。
- DKDS 上下文溢出暂存的旧 TOP 入口曾跨导航重绘残留。DKTS 派生构建在重绘前只清理旧入口。桌面复用 Host Toolbar contribution 的 quiet 主题变体，移动壳通过同组 Activity Action 获得连接、端口和语言命令。窄屏 Web 顶栏分行保留这三个命令，320 px 实测可见。工程工具行只承载其工程操作和端口映射。
- 三处分隔线的轨道为 5–6 px，手柄缩到 24 px，触摸保留更大的命中区。导航最小宽 240 px，名称单行，长名称可悬停查看。测试模板支持收起到标题和恢复原高度，高度和折叠偏好均可回读。
- 取得 Tektronix KXCI Rev F 和 PMU Rev D 原厂 PDF。Time Xsweep 计划采样步长添加下拉预设，SMU 积分采用仪器默认和 PLC 三档。PMU 采样率按窗口和通道点数筛选，脉冲设置校核硬件和接口时序，连接后按实装 PMU/RPM 限定电流档。未映射的旧脉冲设置显示为只读。
- Node 224/224、插件模型和宿主契约、SDK 校验、运行时及 64 项布局检查通过。Chromium 在旧版强制重现上下文溢出后出现四个 4200A 入口，新版同样重绘和窄宽切换均仅一个。检查 320–1440 px、主题、240 px 导航下限、折叠回读、移动 Action 投影、时序预设保存和非法脉冲周期拒绝。原生安装及实装卡、固件和硬件时序待验证。源码和同源浏览器工件由同一源码树生成。

## 2026-11-24 · V0.3.42 a222 · DC、历史数据和工程树网页批注

- R-20261124-003。以部署过的 GitHub main `794b5f33a8384acf0cca07a3e9bbe2eac3cb8637` 为基线，DKTS 原生插件 0.8.29，沿用只读 DKDS `20f056851a61d2144e9524c3ed568628d4b8557c`。
- DKTS 派生主题使用 DKDS 前景和表面颜色给 DC 端子身份列生成中性底色。历史卡片改用 DKDS fill Panel，滚动范围移到卡片正文，表头与图窗边缘对齐，分隔距离从 6 px 增至 13 px。显示图窗菜单使用 DKDS quiet Action，记录数与标题之间留 6 px。
- Chromium 在 1387×758、导航宽 240 px 下测得，导航与绘图区标题行同步上移 4 px，测试名到设置齿轮、设置齿轮到运行图标的实际留白分别缩小 29.3% 和 10.2%，按钮命中区尺寸相同。默认主题、Aurora Pop 明暗和 Thin Glass 亮色检查了 DC 底色、文字对比、历史面板；390 px 验证了抽屉内文字单行和 2×2 图窗。
- Node 224/224；插件模型、宿主契约和官方 DKDS SDK 校验、运行时及 64 项布局用例通过。宿主测试覆盖历史图窗操作的无选中禁用、选中启用并绑定采集记录。核对「+ 规格」创建当前器件下的具名记录、关联当前测试并打开扫描页，当前模型保存名称和关联，尚无自动合格判定。完整源 ZIP、同源浏览器预览 ZIP 和 Chromium 截图随本轮交付。原生安装及 4200A 实机不在本轮网页验收范围内。

## 2026-11-24 · V0.3.42 主线同步与统一构建

- R-20261124-004。用户授权推送和编译本轮 V0.3.42，并明确后续每轮均应验证、同步 GitHub main、核对同 SHA 的 Core Pages 并给出地址。Windows 和 Android 编译沿用明确授权门禁。
- 发布提交继承本地已验收改动 `91eb5c2e54d866b4465b0b04accadb9349539e46`，只补交付规则与发布记录。参照上一节 Node 224/224、DKDS SDK 三项检查与实际 Chromium 验收。以本次 Actions、Pages `preview.json` 与 Release `PROVENANCE.txt` 分别核对编译产物与网页源码。4200A 实机验收单独进行。

## 2026-11-24 · V0.3.43 a223 · 参数即时校验及时间扫描

- R-20261124-005。基线为已发布的 GitHub main `d330d14088678fc0016ff61073dcc21cf096c9d3`，DKTS 原生插件 0.8.30，沿用只读 DKDS `20f056851a61d2144e9524c3ed568628d4b8557c`。
- `tools/dkts-fspro-unit-theme.css` 将 DC 端子列由中性深灰改为面板标题色与正文表面各半，主题渐变端点的透明度也减半。参数页共享同一层级的类型、参考、Outputs。桌面合并进现有参数区头部，手机保留抽屉入口。时间扫描参考为 GND，Outputs 从测量事件读取。
- `integrations/dkds-native/plugin.js` 移除 DC、时间、保持及脉冲编辑器的「应用参数」。输入触发本地校验，正确的方案自动保存，错误字段标记并灰显工程树运行按钮。执行入口重新检查当前方案。各工程恢复时清除临时编辑错误；不会覆盖上次有效方案。手机科学计数键盘在参数区上方且避开状态栏。
- `integrations/dkds-native/model.js` 增加时间扫描源模式及独立的电压／电流存储，迁移保留旧偏置。时间偏置表是各段持续时间的编辑入口，终止时间为合计。Linear Step 用下拉呈现。参照用户 FS-Pro 样例与库内 LabExpress 2022.01 第 42–43 页的转录，切换步数等于单周期时长除以 Switching Step，采样步长和测量事件单独计算。Tektronix 安装和维护手册确认 SMU 可输出 V 或 I。连接后进一步用已核验的实装 SMU 上限检查，时间扫描硬件执行仍待核验。
- Node 224/224、原生插件与宿主契约、DKDS SDK 校验、运行时和 64 个布局用例通过。Chromium 在 1387×758、390×844 检查即时校验、运行按钮、自动保存、V/A 值隔离、手机键盘。桌面核对 DKDS 默认亮色、Aurora Pop 明暗及 Thin Glass 亮色。交付同 SHA 源码 ZIP 和 Core Pages，原生编译及 4200A 实机执行未纳入本轮网页验收。

## 2026-11-24 · V0.3.44 a224 · DC 扫描页标题对齐

- R-20261124-006。基线 GitHub main `095b40a603725a135882240f08c0ac9e9146090b`，沿用只读 DKDS `20f056851a61d2144e9524c3ed568628d4b8557c`。
- DKTS 派生主题 `tools/dkts-fspro-unit-theme.css` 只调整 DC 扫描页底部同排的三个 DKDS Panel 标题。原限值约 34.6 px，带新增按钮的变量、关联规格为 41 px。设定共同的 35 px 最小高度与 4 px 竖向内距，按钮保留 26 px 高度。该主题层超出插件 CSS-only 原位热更新白名单，递增应用版本，插件 0.8.30 沿用。
- Node 224/224、原生插件与宿主契约、DKDS SDK 校验、运行时、64 项布局检查通过。Chromium 在 1387×758 Aurora Pop 暗色及 1280×800 默认亮色下验证三处边缘对齐，390×844 验证堆叠等高、新增变量和关联规格可点击。交付同一提交的 Core Pages 预览与完整源码 ZIP。原生安装包和实机执行未纳入此次网页调整。

## 2026-11-24 · V0.3.44 统一 Core 发布

- R-20261124-007。用户授权编译已上线的 V0.3.44。发布源码继承已验收的 `d43c9b0199518c55076028077e54c56858613fb0`，本次提交只涉及统一构建分类、测试和交付记录。
- 日常网页先行推送，最终授权提交可以只有文档。统一工作流仍只执行显式标记的 main 提交，前端已同步、最终提交仅有交付记录时也会编译完整包。保留同一推送含 CSS 白名单改动时的热更新判定。
- Node 225/225，包括先推网页再授权构建的分类回归验证。已在上一节验证同一界面。以同 SHA 的 Actions、Pages `preview.json` 和 Release `PROVENANCE.txt` 对照发布结果。4200A 实机验收单独进行。

## 2026-11-24 · V0.3.45 a225 · 共享 TCP 会话与 4200A 自动核验

- R-20261124-008。以 V0.3.44 a212 发布提交 `59dd86f417e6f6c5f0d8b3d2b32c9ee47fec5a68` 为基线。DKTS 插件 0.8.31，沿用只读 DKDS `20f056851a61d2144e9524c3ed568628d4b8557c`。
- 原通信面板的裸 TCP 会话和 DKTS 验证会话互不相知。DKTS 暂存构建给通用通信面板增加本地会话能力及排他接管。顶部与底部复用同一条连接并同步断开，接管期间通用字节发送不可用。DKDS 上游及通用 TCP 传输实现均未改写。
- 顶部首次连接只填仪器地址，KXCI 默认 1225，网卡由系统自动选择。借用底部已有的默认端口或已知端点自动进行 KXCI 身份及模块核验。其他端口可用顶部显式验证。识别失败时保留仍可用的底部原始会话。普通设置留存已核验地址与序列号，重连核对身份，空闲时只读复核。仪器执行门禁、模块额定值、输出互锁与安全关断不变。
- Node 227/227、原生插件与宿主契约、DKDS SDK 校验、运行时和 64 个布局用例通过。Chromium 通过模拟局域网 TCP 网关验证两入口共用单 socket、自动读取身份与实装模块、序列号变化阻断、掉线、上下断开和重启持久化。普通 TCP 端口保持原始通信，显式验证错误设备时恢复通用模式。公开 Pages 与完整源码 ZIP 同 SHA 同步。安装包编译和真实 4200A 验证仍待另行进行。

## 2026-11-24 · V0.3.45 统一 Core 发布

- R-20261124-009。用户授权编译 V0.3.45。以已验收的 `a4a82f27cb54348dc13e0869edbc5f3e44fa29ce` 为源码基线，发布提交只补本次交付记录。
- 继承 Node 227/227、DKDS SDK 校验及浏览器模拟网关验收。使用现有最终授权触发规则生成同一提交的 Windows Portable、固定签名 Android APK、源码和 Pages。分别核对 Actions、Pages `preview.json`、发布 `PROVENANCE.txt` 与 SHA-256。真实 4200A 验收单独进行。


## 2026-11-24 · DC/I–T 基础执行适配（待审查）

- R-20261124-010。基线 49f952903020ccff7d69239be449f8cf98a78579。接通 DC 逐点电压源（Linear Step、Linear Points、List）与固定偏置 I–T 单事件主机计时，明确不支持 Optimized、Log、Generator、电流源、B 端、多段时间和多目标。IT1/2/3 映射；采样超窗停止，保留原始读数，不声称多样本平均。NUL 帧、ACK、错误查询及最近 256 条收发跟踪。Rev E 第 2/4/5 节；Rev F 无法读取，保持生产门禁。
- 执行 7 个适配函数独立断言（模型替身）。未运行全量 Node、SDK、TCP 回归或实机测试。未移动 main，未合并、编译；版本待获批准后统一递增。


## 2026-11-24 · KXCI 帧接收与状态检查（第二次待审查提交）

- 延续 c06ec851。固定 DKDS 上游仍为 20f056851；只在 DKTS stage 副本加入 Windows/Android 可选 NUL 帧接收，完整帧立即返回，不再强制等待 30/120 ms idle。半帧、同块额外字节、超时失败，不改变普通 TCP 模式。KXCI 身份、模块、测量请求携带 responseTerminator:nul，解析端再次验证帧。
- Rev E 第 2-10、3-3/4、4-2/3、4-6、5-39/40、5-45：启动前 SP 检查 Busy，EM 1,0 仅本会话切换 4200A 命令集，US/BC 后检查语法错误位，失败时取详细错误；每次关闭输出后复核 SP；未尝试输出的运行不冒充已关断，亦不关闭外部测试。GET 无错误返回格式未获实机确认；记录未知格式而非猜测。Rev F 官网当前 403，旧档案记录曾取到但未保存 PDF。生产输出门禁保持关闭。
- 实际运行 7 项基于固定上游完整源码的补丁锚点/结构断言；补充真实 TCP loopback 测试文件，尚未执行全量 Node、Kotlin 或实机验收。未合并、未移动 main、未编译。版本暂留 V0.3.45，待获授权合入后统一递增。


## 2026-11-24 · TCP 回环实测与 SMU 执行顺序复核（待审查）

- 将固定 DKDS 20f0568 的 Desktop exchange 函数原样取出，使用 363a5f8 的实际补丁函数，在 Node.js 22 独立 TCP loopback 环境实测：8/8 通过。旧路径 ACK 146.82 ms，新 NUL 路径 1.70 ms；分段响应跨 20 ms idle、重复帧、半帧超时、EOF、通用 TCP、空 NUL 帧和错误请求均通过。此处只测试提取的 exchange 函数，不代表完整 Electron 或 Android 工程通过。未连接真实仪器。
- 每次 DV/RI/RG 后立即查 SP，避免一次错误后继续输出其他端口；DV 改变后重新设置所选量程。默认积分显式 IT2，防止继承上一次 IT1/IT3。补充实际 DC 与 I–T 模型接入模拟仪器、Busy 不干扰外部测试及语法错误停止的集成回归用例。完整仓库无法拉取到本地（DNS 失败），新增集成用例尚未运行。Rev F 仍未恢复，生产输出门禁未解除。未合并、未编译、未创建分支。


## 2026-11-24 · 4200A 原生 System Mode 执行草案（R-20261124-011）

- 根据用户上传 Rev F 原件第 5-7/10/20–30/34/45–49/54–57 页，实现 Optimized DC 与单段固定偏置 I–T 原生任务：一次配置 DE/CH/SS/VR1 或 VL/VP/VC/ST/EC/SM/LI/MD；ME1 启动；SP 只用于状态查询，RD 有界预览，DO 最终列对齐及仪器时间戳。每周期单独 ME1。DC 线性 VAR1/VAR2 及单轴列表；固定偏置 I–T 用 WT/IN/NR。IN 是读数后等待，平均窗口非独立多次平均，不能保证原计划绝对周期或总时间，执行确认必须明确。点数 4096、VAR1 1024、VAR2 32、LI 6 依据手册。纯数字状态 unknown，不虚构 N；RD 时间戳零不冒充已采，最终 DO 可接受实际 0。原始设定值与实测列分开，真实输出仍需现场确认。加入现有 DKDS PlotView 的临时预览曲线，不建立历史伪数据。
- 关闭未使用的实际 KCon SMU/VM/VS 默认通道，ST1 自动 standby，EC1 限流退出，停止 ME4 后核对 Busy 并逐通道 CH 关闭。原生指令内部使用本次已校验任务的精确白名单。修复 SMU 数字最大 12 字符。未删除旧用户模式。Rev F 子集已核对；生产输出门禁仍未解除，不能称真实仪器可运行。独立执行实际编译/解析/模拟任务函数 11 项断言通过；未完成实际项目集成和真实 TCP/仪器、UI、Android 验收。未合并、未编译、不动 main 或 DKDS 上游。


## 2026-11-24 · 原生任务边界与旧时序兼容补充（review only）

- 新建 Time 使用 Native Fixed Bias：明确 IN 是读数后等待（含 0），WT/NR 由仪器执行；旧 Linear Step Plan 保留原语义，不自动将绝对采样间隔重解释为 IN。原生模式隐藏无硬件语义的平均窗口与规划步长；时间图仅示意偏置，最终用实际仪器时间戳。DC Optimized 的共享 Delay 只配置 DT，不凭空再添加 VAR2 独立延迟。4096 单次点数、32 VAR2、1024 VR 等手册限制独立于显示刷新。
- 处理 DO 列的空单元、末尾分隔符，保存已确认 RD 前缀作为中断原始数据；预览按循环和外层扫描分组，避免污染 DKDS 曲线缓存。新增集成 mock 更新及回归用例（本会话未实际运行完整仓库）。
- 将已核对的 SMU System Mode 子集的文档门禁与其他执行模式分离：仅此草案允许进入现有实际模块型号、额定值、互锁、独占租约、用户现场确认后的受控调试路径；不授权实际部署，不声明真实硬件已验收。其他旧模式和未核验高级功能门禁维持。未合并、未编译；完整 Node/SDK/Android 和实机必须在合入/发布前或受控调试版本中验收。


## 2026-11-24 · 实际源码级模拟集成验证

- 直接从 615d7f9 Git 树读取 8 个实际模块（hardware-capabilities、kxci-protocol、identity-core、measurement-plan、kxci-measurement、model、measurement-data、measurement-runtime），在独立 JS 运行环境装载原始源码，以模拟 KXCI TCP capability、DKDS DataTable/Artifact facade 和计时服务完成两种实际页面模型的完整调用链。20/20 断言通过。两种测试均通过实际模块识别、Scoped System Mode 预检，分别发送一次 ME1，RD 预览、DO V/I/仪器时间戳、Data Center canonical publish、CH 关断；没有 DV/TI 逐点输出。Time 测试 IN=0。此为真实源码的模拟集成，不是实机测试或完整 Node/SDK/Electron/Kotlin 构建。
- 补充零时间戳尾部截断和中间缺口拒绝逻辑，保留限流及真正的零值；对最终提交中的实际解析函数另执行 5 项断言通过。更新集成 mock 的第二 SMU 原始列和 scoped gate 回归。GitHub main 不变；无分支、合并、构建、发布。PDF 原件未上传至仓库。


## 2026-11-25 · 独立端口与 RPM 接线公共能力（待审查）

- Rev F 4-5、4-18、7-17、7-24、7-34、7-72：新增独立 PMU 双通道目录、systeminfo 查询和模块/附件校准日期展示；KCon 接线确认按仪器序列号、模块/附件标识绑定，拒绝重复 SMU、缺少 RPM、签名过期；不冒充物理接线或继电器状态可自动读取。保持 FS-Pro 原布局、共享端口映射，旧 PMU 卡级选项标为未检测到，不自动映射。接线保存不触发硬件切换。
- System Mode DC/固定偏置时间测试在 ME1 前检查 PMU 空闲，关闭对应 PMU 输出，ZE 后按已确认 RPM 路径切换 SMU；结束后关断 SMU、ZE，再恢复 Pulse。内部白名单限定任务指令。PMU 原生执行器和 AC/连接补偿的实际操作尚未实现。保留现有额定值和安全门禁；不得称实体继电器已读回确认。无合并/编译/发布，DKDS 上游不变。

- 本会话实际执行 13 项源码独立断言：端口目录、双路/单路、错误与更换设备后的失效、系统信息、指令顺序、双 RPM 模拟执行、PMU Busy 不触发输出；另对五个修改 JS 文件进行语法解析。未执行完整 UI/SDK、真实仪器或全量回归。

- 保持工程共享端口逻辑：Pulse 页面根据一次确认的 SMU↔RPM 接线自动解析为对应 PMU1-1/1-2，DC/Time 原 SMU 映射不变；显式 PMU 通道优先，旧卡级带独立 CH 值兼容。此为脉冲规划，不等于已实现脉冲输出。修复通用 PMURPM 返回的双 RPM 识别（以实际附件记录为准），接线配置必须具有真实附件序列号。将测试确认、时间参数标签改为测试语义而非 KXCI 指令名称。实际执行 7/7 条别名及附件身份检查，5 个修改 JS 文件通过语法解析。


## 2026-11-25 · DC 源模式与扫描方式扩展（待审查）

- 依据 Rev F 5-10、5-20–25，Optimized DC 使用 CH 电流源模式、IC/IR/IP/IL，保留独立电流设定值及电压保护，实装 SMU 额定值、功率包络及高压互锁校验；电流源固定电压档未接入。Log Points 按用户设定点数预生成列表，不改变仪器自主执行模式；支持单轴，非线性嵌套仍待核验。允许已映射 SMU 的多个 Outputs，实际仍回收全部活动通道 V/I，Target 自定义图轴/公式尚未实现。原始数据增加设定/实测电流列，UI 确认对话框不混淆电流和电压。
- 直接加载修改后的实际 model/plan/runtime/runner/capabilities/data，执行 11 项编译及数据单位断言；含 IR/IC/IP/IL、对数点数、中功率 SMU 越限、限压互锁。未执行实体仪器、完整 UI、宿主或全量回归。不合并、不编译。

- DC Strategy 复用原位置：Local Setting 用 Fast/Normal/Quiet 对应 IT1/IT2/IT3（Rev F 5-47），既有秒数作为 legacy 值保存，不静默换算；原生首点保持 HT 可配置；RS7 内部指定完整数据分辨率，不额外增加数字位数控件。RI/RV 仅证实立即选档，不冒充原生全程固定量程。实际源码 10 条断言通过，覆盖默认电压扫描、三档速度、Hold、旧值拒绝、原生电流任务模拟执行/数据单位、单 ME1；4 个修改 JS 模块语法解析通过。未运行完整 UI/真实仪器。


## 2026-11-25 · PMU 单通道原生任务（review only）
Rev F 7-7–10、7-14–26、7-31–39：单通道脉冲列/幅值扫描、Spot Mean 高电平、完整波形编译与执行。相对幅值转换绝对峰值；基线多点扫不静默改变语义。PMU 自主执行，完成关断后 128 点索引分块读取，保存 V/I/T/S 及实际电极；PMU Busy 拒绝、中止及输出关闭。连接管理、原生执行器、数据入库及 Pulse 预检接入。真实输出门禁关闭；多通道、同步 SMU、部分波形窗口、校准补偿未完成。实际源码 14 项断言和 6 文件语法检查；未全量回归、UI、实体仪器、编译或合并。

- PMU Data Center 原始列与历史 I–V/I–t/V–t 曲线适配，按脉冲实际通道保存，拒绝混合通道、不会冒充 transfer 或漏极列；保留现有 SMU 图。实际源码 9 项断言通过，使用 mock DKDS facade 而非宿主/真实 UI。运行前确认明确其他 SMU 输出关闭；真实 PMU 输出仍禁止。


## 2026-11-25 · 双通道 PMU / Pulse Xsweep-Psweep

- Rev F 7-28、7-37–38：在既有 Pulse Sweep 中增加可选 Psweep 端子（默认 None），支持独立幅值、基线、负载、电流档、电压档及边沿/窗口，周期、采样率、burst 全局共用。主通道 SWEEP、外层 STEP，单次 INIT/EXECUTE；独立采样预算和双通道机箱功耗。当前仅双路 Spot Mean；不假设波形同步索引、未实现多点基线或任意多通道。所有输出关闭后回收各通道，分别发布原始表，保留每通道原始点序与任务接收顺序。源代码 15 项断言、六 JS 文件语法解析；模拟两通道各12条，检查重复资源、共享周期、停止及原始表。真实输出门禁仍关闭；UI未渲染、宿主全量测试与真实仪器均未完成。

- 双通道异常回收修正：单通道实际点数不匹配不丢弃另一通道，保留已收原始记录并标记 partial，整体任务 failed；每通道关断失败独立处理，所有可用通道仍尝试关断。UI 主副端子互斥，旧卡级端口可独立选通道，状态文案不再限定 SMU。6 项实际源码断言通过（包括模拟 10+12 条记录及输出关断失败）。未进行实机/完整UI测试。


## 2026-11-25 · Segment Arb 单序列原生编译

- Rev F 7-41–61：Pulse 增加可选 Custom sequence，默认原有扫描不变。独立时序段起止电压、持续时间、测量窗口、重复次数、固定量程；3–2048 段，10 ns 分辨率，10 V 最短 20 ns、40 V 最短 50 ns；TIME 首数组 40 s，TIME:ADD 文档 1 s，分开处理；数组按128项分块，精确小数时间，不静默舍入。支持单序列硬件重复至 1e12、纯写入（无测量不造数据）、同一采集模式的可选测量段。确认 RPM、负载、功耗、实装量程；复用 PMU 原生启动/停止/分块读取/数据中心。当前单端子、单序列，不支持多序列列表/双通道/混合测量模式/HEOR 切换；Spot Mean 的 SARB 明确字段返回仍需 V1.14 实机核验，真实输出禁用。界面未实际渲染。15项真实源码断言（含原生循环、写入、时间网格、连续性、128项追加、采样边界），五 JS 语法解析。未合并/编译/发布。

- 修复测试方式切换：使用持久化 testMode 区分普通扫描与自定义时序，保留非活动模式的序列及 Psweep 参数，兼容初版 arb 配置；SARB 单独输出许可（默认关闭）；原始表增加 pulseProgram，区分脉冲扫描和任意时序。9 项源码断言（状态切换、普通编译、旧值兼容、原始来源、独立输出门禁）通过，六 JS 文件语法解析。未做实际 UI 验收。


## 2026-11-25 · Segment Arb 多序列组合
Rev F 7-59–61：保留单序列旧工程，新增有序序列列表，每个块独立循环；先定义全部序列再发列表（64对/批追加），只触发一次硬件执行。检查序列之间/内部连续性、单通道总段数、512序列、累计采样容量；精确 BigInt tick 总时长字符串。Pulse 自定义时序页面复用段编辑器、增加序列选择/增删，不改变主布局。12项实际源码断言通过，含写100次/等待/读5次、65序列追加、累计容量与旧工程；尚无实机/UI 渲染。未开放真实输出、未编译/合并。

- 双通道 Segment Arb 原生编译：各通道独立序列列表、循环、采样窗口、采集模式和量程，共用采样率；精确 tick 总时长一致才允许组任务，不自动填充等待；统一 INIT/EXECUTE，独立关断、回收和实际通道标记。可选第二端子及编辑端子选择沿用时序段编辑器。10项实际源码断言通过（包括 10 ns 时长不匹配、纯写入第二通道、双路数据）。同步物理精度、混合采集模式及完整 UI 未实机验收，输出许可仍关闭。


## 2026-11-25 · P0 基础扫描与采样
- DC Forward/Reverse 按原厂 VL/IL 列表执行，转折点仅测一次，单轴 4096 点限制，逐点模式亦可使用同一扫描序列；Optimized 嵌套双向仍不声称支持。原有 Strategy 控件用于两模式。
- Native Fixed Bias 支持 1–6 个不同测量信号，共用 WT/IN/NR，新增/删除信号，公共时间只编辑一次；保留全活动通道的原始 V/I。当前仍需要漏极 SMU、单段电压偏置。独立时钟、多段、电流偏置待完成。
- RD 预览显式不可用不打断最终 DO 回收；停止时 RD 前缀标记 partial，不冒充最终数据。9 项实际源码断言、4 个文件语法检查通过，未实机/UI/编译。用户要求优先 P0、暂缓派生模板已记录。

- P0 逐点原始数据：依据 Rev F 5-41/42，增加 TV 触发 ID 映射与严格返回解析，设定电压和实测电压分列；部分 TV 回读失败仍保存实际 TI 数据并标记 partial。逐点时钟明确为主机经过时间，不冒充仪器时间戳。SMU5–8 返回字母约定仍需旧固件实测，User Mode 真实输出门禁维持关闭。7项源码断言和3文件语法检查通过；未运行全套测试、UI或实体仪器。

- DC Target X/Y 直接映射实测列，新增页面专属 Target 图窗（沿用已有绘图引擎/图窗菜单），自动识别电压/电流源横轴，显式自定义信号可用，历史和实时同一映射，缺列不回退、空值不造零；轴单位与当前信号同步。公式/H/P 仍须留空且执行前提示，不冒充支持。8 项源码断言与 4 文件语法检查；TV 模拟回读 fixture 已更新，但未运行整个 Node 测试套件、UI 实际渲染或实机。

- Native Fixed Bias Time 现支持混合固定电压/电流源，每个电流源显式独立限压，映射 IC；当前电压测量自动档，原有电压源限流/档位语义不变。电流偏置列与原始电压读数区分，实际模块功率和互锁校验复用 DC。8项实际源码断言及3文件语法检查通过；多段/独立事件仍未执行，UI/实机未验收。

- Segment Arb 波形预览：使用同一时序校验器的精确 tick，按当前端子/序列单次循环绘制电压及采样窗口，不展开 1e12 次循环，也不冒充实测图；沿用已有 canvas 与主题/ResizeObserver 生命周期。修复旧双通道时序段编辑函数 current 变量遮蔽导致的编辑/新增异常。6 项源码断言，2文件语法检查；实际 UI 渲染尚未验收。

- P0 DC Generator：Rev F 5-10/13/14/18 的 VAR1'、RT、FS、CM 原生线性同步输出，安全解析仿射表达式（变量、scale()、getx()），不 eval；实际生成电平经 SMU 功率/保护/互锁检查，确认窗口含 Generator 峰值。当前只核验电压线性 Xsweep；任意非线性/getp()/列表/双向组合明确拒绝，不静默转换。9 项源码断言、5 文件语法检查，未实机验收。

- P0 Pulse：Rev F 7-33 原生多点基线扫描（固定绝对峰值），旧单点相对幅值保留语义，多点旧方案须明确峰值；检查全基线/峰值的负载及电压跨度。7-16 主通道固定/最低自动/Auto 电流量程，7-36 波形前后采样比例及完整采样预算。第二通道仍固定/Auto，双路波形和外层基线尚未开放。9 项源码断言及4文件语法检查；无实机验收。

- P0 通用 Routine 原生顺序联合任务：执行前整流程预检及逐阶段许可、同一独占租约、全部阶段按工程顺序/流程循环执行；原生任务之间关断，失败/取消不继续；每阶段独立原始表、流程循环/阶段/全局点序及原本 PMU 通道元数据。现有 Routine 菜单加入执行/停止入口，不建派生页面。明确不保证跨阶段偏置连续或同步。9项源码模拟断言、4文件语法检查，含 SMU+PMU 两轮、关断失败禁止下一任务及实际 PMU 门禁。未实机/UI/全套回归。

- DC B 端接入原生 Optimized，完整四端资源互斥、实际模块能力与功耗校验、B 源与目标原始值。原厂 LI 最多六个测量函数：三活动 SMU 全部 V/I；四活动 SMU 优先保留漏极 V/I、各活动源保护相关读数及用户 Outputs/Target X/Y，超六项明确拒绝，未采集的列留空。逐点 B 及 Time B 未开放。8项源码断言、4 文件语法检查，未实机。

- P0 Time 增加 Native Bias List：每段独立偏置及读数数量、共同稳定等待 DT（不是准确采样周期）、每点实测信号与仪器时间戳，保留旧绝对时间计划不静默转换。Rev F 5-14/21 主/从列表（VL/IL，最大 4096 点），检查全部各端电平、保护与互锁；数据保留 timeSegment，预览按点序而非伪时间。单变动端原生列表，多个变动端生成主从列表但单独门禁关闭，待实机验收。独立事件时钟仍未实现。10项实际源码断言和7文件语法检查，未渲染/实机/全量回归。

### P0 Target 与曲线分组
- 接入 `set name=expression` 的逐点数学子集、别名及 X/Y 表达式，原始数据不修改；依赖信号参与采集校验。历史和实时绘图使用同一解析器，缺失/非有限结果不画点。H 第二输出轴、P 筛选、向量函数及派生 CSV 尚未验收。
- 历史曲线按实际 cycle/pPoint/pRepeat/xRepeat 分组，避免跨循环连线。完成 14 项源码断言；未进行整包构建或真实仪器测试。

- P0 Pulse Psweep: Rev F 7-29 native STEP:PULSE:BASE, independent absolute peak and range policy. Rev F 7-31/33 permits equal point counts for multi-channel sweeps; waveform mode compiles paired same-length sweeps or a companion train, never a waveform STEP:PULSE:BASE. Shared acquisition clock parameters, independent timings and raw channels. 10 assertions passed in source harness; existing PMU output gate remains closed until controlled hardware acceptance.
- P0 Generator: safe AST evaluation of nonlinear scalar functions and getx()/getp() using precomputed native master/subordinate VL/IL lists; affine linear VAR1' preserved. Nested scan flattened P-major, actual rows retain original X/P point index and planned P value. Limit checks on every generated output. 4096-point native list boundary, multi-channel output gate retained. 10 source assertions.
- P0 Target：H 表达式参与采集依赖检查，保留独立 Target H 图窗及完整计算导出；当前 DKDS ScientificPlot 单 Y 轴限制，不修改 DKDS，不声称同图双 Y 轴。P 输入采用逗号分隔设定值（不是按实测噪声值筛选），应用到实时/历史/计算导出，原始表不变。9 源码断言。