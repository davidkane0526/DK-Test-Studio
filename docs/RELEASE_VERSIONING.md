# DKTS 单一发行路线（2026-11-10 起）

## 命名
- 发行应用版本：`Vx.y.z`。来源为 DKTS `package.json`，用于 Windows/Android 的主版本。
- 本次构建/热更号：`aNNN`。唯一计数源为 `ui-update.yml` 的主线运行编号；Core Preview 工作流必须按同一 SHA 查询该 UI 工作流运行号，再用于 Windows `dktsBuildId` 和 Android `versionCode=100000+N`。Core 工作流自己的 `run_number` 不得替代 aNNN，以免低于既有发布编号。
- DKDS 上游版本（例如 3.72.3）仅是 **只读框架依赖版本**，绝不作为 DKTS UI、APK、EXE 版本。
- 历史外部插件内部版本（例如 0.8.1）只标识 Plugin API 兼容预览，不能称为 DKTS 应用版本，不能自动覆盖主程序。

## 交付逻辑
- **UI 可热更新**：只替换允许的 index.html/app.js/styles.css，保持 V 不变，更新 aNNN；不要求用户下载完整包。
- **必须完整安装的变更**：递增程序包版本 `Vx.y.z`，同时分配新的 `aNNN`，发布同一 V/a 的完整 Windows Portable 和 Android APK。原生宿主、Android 配置、桌面可执行文件、驱动/通信桥、测量执行、安全校验、更新器或插件运行时发生变化，均属于此类；不能用 UI 热更假装修改了原生二进制。
- **仅 CSS/UI 热更新的变更**：保持当前 `Vx.y.z` 不变，只分配新的 `aNNN`。完整 Windows/Android 包仍随同一 Release 构建并提供下载，但已经成功热更新的用户不必重新安装。
- 因此，`V` 不是每次提交都递增的流水号，而是完整安装包版本；`aNNN` 是每次应用构建的单调开发/更新编号。仅文档或 CI 工作流变更不发布应用包，序号可能出现空档，不得复用旧编号。
- 版本递增采用 SemVer：兼容性修复/小型完整包修正递增 PATCH；兼容的功能扩展递增 MINOR；破坏性接口、项目数据或迁移兼容性变化递增 MAJOR。若变更只能通过完整安装交付，至少递增 PATCH。
- 每次 main 成功提交仍应发布完整的 DKTS 包，供需要重装者下载；不强制 UI 热更用户升级完整包。
- 标题只显示 V；aNNN 仅在版本/更新面板显示。Release/Actions 展示完整 V+a。
- **正式 DKTS 发布资产**：Windows Portable EXE、Android APK、UI bundle、可导出的硬件能力数据库。旧 DKDS `.dkplugin` 与实验性 Core-native `.dkplugin` 不再作为正式 DKTS Release 附件，也不放入 DKDS 内置目录。
- 仍需完成 DKDS-host 的 DKTS 更新服务器来源与 full installer 适配才可发新架构安装包，不能把临时 staging 视作已交付。
- 已发布的 a121/a122 历史 Release 保留用于对照，不追改删除和掩盖其历史双插件问题。

## 2026-11-11 已执行的 Core 主线切换与暂时发布边界
- 用户明确授权把 DKTS PR #18 合并至 `main`（merge `cdc159dd`）；以后新架构只由 DKTS 仓库的只读 DKDS Core 暂存构建，不修改 DKDS。
- 原本 `windows-preview.yml` 的 legacy standalone Windows/Android 发行流程已经替换为依赖真实 Core CI 全部成功的 **Core Preview** 发行流程；已废弃的 DKDS 分支定时签名工作流被删除。历史 Release 仅用于回溯，不代表新 Core。
- 当前 `ui-update.yml` 是唯一 `aNNN` 计数源：CSS-only 提交发布 Core UI 热更新；完整应用提交则由 Core 工作流查询同 SHA 的 UI workflow run number，构建同编号的 EXE/APK。两个工作流不再各自递增并混用编号。**这是版本身份治理，不代表 Core UI 热更新已完成。**
- 在 Core-compatible UI bundle、生产签名、固定包名完整更新、哈希校验与失败回退通过以前，仅提供独立包名 `studio.dk.test.corepreview` 的测试签名 Android 预览和独立 Windows Portable 预览，明示不得覆盖稳定版。之后恢复相同 V/a 的正式双平台完整包和可用热更。
- Release 成功状态、EXE/APK 实际附件和 Android/Windows 真机截图以 Actions 输出为证，不以代码存在推定完成；真机 KXCI 与数据中心全链路仍待验收。

