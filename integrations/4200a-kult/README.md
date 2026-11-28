# 在 Keithley 4200A 安装 DKTS SMU 脉冲用户模块

新版 Windows DKTS 的「类型 → Pulse I–V」匹配直连 SMU 时，通过 KXCI 调用 4200A 上的 `DKTSsmu/Smupulse`。Windows 插件和仪器上的 KULT 用户库都需要安装。这份目录是仪器端 C 源码。

1. 在 4200A 上，用与实装 Clarius 配套的 KULT 创建用户库 `DKTSsmu` 和模块 `Smupulse`，返回类型为 `int`。使用以下顺序添加参数。
2. 保留 KULT 自动生成的函数声明和 `keithley.h`。将 [Smupulse.c](Smupulse.c) 最外层花括号之间的函数体复制到代码区。在 Description 中单独一行写入 `DKTS_SMU_PULSE_ABI_1`。
3. 保存后执行 KULT 的「Build Library」，确认无构建错误。重新启动仪器上的 KXCI。在 Windows DKTS 装入 0.8.44 插件并重启。核验 4200A 型号及接线后打开对应测试，单项运行前由 DKTS 查询模块描述。
4. 实机验收时记录漏极和栅极的物理波形、实际保持时间、不同量程下的读数、正常结束和停止后的关断。初次验收用已知负载。记录 `GD`、`EX`、`SP`、`GN`、`AB` 和关断的实际响应，方便核对该固件的 KXCI 行为。

| 名称 | 类型 | 方向 | 说明 |
|---|---|---|---|
| drain | long | Input | SMU 编号 1–8 |
| gate | long | Input | 0 表示关闭，或 SMU 编号 1–8 |
| start | double | Input | 起始电压 |
| stop | double | Input | 结束电压 |
| points | long | Input | 点数 1–256 |
| onms | long | Input | 导通时间，整毫秒 |
| offms | long | Input | 关断等待，整毫秒 |
| gatev | double | Input | 固定栅压 |
| dlim | double | Input | 漏极限流 |
| dvr | double | Input | 漏极固定电压档 |
| dir | double | Input | 漏极固定电流档 |
| glim | double | Input | 栅极限流，关闭时传 0 |
| gvr | double | Input | 栅极固定电压档，关闭时传 0 |
| gir | double | Input | 栅极固定电流档，关闭时传 0 |
| token | long | Input | 本次任务标识 |
| vd | D_ARRAY_T | Output | 脉冲结束前的漏极实测电压 |
| vdsize | long | Input | KULT 为 vd 自动生成的长度参数，改名为 vdsize |
| id | D_ARRAY_T | Output | 与电压同时测得的漏极电流 |
| idsize | long | Input | KULT 为 id 自动生成的长度参数，改名为 idsize |
| elapsed | D_ARRAY_T | Output | 该点 mpulse 返回后读取的仪器计时器 |
| elapsedsize | long | Input | KULT 为 elapsed 自动生成的长度参数，改名为 elapsedsize |
| receipt | long* | Output | 模块完成采集且复位输出后回传的本次任务标识 |

标配方案支持漏极电压线性脉冲、回到 0 V 的关断基线、可选独立 SMU 固定栅压，以及 GNDU 源极。电压档和固定电流档由已核验的 SMU 及限流值决定。此版单次最多 256 点，导通及关断等待分别为 5–20,000 整毫秒，设定等待合计最多 120 s。硬件极限、输出波形、停机和特定固件的远程响应需在仪器验收。转录的栅压为设定值。采样后计时器是仪器记录的经过时间。

原厂资料见 [KULT Rev D](https://download.tek.com/manual/4200A-KULT-907-01D_Programming_May_2024.pdf)、[LPT Rev D 的 mpulse、delay、meast 和 devint](https://download.tek.com/manual/4200A-LPT-907-01D_LPT_May_2024.pdf) 与 [KXCI Rev F 第 4 节](https://download.tek.com/manual/4200A-KXCI-907-01F_Sept2026.pdf)。
