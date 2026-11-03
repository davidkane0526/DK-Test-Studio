# DK Test Studio

**独立的 Keithley 4200A-SCS 科研测试工作台**。与 [DK Data Studio](https://github.com/davidkane0526/DK-Data-Studio) 分离开发，目标是逐步承担 Clarius 的日常测量工作界面。保留仪器 KXCI、原厂驱动及必要的硬件配置环境。

## 当前实际能力：v0.1（只读预览）

- 独立 Windows Electron UI，以及仅监听 `127.0.0.1` 的本机浏览器工作台。
- 打开工作台自动尝试连接，仪器连接卡片已移除：**DK Test Studio 标题右侧只有状态按钮（连接成功/连接失败）**，点击后才显示连接详情弹窗、临时设置、重连与断开。弹窗关闭时无需进行任何手动操作。
- 从原项目 `4200` 分支迁移 TCP 网络适配器：自动网卡、以太网、Wi-Fi、指定网卡/源地址；超时和详细日志隔离。
- 真实仪器只发送硬编码的只读 `*IDN?\0` 与 `*OPT?\0` 查询，验证设备型号和序列号。**没有 SMU/PMU 输出、扫描或原生文件导出**。
- 连接后自动查询 KXCI 的 `*OPT?` 装机模块列表，识别 SMU、PMU、CVU、PGU 类别；这**不代表已经验证模块额定电压、电流、时间分辨率或接线**。
- **测试方式使用独立选择卡片（桌面四列、平板/手机至少两列）**，不使用测试模式下拉框；I–V 与 I–t 点击即切换参数，尚未完成的测量方式以禁用卡片展示，避免将规划功能误写成可执行功能。
- SMU I–V 与 I–t 的独立测试方案编辑、循环次数/通道/规划电流限值配置、扫描点序列预览（仅规划，不发送输出）。
- 可粘贴两列时间(s)、电压(V)，做严格递增检查、纯软件方案验证和本机波形预览。**预览不是仪器测量，也不证明硬件能执行该时间尺度**。
- 自动化测试含伪 4200A TCP 服务、身份校验、HTTP 安全边界、任意波形规划。

## DK Data Studio 插件兼容

**核心逻辑始终共用一份源码。** 独立 Windows 版和 DKDS 插件版通过各自宿主的 TCP/UI 接口，调用 `src/shared/` 中相同的 KXCI 身份协议、连接状态机、I–V/I–t 方案和任意波形规划。外部插件沿用原有 `com.dkds.keithley-4200` ID，以 `0.4.0` 版本覆盖内置基线 `0.3.0`，目标 API `1.19.0`。

执行 `npm run plugin:build` 可生成 `.dkplugin` 候选；GitHub Actions 另用 DK Data Studio 现有 SDK 验证并生成正式插件 Artifact。插件支持原有 `keithley-4200` 工作区入口和项目切片，但**尚未在真实 DKDS 客户端及 4200A 仪器上验证安装与运行**。在开发完成仪器独占 Broker 前，不允许独立版和插件版同时控制同一台仪器。

详见 [互操作契约](docs/DKDS_INTEROP.md)。

## 独立 Android APK（开发预览）

`android/` 包含 **DK Test Studio 自己的 Android 原生应用**。它不依赖 DK Data Studio，也不需要安装 DKDS 插件。
Android 使用本机 WebView 工作台、独立原生 Java TCP 网络桥接（可绑定 USB Ethernet / Wi-Fi Network）和与 Windows / DKDS 插件 **字节完全一致** 的 `src/shared/` 协议及测试规划核心。当前安全边界仍限制为只读 `*IDN?` / `*OPT?`。

CI 将通过独立 Android 构建任务生成 APK，并将其与 Windows Setup、Portable、DKDS `.dkplugin` 共同发布到同一次 GitHub 预览 Release。详情见 [Android 构建与网络说明](android/README.md)。

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
