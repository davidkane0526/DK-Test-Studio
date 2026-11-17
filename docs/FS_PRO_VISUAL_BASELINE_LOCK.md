# DKTS FS-Pro 已确认视觉基线锁定（2026-11-16）

**优先级：UI 回归冻结，禁止引入测量功能时重新组织页面。**

## 权威与限制

- 最低已确认基线：`docs/reference/fspro-accepted-20261116/accepted-web-editor-1280x800.png` 对应的 FS-Pro 风格 Web 工作区，以及 `web/fspro-workbench/{index.html,styles.css,app.js,plan.js}` 四个文件的 SHA-256（见同目录 `BASELINE-MANIFEST.json`）。这是用户现有工作区参考，**不是原厂 FS-Pro 的官方像素级截图**。
- 原厂 FS-Pro/LabExpress 语义优先级高于页面概念；真实 Windows/Android 应通过同一 `integrations/dkds-native/plugin.js` 派生 DKDS Core，不通过独立 Web Demo 假装同源。
- 保留 SDK 1.19 Unit/主题、PlotGroup/PlotView、Data Center、热更与全量更新能力；不修改上游 DKDS；同源源码版本不等于视觉验收完成。

## 禁止回退的固定规则

1. 左侧 Project → Device → Routine → Page/Spec 导航；只有一个标题，不重复“工程/项目”双标识。
2. Page 编辑状态下，编辑器与独立 DKDS PlotGroup/多个 PlotView 在同一工作区左右并列；退出 Page 编辑时绘图区扩展为全宽。不得用编辑器替换/卸载绘图区。
3. Page 标题行只承担页面名称、返回与测量动作，不再向标题重复插入 Device/Routine 副标题、直流标签、连接、端口选择器。
4. Terminal 端口行单独位于标题行之后，只显示 Source/Drain/Gate 三个选择器；桌面宽度 >990px 显示三个选择器，<=990px 只显示一个“端口”配置入口。导航按钮只在 <=900px 可见；`None` 仅用于映射状态，不得创建参数行或 Target 选项。
5. **七个主标签固定为 Info、Sweep、Target、Strategy、Limits、Page Var、Associate Spec，顺序不得改变。** Page Information 只在 Info 标签内显示；不得把 Info 内容放在标签栏上方，也不得把 Limits、Page Var、Associate Spec 挤到 Sweep 标签内容末尾。
6. Sweep 标签按 FS-Pro 顺序呈现 Xsweep、Psweep、Terminal Settings、Fixed Bias 和紧凑扫描汇总。Xsweep/Psweep 的标题栏分别承载扫描端口、重复次数和新增扫描段；未启用 Psweep 仍显示启用入口及固定偏置提示。
7. Xsweep/Psweep 表格列顺序固定为 `#`、`Start (V)`、`Stop (V)`、`Step (V)`、`Range (A)`、`Speed`、操作。桌面端紧凑单行；窄屏按 3 列×2 行字段栅格展示，表头/字段标签不得重复或消失。
8. Terminal 区仅显示 Source、Drain、Gate 映射；None 只允许作为未分配映射值，不得出现在参数行或 Target 选项。Terminal Settings 仅显示已分配 SMU 的 Range Mode、Current Range、Compliance Mode、Compliance；Fixed Bias 单独呈现。
9. DKDS Unit 产生的动作容器自带内联 `display:flex`；不能满足 FS-Pro 结构时，必须先扩展 DKTS 派生 Unit，而不是改变页面信息架构。DKDS 上游源码只读。
10. 一项真实功能接线不得修改 Page 信息架构，必须有针对桌面/平板/手机的回归证据，才可进入最终 main。
11. 开发按阶段集中验证；不因单个小改动反复编译。EXE/APK 只在最终签收时构建。

## 本轮恢复与证据

