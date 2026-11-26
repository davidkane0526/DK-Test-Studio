'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),k=require('../integrations/dkds-native/kxci-measurement.js');
test('TV measured values use distinct trigger IDs',()=>{assert.equal(k.voltageTrigger(5),7);assert.equal(k.parseTv('NAV+1.2345E-01',1).voltageV,.12345);assert.throws(()=>k.parseTv('NAI+1.0000E-09',1));assert.throws(()=>k.parseTv('NBV+1.0000E+00',1));});
