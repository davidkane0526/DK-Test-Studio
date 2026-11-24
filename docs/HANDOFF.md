# DK Test Studio 开发交接

在另一台电脑的 Codex 中可以直接说：「按 `docs/HANDOFF.md` 在现有 InstaBox 继续 DKTS 开发。」以 GitHub `main` 及同一 SHA 的源码归档为最新同步基线。正式发行编号取同一 SHA 的 `DKTS canonical release sequence`。

## 继续使用现有环境

1. 登录同一 InstaBox 账号，复用现有 Free 实例 `box-fe583e`。开始前用 `instabox usage --json` 确认费用和超额均为 0，使用 `instabox get box-fe583e --json` 核对实例。
2. 从 GitHub `main` 的最新提交或该提交的源码 ZIP 接续。若另有更新且已校验的未提交源码，先核对其基线和改动。每轮验证后直接提交并推送唯一的 `main`，核对 [固定网页预览](https://davidkane0526.github.io/DK-Test-Studio/core/) 的 [部署 SHA](https://davidkane0526.github.io/DK-Test-Studio/core/preview.json)，确认同一提交后把网页地址交付给用户。主线同步与网页部署在每轮验证后执行，Windows 和 Android 编译须取得明确授权。

3. 使用 Node.js 22。运行 `npm install --omit=dev --ignore-scripts --no-package-lock` 安装预览所需依赖，然后运行 `npm test`、`node tests/test-dkds-native-plugin.cjs` 和 `node tests/test-dkds-native-host.cjs`。`node tools/build-dkds-native-plugin.cjs` 构建当前独立插件 0.8.30。
4. 同源预览使用只读 DKDS SHA `20f056851a61d2144e9524c3ed568628d4b8557c`。实例缓存是 `/data/home/DKTS/a207/upstream/DK-Data-Studio`，也可从 GitHub 的同 SHA 复原。把该目录和输出目录传给 `node tools/build-same-source-preview.cjs`。本地使用输出目录内的启动脚本。GitHub Actions 按同一提交部署固定网页；InstaBox 供本地开发和验收。
5. 最终发布由 `.github/workflows/dkts-framework-contract.yml` 执行。获得最终构建授权后，正式 `main` 提交附 `[DKTS-FINAL-BUILD]`。用 `gh run list --commit <SHA>` 对照源码归档、正式序号、Windows 原生预览／编译、Android 编译及固定签名。只有同 SHA 的发布任务成功后才交付 `dkts-v<版本>-a<序号>` 的统一 Release。核对 `PROVENANCE.txt` 的源提交，再下载资产并运行 `sha256sum -c SHA256SUMS.txt`。

## 源码位置与数据归属

- 工程共享源／漏／栅物理映射。旧项目用迁移时的当前测试作为共享映射基线，并记录其他测试原有的不同映射。每个测试保留扫描、量程和保护参数。连接后的端口扫描刷新实装模块清单，活动测量期间暂停查询。
- 流程和单项测试分别保存图窗设置。单击测试显示该测试的图窗和历史，双击或点设置进入参数页。由 DKTS 发布的新数据包含测试和流程 ID。没有该归属的旧数据仍可在工程总览查看。
- 时间扫描、保持特性与脉冲扫描分为扫描、目标和策略。时间扫描保存切换步长、采样步长、循环次数、分段偏置和测量事件。扫描页的时间电压表和计划预览共用 `model.js` 的 `timeSummary`，从 `plugin.js` 的 `renderTime` 和 `paintTimePreview` 接续。仪器适配与验收见 [4200A 能力与时序界面](TIMING_AND_4200A_UI.md)。
- DC 在策略标签右侧显示测试类型和参考设置。通过 `--dkts-dc-columns` 同步修改顶部与端子行的两道竖线。每个端子的扫描段共享一种方法，方法变更作用于该端子的全部段。旧项目如包含混合方法可继续打开，应用参数前在左侧明确选择一种共享方法。
- 外观沿用 DKDS 的公开主题变量（`--surface-primary`、`--surface-secondary`、`--surface-sidebar`、`--text-primary` 等）。同步修改顶部和正文的双侧滚动槽，保持 DC 参数纵向分隔线对齐。计划时序预览通过 DKDS 主题修订事件更新画布。

- 原生工作区、工程模型在 `integrations/dkds-native/`，派生主题在 `tools/dkts-fspro-unit-theme.css`。
- 端口识别和量程使用 `integrations/dkds-native/hardware-capabilities.js`、`measurement-runtime.js` 和 `measurement-plan.js`。依据为 [Keithley 4200A-SCS 规格表](https://download.tek.com/datasheet/1KW-60780-7_4200A-SCS_Parameter_Analyzer_Datasheet_20250320.pdf)。固定电流量程按实装 SMU、前放和扫描电压选择，未核验时用 Auto。
- 当前生产策略仍拦截真实输出。KXCI Rev F 正文对照、互锁、实机测量和安装回退验收待完成。流程循环次数可保存，整套流程执行待接入。
- [需求记录](USER_REQUIREMENTS.md)、[开发日志](DEVELOPMENT_LOG.md)、[发布约定](RELEASE_VERSIONING.md) 和 [4200A 参考资料目录](reference/4200a/README.md) 均随源码提交。