- V0.3.26 / a206（暂存，不是 GitHub Release）；原生插件 v0.8.13。该条仅记录上一阶段，不代表当前实现。
- 修复标题栏混入的连接和双套端口入口；移除重复副标题/直流 meta；重新放回可见 Psweep，恢复 X→P→Terminal 的主内容顺序；修复因 SDK Layout 忽略纯字符串而消失的扫描列标题。
- 专项源码回归 `tests/fspro-visual-baseline-lock.test.cjs` 锁住参考 Web 文件 SHA；`tests/core-ui-shell.test.cjs` 锁住 SDK 内联 display 可见性优先级。
- `tools/native-ui-geometry-fixture.py` 为仅 CSS 几何夹具，**不能代替真实 Electron/Android 渲染**。另在开发环境使用相同 Core/插件 JS 的浏览器离线注入运行时采样，截图未必完全等同 Electron 或本地 HTTP 运行。
- 真实 FS-Pro 原厂 35 项像素验收、原生 Electron 与 Android 真机仍待完成，本轮不称为像素级最终完成。

## 变更程序

后续任何 `plugin.js`、`ui-shell.css`、SDK 版本、页面 Header/Terminal/Sweep、状态栏或 PlotView 的改动都要通过上述防回退契约。已批准参考图的像素变化，只有用户再明确接受新版本后才能替换参考文件和 SHA。


## 2026-11-17 修订：线上 FS-Pro 七标签为权威页面结构

本节 supersede 本文件此前的三标签/辅助区描述。依据用户指定的线上页面及实际 DOM，主标签顺序为：

1. `Info`
2. `Sweep`
3. `Target`
4. `Strategy`
5. `Limits`
6. `Page Var`
7. `Associate Spec`

Info 内容不得常驻标签栏上方。Sweep 只包含 Xsweep、Psweep、Terminal Settings、Fixed Bias 和紧凑汇总。Target、Strategy、Limits、Page Var、Associate Spec 各自拥有独立标签和内容区。扫描表格列顺序固定为 `# / Start (V) / Stop (V) / Step (V) / Range (A) / Speed / 操作`。

若 DKDS Unit 组件不能实现该结构，修改 DKTS 自有 Unit adapter/扩展或 DKTS 派生 Core 中的 Unit 实现；不得删改上述结构以迁就 Unit。DKDS 上游 SHA `20f056851a61d2144e9524c3ed568628d4b8557c` 仍为只读依赖。

开发节奏：完成整块 UI 后统一运行测试和同源预览截图；不得每个小修改触发编译/打包。当前阶段不构建 EXE/APK。


## 2026-11-17 · V0.3.27 a207 UI 阶段实现记录（尚待统一截图验收）

- 基于完整 a206 源码 ZIP 建立工作区，未使用 GitHub main 的旧版源码覆盖。
- 将 Page 编辑器改为七个独立标签，并将 Page Information 收入 Info；Sweep 不再承载 Target/Strategy/Limits/Page Var/Associate Spec。
- Xsweep/Psweep 使用 `# / Start / Stop / Step / Range / Speed / 操作` 七列；端口与重复次数放在各自标题栏；Psweep 未启用时仍保留启用入口和固定偏置提示。
- Terminal 仅显示 S/D/G，默认样例映射 GNDU/SMU1/SMU2；GNDU 和 None 均不进入测量参数行或 Target 通道。Terminal Settings 与 Fixed Bias 分离。
- Page 编辑器与四个独立 PlotView 并列，返回绘图区时绘图区扩展为全宽。
- 新增 DKTS 派生 Unit 扩展：FS-Pro 七标签事件回调、七列扫描行、Terminal 行、226px 导航栏和 Editor/PlotGroup 双栏布局。补丁仅作用于 DKTS staging 副本，DKDS 上游保持只读。
- 本阶段还需通过实际 DKDS Core 同源预览的 1591×900、1280×800、744×600、390×844 截图检查；当前 Node/Mock 测试不等同真实视觉验收。未构建 EXE/APK，未推送 GitHub。

## 2026-11-17 · R-20261117-004

以原厂 LabExpress 2022.01 中文手册为结构依据，参考项目归档 [工程基线](reference/legacy-fspro-20261109/docs/4200A/FSPro_Rebuild_Baseline.md)。既存网页截图作为历史比较项。手册 PDF 正文需要重新取回后逐页比对。
