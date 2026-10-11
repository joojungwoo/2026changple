/* =========================================================================
 * pixel.js — 도트 그림
 *
 * 그림은 글자 격자로 적어요. 글자 하나가 점 하나이고, '.'은 빈 칸이에요.
 * 색은 PX_PAL에서 찾습니다. 그림을 고치려면 격자의 글자만 바꾸면 돼요.
 * ========================================================================= */

const PX_PAL = {
  k: '#4a2f1a', // 외곽선
  w: '#ffffff',
  a: '#b9a98a', // 회색 (글줄)
  l: '#a6e36a', // 밝은 잎
  g: '#6cc24a', // 잎
  G: '#3b8f40', // 어두운 잎 · 줄기
  b: '#9a6337', // 나무 기둥
  B: '#6b4222',
  d: '#c79463', // 흙
  s: '#e0b070', // 씨앗
  S: '#b9843f',
  r: '#e5484d', // 열매
  R: '#a12a2e',
  p: '#ff9aa2', // 볼
  v: '#8b7bf0', // 보라
  y: '#ffc93c', // 노랑
  o: '#f08a3c', // 주황
  c: '#7ccdf2', // 물
  C: '#3d8fc4',
};

/** 격자 → <rect> 묶음. 같은 색이 옆으로 이어지면 한 칸으로 합쳐요. */
function pxRects(rows, pal) {
  const colors = pal || PX_PAL;
  let out = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let w = 1;
      while (row[x + w] === c) w++;
      if (colors[c]) out += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${colors[c]}"/>`;
      x += w;
    }
  });
  return out;
}

function pxSvg(rows, cls) {
  return `<svg class="px ${cls || ''}" viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${pxRects(rows)}</svg>`;
}

/** 격자 위에 작은 그림을 덧찍어요. */
function pxStamp(rows, x, y, stamp) {
  const out = rows.slice();
  stamp.forEach((line, dy) => {
    const row = out[y + dy];
    out[y + dy] = row.slice(0, x) + line + row.slice(x + line.length);
  });
  return out;
}

/* ------------------------------ 새싹 ------------------------------ */

const PX_SPROUT = [
  '..kkk......kkk..',
  '.klllk....kgggk.',
  '.kllllk..kggggk.',
  '.kllllgkkggggGk.',
  '..kllggkkgggGk..',
  '...kkkkGGkkkk...',
  '......kGGk......',
  '......kGGk......',
  '......kGGk......',
  '......kGGk......',
];

/** 앱 아이콘 — 떡잎 두 장 새싹 */
function sproutLogo(cls) {
  return pxSvg(PX_SPROUT, cls);
}

/** 눈 달린 새싹 친구 (운동 시간) */
const PX_BUDDY = [
  '..kkkk........kkkk..',
  '.kllllk......kggggk.',
  'kllllllk....kggggggk',
  'kllwwkllk..kggwwkggk',
  'kllwkkllk..kggwkkggk',
  'kllllllllkkggggggggk',
  'kpplllllgkkgggggGppk',
  '.kllllggkkkkgggGGGk.',
  '..kkkkkkkGGkkkkkkk..',
  '.........kGGk.......',
  '........kGGk........',
  '........kGGk........',
  '.........kGGk.......',
  '.........kGGk.......',
];

function sproutBuddy(cls) {
  return pxSvg(PX_BUDDY, cls);
}

/* ------------------------------ 텃밭 식물 ------------------------------ */

const PX_BLANK = Array(16).fill('................');

/** 흙 두둑 (모든 단계에 깔려요) */
const PX_MOUND = pxStamp(PX_BLANK, 0, 12, [
  '....kkkkkkkk....',
  '..kkddddddddkk..',
  '.kddddddddddddk.',
  '..kkkkkkkkkkkk..',
]);

const PX_TREE = pxStamp(PX_BLANK, 0, 0, [
  '.....kkkkkk.....',
  '...kkgggggGkk...',
  '..kglgggggggGk..',
  '.kgllggggggggGk.',
  '.kglgggggggggGk.',
  'kgggggggggggggGk',
  'kgggggggggggggGk',
  'kggggggggggggGGk',
  '.kgggggggggGGGk.',
  '..kkGGGGGGGGkk..',
  '....kkkbbkkk....',
  '......kbBk......',
  '......kbBk......',
  '......kbBk......',
]);

const PX_APPLE = ['rr', 'rR'];

const PX_PLANT = {
  // 빈 밭: 씨앗 심을 자리를 점선으로 보여 줘요.
  empty: pxStamp(PX_BLANK, 0, 13, ['.....w.w.w.w....']),
  seed: pxStamp(PX_BLANK, 0, 10, [
    '......kkkk......',
    '.....ksssSk.....',
    '.....kssSSk.....',
    '......kkkk......',
  ]),
  sprout: pxStamp(PX_BLANK, 0, 3, PX_SPROUT),
  tree: PX_TREE,
  fruit: [[3, 5], [7, 2], [11, 3], [6, 6], [10, 7]].reduce((rows, [x, y]) => pxStamp(rows, x, y, PX_APPLE), PX_TREE),
};

/** 텃밭 식물 — 단계별 그림 (16 × 16 점). cls에 wilt를 주면 시든 모습이에요. */
function plantSvg(stage, cls) {
  return `<svg class="px plant ${cls || ''}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${pxRects(PX_MOUND)}<g class="plant-body">${pxRects(PX_PLANT[stage] || [])}</g></svg>`;
}

/* ------------------------------ 아이콘 (12 × 12 점) ------------------------------ */

