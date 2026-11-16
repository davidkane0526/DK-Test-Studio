#!/usr/bin/env python3
"""Optional screenshot/geometry fixture for DKTS-owned responsive CSS.
This deliberately does NOT emulate DKDS Unit rendering, Electron, or Android.
It tests only breakpoints of the local plugin stylesheet in Chromium.
Requires Python Playwright; not part of the npm release gate.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist' / 'native-ui-geometry-fixture'
OUT.mkdir(parents=True, exist_ok=True)
css = (ROOT / 'integrations/dkds-native/ui-shell.css').read_text()
html = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;background:#f6f7f9;color:#243146;font:13px system-ui,'Noto Sans CJK SC',sans-serif}
#dktsKeithley4200Page{height:100vh;padding:0}
.main{height:100%;display:grid;grid-template-columns:235px minmax(0,1fr);gap:8px;position:relative}
[data-dkts-nav]{background:#fff;border-right:1px solid #e4e6ee}
[data-dkts-work]{background:#fff}
[data-dkts-editor]{display:flex;flex-direction:column;gap:8px}
.heading,.plot-heading{min-height:52px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid #eee;padding:0 8px}
.heading strong{font-size:15px;white-space:nowrap}.actions{display:flex;align-items:center;gap:7px;min-width:0}
.dkts-terminal-toolbar,.dkts-terminal-control-group{display:flex;align-items:center;gap:6px;min-width:0}
.field{display:flex;align-items:center;height:32px;justify-content:center;border:1px solid #d9dee8;border-radius:6px;padding:0 7px;background:white;white-space:nowrap}
button{background:white;border:1px solid #d9dee8;border-radius:6px;padding:6px 9px;color:inherit;white-space:nowrap}
.dkts-parameter-content{background:#fff;display:flex;flex-direction:column;gap:8px}
.panel{padding:12px;border:1px solid #e2e6ed;border-radius:8px;min-width:0}
.panel strong{font-size:13px}
.dkts-sweep-related{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.dkts-frame-actions{display:flex}
[data-dkts-plot-header]{background:#fff;border:1px solid #e2e6ed;border-radius:6px}
[data-dkts-plot-frame]{min-height:140px}
.dkts-sweep-segment-head{display:grid}
@media(max-width:900px){.main{grid-template-columns:minmax(0,1fr);gap:0}}
@media(max-width:680px){.dkts-sweep-related{grid-template-columns:1fr}}
</style><style>PLUGIN_CSS</style></head><body>
<section id="dktsKeithley4200Page"><div class="main" data-dkts-shell="true" data-dkts-nav-open="false">
<aside data-dkts-nav="true"><strong>工程导航</strong><p>MOSFET</p><p>测试流程 1</p><p>　I–V 扫描</p></aside>
<main data-dkts-work="true"><div data-dkts-editor="true">
<div class="heading dkts-page-heading"><strong>编辑页面 · I–V 扫描</strong><div class="actions">
<button data-dkts-nav-toggle>导航</button><button>← 返回绘图区</button>
<div class="dkts-terminal-control-group"><div class="dkts-terminal-toolbar" data-dkts-port-desktop="true">
<div class="field dkts-terminal-field">S · SMU1</div><div class="field dkts-terminal-field">D · SMU2</div><div class="field dkts-terminal-field">G · None</div><div class="field dkts-terminal-field">B · None</div>
</div><div data-dkts-terminal-divider>│</div><button data-dkts-port-mobile>端口</button></div></div></div>
<div class="dkts-page-info-region panel">页面信息　 <span>页面名称：I–V 扫描</span></div>
<div class="dkts-editor-tabs panel">扫描 Sweep　　目标 Target　　策略 Strategy</div>
<div class="dkts-parameter-content"><div class="panel">扫描概览　　X 21点　　 P 未启用　　 循环 1次</div>
<div class="panel">端口设置　　D · SMU2　　电压源　　Xsweep</div>
<div class="panel">Xsweep　　起始　　　结束　　　步长　　　档位</div>
<div class="dkts-sweep-related"><div class="panel dkts-limits-column">Limits · 限值</div><div class="dkts-sweep-metadata-column"><div class="panel">Page Var</div><div class="panel">Associate Spec</div></div></div>
<div data-dkts-plot-header class="plot-heading"><strong>图窗 1</strong><div class="dkts-frame-actions"><button>显示</button><button>数据</button></div></div>
</div></div></main><div data-dkts-nav-scrim></div></div></section></body></html>'''.replace('PLUGIN_CSS',css)

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for name,w,h,wide_port in [('desktop',1200,768,True),('tablet',744,600,False),('phone',390,844,False)]:
  page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
  page.set_content(html)
  evidence=page.evaluate('''() => {
   const get=(sel)=>{const n=document.querySelector(sel);const r=n.getBoundingClientRect();const s=getComputedStyle(n);return{display:s.display,width:r.width,x:r.x,right:r.right,visibility:s.visibility}};
   return {wide:get('[data-dkts-port-desktop]'),compact:get('[data-dkts-port-mobile]'),
    header:get('.heading'),plotButtons:get('.dkts-frame-actions'),
    documentOverflow:document.documentElement.scrollWidth>innerWidth,
    editorOverflow:document.querySelector('.heading').scrollWidth>document.querySelector('.heading').clientWidth};
  }''')
  assert (evidence['wide']['visibility']!='hidden') == wide_port,(name,evidence)
  assert (evidence['compact']['display']!='none') == (not wide_port),(name,evidence)
  assert not evidence['documentOverflow'],(name,evidence)
  assert not evidence['editorOverflow'],(name,evidence)
  page.screenshot(path=str(OUT/f'{name}.png'))
  print(name,evidence)
  page.close()
 browser.close()
print('PASS: CSS-only geometry fixture; NOT a real native host or Android screenshot')
