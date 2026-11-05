# DK Test Studio ↔ DK Data Studio 互操作设计契约

## 必须保持的不变量

1. 单一源代码：`src/shared/*.js` 是唯一 KXCI 协议、身份状态机、测试规划与波形校验实现。Node 包装层通过 CommonJS 转发；`tools/build-dkds-plugin.cjs` 复制同一份字节到 `.dkplugin`。严禁为两个程序各自另写测试核心。
2. 宿主适配而非平台耦合：独立版在 Node/Electron 中使用 TCP；插件版使用 `ctx.services.require('tcp')`、`ctx.ui.*`、`ctx.project`、`ctx.capabilities`。共享领域模块不直接依赖 Electron、DOM、React Native 或 DKDS Core。
3. 插件必须作为独立外部插件安装，禁止覆盖 DKDS 内置的 `com.dkds.keithley-4200`。独立插件 ID 为 `com.dkts.keithley-4200`，工作区和项目切片均为 `dkts-keithley-4200`，能力为 `instrument.dkts-keithley-4200`，Plugin API 为 `1.19.0`，当前开发插件版本 `0.6.14`。保留 `dkts.4200.interop.v1` 交换格式及旧 `com.dkds.keithley-4200` 方案导入兼容；旧项目中的 `plan.mode` 在导入时转成新的 `plan.kind`，不擅自更改实验参数。DKDS 原有项目切片不自动覆盖或迁移。
4. 稳定的方案交换格式：`dkts.4200.interop.v1`。导出和导入都强制 `executable:false` 与 `hardwareVerified:false`，不允许通过导入配置触发硬件动作。未来新增数据格式必须版本化，并保留原始仪器数据、派生数据及仿真数据的独立来源标识。
5. 统一的仪器安全边界：目前真实设备只发送固定只读命令：`*IDN?`、`*OPT?`，以及 `UL` 模式下的 `EX SystemUtil instrumentinfo(,4096,)`、`GN result`、`EX SystemUtil remotemoduleinfo(,4096,)`、`GN result`，最后以 `DE` 恢复 KXCI 系统模式。Android 原生桥接只允许这些精确字节序列；SMU/PMU 产生电压的执行层不开放。未来任何输出必须统一通过同一硬件能力验证、状态机、限流、紧急停止与故障关闭流程，不能为 DKDS 插件增加旁路。
6. 同一仪器只能有一个控制者：当前两个应用都是独立 TCP 客户端，严禁同时连接同一台 4200A 进行操作。实时互联需要未来统一的仪器 Broker，包括会话租约、用户鉴权、独占锁、失联停止和日志审计。
7. 发布前兼容性验证：每次修改 shared core 均运行 Windows/Ubuntu Node 测试、模拟 DKDS 插件激活测试、DK Data Studio SDK 1.19 验证与官方 `.dkplugin` 打包；SDK 通过不能代替真实 DKDS 中的插件安装与设备验收。

## 验证和构建

运行 `npm test` 验证独立协议、模拟硬件接口、数据规划、共享模块与插件激活。
运行 `npm run plugin:build` 在 `dist/dkds-plugin` 临时目录按同一源码生成插件，并生成候选 `.dkplugin`。
GitHub Actions 的 `DKDS Plugin API 1.19 compatibility` 任务会从 DK Data Studio 的 `4200` 分支读取官方 SDK，运行 `sdk/tools/dkds-plugin.js validate` 与 `package`，将通过校验的插件包上传为 `DK-Test-Studio-DKDS-Plugin` Artifact。

## 4200A 数值保护（v0.3.12 / plugin 0.6.14）

