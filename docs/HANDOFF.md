# DK Test Studio 开发交接

在另一台电脑的 Codex 中可以直接说：「拉取 GitHub 的 `davidkane0526/DK-Test-Studio` 的 `main`，按 `docs/HANDOFF.md` 在现有 InstaBox 继续开发。」V0.3.32 对应开发批次 a212，正式发行编号取同一 SHA 的 `DKTS canonical release sequence`。

## 继续使用现有环境

1. 登录同一 InstaBox 账号，复用现有 Free 实例 `box-fe583e`。开始前用 `instabox usage --json` 确认费用和超额均为 0，使用 `instabox get box-fe583e --json` 核对实例。
2. 实例已有 Git 工作区 `/data/home/DKTS/a212/work/DK-Test-Studio`。在该目录执行 `git status -sb`，确认当前状态后执行 `git fetch origin main` 与 `git merge --ff-only origin/main`。若有未提交工作，接续该工作。若目录已迁移，在同一实例克隆 `https://github.com/davidkane0526/DK-Test-Studio.git` 的 `main`。
3. 使用 Node.js 22。安装依赖后运行 `npm test`、`node tests/test-dkds-native-plugin.cjs` 和 `node tests/test-dkds-native-host.cjs`。`node tools/build-dkds-native-plugin.cjs` 构建当前独立插件 0.8.19。
4. 同源预览使用只读 DKDS SHA `20f056851a61d2144e9524c3ed568628d4b8557c`。实例缓存是 `/data/home/DKTS/a207/upstream/DK-Data-Studio`，也可从 GitHub 的同 SHA 复原。把该目录和输出目录传给 `node tools/build-same-source-preview.cjs`。本地使用输出目录内的启动脚本。公开预览使用同一实例的 4174 端口，限制 60 分钟与 256 MiB。
5. 最终发布由 `.github/workflows/dkts-framework-contract.yml` 执行。获得最终构建授权后，正式 main 提交附 `[DKTS-FINAL-BUILD]`。检查同 SHA 的源码归档、版本分配、Windows 构建、Android 固定签名和统一 Release。签名由现有 GitHub Actions secrets 提供。

## 源码位置

- 原生工作区、工程模型在 `integrations/dkds-native/`，派生主题在 `tools/dkts-fspro-unit-theme.css`。
- 端口识别和量程使用 `integrations/dkds-native/hardware-capabilities.js`、`measurement-runtime.js` 和 `measurement-plan.js`。依据为 [Keithley 4200A-SCS 规格表](https://download.tek.com/datasheet/1KW-60780-7_4200A-SCS_Parameter_Analyzer_Datasheet_20250320.pdf)。固定电流量程按实装 SMU、前放和扫描电压选择，未核验时用 Auto。
- 当前生产策略仍拦截真实输出。KXCI Rev F 正文对照、互锁、实机测量和安装回退验收待完成。流程循环次数可保存，整套流程执行待接入。
- [需求记录](USER_REQUIREMENTS.md)、[开发日志](DEVELOPMENT_LOG.md)、[发布约定](RELEASE_VERSIONING.md) 和 [4200A 参考资料目录](reference/4200a/README.md) 均随源码提交。