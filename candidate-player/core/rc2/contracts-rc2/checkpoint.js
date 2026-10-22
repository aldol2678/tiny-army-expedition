// Runtime copies route all their public-state restoration through the same gate.
import {captureGame,restoreGame as originalRestore} from '../spear-skills-rb6/browser.js';
const internal=new WeakMap();
export {captureGame};
export function bindInternalRestores(game,restoreSnapshot,restoreComposite){if(internal.has(game))throw Error('RC2 restore owner already bound');internal.set(game,{restoreSnapshot,restoreComposite});}
export function restoreGame(game,snapshot){return internal.has(game)?internal.get(game).restoreSnapshot(snapshot):originalRestore(game,snapshot);}
export function restoreComposite(game,saved,meta,child){if(!internal.has(game))throw Error('Missing RC2 restore owner');return internal.get(game).restoreComposite(saved,meta,child);}
