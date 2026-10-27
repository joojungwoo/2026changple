/* =========================================================================
 * ui.js — 피그마 화면 (Screen 페이지 390×844)을 기본 디자인으로
 *
 *  - 화면은 무대(stage.js) 위에 피그마 좌표 그대로 놓아요. 좌표 · 크기는 CSS(figma.css)에 있어요.
 *  - 픽셀 틀은 pxkit.js 클래스: px px-<모양> px-<색>
 *  - 피그마에 없는 우리 기능(설정 ⚙️ · 시든 식물 말풍선 · 연속 학습 · 읽어 주기 등)은
 *    피그마 부품(이름표 · 동그란 버튼 · 배지)을 써서 같은 모습으로 얹어요.
 * ========================================================================= */

const UI_IMG = {
  logo: 'assets/ui/logo-sprout.png',
  pencil: 'assets/ui/icon-pencil.png',
  house: 'assets/ui/icon-house.png',
  chat: 'assets/ui/icon-chat.svg',
  back: 'assets/ui/back.svg',
  gear: 'assets/ui/icon-gear.svg',
  boat: 'assets/ui/icon-boat.svg',
  math: 'assets/ui/icon-math.png',
  korean: 'assets/ui/icon-korean.png',
  chevron: 'assets/ui/icon-chevron-down.svg',
  droplet: 'assets/ui/icon-droplet.svg',
  sparkle: 'assets/ui/icon-sparkle.svg',
  arrow: 'assets/ui/icon-arrow-right.svg',
  book: 'assets/ui/icon-book.svg',
  stage: { empty: 'assets/ui/stage-seed.png', seed: 'assets/ui/stage-seed.png', sprout: 'assets/ui/stage-sprout.png', tree: 'assets/ui/stage-tree.png', fruit: 'assets/ui/stage-fruit.png' },
};

const img = (src, alt, cls) => `<img src="${src}" alt="${alt || ''}" ${cls ? `class="${cls}"` : ''} ${alt ? '' : 'aria-hidden="true"'} draggable="false">`;

/** 동그란 픽셀 버튼 (피그마 Icon Button 48×48) */
function fRound(attrs, icon, label, cls) {
  return `<button class="f-btn f-round px px-round px-surface ${cls || ''}" ${attrs} aria-label="${label}">${img(icon)}</button>`;
}

/** 이름표 (피그마 Name Plate) */
function fPlate(text, cls, attrs) {
  const tag = attrs ? 'button' : 'div';
  return `<${tag} class="f-plate f-btn px px-plate px-surface ${cls || ''}" ${attrs || ''}>${text}</${tag}>`;
}

/** 아래 탭바 (피그마 Bottom Tab Bar): ✏️ 게임 · 🏠 홈 · 💬 채팅. 활성 탭은 금색 + 크게. */
function fTabbar(active) {
  const unread = Chat.unread();
  const tab = (id, go, src, label) =>
    `<button class="f-btn ftab px px-tile ${active === id ? 'px-primary on' : 'px-surface'}" data-go="${go}" aria-label="${label}" ${active === id ? 'aria-current="page"' : ''}>
      ${img(src)}${id === 'chat' && unread ? `<span class="dot">${unread > 9 ? '9+' : unread}</span>` : ''}
    </button>`;
  return `<nav class="ftabbar" aria-label="메뉴">
    ${tab('games', 'games', UI_IMG.pencil, '게임')}
    ${tab('home', 'home', UI_IMG.house, '홈')}
    ${tab('chat', 'chat', UI_IMG.chat, '채팅')}
  </nav>`;
}

/* ------------------------------ 스플래시 · 로딩 ------------------------------ */
function screenSplash() {
  return stageScreen({
    cls: 'scr-splash',
    sky: '#fefbe8',
    ground: '#fefbe8',
    body: `<button class="f-btn" data-skip aria-label="한걸음 시작하기" style="left:0;top:0;width:390px;height:844px;background:none;border:0"></button>
      ${img(UI_IMG.logo, '', 'splash-logo-img')}
      <h1 class="splash-name">한걸음</h1>`,
  });
}

