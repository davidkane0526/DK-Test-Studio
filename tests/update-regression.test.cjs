'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const packageVersion=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Android workspace bridge saves v2 archives and can still save legacy v1 state',async()=>{
  const js=read('android/web/native-client.js');
  const start=js.indexOf('  const WORKSPACE_CHUNK_BYTES=32768;');
  const end=js.indexOf('  async function loadWorkspace(){',start);
  assert(start>0&&end>start);
  const transfers=[];
  const context={
    TextEncoder, btoa:s=>Buffer.from(s,'latin1').toString('base64'),
    native:async(op,payload)=>{
      transfers.push({op,payload});
      return op==='workspace-begin'?{token:'token'}:{ok:true};
    }
  };
  const save=vm.runInNewContext('(function(){'+js.slice(start,end)+'return saveWorkspace;})()',context);
  const sample={
    schema:'dkts.workspace.v2',activeTabId:null,tabSerial:1,idSerial:1,tabs:[],
    archivedTabs:[{
      id:'workspace-a',name:'归档器件 A',activeMode:'iv',
      historyByMode:{iv:[{id:'run-a',rawRows:[{voltageV:1,currentA:1e-9}]}]},
      dataByMode:{iv:[{voltageV:1,currentA:1e-9}]},
      modeDrafts:{},activeRunByMode:{iv:'run-a'}
    }]
  };
  assert.equal((await save(sample)).ok,true);
  assert(transfers.some(x=>x.op==='workspace-commit'));
  const chunks=transfers.filter(x=>x.op==='workspace-append');
  const restored=JSON.parse(Buffer.concat(chunks.map(x=>
    Buffer.from(x.payload.base64,'base64'))).toString('utf8'));
  assert.deepEqual(restored,sample);
  const legacy={schema:'dkts.workspace.v1',tabs:[]};
  assert.equal((await save(legacy)).ok,true);
  await assert.rejects(()=>save({...sample,archivedTabs:undefined}),/格式/);
});

test('the UI button shows only V package version and hidden a-number hot-update identity',()=>{
  const js=read('web/app.js'),html=read('web/index.html');
  assert(js.includes('const hasHotfix=/^a\\d+$/.test(hotfix);'));
  assert(js.includes("nativeBadge.textContent='V'+nativePackageVersion;"));
  assert(js.includes("$('ui-version-text').textContent=hasHotfix?hotfix:'a0';"));
  assert(js.includes("if(opening)void checkUiUpdateNow();"));
  assert(js.includes('界面热更新已验证，正在刷新；安装包版本保持不变，无需重新安装。'));
  assert(!js.includes('checkNativeAppUpdate'));
  assert(!js.includes('native-app-update-action'));
  assert(!html.includes('native-app-update-state'));
  assert(html.includes('id="ui-version-badge"')&&html.includes('role="status" aria-live="polite" hidden'));
  assert(html.includes('>V'+packageVersion+'</button>'));
});
test('portable replacement failures are preserved as diagnostics and original exe reopens',()=>{
  const updater=read('desktop/native-update.cjs');
  const script=read('desktop/apply-portable-update.ps1');
  assert.match(updater,/last-update-error\.txt/);
  assert.match(updater,/installError:readInstallFailure\(\)/);
  assert.match(updater,/installedVersion:currentVersion/);
  assert.match(script,/last-update-error\.txt/);
  assert.match(script,/Set-Content -LiteralPath \$log/);
  assert.match(script,/Test-Path -LiteralPath \$Target -PathType Leaf/);
  assert.match(script,/Start-Process -FilePath \$Target/);
});
