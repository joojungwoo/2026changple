/* =========================================================================
 * recognize.js — 손글씨 숫자 읽기
 *
 *  1) 기기 안에서 바로: $P 점 구름 인식기 (Vivian 외, 2012). 라이브러리 · 인터넷 · 비용 없음.
 *     숫자 0~9 모양을 여러 가지로 그려 둔 본(RECOG_TEMPLATES)과 비교해요.
 *  2) 확신이 낮을 때만 Gemini에게 물어봐요. (api/handwriting.js — 아이 이름 없이 그림만 보내요)
 *  3) 그래도 애매하면 "이 숫자 맞아?" 후보를 보여 주고 아이가 골라요.
 *     인식 때문에 오답 처리하는 일은 없어요.
 *
 *  칸: 답의 자리 수만큼 칸(십 · 일)을 보여 주고, 획을 칸별로 나눠서 한 칸에 숫자 하나씩 읽어요.
 * ========================================================================= */

const RECOG_N = 32; // 비교할 때 쓰는 점 수
const RECOG_SURE_DIST = 2.2; // 이보다 가까우면 모양이 닮았어요
const RECOG_SURE_MARGIN = 0.26; // 1등과 2등의 차이가 이만큼은 나야 확신해요

/* ---------------- 숫자 본 (0~100 칸, 아래로 갈수록 y가 커요) ---------------- */
function recArc(cx, cy, rx, ry, a0, a1, steps) {
  const out = [];
  const n = steps || 16;
  for (let i = 0; i <= n; i++) {
    const t = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return out;
}
function recLine(...pts) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    for (let k = 0; k < 6; k++) out.push([pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * k) / 6, pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * k) / 6]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function recEight() {
  const out = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    out.push([50 + 24 * Math.sin(2 * t) * 0.9, 50 - 45 * Math.cos(t)]);
  }
  return out;
}

const RECOG_TEMPLATES = [
  ['0', [recArc(50, 50, 30, 45, -90, 270, 24)]],
  ['0', [recArc(50, 50, 26, 45, -100, 250, 24)]],
  ['1', [recLine([50, 5], [50, 95])]],
  ['1', [recLine([32, 22], [52, 5], [52, 95])]],
  ['1', [recLine([32, 22], [52, 5], [52, 95]), recLine([32, 95], [72, 95])]],
  ['2', [[...recArc(50, 30, 28, 25, 200, 390), ...recLine([74, 42], [20, 95], [82, 95])]]],
  ['2', [[...recArc(50, 28, 26, 23, 190, 360), ...recLine([76, 30], [22, 95], [80, 95])]]],
  ['3', [[...recArc(48, 27, 26, 22, 210, 450), ...recArc(48, 72, 28, 23, -90, 150)]]],
  ['3', [[...recLine([22, 8], [74, 8], [46, 45]), ...recArc(48, 70, 28, 25, -80, 150)]]],
  ['4', [recLine([60, 5], [15, 65], [85, 65]), recLine([62, 32], [62, 95])]],
  ['4', [recLine([30, 5], [26, 58], [80, 58]), recLine([66, 5], [66, 95])]],
  ['4', [recLine([66, 95], [66, 5], [15, 65], [85, 65])]],
  ['5', [recLine([72, 6], [30, 6]), [...recLine([30, 6], [27, 45]), ...recArc(48, 68, 28, 26, -115, 140)]]],
  ['5', [[...recLine([30, 6], [27, 45]), ...recArc(48, 68, 28, 26, -115, 140)], recLine([30, 6], [74, 6])]],
  ['6', [[...recLine([68, 6], [44, 24], [28, 52]), ...recArc(50, 70, 23, 24, 180, 540, 24)]]],
  ['7', [recLine([18, 8], [82, 8], [40, 95])]],
  ['7', [recLine([18, 8], [82, 8], [40, 95]), recLine([34, 52], [70, 52])]],
  ['8', [recEight()]],
  ['9', [[...recArc(48, 30, 23, 24, 0, 360, 24), ...recLine([71, 30], [68, 95])]]],
  ['9', [[...recArc(48, 30, 23, 24, -10, 350, 24), ...recArc(40, 60, 30, 35, 0, 80)]]],
];

