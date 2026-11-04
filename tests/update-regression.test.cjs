'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
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

test('native and frontend report separately installed program and UI resource versions',()=>{
  const js=read('web/app.js'),native=read('android/app/src/main/java/studio/dk/test/NativeAppUpdateManager.java');
  assert.match(js,/界面 '\+bundled/);
  assert.match(js,/注意：这不会升级 APK 程序版本/);
  assert.match(js,/安装完成后重新打开软件/);
  assert.match(js,/完整程序更新/);
  assert.match(js,/重新打开安装界面/);
  assert.match(native,/put\("installedVersion",installedVersion\(\)\)/);
  assert.match(native,/if\("installer"\.equals\(state\)\)/);
  assert.match(native,/state="ready";[\s\S]*?尚未完成系统安装/);
  assert.match(native,/state="installer";progress=100/);
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
