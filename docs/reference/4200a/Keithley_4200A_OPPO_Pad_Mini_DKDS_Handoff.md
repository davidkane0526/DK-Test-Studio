# Keithley 4200A-SCS × OPPO Pad Mini × DK-Data-Studio：通信验证与开发交接

> 交接日期：2026-10-30  
> 阶段：**Android 平板经 USB-C 以太网直连 4200A-SCS，KXCI `*IDN?` 命令及响应已实测成功**。尚未验证 SMU 输出、测量或 DKDS 原生集成。  
> 用途：可将本文件直接上传到下一次 ChatGPT 对话，作为恢复上下文和继续实施的工程依据。

## 1. 项目目标与已证实结论

目标：让已 Root 的 OPPO Pad Mini **独立控制 Keithley 4200A-SCS**；同时让 Windows 台式机通过 Wi-Fi 控制平板、接收采集数据。最终把控制功能集成到 [DK-Data-Studio（DKDS）](https://github.com/davidkane0526/DK-Data-Studio)，而非新建一套科学绘图及数据管理平台。

已经实测确认：

- Windows 台式机能通过 `adb shell` 进入 OPPO Pad Mini，执行 `su` 后具备 Root 权限（KernelSU LKM）。
- 平板 USB-C 有线网卡对应 `eth0`，`operstate=up`、`carrier=1`。
- 平板同时连接 Wi-Fi（`wlan0`）和以太网（`eth0`）。
- 平板 `eth0` 使用 `169.254.111.115/16`；4200 上 `Ethernet 4` 使用 `169.254.111.118/16`；对端 MAC 为 `00:04:5f:ad:35:a7`。
- 4200 自带 Windows 的 KXCI 启动后报告 Ethernet 地址 `169.254.111.118`、端口 `1225`；`netstat -ano | findstr :1225` 显示 `0.0.0.0:1225 LISTENING`（当次 PID 804，不要视为固定 PID）。
- **Android 端成功建立 TCP 连接，并执行实际 KXCI 查询：**
  ```sh
  toybox nc -w 5 -z 169.254.111.118 1225
  echo $?
  # 0
  printf '*IDN?\000' | toybox nc -w 5 169.254.111.118 1225
  # KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14
  ```
- 这个成功结果证明 **TCP 连接和 KXCI 查询/应答均可用**，但不证明 SDK、Python 或 DKDS 已经适配，也不证明源表实际输出已受控。

### 1.1 设备身份

| 项目 | 已确认值 | 说明 |
|---|---|---|
| 仪器 | Keithley 4200A-SCS | `*IDN?` 返回型号字段 `KI4200A` |
| 仪器序列号 | `1498377` | 当次识别结果；仅用于匹配设备 |
| 仪器响应版本字段 | `V1.14` | 不要直接认定它等于 Clarius 版本 |
| 控制服务 | KXCI | 运行在仪器 Windows 系统 |
| TCP | `169.254.111.118:1225` | `169.254` 是链路本地自动地址，未来可能变动 |
| 仪器网卡 | Ethernet 4 | 当次有效网卡 |
| 仪器网卡 MAC | `00:04:5f:ad:35:a7` | 来自 `ipconfig /all` 和 Android `ip neigh` |
| 平板 | OPPO Pad Mini | Android/ColorOS；Root 为 KernelSU LKM |
| 平板 Ethernet | `eth0` / `169.254.111.115/16` | 临时手工 IPv4 配置 |
| 平板 Wi-Fi | `wlan0` / 当次 `10.87.71.183/16` | DHCP 分配；不应写死 |

## 2. 当前实际连接拓扑

```text
Windows 台式机
  └── Wi-Fi ──> OPPO Pad Mini (wlan0, 当次 10.87.71.183)
                   │
                   ├── ADB over Wi-Fi：台式机远程调试平板
                   │
                   └── USB-C -> 以太网适配器 -> RJ45 网线
                                   │
                                   ▼
                            eth0: 169.254.111.115/16
                                   │ [有线直连]
                                   ▼
                        Keithley 4200A-SCS Ethernet 4
                        IPv4: 169.254.111.118/16
                        KXCI TCP: 1225
```

**明确区分连接用途**：
- Wi-Fi：Windows ↔ Android（ADB、未来远程 UI/数据回传）。
- RJ45 有线网：Android `eth0` ↔ Keithley Ethernet 4（真正的仪器控制链路）。
- `adb` 是开发调试通道，不是 KXCI 协议必需部分；在平板上独立运行原生应用时不应依赖 ADB。
- Android Root 是调试时设置网络的手段，不是 KXCI 协议本身的要求。正式 APP 最好用 Android 原生网络能力替代 Root 命令。

## 3. 从零恢复连接：已验证操作顺序

### 3.1 在 4200 仪器 Windows 侧

1. 4200 通过正确的 Ethernet 网口和网线连接平板 USB-C 以太网适配器。
2. 在 KCon 中使用 KXCI 的 Ethernet 通信模式，端口设为 `1225`，保存退出；启动 KXCI（不要让 Clarius 与 KXCI 竞争控制）。
3. 在仪器 CMD 查看实时网络与监听状态：
   ```cmd
   ipconfig /all
   netstat -ano | findstr :1225
   ```
4. 本次已验证 KXCI 监听 `0.0.0.0:1225`，实际 Ethernet 4 IP 最终是 `169.254.111.118`。**不要把早期截图里的 `169.254.111.114` 当成当前正确 IP**；Windows 链路本地 IPv4 可能变化。
5. 可在仪器 CMD 测试到平板的 Ping：
   ```cmd
   ping 169.254.111.115
   ```
   当次成功：4 发 4 收，0% 丢包，平均约 1 ms。

### 3.2 Windows 台式机进入平板

在 Windows CMD/PowerShell（安装好 `adb` 且无线 ADB 已配对连接的前提下）：

```cmd
adb devices
adb shell
su
```

成功后提示符为 `OP6548L1:/ #`。以下 `ip` 命令必须在 **Android ADB Shell** 中运行，不能直接在 Windows CMD 执行。

### 3.3 检查以太网链路

```sh
cat /sys/class/net/eth0/operstate
cat /sys/class/net/eth0/carrier
ip -br addr show eth0
```

当次为 `up`、`1`、`eth0 UP ...`。接口名应以当前实机为准；`carrier=1` 只表明物理链路，不足以证明 TCP 可达。

### 3.4 配置 Android `eth0` IPv4

本次手工使用：

```sh
ip addr add 169.254.111.115/16 dev eth0
ip -br addr show eth0
```

**先检查地址是否已经存在；已存在时不要重复添加。** 本次前期曾设 `192.168.50.20/24`，已执行：

```sh
ip addr del 192.168.50.20/24 dev eth0
```

仅在当前确实有这个旧地址时才需要删除。由于 `169.254` 属于链路本地地址，长期运行建议配置两端稳定的专用静态 IPv4（在确保网口正确且不会影响仪器现有管理网络的前提下），或实现可靠的地址发现与重连。

### 3.5 **关键陷阱：ColorOS 策略路由可能把仪器流量发到 Wi-Fi**

当时即使 `eth0` 已经有 `169.254.111.115/16`，仍看到：

```text
ip route get 169.254.111.118
169.254.111.118 via 10.87.255.254 dev wlan0 table wlan0 src 10.87.71.183 uid 0
```

这才是早期 `nc: Timeout` 的关键原因之一。Android `ip route` 的普通输出可能不足以反映实际选中的策略路由，**务必用 `ip route get <目标IP>` 验证**。

本次 Root Shell 使用的解决方式：

```sh
ip route replace 169.254.111.118/32 dev eth0 src 169.254.111.115 table wlan0
ip route get 169.254.111.118
```

得到：

```text
169.254.111.118 dev eth0 table wlan0 src 169.254.111.115 uid 0
```

**解释**：这里只把到仪器特定 IP 的路由加入当时命中的 `wlan0` 策略路由表，使去该 IP 的数据走 `eth0`；并不是要把整个 Wi-Fi 默认路由切换掉。该方法依赖当前 Android/ColorOS 的路由规则、接口名及目标地址；仅属于临时诊断性配置，网络重连或系统重启后可能丢失。不得盲目把该命令推广到其他网络环境。

如果 IP 变化，要更新路由中的目标 IP；本次曾误为 `.114` 添加过路由，**不要沿用 `.114` 作为目标**。正式 Android APP 应优先基于 `ConnectivityManager` / `Network` 选择有线网络并在对应网络上创建或绑定 socket，验证在 Wi-Fi 并存时的连接行为；必要时再处理有线接口地址配置。

### 3.6 ARP 与 ICMP 的判读

```sh
ip neigh show dev eth0
ping -I eth0 -c 4 169.254.111.118
```

曾出现：

```text
169.254.111.118 lladdr 00:04:5f:ad:35:a7 STALE
# 修正路由并继续探测后：
169.254.111.118 lladdr 00:04:5f:ad:35:a7 REACHABLE
```

注意：
- `STALE` 说明历史 MAC 缓存；`REACHABLE` 说明近期邻居解析成功；**两者本身都不证明 TCP 服务正常**。
- 当次 Android → 4200 的 Ping **始终未成功**（有时提示 `Destination Host Unreachable`，有时只是 100% 丢包），但随后 **TCP 1225 成功、`*IDN?` 也成功**。因此不应把 Ping 作为进入下一步的硬前提。
- 当时试过将 `.114` 静态绑定到 MAC，Ping 依然失败，之后已删除对应手工邻居项；不建议依赖静态 ARP 作为最终修复。
- 未实际证实 Windows 防火墙是 Ping 不通的根因，**不要把它当作已确认事实，更不要无条件关闭防火墙**。

### 3.7 实际成功的 TCP 与 KXCI 测试

在平板 Root Shell，先确认当前目标 IP 的路由正确：

```sh
ip route get 169.254.111.118
```

然后：

```sh
toybox nc -w 5 -z 169.254.111.118 1225
echo $?
# 实测返回：0
```

最后发送只读设备识别查询：

```sh
printf '*IDN?\000' | toybox nc -w 5 169.254.111.118 1225
```

**实测响应（保留原始内容）：**

```text
KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14
```

`\000` 是 NUL（NULL）终止字节。此次响应紧邻 Shell 提示符，说明输出末尾不一定有可见换行；程序不能只以 `\n` 判断 KXCI 响应结束。实际响应分隔符/读超时策略要结合 KCon 配置并再次测试。

## 4. 重试与故障排查逻辑（严格分层，不盲目重发测量命令）

```text
A. 物理层：eth0 是否存在、up、carrier=1？
   ├─ 否：检查 USB-C 网卡/OTG/供电/RJ45 网线/仪器网口
   └─ 是 → B
B. IP 层：仪器实时 ipconfig / KXCI 日志里 IP 是否一致？
   ├─ 否：以最新的 Ethernet 4 IP 为准，重新配置平板同网段 IP
   └─ 是 → C
C. 策略路由：ip route get <仪器IP> 是否显示 dev eth0、正确 src？
   ├─ 否：诊断当前 Android ip rule/route；临时加 /32 专用路由
   └─ 是 → D
D. ARP：ip neigh show dev eth0 是否解析到正确 MAC？
   ├─ FAILED：检查 IP、链路、接口；避免无依据静态 ARP
   └─ REACHABLE/STALE → E
E. TCP：toybox nc -w 5 -z <仪器IP> 1225；echo $? 是否为 0？
   ├─ 否：确认 KXCI 监听地址/端口、仪器防火墙/通信策略
   └─ 是 → F
F. 协议：发送只读 *IDN? + NUL；解析是否为 KEITHLEY ... KI4200A？
   ├─ 否：检查终止符、KXCI 命令模式、接收边界/超时
   └─ 是 → G：连接/只读识别验证成功，进入受保护的测量功能开发
```

重试原则：

1. **查询重试和写入重试必须分离**。`*IDN?` 这类无副作用识别查询在确认重新连接后可以有限次数重试；会设置电压、启动扫描/脉冲、改变状态的命令不能因超时而盲目重发，否则可能重复施加刺激。
2. 每次新建 TCP 连接后先确认设备身份，校验型号/预期序列号，再允许测量命令。
3. Socket 操作需要明确 `connect timeout`、`read timeout`、响应大小上限、终止符/帧边界；记录原始字节、异常类型和时间戳。
4. 连接断开或平板休眠时，**绝不能推断 4200 已自动关闭输出**；须在设备/本地实验操作层面确认安全状态。异常停止应尽力发送关断命令并提供现场独立关闭手段，但网络已断时“发送了关断”不等于“执行了关断”。
5. 保持**单一会话/单个命令调度者**：平板和台式机不能各自无锁并发向同一 KXCI 服务下发冲突命令。建议平板统一持有仪器会话，台式机只访问平板受控服务。
6. 所有测试先用只读命令，无 DUT 或输出关闭；实现电流限值、输出范围、主动取消、紧急停止、任务日志后，才逐步开放写入与实际测量。
7. 不做无限/高频重连；采用有限重试和退避，错误分类（网卡、地址、路由、TCP、协议、设备状态）并明确提示人工检查。

## 5. DK-Data-Studio 集成设计（建议，非已实现）

仓库：[https://github.com/davidkane0526/DK-Data-Studio](https://github.com/davidkane0526/DK-Data-Studio)。在本次会话检查 `main` 时，仓库 `package.json` 为 `3.71.115`；**后续开发应重新拉取最新分支和版本**，不要假定此版本永久有效。

已核对的项目事实：
- Electron 桌面应用；Android 为 **React Native / Expo 原生壳 + React Native WebView + 离线 DKDS Web 资源**，不等于完整 Node.js 环境。
- 共享 Core、科学计算、ScientificPlot、Artifact Store、Plugin API；跨平台由不同 Host 适配。
- 仓库工程约束要求：插件负责仪器专属领域 UI/流程，Core/Host 负责通用跨平台能力；不要在 WebView 内直接使用 Node.js `net`，也不要在 Core 里硬编码 4200 逻辑。
- 参考工程文档：`AGENTS.md`、`docs/ARCHITECTURE.md`、`docs/PLUGIN_API.md`、`docs/ANDROID_PORTING.md`、`mobile/README_ANDROID_CN.md`，以及仓库最新 SDK 和示例插件。

**拟议架构**：

```text
DKDS Keithley 4200 插件 (JS/TS)
    │ 设备列表、*IDN?、SMU 配置/扫描、采集、错误提示、安全流程
    ▼
DKDS Core 通用仪器会话/Socket 能力（新增标准 Host API，若当前尚无）
    ├── Desktop: Node.js net.Socket（受控主进程/服务）
    └── Android: React Native 原生 TCP 实现（Kotlin Socket 或成熟的适配模块）
                          │
                          └─ 通过 Android Network/ConnectivityManager 选择 eth0
    ▼
4200A-SCS KXCI (TCP 1225, NUL 终止命令)
    ▼
测量结果 → DKDS Artifact Store → ScientificPlot / 分析插件 / 工程保存

Windows 台式机 ↔ 平板：可使用 DKDS LAN Web/受控 API 远程操作与取数据。
```

**语言选择**：
- 当前 KXCI 已用原生 Shell `nc` 验证，**无需引入 Python 才能控制仪器**。
- 原始 `keithley-main.zip` 中的 Python 示例可作为 KXCI 命令流程参考，但移植到 JS/TS 时要区别 **协议命令本身** 与 **PyVISA/NI-VISA** 的 Windows 依赖。Android WebView 不能直接调用原始 TCP Socket，应通过原生 Host API。
- 若想快速开发验证，Termux + Python 标准库 `socket` 可作为独立临时测试工具；不是 DKDS 最终架构的强制组件。

### 5.1 建议分期

1. **Phase 0（已完成）**：USB-C Ethernet、Android Root、IP/路由、KXCI TCP、`*IDN?` 端到端验证。
2. **Phase 1（下一步）**：检查 DKDS 当前 Host/Plugin API；实现通用 TCP 能力 + Android 原生绑定以太网 + DKDS 插件只读 `Connect / Identify / Disconnect`，支持日志及错误分层；无需 Root 的最终能力在实机验证。
3. **Phase 2**：基于仪器手册实现安全状态查询、SMU 通道选择、保护值与限幅校验；先不连接器件、不输出电压，验证安全停机与异常恢复。
4. **Phase 3**：受控的源表输出/读数和 I-V / I-t 数据采集、CSV/Artifact、实时绘图（有明确电压/电流限制、停止条件及用户授权）。
5. **Phase 4**：可选多通道扫描、保持、脉冲 PMU、实验任务队列、LAN Web 多终端；先检查仪器实际装配模块和固件/Clarius/KXCI 支持矩阵。

### 5.2 最小验收标准

- Android 设备处于 Wi-Fi + USB Ethernet 同时连接时，连接到 **指定仪器以太网 IP**，而不是误走 Wi-Fi。
- 新应用成功显示完整 `*IDN?` 字符串；Windows 端通过平板可看到同一设备状态。
- 有有限超时、错误分类、单会话排队、断线提示；程序退出/断线不误称已经关断仪器输出。
- 插件不直接依赖 Node.js/Electron；Android 原生 Socket 通过现有 Host 桥接模式暴露给 DKDS 插件。
- 不破坏现有科学绘图、Artifact、移动 Presenter、插件 API 的边界和回归测试。

## 6. 现有参考材料及可靠性边界

用户此前提供：

- `4200 control.docx`：7 页，描述 KCon 设置 Ethernet KXCI、NI MAX VISA TCP/IP Raw Socket、读取 IPv4、启动 KXCI、VS Code/PyVISA 的连接验证。**其中首段“Type-C 线接电脑”不能直接作为 KXCI 使用 USB Type-C 物理协议的证明**；实际验证链路是以太网 TCP/IP。
- `keithley-main.zip`：Keithley 代码示例，先前查阅的路径包含 `Instrument_Examples/Model_4200A/KXCI_Examples/`，涉及 SMU User/System Mode、线性扫描、多通道/列表扫描、PMU 脉冲示例。需开发时重新读取实际源码，核实命令、依赖和适用模块，不要把样例视为已通过 Android 验证。

本文件的 **`*IDN?` 应答、TCP 返回码、IP 和路由状态** 来源于本次对话用户提供的实机输出；**DKDS 架构设计、重试机制和未来工程建议** 属后续拟实施方案，并不是已完成事实。

## 7. 新对话直接续接的提示词

> 我正在继续开发 **OPPO Pad Mini（KernelSU Root）→ USB-C 以太网 → Keithley 4200A-SCS KXCI → DK-Data-Studio（Android/Windows）** 的仪器控制插件。请先阅读附件 `Keithley_4200A_OPPO_Pad_Mini_DKDS_Handoff.md`，以其“实测成功”与“拟议设计”的区分为准。已实测安卓通过 `169.254.111.115/16`、`eth0` 和针对 `169.254.111.118` 的策略路由访问 `169.254.111.118:1225`，`toybox nc -z` 返回 `0`，发送 `printf '*IDN?\000'` 得到 `KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14`。下一步请检查 GitHub 上 DK-Data-Studio 的**最新** Host/Plugin API，设计并实现 Android 原生 TCP Socket + 单会话 KXCI 只读设备识别插件，优先确保不依赖 Root 的可运行版本，保留桌面端兼容性。不要先开启 SMU 输出；先保证连接、超时、命令终止符、路由绑定和安全断线语义都被实机验证。

## 8. 当前仍未知、必须实机或读源码确认

- Android 不 Root 时，USB 以太网是否由系统正确获得 IPv4，及原生 `Network` 绑定能否在不手动改策略路由的情况下稳定连接。
- `169.254.111.118` 和 `.115` 是否在断线重连后变化；未来的静态地址策略是否符合实验室设备管理规定。
- KXCI 的所有响应帧边界/读数分隔符、最大响应长度和多命令序列安全行为。
- SMU/PMU 具体安装模块、通道与校准/固件兼容性；不能因为样例代码存在便假定仪器拥有 PMU。
- DKDS 最新分支是否已有可复用通用 TCP/设备会话接口；应先检查，而非重复造一套 Host bridge。
- Windows 与安卓多客户端远程控制的鉴权、访问范围、故障恢复、实验室网络安全要求。

---

**最终状态：只读 KXCI 设备识别已经实机成功；下一阶段应开始 DKDS 插件开发，而不是重新排查基本 TCP 连接。**