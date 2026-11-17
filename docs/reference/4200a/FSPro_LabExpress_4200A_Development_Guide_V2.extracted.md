<PARSED TEXT FOR PAGE: 1 / 26>
从 LabExpress 到 DK Test Studio｜4200A
测试程序产品与工程实施规范
以配置、测试、逻辑为中心的 Agent 可执行开发文档
V2
开发规格 / 功能复刻参考
2026-11-05


从 LabExpress 到 DK Test
Studio
4200A 测试软件开发规格 V2.0
核心目标： 在 Keithley 4200A-SCS 上建立一套具有
LabExpress 工作习惯的专业参数测试系统。优先复刻
器件—测试项目—端口配置—扫描定义—执行—数据分析
的配置和操作逻辑，而不是按 FS-Pro 硬件能力或旧版 Windows
视觉样式仿造。

适配对象： DK Test
Studio（DKTS）独立程序、以同一功能核心形式运行的 DKDS 插件。

正文证据标识： [O]
官方明示；[I]
根据可官方界面分析得出的；[R] 针对 DKTS
的要求/设计决策；[V] Keithley KXCI Rev. E
程手；[T]
待真实仪器验证。四类不允许混写成“FS-Pro 本来如此”。

     文档边界：已获取 LabExpress 官方公开产品单页（2024
     版，2 页，含多张软件实际页面缩略图），但没有取得可逐项核对控件的完整
     LabExpress
     操作手册。本文绘制的八张大图是独立设计示意，并非厂商软件截图。要逐像素或逐菜单
     1:1 复刻，必须另取得完整原厂使用手册。4200A KXCI 的逐命令查证基于官方




                                                  DKTS / FS-Pro implementation guide V2 | 1
<PARSED TEXT FOR PAGE: 2 / 26>
  Rev. E（2025 年 3 月）；Tektronix 目录在 2026 年 10 月列出了
  Rev. F，上线前必须完成差异核查。

