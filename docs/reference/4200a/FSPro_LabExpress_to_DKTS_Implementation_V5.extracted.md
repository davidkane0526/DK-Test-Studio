<PARSED TEXT FOR PAGE: 1 / 8>
                    LabExpress → DK Test Studio
                        4200A 测试程序开发规范 V5
                   逐点编译、偏压拓扑、受限表达式、原生执行门控与安全生命周期
                        依据《LabExpress 用户使用手册》2022.01 版及 Keithley 厂商示例




本次新增                                              状态

38 条手册功能到 DKTS 的映射索引                              已形成 CSV，可逐条追踪原手册 PDF 页码

22 项跨层验收用例                                        已形成 CSV，涵盖扫描、表达式、量程门控、异常及 Stress

配置快照 + 源 SHA-256                                  已实现离线代码及测试

DC 逐点偏压展开与 relativeTo                             已实现离线代码及测试

`getx/getp/scale/Inst` 安全表达式子集                    已实现受限 AST 解析及拒绝用例

4200A SMU 原生候选判定 + 命令预览                           仅 dry-run，不含测试启动

SMU/PMU 实际通信与安全停止                                 尚未真机集成，不能声称完成



文档边界：本 V5 是“可执行离线规格与参考实现”，不是已验证的 4200A 仪器控制程序。示例中的模拟量程不代表真实硬
件能力。




                          DKTS / LabExpress 源手册映射 V5 · 原手册 PDF 页码均可在追溯表中核查
<PARSED TEXT FOR PAGE: 2 / 8>
1. 研发范围与资料依据
V4 基于完整 106 页 LabExpress 手册建立界面和测试模式映射。V5 不再扩充泛化介绍，而是将可能改变器件实际测量结果的
配置语义做成 Agent 可复用的代码和可审计证据。

内容来源                                核实位置                                 可得结论

LabExpress 手册                       PDF 6, 8–9, 17–21                    Page / Spec / Routine、端口与连
                                                                         接、Info/Sweep/Target/Strategy

LabExpress 手册                       PDF 34–36                            库模板、Routine、DUT 测试配置是不同实例

LabExpress 手册                       PDF 37–43                            优化 DC 与保序 DC、X/P、六种 Sweep、相对
                                                                         偏压、时域采样

LabExpress 手册                       PDF 61–66                            波形段、Cycle 与 Measure Event 分离

LabExpress 手册                       PDF 79–88                            HCI/BTI/TDDB/RAMP 测试规则

LabExpress 手册                       PDF 96–103                           getx/getp/scale/Inst 及 Target 函数列表

Keithley 厂商 GitHub                  SMU System Mode / family_of_curves   CH/VR/VP/VC 扫描组合示例

Keithley KXCI 另册                    当前版本应优先 Rev F                        硬件命令和量程需独立核验



本报告引用的“PDF 页码”是文档阅读器页码。第 38 页对应原文印刷第 34 页。2022 版手册中的 FastIV 性能属于概伦对应
硬件，不是 4225-PMU 的参数。



2. Page 和执行计划的区别




                   图 1｜原手册 PDF 第 18 页：Edit Page Sweep 设置。原图用于说明布局与字段，非 DKTS 界面成品。

Page 代表可修改的测试配置。TestPlanSnapshot 是执行瞬间冻结的完整配置副本。CompiledPointPlan 是依照指定 X/P
顺序解析出的偏压点列。InstrumentCommandPlan 必须在能力数据库验证后才能生成，并且必须经状态控制器执行。

1.   选择 DUT 或测试模板：创建独立 Page，不把“库模板”当成多项目共享的可变对象。



                            DKTS / LabExpress 源手册映射 V5 · 原手册 PDF 页码均可在追溯表中核查
<PARSED TEXT FOR PAGE: 3 / 8>
2.    编辑逻辑端口、relativeTo、X/P/Condition、量程和 Compliance；每次变化都可以重新离线编译。
3.    启动测试前冻结 Page，并记录 SHA-256、设备 ID、槽位信息、实际能力数据库版本及软件版本。
4.    编译偏压点列和原生执行候选；若不满足条件应提供明确拒绝原因，不能静默退化为不等价扫描。
5.    先通过硬件校验，再保留日志进入 Running；发生 Stop 或断线要分别处理并验证输出。



3. X/P 扫描语义和绝对偏压展开
原手册 PDF 第 19 页规定，一个测试有且仅有一个 Xsweep，最多一个 Psweep，其余输入为 Condition。X 与 P 是“逻辑扫
描值”；物理 SMU 输出必须在展开相对节点后计算。

逻辑规则                                 编译动作                                 需要拒绝的情况

Xsweep 恰好一个                          产生有序 X 点列                            无 X、两个 X、时间 X 被误配置到 DC 模式

Psweep 可选一个                          P 在外、X 在内生成点列                        多个 P 或无 P 却调用 getp()

Condition 可引用 X/P                    受限表达式按点求值                            语法非法、未定义变量、引用环

