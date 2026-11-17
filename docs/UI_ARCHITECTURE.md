# DK Test Studio UI — a97 visual rollback
The November 6 layered redesign was rolled back because its global chrome, field and scroll rules regressed Android numeric editing and the anchored select dropdown. The visually authoritative baseline is the working pre-PR a97 `web/styles.css` (commit `f4680808`).

The project retains the newer KXCI measurement runner, native bridges, DKDS plugin integration, and original UI JavaScript handlers. Only the stylesheet cascade was restored. The number pad, floating select, scientific plot controls and status chrome still use their a97 style and interaction semantics. All size corrections are isolated to `web/ui/controls-alignment.css`.

## Sources
- `web/ui/legacy.css`: complete pre-PR a97 stylesheet, intentionally unlayered.
- `web/ui/controls-alignment.css`: limited 36 px desktop/44 px Android form control heights and alignment.
- `web/ui/runtime.js` / `web/app-main.js`: original measurement/UI runtime, still compiled into `web/app.js`.
- `web/ui/{tokens,layout,components,measurement,responsive}.css`: archived, **not emitted** by the compiler; must not be re-enabled without an interactive regression test.

`tools/build-ui-system.cjs` builds `web/styles.css` and `web/app.js` deterministically. Android, Windows and DKDS share the established three-file set: index.html, app.js and styles.css.

## Regression safeguards
- Never apply a generic action/field selector to number-pad keys, dropdown list items or chart buttons.
- Do not replace document scrolling with a fixed flex viewport while the a97 keypad and popover use viewport-relative coordinates and `window.scrollBy`.
- Do not add a global `@layer` cascade over the a97 stylesheet.
- Preserve instrument safety and data provenance independently of appearance changes.


# FS-Pro 统一 UI 与 DKTS Unit 扩展（2026-11-17）

## 唯一 UI 源码基线
用户指定的 `https://davidkane0526.github.io/DK-Test-Studio/` 是唯一视觉/交互基线。Web 预览与 DKDS Core 原生宿主必须复用同一信息架构、标签、参数字段顺序、交互状态模型和样式 token；不允许把 FS-Pro 当作图片参考，再另行拼装一套 Core 页面。

## 七标签信息架构
Page Editor 的七标签顺序固定为 Info、Sweep、Target、Strategy、Limits、Page Var、Associate Spec。Info 只管理页面名称、测试类型、循环、器件和备注；Sweep 管理 Xsweep/Psweep、Terminal Settings、Fixed Bias；其他五个标签各自拥有独立内容区。不得把 Limits、Page Var 或 Associate Spec 再次嵌入 Sweep。

## Unit 扩展边界
DKDS Unit 是基础组件体系，但不能以 Unit 当前默认布局反向约束 FS-Pro。若 Tabs 的事件、表格行列、Field 标签/控件布局、Panel Header 或响应式能力不足，应扩展 DKTS 自有 Unit adapter/variant；如需修改 SDK Unit 实现，只允许修改 DKTS 派生 Core 构建副本，绝不修改固定 SHA 的 DKDS 上游仓库。扩展必须保留 DKDS 生命周期、主题、可访问性、Unit identity 和 Presenter 约定。

## 同源宿主
同一 FS-Pro 页面/Unit 实现应由 DKTS Web 预览与 DKDS Core 原生宿主加载。DKDS 继续提供通信、数据中心、PlotView、项目、主题、更新和插件生命周期；DKTS 只提供 4200A 域模型、页面结构、扫描参数与硬件操作。

## 视觉与开发验收
固定 1591×900、1280×800、744×600、390×844 四种视口，在相同 Chromium 版本、主题和项目状态下进行真实截图比较。检查标签、Header、Terminal、Xsweep/Psweep 表格、字段尺寸/间距/边框、四个 PlotView 和状态栏。每一完整开发阶段集中执行一次测试和同源预览构建；不为单个小修改频繁编译。EXE/APK 只在最终签收时统一构建。