## 2026-11-12 Android Core Preview 更新安全改进（验收进行中）
- `stage-dkds-host.cjs` 将同 SHA 的 UI revision `aNNN` 写入 Windows `package.json.dktsBuildId`，并映射为 Android `versionCode=100000+N`。Windows/Android 更新器均允许同 V 下更高 aNNN，且只接受 Release 标签、资产名、SHA-256 与发布说明中的 `Build identity` / `Android versionCode` 一致的资产；旧版没有双身份证明的 Release 不参与应用内更新，防止历史错配版本造成循环重装。
- 真正 DKDS Core 编译、测试和模拟器启动仍在不含签名秘密的构建任务执行。新增签名任务只使用构建好的 APK 与原 DKTS 固定 PKCS12 Secret，执行 Android `apksigner` 重签名、`android/signing-certificate.sha256` 指纹和包名/版本一致性校验。未配置密钥、证书偏移或签名失败时不标记为 FIXED-SIGNED。
- Core 发布任务仅在存在已验签的固定签名 Artifact 时优先选择 `FIXED-SIGNED`，否则明确使用 `TEST-SIGNED` 标签并警告。**此前已安装的随机测试签名预览与未来固定签名预览可能需要一次迁移，不得宣传无缝覆盖。**
- 上述流程已提交，固定签名与模拟器/OPPO 真实安装验收以对应新 CI 为准。UI 热更/完整安装签名回退仍是独立未完成项。


## 2026-11-12 / V+aNNN 计数统一与 Core staging 更新器回归
- GitHub `main` 的 Core Framework Contract 失败于 `stage-dkds-host.cjs`：对 DKDS Core CSS hot updater 的 JavaScript 正则源码使用了多一层反斜杠转义，导致 `replaceExact` 锚点与固定 DKDS SHA 的实际源码不匹配。修正为 JS 源文件的一层正则转义，并在 staging job 增加 `test-staged-core-updater.cjs`，直接加载真正的 staged Windows updater 测试 V/a 选择、同 V 新 a、数字排序、资产名和 SHA-256。
- 发现 Core workflow 自身 `run_number` 与此前 `ui-update.yml` 的历史 aNNN 计数器不一致，Core run 179 低于已发布 a184。若继续用 Core run number，会产生 aNNN 回退或同版本更新循环。现将 `ui-update.yml` run_number 设为唯一单调 aNNN 来源；Core 主线构建按相同 `head_sha` 查询 UI workflow run number，统一写入 Windows `dktsBuildId`、Android `versionCode=100000+N`、Core Release tag 与 UI bundle。PR/手动构建无同 SHA UI push run 时仅使用自身 CI 编号，不发布正式 Core Preview。
- 为拒绝历史错配资产，Core Release notes 必须同时包含 `Build identity: aNNN` 和 `Android versionCode: 100000+N`。Windows/Android 原生更新器都校验该发布身份；没有该双重证明的历史 Release 不会被应用内更新器选中。Android 仍额外校验 APK 包名、versionName、versionCode、SHA-256 与已安装签名证书。更新面板显示 V+a，主标题不显示 aNNN。
- 本轮只修改 DKTS 工作流、staging 副本适配、测试和文档；DKDS 固定 SHA `20f056851a61d2144e9524c3ed568628d4b8557c` 只读未修改。本地已使用该精确上游源码执行 staging，Node updater 语法检查与 staged V/a contract 测试通过；真实 Windows/Android 编译、安装、应用内更新和回滚仍须等待新 SHA 的 GitHub Actions 与真机验收。