官方 LabExpress 原始界面缩略图入口：LabExpress
产品单页第 2
页 (https://khai-long.com/uploads/20240920/CN_LabExpress_Sep.2024.pdf#page=2) 。该页包含工具栏和设备列表、双击编辑的算法列表、多窗口曲线、变换工具、图形化设定页、器件树、脚本编辑
器、测试项目数据库等九组图片，推荐开发者打开原件在浏览器中放大核对。完整外部资料的来源见文末“证据索引”。




                                          图示｜官方证据归纳的产品工作流（DKTS 原创示意，非 LabExpress 原厂截图）




                                                                                                DKTS / FS-Pro implementation guide V2 | 2
<PARSED TEXT FOR PAGE: 3 / 26>
1. 这次开发应当复刻什么

1.1 产品功能与 4200A
底层能力要分开
 模块               LabExpress 可公开确认的能力 [O]              DKTS 应复刻的操作行为 [R]            4200A 实现边界 [V/T]
                                                       选器件后生成合理的默认端子及测试列表；端子可增减/改
 器件库              MOSFET、BJT、二极管、电阻、电容、自定义器件                                        由用户逻辑端子映射至可用 SMU/PMU/CVU；具体资源需确认
                                                       名
                  DC IV、Pulse IV、瞬态 IV、任意波形、CV、噪声和可靠   测试卡模板化，双击或点击打开参数；支持复制、改名、
 算法库                                                                                不支持的测量家族不能用“假数据”代替
                  性等                                   保存预设
                                                       一套一致的描置模型，不因不同而改字段
 扫描函数             线性、对数、散点、多段、双向、带参数扫描                                              先编译为可检查的扫描计划，再择优映射 KXCI
                                                       义
 设备控制             及第三方表、探台等接口                          端口角色与物理设备分离；资源可配置            4200A 的 KXCI 普通模式，不应假装是概伦命令
 数据显示             多窗口显示、数据合图、图形变换、表达式分析                实时曲线、叠加、原始表、分析工作区并存          以驱动采集的原始测量点为唯一事实来源
 项目保存             工程与数据数据库保存、随时回看                      配置快照/运行记录/曲线视图/派生分析分离持久化     支持运行中断后的 partial 数据恢复
 扩展               脚本化算法、自动化及晶圆映射                       先提供高层流程节点与可保存预设，后续再实现高级任务    先单仪器独占，暂不承诺晶圆级自动化


1.2 开发定位：模仿
操作逻辑 而不是原厂像素
优先级顺序必须固定：
组件完整、参数正确、操作路径顺畅、数据可信、安全可中止，其次才是装饰性外观。采用
DKDS 有件、表引擎、移端手和据中心接口；立 App 与 DKDS
插件用同一界面核心，不得维护两套分叉测试模块。

不应再出现的错误： 把量程和 compliance
混为一谈；为每个测试重新造一套端口选择器；页面塞满描述性状态文字；将 X/P
都做成起止；自未到的据；多段描成慢速逐点命令而不提示序化；UI
前端直接拼 KXCI 字符串；允许同时运行两个测试。




                                                                                         DKTS / FS-Pro implementation guide V2 | 3
<PARSED TEXT FOR PAGE: 4 / 26>
                              图示｜哪些是参考，哪些必须在 4200A 重做（DKTS 原创示意，非 LabExpress 原厂截图）


2. LabExpress
的真实页面组织：逐区域归纳
本节基于官方单页第 2
页九张软件缩略图；每一项在证据未达到的地方都明示限制。
 编号           原始画面（官方单页第 2 页）                   可直接观察到什么 [O/I]                       DKTS 的明确复刻规则 [R]
 L01          工具栏 + 仪器和设备列表                     上方集中工具栏；下方表格可浏览仪器资源和信息               统一测试工具栏与端口资源选择；不为每张卡设计不同操作区
 L02          测试算法列表                            测试项以列表/树展示，官方宣传明确“双击即可编辑”            模板是可编辑的对象；参数修改后能保存为用户预设
 L03          多窗口曲线                             多个曲线窗口可并排查看；可重复调用历史数据                画布中提供多图联动、图例切换、对比，而不是每次覆盖旧图
 L04          分析工具栏                             提供图像变换与计算设置界面                        原始数据不可修改；变换曲线只能作为可追溯派生层
 L05          器件树                               MOSFET 等类型分层组织，非单一“开始测试”按钮           新建器件时生成端子角色和默认算法组合
 L06          预设测试算法树                           建不同，按加                               用户首先选择测试目的，再微调源、测量、保护
 L07          图形化设定页                            多块设置表格集中在一个编辑界面                      高密度但对齐明确；各行控件高度和列宽一致


                                                                                         DKTS / FS-Pro implementation guide V2 | 4
<PARSED TEXT FOR PAGE: 5 / 26>
     编号                    原始画面（官方单页第 2 页）     可直接观察到什么 [O/I]                    DKTS 的明确复刻规则 [R]
     L08                   脚本编辑器               支持自定义算法的代码编辑工作区                   自定义流程与预设复用同一底层 IR、驱动和数据链
     L09                   项目与晶圆管理             项目数据与样品位置关联，可回看                   先实现 run/sample/project 关联；晶圆映射可后续实现
不作推断的内容： 这些缩略图不足以证实 LabExpress
某个具体字段的默认值、扫描事件先后次序、源量程下拉项、每个弹窗像素尺寸。以下提出的字段和交互主要是
DKTS 的产品规格，而非原厂控件目录。

2.1 应保留的用户路径
1.     在项目中选择器件或直接选择测量类型。
2.     从算法库生成测试卡，自动带入逻辑端口和默认参数。
3.     在顶部统一设置 Source、Drain、Gate、Body 的物理资源。
4.     选择 X Sweep 的端子、扫描形状和细节；需要家族曲线时启用 P
       Sweep。
5.     分别核验各端口的源模式、测量量程、compliance、积分、延迟和返回策略。
6.     “开始”先完成完整预检，产生不可变执行计划快照并分配唯一 runId。
7.     后台生成实际 KXCI
       命令并采集；图表、原始数据表和运行日志同步更新。
8.     测量完成、中止或失败后，保存配置、原始值、时间戳、状态、实际下发命令，支持合图分析和导出。

2.2 哪些动作可以节省操作次数
 常见操作                应设计的快捷方式                                   非预期情况
 创建相似测试              “复制测试”继承所有参数，但新建独立运行历史                     不能继承前一测试正在运行的状态
 切换扫描端口              端口下拉自动按模块能力过滤                              无效资源保留在已保存草稿中时，标红而不是悄悄替换
 关闭 P Sweep          原 P 端子恢复原先固定偏置定义                           不能把 P Sweep 的起始值自动覆盖固定偏置
 多段                  “添加段”并继承上一段可编辑默认值                          不允许重复边界点默默变化
 扫描方向切换              单向、反向、往返设置集中于 X Sweep                      方向变更立即影响预览与点数
 再运行一次               保留 UI 配置并新建 runId                          旧原始数据绝不覆盖
 曲线叠加                从历史运行中选择；不同测试条件自动形成图例                      历史数据不应在绘图时被重新计算成新“原始值”




                                                                                     DKTS / FS-Pro implementation guide V2 | 5
<PARSED TEXT FOR PAGE: 6 / 26>
3. DKTS 页面与组件规格




                                          图示｜工作区高保真功能线框（DKTS 原创示意，非 LabExpress 原厂截图）

3.1 信息架构和宽窄屏
宽屏 1366 CSS px 以上： 顶 部一行端口矩（
                           阵 （ Source /
Drain / Gate / Body / 可增扩
AUX），右侧一组“预检、开始/停止”；下方参数面板与图表主体左右排布。每个端口由“字段标签
+ 标准下拉”组成，别把不同高度的文字框与按钮拼在同一行。

窄屏： 顶部端口矩阵改成两行，每行 2
个端子，操作按钮可在两行之后独立靠右。参数面板适当折叠或占用全宽；数据图保持足够触控面积。断点由容器真实空间决定，不要为了满足“一行”把文字缩到不可读。




                                                                                       DKTS / FS-Pro implementation guide V2 | 6
<PARSED TEXT FOR PAGE: 7 / 26>
UI tokens 建议： 常规输入高度 40–44
px；同一行内所有输入、选择与按钮统一高度；分组内字段间距 8–12
px；分组间距 16–20 px；坐标标题 12–13 px；图标线宽与 hover 风格复用
DKDS，除风险状态不使用突兀高饱和度背景。UI token
是项目样式决策，不宣称来自 LabExpress。

3.2 布局密度规则
   顶部不能出现诸如“依据实际安装的
    …”、“仪器未识别仅允许离线配置”、“当前工作区…”这种长期占位描述。断连时只给短状态图标和简短可操作错误。
   参数区分层：
    X Sweep、P Sweep、Channels & Ranges、Timing、Protection、Advanced。常用项可见，低频项折叠，影响安全的项目绝不隐藏于不可见菜单。
   对源端、漏端、栅端每个端口，固定顺序为：资源 → 源模式/角色 →
    源范 → 量 → 量位 → compliance → 延迟/积分。
   测试类型标题、当前运行状态和单一开始/停止按钮共享一套 header
    组件。端口菜单内容从能力数据库派生，不能手写示例列表。
   数据图与参数拖拽分界应可调整；在移动端手势不能被透明覆盖层吞掉。数据图功能菜单应共用
    DKDS 绘图引擎。




                                                                                             DKTS / FS-Pro implementation guide V2 | 7
<PARSED TEXT FOR PAGE: 8 / 26>
3.3 端口选择器的严格行为




                                         图示｜逻辑端口与实际模块矩阵（DKTS 原创示意，非 LabExpress 原厂截图）

规则 ID      触发条件                                                       必须发生的结果
PORT-01    新建三端 FET                                                   默认展示 Source、Drain、Gate；Body 可选，不强制占资源
PORT-02    端口设为 None                                                  端子从本次计划禁用，不发送针对 None 的硬件命令
PORT-03    两个不兼容逻辑端口分到同一 SMU                                          禁止开始，明确指出冲突端子
PORT-04    为 Gate 选择 PMU，同时选 DC SMU 采样                                检查是否有经验证的同步与布线机制；未知即拒绝，不自动拼接
PORT-05    正在行中改端口                                                    本次 run 不受影响，UI 草稿标识“下次运行生效”
PORT-06    模板切换                                                       不删除用户已保存的可复用物理映射，必要时标红不兼容字段
PORT-07    仪器未连接                                                      允许编辑/保存草稿，但物理确认与执行仍受验证控制
PORT-08    加载旧版无效端口                                                   显示旧资源名且标为 unavailable，禁止静默改为 SMU1




                                                                                              DKTS / FS-Pro implementation guide V2 | 8
<PARSED TEXT FOR PAGE: 9 / 26>
4. 配置模型（最重要的一章）
系统应具有五种独立概念，页面必须能一一映射：

9.     LogicalPort：Source、Drain、Gate、Body
       是用户器件语义；
10. PhysicalResource：SMU1、SMU2、PMU1-1、CVU
       等硬件；
11. SourceRole：Common、Constant、X Sweep、P
       Sweep、Measure only、Disabled；
12. Measurement：选哪些电流/量、量量程、分置；
13. Protection：compliance
       和超限/异常处置，而非“测量档位”的别称。

4.1 源模式、量程与限值的区分
     用户名                        准确定义         显示 / 输入                              4200A 相关机制
     Source voltage/current     强制输出电压或电流    Voltage / Current                    CH D、VC/IC、VR/IR
     Source range               源输出范围        Auto / 可支持的固定范围                      SR；与测量量程不同
     Measure range              测电流/电压时的量程   Auto / Fixed / Limited Auto（按当前模块）   RG/RI/RV 等；并非每种模式都适合简单套一条指令
     Compliance                 源受限的保护阈值     如 1e-3 A、10 V                        电压源对应电流 compliance；电流源对应电压 compliance
                                                                                  IT / RS 等；测量时间与 UI
     Integration / resolution   仪器积分与分辨率     按命令可用模式提供
                                                                                  扫描速度不同
     Per-point delay            每点设值后等待再测量   秒，具有命令限制                             DT（Rev. E 为 0–6.553 s）
     Hold time                  后始描前等待       秒                                    HT（Rev. E 为 0–655.3 s）
固定档位不等于用户任意输入：
对固定电流测量量程，只能在真实仪器的合法量程集合中选择，建议科学计数法显示（1e-12 A,
1e-9 A, 1e-6 A）。对
compliance，则可提供数值输入，但必须用模块配置与 KXCI
命令限制校验。不能因为 UI
输入可自由编辑，就在仪器上虚构不存在的量程。
命令细节纠偏： RG
配置“自动电流测量量程的最小档位”；RI
指定流范立生效；RV
指定电压范围立即生效；SR
控制源范围。前一版把这些混在同一抽象项下，会直接导致错误
KXCI 生成。[V: Rev. E §5]




                                                                                        DKTS / FS-Pro implementation guide V2 | 9
<PARSED TEXT FOR PAGE: 10 / 26>
4.2 配置对象样例与接口
本包 schemas/recipe.schema.json
定义了所建议的可保存对象。examples/fet_output_family.json
演示 Source=SMU1 Common、Drain=SMU2 X、Gate=SMU3 P，X 为 0→2 V/0.1 V，P
为 −1→1 V/1
V。这只是设置示例，不是建议给真实样品施加的电压和限流阈值。运行前仍必须确认测试电缆、样品安全电压和装配状态。
数据类型要求：
用户输入电压、电流、步长和延迟序列在编译时先用十进制字符串保存与计算，避免
0.1 的二进制误差改变端点或点数。仪器下发参数另存
compiledValue，即使仪器驱动进行了量化，也不得修改
requestedValue 记录。

4.3 三种层次的有效性判断
   Schema 有效：类型与必填字段正确，step
    非零，次数为正整数。
   Experiment
    有效：端子角色不冲突，扫描方向正确，停止端点策略明确，总点数合理。
   Instrument 有效：模块型号、前置放大器、KXCI
    模式、实际命令能力和输出功率限制均允许该计划。没有真实识别时属于
    未完成物理验证，不是 已验证有效。

5. X Sweep / P Sweep 的唯一语义

5.1 概念定义
X Sweep 是内层测试扫描。 X
选一个角色端口，定义起点、终点、步长或点数、方向、单段/多段、等待、量程、扫描次数。

P Sweep 是外层参数扫描。 当 P 启用时，对每个 P
点先施加 P 偏置，再完整执行 X Sweep 的指定次数，然后再进入下一个 P
值。用户可以设置 P 的线性点列、手工列表和重复圈数。P
不启用时，其对应端口按用户设定的固定偏置执行。




                                                                   DKTS / FS-Pro implementation guide V2 | 10
<PARSED TEXT FOR PAGE: 11 / 26>
                                                  图示｜P 外层与 X 内层点序列（DKTS 原创示意，非 LabExpress 原厂截图）

    5.2 完整顺序和点数计算
    示例 A：X = 0、0.5、1 V；P = −1、0、+1 V；每个 P 下 X 完整执行 2
    次。
序列                 P(V)                X Repeat                      X(V) 序列                           产生点数
1                  −1                  1                             0, 0.5, 1                         3
2                  −1                  2                             0, 0.5, 1                         3
3                  0                   1                             0, 0.5, 1                         3
4                  0                   2                             0, 0.5, 1                         3
5                  +1                  1                             0, 0.5, 1                         3
6                  +1                  2                             0, 0.5, 1                         3


                                                                                                  DKTS / FS-Pro implementation guide V2 | 11
<PARSED TEXT FOR PAGE: 12 / 26>
序列                    P(V)                         X Repeat                  X(V) 序列                                        产生点数


合计                    3个P点                         每个 P 两次                   每次三个 X 点                                       18
每个采样点至少记录：runId, pCycle, pIndex, pValue, xRepeat, xIndex, xValue, segmentIndex, direction, sampleTime, measurements, status。文件中包含的
reference/scan_plan.py 给出确定性点序列展开示例。

5.3 各扫描模式（必须全部在
UI 上有清晰模型）
 类型                          必需参数                                    点序列特征                                      执行策略
 单向线性                        start / stop / step                     格包含可点                                      优先 VR/IR
 反向性                         start / stop / 负/正 step                 根据方向正确决定 step 符号                           VR/IR 或分批
 往返                          forward + reverse                       交界点重复与否必须明确配置                              可能由两批扫描组成
 对数                          start / stop / logMode                  禁止非法跨零；需要定义点密度                             VR/IR 的 log10/25/50 或编排
 散点/列表                       values[]                                保留顺序和重复值                                   首选 VL/IL 并遵循容量限制
 多段                          segments[]                              每段独立 start / stop / step / delay / range   优先分段原生执行，保留段号
 P 带参数                       P points + X plan                       对每一个 P 点完整执行 X                             优先 VAR1 × VAR2
 时间采样                        interval / count / fixed bias           X 轴为真实时间                                   SMU IN/NR/WT 有独立限制
 脉冲                          amplitude/base/width/period/window      PMU 专用时序与量程                                :PMU:* 分支，不能用 DC 时序参数


5.4 多段与边界点
示例 B：第一段 0→1 V，0.5 V 步；第二段 1→2 V，0.5 V
步长。默认连接处同一个 1 V 只采一次：最终
0, 0.5, 1, 1.5, 2（5
点）；若用户勾选“每段端点重复采样”，则为 6 点。段内不同 delay、source
range 不能被默默丢弃。
边界处理必须严谨：若
start=0, stop=1, step=0.3，在默认“必须到达终点”规则下应返回字段错误；只在用户选择“截断于最后可达点”或“补采终点”时才能改变行为，且写入元数据。禁止只在循环里反复
x += step 直到超限。

5.5 X/P 不是硬件的命令名称
X/P 是产品的扫描语义，硬件实际提供 SMU
VAR1/VAR2。一组 VAR1 在 P
每次更新时自动重复，能够直接表达许多 FET
输出特性与转移特性家族曲线。但存在多段、部分重复、非等间隔 P 点、PMU
混入等情况时，必须拆成多批。不能因为 UI
上两层扫描均存在，就保证底层一次命令支持任意组合。




                                                                                                                     DKTS / FS-Pro implementation guide V2 | 12
<PARSED TEXT FOR PAGE: 13 / 26>
6. 器适配：用配置到 KXCI




                                             图示｜三种编译路径与原生能力边界（DKTS 原创示意，非 LabExpress 原厂截图）

6.1 运行流程（关键）
用户编辑 Recipe
 → 表单实时校验
 → 点击预检／开始
 → 读取当前已验证 Capability Manifest
 → 验证通道互斥、源范围、compliance、点数和命令模式
 → 冻结 Recipe（含 hash / version）
 → 编译 Experiment IR（逻辑端口与点序列）
 → 后端选择 VAR1/VAR2 / List / 分批 / PMU/CVU 路径
 → 输出可审计的 Command Plan（仅预检，不先下发）



                                                                                             DKTS / FS-Pro implementation guide V2 | 13
<PARSED TEXT FOR PAGE: 14 / 26>
 → 获取全局仪器锁并检查运行状态
 → 依序下发，读取响应、状态和原始数据
 → 写入 immutable raw store / 更新曲线
 → 完成后安全关断，记录最终状态，释放仪器锁

6.2 KXCI page 状态不可忽略
KXCI SMU 的 System Mode 命令按页面分组：DE
通道定、SS 源设置、SM
测量设置、MD 测量控制。命令序列器应显式追踪 page
状态；不能在不进入正确 page 的情况下拼接
CH/VR/ME，也不能把 UI
控件回调直接连向网络写入。[V §5-6]

6.3 经过手册确认的 SMU 命令表
 业务语义                   KXCI 指令                 关键语义/边界                            证据
 机箱信息/安装资源              *IDN?, *OPT?            *OPT? 对 4145 Emulation 有限制         Rev. E §4-4
                                                D=1/2/3 电压源/电流源/Common；E=1/2/3/4
 通道与角色                  DE, CHn,'VN','IN',D,E                                      §5-7
                                                VAR1/VAR2/CONST/VAR1’
 固定源                    SS, VC/IC               源模式决定对应 compliance 的量纲             §5-15
 内层扫描                   VR/IR                   线性和指定对数模式；VAR1 最多 1024 点           §5-19
                                                VAR2；Rev. E
 外层步进                   VP/IP                                                      §5-17、5-18
                                                允许最多四个步进源，具体组合受通道定义约束
 任意列表                   VL/IL                   需外核列表度、compliance、角色组合             §5-16
 扫描等待                   HT, DT                  分别是扫前 hold 和每点源设定后 delay           §5-10、5-12
 测量列                    SM, DM2, LI             指定测量数据列                            §5-22、5-23
 开始一次测试                 MD, ME1                 清空 SMU 缓冲并触发一次扫描                   §5-28
 中止 SMU 测试              MD, ME4                 官方明确 Abort；上一版遗漏，已纠正               §5-28
                                                n 从 1 开始；NnameT 时间戳 /
 实时读取                   RD 'Vname',n                                               §5-41
                                                NnameS 状态
 自动量程下限                 RG                      测量自动量程的最低档，不是固定电流档                 §5-42
 固定/立即量程                RI/RV                   需按具体 SMU 型号核实量程及 compliance        §5-42/43
 源量程                    SR                      与 RI/RV 测量量程不同                     §5-31
                                                IN: 0.01–10s；NR: 4200A 模式最多
 时域模式                   IN, NR, WT                                                 §5-22~24
                                                4096；WT: 0–100s
 异常读取                   :ERROR:LAST:GET         接到异常/拒绝之后采集原因并保留原始响应               §4-3
精度与限制是多层的： VR/IR
命令参数允许的边界不等于每一块已装 SMU
都能无条件输出的安全范围。额定输出、模块型号、线缆与前置放大器、compliance、源功率特性都需满足。软件不得人为设“低于理论能力”的保守上限，也不得忽视硬件/命令组合真实
限制。



                                                                                          DKTS / FS-Pro implementation guide V2 | 14
<PARSED TEXT FOR PAGE: 15 / 26>
6.4 原生双重扫描的命令结构示例
下例只演示命令结构和 page
迁移，不得复制到实验设备直接给真实样品供电：
DE
CH1,'VS','IS',3,3          # SMU1 Common
CH2,'VD','ID',1,1          # SMU2 voltage VAR1
CH3,'VG','IG',1,2          # SMU3 voltage VAR2
SS
VR1,0,2,0.1,0.001        # X: 0→2V, 0.1V，I compliance 1mA
VP -1,1,3,0.000001       # P: −1,0,+1V，3 steps；需以实际页语法复核
DT 0.05
SM
DM2
LI 'VD','ID','VG','IG'
MD
ME1                      # start

注意：上例中 CH/VR/VP
的指令语义来自 Rev. E；它不是经设备联机验证的 turnkey 脚本。特别是
VP
的参数形式、不同硬件通道映射、实际输出切换、错误返回都应在 simulator
与真机上实测。Agent
不得把这段文档里的说明性注释发送给仪器。

6.5 原始数据实时抓取
    SMU 用 RD 'ChannelName', index 轮询读取，索引从
     1 开始；对应带 T 和 S
     后缀的数据可查询时间戳和状态。
    官方说明：使用 RD 返回的字符 0
     可能是该点尚未采集，不等于仪器测得电流或电压就是
     0。数据解析必须保留 notReady
     状态并进行重试，而不是直接写入合法零点。
    对 PMU，先以 :PMU:DATA:COUNT? 确定已采样点数，再用
     :PMU:DATA:GET 分批。Rev. E 写明单通道最多 65536 点、GET
     单次最多 2048 点，起始索引从 0 开始。
    读取结果需同时保存
     rawResponse（原始文本）、浮点解析值、单位和
     instrumentStatus。某一次读取失败只能造成这一个点缺失或本次任务错误，不能为整条曲线“插值补齐”。




                                                                DKTS / FS-Pro implementation guide V2 | 15
<PARSED TEXT FOR PAGE: 16 / 26>
6.6 时间扫描与脉冲扫描必须拆开
SMU I–T： 固定源 → 采样间隔 IN → 点数 NR → 等待 WT →
测量/取数。实际读取耗时不应被伪装为严格等间隔采样；横轴可选择仪器时间戳优先。

PMU：
输出幅度、基值、源范围、负载、周期、脉宽、上升/下降沿、测量窗、采样模式是独立配置。可考虑
:PMU:SWEEP:PULSE:AMPLITUDE / :PMU:SWEEP:DC /
:PMU:PULSE:TIMES / :PMU:TIMES:PIV /
:PMU:EXECUTE / :PMU:TEST:STATUS? /
:PMU:DATA:GET 等。20 ns 可在 Rev. E 某些
Segment Arb 时间配置里看到，但这不意味着所有 Pulse-IV 测试路径都能以 20
ns
实现同样测量精度与记录模式；应逐个测试模式读取硬件真实极限，不额外人为收紧，也不跨模式混用指标。

6.7 2026 版本核对
Tektronix 官方支持目录于 2026-10-09 布
4200A-KXCI-907-01F，2026-10-22 发布
4200A-PMU-900-01D。本文已逐项核对并列页码的是 2025
Rev. E。因此引入 manualRevision
字段，每条经过验证的命令都要注明版本；上线前补充 Rev. F
差异审计与实际固件兼容性检查。不能在没有访问完整 F
版命令正文的情况下声明其与 E 完全兼容。

7.
常见测试如何配置：流程、端口、曲线和异常

7.1 双端器件 I–V
选择测试： DC I-V → 指定
Source/Drain，选定扫描端子，X Sweep 线性/反向/向/列表，另一端固定或
Common。图表： X 为实际扫描 V，Y 为实测
I；可选对数绝对值显示。注意：
源测量方向与电流符号应使用统一物理方向定义，不得对负电流直接取对数后改写原始数据。

7.2 FET 转移特性 Id–Vg
端口： Source=Common 或固定参考；Gate=X
Sweep；Drain=Constant 或 P Sweep（多个漏压）；Body
可选。参数： Gate 扫描范围、步长、往返、每点等待、栅极


                                                   DKTS / FS-Pro implementation guide V2 | 16
<PARSED TEXT FOR PAGE: 17 / 26>
compliance；Drain 固定电压及独立 compliance。输出：
Id 与 Vg，多条 Vd
分组曲线；同时记录 Ig
以辅助判断栅漏。运行后：
可派生跨导、阈值等，但分析方法必须明示，原始读数不变。

7.3 FET 输出特性 Id–Vd
端口： Drain=X Sweep；Gate=P
Sweep；Source=Common/Constant。外层意义： 每设置一个
Vg，完整扫
Vd，形成一条曲线。例： X=0..2 V/0.1（21
点）；P=−1,0,+1 V（3 档）；一次完整测试 63 点。若 X 每 P 执行两次，则
126 点，并且第一次/第二次必须可分组。检测：
试运行中要核对外层 P 不会在内层 X 未完成时偷偷改变。

7.4 I–T / V–T
端口： 一个或多个固定偏置端口 +
读数端口。参数： 起始等待 WT、IN 间隔、NR
采样点数、测量量程、积分与 timeout。图表： 真实 elapsed
time 作为 X，不把数据点序号直接冒充时间。异常：
若未按标称间隔得到数据，保留真实时间戳和间隔偏差。

7.5 脉冲 I–V 与脉冲序列
端口： 允许选择真实 PMU/PGU 通道及 RPM
相关配置；不可将选项简化成与 SMU 等价的 SMU1/PMU1
同级切换而不考虑物理走线。
基础设置区：
波形型、基、幅、周期、度、上升/下降时间、脉冲数、输出阻抗/负载模型、触发与测量窗口。测量区：
PIV/Waveform
模式、采样率、测量范围、平均与统计。高级区： Segment
Arb/序列与循环。所有字段根据
sourceMode + pmuModel + accessory + measureMode
形成动态能力约束，最小时间不统一填写 20 ns。
输出：
电压波形、电流波形、每脉冲统计值和对应时间；所有波形数据按 PMU
的分块接口完整取回。停止：


                                                  DKTS / FS-Pro implementation guide V2 | 17
<PARSED TEXT FOR PAGE: 18 / 26>
先停止新脉冲调度，再按已核实的 PMU 中止/输出状态命令处理；不能用
ME4 控制 PMU。

7.6 CV / 其他测量家族
CVU
需要单独的频率、交流幅值、直流偏置、等效模型、接线与补偿逻辑。不能直接把
DC IV 的 X Sweep + SMU current range 复制到 CVU
测试页。低频噪声、可靠性、晶圆级自动化后续扩展需明确硬件与插件能力，不能为满足列表完整性提供“能点击但不执行”的假测试卡。

8.
安全停止、仪器异常与数据完整性




                                              图示｜有原生命令支撑的安全中止状态（DKTS 原创示意，非 LabExpress 原厂截图）




                                                                                               DKTS / FS-Pro implementation guide V2 | 18
<PARSED TEXT FOR PAGE: 19 / 26>
8.1 推荐状态机
Idle → Validating → Compiling → Armed → Running
                                  ↘ Stopping → Aborted
                                             ↘ Fault
Running → Finalizing → Completed
Running / Stopping → UnknownOutputState (无法确认实际输出是否关闭)

原子约束： 所有入口共用唯一
InstrumentLease /
任务锁，开始时申请锁，完成/中止/失后。立版和 DKDS
插件绝对不能同时执行两项需要同一仪器的测试。

8.2 Abort / Emergency
的实现分层
14. 取消后续编排：收到停止请求立即冻结下一个批次/下一段/下一轮扫描，操作按钮转为
    Stopping，避免再次点击产生并发任务。
15. 原生中止当前执行：SMU System Mode 用 Rev. E §5-28
    确认的 MD + ME4；CVU 使用经核验的 CVU
    Abort；PMU 使用 PMU 专用的停止与输出控制流程（必须补充真机证据）。
16. 源输出关断/归零：不能把 Abort
    与电极无电压视为同一个动作。依据实际源输出模块采用可验证的关断或回零策略。对于可能引起瞬态破坏的器件，返回策略应由用户明确配置，不能凭空指定“必然线性降到零”。
17. 状态核验：依次检查 KXCI
    响应、错误队列、输出状态。若网络断开导致无法证实关断，进入
    UnknownOutputState，而不是显示“安全停止成功”。
18. 数据保存：把已采集的原始点提交至持久化，标注
    partial: true，记录用户终止原因和最后一个确认点。未收到点不可填零或重放成真实数据。
19. 释放独占权：仅在完成已定义的故障处置后释放；未知输出状态不得让新的测试直接开始。

8.3 故障矩阵
  故障事件                     设备侧处理                         UI 表现                  原始数据处理
  参数超出实际能力                 不下发任何激励命令                     字段标红、解释硬件/模式限制         不建立 run 或保存无激励预检日志
  KXCI 语法错误                停止行、最近                        明确错误码/命令来源             保留原始错误响应
  SMU compliance reached   根据用户选择停止/继续/标记；避免默默继续         曲线点状态标识                点仍保留，status=compliance
  数据未就绪                    RD 特定 not-ready 情况重试，不变成零     可视等待，不插入无效点            仅真实样本落盘
  读数超时                     有界重试；触发中止流程                   Timed out + 当
                                                                     前阶段        已采集点为 partial
  传输截断                     检测预期点数与实际点数                   显示缺失点与位置               保留原文和缺失元数据
  用户停止                     中止当前批次，并关断/核验                 Stopping → Aborted     partial 保存
  网络断开                     无法确认输出，阻断继续                   Unknown output state   保存日志与 partial，要求检查
  UI/APP 崩溃                后端独立任务管理，能恢复就恢复中断记录           重启后显示恢复状态              已写入的原始点必须仍在


                                                                                    DKTS / FS-Pro implementation guide V2 | 19
<PARSED TEXT FOR PAGE: 20 / 26>
8.4 预检结果应该如何展示
预检不使用一页“设备未识别”的警告墙，而是在点击开始前或参数错误时，给一个精简且可定位的反馈：通过项可以折叠，失败项精确到
Gate > Compliance /
X Sweep > Segment 2 > Step。若是因模块硬件限制，显示真实理论能力与当前命令路径的限制分别是多少，不能误导用户以为仪器退化。


9. 数据模型、实时绘图与 DKDS
数据中心




                            图示｜Raw → Normalized → Derived 的不可逆方向（DKTS 原创示意，非 LabExpress 原厂截图）

9.1 三层数据严格分离
   Raw：原始命令、原始响应、仪器时间戳、通道/单位、状态字、接收时间、真实点次序。一经落盘不可覆盖。




                                                                                                DKTS / FS-Pro implementation guide V2 | 20
<PARSED TEXT FOR PAGE: 21 / 26>
   Normalized：统一各测量家族的数值与单位，使用可复现解析器；保留
    raw 关联。
   Derived /
    View：用于曲线变换（log/abs）、合图、拟合、阈值或斜率等运算，保存运算表达式与输入运行
    ID。
schemas/point.schema.json 给出了最小契约。每个运行需保存
recipeHash, compiledPlanHash,
instrumentId, firmware,
moduleInventory, manualRevision,
timestampBasis, stopReason,
completionState。

9.2 图表行为（与 DKDS 一致）
20. 测量中显示当前点及不同 P
    的曲线；坐标系小字号、明确物理量和单位，支持线性/对数切换。按 log
    展示时负电流应选择带符号策略或对数绝对值，并向用户清楚显示，不改原始数据。
21. 每组 X/P/Repeat
    有稳定曲线标识和颜色映射；重复测试可以历史叠加，点击图例显示/隐藏。
22. 支持导出 CSV/JSON/XLSX，且每个导出数据点含配置快照或可回溯运行
    ID。开始测试不等于清空所有历史曲线。
23. 曲线在操作手势下可缩放、平移、光标读点、双光标测差、自动缩放，功能尽量与
    DKDS 图表引擎共享，不维护两套体验。
24. 数据中心事件在 DKTS 核出，立 App 和 DKDS
    插件接收同样数据；插件不应自行维护 4200A 测量数据的第二份真相。

9.3 原始数据示例（示意）
数值均为合成数据结构示例，不是 FS-Pro 或 4200A
真机读数。

10.
模块能力数据库：唯一约束来源

10.1 要求
   独立导出
    JSON；每个约束必须注明模块型号、前放条件、来源文档版本/页码、命令模式和适用条件。




                                                       DKTS / FS-Pro implementation guide V2 | 21
<PARSED TEXT FOR PAGE: 22 / 26>
      capability_sample.json 中的
       installedModules: []
       是占位而非“只有零个模块”的真机结论。连接后应通过
       *IDN?/*OPT?
       和配置工具适用接口映射安装模块，填充真实清单。
      硬件理论能力是软件允许范围的上限，不得人为削减；但功率包络、精度保证、负载/路、量模式、附件和
       KXCI 指令容量需要同时满足。
      “物理极限”“命令参数极限”“当前模式极限”“设备实际识别极限”是四个独立字段，不能拼成一个没有解释的
       Max。
      “固定档位”必须是有效档位集合，不是从量程 min/max
       推出任意连续值。未知时不允许在 UI 中列造假档位。

10.2
已经有明确证据的例子（并非全部硬件能力）
    限制                    来源                           软件处理
    SMU VAR1 单扫最多
                          KXCI E §5-19                 能采用连续分批的，则明确在编译结果中拆分
    1024 点
    SMU 缓冲最多 4096 读
                          KXCI E §5-28                 不得无限追加覆盖旧值
    数（ME3 append）
    SMU 定时读数 NR 最多
                          KXCI E §5-23                 长时序可经设计好的分批策略延长，但保留时间不连续标识
    4096（普通模式）
    RD 是 1-based 索引       KXCI E §5-41                 解析层单独处理，不与 PMU 混用
    PMU 数据 GET 是 0-
                          KXCI E §7-7                  分块读完整后验证总点数
    based，单次最多 2048
    PMU 单通道缓冲最多
                          KXCI E §7-7                  执行前估算容量并设定分批读取策略
    65536 点
    DT 延迟 0..6.553 s      KXCI E §5-10                 超出时不能伪造原生 DT；采用明确的其他策略
    HT 延迟 0..655.3 s      KXCI E §5-12                 与 DT 不得误用
    RG 是测量自动档下限           KXCI E §5-42                 不能把它标成 Fixed current range


11. 架构建议：Agent
应实现的边界
packages/
  measurement-domain/
    devices/             # DUT 端子、模板、逻辑名
    recipes/             # 配置 Schema / UI 表单模型
    scan-compiler/       # 精点展、段/方向/重复索引
    capability/          # 模块能力/手册来源/校验规则
    safety/              # 校验、中止与错误状态
  measurement-runtime/


                                                                                    DKTS / FS-Pro implementation guide V2 | 22
<PARSED TEXT FOR PAGE: 23 / 26>
      orchestrator/        # 任务独占、运行快照、状态机
      instrument-adapters/
        4200a/kxci-smu/    # page 状态、命令序列、RD/DO 读取
        4200a/kxci-pmu/    # PMU pulse 与分块采样
        4200a/kxci-cvu/    # CVU 专用
        simulator/         # 以命令级响应驱动的故障注入
      raw-store/           # 不可变数据流水、运行索引、日志
    measurement-ui/
      test-selector/       # 器件/算法预设
      port-matrix/         # 资源与端子绑定
      sweep-editor/        # X/P/多段/方向
      timing-ranges/       # 源/测量/保护分离
      workspace/           # 曲线、原始表、进度、日志
    integrations/
      dkts-shell/          # 独立应用外壳
      dkds-plugin/         # 宿主通信据中心接

绝对禁止： React/Vue 页面内直接拼 KXCI 字符串；SDK
的 readCurrent 模拟函数以真机状态成功返回；将
ME1 之后的示例作曲；通信失自把
testState 改为
Completed；两个不同插件发起不受控的仪器任务。

11.1 单源代码两种载体
     独立 DKTS：包含应用顶层壳、工作区与测试配置。
     DKDS 插件：工作区组件与独立版完全相同；仅去除重复 App
      标志/顶部装饰，使运行状态挂载到 DKDS 主状态栏，数据通过 DKDS
      数据中心接口发送。
     插件本身由 DKTS 项目分发，DKDS 不内置 4200A 任何测试算法或 UI。DKDS
      只提供通信能力、插件管理、数据中心和宿主状态栏等公共服务。

12. 开发阶段与停止规则
    阶段                         交付件                           必须通过的验收                         下一阶段门槛
    P0：领域模型                    Schema、X/P 扫描计划、端口冲突校验、数据模型   离线精确点数及字段校验测试全部通过               无重复通道和不可达终点
                                                             能执行真实双端 IV、FET 家族曲线、用户中止、原始点记
    P1：KXCI SMU                接适配、通道定、VAR1、VAR2、RD/DO、ME4                                   真机日志和输出状态可核查
                                                             录
    P2：UI 与数据中心                统一端口行、紧凑参数区、真实曲线、历史叠加         宽屏一行/窄屏两行、统一尺寸、原始数可导出           无假数据、UI 无状态占位文字
    P3：复杂扫描                    多段、列表、正反、每 P 重复、分批与断点         顺序/点数/批次与实测数据一致                 复杂模式不能静默降级
    P4：PMU/CVU                 模块专用能力与时序，独立采集/中止             依手册 F 版复核、带硬件测量和异常演练            未验证项不应标为完成
    P5：高级体验                    分析公式/模板库/流程编辑/数据回放            派生数据可追溯、导出一致、项目重开正常             无须另造第二套运行框架




                                                                                               DKTS / FS-Pro implementation guide V2 | 23
<PARSED TEXT FOR PAGE: 24 / 26>
12.1 硬验收清单（Agent
不得只汇报“已完成”）
 ID                   输入 / 操作                               可检查结果
 AC-01                X 0→2 V，0.1 V                         恰好 21 点，含起止
 AC-02                X 2→0 V，−0.1 V                        恰好 21 点，方向正确
 AC-03                X 0→1 V，step=0                        禁止运行，报“步长不能为 0”
 AC-04                X 0→1 V，step=0.3，终点策略严格               禁止运行，提示终点不可达
 AC-05                X 两段 0→1→2 V，步长 0.5                   默认 5 点，连接处不重复
 AC-06                X=[0,0.5,1], P=[−1,0,1]，每 P 执行 X 两次   18 点，正确 P/Repeat/X 顺序
 AC-07                FET X 21 点，P 三档                       63 点，三条明确分组曲线
 AC-08                同一 SMU 分配给不兼容端口                       预检失败且无任何激励指令
 AC-09                固定 current range 与 compliance         两个字段独立保存，命令语义不同
 AC-10                RG 调节自动档下限                            UI 不显示为“固定量程”
 AC-11                KXCI 模拟器返回 RD 'ID',n 为未就绪标志           不插入“0A 的真实测量点”
 AC-12                点 STOP（SMU 正在扫描）                      发送经验证 Abort（含 ME4），阻断后续批次
 AC-13                网络在停止时断开                              进入 UnknownOutputState，不报告成功关断
 AC-14                在运行中编辑参数                              本次运行的 Recipe hash 不变，新值只用于下次
 AC-15                打开两张测试卡同时点击开始                         一个运行取得独占权，另一个被拒绝或排队
 AC-16                PMU 模拟返回 5000 点                       按 GET 最大 2048 逐取全，无点缺失
 AC-17                停止后导出数据                               不完整运行只导出真实点，标 partial
 AC-18                重启应用打开历史工程                            原始值、配置快照、曲线、日志一一对应
 AC-19                窄屏调整端口配置                              四端子恰好两行，按钮不溢出，控件等高
 AC-20                切换独立版与插件版                             同一逻辑与图表，宿主集成不改变测试行为


12.2 自动化测试文件
本包附有 tests/test_scan_plan.py 与
reference/scan_plan.py：它是离线语义参考，不是仪器控制程序。可直接运行：

必须在目标代码库中实现与上述点序列完全一致的单元测试，再连接模拟 KXCI
驱动进行命令序列测试。代码通过并不等于仪器验证完成。测试记录应分为：UNIT_PASS,
SIMULATOR_PASS, HARDWARE_PASS，未到
HARDWARE_PASS 的项不得宣称真机支持。


13. 给开发 Agent
的具体任务指令
25. 先阅读现有 DKTS 和 DKDS 代码库：识别 UI
      共享组件、数据中心、现有 4200A KXCI
      接口及通信层；给出必须改动的文件列表，不重复造架构。


                                                                                     DKTS / FS-Pro implementation guide V2 | 24
<PARSED TEXT FOR PAGE: 25 / 26>
26. 导入本包 Schema 与示例：实现从测试卡创建
      Recipe、字段级校验、默认值、旧工程迁移、保存/加载。
27. 实现 Scan Compiler：不得直接将 X/P 扫描映射为散乱的
      for 循环；须先生成带全部索引和时序的 IR，再依据 KXCI
      能力挑选原生执行或批次。
28. 提供
      Preview Command Plan：用于开发调试，能展示预计下发序列、源/测量模式、命令参数、分批原因和数据读取计划，但普通用户界面不显示冗长的开发标语。
29. 先验证真实 SMU 闭环：连接 → 识别 → 预检 → 通道定义
      → 测试触发 → RD/DO 原始采集 → Abort →
      状态核验。不得用“离线模拟成功”代替真机已完成。
30. 把 UI
      改到图示结构：端口头栏宽屏一行、窄屏两行；参数区 X/P 和各端子
      compliance/量程清晰区分；图表使用 DKDS 引擎。
31. 增加完整异常演练：命令错误、超时、数据未就绪、网络中断、人工
      STOP、并发冲突、恢复后数据 partial。
32. 每批提交验收证据：附代码变更、截图、编译结果、自动测试结果、真机原始响应、未完成项和硬件核验版本；不要仅写“已经完成”。


14. 证据索引与免责声明
 代号               来源                                                                             本文使用范围
                  概伦电子：FS-Pro
 O1                                                                                              FS-Pro 硬件与 LabExpress 关系、基本测试类型
                  官方产品页 (https://www.primarius-tech.com/products/data_test_system/FS-Pro.html)
                  LabExpress
 O2               官方产品单页（2024）                                                                   九张软件界面缩略图、扫描类型、算法与数据分析
                  (https://khai-long.com/uploads/20240920/CN_LabExpress_Sep.2024.pdf)
                  概伦电子
 O3                                                                                              FS-Pro 量测类型，不可当作 4200A 指标
                  FS-Pro 英文单页 (https://www.primarius-tech.com/uploads/20230307/EN_FS-Pro.pdf)
                  Keithley
 V1               KXCI Rev. E（2025-03） (https://download.tek.com/manual/4200A-KXCI-907-          逐命令语义、例子、数据索引、状态与限值
                  01E_March2025.pdf)
                  Tektronix
 V2               4200A 文档目录 (https://www.tek.com/en/support/datasheets-manuals-software-        确认 2026-10 Rev. F 和 PMU 2026 版本存在
                  downloads?model=4200A-SCS)
著作权说明：
本包不分发厂商手册正文，也不将其截图伪装成原创图片。八张原创图片均是
DKTS
开发示意。厂商的真实软件截图和对应出处通过上方官方网站原件查看。




                                                                                                                             DKTS / FS-Pro implementation guide V2 | 25
<PARSED TEXT FOR PAGE: 26 / 26>
最终成品的定义：
并非“能配置扫描、能画曲线的网页”，而是“具备 LabExpress
式专业配置路径、具有 4200A
原生能力适配、可重复、可中止、可追溯、独立版与 DKDS
插件行为一致的仪器测试程序”。




                                     DKTS / FS-Pro implementation guide V2 | 26