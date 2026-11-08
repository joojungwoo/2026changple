/* =========================================================================
 * hunt.js — 레벨 테스트: 찢어진 학교 안내도 조각 5개 모으기
 *
 *  학교 정문(조각 1~3) → 학교 계단(조각 4~5). 등장인물은 없어요.
 *  종이 조각을 누르면 → 펼쳐 보기 → 교과서 문제 2개(힌트 없음) → 맞든 틀리든 조각 획득.
 *  5개를 모으면 안내도(수학 · 국어 · 방과후 교실)가 저절로 맞춰지고, "이제 교실을 찾을 수 있겠다!" 뒤에 복도(홈)로 가요.
 *  진행 상태(지금 단계 · 모은 조각 · 답)는 Sim.s에 저장돼서 앱을 닫아도 이어서 해요.
 * ========================================================================= */

const HUNT_WELCOME = [
  '전학을 온 걸 환영합니다!',
  '우리 학교에 처음 왔군요!',
  '그런데 교실로 가는 안내도가 찢어져 버렸어요.',
  '흩어진 안내도 5조각을 모두 모으면 우리 반 교실을 찾을 수 있어요!',
  '학교 곳곳에서 안내도 조각을 찾아보세요!',
];

/** 조각 하나에 문제 2개 */
const HUNT_PER = 2;
/** 조각마다: 놓인 곳(무대 좌표 595×842의 가운데) · 발견 대사 · 누른 뒤 대사 */
const HUNT_PIECES = [
  { place: 'gate', x: 227, y: 654, rot: -10, find: '어? 계단 옆에 종이가 떨어져 있네!', open: '안내도 조각인가 봐! 한번 살펴보자!' },
  { place: 'gate', x: 511, y: 680, rot: 9, find: '화단 옆에도 종이가 있어!', open: '두 번째 조각이야! 펼쳐 보자!' },
  { place: 'gate', x: 84, y: 779, rot: 6, find: '저기 운동장 쪽에도 종이가 보여!', open: '이 조각까지 모으면 세 개야!' },
  { place: 'stairs', x: 174, y: 474, rot: -8, find: '찾았다! 계단 위에 종이가 있어!', open: '네 번째 조각이야!' },
  { place: 'stairs', x: 395, y: 709, rot: 10, find: '앗! 마지막 종이 조각이다!', open: '이것만 모으면 안내도가 완성될 거야!' },
];
const HUNT_ORD = ['첫', '두', '세', '네', '다섯'];
const HUNT_GATE = HUNT_PIECES.filter((p) => p.place === 'gate').length; // 정문 조각 수
const HUNT_MOVE = ['안내도 조각을 벌써 세 개나 모았어!', '아직 두 조각이 남았네.', '이번에는 학교 계단으로 가 보자!'];
const HUNT_BG = { gate: 'assets/school/bg/school.jpg', stairs: 'assets/school/bg/stairs.jpg?v=5' };

/** 완성된 안내도 그림(assets/school/hunt/final.jpg, 1024×1536)과 조각 5개의 자리
 *  1~3: 수학교실 · 국어교실 · 방과후 교실 칸, 4~5: 제목 쪽 위 칸 */
const HUNT_FINAL = 'assets/school/hunt/final.jpg';
const HUNT_TILES = [[40, 632, 383, 1075], [383, 632, 639, 1075], [639, 632, 985, 1075], [40, 295, 512, 632], [512, 295, 985, 632]];
const HUNT_SC = 595 / 1024; // 그림 → 무대
const HUNT_TOP = -26; // 그림이 무대보다 조금 길어서 위를 살짝 잘라요.

/** 조각 k의 그림 (너비 w) */
function huntTileStyle(k, w) {
  const [x0, y0, x1, y1] = HUNT_TILES[k];
  const f = w / (x1 - x0);
  return `background-image:url('${HUNT_FINAL}');background-size:${1024 * f}px ${1536 * f}px;background-position:${-x0 * f}px ${-y0 * f}px;width:${w}px;height:${(y1 - y0) * f}px`;
}

function huntPlaceOf(s) {
  const k = s.k || 0;
  if (s.step === 'welcome') return 'gate';
  if (s.step === 'got') return HUNT_PIECES[k - 1].place;
  if (s.step === 'move') return 'gate';
  if (s.step === 'done' || s.step === 'map') return 'stairs';
  return HUNT_PIECES[Math.min(k, HUNT_PIECES.length - 1)].place;
}

