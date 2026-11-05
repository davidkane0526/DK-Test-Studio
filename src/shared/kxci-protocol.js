(() => {
  'use strict';
  const IDN_REQUEST = '*IDN?\0';
  const OPTIONS_REQUEST = '*OPT?\0';
  function getCapabilities() {
    if (typeof window !== 'undefined' && window.DKTSHardwareCapabilities) return window.DKTSHardwareCapabilities;
    if (typeof module !== 'undefined' && typeof require === 'function') return require('./hardware-capabilities.js');
    return null;
  }
  function parseIdentity(input, expectedSerial = '') {
    const raw = String(input || '').replace(/\0+$/g, '').trim();
    const parts = raw.split(',').map(part => part.trim());
    if (parts[0] !== 'KEITHLEY INSTRUMENTS' || parts[1] !== 'KI4200A') throw Error('仪器身份不匹配：' + (raw || '空响应'));
    if (expectedSerial && parts[2] !== String(expectedSerial)) throw Error('序列号不匹配：预期 ' + expectedSerial + '，实际 ' + (parts[2] || '未知'));
    return Object.freeze({ manufacturer: parts[0], model: parts[1], serial: parts[2] || '', version: parts[3] || '', raw });
  }
  function parseSlot(token, index, caps) {
    const raw = String(token || '').trim().toUpperCase();
    if (!raw) return Object.freeze({ slot: index + 1, raw: '', type: 'empty', family: 'empty', channel: null, ratingsVerified: false });
    let type = 'unknown', family = 'unknown', channel = null, cardIndex = null, rpmCount = 0, rpmChannels = [];
    let match;
    if ((match = /^(HPSMUPA|HPSMU|SMUPA|SMU|CVU|VPU|VS|VM)([1-9])$/.exec(raw))) {
      type = match[1]; channel = Number(match[2]);
      family = type.includes('SMU') ? 'SMU' : type === 'CVU' ? 'CVU' : type === 'VPU' ? 'PGU' : type;
    } else if ((match = /^PMU([1-9])RPM(1-2|1|2)$/.exec(raw))) {
      type = 'PMURPM'; cardIndex = Number(match[1]); channel = cardIndex;
      rpmChannels = match[2] === '1-2' ? [1, 2] : [Number(match[2])];
      rpmCount = rpmChannels.length; family = 'PMU';
    } else if ((match = /^PMU([1-9])$/.exec(raw))) {
      type = 'PMU'; cardIndex = Number(match[1]); channel = cardIndex; family = 'PMU';
    } else if (raw === 'PMURPM' || /^PMURPM[1-9]$/.test(raw)) {
      type = 'PMURPM'; cardIndex = Number(raw.slice('PMURPM'.length)) || null; channel = cardIndex; rpmCount = 1; family = 'PMU';
    }
    const capability = caps?.getModuleCapability(type) || null;
    const capabilityStatus = capability?.verificationStatus || 'unknown';
    const ratingsVerified = Boolean(capability && capabilityStatus !== 'role-only');
    return Object.freeze({ slot: index + 1, raw, type, family, channel, cardIndex, rpmCount, rpmChannels, powerClass: capability?.powerClass || 'unknown', preamplifier: Boolean(capability?.preamplifier), ratingsVerified, capabilityStatus });
  }
  function parseOptions(value) {
    const raw = String(value ?? '').replace(/\0+$/g, '').trim();
    if (!raw || raw.length > 4096) throw Error('模块配置响应为空或过长');
    const parts = raw.split(',');
    if (parts.length > 8) throw Error('模块配置超过八个插槽');
    const caps = getCapabilities();
    const slots = Object.freeze(parts.map((part, index) => parseSlot(part, index, caps)));
    const knownModules = slots.filter(item => item.family !== 'empty' && item.family !== 'unknown');
    const unknownModules = slots.filter(item => item.family === 'unknown');
    const unverifiedModules = slots.filter(item => item.capabilityStatus === 'role-only' || item.capabilityStatus === 'unknown' || item.capabilityStatus.includes('variant-dependent'));
    const hardwareLimitsVerified = knownModules.length > 0 && unknownModules.length === 0 && unverifiedModules.length === 0;
    return Object.freeze({
      schema: 'dkts.4200.modules.v2', raw, slots, knownModules, unknownModules, unverifiedModules,
      pmuCards: knownModules.filter(item => item.family === 'PMU').length,
      pguCards: knownModules.filter(item => item.family === 'PGU').length,
      rpmModules: knownModules.filter(item => item.family === 'PMU').reduce((sum, item) => sum + (item.rpmCount || 0), 0),
      hardwareLimitsVerified, capabilityDatabaseVersion: caps?.DATABASE?.databaseVersion || null
    });
  }
  const api = Object.freeze({ IDN_REQUEST, OPTIONS_REQUEST, parseIdentity, parseOptions });
  if (typeof window !== 'undefined' && window.DKDSPluginModules) window.DKDSPluginModules.define('com.dkds.keithley-4200', 'dkts-kxci', api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();