# DK Test Studio ↔ DK Data Studio 互操作设计契约

## 必须保持的不变量

1. 单一源代码：`src/shared/*.js` 是唯一 KXCI 协议、身份状态机、测试规划与波形校验实现。Node 包装层通过 CommonJS 转发；`tools/build-dkds-plugin.cjs` 复制同一份字节到 `.dkplugin`。严禁为两个程序各自另写测试核心。
2. 宿主适配而非平台耦合：独立版在 Node/Electron 中使用 TCP；插件版使用 `ctx.services.require('tcp')`、`ctx.ui.*`、`ctx.project`、`ctx.capabilities`。共享领域模块不直接依赖 Electron、DOM、React Native 或 DKDS Core。
3. 插件身份不变：`com.dkds.keithley-4200`、工作区 `keithley-4200`、项目切片 `keithley-4200`、Plugin API `1.19.0`。插件版本 `0.4.3` 高于 4200 分支内置版本 `0.3.0`。旧项目中的 `plan.mode` 自动转换成新的 `plan.kind`，不得抹去实验参数。
4. 稳定的方案交换格式：`dkts.4200.interop.v1`。导出和导入都强制 `executable:false` 与 `hardwareVerified:false`，不允许通过导入配置触发硬件动作。未来新增数据格式必须版本化，并保留原始仪器数据、派生数据及仿真数据的独立来源标识。
5. 统一的仪器安全边界：目前真实设备只发送 `*IDN?` 加 NUL；SMU/PMU 产生电压的执行层不开放。未来任何输出必须统一通过同一硬件能力验证、状态机、限流、紧急停止与故障关闭流程，不能为 DKDS 插件增加旁路。
6. 同一仪器只能有一个控制者：当前两个应用都是独立 TCP 客户端，严禁同时连接同一台 4200A 进行操作。实时互联需要未来统一的仪器 Broker，包括会话租约、用户鉴权、独占锁、失联停止和日志审计。
7. 发布前兼容性验证：每次修改 shared core 均运行 Windows/Ubuntu Node 测试、模拟 DKDS 插件激活测试、DK Data Studio SDK 1.19 验证与官方 `.dkplugin` 打包；SDK 通过不能代替真实 DKDS 中的插件安装与设备验收。

## 验证和构建

运行 `npm test` 验证独立协议、模拟硬件接口、数据规划、共享模块与插件激活。
运行 `npm run plugin:build` 在 `dist/dkds-plugin` 临时目录按同一源码生成插件，并生成候选 `.dkplugin`。
GitHub Actions 的 `DKDS Plugin API 1.19 compatibility` 任务会从 DK Data Studio 的 `4200` 分支读取官方 SDK，运行 `sdk/tools/dkds-plugin.js validate` 与 `package`，将通过校验的插件包上传为 `DK-Test-Studio-DKDS-Plugin` Artifact。

## 未完成的无缝联动内容

插件安装、真实 TCP 连接、Android 宿主仍需实机验收；跨程序实时控制、实验数据同步、原生文件及仪器图片导出尚未完成。请勿把 SDK 兼容视为完整功能验收。
