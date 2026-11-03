'use strict';
// The same state machine runs in Windows/Node and in DK Data Studio, using injected Host TCP.
const domain=require('../shared/identity-core.js');
const protocol=require('../shared/kxci-protocol.js');
const {createTcpRuntime}=require('../transport/tcp-runtime.cjs');
function createIdentityController(opts={}){
  return domain.createIdentityController(opts.tcp||createTcpRuntime(),protocol);
}
module.exports={createIdentityController,normalizeSettings:domain.normalizeSettings,summarizeError:domain.summarizeError};
