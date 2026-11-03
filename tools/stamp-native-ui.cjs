#!/usr/bin/env node
'use strict';
// CI-only embedded UI revision. Hot-update bundles already stamp their own
// revision independently; this makes an offline fresh install equally explicit.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sha=process.env.GITHUB_SHA||process.env.DKTS_UI_VERSION||'';
if(!/^[a-f0-9]{40}$/i.test(sha))throw Error('Expected a 40-character Git commit SHA');
const target=path.join(root,'web/index.html');
const page=fs.readFileSync(target,'utf8');
const token='<meta name="dkts-ui-version" content="bundled">';
if(!page.includes(token))throw Error('UI revision placeholder missing or already stamped');
fs.writeFileSync(target,page.replace(token,
  '<meta name="dkts-ui-version" content="'+sha+'">'));
console.log('Embedded application UI revision: '+sha);
