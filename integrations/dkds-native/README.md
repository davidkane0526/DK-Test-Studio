# DKTS 4200A · 原生 DKDS TOP 工作区（外部插件原型）

此目录不是 `src/plugins/`，因此不会让 DKDS 再内置一个 4200A。它是按 Plugin API 1.19 编写的外部 `.dkplugin` 来源，插件 ID 沿用现有 DKTS 的 `com.dkts.keithley-4200`，未来通过插件管理器升级原版本，而非并列重复安装。

- DKDS 原生 Activity、TOP、PRIMARY（科学绘图）及 PRIME（参数、端口），而非 iframe 或独立 CSS 外壳。
- 使用 `ctx.ui.unitTemplates` 和 DKDS 科学曲面：主题与控件视觉由 DKDS 统一提供，不叠加私有点击阴影。
- 数据源来自 `ctx.data.sources.list()` 和 `ctx.data.artifacts.get()`。数据中心、分组图标题、历史、AI、SMB、网页服务及内存由 DKDS 宿主维护。
- `ctx.state.create(...,{projectSlice:'settings'})` 用于项目持久化，`ctx.project.capture()` 记入宿主历史。
- 5 种离线测试页面、参数组织和端子映射；**None 不显示在参数面板**。
- 不具备原生测量权限。当前仅为插件开发预览，禁止对实物输出，测试类型与档位未完成真正的 KXCI 授权。
- 此外部插件并不能让当前独立的 FS-Pro 预览 EXE 自动继承所有 DKDS 功能。独立版需要改为使用同一宿主 Core 启动链。
- 目前尚未恢复独立版热更新；切勿将离线的 manifest 选择规则称为已上线的更新器。

验证：`node sdk/tools/dkds-plugin.js validate tools/4200a/dkds-native-workspace`。
打包：`node sdk/tools/dkds-plugin.js package tools/4200a/dkds-native-workspace dist/DKTS-4200A-native-v0.8.0.dkplugin`。

## v0.8.0：FS-Pro 风格离线 X/P 双层扫描草稿

- 独立配置 Xsweep、可选 Psweep、各轴重复次数、整体循环与各段起止/步长/量程/点间延迟。
- 新项目与既有 schema 1 项目可以迁移至带有 sweep 字段的状态；编辑始终返回新快照。
- 降序步长、非法数值、过限源量/量程及同一 SMU 重复分配由模型拒绝；总点数仅做离线预览。
- 仅真实分配的 SMU 端口进入参数编辑器，全部控制使用 DKDS Core 的 Unit / PRIME / TOP / PlotView。
- 本版本不能将计划解释为经过现场硬件认证的指令，也不会通过插件执行 KXCI 输出。
