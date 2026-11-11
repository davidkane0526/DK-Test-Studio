# 4200A 原生 DC 执行链路 · 设计审查（仍未获得实机输出授权）

- 范围：FS-Pro 的独立 `Page` 编辑表单 → 严格 KXCI DC 编译 → 执行状态机 → 原始 `DO` 响应存储 → DKDS 科学绘图。
- 参考文献：Tektronix **4200A-KXCI-907-01 Rev. E, March 2025**（官方 PDF，§3-1、§4-4、§5-7、§5-14 至 §5-28、§5-38、§5-40）。2026 年已有 Rev. F，**必须逐条复核最新版本、仪器固件以及实际模块后才能开启源输出**。
- 截止当前所有编译 `executionAuthorized:false`；执行器只接受 `kind:'offline-mock'`。Electron native preload **只开放读取身份、读取模块清单和连接/断开**，不存在向物理设备发送 `VR/VC/ME1` 的路径。
- **2026-11-08 量程编译（仅离线）**：每端子区分自动（无显式命令）、自动电流量程下限（`RG n,value`）、立即指定电流量程（`RI n,range,compliance`）和立即指定电压量程（`RV n,range,compliance`）。依据官方 Rev. E §5-42/43，`RG` 不等同于固定量程，`RI/RV` 也没有提供完整扫描期间保持量程的证据，编译元数据保留 `heldDuringSweepVerified:false`。`RI` 的电流范围表只明确列出 4200/4201-SMU，4210/4211-SMU 的 `RI` 暂拒编译，不会猜测。预放决定最小电流档位。RG 对高功率 SMU 的范围有手册明确支持。任何量程编译仍然不得直接产生真实源输出。

## 文件与职责

| 文件 | 责任 | 可触达真实 4200A 吗？ |
| --- | --- | --- |
| `src/4200a-fspro/domain/kxci-dc-compiler.js` | 无副作用指令生成、页计划验证、合规上限 | 否 |
| `src/4200a-fspro/domain/kxci-opt-inventory.js` | 解析已识别 KCon 插槽，保留未映射状态 | 否 |
| `src/4200a-fspro/domain/kxci-wire.js` | ASCII/NUL 原始帧封装、限长解码 | 否 |
| `desktop/4200a-tcp-runtime.cjs` | 从旧 DKTS 复用经过验证的以太网/Wi-Fi/指定路由逻辑 | 可以建立 TCP |
| `desktop/4200a-routed-discovery.cjs` | 仅允许 `*IDN?` → 序列号校验 → `*OPT?` 的长连接与断开 | **只读** |
| `desktop/4200a-fspro-main.cjs` 与 `desktop/4200a-fspro-preload.cjs` | 窄权限 IPC，串行连接，窗口关闭后断开 | **只读** |
| `desktop/4200a-kxci-runner.cjs` | 离线状态机；ME4/CH 清理与模拟故障、模拟停止 | 绝不允许真实传输 |
| `desktop/4200a-kxci-acquisition.cjs` | 把实际 DO 回复逐字节封存，兼容带前缀/纯数值格式，可选真实时间戳及原始状态串 | 否（纯解析） |
| `src/4200a-fspro/domain/native-raw-data.js` | 原始表格、CSV 和有效性验证 | 否 |

## 关键原生语义

1. Xsweep 是 **VAR1**，以 `VR1/IR1` 等设置；Psweep 是 **VAR2**，以 `VP/IP` 设置，仪器在每一 VAR2 步执行完整 VAR1 扫描，不使用软件逐点代替。
2. `DE` 页面定义 SMU 通道 `CHn`；`SS` 页面设置恒定偏置 `VCn/ICn`、扫描 `VR/VP`、等待 `DT`、自动待机 `ST`；`SM` 页面设置 `DM2` + `LI`；`MD` 页面 `ME1` 启动、`ME4` 中止。 `IT4` 设置积分 PLC。
3. **LI 最多六个测量函数，而非最多三个 SMU 端子**。允许多个已识别的端子配置，但依照 `captureFunctions` 或 FS-Pro `outputs` 明确选择（最多六个）`Vn/In`。X 与 P 的必要电压/电流函数优先纳入。
4. **手册内部存在格式描述差异**：Rev. E 第 3-1 页示例为 `N/C` 前缀的系统模式 `DO` 数据，第 5-38 页条目则只列数值格式。解析器同时接受带前缀与纯数值响应，**只有实际收到 `C` 时才标记限流**，纯数值的状态保持未知，保留原始字节、字面精度。可选 `DO 'VnT'` 采集**仪器生成的时间数据**、`DO 'VnS'` 等采集原生状态字符串，不猜测尚未验证的状态位编码。
5. 允许的测量能力依赖**安装模块的真实型号**和 KCon 分配。`*OPT?` 只提供普通/高功率类别和有无预放，不能确定具体 `4200/4201/4210/4211` 型号。新增纯文本 `SystemUtil instrumentinfo` 解析器，通过机槽、型号及序列号交叉核验，未确认时保留 `model:null` 并拒绝原生编译。此纯解析器**并未实施仪器侧 SystemUtil 查询**。
6. 执行完成仅代表仪器完成指令，不代表**安全停止已确认**。未成功关闭相关 SMU 输出、连接失去响应、超限/限流、数据不完整必须返回故障，保留可得的原始证据并拒绝标记成功。

