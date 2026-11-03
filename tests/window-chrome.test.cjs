'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const main=fs.readFileSync(path.join(root,'desktop/main.cjs'),'utf8');
const preload=fs.readFileSync(path.join(root,'desktop/preload.cjs'),'utf8');
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const client=fs.readFileSync(path.join(root,'web/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'web/styles.css'),'utf8');
test('frameless desktop window with bottom dragging and explicit controls',()=>{
  assert.match(main,/frame:false,resizable:true/);
  assert.match(main,/preload:path\.join\(__dirname,'preload\.cjs'\)/);
  assert.match(main,/ipcMain\.handle\('dkts:window-control'/);
  assert.match(main,/event\.senderFrame!==win\.webContents\.mainFrame/);
  assert.match(main,/case 'minimize'/);
  assert.match(main,/case 'toggleMaximize'/);
  assert.match(main,/case 'close'/);
  assert.match(preload,/contextBridge\.exposeInMainWorld\('DKTSWindow'/);
  assert.doesNotMatch(preload,/exposeInMainWorld\([^\n]*ipcRenderer\)/);
  for(const name of ['window-minimize','window-maximize','window-close'])
    assert(html.includes('id="'+name+'"'));
  assert.match(html,/id="window-actions" class="window-actions"[^>]* hidden/);
  assert.match(css,/\.app-statusbar\{position:fixed;bottom:0/);
  assert.match(css,/app-region:drag/);
  assert.match(css,/app-region:no-drag/);
});
test('message bar is shared by desktop, browser and Android with a session log',()=>{
  assert.match(html,/id="status-message-text" role="status" aria-live="polite"/);
  assert.match(html,/id="ui-version-badge"/);
  assert.match(html,/id="connection-status"/);
  assert.match(html,/id="status-log-dialog"/);
  assert.match(client,/function showStatusMessage\(/);
  assert.match(client,/if\(!host\)return; \/\/ Browser and Android/);
  assert.match(client,/messages\.length>30/);
  assert.doesNotMatch(html,/<header class="topbar">/);
});
