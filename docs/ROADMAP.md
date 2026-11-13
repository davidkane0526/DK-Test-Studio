# DKTS 2026-11-10 起的执行路线（最新）

**唯一业务仓库 DK Test Studio。DKDS 只读框架来源，不允许顺手修改 DKDS 代码。**

## P0 — 需求、归属、版本修正（进行中）
- [x] 明确 DKDS 只允许通用通信、UI 热更、本地完整包更新，不再开发 4200A 测量业务。
- [x] 关闭 DKDS 的 4200A FS-Pro 开发 PR，不合并到 DKDS。
- [x] 在 DKTS GitHub 创建需求台账、开发日志、AGENTS.md，未来每次非“继续”用户要求必须记录。
- [x] DKTS 正式 Release 不再双发相同插件 ID 的 legacy/native .dkplugin；实验插件独立。
- [ ] 清理已确认属于本次工作的临时源码归档分支；先验证 ZIP 和 Actions 记录，再删除临时 ops 分支。
- [ ] 检查用户已安装 DKDS 的旧 4200 插件是内置、历史缓存还是手动安装，并根据实际来源清理。

## P1 — DKDS 框架成为 DKTS 真正的单一宿主
- [x] 只读上游检查、按 manifest 保留全部非分析插件并临时排除分析插件、独立 DKTS 源码暂存流程。
- [ ] 实际从 DKDS Core 构建 **DKTS 品牌** Windows Portable 和 Android APK，继承官方组件、主题、数据中心、图表、内存、SMB、AI、历史、网页服务。
- [x] 将 Core 原生更新源绑定单一 DKTS Release；Windows/Android 按 V+aNNN 选择同版本新构建，校验资产身份、SHA-256，Android 额外校验稳定包名/版本码/签名；CSS-only bundle 使用四文件白名单并与完整包共用同一 Release。
- [ ] 完成真实 Windows Portable/Android 固定签名设备上的应用内更新、403/504 恢复、热更新/全量升级与失败回退验收。
- [ ] 对用户设备进行真正的 Windows/Android 视觉验证，逐项保留 DKDS 控件交互。

## P2 — FS-Pro 界面与同一套业务状态
- [ ] Project → Device → Routine → Page/Spec；Edit Page: Info/tools、Sweep/Target/Strategy、Limits/Page Var/Associate Spec。
- [ ] Xsweep/Psweep 多段表、各轴循环、各端口独立量程/限流/时间设置；不重复编辑同一参数。
- [ ] 项目导航增选测试；窗口关闭/Tab 恢复与参数面板开闭独立；None 端口不占参数空间；无点击阴影/默认锁定。
- [ ] DKDS PlotView/Unit/科学键盘/Theme/数据中心的完整继承与移动端手势验证。

## P3 — 4200A 原生测量与原始数据
- [ ] 按最新 KXCI Rev. F 正文及实机校核能力数据库和模块清单，遵守硬件理论能力且同时按接口限制报告兼容性。
- [ ] 原生 SMU/PMU/CVU 的起停、断线、限流/量程、安全关闭、禁止同时执行两个测试。
- [ ] 真实仪器原始数据/原生文件与绘图分离；不得将软件重绘图称为仪器原生图片。
- [ ] Ethernet/Wi-Fi、Android USB LAN、Windows 和平板 LAN 网关按目标机验证。

## 通过条件
只有 P1/P2/P3 各自证据充分时才可宣称完成。每轮提交必须附日志、截图/测试、GitHub SHA 和实际发布资产；流程失败记录不能删。
