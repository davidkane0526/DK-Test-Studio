# DK Test Studio

**独立的 Keithley 4200A-SCS 科研测试工作台**。与 [DK Data Studio](https://github.com/davidkane0526/DK-Data-Studio) 分离开发，目标是逐步承担 Clarius 的日常测量工作界面。保留仪器 KXCI、原厂驱动及必要的硬件配置环境。

## 当前实际能力：v0.1（只读预览）

- 独立 Windows Electron UI，以及仅监听 `127.0.0.1` 的本机浏览器工作台。
- 打开工作台自动尝试连接，Windows 原生窗口采用**无边框（frameless）设计**，不显示系统顶部最小化/最大化/关闭标题栏。应用顶部采用约 43px 的**可拖动自定义标题栏**，左侧放 DK Test Studio 图标、应用名称、UI 热更新版本，右侧放 Windows 最小化、最大化/还原、关闭控制。底部**另设独立约 29px 的状态栏**，只显示运行消息和**唯一的仪器连接状态按钮**（连接变化写入消息历史，但不重复覆盖左侧消息）；点击消息可查看最近 30 条会话日志，点击连接状态可查看诊断和设置。浏览器和独立 Android 版同样显示两条紧凑栏，但隐藏 Windows 专属窗口控制。弹窗关闭时无需进行任何手动操作。
- 从原项目 `4200` 分支迁移 TCP 网络适配器：自动网卡、以太网、Wi-Fi、指定网卡/源地址；超时和详细日志隔离。
- 真实仪器只发送硬编码的只读 `*IDN?\0` 与 `*OPT?\0` 查询，验证设备型号和序列号。**没有 SMU/PMU 输出、扫描或原生文件导出**。
- 连接后自动查询 KXCI 的 `*OPT?` 装机模块列表，识别 SMU、PMU、CVU、PGU 类别；这**不代表已经验证模块额定电压、电流、时间分辨率或接线**。
- **测试方式采用真正两级界面**：首页只显示测试类型卡片，点击后整页隐藏选择区，切换到独立测试工作区，仅保留测试名称与返回入口。参数区采用可一键收起的紧凑侧栏，数据读取、图表与原始数据表尽可能使用整页宽高。桌面端无固定顶部状态栏，绘图区随剩余垂直空间扩展。桌面四列、窄屏至少两列，DKDS 插件同样使用二级页面与返回导航。I–V/I–t 的参数规划可用，任意波形可校验输入，其余测试只显示待开发配置占位。**实测读数和实测绘图均保持空白，绝不以模拟曲线冒充仪器数据。**
- SMU I–V 与 I–t 的独立测试方案编辑、循环次数/通道/规划电流限值配置、扫描点序列预览（仅规划，不发送输出）。
- 可粘贴两列时间(s)、电压(V)，做严格递增检查、纯软件方案验证和本机波形预览。**预览不是仪器测量，也不证明硬件能执行该时间尺度**。
- 自动化测试含伪 4200A TCP 服务、身份校验、HTTP 安全边界、任意波形规划。

## DK Data Studio 插件兼容

**核心逻辑始终共用一份源码。** 独立 Windows 版和 DKDS 插件版通过各自宿主的 TCP/UI 接口，调用 `src/shared/` 中相同的 KXCI 身份协议、连接状态机、I–V/I–t 方案和任意波形规划。外部插件沿用原有 `com.dkds.keithley-4200` ID，以 `0.4.3` 版本覆盖内置基线 `0.3.0`，目标 API `1.19.0`。

执行 `npm run plugin:build` 可生成 `.dkplugin` 候选；GitHub Actions 另用 DK Data Studio 现有 SDK 验证并生成正式插件 Artifact。插件支持原有 `keithley-4200` 工作区入口和项目切片，但**尚未在真实 DKDS 客户端及 4200A 仪器上验证安装与运行**。在开发完成仪器独占 Broker 前，不允许独立版和插件版同时控制同一台仪器。

详见 [互操作契约](docs/DKDS_INTEROP.md)。

## 独立 Android APK（开发预览）

`android/` 包含 **DK Test Studio 自己的 Android 原生应用**。它不依赖 DK Data Studio，也不需要安装 DKDS 插件。
Android 使用本机 WebView 工作台、独立原生 Java TCP 网络桥接（可绑定 USB Ethernet / Wi-Fi Network）和与 Windows / DKDS 插件 **字节完全一致** 的 `src/shared/` 协议及测试规划核心。当前安全边界仍限制为只读 `*IDN?` / `*OPT?`。

CI 将通过独立 Android 构建任务生成 APK，并将其与 Windows Setup、Portable、DKDS `.dkplugin` 共同发布到同一次 GitHub 预览 Release。详情见 [Android 构建与网络说明](android/README.md)。

## 版本标识与原生图标

软件标题右侧会显示独立的 **UI 资源版本**（`UI <Git commit 前8位>`），鼠标悬停可查看完整 40 位提交号。每次 GitHub 热更新包生成时，在 Windows 和 Android 的 HTML 中嵌入相同的 Git SHA；刷新页面后同步显示新版本。离线内置界面标为“UI 内置版”。`UI` 版本与原生安装包版本是两条独立版本线，不应混为一谈。

Windows 应用图标、任务栏、任务管理器、安装包 EXE，以及 Android 启动图标来自同一套 **DK Test Studio 原生图标源**。通过 `npm run icons:build` 用无外部依赖的矢量几何绘制器生成多分辨率 `build/icon.ico`、Electron 窗口图标和 Android 各密度 `mipmap` 图标。Windows 启动时设置 `AppUserModelID`，打包时将同一图标嵌入安装版与便携版 EXE。这些属于原生资源，必须在首次切换时重新构建安装包；之后普通 UI 修改不影响图标，也无需重新构建。

## 界面热更新（快速开发模式）

从支持热更新的 Windows / Android 原生壳开始，**普通界面更新不再重编译 EXE / APK**：

1. 推送 `web/` 的 HTML、CSS、JavaScript 修改到 `main`。
2. GitHub Actions 的 `Fast UI Hot Update` 先运行测试，再把 Windows / Android 两套对应的界面资源及校验信息写入约 80 KB 的 `DKTS-UI-bundle.json`，并发布到 `dkts-ui-<commit SHA>` 的 GitHub Release。DKDS 插件由同次流水线通过官方 SDK 验证和打包。
3. 已安装的独立 Windows 与 Android 软件启动后自动查询更新，此后约每 3 分钟检查一次；新界面通过校验后从应用私有缓存加载并刷新。断网会继续使用缓存或壳内版本。
4. 仅在原生宿主、Android Java 网卡适配、Node TCP/HTTP 后端或共享底层协议更新时，才启动 `Native Shell Windows Android and DKDS Release` 全量构建。

**第一次必须安装一次具有热更新能力的新壳**：首次支持热更新的四文件原生版是 [dkts-preview-41591728008](https://github.com/davidkane0526/DK-Test-Studio/releases/tag/dkts-preview-41591728008)。旧版不具备自动拉取资源包能力。Android 当前是调试签名 APK，如签名不同可能需要卸载旧预览版。

**更新边界**：自动更新的仅为 `index.html`、`app.js` 和 `styles.css`，不替换正在执行的仪器测量控制代码、原生驱动或权限。单独发布的 DKDS 插件包需要在 DK Data Studio 端安装或通过其插件更新流程应用，并不是由独立应用自动安装到 DKDS。

## 运行与测试

环境：Node.js 20+。获取项目源码后，在仓库根目录执行：

~~~sh
npm test
npm run identify -- --help
npm run identify -- --identify --host 169.254.111.118 --port 1225 --serial 1498377
npm run serve
~~~

`npm run serve` 会显示本机地址，在浏览器打开；真正执行 --identify 需要仪器已经进入 KXCI 且网卡有可达路由。

桌面版需要安装依赖：

~~~sh
npm install
npm start
npm run dist:win
~~~

GitHub Actions 在 `main` 提交时运行 Windows 与 Ubuntu 测试，并尝试打包 Windows 安装版和便携版。查看仓库的 Actions 与 Releases 页面核实每次构建是否成功；这不是实机验证。

## 安全与控制边界

本阶段**不会施加电压/电流**。不得把波形规划的 ±200 V 软件输入范围当作任一已安装模块的硬件安全额定值。任何真实 SMU/PMU 输出功能都必须先进行模块检测、命令序列验证、端口/限流配置、故障关闭、物理接线检查及现场验收。HTTP 控制服务仅允许本机访问，不支持远程 LAN 操作。

原始仪器数据、Clarius 原生文件/图像与本软件绘制的图必须严格区分。有关路线与验收条件参见 [开发路线](docs/ROADMAP.md)。

## 迁移来源

首批 KXCI 解析与 TCP 传输逻辑取自 `davidkane0526/DK-Data-Studio` 的 `4200` 分支（基线提交 `6a2596dd`）。后续开发仅在本独立仓库进行。
