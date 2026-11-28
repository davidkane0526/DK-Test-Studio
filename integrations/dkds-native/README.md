# DKTS 4200A · 原生 DKDS TOP 工作区（外部插件原型）

此目录不是 `src/plugins/`，因此不会让 DKDS 再内置一个 4200A。它是按 Plugin API 1.19 编写的外部 `.dkplugin` 来源，插件 ID 沿用现有 DKTS 的 `com.dkts.keithley-4200`，未来通过插件管理器升级原版本，而非并列重复安装。

- DKDS 原生 Activity、TOP、PRIMARY（科学绘图）及 PRIME（参数、端口），而非 iframe 或独立 CSS 外壳。
- 使用 `ctx.ui.unitTemplates` 和 DKDS 科学曲面：主题与控件视觉由 DKDS 统一提供，不叠加私有点击阴影。
- 数据源来自 `ctx.data.sources.list()` 和 `ctx.data.artifacts.get()`。数据中心、分组图标题、历史、AI、SMB、网页服务及内存由 DKDS 宿主维护。
- `ctx.state.create(...,{projectSlice:'settings'})` 用于项目持久化，`ctx.project.capture()` 记入宿主历史。
- 10 种离线测试页面、参数组织和端子映射；**None 不显示在参数面板**。
- Core 原生工作区已接入 DKDS `network.tcp` capability、4200A 身份/模块核验、DC SMU KXCI 运行时、显式启动确认、安全停止和原始 TI 行 Data Center 发布。门禁分两路：用户模式逐点 `DV/TI` 受 `safetyPolicies.kxci.allowInstrumentOutput` 控制，当前为 `false`；Optimized DC（System Mode，`ME1` 原生任务）受 `smuSystemModeManualVerified` 与 `allowSystemModeOutput` 控制，当前均为 `true`，在模块身份/额定值核验通过且不需要高压互锁（≤ 21 V）时允许受控实机输出（R-20261128-001）。标准 PMU 脉冲与 Segment Arb 已开放受控实机验收（R-20261128-008）。实装模块、接线和额定值核验通过，方案峰值不超过 21 V，且操作员确认后才会出源。多通道 SMU 原生列表仍关闭。此外 DKDS Plugin API 1.19 的 `ctx.ui.dom.timeout()` 是受生命周期管理的定时接口；插件通过它实现逐点 DV/TI 延时，停止时取消待执行 timer，不创建 raw timer。
- 同源浏览器预览使用同一插件源，但浏览器没有 Electron IPC，不能实际连接仪器或执行测量。
- 当前运行器为主机逐点 `DV/TI` 模式，不等同于仪器内部扫描；在完成 KXCI Rev F 命令核对前，不得宣称可达到 20 ns 硬件扫描速度。

验证：`node sdk/tools/dkds-plugin.js validate tools/4200a/dkds-native-workspace`。
打包：`node tools/build-dkds-native-plugin.cjs`，输出 `dist/DKTS-4200A-native-v0.8.44.dkplugin`。

## v0.8.2：FS-Pro 风格离线 X/P 双层扫描草稿

- 独立配置 Xsweep、可选 Psweep、各轴重复次数、整体循环与各段起止/步长/量程/点间延迟。
- 新项目与既有 schema 1 项目可以迁移至带有 sweep 字段的状态；编辑始终返回新快照。
- 降序步长、非法数值、过限源量/量程及同一 SMU 重复分配由模型拒绝；总点数仅做离线预览。
- 仅真实分配的 SMU 端口进入参数编辑器，全部控制使用 DKDS Core 的 Unit / PRIME / TOP / PlotView。
- 本版本不能将计划解释为经过现场硬件认证的指令，也不会通过插件执行 KXCI 输出。

## v0.8.2：全范围预览与精确 KXCI 规划契约

- 使用覆盖前、中、尾的有界分段列读取，最多读取每列 65,536 条，避免大数据集仅显示开头的误导性曲线。
- 绘图附有 totalRows、readRows、coverage 和 windows 元数据。预览并不构成原始数据的完整重采样或真实输出。
- 扫描段端点必须被步长准确覆盖。单点段要求 0 步长，每段最多 4,096 点，延迟 0–6553 ms。
- 同一个 ID 的 v0.6.18（兼容旧插件）和 v0.8.2（原生 Core 插件）互斥，不可同时安装；旧插件仍承担原有功能，v0.8.2 继续禁止未经实机验收的 KXCI 输出。

## v0.8.3：原生 UI 紧凑化与重复端口入口清理

- 端口映射仅保留 Page 顶部 Terminal 区，不再同时创建重复的可停靠 PRIME。
- Xsweep/Psweep 改为统一六列扫描段编辑行，桌面/平板单行显示，窄屏按两列/单列重排。
- Project Explorer 明确高亮当前 Routine 与 Page；参数编辑继续由 DKDS Unit、Tabs、ScientificPlot 和 PlotGroup 提供。
- 仅调整 DKTS 插件及其作用域布局，不修改 DKDS 上游。

## v0.8.3：Project Explorer 与扫描参数密度优化
- Project Explorer 增加可直接创建页面的 Test Library，覆盖十种测试类型；取消原来的“下拉选择类型 + 加号”两步入口。
- Routine 显示页面数，Page 显示测试类型；编辑页标题显示 Device/Routine 上下文。
- Xsweep/Psweep 显示列标题和紧凑连续编辑行，扫描摘要使用 DKDS Summary/Metric Units；新增扫描段操作放入对应面板标题栏。
- 主侧栏宽度与 900px 响应式断点由 DKDS Unit Layout 管理，DKTS 样式不再强制覆盖 Core 网格。
- 仍由 DKDS Core 管理控件、主题、绘图、数据中心和滚动；真实硬件输出仍禁用。