## 2026-11-13 / 单一 DKTS 原生身份与单一 Release（当前规则）
- 本节 supersedes earlier Core Preview-only release descriptions above. DKTS Core no longer ships a second `studio.dk.test.corepreview` Android application. The derived DKDS host uses the existing DKTS application identity `studio.dk.test` and the existing pinned DKTS signer; Windows uses the DKTS product/executable identity.
- One Release tag `dkts-vX.Y.Z-aNNN` carries the Windows Portable, fixed-signed Android APK, capability database, SHA256 and provenance. A CSS-only change additionally attaches `DKDS-UI-bundle.json` to that same Release. There is no separate `dkts-ui-v...` Release.
- Every successful main-branch application change, including CSS-only changes, builds the complete Windows and Android packages. The UI bundle is an additional delivery path, not a reason to skip the full packages. Documentation/workflow-only changes do not create application packages.
- The existing `ui-update.yml` workflow file path is retained solely to preserve its historical monotonic run-number sequence. It now allocates the canonical `aNNN`; it no longer builds or publishes a separate UI Release. The Core build resolves the run number for the exact same source SHA and stamps it into Windows package metadata, Android `versionCode=100000+N`, Release tag, Release notes and optional UI bundle.
- Android release signing is mandatory. If the fixed DKTS keystore or certificate fingerprint is unavailable/mismatched, the Release fails rather than falling back to a test-signed APK. The Android package name and signing identity are checked before publication.
- Both native updaters and both CSS hot-update managers use the same Release list and `dkts-vX.Y.Z-aNNN` tag. The previous verified CSS bundle remains available for rollback; native installers remain separately verified by asset digest and, on Android, installed signer equality.
- CI success is not physical acceptance. In-place Android installation over the user's current build, Windows portable replacement, hot-update application and rollback still require actual-device checks. DKDS remains read-only.


## 2026-11-13 版本规则纠正
- 此前将原生宿主/Android 配置变更也保持在相同 `V` 的描述不符合用户原始要求，现由本节规则取代。
- `V0.3.13` 是上一完整安装包版本；本轮 Android 系统状态栏修正修改了 DKTS 派生 React Native 宿主和 Android app 配置，不能由 CSS 热更新覆盖，因此完整包版本应升级为 `V0.3.14`，开发身份为 `a194`（云端暂存编号，正式编号以 main 上 `ui-update.yml` 对应 SHA 的运行号为准）。


## 2026-11-13 / V0.3.15 a195：DKTS 原生 UI 结构调整
- 本轮修改 DKTS 原生插件 JavaScript 与插件布局样式，属于插件运行时变更，不在 CSS-only 热更新白名单内，因此完整应用版本从 `V0.3.14` 升级为 `V0.3.15`，云端暂存身份为 `a195`。
- 正式 `aNNN` 仍须由 `main` 上与同一 SHA 对应的 `ui-update.yml` 运行号确认；本地 `a195` 不是已发布 Release 编号。
- 外部 DKDS 插件内部版本由 `0.8.1` 升为 `0.8.2`，仅表示 DKDS Plugin API 兼容包版本，不替代 DKTS 应用版本。
- 本轮尚未生成可安装 APK/EXE，也未完成真实 Electron/Android 截图验收；不得将源码 ZIP 或 `.dkplugin` 预览包称为正式发行版。


## 2026-11-13 / V0.3.16 a196：DKTS 原生 UI 第二轮重构
- 本轮继续修改 DKTS 原生插件 `plugin.js` 与 `ui-shell.css`，涉及插件运行时行为和组件结构，不属于 CSS-only 热更新。按既定规则，完整安装版本由 `V0.3.15` 递增至 `V0.3.16`，同时分配暂存编号 `a196`。正式 `aNNN` 仍以 `main` 上同 SHA 的 `ui-update.yml` 运行号为准。
- DKTS 原生插件内部版本由 `0.8.2` 递增至 `0.8.3`，仅标识 DKDS Plugin API 1.19 插件包，不替代 DKTS 应用版本。
- Android 暂存 `versionCode=100196`。本地源码包和 Core Host 尚未完成生产 Windows/Android 构建、签名及真实截图验收，不标记为正式 Release。


