# DK Test Studio ↔ DK Data Studio 互操作设计契约

## 必须保持的不变量

1. 单一源代码：`src/shared/*.js` 是唯一 KXCI 协议、身份状态机、测试规划与波形校验实现。Node 包装层通过 CommonJS 转发；`tools/build-dkds-plugin.cjs` 复制同一份字节到 `.dkplugin`。严禁为两个程序各自另写测试核心。
2. 宿主适配而非平台耦合：独立版在 Node/Electron 中使用 TCP；插件版使用 `ctx.services.require('tcp')`、`ctx.ui.*`、`ctx.project`、`ctx.capabilities`。共享领域模块不直接依赖 Electron、DOM、React Native 或 DKDS Core。
3. 插件必须作为独立外部插件安装，禁止覆盖 DKDS 内置的 `com.dkds.keithley-4200`。独立插件 ID 为 `com.dkts.keithley-4200`，工作区和项目切片均为 `dkts-keithley-4200`，能力为 `instrument.dkts-keithley-4200`，Plugin API 为 `1.19.0`，插件版本 `0.6.2`。保留 `dkts.4200.interop.v1` 交换格式及旧 `com.dkds.keithley-4200` 方案导入兼容；旧项目中的 `plan.mode` 在导入时转成新的 `plan.kind`，不擅自更改实验参数。DKDS 原有项目切片不自动覆盖或迁移。
4. 稳定的方案交换格式：`dkts.4200.interop.v1`。导出和导入都强制 `executable:false` 与 `hardwareVerified:false`，不允许通过导入配置触发硬件动作。未来新增数据格式必须版本化，并保留原始仪器数据、派生数据及仿真数据的独立来源标识。
5. 统一的仪器安全边界：目前真实设备只发送 `*IDN?` 加 NUL；SMU/PMU 产生电压的执行层不开放。未来任何输出必须统一通过同一硬件能力验证、状态机、限流、紧急停止与故障关闭流程，不能为 DKDS 插件增加旁路。
6. 同一仪器只能有一个控制者：当前两个应用都是独立 TCP 客户端，严禁同时连接同一台 4200A 进行操作。实时互联需要未来统一的仪器 Broker，包括会话租约、用户鉴权、独占锁、失联停止和日志审计。
7. 发布前兼容性验证：每次修改 shared core 均运行 Windows/Ubuntu Node 测试、模拟 DKDS 插件激活测试、DK Data Studio SDK 1.19 验证与官方 `.dkplugin` 打包；SDK 通过不能代替真实 DKDS 中的插件安装与设备验收。

## 验证和构建

运行 `npm test` 验证独立协议、模拟硬件接口、数据规划、共享模块与插件激活。
运行 `npm run plugin:build` 在 `dist/dkds-plugin` 临时目录按同一源码生成插件，并生成候选 `.dkplugin`。
GitHub Actions 的 `DKDS Plugin API 1.19 compatibility` 任务会从 DK Data Studio 的 `4200` 分支读取官方 SDK，运行 `sdk/tools/dkds-plugin.js validate` 与 `package`，将通过校验的插件包上传为 `DK-Test-Studio-DKDS-Plugin` Artifact。

## 未完成的无缝联动内容

插件安装、真实 TCP 连接、Android 宿主仍需实机验收；跨程序实时控制、实验数据同步、原生文件及仪器图片导出尚未完成。请勿把 SDK 兼容视为完整功能验收。

## 单源界面架构（DKDS 插件 v0.6.2）

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
