// Exact official identity naming, independent of slot, type and RNG.
const UNIT_NAMES=['나루','보리','하루','여울','다온','마루','이솔','라온','해솔','누리','아라','도담','시온','소담','가온','루리'];
function unitName(u){const id=Math.max(0,Math.floor(Number(u.id)||1)-1),base=UNIT_NAMES[id%UNIT_NAMES.length];let group=Math.floor(id/UNIT_NAMES.length),prefix='';while(group){group--;prefix=String.fromCharCode(0xac00+group%11172)+prefix;group=Math.floor(group/11172)}return prefix+base}
export {unitName as officialUnitName};
