# DK Test Studio

**独立的 Keithley 4200A-SCS 科研测试工作台**。与 [DK Data Studio](https://github.com/davidkane0526/DK-Data-Studio) 分离开发，目标是逐步承担 Clarius 的日常测量工作界面。保留仪器 KXCI、原厂驱动及必要的硬件配置环境。

## 当前实际能力：v0.1（只读预览）

- 独立 Windows Electron UI，以及仅监听 `127.0.0.1` 的本机浏览器工作台。
- 打开工作台自动尝试连接，Windows 原生窗口采用**无边框（frameless）设计**，不显示系统顶部最小化/最大化/关闭标题栏。应用顶部采用约 46px 的**可拖动自定义标题栏**，左侧放 DK Test Studio 图标、应用名称、UI 热更新版本，右侧放 Windows 最小化、最大化/还原、关闭控制。底部**另设独立约 29px 的状态栏**，只显示运行消息和**唯一的仪器连接状态按钮**（连接变化写入消息历史，但不重复覆盖左侧消息）；点击消息可查看最近 30 条会话日志，点击连接状态可查看诊断和设置。浏览器和独立 Android 版同样显示两条紧凑栏，但隐藏 Windows 专属窗口控制。弹窗关闭时无需进行任何手动操作。
- 从原项目 `4200` 分支迁移 TCP 网络适配器：自动网卡、以太网、Wi-Fi、指定网卡/源地址；超时和详细日志隔离。
- 真实仪器只发送硬编码的只读 `*IDN?\0` 与 `*OPT?\0` 查询，验证设备型号和序列号。**没有 SMU/PMU 输出、扫描或原生文件导出**。
- 连接后自动查询 KXCI 的 `*OPT?` 装机模块列表，识别 SMU、PMU、CVU、PGU 类别；这**不代表已经验证模块额定电压、电流、时间分辨率或接线**。
- **测试方式采用真正两级界面**：首页只显示测试类型卡片，点击后整页隐藏选择区，切换到独立测试工作区，仅保留测试名称与返回入口。参数栏右上角使用图标按钮收起，收起后可从数据标题旁的展开图标恢复；左上角返回使用单独箭头图标。参数区采用可一键收起的紧凑侧栏，数据读取、图表与原始数据表尽可能使用整页宽高。桌面端无固定顶部状态栏，绘图区随剩余垂直空间扩展。桌面四列、窄屏至少两列，DKDS 插件同样使用二级页面与返回导航。I–V/I–t 的参数规划可用，任意波形可校验输入，其余测试只显示待开发配置占位。**实测读数和实测绘图均保持空白，绝不以模拟曲线冒充仪器数据。**
- SMU I–V 与 I–t 的独立测试方案编辑、循环次数/通道/规划电流限值配置、扫描点序列预览（仅规划，不发送输出）。
- 可粘贴两列时间(s)、电压(V)，做严格递增检查、纯软件方案验证和本机波形预览。**预览不是仪器测量，也不证明硬件能执行该时间尺度**。
- 自动化测试含伪 4200A TCP 服务、身份校验、HTTP 安全边界、任意波形规划。

## DK Data Studio 插件兼容

**核心逻辑始终共用一份源码。** 独立 Windows 版和 DKDS 插件版通过各自宿主的 TCP/UI 接口，调用 `src/shared/` 中相同的 KXCI 身份协议、连接状态机、I–V/I–t 方案和任意波形规划。外部插件沿用原有 `com.dkds.keithley-4200` ID，以 `0.4.3` 版本覆盖内置基线 `0.3.0`，目标 API `1.19.0`。

执行 `npm run plugin:build` 可生成 `.dkplugin` 候选；GitHub Actions 另用 DK Data Studio 现有 SDK 验证并生成正式插件 Artifact。插件支持原有 `keithley-4200` 工作区入口和项目切片，但**尚未在真实 DKDS 客户端及 4200A 仪器上验证安装与运行**。在开发完成仪器独占 Broker 前，不允许独立版和插件版同时控制同一台仪器。

详见 [互操作契约](docs/DKDS_INTEROP.md)。

## 独立 Android APK（开发预览）

`android/` 包含 **DK Test Studio 自己的 Android 原生应用**。它不依赖 DK Data Studio，也不需要安装 DKDS 插件。
Android UI 热更新采用与 Windows 相同的界面文件，同时识别 `DKTSNative` 原生宿主并启用独立的 Android 样式。对 targetSdk 35 的 Android 15+ 系统栏采用 CSS `safe-area-inset-*` 避让，兼顾竖屏两列测试卡片、横屏布局和更大的底部触控区域。**目前是代码和自动化测试覆盖，尚未在目标 Android 平板实机截图验收**。
Android 使用本机 WebView 工作台、独立原生 Java TCP 网络桥接（可绑定 USB Ethernet / Wi-Fi Network）和与 Windows / DKDS 插件 **字节完全一致** 的 `src/shared/` 协议及测试规划核心。当前安全边界仍限制为只读 `*IDN?` / `*OPT?`。

CI 将通过独立 Android 构建任务生成 APK，并将其与 Windows Setup、Portable、DKDS `.dkplugin` 共同发布到同一次 GitHub 预览 Release。详情见 [Android 构建与网络说明](android/README.md)。

## 版本标识与原生图标

软件标题右侧会显示独立的 **UI 资源版本**（`UI <Git commit 前8位>`），鼠标悬停可查看完整 40 位提交号。每次 GitHub 热更新包生成时，在 Windows 和 Android 的 HTML 中嵌入相同的 Git SHA；刷新页面后同步显示新版本。离线内置界面标为“UI 内置版”。`UI` 版本与原生安装包版本是两条独立版本线，不应混为一谈。

Windows 应用图标、任务栏、任务管理器、安装包 EXE，以及 Android 启动图标来自同一套 **DK Test Studio 原生图标源**。通过 `npm run icons:build` 用无外部依赖的矢量几何绘制器生成多分辨率 `build/icon.ico`、Electron 窗口图标和 Android 各密度 `mipmap` 图标。Windows 启动时设置 `AppUserModelID`，打包时将同一图标嵌入安装版与便携版 EXE。这些属于原生资源，必须在首次切换时重新构建安装包；之后普通 UI 修改不影响图标，也无需重新构建。

## 界面热更新（快速开发模式）

**每次向 `main` 推送任何更改，都执行全平台完整构建。热更新只是额外的快速体验渠道，不替代原生安装包。**

1. `Native Shell Windows Android and DKDS Release` 在**每一次 `main` 提交**时运行，不限制修改路径，也不取消排队中的旧提交。分别构建 Windows Setup、Windows Portable、独立 Android APK、DKDS 插件以及 UI 更新资源。
2. 五项资产全部通过测试和构建后，发布到唯一的 `dkts-preview-<GitHub Actions run ID>` Release，并检查 **5/5** 资产完整性。即使后来有新提交，较早一次构建成功也仍应发布，不因 HEAD 已变化而拒绝。
3. `Fast UI Hot Update` 同样在每次提交时运行，另行发布 `dkts-ui-<commit SHA>` 资源包；若该提交已不是最新 HEAD，则跳过*过时的热更新*，防止旧内容覆盖新版本，但对应的完整构建仍继续并发布。
4. 已安装的独立 Windows 与 Android 软件启动时以及约每 3 分钟检查一次热更新，验证后从私有缓存刷新；离线继续运行已安装版本。
5. Release 必须分别提供 Windows 安装版、Windows 便携版、独立 Android APK、DKDS 插件和轻量 UI 更新资源。汇报开发结果时同时附上实际发布并验证的 Release 链接；不可用 Actions 地址冒充已完成的 Release。

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

GitHub Actions 在 `main` **每次提交**时运行 Windows 与 Ubuntu 测试，并构建 Windows Setup/Portable、独立 Android APK、DKDS 插件与热更新资源，完成后统一发布到 GitHub Release。每次发布必须核对 5 个文件，未成功构建则不能声称 Release 已发布。测试通过不等于完成真实仪器验收。

## 安全与控制边界

本阶段**不会施加电压/电流**。不得把波形规划的 ±200 V 软件输入范围当作任一已安装模块的硬件安全额定值。任何真实 SMU/PMU 输出功能都必须先进行模块检测、命令序列验证、端口/限流配置、故障关闭、物理接线检查及现场验收。HTTP 控制服务仅允许本机访问，不支持远程 LAN 操作。

原始仪器数据、Clarius 原生文件/图像与本软件绘制的图必须严格区分。有关路线与验收条件参见 [开发路线](docs/ROADMAP.md)。

## 迁移来源

首批 KXCI 解析与 TCP 传输逻辑取自 `davidkane0526/DK-Data-Studio` 的 `4200` 分支（基线提交 `6a2596dd`）。后续开发仅在本独立仓库进行。

## 顶部标签页和 Android 沉浸式界面

标题栏中 UI 版本右侧保留固定分隔线，工作区采用类似 DK Data Studio 的标签页：测试选择不占据标签页：版本分隔线右侧使用单个“＋”按钮进入测试类型列表，只有实际打开的测试才占用标签页。各标签的关闭按钮使用 SVG 居中绘制，避免文字 × 受字体基线影响产生偏移。切换时保留参数和任意波形草稿；关闭标签时清除对应会话草稿。不是实测任务管理或多仪器控制。

独立 Android APK 默认隐藏系统顶部状态栏的时间、蓝牙、Wi-Fi 等图标，保留底部系统导航手势/导航栏。标题栏在隐藏系统栏后上移至屏幕顶端，使用较紧凑高度。沉浸式模式的原生状态栏修改需要安装新 APK，仅靠热更新无法生效。Windows/Android 完整构建均在打包前嵌入本次 Git SHA，离线启动也显示 UI 版本；每次完整提交仍发布全部五项资产。

## 双版本号

顶部始终同时显示原生安装版本 `v0.2.2`（Windows/Android 各自从真实宿主查询）与 `UI <Git SHA 前8位>`（每次热更新及完整构建写入），避免安装版和热更新版混淆。用户无需联网就可以从内置页面看到此次构建对应的 UI 提交号。用户界面的版本以实际装机环境为准，而不是只依赖 Release 的标签。


## 控件视觉统一（Windows、Android、浏览器）

- 所有滚动区域采用纤细、圆角、透明轨道的滚动条，并移除 Chromium 原生箭头按钮。横向标签条依然隐藏滚动条，但保留触控/滚轮滚动。
- 连接方式与 I–V 扫描方向这两处下拉框采用统一的浮层列表。底层 HTML \`select\` 仍保留并参加 \`FormData\`，不会改变连接/测试协议；JavaScript 未加载时仍显示原生选择控件。浮层支持方向键、Enter、Escape、点击外部关闭和小屏向上展开。
- 输入框、数字框、文本域、浮层和展开标题使用统一边框、字号、间距、hover、focus 与深色主题。Android WebView 使用更大的触控高度。
- 目前由自动化测试保障结构和事件通道；Windows 系统主题/Android WebView 的最终视觉效果仍需实机截图确认。

## 标签排列、滚动条与独占执行

- 顶部实际已打开的测试标签在左，**添加测试（＋）固定在现有标签末尾**，随标签增加向右移动；当标签区超过可用宽度时，仅标签内容横向滚动，＋仍保持可见。
- 全局滚动条宽度从 8px 调整为 5px，滑块在普通状态下降低为约 30% 不透明度，悬停加深；深色模式使用独立的透明度。
- Windows、Android 和 DKDS 共享的 `src/shared/measurement-plan.js` 提供 `createExecutionCoordinator()`，同一宿主内即使同时打开多个测试标签也只允许一个任务获得执行权，任务失败或完成后释放。**目前真实仪器执行接口仍未开放**，独立 Windows 和 DKDS 之间的跨进程仪器租约尚未实现，不能将单进程协调器误认为跨应用互斥。
- 独立 Android 原生壳已隐藏**顶部系统状态栏**，不隐藏底部系统导航栏；进入应用、恢复前台和窗口重新获得焦点时重新应用，顶部时间、Wi-Fi、蓝牙、电量图标正常应消失。若从顶部下滑，Android 仍允许临时显示系统状态栏。此修改需要安装本次新 APK，**不能仅凭 UI 热更新完成**。

### Android v0.2.3 启动闪退修正

撤销 0.2.2 版本中 onWindowFocusChanged() 重复执行的系统状态栏操作。Android 11–16 通过一次性排队的 WindowInsetsController 请求隐藏顶部系统状态栏，旧版本保留兼容分支，厂商系统栏异常不再导致整个 Activity 退出。原生版本升级 v0.2.3；Android CI 新增 API 36 模拟器安装、启动、进程保活、crash 日志和截图验证，不能以仅编译成功替代启动验证。实机故障仍须结合 adb logcat 判断。
