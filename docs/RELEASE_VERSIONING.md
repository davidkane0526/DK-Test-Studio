# DKTS 单一发行路线（2026-11-10 起）

## 命名
- 发行应用版本：`Vx.y.z`。来源为 DKTS `package.json`，用于 Windows/Android 的主版本。
- 本次构建/热更号：`aNNN`。唯一计数源为 `ui-update.yml` 的主线运行编号；Core Preview 工作流必须按同一 SHA 查询该 UI 工作流运行号，再用于 Windows `dktsBuildId` 和 Android `versionCode=100000+N`。Core 工作流自己的 `run_number` 不得替代 aNNN，以免低于既有发布编号。
- DKDS 上游版本（例如 3.72.3）仅是 **只读框架依赖版本**，绝不作为 DKTS UI、APK、EXE 版本。
- 历史外部插件内部版本（例如 0.8.1）只标识 Plugin API 兼容预览，不能称为 DKTS 应用版本，不能自动覆盖主程序。

## 交付逻辑
- **UI 可热更新**：只替换允许的 index.html/app.js/styles.css，保持 V 不变，更新 aNNN；不要求用户下载完整包。
- **原生宿主/驱动变更**：发布具有相同 V/a 的完整 Windows Portable 和 Android APK；检查兼容后在应用内的更新面板走本地完整安装。不能用 UI 热更假装修改了原生二进制。
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
