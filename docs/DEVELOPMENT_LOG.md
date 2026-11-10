# DKTS 开发日志（累积，不删除失败记录）

每次实质开发均追加：时间、需求 ID、DKTS GitHub SHA/PR、测试与发布、失败和未验收项。此文件不是仪器实测日志；以前开发记录只做可核查的追溯摘要，不能声称包含全部历史聊天文字。

## 2026-11-10 / 所有权与架构纠偏（进行中）
- 需求：R-20261110-001。DKTS 专属开发；DKDS 只通用通信、热更新和本地完整更新；删除内置 4200；保留非分析插件并复刻 FS-Pro；需求/日志入 GitHub。
- 已完成：审计 DKDS `4200` 分支，发现源插件目录仅有通用插件、`builtin.connectivity-center` 以及禁止内置 4200 的回归测试。关闭 DKDS 业务开发 PR [#16](https://github.com/davidkane0526/DK-Data-Studio/pull/16)；未合并其代码、未修改 DKDS 源码。
- 新的 DKTS 统一开发分支 `work/dkts-framework-migration`，新增架构规范、用户需求台账、开发日志和 DKDS 上游只读核查方案。
- 待证实：用户机器上安装的 4200 是外部插件、旧安装缓存或实际旧发行包；不能凭当前 GitHub 源码断言已从用户机器删除。DKDS 的其他历史远程分支尚未删除。完整 DKDS Host 在 DKTS 内替代现有独立 WebView 壳尚未实现、不可宣称完成。

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
