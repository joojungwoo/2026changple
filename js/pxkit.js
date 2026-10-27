/* =========================================================================
 * pxkit.js — 피그마 픽셀 틀 (Figma: Shadow · Outline · Shade · Highlight · Face)
 *
 *  피그마의 버튼 · 카드 · 칩은 계단 모양 사각형 5겹으로 그려져 있어요.
 *    Shadow    오른쪽 · 아래로 3px 밀린 그림자 (#605550)
 *    Outline   갈색 외곽선 (#573520, 모서리가 3px씩 계단)
 *    Shade     아래쪽 어두운 띠 · Highlight 위쪽 밝은 띠 · Face 앞면
 *  이 겹들을 SVG 한 장으로 그린 뒤 CSS border-image(9-slice)로 늘려 써요.
 *  그래서 어떤 크기든 피그마와 같은 모서리 · 두께가 나와요.
 *
 *  클래스: px-<모양> px-<색>   예) class="px-tile px-surface"
 *    모양(PX_SHAPES): tile 기본 상자 · tiled 눌린 상자 · panel 큰 판 · plate 이름표 · badge 배지(그림자 없음)
 *                     chip 알약(학년 칩 · 제목 막대) · cell 작은 칸(게이지 · 점) · post 막대 · round 동그란 버튼(48)
 *    색(PX_FACES): [앞면, 밝은 띠, 어두운 띠] — 피그마 color 변수
 * ========================================================================= */

const PX_FACES = {
  surface: ['#f2e6c8', '#fefce5', '#dec59e'],
  'surface-pressed': ['#e8d8b2', '#fefce5', '#dec59e'],
  primary: ['#e4ca6c', '#eed371', '#ceb661'],
  'primary-pressed': ['#d9bd62', '#eed371', '#ceb661'],
  accent: ['#f0a04b', '#f7be73', '#d07f2c'],
  track: ['#87d5e1', '#b5e7ee', '#6bbfcd'],
  red: ['#f47c6e', '#f9a397', '#d35e52'],
  yellow: ['#f5d76e', '#fbe69a', '#d8b84b'],
  blue: ['#87d5e1', '#b5e7ee', '#6bbfcd'],
  purple: ['#c58bf2', '#ddb5f8', '#a066d0'],
  success: ['#2f7a35', '#4fa055', '#22592a'],
  error: ['#b83228', '#d5534a', '#8c241d'],
  wood: ['#c17f45', '#d9a066', '#8e5a2e'],
  fill: ['#f0a04b', '#f7be73', '#d07f2c'],
  mine: ['#8ebc64', '#b4da8a', '#4fa055'],
};
const PX_OUTLINE = '#573520';
const PX_SHADOW = '#605550';

/** 계단: [위아래 안쪽, 좌우 안쪽] 사각형들을 겹치면 모서리가 계단이 돼요. */
const PX_STEP = {
  s15: [[0, 15], [3, 9], [6, 6], [9, 3], [12, 3], [15, 0]],
  s12: [[0, 12], [3, 6], [6, 3], [9, 3], [12, 0]],
  s9: [[0, 9], [3, 6], [6, 3], [9, 0]],
  s9b: [[0, 9], [3, 3], [6, 3], [9, 0]],
  s6: [[0, 6], [3, 3], [6, 0]],
  s3: [[0, 3], [3, 0]],
  s0: [[0, 0]],
};

/**
 * 모양: 바깥 계단(out) · 안쪽 계단(inn) · 그림자 · 눌림 · 그릴 크기(S) · 늘릴 가장자리(slice)
 *  피그마 층 위치(안쪽 여백 T R B L) — 그림자가 있으면 Shadow 3 0 0 3 / Outline 0 3 3 0 / Shade 3 6 6 3 / Highlight 3 6 9 3 / Face 6 6 9 3
 *                                    그림자가 없으면 Outline 0 / Shade 3 / Highlight 3 3 6 3 / Face 6 3 6 3
 */
const PX_SHAPES = {
  tile: { out: 's9', inn: 's6', shadow: true, S: 30, slice: 12 },
  tiled: { out: 's9', inn: 's6', pressed: true, S: 30, slice: 12 },
  panel: { out: 's12', inn: 's9b', shadow: true, S: 36, slice: 15 },
  plate: { out: 's6', inn: 's3', shadow: true, S: 24, slice: 9 },
  badge: { out: 's6', inn: 's3', S: 21, slice: 9 },
  chip: { out: 's12', inn: 's9b', S: 36, slice: 15 },
  cell: { out: 's3', inn: 's0', S: 15, slice: 6 },
  post: { out: 's0', inn: 's0', S: 15, slice: 6 },
  round: { out: 's15', inn: 's12', S: 48, slice: 0 },
};

function pxkRects(x, y, w, h, steps, fill) {
  return PX_STEP[steps].map(([v, hz]) => `<rect x="${x + hz}" y="${y + v}" width="${w - 2 * hz}" height="${h - 2 * v}" fill="${fill}"/>`).join('');
}

function pxShapeSvg(shape, face) {
  const { out, inn, shadow, pressed, S } = PX_SHAPES[shape];
  const [f, hi, sh] = face;
  let s = '';
  if (shadow) {
    s += pxkRects(3, 3, S - 3, S - 3, out, PX_SHADOW);
    s += pxkRects(0, 0, S - 3, S - 3, out, PX_OUTLINE);
    s += pxkRects(3, 3, S - 9, S - 9, inn, sh);
    s += pxkRects(3, 3, S - 9, S - 12, inn, hi);
    s += pxkRects(3, 6, S - 9, S - 15, inn, f);
  } else if (pressed) {
    // 눌림: 그림자 없이 오른쪽 · 아래로 3px 내려앉아요.
    s += pxkRects(3, 3, S - 3, S - 3, out, PX_OUTLINE);
    s += pxkRects(6, 6, S - 9, S - 9, inn, sh);
    s += pxkRects(6, 6, S - 9, S - 12, inn, hi);
    s += pxkRects(6, 9, S - 9, S - 15, inn, f);
  } else {
    s += pxkRects(0, 0, S, S, out, PX_OUTLINE);
    s += pxkRects(3, 3, S - 6, S - 6, inn, sh);
    s += pxkRects(3, 3, S - 6, S - 9, inn, hi);
    s += pxkRects(3, 6, S - 6, S - 12, inn, f);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" shape-rendering="crispEdges">${s}</svg>`;
}

const pxUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** 모양 × 색마다 CSS 규칙을 만들어 <head>에 넣어요. (.px-tile.px-surface …) */
(function pxInstall() {
  let css = '[class*="px-"].px{border:0;}';
  Object.entries(PX_SHAPES).forEach(([shape, cfg]) => {
    Object.entries(PX_FACES).forEach(([name, face]) => {
      const url = pxUrl(pxShapeSvg(shape, face));
      css += cfg.slice
        ? `.px.px-${shape}.px-${name}{border-image:${url} ${cfg.slice} fill / ${cfg.slice}px stretch;}`
        : `.px.px-${shape}.px-${name}{background:${url} center / 100% 100% no-repeat;}`;
    });
  });
  const el = document.createElement('style');
  el.id = 'pxkit';
  el.textContent = css;
  document.head.appendChild(el);
})();
