# DKDS 只读上游与远程分支治理（2026-11-10）

## 执行边界
DKDS `davidkane0526/DK-Data-Studio` 只提供通用通信、热更新、本地完整更新和成熟的 Core 基础设施。DKTS 的代码、FS-Pro UI、4200A 协议/测试均只在 DK-Test-Studio 开发。任何未来 DKDS 代码变更必须再次获得用户明确授权。

## 现场读取得到的事实
- DKDS `4200` HEAD：`20f056851a61d2144e9524c3ed568628d4b8557c`；DKDS `main` HEAD：`3ddd2655e214a5405ad07309fb2f03998f05361f`。
- `src/plugins/` 目录没有 4200A/Keithley 内置插件。包含通用 `builtin.connectivity-center`，SDK/TCP/热更新/桌面和 Android 更新代码存在。
- `tests/test-dkds-no-builtin-4200-external-plugin.js` 显示：旧内置插件 ID `com.dkds.keithley-4200` 被拒绝，现应使用由 DKTS 发行的外部 ID `com.dkts.keithley-4200`。源代码现状不能证明某个终端没有历史安装缓存。
- `feat/4200a-fspro-rebuild` → DKDS [PR #16](https://github.com/davidkane0526/DK-Data-Studio/pull/16) 已关闭、未合并；该分支不再是工作分支。
- 其他分支如 `main`、`dev`、`archive/*`、`backup/*`、独立 SDK 功能分支不能在未知归属时随意删除。
- 拟清理的 **本项目相关历史 DKDS 分支**：`feat/4200a-fspro-rebuild`、`feat/dkds-startup-update-prompt`、`fix/dkds-android-update-versioning`、`fix/dkds-external-plugin-identity-install`、`fix/dkds-github-403-shared-release-cache`、`fix/dkds-update-order-and-hot-rollback`、`fix/dkds-version-footer-regression-gate`、`fix/dkts-cross-project-smoke-install`、`fix/purge-retired-4200-plugin-state`、`fix/separate-app-version-hot-build-id`、`fix/v3.72.1-direct-android-install`、`fix/v3.72.2-lowercase-ui-version`。其中可能含尚未合并的通用宿主修复，**删除前必须确认是否已并入保留分支并保存引用**。

## 实际清理状态
已关闭 DKDS PR #16；**远程分支删除尚未执行**。当前 GitHub 连接器提供查询、创建和更新分支，但没有删除分支操作，因此不得假装已清理。不得通过强制移动分支引用冒充删除。待通过有删除权限的 GitHub UI/CLI 执行并确认后，在此日志记每条删除结果。

## 已安装的旧 4200 插件
要判断用户看到的 4200 是否“内置”，必须核对安装程序版本、Plugin Manager 中的 `source / id`、外部插件存储和旧内置偏好。不要直接删除用户的项目数据；只能按已有迁移/清理程序删除已识别的退役插件条目。此操作在用户设备尚未完成。
