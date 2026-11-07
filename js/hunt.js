/* =========================================================================
 * hunt.js — 레벨 테스트: 찢어진 학교 안내도 조각 10개 모으기
 *
 *  학교 정문(문제 1~5) → 학교 계단(문제 6~10). 등장인물은 없어요.
 *  종이 조각을 누르면 → 펼쳐 보기 → 교과서 문제(힌트 없음) → 맞든 틀리든 조각 획득.
 *  10개를 모으면 안내도가 저절로 맞춰지고, "이제 교실을 찾을 수 있겠다!" 뒤에 복도(홈)로 가요.
 *  진행 상태(지금 단계 · 모은 조각 · 답)는 Sim.s에 저장돼서 앱을 닫아도 이어서 해요.
 * ========================================================================= */

const HUNT_WELCOME = [
  '전학을 온 걸 환영합니다!',
  '우리 학교에 처음 왔군요!',
  '그런데 교실로 가는 안내도가 찢어져 버렸어요.',
  '흩어진 안내도 10조각을 모두 모으면 우리 반 교실을 찾을 수 있어요!',
  '학교 곳곳에서 안내도 조각을 찾아보세요!',
];

/** 조각마다: 놓인 곳(무대 좌표 595×842의 가운데) · 발견 대사 · 누른 뒤 대사 · 얻은 뒤 대사 */
const HUNT_PIECES = [
  { place: 'gate', x: 112, y: 752, rot: -12, find: '어? 저기 종이가 떨어져 있네!', open: '안내도 조각인가 봐! 한번 살펴보자!', got: '첫 번째 안내도 조각을 찾았어!' },
  { place: 'gate', x: 500, y: 612, rot: 9, find: '어? 화단 옆에도 종이가 있어!', open: '두 번째 조각이야! 펼쳐 보자!', got: '좋아! 두 번째 조각도 모았어!' },
  { place: 'gate', x: 78, y: 640, rot: 6, find: '게시판 아래에도 종이가 떨어져 있네!', open: '이것도 안내도 조각인가 봐!', got: '세 번째 조각을 찾았어!' },
  { place: 'gate', x: 396, y: 640, rot: -8, find: '저기 기둥 아래에 종이가 보여!', open: '벌써 네 번째 조각이야!', got: '네 번째 조각까지 모았어!' },
  { place: 'gate', x: 300, y: 770, rot: 14, find: '저기에도 종이가 있어! 한번 확인해 보자!', open: '이 조각까지 모으면 다섯 개야!', got: '다섯 번째 조각을 찾았어!' },
  { place: 'stairs', x: 140, y: 770, rot: -6, find: '찾았다! 계단 위에 종이가 있어!', open: '여섯 번째 조각이야!', got: '여섯 번째 조각을 모았어!' },
  { place: 'stairs', x: 452, y: 690, rot: 10, find: '난간 아래에도 종이가 있네!', open: '일곱 번째 조각을 찾았어!', got: '좋아! 이제 세 조각만 더 찾으면 돼!' },
  { place: 'stairs', x: 150, y: 352, rot: -10, find: '창문 아래에 작은 종이가 보여!', open: '여덟 번째 조각이야!', got: '여덟 번째 조각까지 모았어!' },
  { place: 'stairs', x: 300, y: 488, rot: 7, find: '저기에도 종이가 있어! 거의 다 찾았어!', open: '아홉 번째 조각이야!', got: '이제 마지막 한 조각만 남았어!' },
  { place: 'stairs', x: 470, y: 428, rot: -7, find: '앗! 마지막 종이 조각이다!', open: '이것만 모으면 안내도가 완성될 거야!', got: '와! 안내도 조각을 모두 모았어!' },
];
const HUNT_MOVE = ['안내도 조각을 벌써 반이나 모았어!', '아직 다섯 조각이 남았네.', '이번에는 학교 계단으로 가 보자!'];
const HUNT_BG = { gate: 'assets/school/bg/school.jpg', stairs: 'assets/school/bg/stairs.jpg' };

