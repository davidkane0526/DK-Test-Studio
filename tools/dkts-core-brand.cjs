#!/usr/bin/env node
'use strict';
// Applied in the DKTS-derived DKDS Core directory. No writes to DKDS upstream.
const fs=require('node:fs'),path=require('node:path');
function applyBrand(dir){
 const root=path.resolve(dir);
 const {png,icon}=require('./dkts-icon-generator.cjs');
 const sizes=[16,24,32,48,64,128,256];
 const ico=icon(sizes.map(size=>({size,bytes:png(size)})));
 const main=png(256),mobile=png(512);
 const outputs=[
  ['assets/dkds-icon.png',main],
  ['assets/dkds-icon.ico',ico],
  ['mobile/assets/icon.png',mobile],
  ['mobile/assets/adaptive-icon.png',mobile]
 ];
 for(const [relative,data] of outputs){
  const full=path.join(root,relative);
  fs.mkdirSync(path.dirname(full),{recursive:true});
  fs.writeFileSync(full,data);
 }
 return outputs.map(([relative])=>relative);
}
if(require.main===module){
 if(!process.argv[2])throw Error('Usage: node dkts-core-brand.cjs <derived-DKTS-host>');
 console.log('Applied DKTS original icons to staged Core:',applyBrand(process.argv[2]));
}
module.exports={applyBrand};
