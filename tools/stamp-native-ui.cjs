#!/usr/bin/env node
'use strict';
// Stamp both identities into the offline UI embedded in every full package.
// The same a-number is used by the matching hot-update bundle and Releases.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sha=process.env.DKTS_BUILD_SHA||process.env.GITHUB_SHA||'';
const uiVersion=process.env.DKTS_UI_VERSION||'';
if(!/^[a-f0-9]{40}$/i.test(sha))throw Error('Expected a 40-character Git commit SHA');
if(!/^a\d+$/.test(uiVersion))throw Error('Expected an a-number UI hot-update ID');
const target=path.join(root,'web/index.html');
const page=fs.readFileSync(target,'utf8');
const commitToken='<meta name="dkts-ui-version" content="bundled">';
const uiToken='<meta name="dkts-ui-release" content="bundled">';
if(!page.includes(commitToken)||!page.includes(uiToken))
  throw Error('UI revision or hot-update placeholder missing or already stamped');
const packageVersion=require('../package.json').version;
const stamped=page
  .replace(commitToken,'<meta name="dkts-ui-version" content="'+sha+'">')
  .replace(uiToken,'<meta name="dkts-ui-release" content="'+uiVersion+'">');
const buttonStart=stamped.indexOf('<button type="button" id="native-version-badge"');
const buttonEnd=stamped.indexOf('</button>',buttonStart);
const textStart=stamped.indexOf('>',buttonStart)+1;
if(buttonStart<0||buttonEnd<textStart||
  !/^V?\d+\.\d+\.\d+$/.test(stamped.slice(textStart,buttonEnd)))
  throw Error('Missing package-version button');
const finalPage=stamped.slice(0,textStart)+'V'+packageVersion+stamped.slice(buttonEnd);
fs.writeFileSync(target,finalPage);
console.log('Embedded package V'+packageVersion+' / UI '+uiVersion+' / '+sha);