## 2026-11-13 / V0.3.17 a197：恢复 FS-Pro Edit Page 信息层级
- 本轮修改 DKTS 原生插件 `plugin.js`、插件样式及原生插件测试，属于插件运行时结构变更，不在 CSS-only 热更新白名单内。完整安装版本从 `V0.3.16` 升级至 `V0.3.17`，本地暂存编号 `a197`；正式 aNNN 必须由 `main` 上同一源码 SHA 对应的 `ui-update.yml` 运行号确认。
- DKTS 原生插件内部版本由 `0.8.3` 升级至 `0.8.4`，Android 暂存 `versionCode=100197`；基础 Android Gradle `versionName=0.3.17`。
- Edit Page 主标签调整为 Sweep/Target/Strategy 三项。页面信息（名称/备注）移至主标签上方；Sweep 内部按 Input Setting、Xsweep/Psweep、Limits/Page Var/Associate Spec 三栏组织；后面三项不再作为一级标签。
- Project Explorer 的测试类型入口从十个常驻按钮改为一个“＋ Page”菜单，保留十种测试类型但减少侧栏常驻控件和垂直占用。
- 真实 Electron/Android 截图、Windows Portable/Android 固定签名完整包尚未完成。本轮源码与 SDK 验证不代表视觉验收通过或可安装 Release。未修改 DKDS 上游，未创建 GitHub 分支。


## 2026-11-13 / V0.3.18 a198：端口角色整合与响应式 UI 第四轮
- 本轮修改 DKTS 原生插件运行时代码、插件布局样式、Core Electron 截图验收脚本和测试，因此不属于 CSS-only 热更新。完整应用版本从 `V0.3.17` 升级至 `V0.3.18`；`a198` 为本地暂存编号，正式编号仍以 `main` 上同一源码 SHA 对应的 `ui-update.yml` 运行为准。
- DKTS 原生插件版本由 `0.8.4` 升至 `0.8.5`，仅表示 DKDS Plugin API 1.19 插件包版本；Android 暂存 `versionCode=100198`，`versionName=0.3.18`。
- 删除 Sweep Setup 中重复的 Xsweep/Psweep 物理端口选择器，将 Condition/Xsweep/Psweep 角色选择放入各已分配端口的端口设置行，保持每种扫描角色唯一。
- 桌面和平板在 Page 标题栏保留 S/D/G/B 四个紧凑下拉框；手机窄屏改为单一端口按钮，通过 DKDS Core Popover 编辑四个端口并一次性验证、保存，避免标题栏横向溢出。
- Project Explorer 使用 DKDS `sidebar-main-compact` 标准 235px 侧栏布局，900px 以下切换导航抽屉。绘图卡片内容比例调整为 2.25:1、内容高度 132–220px，减少四窗布局纵向占用。
- Page 信息、测试类型、端口设置、扫描概览、限值、页面变量、关联规格、测量目标和扫描策略统一中文呈现，保留 Xsweep/Psweep、SMU 等仪器术语。
- 本轮未修改 DKDS 上游；未创建 GitHub 分支、未推送 main。真实 Electron/Android 构建与截图验收仍须由具备对应 SDK 的 CI 完成，源码 mock 测试不等同视觉验收。