function screenHunt() {
  const s = Sim.s;
  if (!s || s.kind !== 'test') return '';
  const k = s.k || 0;
  const N = HUNT_PIECES.length;
  const piece = HUNT_PIECES[Math.min(k, N - 1)];
  const place = huntPlaceOf(s);
  let caption = '';
  let btn = '';
  let layer = '';
  let tapNext = false;
  let bg = HUNT_BG[place];

  // 아직 줍지 않은 조각은 그 자리에 놓여 있어요. 지금 찾을 조각만 빨갛게 깜빡여요.
  const lying = () =>
    HUNT_PIECES.map((p, i) => ({ p, i }))
      .filter(({ p, i }) => p.place === place && i >= k && !(s.step === 'open' && i === k))
      .map(({ p, i }) =>
        i === k && s.step === 'find'
          ? `<button type="button" class="hunt-piece blink" style="left:${p.x}px;top:${p.y}px;--rot:${p.rot}deg" data-hunt="tap" aria-label="종이 조각 ${i + 1} 줍기"><span class="hunt-paper" style="${huntTileStyle(i, 74)}"></span></button>`
          : `<span class="hunt-piece idle" style="left:${p.x}px;top:${p.y}px;--rot:${p.rot}deg" aria-hidden="true"><span class="hunt-paper" style="${huntTileStyle(i, 74)}"></span></span>`
      )
      .join('');

  if (s.step === 'welcome') {
    layer = `<div class="hunt-notice" role="dialog" aria-label="전학생 환영 안내">
      ${HUNT_WELCOME.map((t, i) => `<p style="animation-delay:${0.3 + i * 1.1}s">${esc(t)}</p>`).join('')}
      <button type="button" class="s-submit hunt-btn hunt-start" data-hunt="start" style="animation-delay:${0.3 + HUNT_WELCOME.length * 1.1}s">안내도 찾기 시작!</button>
    </div>`;
  } else if (s.step === 'find') {
    caption = piece.find;
    layer = lying();
  } else if (s.step === 'open') {
    caption = piece.open;
    layer = `${lying()}<div class="hunt-zoom" style="--x:${piece.x}px;--y:${piece.y}px;--rot:${piece.rot}deg"><span class="hunt-paper" style="${huntTileStyle(k, 230)}"></span></div>`;
    btn = `<button type="button" class="s-submit hunt-btn" data-hunt="solve">종이 펼쳐 보기</button>`;
  } else if (s.step === 'got') {
    layer = `${lying()}<div class="hunt-got" role="status">
      <div class="hunt-rays" aria-hidden="true"></div>
      <div class="hunt-fly"><span class="hunt-paper" style="${huntTileStyle(k - 1, 250)}"></span></div>
      <p class="hunt-ribbon">${HUNT_ORD[k - 1]} 번째 안내도 조각을 찾았어!</p>
    </div>`;
    tapNext = true;
  } else if (s.step === 'move') {
    const mi = s.mi || 0;
    caption = HUNT_MOVE[mi];
    if (mi < HUNT_MOVE.length - 1) tapNext = true;
    else btn = `<button type="button" class="s-submit hunt-btn" data-hunt="stairs">계단으로 이동하기</button>`;
  } else if (s.step === 'enter') {
    caption = '계단에도 종이 조각이 있을까?';
    layer = lying();
    tapNext = true;
  } else if (s.step === 'done') {
    caption = s.di ? '이제 종이 조각들을 하나로 합쳐 보자!' : '와! 안내도 조각을 모두 모았어!';
    if (s.di) btn = `<button type="button" class="s-submit hunt-btn" data-hunt="map">안내도 완성하기</button>`;
    else tapNext = true;
  } else if (s.step === 'map') {
    // 조각이 하나씩 날아와 제자리에 맞춰지고 → 완성된 안내도 그림이 나타나요.
    const tiles = HUNT_TILES.map(([x0, y0, x1], i) => {
      const sx = [-160, 170, -120, 150, -60][i];
      const sy = [260, 240, -260, -220, 300][i];
      return `<span class="hunt-tile" style="${huntTileStyle(i, (x1 - x0) * HUNT_SC)};left:${x0 * HUNT_SC}px;top:${y0 * HUNT_SC + HUNT_TOP}px;--sx:${sx}px;--sy:${sy}px;--sr:${[-18, 14, -10, 20, -14][i]}deg;animation-delay:${0.5 + i * 0.45}s"></span>`;
    }).join('');
    layer = `<div class="hunt-map-dim" aria-hidden="true"></div>${tiles}
      <img class="hunt-final-img" src="${HUNT_FINAL}" alt="완성된 학교 안내도: 수학교실, 국어교실, 방과후 교실" draggable="false">
      <button type="button" class="hunt-final-tap" data-hunt="finish" aria-label="이제 교실을 찾을 수 있겠다! 교실로 가기"></button>
      <p class="sr-only" role="status">이제 교실을 찾을 수 있겠다!</p>`;
  }

  const fade = s.step === 'enter' ? 'fade-in' : '';
  const count = k;
  return `<div class="s-bg hunt-bg-blur" style="background-image:url('${bg}')" aria-hidden="true"></div>
    <div class="sst-wrap"><div class="sst hunt place-${place} step-${s.step} ${fade}">
      <img class="hunt-bg" src="${bg}" alt="" aria-hidden="true" draggable="false">
      ${s.step === 'welcome' || s.step === 'map' ? '' : `<div class="hunt-count" aria-label="안내도 ${count}/${N}"><span class="hunt-count-ico" aria-hidden="true"></span> 안내도 <b>${count}</b>/${N}</div>`}
      ${caption ? `<section class="hunt-caption ${tapNext ? 'tap' : ''}" ${tapNext ? 'data-hunt="next"' : ''}><p data-read>${esc(caption)}</p>${tapNext ? '<span class="talk-arrow" aria-hidden="true"></span>' : ''}</section>` : ''}
      ${layer}
      ${tapNext && s.step === 'got' ? '<button type="button" class="hunt-got-tap" data-hunt="next" aria-label="다음"></button>' : ''}
      ${btn}
    </div></div>`;
}

