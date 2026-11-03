# DK Test Studio

**独立的 Keithley 4200A-SCS 科研测试工作台**。与 [DK Data Studio](https://github.com/davidkane0526/DK-Data-Studio) 分离开发，目标是逐步承担 Clarius 的日常测量工作界面。保留仪器 KXCI、原厂驱动及必要的硬件配置环境。

## 当前实际能力：v0.1（只读预览）

- 独立 Windows Electron UI，以及仅监听 `127.0.0.1` 的本机浏览器工作台。
- 进入工作台自动尝试 4200A 连接，只有一个连接/断开按钮；其他连接设置折叠、不持久保存。
- 从原项目 `4200` 分支迁移 TCP 网络适配器：自动网卡、以太网、Wi-Fi、指定网卡/源地址；超时和详细日志隔离。
- 真实仪器只发送一个硬编码、只读的 `*IDN?\0` 指令，验证设备型号和序列号。**没有 SMU/PMU 输出、扫描或原生文件导出**。
- 可粘贴两列时间(s)、电压(V)，做严格递增检查、纯软件方案验证和本机波形预览。**预览不是仪器测量，也不证明硬件能执行该时间尺度**。
- 自动化测试含伪 4200A TCP 服务、身份校验、HTTP 安全边界、任意波形规划。

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
