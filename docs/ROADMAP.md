# DKTS 2026-11-10 起的执行路线（最新）

**唯一业务仓库 DK Test Studio。DKDS 只读框架来源，不允许顺手修改 DKDS 代码。**

## P0 — 需求、归属、版本修正（进行中）
- [x] 明确 DKDS 只允许通用通信、UI 热更、本地完整包更新，不再开发 4200A 测量业务。
- [x] 关闭 DKDS 的 4200A FS-Pro 开发 PR，不合并到 DKDS。
- [x] 在 DKTS GitHub 创建需求台账、开发日志、AGENTS.md，未来每次非“继续”用户要求必须记录。
- [x] DKTS 正式 Release 不再双发相同插件 ID 的 legacy/native .dkplugin；实验插件独立。
- [x] 增加从唯一 main 导出 DKTS 源码 ZIP 和固定 SHA DKDS 只读依赖 ZIP 的 Actions 工作流。
- [x] 为当前 DKDS Core V/a 更新路径增加缓存完整性回归断言：Windows 缓存 EXE 每次使用前复核 SHA-256，Android 缓存 APK 每次安装前复核大小/SHA-256、包名、版本码和签名。固定 DKDS 源码已包含这些保护，无需移植旧独立更新器实现。
- [x] 审核并清理所有非 main 分支；main-only workflow 已执行并通过，GitHub API 确认仅保留 `main`。
- [ ] 检查用户已安装 DKDS 的旧 4200 插件是内置、历史缓存还是手动安装，并根据实际来源清理。

## P1 — DKDS 框架成为 DKTS 真正的单一宿主
- [x] 只读上游检查、按 manifest 保留全部非分析插件并临时排除分析插件、独立 DKTS 源码暂存流程。
- [x] 上一已验证安装包为 **V0.3.13 a190**：DKTS 品牌 Windows Portable、Android APK、API 36 模拟器与固定签名 CI 均通过；真实设备验收仍待完成。当前云端源码为 **V0.3.25 a205**（a205 为暂存编号），新版本 Windows/Android 安装包尚未构建/发布。
- [x] 将 Core 原生更新源绑定单一 DKTS Release；Windows/Android 按 V+aNNN 选择同版本新构建，校验资产身份、SHA-256，Android 额外校验稳定包名/版本码/签名；CSS-only bundle 使用四文件白名单并与完整包共用同一 Release。
- [ ] 完成真实 Windows Portable/Android 固定签名设备上的应用内更新、403/504 恢复、热更新/全量升级与失败回退验收。
- [ ] Android 派生宿主隐藏系统顶部状态栏（时间/Wi-Fi/蓝牙/电量），保留应用自身底部状态栏，并通过 API 36 手机/平板截图验证。**源码修正已在 V0.3.14 基线完成，并继承至 V0.3.20 a200；仍待 Android 构建和截图验收。**
- [ ] 对用户设备进行真正的 Windows/Android 视觉验证，逐项保留 DKDS 控件交互。

## P2 — FS-Pro 界面与同一套业务状态
- [x] 第一轮 DKTS 原生 UI 结构整理（V0.3.15 a195）：删除重复端口 PRIME；Xsweep/Psweep 扫描段改为连续六列 Unit 编辑行；Strategy 独占整体循环/各轴重复次数/Psweep 开关；Limits 独占每个已分配端口的量程模式、测量档位和限流/限压；Info 不再重复显示循环参数。
- [x] Project Explorer 同时高亮当前 Routine 与 Page；保留 Project → Device → Routine → Page/Spec 结构。
- [ ] Windows Electron 1200×768、744×600 与 Android 320×640/1024×768 实际截图对照。当前云端没有 Electron/Android SDK/Gradle/模拟器，尚未完成真实视觉验收。
- [x] Project → Device → Routine → Page/Spec；Edit Page 页面信息位于主标签上方，主标签仅 Sweep/Target/Strategy，Limits 独占一列，Page Var/Associate Spec 在另一列纵向排列。
- [ ] Xsweep/Psweep 多段表、各轴循环、各端口独立量程/限流/时间设置；不重复编辑同一参数。
- [x] Project Explorer 提供单一“＋ Page”菜单并保留十种测试类型；None 端口不进入参数编辑区；不显示无功能锁定按钮。
- [ ] 窗口关闭/Tab 恢复与参数面板开闭独立；桌面/Android 触控与弹出菜单仍需实机验收。
- [ ] DKDS PlotView/Unit/科学键盘/Theme/数据中心的完整继承与移动端手势验证。

