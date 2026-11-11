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
