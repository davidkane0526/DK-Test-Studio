#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'../dist/web-ui-demo'),shots=path.resolve(__dirname,'../dist/web-demo-visual');
fs.mkdirSync(shots,{recursive:true});
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
  res.writeHead(404);res.end();return;
 }
 const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
 fs.createReadStream(file).pipe(res);
});
async function inspect(browser,url,width,height,mobile){
 const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
 const page=await context.newPage(),errors=[],api=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
 await page.goto(url,{waitUntil:'load'});
 await page.waitForFunction(()=>window.DKTSFSProDemo?.preview===true,null,{timeout:15000});
 assert.equal(await page.locator('.page-tree').count(),3);
 assert.equal(await page.locator('.routine-heading').count(),1);
 assert.equal(await page.locator('#device-picker option').count(),1);
 assert.equal(await page.locator('.page-tabs [role="tab"]').count(),7);
 assert.equal(await page.locator('#x-segments tr').count(),1);
 assert.equal(await page.locator('#start').isDisabled(),true);
 assert.equal(await page.locator('#p-fields').isHidden(),true);
 assert.match(await page.locator('#plan-summary').innerText(),/21 点/);
 assert.equal(await page.locator('#editor-pane').isVisible(),false,'Project home must not show test parameters');
 assert.equal(await page.locator('#data-pane').isVisible(),true,'Project graph must remain visible');
 assert.equal(await page.evaluate(()=>document.getElementById('data-pane').parentElement.id),'main-pane','Graph must be owned by project workspace');
 if(mobile){
  const geometry=await page.evaluate(()=>({
   graphBottom:document.getElementById('plan-plot').getBoundingClientRect().bottom,
   resultsTop:document.querySelector('.data-bottom').getBoundingClientRect().top
  }));
  assert.ok(geometry.graphBottom<=geometry.resultsTop+2,'Tablet landscape graph should not be covered by result panel: '+JSON.stringify(geometry));
 }
 await page.screenshot({path:path.join(shots,mobile?'tablet-fspro-home.png':'desktop-fspro-home.png'),fullPage:true});
 if(mobile)await page.locator('#nav-toggle').click();
 await page.locator('.page-tree').first().click();
 assert.equal(await page.locator('#editor-pane').isVisible(),true,'Clicking a test Page opens its parameters');
 assert.equal(await page.locator('#data-pane').isVisible(),true,'Graph must not disappear when editor opens');
 await page.locator('#p-enabled').check();
 assert.equal(await page.locator('#p-fields').isVisible(),true);
 assert.match(await page.locator('#plan-summary').innerText(),/Psweep/);
 await page.locator('#x-add').click();
 assert.equal(await page.locator('#x-segments tr').count(),2);
 await page.locator('#port-gate').selectOption('None');
 assert.equal(await page.locator('.terminal-row[data-role="gate"]').count(),0,'None ports must hide');
 assert.match(await page.locator('#plan-summary').innerText(),/未分配|错误/);
 await page.locator('#port-gate').selectOption('SMU2');
 await page.locator('[data-section="target"]').click();
 assert.equal(await page.locator('[data-panel="target"]').isVisible(),true);
 await page.locator('[data-section="sweep"]').click();
 assert.equal(await page.locator('[data-panel="sweep"]').isVisible(),true);
 await page.screenshot({path:path.join(shots,mobile?'tablet-fspro-sweep.png':'desktop-fspro-sweep.png'),fullPage:true});
 await page.locator('#new-routine').click();
 assert.equal(await page.locator('.routine-heading').count(),2);
 assert.equal(await page.locator('.page-tree').count(),4);
 assert.match(await page.locator('#breadcrumb').innerText(),/Routine 2/);
 await page.locator('#new-page').click();
 await page.locator('#choose-grid [data-kind="retention"]').click();
 assert.equal(await page.locator('.page-tree').count(),5);
 const grouped=await page.evaluate(()=>window.DKTSFSProDemo.snapshot());
 assert.equal(grouped.pages[4].routineId,grouped.routines[1].id);
 assert.ok(await page.evaluate(()=>Boolean(localStorage.getItem('dkts.fspro.workbench.v1'))));
 await page.locator('#new-spec').click();
 assert.equal(await page.locator('.spec-tree').count(),1);
 assert.equal(await page.locator('#associate-spec').isChecked(),true);
 const linked=await page.evaluate(()=>window.DKTSFSProDemo.snapshot());
 assert.equal(linked.pages[4].associateSpecId,linked.specs[0].id);
 assert.equal(linked.specs[0].deviceId,linked.devices[0].id);
 await page.locator('#new-device').click();
 assert.equal(await page.locator('#device-picker option').count(),2);
 assert.equal(await page.locator('.routine-heading').count(),1);
 assert.equal(await page.locator('.page-tree').count(),1);
 assert.match(await page.locator('#breadcrumb').innerText(),/Device 2/);
 assert.equal(await page.locator('#associate-spec-picker option').count(),1);
 await page.locator('#new-spec').click();
 const isolated=await page.evaluate(()=>window.DKTSFSProDemo.snapshot());
 assert.equal(isolated.specs[1].deviceId,isolated.devices[1].id);
 assert.equal(isolated.pages.at(-1).associateSpecId,isolated.specs[1].id);
 assert.equal(await page.locator('#associate-spec-picker option').count(),2);
 await page.locator('#device-picker').selectOption(isolated.devices[0].id);
 assert.equal(await page.locator('.routine-heading').count(),2);
 assert.match(await page.locator('#breadcrumb').innerText(),/MOSFET/);
 await page.screenshot({path:path.join(shots,mobile?'tablet-fspro-project.png':'desktop-fspro-project.png'),fullPage:true});
 if(mobile)await page.locator('#nav-toggle').click();
 await page.locator('#project-overview').click();
 assert.equal(await page.locator('#editor-pane').isVisible(),false,'Project overview must hide parameters');
 assert.equal(await page.locator('#data-pane').isVisible(),true,'Project overview must show graph');
 if(mobile){await page.locator('#nav-toggle').click();assert.equal(await page.locator('.shell.nav-open').count(),1);
   await page.screenshot({path:path.join(shots,'tablet-fspro-navigation.png'),fullPage:true});}
 assert.deepEqual(errors,[],'Browser errors '+errors.join(' | '));
 assert.deepEqual(api,[],'Static FS-Pro UI must not call a backend');
 await context.close();
 console.log(JSON.stringify({width,height,mobile,errors:errors.length,backendCalls:api.length}));
}
async function main(){
 const executable=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
 assert.ok(executable,'Chromium missing');
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({executablePath:executable,args:['--no-sandbox','--disable-dev-shm-usage']});
  const url='http://127.0.0.1:'+server.address().port+'/';
  await inspect(browser,url,1440,900,false);
  await inspect(browser,url,744,496,true);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});