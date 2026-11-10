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

## 2026-11-10 / DKDS Core Preview 宿主真实 Routine/Page 层级（PR #18 开发分支）
- 在现有 `feat/dkts-core-host-boot` 分支中进一步开发 DKTS 自有 native plugin（不触碰 DKDS）：新增 Routine 实体、页面归属、从历史 schema-1 项目的无 Routine 快照自动迁移，支持添加 Routine、在当前 Routine 添加 Page、跨 Routine 跳转。新增输出/耐久/保持/PUND/ARB 等离线类型列表，但尚未实现这些测试的仪器执行。
- 导航在真正 DKDS Core 的 UnitTemplates 面板中实现，不采用 iframe 或重新复制旧卡片 UI。原始科学 PlotView、Data Center、Prime 等 DKDS Core 组件仍由宿主维护。
- 扩展 Core mock integration 验证新建 Routine 与子 Page 映射。CI 结果以后续 GitHub Actions 为准。只有 Core Preview 分支代码已变更；不能说主线 APK/EXE 已迁移。
