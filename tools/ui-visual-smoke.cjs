#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright-core');
const web=path.resolve(__dirname,'../web'),out=path.resolve(__dirname,'../dist/ui-visual');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname.startsWith('/api/')){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,phase:'error',error:'offline'}));return;}
 const file=path.resolve(web,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(web+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'};
 res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
const box=(p,s)=>p.locator(s).first().evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom}});
const sameRow=rs=>Math.max(...rs.map(r=>r.y))-Math.min(...rs.map(r=>r.y))<5;
async function pageFor(browser,url,width,height,android=false){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:android?2:1,isMobile:android,hasTouch:android});
 await context.addInitScript(({android})=>{
  if(android)window.DKTSNative={request(){}};
  window.DKTSClient={
   status:async()=>({phase:'error',summary:'offline UI test'}),
   post:async()=>({ok:false,phase:'error',error:'offline'}),
   loadWorkspace:async()=>({ok:true}),saveWorkspace:async()=>({ok:true}),
   checkUiUpdate:async()=>({status:'current'}),uiUpdateStatus:async()=>({status:'current'})
  };
 },{android});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.message)));
 await page.goto(url,{waitUntil:'load'});
 await page.waitForFunction(()=>typeof window.DKTSEnhanceNewSelects==='function',null,{timeout:15000});
 return {context,page,errors};
}
async function main(){
 const executablePath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
 assert(executablePath,'No Chrome in visual-test runner');
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
  const url='http://127.0.0.1:'+server.address().port+'/';
  const selectors=['label:has(#home-terminal-source) .dkts-select-trigger','label:has(#home-terminal-drain) .dkts-select-trigger','label:has(#home-terminal-gate) .dkts-select-trigger','#terminal-preset-name','label:has(#terminal-preset-select) .dkts-select-trigger','#terminal-preset-save','#terminal-preset-load'];
  const desktop=await pageFor(browser,url,1488,992),d=desktop.page;
  await d.screenshot({path:path.join(out,'desktop-home.png'),fullPage:true});
  const wide=await Promise.all(selectors.map(s=>box(d,s)));
  assert(sameRow(wide),'desktop 7 controls must align '+JSON.stringify(wide));
  assert(wide.every(r=>Math.abs(r.h-36)<3),'desktop control heights '+JSON.stringify(wide));
  const tablet=await pageFor(browser,url,744,496,true),p=tablet.page;
  await p.screenshot({path:path.join(out,'android-tablet-home.png'),fullPage:true});
  const rows=await Promise.all(selectors.map(s=>box(p,s)));
  const title=await box(p,'.port-panel-heading h2'),card=await box(p,'#terminal-profiles');
  assert(sameRow(rows.slice(0,3)),'tablet port controls not aligned '+JSON.stringify(rows));
  assert(sameRow(rows.slice(3)),'tablet preset controls not aligned '+JSON.stringify(rows));
  assert(rows[3].y>rows[0].y+30,'tablet controls not in two rows');
  assert(Math.abs(title.y+title.h/2-(rows[0].y+rows[0].h/2))<30,'heading not inline with ports');
  assert(card.h<165,'home terminal panel too tall '+card.h);
  assert(rows.every(r=>Math.abs(r.h-44)<3),'tablet heights not 44px '+JSON.stringify(rows));
  const cards=await p.locator('.test-type-card').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
  assert(cards.length===8&&cards.every(h=>h<=79),'test cards too tall '+JSON.stringify(cards));
  const trigger=p.locator('label:has(#home-terminal-source) .dkts-select-trigger');
  await trigger.click();await p.locator('.dkts-select-popover').waitFor({state:'visible'});
  const pop=await box(p,'.dkts-select-popover'),tr=await box(p,'label:has(#home-terminal-source) .dkts-select-trigger');
  assert(Math.abs(pop.x-tr.x)<32&&(Math.abs(pop.y-tr.bottom)<25||Math.abs(pop.bottom-tr.y)<25),'dropdown detached '+JSON.stringify({pop,tr}));
  await p.screenshot({path:path.join(out,'android-tablet-dropdown.png'),fullPage:true});
  await p.keyboard.press('Escape');
  await p.locator('[data-test-kind="iv"]').click();
  // Assert the visible I-V workspace, not just the home selection cards.
  const axis=await box(p,'#xsweep-card .sweep-axis-heading');
  const add=await box(p,'#xsweep-add');
  assert(axis.h<85,'Tablet Xsweep row should not wrap: '+JSON.stringify(axis));
  assert(add.y>=axis.y-2&&add.bottom<=axis.bottom+3,
    'Add-segment action must align with other Xsweep fields');
  const portRows=await p.locator('.sweep-terminal-row').evaluateAll(items=>
    items.map(el=>({role:el.dataset.role,assigned:el.dataset.assigned,
      visible:getComputedStyle(el).display!=='none'})));
  assert.equal(portRows.length,3);
  for(const row of portRows)
    assert.equal(row.visible,row.assigned==='true',
      'Only unassigned channels are collapsed: '+JSON.stringify(portRows));
  const settings=await box(p,'#sweep-terminal-settings');
  assert(settings.h<120,'Tablet SMU settings should use one compact line');
  const chart=await box(p,'.data-panel');
  assert(chart.y<900,'Tablet chart should not be buried after redundant controls: '+chart.y);
  await p.screenshot({path:path.join(out,'android-tablet-iv-full.png'),fullPage:true});
  await d.locator('[data-test-kind="iv"]').click();
  await d.screenshot({path:path.join(out,'desktop-iv-full.png'),fullPage:false});
  const desktopColumns=await Promise.all(['#parameters-panel','.data-panel'].map(s=>box(d,s)));
  assert(desktopColumns[0].w>=500&&desktopColumns[1].x>desktopColumns[0].x+desktopColumns[0].w,
    'Desktop configuration panel must be wide enough for complete sweep controls');
  const numeric=p.locator('#sweep-global-loops.dkts-numeric-input');
  await numeric.waitFor({state:'visible'});await numeric.click();
  await p.locator('#dkts-numeric-keypad').waitFor({state:'visible'});
  await p.locator('#dkts-numeric-keypad [data-key="7"]').click();
  assert.equal(await numeric.inputValue(),'7','numeric keypad did not edit field');
  await p.screenshot({path:path.join(out,'android-tablet-keypad.png'),fullPage:false});
  await p.locator('#dkts-numeric-keypad [data-key="done"]').click();
  assert(await p.locator('#dkts-numeric-keypad').isHidden(),'numeric keypad did not close');
  await p.screenshot({path:path.join(out,'android-tablet-workspace.png'),fullPage:false});
  assert(!desktop.errors.length&&!tablet.errors.length,'UI errors '+[...desktop.errors,...tablet.errors].join(','));
  console.log('PASS actual Chromium visual geometry and controls '+JSON.stringify({card,title,rows,dropdown:pop,cards}));
  await desktop.context.close();await tablet.context.close();
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