## v0.8.4：恢复 FS-Pro Edit Page 层级
- 主标签收敛为 Sweep / Target / Strategy；页面名称与备注移至标签上方的 Info 区。
- S/D/G/B 端口下拉框集成到 Page 标题工具栏，按 Source / Drain / Gate / Body 排列，并与页面操作使用 Core Divider 分隔；不再保留独立 Terminal 卡片。
- Limits、Page Var、Associate Spec 作为 Sweep 底部响应式三栏，不再占用一级标签。
- Project Explorer 的十种测试类型改为单一“＋ Page”菜单，减少常驻按钮与侧栏拥挤。
- 保持 DKDS Unit、主题、PlotGroup、PlotView 和 Data Center 所有权；不修改 DKDS 上游。


## v0.8.5：端口角色整合与移动端标题栏压缩

- 移除 Sweep Setup 中重复的 Xsweep/Psweep 物理端口选择器；在每个已分配 SMU 的端口行直接指定固定偏置、Xsweep 或 Psweep 角色，角色互斥仍由项目模型校验。
- 桌面和平板保留标题栏 S/D/G/B 选择器；手机窄屏以单一“端口”按钮打开 Core Popover，在同一事务中编辑四个逻辑端口并统一应用。
- Project Explorer 使用 DKDS `sidebar-main-compact` 标准 235px 布局；900px 以下由 DKDS Unit Layout 切换为单列导航抽屉。
- 统一中文页面信息、测试类型、端口设置、扫描概览、限值、页面变量、关联规格、测量目标和扫描策略标题。
- 四个独立绘图窗口的内容比例调整为 2.25:1，内容高度限制 132–220px；外层图窗最小高度同步降低，减少 1200×768 桌面下的纵向溢出。
- 真实 Electron / Android 截图仍需在具备 SDK 的 CI 环境中完成；本版本不宣称已通过视觉截图验收。


## v0.8.6：Sweep 下方信息密度与 Target 端口可用性

- 扫描点数改为 DKDS Summary strip，减少四个独立 Metric 卡片的纵向占用。
- Sweep 下方改为 DKDS `two-card-grid`：Limits 独占一列，Page Var 与 Associate Spec 纵向组织在另一列；窄屏由 Core recipe 自动收敛为单列。
- Limits 按已分配端口分组，档位模式、测量档位与限流/限压使用紧凑双列表单。
- Page Info 不再重复显示标题栏已有的只读测试类型。
- Target 端口选项只列出已分配 SMU；全部 None 时禁用端口选择，不将 None 暴露为可选参数。
- Psweep 关闭时禁用 Psweep 重复次数输入。
- 继续使用 DKDS Core Unit/Theme/PlotView/Data Center，不修改 DKDS 上游。

## v0.8.7：图窗工具栏与响应式编辑体验

- PlotView 标题栏图形类型改为 DKDS 原生 Action Menu，可选择 I–V、转移特性、I–t、原始数据表；当前类型有选中标记。
- 数据源及原始 CSV 导出仍使用独立的 Data Center `数据` 菜单，不混用抽稀绘图数据。
- 980px 及以下的 Page 标题栏使用已有 `端口` Popover，四端口仅一次事务保存；桌面宽屏保留 S/D/G/B 横排。
- 数值及页面名称/备注只有发生变化才提交，变量单位输入改为失焦提交；去除扫描概览中多余的常驻提示。
- `tools/native-ui-geometry-fixture.py` 可进行离线 CSS 断点验证，**不代表真实 Electron/Android 截图**。


V0.3.24 起该插件通过 DKDS `network.tcp` capability 建立 4200A 连接，身份和物理模块核验后才可生成测量预览。写入类 KXCI 命令必须读取并验证 Ethernet `ACK\0`。实际输出受 `safetyPolicies.kxci` 门禁控制：用户模式 `allowInstrumentOutput=false`，禁止逐点实机输出；System Mode 的现状见上文（R-20261128-001）。


## v0.8.11：Core 原生 KXCI 通信与执行安全门禁

- 接入 DKDS `network.tcp` capability 和 `builtin.connectivity-center` 依赖；连接设置支持 IP/端口/预期序列号/网卡/本地地址。
- 身份核验接受 `KEITHLEY INSTRUMENTS,KI4200A,...` 与紧凑 `KI4200A,serial,version` 两种 4200A 返回形式。
- 所有 KXCI Ethernet 写入命令必须读回并验证 NUL 终止 ACK；不允许 `noReply=true` 遗留响应字节污染下一条 TI。
- Page 标题栏加入连接/设置和开始/停止。运行器将原生 Page 映射到 Xsweep/Psweep KXCI 规划，用户显式确认后才会尝试输出；完成/停止/异常后尝试关闭活动 SMU，并把实际 TI 原始响应及逐点数据发布到 DKDS Data Center。
- 此条为 v0.8.x 当时状态；现行门禁见文首（R-20261128-001）。


## v0.8.12：DKDS 生命周期定时服务与安全停止

- 依赖 `ui.dom`，使用 DKDS `ctx.ui.dom.timeout()` 执行扫描点延迟；不在插件中创建 raw timer。
- 停止操作会取消等待中的 DKDS timer，再按逆序关闭活动 SMU 并确认每条 Ethernet ACK。
- 未提供生命周期定时服务的宿主会拒绝启动需要延时的逐点测量。
- 用户模式输出仍为 `allowInstrumentOutput=false`；System Mode 现行门禁见文首（R-20261128-001）。模拟 TCP 测试不能替代实机验收。
