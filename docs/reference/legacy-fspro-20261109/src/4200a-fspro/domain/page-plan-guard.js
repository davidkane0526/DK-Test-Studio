/* FS-Pro/LabExpress Page semantic guard — OFFLINE ONLY.
 * The input shape is based on user-supplied V5 examples, V6 UI contract.
 * No 4200A commands, compliance ceilings or source output are authorized here.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DK4200PagePlanGuard = api;
})(typeof globalThis !== 'undefined' ? globalThis : undefined, function () {
  'use strict';
  const ROLE = new Set(['X','P','CONDITION']);
  const MODE = new Set(['voltage','current']);
  const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/;
  // Maximum theoretical envelope across supported 4200A SMUs. This is NOT
  // an assertion of the installed model or a software-specific derating.
  // Actual SMU capabilities and KCon mapping still gate native execution.
  const HARDWARE_ENVELOPE = Object.freeze({voltage:210,current:1.05,
    fullCurrentVoltage:21,highVoltageCurrent:0.105});
  // These bounds are the UNION across supported SMUs. Exact-model checks
  // in the KXCI compiler further limit medium-power cards to 10.5 mA above
  // 21 V. Do not treat the largest voltage and current as simultaneous.
  function checkTheoryCombination(add,path,sourceMode,value,compliance){
    if(!isFiniteDecimal(value)||!isPositiveDecimal(compliance))return;
    const v=Math.abs(Number(value)),c=Number(compliance);
    if(sourceMode==='voltage'&&v>HARDWARE_ENVELOPE.fullCurrentVoltage&&
       c>HARDWARE_ENVELOPE.highVoltageCurrent)
      add('HARDWARE_THEORY_RANGE_COMBINATION',path,
       'Above 21 V the 4200A high-power SMU current limit cannot exceed 0.105 A');
    if(sourceMode==='current'&&v>HARDWARE_ENVELOPE.highVoltageCurrent&&
       c>HARDWARE_ENVELOPE.fullCurrentVoltage)
      add('HARDWARE_THEORY_RANGE_COMBINATION',path,
       'Above 0.105 A the 4200A high-power SMU voltage limit cannot exceed 21 V');
  }
  const isFiniteDecimal = value => {
    if (value === null || value === undefined || typeof value === 'boolean') return false;
    const s = String(value).trim();
    return NUMBER.test(s) && Number.isFinite(Number(s));
  };
  const isPositiveDecimal = value => isFiniteDecimal(value) && Number(value) > 0;
  const id = value => String(value == null ? '' : value).trim();
  const canonical = value => id(value).toLowerCase();
  function verifySequence(label, sequence, errors) {
    if (!sequence || typeof sequence !== 'object' || Array.isArray(sequence)) {
      errors.push({ code:'MISSING_SEQUENCE', path:label, reason:label+' is required' });
      return;
    }
    const mode = id(sequence.mode);
    const fields = {
      linear_step:['start','stop','step'],
      linear_points:['start','stop','points'],
      log_points:['start','stop','points'],
      list:['values'],
      multi_segment:['segments']
    };
    if (!Object.prototype.hasOwnProperty.call(fields, mode)) {
      errors.push({ code:'UNSUPPORTED_SEQUENCE', path:label+'.mode', reason:'Unsupported sequence mode' });
      return;
    }
    for (const field of fields[mode]) {
      const v = sequence[field];
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) {
        errors.push({ code:'MISSING_SEQUENCE_FIELD', path:label+'.'+field, reason:'Required for '+mode });
      }
    }
    if (mode === 'linear_step' && sequence.step != null && (!isFiniteDecimal(sequence.step) || Number(sequence.step) === 0)) {
      errors.push({ code:'INVALID_STEP', path:label+'.step', reason:'Step must be finite and nonzero' });
    }
    if ((mode === 'linear_points' || mode === 'log_points') && sequence.points != null &&
        (!Number.isSafeInteger(Number(sequence.points)) || Number(sequence.points) < 1)) {
      errors.push({ code:'INVALID_POINTS', path:label+'.points', reason:'Points must be a positive integer' });
    }
    if (mode === 'list' && sequence.values != null && (!Array.isArray(sequence.values) || !sequence.values.every(isFiniteDecimal))) {
      errors.push({ code:'INVALID_LIST', path:label+'.values', reason:'List must contain finite numeric points' });
    }
  }
  function validatePagePlan(plan) {
    const errors=[], warnings=[];
    const add = (code,path,reason) => errors.push({code,path,reason});
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
      add('INVALID_PLAN','$','Page must be an object');
      return Object.freeze({valid:false,executionAuthorized:false,errors,warnings});
    }
    const terms = plan.terminals;
    if (!Array.isArray(terms) || terms.length < 2) {
      add('INVALID_TERMINALS','terminals','Two or more terminals are required');
      return Object.freeze({valid:false,executionAuthorized:false,errors,warnings});
    }
    const labels = new Map(), resources = new Map(), refs = new Map();
    let x=0,p=0;
    for (let i=0;i<terms.length;i++) {
      const t=terms[i], path='terminals['+i+']';
      if (!t || typeof t!=='object' || Array.isArray(t)) { add('INVALID_TERMINAL',path,'Terminal must be an object'); continue; }
      const key=canonical(t.logical), resource=canonical(t.resource), role=id(t.role).toUpperCase();
      if (!key) add('MISSING_TERMINAL',path+'.logical','Terminal name is required');
      else if (labels.has(key)) add('DUPLICATE_TERMINAL',path+'.logical','Terminal names must be unique');
      else labels.set(key,i);
      if (!ROLE.has(role)) add('INVALID_ROLE',path+'.role','Role must be X, P or CONDITION');
      if (role==='X') x++;
      if (role==='P') p++;
      if (!MODE.has(id(t.sourceMode).toLowerCase())) add('INVALID_SOURCE_MODE',path+'.sourceMode','Expected voltage or current');
      if (!isPositiveDecimal(t.compliance)) add('INVALID_COMPLIANCE',path+'.compliance','Positive finite compliance is required');
      const sourceMode=id(t.sourceMode).toLowerCase();
      const sourcedLimit=HARDWARE_ENVELOPE[sourceMode];
      const measuredMode=sourceMode==='voltage'?'current':'voltage';
      checkTheoryCombination(add,path+'.bias',sourceMode,t.bias,t.compliance);
      if (sourcedLimit && isFiniteDecimal(t.bias) &&
          Math.abs(Number(t.bias))>sourcedLimit)
        add('HARDWARE_THEORY_LIMIT',path+'.bias','Source exceeds the 4200A theoretical ±'+sourcedLimit+' '+(sourceMode==='voltage'?'V':'A'));
      if (sourcedLimit && isPositiveDecimal(t.compliance) &&
          Number(t.compliance)>HARDWARE_ENVELOPE[measuredMode])
        add('HARDWARE_THEORY_LIMIT',path+'.compliance','Compliance exceeds theoretical '+HARDWARE_ENVELOPE[measuredMode]+' '+(measuredMode==='current'?'A':'V'));
      if (!resource || resource==='none') warnings.push({code:'UNASSIGNED_RESOURCE',path:path+'.resource',reason:'No physical channel is assigned'});
      else if (resources.has(resource)) add('DUPLICATE_RESOURCE',path+'.resource','One physical channel cannot drive two terminals');
      else resources.set(resource,i);
      const ref=canonical(t.relativeTo);
      if (ref && ref!=='gnd' && ref!=='ground' && ref!=='0') refs.set(key,ref);
      const range=t.measureRange;
      if (range) {
        if (!['auto','fixed','minimum'].includes(id(range.mode))) add('INVALID_MEASURE_RANGE_MODE',path+'.measureRange.mode','Use auto, fixed or minimum');
        if (range.mode==='minimum' && sourceMode!=='voltage')
          add('MINIMUM_CURRENT_RANGE_ONLY',path+'.measureRange.mode','KXCI RG configures the current autorange floor only');
        if (range.mode!=='auto' && !isPositiveDecimal(range.value))
          add('INVALID_MEASURE_RANGE',path+'.measureRange.value','Selected range must be positive and finite');
        if (range.mode!=='auto' && isPositiveDecimal(range.value) &&
            sourcedLimit && Number(range.value)>HARDWARE_ENVELOPE[measuredMode])
          add('HARDWARE_THEORY_LIMIT',path+'.measureRange.value','Range exceeds theoretical '+HARDWARE_ENVELOPE[measuredMode]+' '+(measuredMode==='current'?'A':'V'));
      }
      if (role==='CONDITION' && t.bias===undefined && t.expression===undefined) add('MISSING_CONDITION',path+'.bias','Condition must define a bias or expression');
    }
    if (x!==1) add('X_ROLE_COUNT','terminals','Exactly one Xsweep is required');
    if (p>1) add('P_ROLE_COUNT','terminals','At most one Psweep is allowed');
    verifySequence('xSweep',plan.xSweep,errors);
    if (p===1) verifySequence('pSweep',plan.pSweep,errors);
    else if (plan.pSweep !== undefined) add('UNUSED_P_SWEEP','pSweep','Psweep sequence requires one P terminal');
    // Check both axes before saving the Page, even with no 4200A connected.
    // Values within the maximum hardware envelope remain editable; a
    // verified physical-module model applies stricter limits at compilation.
    for(const [key,role] of [['xSweep','X'],['pSweep','P']]){
      const t=terms.find(term=>term?.role===role);
      const seq=plan[key];
      if(!t||!seq||typeof seq!=='object')continue;
      const mode=id(t.sourceMode).toLowerCase(),max=HARDWARE_ENVELOPE[mode];
      if(!max)continue;
      const list=seq.mode==='list'?(Array.isArray(seq.values)?seq.values:[]):[seq.start,seq.stop,seq.step];
      for(const [i,value] of list.entries()){
        checkTheoryCombination(add,key+'.source-range',mode,value,t.compliance);
        if(!isFiniteDecimal(value))continue; // formula parsing is a separate gate
        if(Math.abs(Number(value))>max)
          add('HARDWARE_THEORY_LIMIT',key+'.'+(seq.mode==='list'?'values['+i+']':['start','stop','step'][i]),
            'Sweep exceeds the 4200A theoretical ±'+max+' '+(mode==='voltage'?'V':'A'));
      }
    }
    for (const [name,ref] of refs) {
      if (!labels.has(ref)) add('UNKNOWN_REFERENCE','terminals['+labels.get(name)+'].relativeTo','Reference node does not exist');
      if (name===ref) add('SELF_REFERENCE','terminals['+labels.get(name)+'].relativeTo','Self reference is forbidden');
    }
    for (const start of labels.keys()) {
      const visited=new Set();let key=start;
      while (refs.has(key)) {
        if (visited.has(key)) { add('REFERENCE_CYCLE','terminals['+labels.get(start)+'].relativeTo','Circular relative-bias reference');break; }
        visited.add(key);key=refs.get(key);
      }
    }
    warnings.push({code:'HARDWARE_GATE',path:'$',reason:'Offline validation is not instrument capability validation'});
    return Object.freeze({valid:errors.length===0,executionAuthorized:false,errors:Object.freeze(errors),warnings:Object.freeze(warnings)});
  }
  return Object.freeze({validatePagePlan,HARDWARE_ENVELOPE,version:'0.2.0-offline'});
});