relativeTo 是参考节点                     Vterminal = localBias + Vreference   节点不存在、环形参考

Linear Step 末点对齐 Stop                可能产生非等步长末段                           不能强制转成单次 VR 线性扫

多段扫描保序                               记录段索引和边界                             未经允许合并重复边界点



     # 例：Source = 1 V，Vds = X，Vgs = P
     # 源极实际电位 1 V；漏极为 1+X；栅极为 1+P
     # X=0.5, P=-1 时：Vs=1, Vd=1.5, Vg=0



当前参考代码会计算这种相对偏压，但如果相对电位使 X/P 的实际物理通道波形偏离简单 VAR1/VAR2 模式，会拒绝“单次原
生扫描”候选。这样比生成可能错误的 CH/VR/VP 指令更可靠。



4. 受限表达式引擎




                            图 2｜原手册 PDF 第 40 页：使用 Generator 让 Condition 跟随 X/P。




                           DKTS / LabExpress 源手册映射 V5 · 原手册 PDF 页码均可在追溯表中核查
<PARSED TEXT FOR PAGE: 4 / 8>
官方手册支持 getx()、getp()、scale()、Inst(name, default)，并列出了丰富的数学函数。V5 仅实现可验证子集：基本算
术、受限幂运算、上述四类函数与设备参数常量，不假装兼容整套 LabExpress Target 语言。

表达式                             编译语义                            注意

getx()                          当前扫描内层点值                        只能在明确 X 上下文使用

getp()                          当前外层 P 点值                       没有 Psweep 时返回错误

scale()                         N/单极性为 +1，P 为 -1                极性须显式声明

Inst("W",3)                     读取 DUT 数值参数 W，缺失时用 3            模板参数执行时冻结

0.1*getx()+getp()               逐点数值计算                          符合 UI 语义不保证原生硬件映射



安全要求：禁止 eval、__import__、属性访问、下标索引、对象构造和任意 Python 表达式。测试脚本含 9 组恶意/越界表
达式拒绝案例。



5. 原生 KXCI 候选与拒绝理由
4200A 官方 family_of_curves 示例通过 CH 将 SMU2 设为 VAR1、SMU3 设为 VAR2、SMU1 设为常数，再用 VR/VP/VC 执行
测试。V5 为简单线性电压扫描生成“dry-run 命令预览”，但缺少任何实际执行/启动函数。

条件                                                 候选结果

X 为严格等步长 Linear Step                               可继续判断

P 为严格等步长且不超过 32 步（按 Rev E 示例）                      可继续判断；Rev F 仍需核对

Condition 对每个扫描点都是常数                               可继续判断

X/P 对应物理输出即逻辑扫描值                                   可继续判断

每个通道独立且参数在已验证模块能力范围内                               可继续判断

任意条件不满足                                            阻断本原生候选，报告需要 List、拆段或其他后端



注意：这不是说 DKTS 永远不支持复杂参考拓扑或多段扫描，而是说当前“单次 VR+VP”试点适配器不能冒险执行。后续应
分别实现 List/Split、Per-point、PMU/KULT Adapter，并逐个完成真机验收。
   # V5 的静态示例（没有 ME 1，永不自动启动输出）
   BC
   DE
   CH 1, 'V1', 'I1', 1, 3
   CH 2, 'V2', 'I2', 1, 1
   CH 3, 'V3', 'I3', 1, 2
   SS
   VR 0, 1, 0.25, 0.001
   VP -1, 1, 3, 0.0001
   VC 1, 0, 0.001
   SM
   DM2
   LI 'I1', 'I2', 'I3'



输出仍标记为 DRY_RUN_ONLY 和 executionAuthorized=false，且要求使用最新 KXCI Rev F、真实槽位能力及状态机验
证，不可直接发送到 4200A。




                       DKTS / LabExpress 源手册映射 V5 · 原手册 PDF 页码均可在追溯表中核查
<PARSED TEXT FOR PAGE: 5 / 8>
6. IVT、PMU 与 Stress：保留独立执行语义




                图 3｜原手册 PDF 第 43 页：IVT 的时间电压表格，采样时间轴与施加波形不可混淆。

IVT 的 Xsweep 是 Time，Switching Step 与 Sampling Step 分开；波形发生与数据采样不应该按 DC VAR1 解释。PMU 任意
波形也必须把“生成波形”和“测量事件”定义为两个对象。V4 已提供 UI 配置样例，V5 不冒充已有真机执行实现。




                    DKTS / LabExpress 源手册映射 V5 · 原手册 PDF 页码均可在追溯表中核查
<PARSED TEXT FOR PAGE: 6 / 8>
6.1 波形与独立测量事件




             图 4｜原手册 PDF 第 66 页：PUND 及 Measure Event，Start/Interval/Average 分别配置。

Stress：手册 PDF 第 81 页 HCI 的 Last Point 终止条件，是将每个 Duration 后得到的测试结果最后一点与首次测量的最后一
点比较，Tolerance=0.1 表示 10% 容差。V5 的离线函数已实现相对偏差判定；原手册未明确定义初始点为零时的处理，因
此默认拒绝并要求用户设定绝对阈值策略。




                    DKTS / LabExpress 源手册映射 V5 · 原手册 PDF 页码均可在追溯表中核查
