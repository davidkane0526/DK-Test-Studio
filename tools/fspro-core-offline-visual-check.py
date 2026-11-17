#!/usr/bin/env python3
"""Renderer-level FS-Pro UI regression for a built same-source DKDS Core host.

Uses the actual authored Core/plugin JS and CSS; inlines assets because the
CI sandbox sometimes forbids *all* Chromium URL navigation. The injection
shim only replaces dynamic local script/link loading, never hardware calls.
Screenshots are browser DOM evidence, not Electron or Android app acceptance.

Requires `playwright` Python package and a Chromium executable. Usage:
python tools/fspro-core-offline-visual-check.py <generated-preview/host> <screenshots-dir>
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, re, sys, os, time

HOST=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else None
OUT=Path(sys.argv[2]).resolve() if len(sys.argv)>2 else None
if HOST is None or OUT is None:
 raise SystemExit('Usage: fspro-core-offline-visual-check.py HOST OUTPUT')
BASE=HOST/'src'
if not (BASE/'index.html').is_file():raise SystemExit('generated Core src/index.html required')
OUT.mkdir(parents=True,exist_ok=True)

def inline_imports(p,stack=()):
 if p in stack:raise RuntimeError('recursive CSS @import: '+str(p))
 src=p.read_text(errors='replace')
 def sub(match):
  target=(p.parent/match.group(1)).resolve()
  if not target.is_file():raise FileNotFoundError(target)
  text=inline_imports(target,stack+(p,))
  layer=match.group(2)
  return '@layer '+layer+'{\n'+text+'\n}' if layer else text
 return re.sub(r'@import\s+url\([\"\']([^\"\']+)[\"\']\)\s*(?:layer\(([^)]+)\))?\s*;',sub,src)

html=(BASE/'index.html').read_text().replace("const desktopPreview=query.has('dktsDesktopPreview')","const desktopPreview=true")
pluginFiles={p.relative_to(BASE).as_posix():p.read_text(errors='replace') for p in (BASE/'plugins').rglob('*') if p.suffix in {'.js','.css'}}
# SCRIPT files for dynamic plugin loaders are loaded only on-demand, preserving
# their actual activation order. The browser-only loading replacement reports
# a load event after the original source has executed in the global context.
shim='''<script>
(()=>{const sources=PLUGIN_SOURCE_DICTIONARY;const append=Node.prototype.appendChild;
 Node.prototype.appendChild=function(child){
  if(child?.tagName==='SCRIPT'&&child.getAttribute('src')){
   const name=child.getAttribute('src').split('?')[0].replace(/^\\.?\\/?/,'');
   if(sources[name]){child.removeAttribute('src');child.textContent=sources[name];
    const result=append.call(this,child);queueMicrotask(()=>child.dispatchEvent(new Event('load')));return result;}
  }
  if(child?.tagName==='LINK'&&child.getAttribute('href')){
   const name=child.getAttribute('href').split('?')[0].replace(/^\\.?\\/?/,'');
   if(sources[name]){const style=document.createElement('style');style.textContent=sources[name];
    const result=append.call(this,style);queueMicrotask(()=>child.dispatchEvent(new Event('load')));return result;}
  }
  return append.call(this,child);
 };})();
</script>'''.replace('PLUGIN_SOURCE_DICTIONARY',json.dumps(pluginFiles,ensure_ascii=False).replace('</script','<\\/script'))
html=html.replace('<head>','<head>'+shim,1)
def inline_script(match):
 src=match.group(2);path=(BASE/src).resolve()
 if not path.is_file():raise FileNotFoundError(path)
 return '<script data-core-source="'+src+'">\n'+path.read_text(errors='replace').replace('</script','<\\/script')+'\n</script>'
html=re.sub(r'<script\s+src=("|\')(.*?)\1\s*></script>',inline_script,html)
for name in ('core.css','mobile.css'):
 path=BASE/name
 replacement='<style'+(' media="not all"' if name=='mobile.css' else '')+'>'+inline_imports(path)+'</style>'
 original=f'<link rel="stylesheet" href="{name}" />'
 # Native client mobile style has an id attribute; browser screenshot is desktop Core responsive.
 if name=='mobile.css': original=f'<link id="dkdsMobileStyle" rel="stylesheet" href="{name}" media="not all" />';replacement=replacement.replace('<style ', '<style id="dkdsMobileStyle" ',1)
 if original not in html:raise RuntimeError('Pinned Core style anchor changed: '+name)
 html=html.replace(original,replacement)

widths=[(1591,900),(1280,800),(744,600),(390,844)]
report={'schema':'dkts.fspro.core-render-visual-check.v1','method':'actual generated JS/CSS, with an offline-only dynamic loader and about:blank inline document', 'nativeElectron':False,'nativeAndroid':False,'results':[]}
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for width,height in widths:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  page.on('pageerror',lambda err:errors.append(str(err)))
  page.set_content(html,wait_until='domcontentloaded',timeout=55000)
  page.wait_for_timeout(900)
  if width<=900:
   page.locator('[data-dkts-nav-toggle] button').first.click(timeout=11000)
   page.wait_for_timeout(240)
  page.get_by_text('I–V 扫描',exact=True).first.click(timeout=11000)
  page.wait_for_timeout(450)
  result=page.evaluate('''() => {
   const find=(query)=>{const e=document.querySelector(query);if(!e)return null;
    const style=getComputedStyle(e),rect=e.getBoundingClientRect();
    return {visible:style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0,
     display:style.display,width:rect.width,height:rect.height,top:rect.top,text:e.innerText?.slice(0,120)||''}};
   const head=document.querySelector('.dkts-sweep-segment-head');
   return {viewport:innerWidth,nav:find('[data-dkts-nav-toggle]'),
    mobilePort:find('[data-dkts-port-mobile]'),desktopPorts:find('[data-dkts-port-desktop]'),
    terminalStrip:find('[data-dkts-terminal-strip]'),
    scanHeader:find('.dkts-sweep-segment-head'),scanHeaderLabels:head?.innerText||'',
    mobileSegmentLabel:find('.dkts-sweep-segment .dkds-field-label-row'),
    summary:find('.dkts-sweep-metrics'),
    title:find('.dkts-page-heading'),
    screenshotOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
    order:[...document.querySelectorAll('.dkts-sweep-axis,.dkts-terminal-settings')].map(x=>x.querySelector('header')?.innerText||'')};
  }''')
  expectedDesktop=width>980
  assert result['desktopPorts'] and result['desktopPorts']['visible']==expectedDesktop,('desktopPort',width,result)
  assert result['mobilePort'] and result['mobilePort']['visible']==(not expectedDesktop),('mobilePort',width,result)
  assert result['nav'] and result['nav']['visible']==(width<=900),('nav',width,result)
  assert result['terminalStrip'] and result['terminalStrip']['visible'],('terminal',width,result)
  if width<=620:
   assert result['scanHeader'] and not result['scanHeader']['visible'],('mobile header must collapse',width,result)
   assert result['mobileSegmentLabel'] and result['mobileSegmentLabel']['visible'],('mobile field labels missing',width,result)
  else:
   assert result['scanHeader'] and result['scanHeader']['height']>=12,('scan labels too short',width,result)
   assert result['mobileSegmentLabel'] and not result['mobileSegmentLabel']['visible'],('duplicate per-field labels on wide layout',width,result)
  assert '起始' in result['scanHeaderLabels'],('scan labels absent',width,result)
  assert result['summary'] and result['summary']['height']>=15,('summary collapsed',width,result)
  assert [x.split('\n')[0] for x in result['order'][:3]]==['Xsweep','Psweep','端口设置'],('scan order',width,result)
  assert result['screenshotOverflow']<=1,('full viewport horizontal overflow',width,result)
  screenshot=f'Core-Page-Editor-{width}x{height}.png'
  page.screenshot(path=str(OUT/screenshot),full_page=False)
  result['screenshot']=screenshot
  report['results'].append(result)
  print(width,height, 'PASS', {k:result[k] for k in ['scanHeaderLabels','order','screenshotOverflow']})
  page.close()
 browser.close()
(OUT/'VISUAL-REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PASS: actual Core/Plugin browser rendering. NOT OEM pixel parity, Electron, or Android.')
