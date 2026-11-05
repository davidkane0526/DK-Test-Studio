#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const input=path.join(root,'hardware','4200a-capabilities-safety.json');
const output=path.join(root,'src','shared','4200a-capabilities-data.js');
function build(){
  const db=JSON.parse(fs.readFileSync(input,'utf8'));
  if(db.schema!=='dkts.4200a.capability-safety'||db.databaseVersion!=='1.2.0')
    throw Error('Unsupported 4200A capability database schema/version');
  return '(() => {\\n  \\'use strict\\';\\n  const database='+JSON.stringify(db,null,2)+';\\n  if(typeof window!==\\'undefined\\')window.DKTS4200ACapabilities=database;\\n  if(typeof module!==\\'undefined\\'&&module.exports)module.exports=database;\\n})();\\n';
}
function generate(){
  const text=build();
  fs.writeFileSync(output,text,'utf8');
  return {output:path.relative(root,output),bytes:Buffer.byteLength(text)};
}
function check(){
  const expected=build();
  if(!fs.existsSync(output)||fs.readFileSync(output,'utf8')!==expected)
    throw Error('4200A runtime capability data is stale. Run npm run generate:capabilities.');
  return {output:path.relative(root,output),status:'in-sync'};
}
if(require.main===module){
  try{
    if(process.argv.includes('--check')){
      const result=check();console.log('4200A capability runtime data matches canonical JSON: '+result.output);
    }else{
      const result=generate();console.log('Generated '+result.output+' ('+result.bytes+' bytes) from canonical JSON.');
    }
  }catch(error){console.error(error.message||error);process.exitCode=1;}
}
module.exports={build,generate,check};
