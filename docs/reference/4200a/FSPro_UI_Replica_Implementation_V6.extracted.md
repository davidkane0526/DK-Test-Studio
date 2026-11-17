<PARSED TEXT FOR PAGE: 1 / 5>
DKTS — LabExpress 复刻级 UI 规范
V6 · 硬约束 / Agent 可执行交付 · 2026-11-06

目标：界面层级、控件分组、字段位置与操作路径严格按 LabExpress 2022.01；仅以 Keithley 4200A 替换真实仪器能力和命令
实现。



1. 禁止“参考风格后重新设计”
      不得将主窗口改造成卡片式仪表盘。
      不得将 Edit Page 拆成分步向导。
      不得把 Sweep / Target / Strategy 合并或移动。
      不得将 Limits / Page Var / Associate Spec 改成侧边栏。
      未安装的 4200A 模块不虚构能力，但不得因此改变原有页面结构。



2. 主工作区：手册 PDF 第 7 页




固定阅读顺序：①菜单区 → ②工具栏 → ③工程导航与器件面板 → ④ Page/Spec 树 → ⑤右侧多 Frame 结果检视区 → ⑥消息/日
志与测量设置。

    区域                                原生位置              不可替换为
    Menu / Toolbar                    窗口最顶部连续两行         悬浮控制岛

    Project + Device                  左侧树与表             平铺卡片列表

    Page / Spec                       左侧选中 Routine 下方   全局无层级测试按钮

    Visual Area                       右侧多 Frame         单独全屏图表

    Log + Measurement Setting         结果区下方             新的顶端模式栏
<PARSED TEXT FOR PAGE: 2 / 5>
3. Edit Page：手册 PDF 第 18–20 页
下图是页面主参考图。所有字段归属、端子排列、操作按钮、标签行和底部三栏必须照此组织。




位置                                           严格顺序 / 内容
顶端 Info                                      Type → Polarity → Group → Test Type → Name

操作按钮行                                        Lock/Unlock → Reset → Set Connection → AutoScale → UnScale

标签                                           Sweep → Target → Strategy

Sweep 首行                                     RefNode → 参考偏置 → Outputs

Input Setting                                器件端子依原顺序逐行排列；每行 Voltage/Current、Ref to、
                                             Condition/Xsweep/Psweep、信号类型、参数及 +/- 分段

Sweep 尾部                                     Limits | Page Var | Associate Spec 横向三栏

对话框底部                                        OK / Cancel




3.1 端子行必须保留的编辑逻辑
偏压方式（Voltage/Current）和相对参考节点（Ref to）属于同一个端子行；扫描角色（Condition/Xsweep/Psweep）与发生方
式（Constant/Linear Step/Linear Points/Log Points/List/Generator）在该端子行配置。多段按原位置追加在对应端子内，不弹
出独立参数向导。
<PARSED TEXT FOR PAGE: 3 / 5>
3.2 Target 标签：手册 PDF 第 19 页




上方是公式编辑器；右侧 Function Info；下方 Plot(X/Y/H/P)、Page Var、Quote Var 三栏。不得移动到全局数据分析区。

3.3 Strategy 与连接设置：手册 PDF 第 20–21 页
Strategy 保留 Global Setting 与 Local Setting 结构。Set Connection 单独打开编辑连接/通道映射窗口；该窗口只将 FS-Pro 通
道选项替换为 4200A 的真实资源。



4. 各类型的专用参数布局
类型                             页面参考                           关键布局约束
DC / DC Point By Point         PDF 37–41                      Page 的 Sweep 设置不变，时序参数在 Strategy
                                                              中按原组展示

IVT / Table Input              PDF 42–43                      Time Xsweep、Switching Step / Sampling
                                                              Step / Cycles、表格窗口

Pulse IV                       PDF 44–45                      对应 Pulse 测试类型和参数组，按 4200A 硬件
                                                              限制显示数值

FastIV / WaveForms             PDF 61–62                      左树操作、中通道设置与预览、右侧波形段表、
                                                              底部测量事件

Stress                         PDF 79–85                      Stress Routine、条件、停止判据和运行管理

图表数据                           PDF 23–27                      Frame、叠图、P 轴、Data Viewer、导出位于
                                                              相应路径
<PARSED TEXT FOR PAGE: 4 / 5>
4.1 IVT：保留时间 Xsweep + 表格数据编辑




4.2 任意波形编辑器：上下结构不能变
<PARSED TEXT FOR PAGE: 5 / 5>
上部是波形名称、通道、Type、Cycle 与波形编辑；表格列顺序是 Index / Time / Duration / Bias。最下部独立一整行：
Measure Event / Start Time / Interval Time / Average Time / Point(s)。



5. 设备能力与软件外观彻底分离
 UI 位置固定                                                    实际 4200A 处理
 Source / Drain / Gate 等器件端子                                通过 Set Connection 关联实际 SMU/PMU 资源

 Range / Compliance / Timing                                能力数据库和已装模块控制选项及校验

 PMU 波形设置                                                   根据 4225-PMU / RPM 的真实能力启用

 CVU/CVIV 选项                                                未安装则保留原布局，标记不可用及明确原因

 Measure / Stop                                             原位置保留，底层分别映射到 KXCI 测试/中止流程




6. Android 与插件版保真
宽屏依照原 UI 空间层级；窄屏只允许对同组内容换行、滚动或缩放，不能改变字段排列顺序及归属。插件版复用同一 Edit Page
实现，DKDS 只负责宿主标签与绘图引擎。



7. UI 验收方法
1.   为每个 Screen 保存相同宽高、相同选中状态的 FS-Pro 参考图和 DKTS 实现图。
2.   依据 `UI_Fidelity_Acceptance_V6.csv` 逐项核对 35 条要求；核心项全部达标后方可合并。
3.   检验参数来源、顺序、可见性、标签、事件行为，不只检查页面“看起来差不多”。
4.   必须提交新旧界面的并排截图和差异清单；没有截图的功能不得报告已实现。
5.   硬件兼容例外须在差异登记中逐条注明，不准以硬件不一致为由随意改版面。

源文档：用户上传《LabExpress 用户使用手册》（产品版本 2022.01，2022-06，106 页）。该文档说明的是 UI 复刻标准，不代
表 4200A 真机功能已经实现。