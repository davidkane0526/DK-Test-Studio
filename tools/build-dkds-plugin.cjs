#!/usr/bin/env node
'use strict';
// Deterministically stage the exact shared core sources into a DKDS API 1.19 plug-in.
// No generated executable instrument commands or duplicate measurement logic.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'dist','dkds-plugin');
const template=path.join(root,'integrations','dkds');
const manifest=JSON.parse(fs.readFileSync(path.join(template,'plugin.json'),'utf8'));
const copy={
  'kxci-protocol.js':'src/shared/kxci-protocol.js',
  'measurement-plan.js':'src/shared/measurement-plan.js',
  'waveform.js':'src/shared/waveform.js',
  'identity-core.js':'src/shared/identity-core.js',
  'interop.js':'src/shared/interop.js',
  'standalone-shell.js':null,
  'presentation.js':'integrations/dkds/presentation.js',
  'plugin.js':'integrations/dkds/plugin.js'
};
// The Android/Windows standalone host keeps its original trusted shared
// module owner. Only the generated DKDS EXTERNAL plugin receives a new owner.
// This is a deterministic change of registration metadata, not domain logic.
const ORIGINAL_OWNER='com.dkds.keithley-4200';
const EXTERNAL_OWNER='com.dkts.keithley-4200';
function adaptPluginSource(name,data){
  if(name==='interop.js'){
    const marker="const PLUGIN_ID='"+ORIGINAL_OWNER+"';";
    if(!data.includes(marker))throw Error('Interop owner marker missing');
    return data.replace(marker,"const PLUGIN_ID='"+EXTERNAL_OWNER+"';");
  }
  if(['kxci-protocol.js','measurement-plan.js','waveform.js','identity-core.js'].includes(name)){
    const marker="'"+ORIGINAL_OWNER+"'";
    if(!data.includes(marker))throw Error('Shared module registration owner missing: '+name);
    return data.replace(marker,"'"+EXTERNAL_OWNER+"'");
  }
  return data;
}
// Generate the exact standalone workbench into the plugin from its owning
// index.html, styles.css and app.js, rather than maintaining a cloned UI.
function createSharedShellSource(){
  require('./prepare-dkds-plot-vendor.cjs');
  const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'web/styles.css'),'utf8');
  const frameBridge=fs.readFileSync(path.join(template,'frame-bridge.js'),'utf8');
  const sources=[...html.matchAll(/<script\s+src="([^"]+)"\s+defer><\/script>/g)]
    .map(match=>match[1]);
  if(!sources.includes('/app.js')||!sources.includes('/vendor/d3.min.js'))
    throw Error('Standalone script contract changed: cannot generate DKDS frame');
  if(sources[sources.length-1]!=='/app.js')throw Error('App script must load last');
  const scripts=sources.map(file=>{
    if(!file.startsWith('/vendor/')&&file!=='/app.js')throw Error('Unexpected standalone script: '+file);
    const source=fs.readFileSync(path.join(root,'web',file.slice(1)),'utf8');
    return {file,source};
  });
  const literal=value=>JSON.stringify(value);
  return [
    '(() => {',
    "  'use strict';",
    '  const originalHtml='+literal(html)+';',
    '  const styles='+literal(css)+';',
    '  const frameBridge='+literal(frameBridge)+';',
    '  const sources='+literal(scripts)+';',
    '  function safeScript(code){',
    '    return "<script>"+String(code).replace(/<\\\\/script/gi,"<\\\\\\\\/script")+"</script>";',
    '  }',
    '  function createDocument(token,mobile){',
    '    if(!/^[a-z0-9_-]{16,96}$/i.test(token))throw Error("Invalid DKTS frame token");',
    '    let markup=originalHtml.replace(/<link rel="stylesheet" href="\\\\/styles\\\\.css">/,',
    '      "<style>"+styles.replace(/<\\\\/style/gi,"<\\\\\\\\/style")+"</style>");',
    '    markup=markup.replace(/<script\\\\s+src="[^"]+"\\\\s+defer><\\\\/script>/g,"");',
    '    const shim=frameBridge.replace("__DKTS_FRAME_TOKEN__",JSON.stringify(token))',
    '      .replace("__DKTS_FRAME_MOBILE__",mobile?"true":"false");',
    '    const all=[safeScript(shim),...sources.map(row=>safeScript(row.source))].join("\\\\n");',
    '    return markup.replace("</body>",all+"\\\\n</body>");',
    '  }',
    "  window.DKDSPluginModules.define('com.dkts.keithley-4200','standalone-shell',Object.freeze({createDocument}));",
    '})();',''
  ].join('\n');
}
const requireFiles=new Set(manifest.scripts);
if(manifest.apiVersion!=='1.19.0'||manifest.id!=='com.dkts.keithley-4200'||manifest.version!=='0.6.0')
  throw Error('Unexpected standalone DK Test Studio plugin identity / API / version');
if(requireFiles.size!==Object.keys(copy).length||Object.keys(copy).some(x=>!requireFiles.has(x)))
  throw Error('Plugin manifest scripts must exactly match staging files');
fs.mkdirSync(folder,{recursive:true});
const files={};
for(const [name,src] of Object.entries(copy)){
  const data=src===null?createSharedShellSource():adaptPluginSource(name,fs.readFileSync(path.join(root,src),'utf8'));
  fs.writeFileSync(path.join(folder,name),data,'utf8');files[name]=data;
}
fs.writeFileSync(path.join(folder,'plugin.json'),JSON.stringify(manifest,null,2)+'\n');
const pkg={schema:1,manifest,files};
const artifact=path.join(root,'dist',manifest.id+'-'+manifest.version+'.dkplugin');
fs.writeFileSync(artifact,JSON.stringify(pkg,null,2)+'\n','utf8');
console.log('Staged '+folder);
console.log('DKDS Plugin API 1.19 package candidate '+artifact);
console.log('For production, validate against DK Data Studio SDK before installation.');
module.exports={folder,artifact,manifest,adaptPluginSource};

