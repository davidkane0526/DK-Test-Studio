#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const input=path.join(root,'hardware','4200a-capabilities-safety.json');
const output=path.join(root,'src','shared','4200a-capabilities-data.js');
const db=JSON.parse(fs.readFileSync(input,'utf8'));
if(db.schema!=='dkts.4200a.capability-safety'||db.databaseVersion!=='1.1.0')
  throw Error('Unsupported 4200A capability database schema/version');
const text='(() => {\n  \'use strict\';\n  const database='+JSON.stringify(db,null,2)+';\n  if(typeof window!==\'undefined\')window.DKTS4200ACapabilities=database;\n  if(typeof module!==\'undefined\'&&module.exports)module.exports=database;\n})();\n';
if(process.argv.includes('--check')){
  if(!fs.existsSync(output)||fs.readFileSync(output,'utf8')!==text){
    console.error('4200A runtime capability data is stale. Run npm run generate:capabilities.');
    process.exit(1);
  }
  console.log('4200A capability runtime data matches canonical JSON.');
}else{
  fs.writeFileSync(output,text,'utf8');
  console.log('Generated '+path.relative(root,output)+' from '+path.relative(root,input));
}
