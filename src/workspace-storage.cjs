'use strict';
// Atomic host-owned persistence for independent Windows/Node workspaces.
// Only instrument-returned raw measurements, drafts and workspace metadata belong here.
// Connection credentials and UI update assets are not stored.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const SCHEMA='dkts.workspace.v1';
const MAX_BYTES=64*1024*1024;
const defaultFile=()=>path.join(os.homedir(),'.dk-test-studio','workspace-state.json');

function checkWorkspace(workspace){
  if(!workspace||typeof workspace!=='object'||Array.isArray(workspace)||
     workspace.schema!==SCHEMA||!Array.isArray(workspace.tabs))
    throw Error('工作区数据格式无效');
  return workspace;
}
function readWorkspace(file=defaultFile()){
  try{
    const json=fs.readFileSync(file,'utf8');
    if(Buffer.byteLength(json,'utf8')>MAX_BYTES)throw Error('工作区文件超过大小限制');
    return checkWorkspace(JSON.parse(json));
  }catch(error){
    if(error.code==='ENOENT')return null;
    throw error;
  }
}
function writeWorkspace(file=defaultFile(),workspace){
  checkWorkspace(workspace);
  const bytes=Buffer.from(JSON.stringify(workspace),'utf8');
  if(bytes.length>MAX_BYTES)throw Error('工作区保存超过 64 MiB 限制');
  const directory=path.dirname(file);
  fs.mkdirSync(directory,{recursive:true});
  const tmp=file+'.'+process.pid+'.'+Date.now()+'.tmp';
  try{
    fs.writeFileSync(tmp,bytes,{mode:0o600,flag:'wx'});
    // The final destination is always replaced in a single rename on the same volume.
    fs.renameSync(tmp,file);
  }catch(error){
    try{fs.unlinkSync(tmp);}catch{}
    throw error;
  }
  return {bytes:bytes.length};
}
module.exports={SCHEMA,MAX_BYTES,defaultFile,checkWorkspace,readWorkspace,writeWorkspace};
