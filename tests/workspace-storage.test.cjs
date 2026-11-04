'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {
  SCHEMA,MAX_BYTES,readWorkspace,writeWorkspace
}=require('../src/workspace-storage.cjs');
const {createAppServer}=require('../src/server.cjs');

const empty=()=>({
  schema:SCHEMA,activeTabId:null,tabSerial:0,idSerial:0,tabs:[]
});
function temp(){
  return fs.mkdtempSync(path.join(os.tmpdir(),'dkts-workspace-test-'));
}

test('workspace state survives independent host process restarts via atomic file',()=>{
  const dir=temp(),file=path.join(dir,'workspace-state.json');
  try{
    assert.equal(readWorkspace(file),null);
    const snapshot=empty();
    snapshot.tabs.push({
      id:'workspace-test',name:'器件 A',activeMode:'iv',modeDrafts:{iv:{startV:-1}},
      historyByMode:{iv:[{
        id:'run-1',mode:'iv',createdAt:'2026-11-04T00:00:00.000Z',
        rawRows:[{voltageV:0,currentA:1e-9,timeS:0}]
      }]},
      dataByMode:{iv:[{voltageV:0,currentA:1e-9,timeS:0}]},
      activeRunByMode:{iv:'run-1'}
    });
    snapshot.activeTabId='workspace-test';
    assert(writeWorkspace(file,snapshot).bytes>0);
    assert.deepEqual(readWorkspace(file),snapshot);
    assert.equal(fs.readdirSync(dir).filter(n=>n.endsWith('.tmp')).length,0);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('invalid saves do not overwrite an earlier valid snapshot',()=>{
  const dir=temp(),file=path.join(dir,'workspace-state.json');
  try{
    const original=empty();
    writeWorkspace(file,original);
    assert.throws(()=>writeWorkspace(file,{schema:'unknown',tabs:[]}),/格式/);
    assert.deepEqual(readWorkspace(file),original);
    fs.writeFileSync(path.join(dir,'bad.txt'),'not json');
    assert.throws(()=>readWorkspace(path.join(dir,'bad.txt')));
    assert.equal(MAX_BYTES,64*1024*1024);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('local-only API restores and saves a complete workspace without an output endpoint',async()=>{
  const dir=temp(),file=path.join(dir,'workspace-state.json');
  const app=await createAppServer({workspaceFile:file});
  const base=app.url.replace(/\/$/,'');
  try{
    const before=await (await fetch(base+'/api/workspaces')).json();
    assert.equal(before.ok,true);
    assert.equal(before.workspace,null);
    const data=empty();
    data.tabs.push({
      id:'s1',name:'样品-1',activeMode:'it',
      modeDrafts:{it:{fixedV:0.2}},
      historyByMode:{it:[{id:'r1',mode:'it',rawRows:[{timeS:1,currentA:1e-8}]}]},
      dataByMode:{it:[{timeS:1,currentA:1e-8}]},
      activeRunByMode:{it:'r1'}
    });
    data.activeTabId='s1';
    const response=await fetch(base+'/api/workspaces',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-DKTS-Request':'1'},
      body:JSON.stringify({workspace:data})
    });
    assert.equal(response.status,200);
    assert.equal((await response.json()).ok,true);
    assert.deepEqual((await (await fetch(base+'/api/workspaces')).json()).workspace,data);
    assert.deepEqual(readWorkspace(file),data);
    const forbidden=await fetch(base+'/api/output',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-DKTS-Request':'1'},
      body:JSON.stringify({voltageV:10})
    });
    assert.equal(forbidden.status,404);
  }finally{await app.close();fs.rmSync(dir,{recursive:true,force:true});}
});
