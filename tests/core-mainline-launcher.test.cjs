'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pkg=require('../package.json');
const launcher=fs.readFileSync(path.join(root,'tools/launch-core-mainline.cjs'),'utf8');
const coreWorkflow=fs.readFileSync(path.join(root,'.github/workflows/dkts-framework-contract.yml'),'utf8');
const legacyWorkflow=path.join(root,'.github/workflows/fspro-android-stable-sign.yml');
test('main defaults to genuine DKDS Core and does not silently boot legacy shell',()=>{
 assert.equal(pkg.scripts.start,'node tools/launch-core-mainline.cjs');
 assert.match(pkg.scripts['start:legacy'],/electron desktop\/main\.cjs/);
 assert.equal(pkg.scripts['dist:win'],undefined);
 assert.match(pkg.scripts['dist:win:legacy'],/electron-builder/);
 assert.match(launcher,/const \{stage\}=require\('\.\/stage-dkds-host\.cjs'\)/);
 assert.match(launcher,/stage\(source,output\)/);
 assert.match(launcher,/studio\.dk\.test\.corepreview/);
});
test('local Core source is pinned to CI SHA; no upstream DKDS writes or removed sign job',()=>{
 const sha='20f056851a61d2144e9524c3ed568628d4b8557c';
 assert.ok(launcher.includes(sha));
 assert.ok(coreWorkflow.includes(sha));
 assert.match(launcher,/\.dkts-cache/);
 assert.match(fs.readFileSync(path.join(root,'.gitignore'),'utf8'),/\.dkts-cache\//);
 assert.equal(fs.existsSync(legacyWorkflow),false);
});