/** 로딩: 새싹 + "로딩중" + 점 세 개 (0.4초마다 금색 점이 옆으로) */
function screenLoading() {
  return stageScreen({
    cls: 'scr-loading',
    sky: '#fefbe8',
    ground: '#fefbe8',
    body: `${img(UI_IMG.logo, '', 'loading-logo')}
      <p class="loading-text" role="status">로딩중</p>
      <div class="loading-dots" aria-hidden="true"><i class="px px-cell px-primary"></i><i class="px px-cell px-surface"></i><i class="px px-cell px-surface"></i></div>`,
  });
}
let loadingTimer = null;
function loadingAfterRender() {
  clearInterval(loadingTimer);
  if (State.screen !== 'loading') return;
  let at = 0;
  loadingTimer = setInterval(() => {
    at = (at + 1) % 3;
    document.querySelectorAll('.loading-dots i').forEach((d, i) => {
      d.classList.toggle('px-primary', i === at);
      d.classList.toggle('px-surface', i !== at);
    });
  }, 400);
}

/* ------------------------------ 홈 ------------------------------ */
function signpost(subject, icon, cls, thirsty) {
  return `<button class="f-btn signpost ${cls}" data-subject="${subject.id}" aria-label="${subject.name}${thirsty ? `, 물 줄 식물 ${thirsty}개` : ''}">
    <span class="post px px-post px-wood"></span>
    <span class="board px px-tile px-wood"></span>
    <span class="face px px-badge px-surface">${img(icon)}</span>
    ${thirsty ? `<span class="sign-thirsty">🥀 ${THIRSTY_BUBBLE}</span>` : ''}
  </button>`;
}

function screenHome() {
  const user = Store.currentUser();
  const t = Store.todaySummary();
  const grade = State.grade || user.grade;
  const thirsty = (id) => getChapters(id, grade).filter((c) => Store.chapterGarden(c.id).wilted).length;
  const math = SUBJECTS.find((s) => s.id === 'math');
  const korean = SUBJECTS.find((s) => s.id === 'korean');
  return stageScreen({
    cls: 'scr-home',
    bg: 'valley',
    sky: '#9fd0f0',
    ground: '#8ebc64',
    body: `
      <div class="home-avatar px px-panel px-surface" aria-hidden="true">${user.avatar ? `<span>${esc(user.avatar)}</span>` : img(UI_IMG.logo)}</div>
      ${fPlate(`${esc(user.nick || user.name)} 학생`, 'home-name')}
      <div class="f-badge px px-badge px-accent home-badge" aria-label="${t.streak}일 연속으로 공부했어요">${t.streak}일 연속</div>
      ${fRound('data-go="settings"', UI_IMG.gear, '설정', 'home-gear')}
      ${signpost(math, UI_IMG.math, 'sign-math', thirsty('math'))}
      ${signpost(korean, UI_IMG.korean, 'sign-korean', thirsty('korean'))}
      ${fPlate('수학', 'plate-math', 'data-subject="math"')}
      ${fPlate('국어', 'plate-korean', 'data-subject="korean"')}
      <button class="f-btn home-boat" data-go="games" aria-label="게임">${img(UI_IMG.boat)}</button>
      ${fPlate('게임', 'plate-game', 'data-go="games"')}
      ${fTabbar('home')}`,
  });
}

