/* Tiny Army v0.5 original relic/equipment SVGs. Offline; no game state changes. */
(function(global){'use strict';
const palette=Object.freeze({"ink":"#203548","navy":"#284456","teal":"#318d8c","tealLight":"#83bcb0","cream":"#fff0cb","pale":"#fff9e7","gold":"#e4b563","coral":"#c77961","wood":"#a37c52","steel":"#b8d5d5","steelDark":"#798c8d"});
const raw=Object.freeze({
  "relic-marching-banner": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"64\" height=\"64\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19 13C30 10 40 17 53 13L48 24L52 35C40 39 30 30 19 35Z\" fill=\"#318d8c\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M23 15V32\" fill=\"none\" stroke=\"#e4b563\" stroke-width=\"3\"/><path d=\"M19 35L25 36L25 43L21 40L18 43Z\" fill=\"#c77961\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M17 11V56\" fill=\"none\" stroke=\"#203548\" stroke-width=\"5\"/><path d=\"M17 12V54\" fill=\"none\" stroke=\"#a37c52\" stroke-width=\"2\"/><path d=\"M17 5L21 10L17 14L13 10Z\" fill=\"#e4b563\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M31 21L36 18L41 21V27L36 30L31 27Z\" fill=\"#fff0cb\" stroke=\"#203548\" stroke-width=\"1.7\"/><path d=\"M34 25L36 22L38 25\" fill=\"none\" stroke=\"#318d8c\" stroke-width=\"2\"/><path d=\"M11 57H23\" fill=\"none\" stroke=\"#203548\" stroke-width=\"3\"/></svg>",
  "relic-battle-drum": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"64\" height=\"64\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19 12L44 26M45 10L22 26\" fill=\"none\" stroke=\"#203548\" stroke-width=\"5\"/><path d=\"M19 12L44 26M45 10L22 26\" fill=\"none\" stroke=\"#a37c52\" stroke-width=\"2.5\"/><circle cx=\"17\" cy=\"11\" r=\"3.5\" fill=\"#e4b563\" stroke=\"#203548\" stroke-width=\"2.4\"/><circle cx=\"47\" cy=\"9\" r=\"3.5\" fill=\"#e4b563\" stroke=\"#203548\" stroke-width=\"2.4\"/><path d=\"M11 29V48C16 59 48 59 53 48V29Z\" fill=\"#c77961\" stroke=\"#203548\" stroke-width=\"2.6\"/><ellipse cx=\"32\" cy=\"48\" rx=\"21\" ry=\"8\" fill=\"#e4b563\" stroke=\"#203548\" stroke-width=\"2.4\"/><path d=\"M11 29V47C21 53 43 53 53 47V29Z\" fill=\"#c77961\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M13 31L19 49L26 34L32 51L39 34L46 49L51 31\" fill=\"none\" stroke=\"#fff0cb\" stroke-width=\"2.5\"/><ellipse cx=\"32\" cy=\"28\" rx=\"22\" ry=\"8\" fill=\"#e4b563\" stroke=\"#203548\" stroke-width=\"2.4\"/><ellipse cx=\"32\" cy=\"27\" rx=\"17\" ry=\"4.5\" fill=\"#fff0cb\" stroke=\"#203548\" stroke-width=\"1.8\"/><path d=\"M28 27H36\" fill=\"none\" stroke=\"#318d8c\" stroke-width=\"2.5\"/></svg>",
  "relic-ironwall-seal": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"64\" height=\"64\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19 39L16 57L25 53L29 59L33 42Z\" fill=\"#c77961\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M32 41L36 58L41 52L49 55L44 38Z\" fill=\"#c77961\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M23 7H41L54 20V38L41 51H23L10 38V20Z\" fill=\"#e4b563\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M25 12H39L49 22V36L39 46H25L15 36V22Z\" fill=\"#318d8c\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M22 37V23H27V18H32V23H37V18H42V37Z\" fill=\"#fff0cb\" stroke=\"#203548\" stroke-width=\"2.2\"/><path d=\"M28 37V30H36V37\" fill=\"#798c8d\" stroke=\"#203548\" stroke-width=\"2.2\"/><path d=\"M20 40H44\" fill=\"none\" stroke=\"#e4b563\" stroke-width=\"2.6\"/><circle cx=\"18\" cy=\"29\" r=\"1.4\" fill=\"#e4b563\" stroke=\"none\" stroke-width=\"2.4\"/><circle cx=\"46\" cy=\"29\" r=\"1.4\" fill=\"#e4b563\" stroke=\"none\" stroke-width=\"2.4\"/></svg>",
  "relic-keen-spear-tip": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"64\" height=\"64\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 49L28 36L33 41L20 54Z\" fill=\"#a37c52\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M24 39L20 31L33 26L51 7L48 31L34 43Z\" fill=\"#b8d5d5\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M51 7L32 34L24 39L33 26Z\" fill=\"#fff0cb\" stroke=\"none\" stroke-width=\"2.6\"/><path d=\"M51 7L32 34L34 43\" fill=\"none\" stroke=\"#203548\" stroke-width=\"2.2\"/><path d=\"M21 37L29 45L24 50L16 42Z\" fill=\"#e4b563\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M21 41L26 46\" fill=\"none\" stroke=\"#fff0cb\" stroke-width=\"2\"/><path d=\"M24 46L34 46L32 55L28 52L22 57L19 51Z\" fill=\"#c77961\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M10 30L13 25M8 36L12 35\" fill=\"none\" stroke=\"#e4b563\" stroke-width=\"2.5\"/></svg>",
  "relic-swarmhunter-quiver": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"64\" height=\"64\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19 29L17 10M28 26L30 7M36 30L43 13\" fill=\"none\" stroke=\"#203548\" stroke-width=\"3.8\"/><path d=\"M19 29L17 10M28 26L30 7M36 30L43 13\" fill=\"none\" stroke=\"#a37c52\" stroke-width=\"1.5\"/><path d=\"M17 17L11 13L11 5L17 9L22 5L23 13Z\" fill=\"#fff0cb\" stroke=\"#203548\" stroke-width=\"1.8\"/><path d=\"M30 16L25 11L26 3L31 7L36 5L35 13Z\" fill=\"#83bcb0\" stroke=\"#203548\" stroke-width=\"1.8\"/><path d=\"M41 22L37 16L40 8L44 13L50 13L47 20Z\" fill=\"#fff0cb\" stroke=\"#203548\" stroke-width=\"1.8\"/><path d=\"M17 30C4 38 12 49 24 48\" fill=\"none\" stroke=\"#203548\" stroke-width=\"5\"/><path d=\"M17 30C4 38 12 49 24 48\" fill=\"none\" stroke=\"#a37c52\" stroke-width=\"2.5\"/><path d=\"M16 28L42 25L39 51L33 58L23 55Z\" fill=\"#c77961\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M17 34L40 31\" fill=\"none\" stroke=\"#e4b563\" stroke-width=\"3\"/><path d=\"M15 25L44 22L44 29L16 32Z\" fill=\"#318d8c\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M25 41L29 44L34 37\" fill=\"none\" stroke=\"#fff0cb\" stroke-width=\"3.5\"/><path d=\"M24 50L33 52\" fill=\"none\" stroke=\"#203548\" stroke-width=\"1.8\"/></svg>",
  "relic-rift-arrowhead": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"64\" height=\"64\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 42L19 36L28 45L21 53Z\" fill=\"#a37c52\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M9 32L54 8L46 51L34 39L27 47L17 37L25 29Z\" fill=\"#b8d5d5\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M54 8L34 29L29 23L25 29L9 32Z\" fill=\"#fff0cb\" stroke=\"none\" stroke-width=\"2.6\"/><path d=\"M54 8L35 30L38 34L31 38L27 47\" fill=\"none\" stroke=\"#203548\" stroke-width=\"5\"/><path d=\"M54 8L35 30L38 34L31 38L27 47\" fill=\"none\" stroke=\"#e4b563\" stroke-width=\"2.4\"/><path d=\"M19 41L25 47\" fill=\"none\" stroke=\"#c77961\" stroke-width=\"4\"/><path d=\"M46 57L48 54M56 39L59 40\" fill=\"none\" stroke=\"#c77961\" stroke-width=\"2.5\"/></svg>",
  "relic-field-medkit": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"64\" height=\"64\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M22 25V16C22 9 42 9 42 16V25\" fill=\"none\" stroke=\"#203548\" stroke-width=\"5\"/><path d=\"M22 25V16C22 9 42 9 42 16V25\" fill=\"none\" stroke=\"#a37c52\" stroke-width=\"2.3\"/><path d=\"M46 25L47 14L54 15L53 28Z\" fill=\"#fff0cb\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M47 19L53 20\" fill=\"none\" stroke=\"#c77961\" stroke-width=\"2.5\"/><path d=\"M12 27Q12 23 17 23H47Q52 23 52 29L54 48Q54 56 46 56H18Q10 56 10 48Z\" fill=\"#318d8c\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M12 26Q10 23 15 22H49Q54 23 52 28L46 38H18Z\" fill=\"#fff0cb\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M27 26V31Q20 31 21 26Q26 25 27 29M27 31Q27 25 33 25Q33 30 27 31\" fill=\"none\" stroke=\"#318d8c\" stroke-width=\"2.4\"/><rect x=\"28\" y=\"35\" width=\"8\" height=\"10\" rx=\"2\" fill=\"#e4b563\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M18 47H23M41 47H46\" fill=\"none\" stroke=\"#83bcb0\" stroke-width=\"2.5\"/><path d=\"M31 40H33\" fill=\"none\" stroke=\"#203548\" stroke-width=\"2\"/></svg>",
  "relic-counter-whistle": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"64\" height=\"64\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 35C5 40 6 56 19 56C28 56 32 49 27 44\" fill=\"none\" stroke=\"#203548\" stroke-width=\"4.5\"/><path d=\"M18 35C5 40 6 56 19 56C28 56 32 49 27 44\" fill=\"none\" stroke=\"#318d8c\" stroke-width=\"2.2\"/><path d=\"M29 21L43 10L54 24L41 34C44 44 37 52 28 52C17 52 13 42 16 33C18 27 22 23 29 21Z\" fill=\"#e4b563\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M31 24L40 17L46 25L38 31Z\" fill=\"#c77961\" stroke=\"#203548\" stroke-width=\"2\"/><circle cx=\"28\" cy=\"38\" r=\"6\" fill=\"#fff0cb\" stroke=\"#203548\" stroke-width=\"2.4\"/><path d=\"M43 10L54 24\" fill=\"none\" stroke=\"#203548\" stroke-width=\"4\"/><path d=\"M29 13L29 8M19 20L15 16M40 7L41 4\" fill=\"none\" stroke=\"#318d8c\" stroke-width=\"2.5\"/><path d=\"M21 39Q21 46 28 46\" fill=\"none\" stroke=\"#a37c52\" stroke-width=\"2\"/></svg>",
  "equipment-spearhead": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"64\" height=\"64\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M27 38H37V57H27Z\" fill=\"#a37c52\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M32 5L45 30L38 40H26L19 30Z\" fill=\"#b8d5d5\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M32 5V38H26L19 30Z\" fill=\"#fff0cb\" stroke=\"none\" stroke-width=\"2.6\"/><path d=\"M32 5V39\" fill=\"none\" stroke=\"#203548\" stroke-width=\"2.3\"/><path d=\"M25 39H39V46H25Z\" fill=\"#318d8c\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M27 49H37M27 53H37\" fill=\"none\" stroke=\"#fff0cb\" stroke-width=\"2.1\"/></svg>",
  "equipment-field-bow": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"64\" height=\"64\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 7L49 32L20 57\" fill=\"none\" stroke=\"#203548\" stroke-width=\"2.2\"/><path d=\"M20 7C18 13 34 16 35 27V37C34 48 18 51 20 57\" fill=\"none\" stroke=\"#203548\" stroke-width=\"7\"/><path d=\"M20 7C18 13 34 16 35 27V37C34 48 18 51 20 57\" fill=\"none\" stroke=\"#a37c52\" stroke-width=\"4\"/><path d=\"M34 26V38\" fill=\"none\" stroke=\"#318d8c\" stroke-width=\"6\"/><path d=\"M34 28V36\" fill=\"none\" stroke=\"#fff0cb\" stroke-width=\"1.8\"/><path d=\"M11 32H53\" fill=\"none\" stroke=\"#203548\" stroke-width=\"2.5\"/><path d=\"M48 27L56 32L48 37Z\" fill=\"#b8d5d5\" stroke=\"#203548\" stroke-width=\"1.8\"/><path d=\"M13 32L9 28M13 32L9 36\" fill=\"none\" stroke=\"#c77961\" stroke-width=\"2.5\"/></svg>",
  "equipment-field-armor": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"64\" height=\"64\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M22 10L26 8Q32 14 38 8L42 10L56 19L50 30L44 27L47 51L32 57L17 51L20 27L14 30L8 19Z\" fill=\"#b8d5d5\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M22 10L26 18H38L42 10L46 24L43 29H21L18 24Z\" fill=\"#318d8c\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M24 29H40L42 47L32 51L22 47Z\" fill=\"#fff0cb\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M32 31V48\" fill=\"none\" stroke=\"#798c8d\" stroke-width=\"2.5\"/><path d=\"M18 46L32 51L46 46V52L32 57L18 52Z\" fill=\"#a37c52\" stroke=\"#203548\" stroke-width=\"2.6\"/><rect x=\"28\" y=\"48\" width=\"8\" height=\"7\" rx=\"1.5\" fill=\"#e4b563\" stroke=\"#203548\" stroke-width=\"1.8\"/><path d=\"M13 20L19 16M45 16L51 20\" fill=\"none\" stroke=\"#fff0cb\" stroke-width=\"2.4\"/></svg>",
  "equipment-marching-boots": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"64\" height=\"64\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M34 11H49L47 35L54 40L56 46Q55 49 50 49H31V40L33 31Z\" fill=\"#318d8c\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M31 45H56V50H31Z\" fill=\"#284456\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M13 18H31L30 40L42 46L43 53L38 57H11L10 50L13 37Z\" fill=\"#a37c52\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M13 18H31V26H13Z\" fill=\"#318d8c\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M11 51H43L41 57H11Z\" fill=\"#284456\" stroke=\"#203548\" stroke-width=\"2.6\"/><path d=\"M18 31H27M17 37H26M17 43H25\" fill=\"none\" stroke=\"#fff0cb\" stroke-width=\"2.2\"/><path d=\"M35 12H49V19H35Z\" fill=\"#fff0cb\" stroke=\"#203548\" stroke-width=\"2.6\"/><rect x=\"20\" y=\"21\" width=\"7\" height=\"7\" rx=\"1.2\" fill=\"#e4b563\" stroke=\"#203548\" stroke-width=\"1.8\"/><path d=\"M36 27H44M36 33H43\" fill=\"none\" stroke=\"#83bcb0\" stroke-width=\"2.2\"/></svg>"
});
const manifest=Object.freeze([
  {
    "id": "relic-marching-banner",
    "nameKo": "행군의 깃발",
    "shortNameKo": "행군깃발",
    "nameEn": "Marching Banner",
    "category": "relic",
    "family": "army",
    "silhouette": "tall split-tail banner and gold finial",
    "file": "relic-marching-banner.svg",
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "recommendedPixels": [
      32,
      48,
      64,
      128
    ],
    "status": "prepared-not-integrated"
  },
  {
    "id": "relic-battle-drum",
    "nameKo": "결전의 북",
    "shortNameKo": "결전북",
    "nameEn": "Last Stand Drum",
    "category": "relic",
    "family": "army",
    "silhouette": "wide oval drum with crossed sticks and lacing",
    "file": "relic-battle-drum.svg",
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "recommendedPixels": [
      32,
      48,
      64,
      128
    ],
    "status": "prepared-not-integrated"
  },
  {
    "id": "relic-ironwall-seal",
    "nameKo": "철벽의 인장",
    "shortNameKo": "철벽인장",
    "nameEn": "Ironwall Seal",
    "category": "relic",
    "family": "spear",
    "silhouette": "octagonal fortress seal with short twin ribbons",
    "file": "relic-ironwall-seal.svg",
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "recommendedPixels": [
      32,
      48,
      64,
      128
    ],
    "status": "prepared-not-integrated"
  },
  {
    "id": "relic-keen-spear-tip",
    "nameKo": "날 선 창끝",
    "shortNameKo": "날선창끝",
    "nameEn": "Keen Spear Tip",
    "category": "relic",
    "family": "spear",
    "silhouette": "diagonal broad leaf blade and coral ceremonial binding",
    "file": "relic-keen-spear-tip.svg",
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "recommendedPixels": [
      32,
      48,
      64,
      128
    ],
    "status": "prepared-not-integrated"
  },
  {
    "id": "relic-swarmhunter-quiver",
    "nameKo": "잔병 사냥 화살통",
    "shortNameKo": "잔병사냥화살통",
    "nameEn": "Swarmhunter Quiver",
    "category": "relic",
    "family": "archer",
    "silhouette": "tilted coral quiver with three spaced feathered arrows",
    "file": "relic-swarmhunter-quiver.svg",
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "recommendedPixels": [
      32,
      48,
      64,
      128
    ],
    "status": "prepared-not-integrated"
  },
  {
    "id": "relic-rift-arrowhead",
    "nameKo": "균열 화살촉",
    "shortNameKo": "균열화살촉",
    "nameEn": "Rift Arrowhead",
    "category": "relic",
    "family": "archer",
    "silhouette": "broad barbed arrowhead split by a gold fault line",
    "file": "relic-rift-arrowhead.svg",
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "recommendedPixels": [
      32,
      48,
      64,
      128
    ],
    "status": "prepared-not-integrated"
  },
  {
    "id": "relic-field-medkit",
    "nameKo": "야전 구급낭",
    "shortNameKo": "야전구급낭",
    "nameEn": "Field Medkit",
    "category": "relic",
    "family": "support",
    "silhouette": "round field satchel with rolled bandage and sprout emblem",
    "file": "relic-field-medkit.svg",
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "recommendedPixels": [
      32,
      48,
      64,
      128
    ],
    "status": "prepared-not-integrated"
  },
  {
    "id": "relic-counter-whistle",
    "nameKo": "역습의 호루라기",
    "shortNameKo": "역습호루라기",
    "nameEn": "Counterattack Whistle",
    "category": "relic",
    "family": "army",
    "silhouette": "gold round whistle with upward mouthpiece and loop",
    "file": "relic-counter-whistle.svg",
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "recommendedPixels": [
      32,
      48,
      64,
      128
    ],
    "status": "prepared-not-integrated"
  },
  {
    "id": "equipment-spearhead",
    "nameKo": "보병 창날",
    "shortNameKo": "창날",
    "nameEn": "Infantry Spearhead",
    "category": "equipment",
    "family": "spear",
    "silhouette": "upright narrow spearhead and plain socket",
    "file": "equipment-spearhead.svg",
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "recommendedPixels": [
      32,
      48,
      64,
      128
    ],
    "status": "future-concept-not-integrated"
  },
  {
    "id": "equipment-field-bow",
    "nameKo": "야전 장궁",
    "shortNameKo": "활",
    "nameEn": "Field Longbow",
    "category": "equipment",
    "family": "archer",
    "silhouette": "tall recurved bow and taut triangular string",
    "file": "equipment-field-bow.svg",
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "recommendedPixels": [
      32,
      48,
      64,
      128
    ],
    "status": "future-concept-not-integrated"
  },
  {
    "id": "equipment-field-armor",
    "nameKo": "야전 흉갑",
    "shortNameKo": "갑옷",
    "nameEn": "Field Cuirass",
    "category": "equipment",
    "family": "all",
    "silhouette": "wide squared shoulders and tapered breastplate",
    "file": "equipment-field-armor.svg",
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "recommendedPixels": [
      32,
      48,
      64,
      128
    ],
    "status": "future-concept-not-integrated"
  },
  {
    "id": "equipment-marching-boots",
    "nameKo": "행군 장화",
    "shortNameKo": "장화",
    "nameEn": "Marching Boots",
    "category": "equipment",
    "family": "all",
    "silhouette": "offset paired boots with contrasting toe directions",
    "file": "equipment-marching-boots.svg",
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "recommendedPixels": [
      32,
      48,
      64,
      128
    ],
    "status": "future-concept-not-integrated"
  }
].map(function(x){Object.freeze(x.viewBox);Object.freeze(x.recommendedPixels);return Object.freeze(x);}));
const own=function(id){return typeof id==='string'&&Object.prototype.hasOwnProperty.call(raw,id);};
const escape=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
function icon(id,options){if(!own(id))return undefined;const o=options||{};let s=raw[id];if(Number.isFinite(o.size)&&o.size>0){const n=Math.max(1,Math.min(4096,o.size));s=s.replace('width="64" height="64"','width="'+n+'" height="'+n+'"');}if(o.label!==undefined&&o.label!==null&&String(o.label).length){s=s.replace('aria-hidden="true"','role="img" aria-label="'+escape(o.label)+'"');}return s;}
function dataURI(id,options){const s=icon(id,options);return s===undefined?undefined:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);}
const api=Object.freeze({version:'0.5.0',palette:palette,manifest:manifest,icons:raw,icon:icon,dataURI:dataURI});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else global.TinyArmyRelicArt=api;
})(typeof window!=='undefined'?window:globalThis);