/** 학교 안내도 (그림 한 장을 5×2 조각으로 나눠 써요) */
const MAP_W = 440;
const MAP_H = 330;
const MAP_SVG = (() => {
  const room = (x, y, w, h, fill, label, big) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="#5b4630" stroke-width="3"/>` +
    `<text x="${x + w / 2}" y="${y + h / 2 + (big ? 7 : 6)}" font-size="${big ? 19 : 16}" text-anchor="middle" fill="#3b2f22" font-family="Galmuri11, sans-serif" font-weight="700">${label}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_W}" height="${MAP_H}" viewBox="0 0 ${MAP_W} ${MAP_H}">
    <rect width="${MAP_W}" height="${MAP_H}" fill="#fbf1d8"/>
    <rect x="6" y="6" width="${MAP_W - 12}" height="${MAP_H - 12}" fill="none" stroke="#c9a46a" stroke-width="3" stroke-dasharray="10 6"/>
    <text x="${MAP_W / 2}" y="38" font-size="22" text-anchor="middle" fill="#5b4630" font-family="Galmuri11, sans-serif" font-weight="700">우리 학교 안내도</text>
    ${room(24, 56, 126, 96, '#ffd6d6', '국어교실', true)}
    ${room(157, 56, 126, 96, '#d6e8ff', '수학교실', true)}
    ${room(290, 56, 126, 96, '#fff0b8', '방과후 교실', true)}
    <rect x="24" y="160" width="392" height="44" fill="#efe1c0" stroke="#c9a46a" stroke-width="2"/>
    <text x="220" y="188" font-size="14" text-anchor="middle" fill="#8a6f4a" font-family="Galmuri11, sans-serif">복도</text>
    ${room(24, 212, 92, 92, '#e2f2dc', '교무실')}
    ${room(124, 212, 92, 92, '#e6e6f4', '화장실')}
    ${room(224, 212, 92, 92, '#f5e2c8', '도서관')}
    ${room(324, 212, 92, 92, '#e0e0e0', '계단')}
    <path d="M346 298 h12 v-8 h12 v-8 h12 v-8 h12" fill="none" stroke="#5b4630" stroke-width="3"/>
    <text x="370" y="132" font-size="22" text-anchor="middle">⭐</text>
  </svg>`;
  return `url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}')`;
})();
const TILE_W = MAP_W / 5;
const TILE_H = MAP_H / 2;

/** 조각 k의 그림 (안내도의 k번째 칸) */
function huntTileStyle(k, scale) {
  const sc = scale || 1;
  const col = k % 5;
  const row = Math.floor(k / 5);
  return `background-image:${MAP_SVG};background-size:${MAP_W * sc}px ${MAP_H * sc}px;background-position:${-col * TILE_W * sc}px ${-row * TILE_H * sc}px;width:${TILE_W * sc}px;height:${TILE_H * sc}px`;
}

function screenHunt() {
  const s = Sim.s;
  if (!s || s.kind !== 'test') return '';
  const k = s.k || 0;
  const piece = HUNT_PIECES[Math.min(k, 9)];
  const place = s.step === 'welcome' || (s.step === 'move' && k <= 5) ? 'gate' : s.step === 'got' ? HUNT_PIECES[k - 1].place : s.step === 'done' || s.step === 'map' ? 'stairs' : piece.place;
  const count = s.step === 'got' || s.step === 'move' || s.step === 'done' || s.step === 'map' ? k : k;
  let caption = '';
  let btn = '';
  let layer = '';
  let tapNext = false;

  if (s.step === 'welcome') {
    layer = `<div class="hunt-notice" role="dialog" aria-label="전학생 환영 안내">
      ${HUNT_WELCOME.map((t, i) => `<p style="animation-delay:${0.3 + i * 1.1}s">${esc(t)}</p>`).join('')}
      <button type="button" class="s-submit hunt-btn hunt-start" data-hunt="start" style="animation-delay:${0.3 + HUNT_WELCOME.length * 1.1}s">안내도 찾기 시작!</button>
    </div>`;
  } else if (s.step === 'find') {
    caption = piece.find;
    layer = `<button type="button" class="hunt-piece blink" style="left:${piece.x}px;top:${piece.y}px;--rot:${piece.rot}deg" data-hunt="tap" aria-label="종이 조각 ${k + 1} 줍기">
      <span class="hunt-paper" style="${huntTileStyle(k, 0.62)}"></span></button>`;
  } else if (s.step === 'open') {
    caption = piece.open;
    layer = `<div class="hunt-zoom" style="--x:${piece.x}px;--y:${piece.y}px;--rot:${piece.rot}deg"><span class="hunt-paper" style="${huntTileStyle(k, 1.6)}"></span></div>`;
    btn = `<button type="button" class="s-submit hunt-btn" data-hunt="solve">종이 펼쳐 보기</button>`;
  } else if (s.step === 'got') {
    caption = HUNT_PIECES[k - 1].got;
    layer = `<div class="hunt-fly"><span class="hunt-paper" style="${huntTileStyle(k - 1, 1.2)}"></span></div>`;
    tapNext = true;
  } else if (s.step === 'move') {
    const mi = s.mi || 0;
    caption = HUNT_MOVE[mi];
    if (mi < HUNT_MOVE.length - 1) tapNext = true;
    else btn = `<button type="button" class="s-submit hunt-btn" data-hunt="stairs">계단으로 이동하기</button>`;
  } else if (s.step === 'enter') {
    caption = '계단에도 종이 조각이 있을까?';
    tapNext = true;
  } else if (s.step === 'done') {
    caption = s.di ? '이제 종이 조각들을 하나로 합쳐 보자!' : '와! 안내도 조각을 모두 모았어!';
    if (s.di) btn = `<button type="button" class="s-submit hunt-btn" data-hunt="map">안내도 완성하기</button>`;
    else tapNext = true;
  } else if (s.step === 'map') {
    const tiles = HUNT_PIECES.map((_, i) => {
      const sx = ((i * 137) % 300) - 150;
      const sy = ((i * 89) % 220) - 110;
      return `<span class="hunt-tile" style="${huntTileStyle(i)};left:${(i % 5) * TILE_W}px;top:${Math.floor(i / 5) * TILE_H}px;--sx:${sx}px;--sy:${sy}px;--sr:${((i * 53) % 50) - 25}deg;animation-delay:${0.4 + i * 0.28}s"></span>`;
    }).join('');
    layer = `<div class="hunt-map-wrap">
      <div class="hunt-map" role="img" aria-label="완성된 학교 안내도: 국어교실, 수학교실, 방과후 교실이 나란히 있고, 교무실, 화장실, 도서관, 계단이 있어요.">${tiles}</div>
      <p class="hunt-final" role="status">이제 교실을 찾을 수 있겠다!</p>
    </div>`;
  }

  const fade = s.step === 'enter' ? 'fade-in' : '';
  return `<div class="s-bg hunt-bg-blur" style="background-image:url('${HUNT_BG[place]}')" aria-hidden="true"></div>
    <div class="sst-wrap"><div class="sst hunt place-${place} step-${s.step} ${fade}">
      <img class="hunt-bg" src="${HUNT_BG[place]}" alt="" aria-hidden="true" draggable="false">
      ${s.step === 'welcome' || s.step === 'map' ? '' : `<div class="hunt-count" aria-label="안내도 ${count}/10"><span aria-hidden="true">🗺️</span> 안내도 <b>${count}</b>/10</div>`}
      ${caption ? `<section class="hunt-caption ${tapNext ? 'tap' : ''}" ${tapNext ? 'data-hunt="next"' : ''}><p data-read>${esc(caption)}</p>${tapNext ? '<span class="talk-arrow" aria-hidden="true"></span>' : ''}</section>` : ''}
      ${layer}
      ${btn}
    </div></div>`;
}