- SMU 电压规划上限按 4200A 规格采用 ±210 V；该值是最大规划边界，不表示任意电压/电流组合均安全。
- 4225-PMU 与 4220-PGU 波形规划边界按所选 10 V/40 V 量程及 DUT+互连总负载阻值计算。按 4200A 数据表的 50 Ω 源阻抗，`Vmax = Vrange × Rload / (50 Ω + Rload)`，`Imax = Vrange / (50 Ω + Rload)`。例如 40 V 档、50 Ω 负载时，最大输出约 20 V/400 mA；10 V 档、50 Ω 负载时约 5 V/100 mA。未填写有效负载阻值时拒绝校验。
- SMU 电流限值按每个输出通道的物理功率类别、电压档和额定输出功率共同计算。中功率 SMU 的额定输出功率为 2.1 W，高功率 SMU 为 21 W。200 V/20 V 是标称电压档，量程可扩展至 105%，但电压与电流的最大值不能脱离额定功率同时取最大值。例如，中功率 SMU 在 200 V 时最大限流为 10.5 mA，在 210 V 时受 2.1 W 功率边界限制为 10 mA；高功率 SMU 在 200 V 时为 105 mA，在 210 V 时为 100 mA。若同时启用栅极 SMU，源通道与栅极通道分别计算。未知物理型号不套用猜测的中/高功率限值。
- 所有数值校验只生成不可执行方案。硬件执行前仍必须依据真实插槽、模块型号、工作象限、所选电流档位和设备 interlock 重新验证；目前没有开放 SMU/PMU 输出命令。
- 4200A 能力数据唯一来源为 `src/shared/hardware-capabilities.js`。运行 `npm run hardware:export` 可生成 `DKTS-4200A-Hardware-Capability-Database-v1.json`，并作为完整 Release 的独立资产发布。数据库同时记录 *OPT? 类别、SystemUtil 物理模块识别规则、参数边界、来源手册和安全策略。
- `*OPT?` 中的 `HPSMUPA`、`PMU1RPM1-2` 等类别直接用于选择数据库额定值；具体 4200/4201/4210/4211 型号及校准信息由 `instrumentinfo` 补充。CVU 变体必须由物理型号确认，不擅自选择 4210-CVU 或 4215-CVU 的专属 AC 驱动规格。
- PMU/PGU 的硬件规划上限为 Segment Arb 每段 20 ns 至 40 s、每通道最多 2048 段、每通道最多 512 个序列、序列循环上限 10^12，分段时间分辨率 10 ns。PMU 硬件采集上限为 200 MSa/s、每个 A/D 每次测试严格少于 1,000,000 点。
- 当前 KXCI 命令路径另有接口边界：Segment Arb 单段时间上限 1 s，数组命令每次最多 128 个值，PMU 数据缓冲每通道最多 65,536 点。能力数据库分别保存硬件极限和 KXCI 接口极限，波形规划按硬件规格校验，并单独标记当前接口不兼容的方案。
- PMU 电流量程按是否安装 RPM 分开：无 RPM 时，40 V 档为 10 mA、100 mA、800 mA；安装 RPM 后，10 V 档为 100 nA、1 mA、10 mA、100 mA，40 V 档为 1 mA、10 mA。RPM 的最小脉冲宽度、测量窗口和跳变时间按量程提供厂商典型值，仅作为性能建议，不冒充硬件硬限制。
- 机箱功耗按 KXCI 手册的 500 W 公式计算；模块清单或活动通道不完整时，功耗状态标记为未知，不将未知模块功耗视为零。
- 数据中心发布接口收到调用方传入的数组时标记为未验证导入数据，不再自动标记为原始仪器采集数据。只有未来真实采集执行器提供可信采集凭证后，才允许标记 rawInstrumentData:true。

## DKDS 原生宿主集成（plugin 0.6.14）

- 插件工作区不再声明独立图标和窗口标题，连接状态通过 `ctx.ui.statusBar.add()` 注册到 DKDS 状态栏。
- 插件能力提供 `publishMeasurement()`，把调用方提供的 X/Y 数组写入 `ctx.data.model.createTable()` 创建的 DataTable，再通过 `ctx.data.artifacts.upsert()` 发布到 DKDS canonical Artifact Store。
- 调用方数组当前标记为 unverified-import，不伪装成原始仪器数据。真实采集执行器尚未开放。
- 数据中心发布接口已具备，但当前版本尚未开放真实测量执行器，因此不能把该接口的测试通过描述为已完成实机数据采集。

