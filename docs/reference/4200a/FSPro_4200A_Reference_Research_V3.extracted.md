<PARSED TEXT FOR PAGE: 1 / 6>
        FS-Pro / LabExpress 与 Keithley 4200A-SCS
                 参考资料深度检索报告
                   DKTS 开发补充规范 V3 | 检索截止：2026-11-06




本报告是 V2 开发指南的研究补充。硬件命令和能力边界以当前官方手册及真机验证为准。




                       DKTS | FS-Pro / 4200A Reference Research V3 | 1
<PARSED TEXT FOR PAGE: 2 / 6>
0. 结论先行
•   已找到概伦电子官方 LabExpress 资料、Tektronix 当前 4200A 官方手册目录，以及厂商维护的 4200A GitHub 示例。

•   官方 family_of_curves 示例展示 VAR1 内层扫描与 VAR2 外层阶梯偏置，可映射 DKTS 的 Xsweep/Psweep。

•   常规 DC IV 优先使用 SMU System Mode 原生扫描；PMU 脉冲和波形采集使用独立 PMU 命令引擎。

•   FS-Pro 软件工作流可作参考，但其硬件规格不能转用为 4200A 的硬件边界。



1. 资料可信度分级
等级        来源                      用途                                                           限制

A         官方手册                    硬件边界、命令语法、状态、数据格式                                            必须使用当前版本

B         厂商维护 GitHub Demo        命令编排、通信、数据读取                                                 不等于生产级代码

C         第三方驱动库                  对象模型、状态封装、测试方法                                               不是硬件规格真值

D         社区项目                    测试工作流和 UI 思路                                                 不可照搬参数限制




2. FS-Pro / LabExpress 官方资料
官方资料入口：LabExpress 产品页 https://www.primarius-tech.com/products/data_test_system/LabExpress.html；中文产品资料（2024-09）
https://www.primarius-tech.com/uploads/20240920/CN_LabExpress_Sep.2024.pdf。

分类                      已公开能力

器件                      MOSFET、BJT、二极管、电阻、电容、自定义器件

测试                      DC IV、Pulse IV、Transient IV、快速脉冲 IV、CV、噪声、可靠性

扫描                      线性、对数、散点、多段、双向、参数化

波形/脚本                   内置信号生成函数、Java 风格脚本化平台

数据/工程                   数学计算、曲线叠加、工程数据库、测试计划、晶圆映射、CSV/XLS 导出

自动化                     探针台、矩阵开关、第三方仪器、GPIB/LAN


公开页面列出 FeRAM Fast IV、Reliability Testing、Transient I-V with Regular and Complicated Waveforms
等应用说明标题，但未找到完整 LabExpress 操作手册或全部应用说明正文。建议向 support@primarius-tech.com
索取完整手册、算法配置手册、脚本 API 和示例工程。FS-Pro 硬件规格不可转用为 4200A 的能力边界。


3. Keithley 4200A 当前官方手册
手册                                版本 / 日期                                用途

KXCI Remote Control Programming   Rev F / 2026-10-09                     KXCI 通信、SMU、PMU、CVU 命令

Clarius User Manual               Rev G / 1.15 / 2026-10-09              测试工程、UTM、分析和 UI




                                             DKTS | FS-Pro / 4200A Reference Research V3 | 2
<PARSED TEXT FOR PAGE: 3 / 6>
手册                                       版本 / 日期                                 用途

PGU/PMU User Manual                      Rev D / 2026-10-22                      4225-PMU、4225-RPM、脉冲和波形

LPT Library Programming                  Rev E / 2026-10-09                      低层本地控制接口

CVIV Multi-Switch                        Rev F / 2025-04-30                      CVIV 多路开关

Prober / External Control                Rev C / 2025-04-30                      探针台和外部设备

SMU User Manual                          Rev A / 2020-12-15                      SMU 硬件与操作

CVU User Manual                          Rev B / 2023-03-31                      CVU 测量与校准