/* ---------------- $P ---------------- */
function recFlatten(strokes) {
  const pts = [];
  strokes.forEach((s, id) => s.forEach((p) => pts.push({ x: p[0], y: p[1], id })));
  return pts;
}
function recDist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function recResample(pts, n) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].id === pts[i - 1].id) len += recDist(pts[i - 1], pts[i]);
  const I = len / (n - 1) || 1;
  const src = pts.map((p) => ({ ...p }));
  const out = [src[0]];
  let D = 0;
  for (let i = 1; i < src.length; i++) {
    if (src[i].id !== src[i - 1].id) continue;
    const d = recDist(src[i - 1], src[i]);
    if (D + d >= I && d > 0) {
      const t = (I - D) / d;
      const q = { x: src[i - 1].x + t * (src[i].x - src[i - 1].x), y: src[i - 1].y + t * (src[i].y - src[i - 1].y), id: src[i].id };
      out.push(q);
      src.splice(i, 0, q);
      D = 0;
    } else D += d;
  }
  while (out.length < n) out.push({ ...src[src.length - 1] });
  return out.slice(0, n);
}
function recNormalize(strokes) {
  let pts = recResample(recFlatten(strokes), RECOG_N);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
  const minx = Math.min(...xs);
  const miny = Math.min(...ys);
  pts = pts.map((p) => ({ x: (p.x - minx) / size, y: (p.y - miny) / size, id: p.id }));
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  return pts.map((p) => ({ x: p.x - cx, y: p.y - cy, id: p.id }));
}
function recCloud(a, b, start) {
  const n = a.length;
  const used = new Array(n).fill(false);
  let sum = 0;
  let i = start;
  do {
    let min = Infinity;
    let idx = -1;
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      const d = recDist(a[i], b[j]);
      if (d < min) (min = d), (idx = j);
    }
    used[idx] = true;
    sum += (1 - ((i - start + n) % n) / n) * min;
    i = (i + 1) % n;
  } while (i !== start);
  return sum;
}
function recMatch(a, b) {
  const step = Math.floor(Math.sqrt(a.length));
  let min = Infinity;
  for (let i = 0; i < a.length; i += step) min = Math.min(min, recCloud(a, b, i), recCloud(b, a, i));
  return min;
}

const RECOG_NORM = RECOG_TEMPLATES.map(([digit, strokes]) => ({ digit, pts: recNormalize(strokes) }));

/** 숫자 하나 읽기 → [{ digit, dist }] 가까운 순 (숫자마다 가장 닮은 본 하나) */
function recognizeDigit(strokes) {
  const pts = recNormalize(strokes);
  // 아주 가는 세로 획은 1이에요. (점 구름은 크기를 맞추면서 가로 · 세로 비율이 사라지기 때문)
  const all = strokes.flat();
  const w = Math.max(...all.map((p) => p[0])) - Math.min(...all.map((p) => p[0]));
  const h = Math.max(...all.map((p) => p[1])) - Math.min(...all.map((p) => p[1]));
  const best = {};
  RECOG_NORM.forEach((t) => {
    let d = recMatch(pts, t.pts);
    if (t.digit === '1' && h > 0 && w / h < 0.25) d *= 0.6;
    if (!(t.digit in best) || d < best[t.digit]) best[t.digit] = d;
  });
  return Object.entries(best)
    .map(([digit, dist]) => ({ digit, dist }))
    .sort((a, b) => a.dist - b.dist);
}

/**
 * 칸마다 숫자를 읽어 수 하나로 만들어요.
 * @param cells [[획...], ...] 칸별 획 (획 = [[x, y], ...])
 * @returns { text, sure, candidates: [text...], perCell }
 */
function recognizeNumber(cells) {
  if (cells.some((c) => !c.length)) return { text: '', sure: false, candidates: [], empty: true };
  const per = cells.map((c) => recognizeDigit(c));
  const text = per.map((r) => r[0].digit).join('');
  const sureCell = (r) => r[0].dist < RECOG_SURE_DIST && (r[1].dist - r[0].dist) / r[1].dist > RECOG_SURE_MARGIN;
  const sure = per.every(sureCell);
  // 후보: 가장 덜 확실한 칸을 2등 · 3등 숫자로 바꿔 본 수
  const weakest = per.reduce((w, r, i) => ((r[1].dist - r[0].dist) / r[1].dist < (per[w][1].dist - per[w][0].dist) / per[w][1].dist ? i : w), 0);
  const alts = [1, 2].map((k) => per.map((r, i) => (i === weakest ? r[k].digit : r[0].digit)).join(''));
  const candidates = [...new Set([text, ...alts])].filter((t) => !/^0\d/.test(t)).slice(0, 3);
  return { text, sure, candidates, perCell: per.map((r) => r.slice(0, 3)) };
}

/**
 * Gemini에게 물어보기 (Vercel 서버 함수). 실패하면 null — 그때는 후보를 보여 줘요.
 * @param png data:image/png;base64,... (흰 바탕에 검은 글씨, 칸 줄 없이)
 */
async function recognizeRemote(png, kind, cells) {
  try {
    const r = await fetch('api/handwriting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: png, kind: kind || 'digits', cells }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d.candidates) ? d.candidates : null;
  } catch (e) {
    return null;
  }
}