## 未完成的无缝联动内容

插件安装、真实 TCP 连接、Android 宿主仍需实机验收；跨程序实时控制、实验数据同步、原生文件及仪器图片导出尚未完成。请勿把 SDK 兼容视为完整功能验收。

## 单源界面架构（DKDS 插件 v0.6.14）

DKDS 插件不再自建测试卡片、参数区和空白曲线视图。构建时从 `web/index.html`、`web/styles.css`、`web/app.js` 以及独立版的 D3 运行时直接生成 `standalone-shell.js`。DKDS 页只负责宿主窗口/工作区生命周期、项目状态、能力注册和受限桥接。iframe 使用 `sandbox=allow-scripts allow-modals`（不授予 `allow-same-origin`），不允许浏览器直接访问设备、文件系统或第三方站点。桥接白名单仅提供与独立版 `/api/` 相同的只读连接、模块查询、方案校验、波形校验。原始数据图、标签、设置面板和移动端手势都来自同一套 App 代码。纯安装器和原生更新按钮在 DKDS 宿主不执行，因为插件由 DKDS 插件管理器升级。

唯一源代码原则适用于 UI 和业务逻辑：新界面需求首先改独立 App 的共享 Web 资源，再通过插件包构建同步。两端不得引入单独的测试页面实现。


### v0.6.1：DKDS 宿主兼容性与项目保存

- iframe 沙箱仍保持 opaque origin，不授予 `allow-same-origin`；增加 `allow-modals`，使独立 App 原生连接/日志 Dialog 在插件中可用。
- 页面结构改用官方 Unit Template 的 `page → layout host → workspace → layout primary` 组合，尺寸由 DKDS DOM/Style Gate 接口管理。
- 表单输入只更新内存草稿；仅完成的方案字段变更、测试类型/工作区标签切换触发项目捕获。连接参数变更不会写入 DKDS 项目。


### v0.6.2：修复 DKDS 外部插件重复模块注册

- 根因：DKDS 的 `DKDSPluginModules` 注册表按宿主进程存活，外部插件包被替换时，旧版本的模块定义不会自动清除。重新加载同一插件 ID 时，`define` 因模块名已存在而抛出 `Plugin module already defined`，并可能连带使自动回滚失败。
- 修复：外部插件包中的每个 DKTS 模块注册均显式传入 `{replace:true}`。该选项只替换同一插件 ID 所拥有的同名模块，不改变模块命名空间或业务逻辑，可兼容尚未提供模块所有者清理接口的 DKDS 宿主。
- 新增回归测试：在同一 DKDS 模块注册表中连续加载两遍完整模块包，验证第二次加载可安全替换旧定义。
- 独立 App 版本升至 `0.2.9`，Android `versionCode` 升至 `10`；DKDS 外部插件版本升至 `0.6.2`。


### v0.6.3：DKDS 项目级工作区存储

独立 UI 使用经会话令牌和白名单隔离的 /api/workspaces 读写插件项目切片。保存数据包含每个工作区按测试方式分类的原始数据和历史记录。项目关闭、打开或重置时，插件会将对应工作区状态通知嵌入式独立 UI。独立 App 升级到 v0.3.1；外部插件升级到 v0.6.3。


## v0.3.12 能力数据库与统一校验

- 能力数据库由共享模块驱动，Windows、Android、DKDS 三端调用同一校验逻辑。
- 未识别 SMU 不再套用 10.5 mA 默认上限。未识别数值保持未知，方案仍不可执行。
- I–t 的 KXCI 采样间隔按 10 ms 至 10 s 校验；SMU 列表扫描最多 4096 点，往返扫描还需计算两个方向的总点数。
- SMU 200 V 档标记为需要 interlock。当前只读通信桥不能读取 interlock 状态，因此高压方案不会被标记为硬件已验证。
- 调用方提交的数组不会被标记为原始采集数据。