当前官方入口：KXCI Rev F、Clarius Rev G、PMU Rev D、LPT Rev E 均可从 Tektronix 官方手册页面下载。可解析的命令参考：KXCI
Rev E PDF（2025-03）https://download.tek.com/manual/4200A-KXCI-907-01E_March2025.pdf。Rev F 是当前版本；Rev E
用于快速检索，最终以 Rev F 为准。

KXCI + Python 3 应用说明：https://download.tek.com/document/1KW-74006-1_4200A-SCS_Parameter_Analyzer_KCXI_Python_Application
_Note_050924.pdf


4. 厂商维护的 GitHub 4200A 示例
首选仓库：https://github.com/tektronix/keithley。该仓库位于厂商组织下，但不代表每段 Demo 都承诺正式技术支持。

目录/文件                          覆盖内容                                                                DKTS 用途

SMU System Mode                固定偏置、线性/对数/List、多通道、Family of Curves                                P0：SMU 原生扫描

SMU User Mode                  点测量、基本 source-measure                                               交互式点测量

PMU                            Pulse train、PIV、Segment Arb、同步测试                                    P1：PMU 引擎

CVU                            C-V、C-F、C-T、线缆补偿                                                    检测到 CVU 后启用

CVIV                           I-V + C-V + 多路开关                                                    需要 CVIV 与用户库


重点链接：KXCI Examples、SMU System Mode、PMU Examples、CVU Examples、CVIV Examples，以及 family_of_curves data
retrival.py、pmu segarb b.py、pulse vds-id with LLEC.py。链接见 Markdown/Word 版本和 ZIP 资料包。


5. KXCI 执行路径




路径                          命令族                                                            用途

SMU System Mode             CH / SS / VR / IR / VP / IP / VC / IC / ME                     仪器内部执行扫描




                                                     DKTS | FS-Pro / 4200A Reference Research V3 | 3
<PARSED TEXT FOR PAGE: 4 / 6>
路径                       命令族                                                            用途

SMU User Mode            US / DV / DI / TI / TV                                         点测量和顺序式操作

PMU/PGU                  :PMU:...                                                       脉冲、波形和 Segment Arb

CVU                      :CVU:...                                                       电容、阻抗和频率扫描

KULT User Library        UL / EX / GP / AB                                              自定义编译模块



5.1 Ethernet 与状态字节

•   KXCI Ethernet 命令必须以 NUL 结束；无查询结果的命令仍可能返回 ACK + NUL。

•   Ethernet 使用 SP 读取状态字节；DR 是 GPIB service-request 机制，不用于 Ethernet。

•   测试开始前 :ERROR:LAST:CLEAR，执行后 :ERROR:LAST:GET。

•   状态字节：B0=1 Data Ready，B1=2 Syntax Error，B4=16 Busy，B6=64 RQS。按位解析，不可只判断 0 或 1。


5.2 VAR1 / VAR2




命令                  含义                                           参数

VR / IR             VAR1 扫描                                      起点、终点、步长、Compliance

VP / IP             VAR2 阶梯                                      起点、步长、步数、Compliance

VC / IC             固定偏置                                         固定源值与 Compliance

VL / IL             列表扫描                                         任意点列表


VAR1 在每次 VAR2 到达新阶梯值时重复。VAR2 每个 stepper 支持 1–32 个阶梯点，最多 4 个 VAR2 stepper。UI 可以统一存储
start/stop/step，但 VAR2 编译器必须转换为 start/step/count/compliance。示例 VP 2,1,4,100e-3 表示 2、3、4、5 V，不是 README
所述的 1–4 V。

5.3 安全停止与 PMU 数据

•   SMU：ME4 中止测试；随后按源模式发送 DVn 或 DIn 禁用输出并核验。

•   PMU：:PMU:ABORT 中止 PGU/PMU 流程并关闭输出。

•   :PMU:TEST:STATUS? 返回 1 运行、0 完成/空闲。

•   :PMU:DATA:COUNT? ch 查询各通道点数；:PMU:DATA:GET 每次最多 2048 点；每通道缓冲区最多 65,536 点。




                                                  DKTS | FS-Pro / 4200A Reference Research V3 | 4
