'use strict';
const http=require('node:http');
const fs=require('node:fs');
const {StringDecoder}=require('node:string_decoder');
const path=require('node:path');
const {parseWaveformText}=require('./controller/waveform.cjs');
const {normalizePlan,previewPlan,createExecutionCoordinator}=require('./controller/measurement-plan.cjs');
const {createIdentityController,summarizeError}=require('./controller/identity.cjs');
const {createUiUpdater}=require('./ui-update.cjs');
const workspaceStorage=require('./workspace-storage.cjs');

const root=path.resolve(__dirname,'..');
const assets=Object.freeze({
  '/':{file:'web/index.html',mime:'text/html; charset=utf-8'},
  '/app.js':{file:'web/app.js',mime:'application/javascript; charset=utf-8'},
  '/styles.css':{file:'web/styles.css',mime:'text/css; charset=utf-8'},
  ...Object.fromEntries(["d3.min.js","dkds/theme-bridge.js","dkds/style-gate.js","dkds/native-touch-drag.js","dkds/chart-export.js","dkds/display.js","dkds/heatmap-canvas.js","dkds/heatmap-selection.js","dkds/presentation.js","dkds/d3-renderer.js","dkds/chart-runtime.js"].map(name=>[
    '/vendor/'+name,{file:'web/vendor/'+name,mime:'application/javascript; charset=utf-8'}
  ]))
});
function json(res,code,payload){
  const out=JSON.stringify(payload);
  res.writeHead(code,{'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(out);
}
function readJson(req,maxBytes=8388608){
  return new Promise((resolve,reject)=>{
    let size=0,body='',done=false;
    const decoder=new StringDecoder('utf8');
    function fail(e){if(done)return;done=true;reject(e);}
    req.on('data',chunk=>{
      if(done)return;
      size+=chunk.length;
      if(size>maxBytes)return fail(Error('请求内容超过大小限制'));
      body+=decoder.write(chunk);
    });
    req.on('end',()=>{
      if(done)return;
      done=true;
      body+=decoder.end();
      try{
        const value=JSON.parse(body||'{}');
        if(!value||typeof value!=='object'||Array.isArray(value))throw Error('请求应为 JSON 对象');
        resolve(value);
      }catch(e){reject(e);}
    });
    req.on('error',fail);
  });
}
async function createAppServer(options={}){
  const controller=options.controller||createIdentityController();
  // Reserved for the eventual real measurement runner: no output endpoint exists
  // at present. All future task execution must acquire this single lease.
  const execution=options.execution||createExecutionCoordinator();
  const updater=options.uiCacheDir?createUiUpdater({cacheDir:options.uiCacheDir}):null;
  const workspaceFile=options.workspaceFile||workspaceStorage.defaultFile();
  const server=http.createServer(async(req,res)=>{
    try{
      const host=req.headers.host;
      const address=server.address();
      const expected='127.0.0.1:'+address.port;
      // Host validation avoids DNS rebinding of the localhost-only instrument gateway.
      if(host!==expected)return json(res,403,{error:'拒绝非本机请求'});
      const urlPath=new URL(req.url,'http://'+expected).pathname;
      if(req.method==='GET'&&urlPath==='/api/status')
        return json(res,200,{ok:true,...controller.status()});
      if(req.method==='GET'&&urlPath==='/api/ui/version')
        return json(res,200,updater?updater.state():{version:'bundled',status:'disabled'});
      if(req.method==='GET'&&urlPath==='/api/app/version')
        return json(res,200,{version:require('../package.json').version});
      if(req.method==='GET'&&urlPath==='/api/workspaces')
        return json(res,200,{ok:true,workspace:workspaceStorage.readWorkspace(workspaceFile)});
      if(req.method==='GET'&&Object.hasOwn(assets,urlPath)){
        const item=assets[urlPath];
        const bytes=(urlPath.startsWith('/vendor/')?null:updater?.getAsset(path.basename(item.file)))||fs.readFileSync(path.join(root,item.file));
        res.writeHead(200,{'Content-Type':item.mime,'Cache-Control':'no-store',
          'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none';",
          'X-Content-Type-Options':'nosniff'});
        return res.end(bytes);
      }
      if(req.method!=='POST'||!['/api/ui/check','/api/connect','/api/disconnect','/api/plan/validate','/api/waveform/validate','/api/modules/inspect','/api/workspaces'].includes(urlPath))
        return json(res,404,{error:'接口不存在'});
      // No arbitrary command endpoint exists; this only sends the hardcoded KXCI IDN query.
      if(req.headers['x-dkts-request']!=='1'||!String(req.headers['content-type']||'').startsWith('application/json'))
        return json(res,403,{error:'请求来源验证失败'});
      const origin=req.headers.origin;
      if(origin&&origin!=='http://'+expected)return json(res,403,{error:'跨站请求被拒绝'});
      if(urlPath==='/api/ui/check'){
        const result=updater?await updater.updateOnce():{updated:false,status:'disabled'};
        return json(res,200,{ok:true,...result,status:updater?updater.state().status:'disabled'});
      }
      const payload=await readJson(req,urlPath==='/api/workspaces'?workspaceStorage.MAX_BYTES:8388608);
      if(urlPath==='/api/workspaces'){
        const saved=workspaceStorage.writeWorkspace(workspaceFile,payload.workspace);
        return json(res,200,{ok:true,...saved});
      }
      if(urlPath==='/api/disconnect')
        return json(res,200,{ok:true,...await controller.disconnect()});
      if(urlPath==='/api/connect'){
        try{return json(res,200,{ok:true,...await controller.connect(payload)});}
        catch(error){return json(res,200,{ok:false,...controller.status(),summary:summarizeError(error)});}
      }
      if(urlPath==='/api/modules/inspect'){
        try{return json(res,200,{ok:true,...await controller.inspectModules()});}
        catch(error){return json(res,400,{ok:false,error:summarizeError(error),...controller.status()});}
      }
      if(urlPath==='/api/plan/validate'){
        const preview=previewPlan(payload,300,{inventory:controller.status().inventory});
        return json(res,200,{ok:true,plan:preview.plan,firstPoints:preview.firstPoints,truncated:preview.truncated});
      }
      if(typeof payload.text!=='string')return json(res,400,{error:'波形应为文本'});
      const plan=parseWaveformText(payload.text,{sourceType:payload.sourceType||'smu',loadMode:payload.loadMode||'unknown'});
      return json(res,200,{ok:true,count:plan.points.length,durationS:plan.durationS,
        minimumStepS:plan.minimumStepS,maximumStepS:plan.maximumStepS,
        executable:false,hardwareVerified:false,
        preview:plan.points.length<=300?plan.points:plan.points.filter((_,i)=>i%Math.ceil(plan.points.length/300)===0)});
    }catch(error){
      return json(res,400,{ok:false,error:String(error.message||error).slice(0,180)});
    }
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(options.port??0,'127.0.0.1',resolve);
  });
  const address=server.address();
  updater?.start();
  async function close(){
    updater?.stop();
    await controller.dispose();
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
  return {server,port:address.port,url:'http://127.0.0.1:'+address.port+'/',close,controller,execution};
}
if(require.main===module){
  createAppServer({port:Number(process.env.DKTS_PORT||0)}).then(app=>{
    console.log('DK Test Studio local-only GUI: '+app.url);
    const stop=()=>app.close().then(()=>process.exit(0)).catch(()=>process.exit(1));
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
  }).catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={createAppServer};