## P3 — 4200A 原生测量与原始数据
- [ ] 按最新 KXCI Rev. F 正文及实机校核能力数据库和模块清单，遵守硬件理论能力且同时按接口限制报告兼容性。
- [x] V0.3.24：Core 原生插件通过 DKDS 通用 `network.tcp` capability 接入只读身份/模块识别；加入 ACK 逐条读取、显式启动确认、stop/关闭 SMU 和原始 TI 行发布 Data Center 的 DC SMU 运行时；模拟 TCP 回归通过。
- [ ] 实际 SMU 输出仍受 Rev F 正文未核验这一生产门禁阻止；V0.3.25 已接入 SDK 1.19 `ui.dom.timeout()`，主机逐点 DV/TI 调度已具备模拟执行路径。核验 Rev F、互锁和真实仪器异常处理前仍不得开放输出。PMU/CVU 执行链路尚未实现。
- [ ] 主机逐点 `DV/TI` 模式不是仪器内部扫描，不能兑现 20 ns 硬件时序；已使用 DKDS 生命周期 timer，不创建插件 raw timer。需依据 Rev F 核验 KXCI 原生 system-sweep 命令并实机测量后，才能报告仪器级扫描速度。
- [ ] 真实仪器原始数据/原生文件与绘图分离；不得将软件重绘图称为仪器原生图片。
- [ ] Ethernet/Wi-Fi、Android USB LAN、Windows 和平板 LAN 网关按目标机验证。

## 通过条件
只有 P1/P2/P3 各自证据充分时才可宣称完成。每轮提交必须附日志、截图/测试、GitHub SHA 和实际发布资产；流程失败记录不能删。

- [x] 第三轮 DKTS 原生 UI 信息架构重构（V0.3.17 a197）：Edit Page 主标签恢复为 Sweep/Target/Strategy；Limits、Page Var、Associate Spec 放入 Sweep 下方响应式三栏；Info 移至页面工具区；测试类型收敛为一个菜单入口，避免十个常驻按钮。真实 Electron/Android 截图验收仍未完成。
- [x] 第四轮 DKTS 原生 UI 优化（V0.3.18 a198 暂存）：Condition/Xsweep/Psweep 角色移入各 SMU 端口行，删除重复 X/P 物理端口选择；手机端四个端口下拉收敛为单一 Core Popover 并在一次事务中校验；侧栏切换 DKDS 235px compact layout；四个绘图子窗口压缩纵向占用。真实 Electron/Android 截图和安装包验收仍待 CI。
- [x] 第五轮 DKTS 原生 UI 优化（V0.3.19 a199 暂存）：扫描摘要改为 Core Summary strip；Sweep 下方调整为 Limits 单列 + Page Var/Associate Spec 纵向列；Page Info 删除重复测试类型；Target 只显示已分配 SMU；Psweep 关闭时禁用重复次数。SDK 1.19 运行时和 64 个布局案例通过，真实 Electron/Android 截图仍待 CI。

- [x] 第六轮 DKTS 原生 UI 优化（V0.3.20 a200 暂存）：PlotView 图形类型选择收敛为标题栏菜单；平板/手机端端口配置入口统一；避免未变更输入引起重新渲染；减少 Sweep 多余提示。通过离线 Chromium CSS 几何检查。尚未取得真实 Core Electron 和 Android 界面截图。

- [x] 2026-11-16：**V0.3.21 a201** 同源 DKDS Core 网页预览构建；修复正式宿主因 SDK 非法布局值无法激活 DKTS 原生插件的问题。源代码和 SDK 测试完成，Windows 预览启动脚本及实际 D3 绘图仍待目标机验证。
- [ ] 最终 UI 审核后执行唯一 `main` 的 `[DKTS-FINAL-BUILD]` GitHub Actions，交付真实 Windows Portable EXE 与 Android APK。


- [x] 2026-11-16：**V0.3.23 a203** 修复 DKDS SDK 1.19 对 PlotView panel body 的 `overflow:hidden` 校验失败；新增可复现的 `DKTS-Core-Same-Source-Preview` 构建脚本、localhost 预览服务器与 Windows 一键启动包。Core runtime/style/SDK/plugin generation 与 Plugin API 校验通过；浏览器首次启动需联网安装固定 D3 7.9.0，实际 Electron/Android 原生截图仍待后续验证。

- [x] 2026-11-16：**V0.3.24 a204** 将身份/模块核验与受门禁控制的 DC SMU KXCI 运行时接入 Core 原生插件；修复 Ethernet ACK 缓冲污染风险；`npm test` 214/214、SDK Plugin API 1.19 校验通过。同源预览完成关键资源 HTTP 200 检查。真实输出当时仍受 Rev F 与 Core 调度双门禁阻止；V0.3.25 已通过 SDK `ui.dom.timeout()` 消除调度接口阻塞，Rev F 门禁仍保留。

- [x] V0.3.25：逐点 DV/TI 执行接入 DKDS `ui.dom.timeout()` 生命周期定时服务，停止时取消待执行 timer；真实仪器输出仍受 Rev F 正文核验门禁阻止。

## Visual freeze / V0.3.26 a206 (provisional)
- [x] 从原生 Page Header 移出连接/端口映射，去除冗余标题元信息，Xsweep 和 Psweep 恢复第一屏。
- [x] 已认可 Web 工作区 SHA 锁定并增加不可擅自修改的防回退测试。
- [ ] 用真实 Electron/Android 逐视口与参考图复查全部 35 项 FS-Pro 视觉验收；本轮浏览器离线截图不能替代实机。
- [ ] 完成 UI 验收前暂停其他 KXCI 功能合并。
