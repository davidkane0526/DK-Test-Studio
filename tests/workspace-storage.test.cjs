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


test('HTTP snapshot parser preserves Chinese text split across UTF-8 chunks',async()=>{
  const http=require('node:http');
  const dir=temp(),file=path.join(dir,'workspace-state.json');
  const app=await createAppServer({workspaceFile:file});
  try{
    const state=empty();
    state.tabs.push({
      id:'中文标签',name:'器件甲的测试历史',activeMode:'iv',
      modeDrafts:{},historyByMode:{},dataByMode:{},activeRunByMode:{}
    });
    const body=Buffer.from(JSON.stringify({workspace:state}),'utf8');
    const marker=Buffer.from('器件甲','utf8');
    const first=body.indexOf(marker)+1;
    assert(first>0);
    const reply=await new Promise((resolve,reject)=>{
      const request=http.request(new URL('/api/workspaces',app.url),{
        method:'POST',headers:{
          'Content-Type':'application/json','X-DKTS-Request':'1'
        }
      },response=>{
        let data='';response.on('data',part=>{data+=part.toString('utf8');});
        response.on('end',()=>resolve({status:response.statusCode,body:JSON.parse(data)}));
      });
      request.on('error',reject);
      request.write(body.subarray(0,first));
      setTimeout(()=>request.end(body.subarray(first)),20);
    });
    assert.equal(reply.status,200);
    assert.equal(reply.body.ok,true);
    assert.equal(readWorkspace(file).tabs[0].name,'器件甲的测试历史');
  }finally{await app.close();fs.rmSync(dir,{recursive:true,force:true});}
});
