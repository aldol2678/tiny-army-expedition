// UA2 TEST_ONLY mechanism fixtures; not campaign balance evidence.
import test from 'node:test';import assert from 'node:assert/strict';
import {createUltimateEffects,ULTIMATE_EFFECTS_VERSION} from './effects.js';
test('UA2 kernels expose an explicit separately versioned capability',()=>{assert.equal(typeof createUltimateEffects,'function');assert.match(ULTIMATE_EFFECTS_VERSION,/ua2/);});
