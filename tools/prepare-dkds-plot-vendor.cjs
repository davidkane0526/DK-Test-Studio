#!/usr/bin/env node
'use strict';
/* Pin the D3 7.9.0 distribution shipped with the DKDS scientific renderer.
 * Vendor generated locally by npm install; never fetched at app runtime. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'node_modules','d3','dist','d3.min.js');
const out=path.join(root,'web','vendor','d3.min.js');
if(!fs.existsSync(source))throw Error('Pinned D3 7.9.0 is missing: run npm install');
const d3=JSON.parse(fs.readFileSync(path.join(root,'node_modules','d3','package.json'),'utf8'));
if(d3.version!=='7.9.0')throw Error('Refusing an unexpected D3 version: '+d3.version);
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.copyFileSync(source,out);
console.log('Bundled pinned DKDS D3 runtime '+d3.version+' ('+fs.statSync(out).size+' bytes)');
module.exports={prepareVendor:()=>out};