/* ------------------------------ 게임 (바다) ------------------------------ */
function screenGames() {
  const pos = [24, 201];
  return stageScreen({
    cls: 'scr-games',
    under: '<div class="sea" aria-hidden="true"></div>',
    body: `
      <img src="assets/ui/cloud.svg" alt="" aria-hidden="true" style="left:30px;top:42px;width:96px;height:30px">
      <img src="assets/ui/cloud.svg" alt="" aria-hidden="true" style="left:266px;top:92px;width:72px;height:22px">
      <img src="${UI_IMG.boat}" alt="" aria-hidden="true" style="left:135px;top:96px;width:120px;height:90px">
      <img src="assets/ui/illust-fish-orange.svg" alt="" aria-hidden="true" style="left:36px;top:528px;width:48px;height:28px">
      <img src="assets/ui/illust-fish-yellow.svg" alt="" aria-hidden="true" style="left:288px;top:650px;width:36px;height:21px">
      <img src="assets/ui/illust-fish-orange.svg" alt="" aria-hidden="true" style="left:168px;top:590px;width:30px;height:18px">
      ${[[72, 444, 18], [84, 414, 12], [318, 520, 18], [306, 492, 12], [198, 636, 15], [48, 690, 12], [342, 700, 15]].map(([x, y, s]) => `<img src="assets/ui/illust-bubble.svg" alt="" aria-hidden="true" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px">`).join('')}
      <img src="assets/ui/illust-seaweed.svg" alt="" aria-hidden="true" style="left:18px;top:765px;width:27px;height:54px">
      <img src="assets/ui/illust-seaweed.svg" alt="" aria-hidden="true" style="left:60px;top:783px;width:18px;height:36px">
      <img src="assets/ui/illust-seaweed.svg" alt="" aria-hidden="true" style="left:330px;top:765px;width:27px;height:54px">
      ${fRound('data-back="home" style="left:16px;top:57px"', UI_IMG.back, '뒤로 가기')}
      ${GAMES.map(
        (g, i) => `<button class="f-btn game-card px px-tile px-surface" data-game="${g.id}" style="left:${pos[i % 2]}px">
          <span class="pic" aria-hidden="true">${g.icon}</span>
          <b>${esc(g.name)}</b>
          <small>${esc(g.desc)}</small>
        </button>`
      ).join('')}
      ${fTabbar('games')}`,
  });
}

/* ------------------------------ 과목: 단원 길 (피그마 '수학') ------------------------------ */
/**
 * 피그마: 흙길을 따라 단원(밭)이 이어져요. 단원 1 · 2는 피그마 자리 그대로 (66, 300) · (216, 486),
 * 그 뒤로는 왼쪽 · 오른쪽을 번갈아 186px씩 내려가요. 배경 그림은 한 장이라, 그림 아래(630px부터)는
 * 같은 잔디색 위에 길을 이어 그려요. 스크롤하면 잔디가 바람에 흔들리듯 움직여요(ScrollGrass).
 */
const PATH_TOP = 300;
const PATH_STEP = 186;
const PATH_CUT = 630; // 배경 그림의 길이 이 높이부터 다른 쪽으로 가서, 여기부터는 직접 그려요.
const GRASS = '#8cb95e';

function pathPlots(n) {
  return Array.from({ length: n }, (_, i) => ({ x: i % 2 ? 216 : 66, y: PATH_TOP + PATH_STEP * i }));
}

/** 그림 아래로 이어지는 흙길 (SVG, 굵은 선 두 겹: 테두리 + 흙) */
function pathSvg(plots, h) {
  if (plots.length < 3) return '';
  const pts = [{ x: 215, y: PATH_CUT - 4 }, ...plots.slice(2).map((p) => ({ x: p.x + 60, y: p.y + 92 }))];
  const last = pts[pts.length - 1];
  pts.push({ x: last.x < 195 ? 300 : 90, y: Math.min(h, last.y + 170) });
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const my = (a.y + b.y) / 2;
    d += ` C${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
  }
  return `<svg class="path-svg" width="390" height="${h}" viewBox="0 0 390 ${h}" aria-hidden="true" style="left:0;top:0">
    <path d="${d}" fill="none" stroke="#b98a4c" stroke-width="66" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="#e7c37f" stroke-width="56" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="#f0d394" stroke-width="18" stroke-linecap="round" stroke-dasharray="3 27" opacity=".8"/>
  </svg>`;
}

/** 학년 · 학기 펼침 메뉴 (피그마 Dropdown Menu, 칩 바로 아래 3px) */
function topMenu(kind, cur, left) {
  const items = kind === 'grade' ? GRADES.map((g) => [g, `${g}학년`]) : [[1, '1학기'], [2, '2학기']];
  return `<div class="f-menu px px-plate px-surface" role="menu" style="left:${left}px">
    ${items.map(([v, label]) => `<button class="f-btn f-menu-item ${v === cur ? 'on' : ''}" role="menuitemradio" aria-checked="${v === cur}" data-${kind}="${v}">${v === cur ? '✔ ' : ''}${label}</button>`).join('')}
  </div>`;
}

function screenGarden() {
  const subject = getSubject(State.subject);
  const grade = State.grade;
  const term = State.term || 1;
  const chapters = getChapters(subject.id, grade).filter((c) => (c.term || 1) === term);
  const views = chapters.map((c) => Store.chapterGarden(c.id));
  const plots = pathPlots(views.length);
  const h = Math.max(STAGE_H, plots.length ? plots[plots.length - 1].y + 120 + 34 + 170 : STAGE_H);

  const units = views
    .map((v, i) => {
      const ch = v.chapter;
      const p = plots[i];
      return `<button class="f-btn unit-plot ${v.wilted ? 'wilt' : ''}" data-unit="${ch.id}" style="left:${p.x}px;top:${p.y}px"
          aria-label="${ch.label} ${esc(ch.title)} · ${STAGE_NAME[v.stage]}${v.wilted ? ' · 시들었어요' : ''}">
          ${img(UI_IMG.stage[v.stage])}
        </button>
        <div class="unit-title t-display t-outline" style="left:${p.x - 60}px;top:${p.y + 118}px">${esc(ch.title)}</div>
        ${v.wilted ? fPlate(`🥀 ${THIRSTY_BUBBLE}`, 'unit-bubble', `data-water="${ch.id}" style="left:${p.x + 70}px;top:${p.y - 14}px" aria-label="${THIRSTY_BUBBLE} 물 주기 시작"`) : ''}
        ${v.canGrow ? `<div class="f-badge px px-badge px-accent unit-grow" style="left:${p.x - 10}px;top:${p.y + 156}px">✨ 다시 공부하면 ${STAGE_NAME[STAGES[v.passCount + 2]]}!</div>` : ''}`;
    })
    .join('');

  const menu = State.menu === 'grade' ? topMenu('grade', grade, 72) : State.menu === 'term' ? topMenu('term', term, 195) : '';
  return stageScreen({
    cls: 'scr-garden scroll',
    bg: 'field',
    sky: '#8bc9ee',
    ground: GRASS,
    h,
    under: views.length > 2 ? `<div class="field-cover" aria-hidden="true"></div>` : '',
    body: `
      ${pathSvg(plots, h)}
      ${units}
      ${views.length ? '' : `<p class="unit-empty t-h2">${term}학기 단원은 준비 중이에요 🌱</p>`}`,
    over: `
      <canvas class="scroll-grass" aria-hidden="true"></canvas>
      <div class="fixed-top"><div class="zoomed" style="height:120px">
        <div class="f-topbar">
          ${fRound('data-back="home"', UI_IMG.back, '뒤로 가기')}
          <button class="f-btn f-chip px px-chip px-surface" data-menu="grade" aria-haspopup="menu" aria-expanded="${State.menu === 'grade'}">${grade}학년 ${img(UI_IMG.chevron)}</button>
          <button class="f-btn f-chip px px-chip px-surface" data-menu="term" aria-haspopup="menu" aria-expanded="${State.menu === 'term'}">${term}학기 ${img(UI_IMG.chevron)}</button>
        </div>
        ${menu}
      </div></div>
      <div class="fixed-bottom"><div class="zoomed">${fTabbar('home')}</div></div>`,
  });
}

/* ------------------------------ 단원 선택 (피그마 '단원 선택' · '소단원 팝업') ------------------------------ */
/** 물 게이지 (피그마 Water Gauge): 소단원 하나를 끝낼 때마다 한 칸 */
function waterGauge(v) {
  const n = v.subs.length || 3;
  const inner = 276;
  const cell = inner / n;
  const fill = Math.round(cell * v.water);
  const dividers = Array.from({ length: n - 1 }, (_, i) => Math.round(3 + cell * (i + 1) - 1));
  return `<div class="gauge" role="img" aria-label="물 ${v.water} / ${n}칸">
    <div class="gauge-track px px-cell px-surface">
      ${fill ? `<i class="gauge-water" style="width:${fill}px"></i>` : ''}
      ${dividers.map((x) => `<b class="gauge-div" style="left:${x}px"></b>`).join('')}
    </div>
    <span class="gauge-drop px px-round px-surface">${img(UI_IMG.droplet)}</span>
  </div>`;
}

function lessonItem(s, top) {
  const tone = s.weak ? 'accent' : s.cleared ? 'track' : 'surface';
  const right = s.weak ? '다시!' : `${s.solved}/${s.total}`;
  return `<button class="f-btn lesson px px-tile px-${tone}" data-sub="${s.sub.idx}" style="top:${top}px" aria-label="${s.sub.no} ${esc(s.sub.title)} · ${s.weak ? '다시 공부해요' : `${s.solved}/${s.total}문제`}">
    <span class="t-h2">${s.sub.no} ${esc(s.sub.title)}</span><small>${right}</small>
  </button>`;
}

function maxItem(v, top) {
  if (v.max.state === 'passed' || v.full) return `<div class="f-btn lesson max px px-tile px-red" style="top:${top}px"><span class="t-h2">MAX ✔</span><small>물이 가득해요</small></div>`;
  if (v.max.state === 'locked') return `<button class="f-btn lesson max px px-tile px-surface" data-max-locked style="top:${top}px"><span class="t-h2">🔒 MAX</span><small>주황 소단원을 다시 해요</small></button>`;
  return `<button class="f-btn lesson max px px-tile px-red" data-max style="top:${top}px"><span class="t-h2">MAX</span></button>`;
}

/** 소단원 팝업: 개념보기 / 문제풀기 (피그마 Popup Panel + Choice Card + Name Plate) */
function subPopup(ch, s) {
  return `<div class="f-popup" role="dialog" aria-modal="true" aria-label="${s.sub.no} ${esc(s.sub.title)}">
    <button class="f-scrim" data-close-sheet aria-label="닫기"></button>
    <div class="popup-panel px px-panel px-surface"></div>
    <button class="f-btn choice-card px px-tile px-surface" data-lesson="${s.sub.idx}" style="left:42px">${img(UI_IMG.book, '', 'cc-book')}<span class="t-h2">개념보기</span></button>
    <button class="f-btn choice-card px px-tile px-surface" data-start-sub="${s.sub.idx}" style="left:201px">${img(UI_IMG.pencil, '', 'cc-pencil')}<span class="t-h2">문제풀기</span></button>
    ${fPlate(`${s.sub.no} ${esc(s.sub.title)}`, 'popup-title')}
    <p class="popup-note t-caption">문제 ${s.total}개 · ${s.solved}개 풀었어요</p>
  </div>`;
}

function maxPopup(ch) {
  const n = ch.maxSet.length;
  return `<div class="f-popup" role="dialog" aria-modal="true" aria-label="MAX 도전">
    <button class="f-scrim" data-close-sheet aria-label="닫기"></button>
    <div class="popup-panel px px-panel px-surface" style="top:270px;height:330px"></div>
    ${fPlate('⚡ MAX 도전', 'popup-title', 'style="top:252px"')}
    <div class="max-text t-body" style="top:312px">
      <p>학교에서 이미 배운 내용이라면 ${ch.maxFromTextbook ? '교과서 문제' : '문제'} ${n}개를 풀고 한 번에 물을 채워요.</p>
      <p>🎯 ${n}문제 중 ${Math.ceil(n * MAX_PASS_RATE)}문제 이상 맞히면 통과!</p>
      <p>🔒 점수가 낮으면 다시 공부할 소단원을 알려 줘요.</p>
    </div>
    <button class="f-btn f-button px px-tile px-primary" data-start-max style="left:60px;top:520px;width:270px">MAX 도전하기</button>
  </div>`;
}

function screenUnit() {
  const ch = CHAPTER_BY_ID[State.chapterId];
  const v = Store.chapterGarden(ch.id);
  const next = STAGES[v.passCount + 2];
  // 물 주기 · 회독이 있으면 버튼 한 줄이 들어가서 목록이 아래로 내려가요.
  let cta = '';
  if (v.wilted) cta = `<button class="f-btn f-button cta px px-tile px-track" data-water="${ch.id}">💧 물 주기 (복습)</button>`;
  else if (v.canGrow) cta = `<button class="f-btn f-button cta px px-tile px-primary" data-grow="${ch.id}">✨ ${v.passCount + 1}회독 하고 ${STAGE_NAME[next]}로 키우기</button>`;
  const top0 = 378 + (cta ? 78 : 0);
  const items = v.subs.map((s, i) => lessonItem(s, top0 + 78 * i)).join('') + maxItem(v, top0 + 78 * v.subs.length);
  const end = top0 + 78 * (v.subs.length + 1);
  const h = Math.max(STAGE_H, end + 130);
  const fixedBar = h > STAGE_H;

  let popup = '';
  if (State.sheet && State.sheet.kind === 'sub' && v.subs[State.sheet.idx]) popup = subPopup(ch, v.subs[State.sheet.idx]);
  if (State.sheet && State.sheet.kind === 'max') popup = maxPopup(ch);

  return stageScreen({
    cls: `scr-unit ${fixedBar ? 'scroll' : ''}`,
    bg: 'meadow',
    sky: '#99c8eb',
    ground: '#97ba6e',
    h,
    body: `
      ${fRound('data-back="garden" style="left:16px;top:57px"', UI_IMG.back, '뒤로 가기')}
      ${fPlate(`${ch.label} ${esc(ch.title)}`, 'unit-name')}
      <div class="grow-now ${v.wilted ? 'wilt' : ''}">${img(UI_IMG.stage[v.stage], `지금 ${STAGE_NAME[v.stage]}`)}</div>
      ${v.wilted ? fPlate(`🥀 ${THIRSTY_BUBBLE}`, 'unit-bubble', `data-water="${ch.id}" style="left:110px;top:130px"`) : ''}
      ${
        next
          ? `<img src="${UI_IMG.arrow}" alt="" aria-hidden="true" class="grow-arrow">
             <div class="grow-next">${img(UI_IMG.stage[next], `다음 ${STAGE_NAME[next]}`)}</div>
             <img src="${UI_IMG.sparkle}" alt="" aria-hidden="true" class="sparkle s1"><img src="${UI_IMG.sparkle}" alt="" aria-hidden="true" class="sparkle s2">`
          : `<p class="grow-done t-h2">열매까지 다 키웠어요! 🎉</p>`
      }
      ${waterGauge(v)}
      ${cta}
      ${items}
      ${fixedBar ? '' : fTabbar('home')}
      ${popup}`,
    over: fixedBar ? `<div class="fixed-bottom"><div class="zoomed">${fTabbar('home')}</div></div>` : '',
  });
}

/* ------------------------------ 스크롤하면 흔들리는 잔디 ------------------------------ */
/**
 * 단원 길 화면 전체에 잔디 포기를 깔고, 스크롤하는 빠르기 · 방향만큼 휘었다가 용수철처럼 돌아와요.
 *  - 캔버스는 화면 크기 하나(고정)라 길이 길어도 가벼워요. 보이는 잔디만 그려요.
 *  - 하늘(지평선 위)에는 잔디를 그리지 않아요.
 *  - '움직이는 효과'를 끄거나 기기에서 '동작 줄이기'를 켜면 흔들리지 않고 서 있기만 해요.
 */
const ScrollGrass = {
  canvas: null,
  bend: 0,
  vel: 0,
  lastY: 0,
  lastT: 0,
  raf: 0,
  tufts: [],

  mount() {
    cancelAnimationFrame(this.raf);
    this.canvas = document.querySelector('.scroll-grass');
    if (!this.canvas) return;
    this.lastY = window.scrollY;
    this.lastT = performance.now();
    this.resize();
    this.draw();
  },

  resize() {
    const c = this.canvas;
    if (!c || !c.isConnected) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(window.innerWidth * dpr);
    c.height = Math.round(window.innerHeight * dpr);
    c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    // 잔디 자리: 무대 좌표가 아니라 화면 전체(양옆 포함)에 고르게. 문서 높이만큼 미리 정해 둬요.
    const stage = document.querySelector('.scr-garden .stage');
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const u = Stage.u;
    const horizon = top + 390 * u; // 지평선(361) 조금 아래부터
    const bottom = top + r.height;
    const gap = 46 * u;
    this.tufts = [];
    let k = 0;
    for (let y = horizon; y < bottom; y += gap * 0.62) {
      for (let x = ((k * 37) % 5) * 6 * u; x < window.innerWidth + gap; x += gap) {
        k++;
        const j = ((k * 9301 + 49297) % 233280) / 233280;
        this.tufts.push({ x: x + j * gap * 0.8, y: y + j * 14 * u, s: (0.8 + j * 0.6) * u, w: 0.6 + j * 0.8, dark: k % 3 === 0 });
      }
    }
    this.draw();
  },

  onScroll() {
    if (!this.canvas || !this.canvas.isConnected) return;
    const now = performance.now();
    const dy = window.scrollY - this.lastY;
    const dt = Math.max(8, now - this.lastT);
    this.lastY = window.scrollY;
    this.lastT = now;
    if (!motionAllowed()) return this.draw();
    // 아래로 스크롤하면 잔디가 위쪽(화면 기준 반대)으로 쓸려요. 빠를수록 세게.
    this.vel += Math.max(-0.08, Math.min(0.08, (dy / dt) * 0.02 * (document.body.dataset.anim === 'low' ? 0.5 : 1)));
    this.kick();
  },

  kick() {
    if (this.raf) return;
    let prev = performance.now();
    const step = (now) => {
      const dt = Math.min(40, now - prev);
      prev = now;
      // 용수철: 휘어진 만큼 돌아가려 하고, 조금씩 힘이 빠져요.
      this.vel += (-0.0016 * this.bend - 0.012 * this.vel) * dt;
      this.bend = Math.max(-0.9, Math.min(0.9, this.bend + this.vel * dt));
      this.draw();
      if (Math.abs(this.bend) > 0.002 || Math.abs(this.vel) > 0.0002) this.raf = requestAnimationFrame(step);
      else (this.raf = 0), (this.bend = 0), this.draw();
    };
    this.raf = requestAnimationFrame(step);
  },

  draw() {
    const c = this.canvas;
    if (!c || !c.isConnected) return;
    const g = c.getContext('2d');
    const H = window.innerHeight;
    g.clearRect(0, 0, window.innerWidth, H);
    const sy = window.scrollY;
    this.tufts.forEach((t) => {
      const y = t.y - sy;
      if (y < -30 || y > H + 30) return;
      const b = this.bend * t.w;
      const px = 3 * t.s; // 도트 한 칸
      g.fillStyle = t.dark ? '#5f8f3c' : '#79a94c';
      // 잎 세 장: 아래는 그대로, 위로 갈수록 휜 만큼 옆으로 밀려요 (도트처럼 한 칸씩)
      [[-2, 4], [0, 6], [2, 4]].forEach(([dx, hgt]) => {
        for (let i = 0; i < hgt; i++) {
          const off = Math.round((b * i * i) / hgt) * px * 0.5;
          g.fillRect(Math.round(t.x + dx * px + off), Math.round(y - i * px), px, px);
        }
      });
    });
  },
};
window.addEventListener('scroll', () => State.screen === 'garden' && ScrollGrass.onScroll(), { passive: true });
window.addEventListener('resize', () => State.screen === 'garden' && ScrollGrass.resize());
