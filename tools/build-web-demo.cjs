#!/usr/bin/env node
'use strict';
/* Publish only DKTS's FS-Pro workbench preview; never revive the retired card UI. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function buildWebDemo(out=path.join(root,'dist','web-ui-demo')){
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 const source=path.join(root,'web','fspro-workbench'),vendor=path.join(root,'web','vendor');
 if(!fs.existsSync(path.join(vendor,'d3.min.js')))
   throw Error('Pinned D3 missing: npm install && node tools/prepare-dkds-plot-vendor.cjs');
 fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
 for(const file of ['index.html','styles.css','app.js','plan.js'])
   fs.copyFileSync(path.join(source,file),path.join(out,file));
 fs.cpSync(vendor,path.join(out,'vendor'),{recursive:true});
 const htmlFile=path.join(out,'index.html');
 const html=fs.readFileSync(htmlFile,'utf8')
   .replace(/(<button id="version"[^>]*>)V\d+\.\d+\.\d+(<\/button>)/,
     '$1V'+pkg.version+'$2');
 if(!html.includes('id="xsweep-card"')||!html.includes('id="routine-list"')||
    !html.includes('data-panel="spec"')||!html.includes('data-panel="target"'))
  throw Error('FS-Pro hierarchy is missing; do not publish legacy card UI');
 if(/test-type-card|src="\/app\.js"|demo-adapter\.js/.test(html))
  throw Error('Legacy UI source detected in FS-Pro Pages artifact');
 fs.writeFileSync(htmlFile,html);
 fs.writeFileSync(path.join(out,'.nojekyll'),'');
 return {out,version:pkg.version};
}
if(require.main===module)console.log('Built FS-Pro hierarchy preview: '+JSON.stringify(buildWebDemo()));
module.exports={buildWebDemo};