const Hunt = {
  /** 지금 조각의 문제 (조각 하나에 문제 2개) */
  solve() {
    const s = Sim.s;
    const q = getQuestion(s.qids[(s.k || 0) * HUNT_PER + (s.j || 0)]);
    if (!q) return this.afterProblem();
    startSimQuiz(q, { t: 'problem', qid: q.id, test: true });
  },
  /** 문제를 마친 뒤: 첫 문제면 바로 다음 문제, 두 문제를 다 풀면 (맞든 틀리든) 조각을 얻어요. */
  afterProblem() {
    const s = Sim.s;
    s.j = (s.j || 0) + 1;
    if (s.j < HUNT_PER) {
      Sim.save();
      return this.solve();
    }
    s.j = 0;
    s.k = (s.k || 0) + 1;
    s.step = 'got';
    Sim.save();
    go('hunt');
  },
  next() {
    const s = Sim.s;
    if (!s) return;
    if (s.step === 'got') {
      if (s.k === HUNT_GATE) (s.step = 'move'), (s.mi = 0);
      else if (s.k >= HUNT_PIECES.length) (s.step = 'done'), (s.di = 0);
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
    else if (what === 'finish') return Sim.finish();
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
  const say = s.step === 'got' ? document.querySelector('.hunt-ribbon') : s.step === 'map' ? null : document.querySelector('.hunt-caption p');
  if (s.step === 'got' || s.step === 'enter') huntTimer = setTimeout(() => State.screen === 'hunt' && Sim.s === s && Hunt.next(), s.step === 'got' ? 2600 : 1800);
  if (s.step === 'map') huntTimer = setTimeout(() => State.screen === 'hunt' && Sim.s === s && Sim.finish(), 9000);
  if (State.huntRead === key) return;
  State.huntRead = key;
  const p = say;
  if (p && Profile.mode().autoRead) {
    Speech.voice = null;
    Speech.read([{ text: p.textContent, el: p, voice: null }]);
  }
}

document.getElementById('app').addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-hunt]');
  if (!el || State.screen !== 'hunt') return;
  Hunt.act(el.dataset.hunt);
});