<PARSED TEXT FOR PAGE: 5 / 6>
6. 厂商 Demo 审查
•    Family-of-curves README 与 VP 命令值不一致：README 写 Gate 1–4 V，代码 VP 2,1,4 实际为 2、3、4、5 V。

•    PMU 双通道 LLEC 示例的第二通道点数查询存在通道号错误；必须逐通道查询。

•    instrcomms.py 的通用 Socket 默认换行终止符不是 KXCI Ethernet 所需 NUL。

•    Demo 缺少完整生产级超时、断线、异常清理和输出核验。



7. 第三方参考
项目                    用途                                                          限制

PyMeasure             User Mode 类封装、状态位、ACK 检查                                    不负责 VAR1/VAR2 System Mode

Py4200A               板卡抽象、SMU STEP/SWEEP、结果对象                                    README 标记开发中

Switchbox_GUI         实验室脉冲工作流、KULT UL/EX/GP、自定义 C 模块                             GPIB/自定义模块，不是通用原生 KXCI

Probe-Automation      探针台与 4200A 外部协调                                             不是底层驱动



8. 当前设备适配
项目                 当前已知                                                       处理

仪器                 4200A-SCS；IDN 曾返回 SN1498377 / V1.14                        启动时重新读取

模块                 SMU + 4225-PMU 已知                                          用 *OPT? 识别槽位

RPM                是否安装未知                                                     不启用依赖 RPM 的 LLEC

CVU/CVIV           是否安装未知                                                     检测到后才展示

连接                 169.254.111.118:1225                                       沿用现有以太网中继

终止符                NUL                                                        不能用 LF/CRLF

Clarius            版本未知                                                       查询 systeminfo / clariusver


IDN 的 V1.14 不应直接等同于 Clarius 应用版本。*OPT? 返回槽位配置；必要时通过 SystemUtil 的 instrumentinfo、remotemoduleinfo 和
systeminfo 获取更详细模块信息。


9. Agent 实施顺序
•    Phase A：硬件识别、KXCI Ethernet、NUL 终止符、错误队列。

•    Phase B：SMU System Mode 固定偏置、VAR1、VAR2、List、ME1/ME4、状态和数据读取。

•    Phase C：SMU 输出关闭、Compliance 退出、超时、断线和未知状态处理。

•    Phase D：PMU pulse train、PIV、Segment Arb、分块读取和 :PMU:ABORT。

•    Phase E：User Mode 点测量、数据分析、工程模板。

•    Phase F：检测到硬件后再扩展 CVU/CVIV/KULT。



10. 核心验收项
ID          项目                            通过标准

H01         硬件识别                          识别 SMU / PMU / RPM / CVU

C01         通信                            NUL、ACK、查询响应正确

S01         VAR1                          起止、步长、点数正确

S02         VAR2                          start/step/count 转换正确




                                            DKTS | FS-Pro / 4200A Reference Research V3 | 5
<PARSED TEXT FOR PAGE: 6 / 6>
ID         项目                       通过标准

S03        嵌套                       每个 VAR2 值执行一轮 VAR1

S04        状态                       状态字节按位解析

S05        SMU 停止                   ME4 后禁用活动 SMU 并核验

P01        PMU 停止                   :PMU:ABORT 后输出关闭

P02        PMU 数据                   逐通道计数、2048 点分块无丢失

D01        零读数                      合法 0.0 不被误判

D02        断线                       无法核验时显示未知状态

D03        复现                       保存参数、模块、命令、状态、原始数据



11. 最终开发原则
•    当前 Rev F / Rev G / PMU Rev D 优先于旧版 PDF 和 README。

•    SMU 原生 VAR1/VAR2 优先于 Python 外层循环模拟。

•    PMU 使用独立命令、状态、数据和停止适配器。

•    硬件能力来自已安装模块与官方手册，不得从 FS-Pro 或第三方项目推断。

•    通信丢失时不得宣称输出已关闭。

•    测试保存 TestPlan、模块信息、命令日志、状态和原始数据。




                                      DKTS | FS-Pro / 4200A Reference Research V3 | 6