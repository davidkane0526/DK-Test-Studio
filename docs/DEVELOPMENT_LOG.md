# DKTS 开发日志（累积，不删除失败记录）

每次实质开发均追加：时间、需求 ID、DKTS GitHub SHA/PR、测试与发布、失败和未验收项。此文件不是仪器实测日志；以前开发记录只做可核查的追溯摘要，不能声称包含全部历史聊天文字。

## 2026-11-10 / 所有权与架构纠偏（进行中）
- 需求：R-20261110-001。DKTS 专属开发；DKDS 只通用通信、热更新和本地完整更新；删除内置 4200；保留非分析插件并复刻 FS-Pro；需求/日志入 GitHub。
- 已完成：审计 DKDS `4200` 分支，发现源插件目录仅有通用插件、`builtin.connectivity-center` 以及禁止内置 4200 的回归测试。关闭 DKDS 业务开发 PR [#16](https://github.com/davidkane0526/DK-Data-Studio/pull/16)；未合并其代码、未修改 DKDS 源码。
- 新的 DKTS 统一开发分支 `work/dkts-framework-migration`，新增架构规范、用户需求台账、开发日志和 DKDS 上游只读核查方案。
- 待证实：用户机器上安装的 4200 是外部插件、旧安装缓存或实际旧发行包；不能凭当前 GitHub 源码断言已从用户机器删除。DKDS 的其他历史远程分支尚未删除。完整 DKDS Host 在 DKTS 内替代现有独立 WebView 壳尚未实现、不可宣称完成。

## 2026-11-10 / DKTS 只读框架与发布治理验证（PR #14）
- 需求 R-20261110-001、R-20261108-001，代码分支 `work/dkts-framework-migration`，首批提交 [1027b183](https://github.com/davidkane0526/DK-Test-Studio/commit/1027b1834a1ff0bad43c70739ad375c00ed48dff)，PR [#14](https://github.com/davidkane0526/DK-Test-Studio/pull/14)。
- 使用只读 DKDS `4200` SHA `20f05685`，上游实际为 17 个内置插件；在 DKTS **副本中**保留 11 个非分析插件，排除 6 个分析工作台/算法。保留插件包括通信、数据中心、主题、Status、Pulse import、Pulse Sampler 等；原始 DKDS checkout `git status --porcelain` 为空。
- 新增 `tools/dkds-host-profile.cjs`、`tools/stage-dkds-host.cjs` 和只读框架 CI，生成完整 DKDS 框架 DKTS 暂存源码和可审计插件清单。CI [框架核查](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/42769073733) **成功**。该暂存源码 **不能作为完成的 Windows/Android 新宿主发布**，更新源/FS-Pro UI/实机验证仍是阻塞项。
- 正式 DKTS Release 从六个相互混淆的资源改为四个明确资源：Windows Portable、Android APK、UI Bundle、硬件能力数据库；legacy/native `.dkplugin` 留在 DKTS 研发预览源，不混入 DKTS 正式安装包。具体发布后仍须逐一验证 Release。
- 已添加 GitHub 跟踪事项：[DKDS/分支归属 #15](https://github.com/davidkane0526/DK-Test-Studio/issues/15)、[DKDS Core 迁移 #16](https://github.com/davidkane0526/DK-Test-Studio/issues/16)、[FS-Pro 和测量 #17](https://github.com/davidkane0526/DK-Test-Studio/issues/17)。
- 未完成：DKDS 多余远程分支删除（连接器无删除操作）、已安装旧 4200 插件来源核验、真正 DKDS 宿主版 DKTS 运行/更新器接线与 FS-Pro 全量界面验证。未主动修改任何 DKDS 仓库源码。

## 2026-11-10 / 早期可核查记录
- [DKTS PR #12](https://github.com/davidkane0526/DK-Test-Studio/pull/12) → `9731cc57`：Core-native 离线 X/P editor、参数行、None 端口、热更 a121；CI 与 Release 成功。**不足**：独立版未真正继承 DKDS 主宿主。
- [DKTS PR #13](https://github.com/davidkane0526/DK-Test-Studio/pull/13) → `1a615606`：原生插件 v0.8.1、分段预览大数据表、KXCI 规划规则一致、原生/旧插件分发区分，V0.3.13 a122 完整包 6 项资产发布。**不足**：旧版插件仍打包供兼容，易造成用户对两种分发的混淆；最新要求需要统一。
- [V0.3.13 a122 Release](https://github.com/davidkane0526/DK-Test-Studio/releases/tag/dkts-preview-v0.3.13-a122)：Windows/Android/两种 DKDS 插件/UI Bundle/硬件能力数据库；CI 成功不构成真实 4200A 接线和输出验收。
- DKDS `4200` 分支 HEAD 曾验证为 `20f05685`、通用通信插件存在，源码清单无内置 Keithley 插件，但不代表本地历史安装无遗留。

## 长期日志模板（每次继续追加）

### YYYY-MM-DD HH:mm +08:00 — <变更>
- 需求 ID / 原话链接：
- DKTS commit / PR：
- 修改文件与原因：
- 单元、集成、真实桌面/Android 视觉测试：
- 构建与 Release 下载链接：
- 真实仪器验证（是否实际连接、型号、版本、只读/输出，原始数据证据）：
- 未完成、风险和回退方法：

## 2026-11-10 / 网页 UI Demo 与 DKTS 分支治理（实现提交待验证）
- 需求：R-20261110-002、R-20261110-003（GitHub Issue #19）。
- 在 DKTS 内新增从现有 Web UI 生成静态站点的工具、纯离线演示适配器、GitHub Pages/Actions 流水线及安全回归测试。演示不修改 DKDS，不允许连接 4200A 或执行任何输出，也不将规划曲线伪装成仪器采集。
- 加入对 main 已完全包含、非保护且无活跃 PR 的历史分支的保守自动清理；其他有独有提交分支保留用于后续归并审查。删除结果以 GitHub Actions 实际输出为准，不在本日志预先声称清理成功。
- 待验证：Actions 网站构建、GitHub Pages 是否已开启以及真实可访问地址；桌面/Android 实机视觉测试、真正 DKDS Core Host 迁移及实际 KXCI 安全运行。此次只交付 UI 预览构建，不是新原生安装包验收。


## 2026-11-10 / 网页 UI Demo 初次运行结果及浏览器检查
- DKTS 提交 [ecf42750](https://github.com/davidkane0526/DK-Test-Studio/commit/ecf42750bf0b8e5a07015dce153b7e71e4e43916)：网页资源构建、离线安全测试与 Actions artifact 成功。 [网页构建 #42784784297](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/42784784297)。
- Pages 部署**失败（404）**，明确为仓库尚未启用 GitHub Pages：需有权限的维护者从 GitHub Settings > Pages 将 Source 设置为 GitHub Actions。网页打包产物已在本次构建工件可下载，不可声称线上地址已可访问。
- [分支治理 #42784784170](https://github.com/davidkane0526/DK-Test-Studio/actions/runs/42784784170) 成功删除已完全并入 main 的 `feat/kxci-native-smu-runner-ui-compact`，从 19 条减到 18 条；17 条有独有提交或保护关系的分支暂保留，不能把删除工作视为全部完成。
- 继续新增真实 Chromium 桌面和平板视觉交互测试：检查测试卡片、Xsweep/Psweep、禁用测量输出、无模拟 raw 行及无 `/api` 仪器请求；产出截图工件。测试结果以后续 CI 为准。