## 当前能做的事

桌面端预览自动尝试此前验证过的 `169.254.111.118:1225`（目标仪器地址，不是本地 Android 平板地址），可在 Connection Settings 中修改地址、网络方式、源 IP 和目标设备序列号。原生连接只读：`*IDN?` → `*OPT?`；连接成功可看到模块清单，断开会释放套接字。普通浏览器预览不会直接使用系统 TCP；Android 原生网络桥接仍需单独完成。

编译器、DO 数据解析、源状态机均有离线测试；原生执行器仍是 mock-only。不得从这里推导出 Android/Windows 安装包已发布、真实仪器已测量或 20 ns PMU 能力已经实现。

## 实机启用门槛

- 对 **Rev. F + 当前固件** 校核所有原生 SMU/PMU 指令及采样状态，确认电压、电流范围、预放型号和软件能力边界与硬件规格逐项一致。
- 2026-11-08 额定量程补充：依据 [Tektronix 4200A-SCS 官方数据表](https://download.tek.com/datasheet/1KW-60780-7_4200A-SCS_Parameter_Analyzer_Datasheet_20250320.pdf)，20 V 源量程的扩展上限是 21 V；200 V 量程时，4200/4201-SMU 最大电流 10.5 mA，4210/4211-SMU 最大电流 105 mA。Page 离线校验采用所有支持 SMU 的理论并集，物理型号确认后的 KXCI 编译采用各型号电压/电流耦合边界。全局的 ±210 V 与 1.05 A 不能当作可同时输出；20 ns PMU 功能不受这组 DC SMU 边界影响。
- 2026-11-08 离线编译防错：`readyForCompiler` 与每个 SMU 的 `modelVerified` 必须显式为 `true`，缺失字段不能当作已验证。尚无确定 KXCI 映射的非零 `RefValue` 与不存在的 `RefNode` 必须拒绝编译。Android 断线后撤销旧 KCon 资源选项。此项不改变输出授权状态。
- 从可信系统信息识别 KCon 通道和物理型号，读取设备状态、互锁与仪器实际能力，而不是通过插槽文本猜测。
- 将 PagePlan 编译与仪器的一个全局独占租约绑定；经确认后才能将输出命令开放到专用驱动。**不能简单把运行器的 `offline-mock` 字符串替换为 socket。**
- 必须实现具有可测响应时间的异步紧急停止、连接掉线后的安全状态确认和自动导出错误日志；模拟 `ME4` 不等于已经实证输出归零。
- 使用空载/限流 DUT 分阶段实机验证基本 DC、四端子 VAR1/VAR2、限流退出、重复/停止/掉线，先记录原始通信与标称波形，再启用 Measure。
- Android 采用已验证的设备网络路由桥接。只有 Windows/Android 独立构建通过启动、签名和安装检查后才可产生正式 Release。统一热更新/完整更新清单已能离线签名，客户端自动升级尚未集成。

## 离线 CI

`.github/workflows/4200a-fspro-contract.yml` 运行页面安全校验、KXCI 编译校验、TCP 模拟服务器查询、四端子函数选择、DO 双格式兼容、状态未知保留与可选原生时间戳、错误/中止/关闭输出模拟、Ed25519 清单检查及多视口 Chromium 截图。**CI 通过不等于实机测试通过。**
