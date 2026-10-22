import {bridge,createPinnedContext} from '../profile-bridge/index.js';
import {installLegacyProfileSupport} from './start.js';
const context=createPinnedContext();
installLegacyProfileSupport({bridge,content:context.TinyArmyV09Content});