const PX_ICONS = {
  home: [
    '.....kk.....',
    '....krrk....',
    '...krrrrk...',
    '..krrrrrrk..',
    '.krrrrrrrrk.',
    'kkkkkkkkkkkk',
    '.kwwwwwwwwk.',
    '.kwbbwwccwk.',
    '.kwbbwwccwk.',
    '.kwbbwwwwwk.',
    '.kwbbwwwwwk.',
    '.kkkkkkkkkk.',
  ],
  game: [
    '............',
    '............',
    '..kkkkkkkk..',
    '.kvvvvvvvvk.',
    'kvvkvvvvrvvk',
    'kvkkkvvvvvvk',
    'kvvkvvvrvyvk',
    'kvvvvvvvvvvk',
    'kvvkkkkkkvvk',
    'kvvk....kvvk',
    '.kk......kk.',
    '............',
  ],
  chat: [
    '............',
    '.kkkkkkkkkk.',
    'kwwwwwwwwwwk',
    'kwwwwwwwwwwk',
    'kwkkwkkwkkwk',
    'kwwwwwwwwwwk',
    'kwwwwwwwwwwk',
    '.kkkwwkkkkk.',
    '...kwk......',
    '...kk.......',
    '............',
    '............',
  ],
  drop: [
    '.....kk.....',
    '.....kk.....',
    '....kcck....',
    '....kcck....',
    '...kcccck...',
    '..kcwcccck..',
    '..kcwcccck..',
    '.kcwccccCCk.',
    '.kccccccCCk.',
    '.kcccccCCCk.',
    '..kcCCCCCk..',
    '...kkkkkk...',
  ],
  door: [
    '..kkkkkkkk..',
    '..kbbbbbbk..',
    '..kbbbbbbk..',
    '..kbbbbbbk..',
    '..kbbbbbbk..',
    '..kbbbbyyk..',
    '..kbbbbyyk..',
    '..kbbbbbbk..',
    '..kbbbbbbk..',
    '..kbbbbbbk..',
    '..kbbbbbbk..',
    '.kkkkkkkkkk.',
  ],
  pencil: [
    '.........kk.',
    '........kppk',
    '.......kyykk',
    '......kyyyk.',
    '.....kyyyk..',
    '....kyyyk...',
    '...kyyyk....',
    '..kyyyk.....',
    '.kwyyk......',
    '.kwwk.......',
    'kkkk........',
    '............',
  ],
  fire: [
    '......k.....',
    '.....kok....',
    '.....kook...',
    '....kooook..',
    '..k.koyook..',
    '.kokooyyook.',
    '.koooyyyook.',
    'kooyyyyyyook',
    'kooyywwyyook',
    'kooyywwyyook',
    '.kooyyyyook.',
    '..kkkkkkkk..',
  ],
  math: [
    'kkkkkkkkkkkk',
    'kvvvvvvvvvvk',
    'kvvwvvvvvvvk',
    'kvwwwvvwwwvk',
    'kvvwvvvvvvvk',
    'kvvvvvvvvvvk',
    'kvwvwvvwwwvk',
    'kvvwvvvvvvvk',
    'kvwvwvvwwwvk',
    'kvvvvvvvvvvk',
    'kvvvvvvvvvvk',
    'kkkkkkkkkkkk',
  ],
  korean: [
    '............',
    '.kkkkkkkkkk.',
    'kowwwkkwwwok',
    'kowawkkwawok',
    'kowwwkkwwwok',
    'kowawkkwawok',
    'kowwwkkwwwok',
    'kowawkkwawok',
    'kowwwkkwwwok',
    'kooookkooook',
    '.kkkkkkkkkk.',
    '............',
  ],
};
PX_ICONS.sprout = ['................', ...PX_SPROUT, '................'];
PX_ICONS.tree = PX_PLANT.tree;
PX_ICONS.fruit = PX_PLANT.fruit;

/** 글자 옆에 놓는 도트 아이콘 */
function pxIcon(name) {
  return pxSvg(PX_ICONS[name], 'px-ico');
}

/* ------------------------------ 들판의 강 ------------------------------ */

/**
 * 들판을 비스듬히 가로지르는 강 (viewBox 390 × 600, 비율 무시하고 늘여 그려요).
 * 곡선을 따라 네모 칸을 채워 계단 모양 물길을 만들어요.
 */
function pixelRiver() {
  const CELL = 15, COLS = 26, ROWS = 40;
  const bez = (p, t) => {
    const u = 1 - t;
    return [0, 1].map((i) => u * u * u * p[0][i] + 3 * u * u * t * p[1][i] + 3 * u * t * t * p[2][i] + t * t * t * p[3][i]);
  };
  const curves = [
    [[-30, 190], [80, 200], [170, 270], [225, 350]],
    [[225, 350], [280, 430], [330, 520], [430, 560]],
  ];
  const pts = [];
  curves.forEach((c) => {
    for (let i = 0; i <= 40; i++) pts.push(bez(c, i / 40));
  });

  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    let row = '';
    for (let c = 0; c < COLS; c++) {
      const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
      const d = Math.min(...pts.map((p) => Math.hypot(p[0] - x, p[1] - y)));
      // 물결: 물 위에 드문드문 흰 칸
      const sparkle = (c * 7 + r * 13) % 11 === 0;
      row += d < 34 ? (sparkle ? 'w' : 'c') : d < 46 ? 'C' : '.';
    }
    rows.push(row);
  }
  return `<svg class="px world-river" viewBox="0 0 ${COLS} ${ROWS}" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">${pxRects(rows)}</svg>`;
}
