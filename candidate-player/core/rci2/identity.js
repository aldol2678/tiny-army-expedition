import {RCI1_ENGINE_HASHES,RCI1_ENGINE_KEY} from '../rci1/identity.js';
export const RCI2_PROFILE='v10-private-relic-runtime-rci2-20261020-1';
export const RCI2_INTEGRATION_VERSION='rci2-owned-checkpoint-head-runtime-1';
// The exact pinned HB engine stays shared; the integration has a distinct receipt identity.
export const RCI2_ENGINE_KEY=RCI1_ENGINE_KEY;
export const RCI2_ENGINE_HASHES=Object.freeze({...RCI1_ENGINE_HASHES,'rci2-spear-browser.js':'5e302a1d85e9a9208538ace8e8f50022f92fa92bb61e88d12c3c2368395e7653','rci2-contracts.js':'bc9f9f7291f8ced00c76e8843231cfee39e35d53dfb80aa396326348947d8801','rci2-integration.js':'b75270b5b394b70da5387998b5f6f958051c2ad75a73ddf916d3e0cd6ebc4081'});
