#!/usr/bin/env node
'use strict';
/* Screenshot/interaction regression for the exact static GitHub Pages output. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'../dist/web-ui-demo');
const out=path.resolve(__dirname,'../dist/web-demo-visual');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    res.writeHead(404);res.end('Not found');return;
  }
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
async function open(browser,url,width,height,mobile){
  const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
  const page=await context.newPage(),errors=[],backend=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',request=>{
    if(new URL(request.url()).pathname.startsWith('/api/'))backend.push(request.url());
  });
  await page.goto(url,{waitUntil:'load'});
  await page.waitForFunction(()=>Boolean(window.DKTSClient?.isDemo&&window.DKTSEnhanceNewSelects),null,{timeout:15000});
  assert.equal(await page.locator('#dkts-demo-banner').innerText(),'UI DEMO · OFFLINE');
  assert.equal(await page.locator('.test-type-card').count(),8);
  assert.equal(await page.locator('#start-measurement').isDisabled(),true);
  await page.screenshot({path:path.join(out,mobile?'tablet-home.png':'desktop-home.png'),fullPage:true});
  await page.locator('[data-test-kind="iv"]').click();
  await page.locator('#xsweep-segments .sweep-segment').first().waitFor({state:'visible'});
  assert.equal(await page.locator('#start-measurement').isDisabled(),true);
  assert.equal(await page.locator('#psweep-fields').isHidden(),true);
  await page.locator('#psweep-enabled').check({force:true});
  assert.equal(await page.locator('#psweep-fields').isVisible(),true);
  assert.equal(await page.locator('#measurement-rows tr').count(),1,'No synthetic acquisition rows in demo');
  assert.match(await page.locator('#measurement-rows').innerText(),/暂无该测试方式的实测数据|等待仪器返回原始数据/);
  await page.screenshot({path:path.join(out,mobile?'tablet-scans.png':'desktop-scans.png'),fullPage:true});
  assert.deepEqual(errors,[],'Unhandled browser page errors');
  assert.deepEqual(backend,[],'Offline preview must never request an instrument backend');
  const columns=await page.locator('#detail-columns').boundingBox();
  assert(columns&&columns.width>300,'Scan editor should remain visible');
  await context.close();
  return {mobile,width,height,noBackend:backend.length,errors:errors.length};
}
async function main(){
  const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
  assert(chrome,'Chrome is required for real viewport validation');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
    const url='http://127.0.0.1:'+server.address().port+'/';
    console.log(JSON.stringify(await open(browser,url,1440,900,false)));
    console.log(JSON.stringify(await open(browser,url,744,496,true)));
  }finally{
    await browser?.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});