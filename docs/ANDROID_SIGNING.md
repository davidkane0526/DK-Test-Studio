# DK Test Studio Android 稳定签名

> **必须一次性配置；不得上传私钥到 GitHub 源码或 Release。**

## 症状和根因

过去 Android Preview APK 使用 GitHub Actions 临时生成的 `debug.keystore` 执行 `:app:assembleDebug`。每次新 Runner 可能对应不同密钥，导致 `studio.dk.test` 包名相同但证书不同，Android 拒绝覆盖安装（`INSTALL_FAILED_UPDATE_INCOMPATIBLE`）。

从 **v0.2.4** 开始：
- GitHub Actions 只发布由固定 PKCS12 密钥生成的 `assembleRelease` APK。
- 私钥以 GitHub Actions Secrets 形式保存，**不会**进入仓库、日志、热更新资源和 Release。
- 每个 APK 用 Android `apksigner verify` 验签，并比对仓库的公开 SHA-256 指纹 `android/signing-certificate.sha256`。
- Secrets 缺失、证书变化或模拟器启动失败时，完整 Release 必须失败，**绝不能回退成新的随机 Debug 签名**。
- Windows Portable、Android APK、DKDS 插件、UI 热更新资源和 4200A 硬件能力数据库随完整版本一并构建，完整 Release 包含 **5 个文件**。

## 签名固定身份

包名：`studio.dk.test`

证书 SHA-256（公共指纹，非密钥）：

```
4E:3C:44:EA:E8:9C:38:73:D9:9A:CC:94:29:C4:52:8E:CD:E1:45:E7:F8:8A:97:FD:D9:81:59:C3:2E:C2:F3:63
```

别名 `dkts`，格式 PKCS12，私钥仅由软件所有者保管。

## 一次性设置 GitHub Actions Secrets

1. 下载并妥善保存私有签名包 `DKTS-Android-Signing-Kit.zip`（不要放入 Git、公共网盘或 Release），解压。
2. 在自己的 Windows 电脑上使用 `Upload-DKTS-Signing.ps1`，脚本通过已授权的 `gh` 登录上传两个 Secrets。使用前请检查脚本源码：
   `powershell -ExecutionPolicy Bypass -File .\Upload-DKTS-Signing.ps1`
3. 或到仓库 **Settings → Secrets and variables → Actions → New repository secret** 分别设置：
   - `DKTS_ANDROID_KEYSTORE_B64`：签名包内 .p12 文件内容的 Base64（不是文件路径）
   - `DKTS_ANDROID_SIGNING_PASSWORD`：签名包内密码
4. 通过 GitHub Actions **Re-run failed jobs** 或新推送触发完整构建。核对 Build signed APK、apksigner 指纹、Android 16 模拟器启动与 **6 文件 Release**。

GitHub Actions Secrets 设置页：https://github.com/davidkane0526/DK-Test-Studio/settings/secrets/actions

## 旧版迁移

**旧的随机 Debug 签名不能和新签名共存升级。仅第一次从旧版切换为 v0.2.4 可能需要卸载 `studio.dk.test`。卸载会清除应用私有数据。** 之后只要保留这份私钥，APK 可以正常覆盖升级。

检查设备已安装 APK 的证书：
```powershell
adb shell pm path studio.dk.test
# 获取 APK 后使用 Android SDK 的 apksigner verify --print-certs
```

安装遇到冲突，先备份应用内可导出的信息，再运行：
```powershell
adb uninstall studio.dk.test
adb install DK-Test-Studio-Android-Preview.apk
```

## 后续重要事项

- 将私钥和密码分别安全备份。**一旦丢失私钥，无法用另一个新签名覆盖安装现有同包名 APK。**
- 后续生产发布可沿用此安全密钥，也可以另设生产包名（不应默默替换现有的 `studio.dk.test` 私钥）。
- GitHub connector 无权管理仓库 Secrets，因此密钥上传须由仓库所有者本人执行。
