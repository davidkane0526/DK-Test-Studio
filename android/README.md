# DK Test Studio Android (独立 APK)

此目录是 DK Test Studio **独立 Android 应用**，不要求安装 DK Data Studio、其插件或 Root。

- 独立 Android Activity + WebViewAssetLoader，本机加载打包静态工作台。
- `src/shared/` 与 Windows / DKDS 插件 **逐字节共用** KXCI 身份协议、连接状态机、I–V/I–t 和任意波形规划模型。
- Android 原生 Java 网络桥接，绑定 Android Ethernet/Wi-Fi Network.socketFactory；仅允许只读 `*IDN?\0` 与 `*OPT?\0`。
- 暂不发布局域网服务器，不允许任意 KXCI、SMU/PMU 输出和扫描指令。
- 只在本机应用中执行。本 APK 是开发预览版，**没有实机验收**。

## 构建

本目录不依赖 DK Data Studio。JDK 17、Android SDK 35 和 Gradle 8.10.2：

```sh
node tools/sync-android-assets.cjs
gradle -p android :app:assembleDebug
```

APK 位于 `android/app/build/outputs/apk/debug/app-debug.apk`。

CI 会生成 **debug-signed** 预览 APK。不同 GitHub Runner 的临时调试签名可能改变，因此跨构建更新可能需要先卸载旧预览版，导致应用数据丢失。正式升级分发应配置稳定的私有签名密钥并使用 release signing。

## USB 网线网络说明

Android 是否能在无 Root 状态下通过 USB-C 转网口访问 `169.254.111.118`，取决于系统是否将其枚举为 Ethernet Network 且为网卡配置与 4200A 可路由的 IPv4 地址。App 无权限越过系统权限直接给网卡设置静态 IPv4。因此**不能保证所有设备无需 Root 一定可连接**。如无法连接，请在 Android 网络设置中正确配置网卡 IP（若系统支持），或使用已可路由的 Wi-Fi / 后续安全中继方案。

KXCI 身份和模块只读响应的自动化测试使用伪仪器，不能替代实验室实际测量。