## 2026-11-13 / V0.3.19 a199：Sweep 信息密度与 Target 端口过滤
- 本轮修改 DKTS 原生插件运行时代码、SDK Unit 布局、目标端口选择行为、插件包版本、测试及构建身份，属于插件运行时变更，不能通过 CSS-only 热更新交付。完整安装版本从 `V0.3.18` 升级至 `V0.3.19`，本地暂存编号 `a199`。正式 aNNN 仍由 `main` 上同一源码 SHA 对应的 `ui-update.yml` 运行号确认。
- DKTS 原生插件版本从 `0.8.5` 升至 `0.8.6`；Android 本地暂存 versionCode 为 `100199`，基础 Gradle versionCode 从 27 升至 28，versionName 为 `0.3.19`。
- 将四个扫描指标卡改为 DKDS Summary strip；Sweep 下方改为两列布局，Limits 单独占一列，Page Var 与 Associate Spec 共享另一列；Limits 每个已分配端口分组并用 Core Divider 分隔。
- Page Info 移除标题栏已显示的重复测试类型；Target 只允许选择已分配端口，全部 None 时禁用选择器；Psweep 关闭时禁用 Psweep 重复次数。
- 本轮使用 DKDS 官方 `two-card-grid`、`stack-compact`、`form-grid-2`、Summary strip 和 Divider Unit，不修改 DKDS 上游，不创建 GitHub 分支。
- 本地 `test-dkds-native-plugin.cjs` 与 `test-dkds-native-host.cjs` 通过。真实 Electron/Android 截图、Windows Portable/固定签名 APK 构建与设备验收仍待 CI/真机完成，不以 mock 通过代替视觉验收。


## 2026-11-14 / V0.3.20 a200：原生图窗与平板输入体验
- 本轮修改 DKTS 原生插件运行时代码和 UI 样式，属于必须完整安装的版本变更，因此从 V0.3.19 a199 递增到 V0.3.20 a200。`a200` 为本地暂存身份；正式 aNNN 必须由 `main` 上同 SHA 的 `ui-update.yml` 运行号确认。
- 原生插件 0.8.6 → 0.8.7；Android Gradle versionCode 28 → 29，暂存完整包 versionCode 100200。
- 没有创建 GitHub 分支、没有向 main 推送或发布安装包，不把 SDK 模拟/Chromium CSS 几何截图描述为真实宿主验收。

## 2026-11-16：最终构建门禁（覆盖此前“每次 main 提交自动编译”规则）
- 继续以本轮最新、已交付的 DKTS 完整源码 ZIP 为云端开发基线；DKDS 固定版本只读。开发期间不创建 GitHub 分支，不反复推送和编译 Android/Windows 包。
- 只进行必要的静态检查、Node 测试、离线 UI 布局检查，不能将这些检查宣称为已编译安装包或真实设备验收。
- `dkts-framework-contract.yml` 是唯一在 final push 下自动编译 Windows Portable EXE 和 Android APK 的工作流。仅当 `main` 最终提交消息含有 `[DKTS-FINAL-BUILD]` 时，它才执行构建。普通 `main` push 不触发原生编译。
- 其他 CI、Plugin、Electron/Android/Web 预览工作流均为手动诊断，不自动伴随 push/PR 构建。`ui-update.yml` 仅做 aNNN 身份分配，`source-zip.yml` 仅做源码 ZIP 归档，两者都不编译安装包。
- 最终源码定稿后仅将测试通过的内容直接同步至唯一 `main`，然后由该最终 SHA 的统一 Actions 运行编译、签名、校验和发布同一 `V+aNNN` 的 EXE/APK。失败时报告失败，不发布未验签 APK。开发 ZIP 中的 aNNN 仅为本地暂存编号，不能替代正式 UI 工作流运行号。
- 其他诊断工作流的 `workflow_dispatch` 只能用于用户明确要求的手动检查；统一 Core Release 本身不开放手动分发触发，最终发布只允许含标记的 `main` push；不因每次开发步骤自动调用它。


## 2026-11-16 / V0.3.21 a201：真实宿主布局修复与同源网页预览

- 原生插件 0.8.7 → 0.8.8；程序 V0.3.20 → V0.3.21；Android Gradle versionCode 29 → 30。
- DKTS Core 实测发现原生插件因不合法的 Unit Layout gap 和 grid-template-columns 直接无法激活，修正后原生 DKDS Core 浏览器 DOM 能加载工程树、四 PlotView 和 Page 编辑器。
- a201 仅为云端暂存编号，正式 aNNN 需从最终 main 的 ui-update 同 SHA 构建号确定。此轮尚未编译 EXE/APK，也未产生 Release。
- 同源预览依赖固定 D3 7.9.0 首次联网下载，浏览器不能代替 Electron/Android 与真实 4200A 的最终验收。
