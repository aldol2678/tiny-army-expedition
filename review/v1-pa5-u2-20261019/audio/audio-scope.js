// Preserve the exact v6 audio implementation while isolating its preference storage.
import {AUDIO_MUTE_KEY} from './audio.js';
export const PRIVATE_AUDIO_MUTE_KEY='tiny-army-private-official-u2-audio-muted-1';
export function privateAudioWindow(window){
 const scoped={getItem(key){if(key!==AUDIO_MUTE_KEY)throw Error('Unexpected audio preference');return window.localStorage?.getItem(PRIVATE_AUDIO_MUTE_KEY)??null;},setItem(key,value){if(key!==AUDIO_MUTE_KEY)throw Error('Unexpected audio preference');window.localStorage?.setItem(PRIVATE_AUDIO_MUTE_KEY,value);}};
 return new Proxy(window,{get(target,key){if(key==='localStorage')return scoped;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
}