<PARSED TEXT FOR PAGE: 7 / 8>
7. 执行状态与数据安全




状态机由 Agent 正式实现。当前参考代码只有配置解析和命令预览；未实现仪器连接、Stop、采集、状态轮询和数据增量保
存。

状态 / 事件                                       要求

Validated                                     Schema、扫描顺序、偏压拓扑、设备量程独立通过

Armed                                         资源互斥、设备模式核验、KXCI 初始化完成

Running                                       按适配器发出测试，记录原始命令与 ACK、时间戳

Abort requested                               SMU/PMU 分别执行正确 Abort，不能只断开 Socket

Output verification                           重新读取仪器状态与错误；确认输出已关闭

Transport error                               标记 OUTPUT_STATE_UNKNOWN，不得报告已安全停止

Finalizing                                    原始数据与派生数据分开，保留未完成数据和错误记录



应沿用 V4 的 TestPlanSnapshot → RawMeasurement → DerivedTrace → SpecResult 数据契约，并由 DKDS 绘图引擎显
示。手册 PDF 第 90、94 页提示了大工程懒加载和异常退出后配置未保存的问题，DKTS 应提供原子化保存与恢复能力。



8. Agent 的交付顺序（务必按验收门槛）
1. P0 / Step 1：先对当前 DKTS 代码建立差距表，确保现有连接与 UI 不被改坏。

2. P0 / Step 2：引入 V5 schema、Page snapshot、X/P/Condition 与 relativeTo 离线编译器；新旧配置需显式迁移。

3. P0 / Step 3：引入 capability evidence 接口，只有真实已安装模块并验证过时才将测试标记可运行。

4. P0 / Step 4：按最新 KXCI 手册实现 native System Mode 扫描，完成 2T/3T 的配置、读取、停止与异常处理。

5. P1 / Step 5：扩展 List、多段、双向、脉冲、IVT、PMU 波形及测量事件，并逐模式验证时序。

6. P1 / Step 6：接入 DKDS 数据中心、原始数据保存、历史叠图与模板库，完整复用 DKDS 图形交互。

7. P2 / Step 7：Stress、Spec/Target、批量器件与高级自动化。




                      DKTS / LabExpress 源手册映射 V5 · 原手册 PDF 页码均可在追溯表中核查
<PARSED TEXT FOR PAGE: 8 / 8>
9. 资料包中可直接给 Agent 的文件
文件                                                              用途

AGENT_START_HERE_V5.md                                          严格执行顺序、禁止事项和验收条件

reference/manual_traceability_v5.csv                            38 条原手册功能映射，含 PDF 页码

reference/acceptance_matrix_v5.csv                              22 个跨层验收用例

reference/offline_compiler.py                                   纯离线语义编译器和 DRY_RUN 候选

tests/test_v5_compiler.py                                       36 个 V5 单元测试

schemas/dc_offline_v5.schema.json                               试点 DC Page 输入 Schema

examples_v5/*.json                                              3 个 DC 页面示例、实际展开点列、命令预览和模拟 fixture

原 V2/V3/V4 文件                                                   早期官方资源、扫描模式、UI 资料与示意图




10. 关键验收用例节选（完整清单见 CSV）
ID                                      情景                                       正确行为

V5-04                                   Source=1 V 且 Vgs=-1 V                    Gate 物理偏压应为 0 V

V5-05                                   Vsource 与 Vdrain 互相引用                    拒绝编译，说明存在偏压拓扑环

V5-06                                   Condition=0.1*getx()+getp()              逐点计算；非恒定情况不可映射单次普通
                                                                                 VR/VP

V5-07                                   注入属性访问或 __import__                       解析器拒绝，不执行任意代码

V5-10                                   0→1 V, step=0.3 V                        末端精确包含 1 V，不能用等步长 VR 强行替代

V5-12                                   P=-1,0,1; X=0,0.5,1                      得到 P 外、X 内 9 个有序点

V5-13                                   Psweep 33 个点                             不可作为本单一 VAR2 native 候选

V5-14                                   无已验证能力来源                                 禁止进入可执行硬件指令阶段

V5-16                                   Dry-run 命令预览                             不包含 ME 1 和 *RST，也不允许调用仪器

V5-18                                   Stress 首次结果为 0                           禁止默认除零，相对容差策略需明示

V5-20                                   网络突然断开                                   报告输出状态未知，不得宣称已安全停止

V5-21                                   PMU 返回数据超出单次读取上限                         逐通道分块，核验点数并保留状态



交付声明：V5 所有示例均不自动向任何设备发送命令。真机测试需要实际安装的 4200A 硬件、正确接线、KXCI 设置以及经
过核验的能力数据库。




                                DKTS / LabExpress 源手册映射 V5 · 原手册 PDF 页码均可在追溯表中核查