'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createAppServer}=require('../src/server.cjs');
test('UI version endpoint is local only and cache is optional',async()=>{
 const app=await createAppServer();
 try{
  const res=await fetch(app.url+'api/ui/version');
  assert.equal(res.status,200);
  const value=await res.json();
  assert.equal(value.version,'bundled');
  assert.equal(value.status,'disabled');
 }finally{await app.close();}
});
