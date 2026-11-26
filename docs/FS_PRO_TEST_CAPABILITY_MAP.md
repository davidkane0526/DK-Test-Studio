# FS-Pro 测试语义与 4200A 能力映射

设计约束：不新增常驻硬件按钮，不把每条 KXCI 指令变成控件。普通测试页面保留 FS-Pro 的 Xsweep / Psweep、Input、Target / Measure Event、Strategy 和原始数据图。公共层负责模块识别、实际接线路由、执行、停止与入库。只有实际可执行的参数可参与测量；保留的旧规划参数不得静默忽略。以下是开发覆盖矩阵，不是实机验收声明。

| 测试任务 | 用户配置的语义 | 底层公共能力 / 指令 | 当前覆盖 |
| --- | --- | --- | --- |
| DC 优化扫描 | 电压起止、步长、内外扫描、固定偏置、限流、积分和延迟 | System Mode / VR VP VL VC IT DT HT ME1 | 基础电压模式；Log / Generator、电流源、固定档待完善 |
| 时间测试 | 固定偏置、起始等待、读数后等待、点数、速度 | WT IN NR IT ME1 | 基础单段固定电压偏置；多段/多事件仍为规划 |
| 脉冲测试 | 幅值、基线、周期、脉宽、读出窗口、量程 | PMU route, pulse source & measure, buffered acquisition | 已有参数规划、RPM 别名；执行待接入 |
| 循环/保持 | 写入、保持、读出、循环、读数计划 | 原生任务组合、已确认路径自动切换 | 待执行集成 |
| CV | 频率、交流振幅、直流偏置、测量模型 | CVU sweep & compensation | 待实现 |
| 仪器管理 | 实装模块、接线、校准日期、校准/补偿 | IDN OPT SystemUtil AC PMU/CVU compensation | 已读版本和校准信息、保存人工确认接线；校准操作待完成 |

默认由测试选择硬件路径：已确认 SMU2↔PMU1-1 的接线，DC/Time 继续使用 SMU2，Pulse 参数规划自动选择 PMU1-1；未确认拓扑时不猜测。接线记录与仪器序列及模块/附件身份关联；相同模块重新接线仍须人工更新。选择端口不会立即产生输出或切换继电器。手册未证明继电器状态可以通过现有指令读回，ACK/SP 不是物理读回。真实 RPM 切换须受控现场验收。

后续优先补齐可运行的 DC 电流源、量程与积分、PMU 原生任务、接收数据分块及校准。高阶时序交给实际硬件，显示刷新不控制采样。


2026-11-25：Optimized DC 电流源 IC/IR/IP/IL 和单轴指定点数对数扫描已接入源码；固定档及自定义 Target 图轴/公式尚未完成，继续保留 FS-Pro 参数结构。

2026-11-25：DC Local Strategy 支持 Fast/Normal/Quiet，原生 HT 首点保持与全分辨率回收；旧秒数需主动选定速度，固定量程仍待独立核验。

2026-11-25：PMU 单通道原生编译、停止、分块回收及原始字段接入审查源码，真实输出仍关闭。多通道与混合 SMU 偏置待开发。

2026-11-25：Pulse 可选 Psweep 第二端子，Spot Mean 原生嵌套幅值扫，两路独立表。真实输出门禁未解除；波形双通道和更多混合序列待核验。

2026-11-25：Pulse Custom sequence（Segment Arb）单序列可重复、独立时序段、可选测量窗口、固定量程，复用 PMU 原生任务。尚未支持多序列列表及双端子 SARB，实际输出仍待验收。

2026-11-25：Segment Arb 多序列按顺序执行，每块独立循环，累计采样及连续性校验；单次启动，原始数据不推断序列归属。仍待双端子实机核验。

2026-11-25：双通道自定义时序独立定义及精确总时长检查，单次原生启动及独立回收；尚未验证真实同步误差、跨 SMU/PMU 调度。

2026-11-25：单轴原生双向扫（转折点一次）、固定偏置多目标共同采样时钟已接入；独立事件/多段、Generator、固定档、混合输出及 Target 仍未完成。

2026-11-25：逐点 TI/TV 区分实际回读、设定值和时间来源；实测门禁不变。

2026-11-25：DC 自定义 Target X/Y 实测列和专属图窗已接入，公式/H/P 待实现。

2026-11-25：Native Fixed Bias 支持电流偏置、独立电压保护及混合固定源模式；仍单段共同采样时钟。

2026-11-25：Segment Arb 当前端子/序列单循环计划波形和测量窗口预览，修复序列段编辑作用域错误。

2026-11-25：DC Generator 仿射 getx() 原生线性 VAR1' 已接入，非线性/getp() 和其他模式仍待实现。

2026-11-25：Pulse Xsweep 多点基线扫、固定峰值、最低自动电流档、波形前后采集已接入。Psweep 仍为幅值；双路波形待核验。

2026-11-25：Routine 支持按页顺序编排原生 SMU/PMU 测试、独占执行与按阶段原始数据归档；同一时刻的混合输出仍未实现。

2026-11-25：DC Optimized 支持 B 端及四 SMU，按 LI 六信号约束保留保护与所选目标；逐点 B、Time B 尚未开放。

2026-11-25：Time 原生多段偏置列表（每段读数+共同稳定等待），实际仪器时间戳；多变化端主从列表编译待实机门禁，绝对独立事件时钟未完成。

- Target: `set` 逐点运算、X/Y 表达式与别名已接入；H/P、向量函数及派生导出待完成。历史曲线按采集循环/外层扫描点分组。

- Pulse: Psweep baseline steps, independent limited autorange, paired waveform plan (equal-length parallel sweeps/fixed train) compiled. No native nested waveform step implied; physical output unverified.

- Generator: nonlinear/getp() via native list compiler, with original X/P index. Multi-channel list output requires commissioning; no per-point network execution.

- Target H/P: H expression + separate DKDS frame, P source-level filter, full independent computed CSV. Same-frame secondary Y axis requires DKDS renderer support.