const Hunt = {
  /** 레벨 테스트 문제 k 열기 */
  solve() {
    const s = Sim.s;
    const q = getQuestion(s.qids[s.k]);
    if (!q) return this.afterProblem(null);
    startSimQuiz(q, { t: 'problem', qid: q.id, test: true });
  },
  /** 문제를 마친 뒤 (맞든 틀리든 조각을 얻어요) */
  afterProblem() {
    const s = Sim.s;
    s.k = (s.k || 0) + 1;
    s.step = 'got';
    Sim.save();
    go('hunt');
  },
  next() {
    const s = Sim.s;
    if (!s) return;
    if (s.step === 'got') {
      if (s.k === 5) (s.step = 'move'), (s.mi = 0);
      else if (s.k >= 10) (s.step = 'done'), (s.di = 0);
      else s.step = 'find';
    } else if (s.step === 'move') s.mi = (s.mi || 0) + 1;
    else if (s.step === 'enter') s.step = 'find';
    else if (s.step === 'done') s.di = 1;
    Sim.save();
    go('hunt');
  },
  act(what) {
    const s = Sim.s;
    if (!s) return;
    if (what === 'start') s.step = 'find';
    else if (what === 'tap') s.step = 'open';
    else if (what === 'solve') return this.solve();
    else if (what === 'stairs') s.step = 'enter';
    else if (what === 'map') s.step = 'map';
    else if (what === 'next') return this.next();
    Sim.save();
    go('hunt');
  },
};

/** 그려진 뒤: 자동으로 넘어가는 단계 · 대사 읽어 주기 */
let huntTimer = null;
function huntAfterRender() {
  clearTimeout(huntTimer);
  if (State.screen !== 'hunt' || !Sim.s) return;
  const s = Sim.s;
  const key = `${s.step}:${s.k}:${s.mi || 0}:${s.di || 0}`;
  if (s.step === 'got' || s.step === 'enter') huntTimer = setTimeout(() => State.screen === 'hunt' && Sim.s === s && Hunt.next(), 1800);
  if (s.step === 'map') huntTimer = setTimeout(() => State.screen === 'hunt' && Sim.s === s && Sim.finish(), 7200);
  if (State.huntRead === key) return;
  State.huntRead = key;
  const p = document.querySelector('.hunt-caption p, .hunt-final');
  if (p && Profile.mode().autoRead && s.step !== 'map') {
    Speech.voice = null;
    Speech.read([{ text: p.textContent, el: p, voice: null }]);
  }
}

document.getElementById('app').addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-hunt]');
  if (!el || State.screen !== 'hunt') return;
  Hunt.act(el.dataset.hunt);
});
