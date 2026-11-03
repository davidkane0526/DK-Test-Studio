'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {bundle}=require('../tools/build-ui-bundle.cjs');
const {validateBundle,createUiUpdater}=require('../src/ui-update.cjs');
const VERSION='123456789abcdef123456789abcdef123456789a';
function prepare(platform){
  const value=JSON.parse(JSON.stringify(bundle));
  value.version=VERSION;return value;
}
test('manifest includes platform-specific entry HTML and identical CSS/JS',()=>{
  const b=prepare();
  assert.deepEqual(Object.keys(b.platforms).sort(),['android','windows']);
  const win=validateBundle(b,'windows'),android=validateBundle(b,'android');
  assert.notDeepEqual(win['index.html'],android['index.html']);
  assert.deepEqual(win['app.js'],android['app.js']);
  assert.deepEqual(win['styles.css'],android['styles.css']);
  assert.match(android['index.html'].toString(),/native-client.js/);
  assert.throws(()=>validateBundle({...b,repository:'unexpected'},'windows'),/Unsupported/);
  const corrupted=prepare();
  corrupted.platforms.windows['app.js'].sha256='0'.repeat(64);
  assert.throws(()=>validateBundle(corrupted,'windows'),/checksum/);
});
test('a GitHub hot-update release swaps the UI files and preserves a working backup',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dkts-ui-'));
  const b=prepare();
  const release={tag_name:'dkts-ui-'+VERSION,target_commitish:VERSION,
    assets:[{name:'DKTS-UI-bundle.json',browser_download_url:
      'https://github.com/davidkane0526/DK-Test-Studio/releases/download/dkts-ui-'+VERSION+'/DKTS-UI-bundle.json'}]};
  const responses=[ [release],b ];
  const fetchImpl=async()=>({ok:true,json:async()=>responses.shift()||[release]});
  const updater=createUiUpdater({cacheDir:root,fetchImpl});
  try{
    assert.equal(updater.state().version,'bundled');
    const updated=await updater.updateOnce();
    assert.equal(updated.updated,true);
    assert.equal(updated.version,VERSION);
    assert.deepEqual(updater.getAsset('styles.css'),Buffer.from(b.platforms.windows['styles.css'].base64,'base64'));
    assert.equal((await updater.updateOnce()).updated,false);
    assert.equal(updater.state().tag,'dkts-ui-'+VERSION);
    const reread=createUiUpdater({cacheDir:root,fetchImpl});
    assert.equal(reread.state().version,VERSION);
    assert.equal(reread.getAsset('../internal.js'),null);
  }finally{updater.stop();fs.rmSync(root,{recursive:true,force:true});}
});

test('update selects the newest published release, not the first API item',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dkts-ui-order-'));
  const newest=prepare();
  const older={tag_name:'dkts-ui-older',target_commitish:'older',
    published_at:'2026-11-03T06:00:00Z',
    assets:[{name:'DKTS-UI-bundle.json',browser_download_url:
      'https://github.com/davidkane0526/DK-Test-Studio/releases/download/dkts-ui-older/DKTS-UI-bundle.json'}]};
  const latest={tag_name:'dkts-ui-'+VERSION,target_commitish:VERSION,
    published_at:'2026-11-03T07:07:23Z',
    assets:[{name:'DKTS-UI-bundle.json',browser_download_url:
      'https://github.com/davidkane0526/DK-Test-Studio/releases/download/dkts-ui-'+VERSION+'/DKTS-UI-bundle.json'}]};
  const requests=[];
  const updater=createUiUpdater({cacheDir:root,fetchImpl:async url=>{
    requests.push(url);
    if(url.includes('/releases?'))return {ok:true,json:async()=>[older,latest]};
    if(url.includes(VERSION))return {ok:true,json:async()=>newest};
    throw Error('Updater requested an obsolete release');
  }});
  try{
    const result=await updater.updateOnce();
    assert.equal(result.updated,true);
    assert.equal(result.version,VERSION);
    assert.equal(requests.length,2);
    assert(requests[1].includes(VERSION));
  }finally{updater.stop();fs.rmSync(root,{recursive:true,force:true});}
});
