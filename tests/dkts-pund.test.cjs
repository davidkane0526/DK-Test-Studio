'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const k=require('../integrations/dkds-native/kxci-measurement.js'),h=require('../integrations/dkds-native/hardware-capabilities.js');
const base={testMode:'pund',terminal:'D',channel:'1',rangeV:'auto',loadOhms:'1000000',amplitudeV:'5',riseUs:'1',widthUs:'10',delayUs:'10',
 preset:'1',loops:'1',mode:'waveform',rateHz:'10000000',currentRangeA:'0.01',areaUm2:''};

test('PUND expands to lead gap, optional preset and four measured read pulses',()=>{
 const s=h.normalizeSegmentArb(base);
 assert.equal(s.rangeV,10);assert.equal(s.segments.length,21);assert.equal(s.points,12);
 assert.equal(s.durationTicksExact,String((10+5*(1+10+1+10))*100));
 const off=h.normalizeSegmentArb({...base,preset:'0'});
 assert.equal(off.segments.length,17);assert.equal(off.segments[1].stopV,5,'P follows the lead gap without a preset');
 assert.equal(h.normalizeSegmentArb({...base,amplitudeV:'20'}).rangeV,40);
 assert.equal(h.normalizeSegmentArb({...base,loops:'3'}).records,36);
});

test('PUND parameters are validated with field names',()=>{
 for(const [key,value] of [['amplitudeV','0'],['riseUs','0'],['widthUs',''],['delayUs','-1'],['preset','2'],['areaUm2','0']])
  assert.throws(()=>h.normalizeSegmentArb({...base,[key]:value}),error=>error.field===key,key);
 // 10 ns time resolution and the 40 V source range still apply.
 assert.throws(()=>h.normalizeSegmentArb({...base,riseUs:'0.015'}),/0\.01 µs/);
 assert.throws(()=>h.normalizeSegmentArb({...base,amplitudeV:'45'}),/输出能力/);
});

test('labelPund refuses uneven captures and ignores timestamp restarts',()=>{
 const row=(i,t)=>({sequence:i+1,timeS:t,pulseCurrentA:1e-3});
 const uneven=k.labelPund([0,1,2,3,4].map(i=>row(i,i*1e-6)),{loops:1});
 assert.equal(uneven.summary.labelled,false);assert.equal(uneven.rows[0].pulsePund,undefined);
 // Timestamps restart in every block: the backwards step contributes nothing.
 const rows=[0,1,2,3,4,5,6,7].map(i=>row(i,(i%2)*1e-6));
 const out=k.labelPund(rows,{loops:1,areaUm2:null});
 assert.equal(out.summary.cycles[0].chargeC.P,1e-9);
 assert.equal(out.summary.cycles[0].switchingChargePositiveC,0);
 assert.equal(out.summary.cycles[0].switchingPolarizationPositiveUcPerCm2,null);
 const two=k.labelPund([...rows,...rows].map((r,i)=>({...r,sequence:i+1})),{loops:2});
 assert.equal(two.summary.cycles.length,2);
 assert.deepEqual(two.rows.map(r=>r.pulsePundIndex),[1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8]);
 assert.equal(two.rows[9].pulsePund,'P');
});
