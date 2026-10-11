/* =========================================================================
 * app.js — 화면 렌더링 및 흐름 제어
 *
 * 스플래시 → 로그인(학생 / 지도자 탭) · 회원가입
 *
 * 학생
 *   홈(과목 선택 들판) → 텃밭(단원 하나 = 밭 한 칸)
 *     → 소단원 학습(물 게이지 · 1-1 · 1-2 · 1-3 · MAX) → 팝업 → 개념 보기 / 문제 풀기 → 결과
 *   탭바(홈에서만): 게임 · 홈 · 채팅(chat.js)
 *   5분 동안 터치가 없으면 운동 시간(motion.js)
 *
 * 지도자 (학부모 · 선생님)
 *   학생 리스트(+ 학생 아이디로 추가) · 알림 · 문의하기
 *     → 학생 설정(집중력 환기 on/off) → 성과 리포트(이번 주 · 이번 달 · 올해)
 *
 * 텃밭 규칙 (store.js)
 *  - 공부를 시작하면 씨앗, 소단원을 모두 끝내면(1회독) 새싹.
 *  - 스스로 다시 공부(회독 퀴즈)하면 나무 → 열매로 자라요. 회독마다 문제가 바뀌어요.
 *  - 복습할 때가 되면 식물이 시들고 "물을 줘ㅠㅠ" 말풍선이 떠요.
 *    물 주기(복습)는 시든 식물을 원래대로 돌려놓기만 해요. 자라지는 않아요.
 *  - MAX: 학교에서 이미 배웠다면 교과서 문제 10개로 물을 한 번에 채워요.
 *
 * 화면에서 지킨 것
 *  - 타이머·카운트다운 없음. 문제 유형 · 난이도는 화면에 보여 주지 않아요.
 *  - 실패 표현을 순화하고 즉시 풀이를 보여 줘요.
 * ========================================================================= */

const app = document.getElementById('app');

/** 화면 상태 */
const State = {
  screen: 'splash',
  role: 'student', // 로그인 · 회원가입 화면의 탭
  subject: null,
  grade: null,
  chapterId: null,
  subIdx: null, // 개념 보기에서 보여 줄 소단원
  sheet: null, // 소단원 화면 위 팝업: { kind: 'sub', idx } | { kind: 'max' }
  gameId: null,
  chatWith: null, // 채팅방 상대
  // 지도자
  studentId: null,
  range: 'week', // 성과 리포트 기간
  adding: false, // 학생 추가 칸 열림
  // 문제 풀이 세션
  quiz: null, // { mode, sess, questions[], index, selected, checked, correct, hintOpen, hintUsed, results[], chapterId, sub, backTo, startedAt, before, outcome }
};

/** 로그인 없이 볼 수 있는 화면 */
const PUBLIC_SCREENS = ['splash', 'login', 'signup'];
/** 지도자 화면 */
const LEADER_SCREENS = ['leader', 'lstudent', 'report', 'notices', 'inquiry'];

const STAGE_NAME = { empty: '빈 밭', seed: '씨앗', sprout: '새싹', tree: '나무', fruit: '열매' };
const STAGE_ICON = { sprout: pxIcon('sprout'), tree: pxIcon('tree'), fruit: pxIcon('fruit') };
/** 복습할 때가 된 식물이 하는 말 */
const THIRSTY_BUBBLE = '물을 줘ㅠㅠ';

/* ------------------------------- 유틸 ------------------------------- */
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 줄바꿈 유지 */
const nl = (s) => esc(s).replace(/\n/g, '<br>');

let toastTimer;
function toast(msg, kind) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${kind || ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 3200);
}

function go(screen, patch) {
  State.sheet = null;
  Object.assign(State, patch || {});
  State.screen = screen;
  render();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/** 팝업만 열고 닫을 때는 스크롤을 그대로 둬요. */
function setSheet(sheet) {
  State.sheet = sheet;
  render();
}

/** 저장 동작을 감싸 저장 오류를 안내 */
function safely(fn) {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    toast(e.message || '문제가 생겼어요. 다시 시도해 주세요.', 'error');
    return { ok: false, error: e };
  }
}

/** 로그인한 뒤 첫 화면 */
function homeOf(user) {
  return user.role === 'leader' ? 'leader' : 'home';
}

/* ------------------------------ 그림 ------------------------------ */

/* 새싹 · 식물 · 아이콘 · 강 그림은 js/pixel.js에 있어요 (sproutLogo, plantSvg, pxIcon, pixelRiver). */

/** 물 게이지 칸 */
function waterCells(view) {
  return `<span class="cells" role="img" aria-label="물 ${view.water}칸 / ${view.subs.length}칸">
    ${view.subs.map((s) => `<i class="${s.cleared ? 'on' : ''}"></i>`).join('')}
  </span>`;
}

/* ------------------------------ 공통 조각 ------------------------------ */

/**
 * 상단 HUD
 * @param {object} o { back, name, title, rightPills[], logout }
 */
function hud(o) {
  const opts = o || {};
  let lead = `<span class="icon-btn" aria-hidden="true">${pxIcon('sprout')}</span>`;
  if (opts.back) lead = `<button class="icon-btn" data-back="${opts.back}" aria-label="뒤로 가기">←</button>`;
  else if (opts.name) lead = `<span class="hud-avatar" aria-hidden="true"><span>${esc([...opts.name][0] || '🌱')}</span></span>`;
  return `
    <header class="hud">
      ${lead}
      ${opts.title ? `<h1 class="hud-title">${opts.title}</h1>` : ''}
      <span class="hud-spacer"></span>
      ${(opts.rightPills || []).join('')}
      ${opts.logout ? `<button class="icon-btn" data-logout aria-label="로그아웃">${pxIcon('door')}</button>` : ''}
    </header>`;
}

function pill(kind, icon, text) {
  return `<span class="pill ${kind}"><span class="ico">${icon}</span>${esc(String(text))}</span>`;
}

/** 학생 탭바: 게임 · 홈 · 채팅 (복습은 텃밭의 물 주기로 합쳤어요) */
function tabbar(active) {
  const items = [
    { id: 'games', icon: pxIcon('game'), label: '게임' },
    { id: 'home', icon: pxIcon('home'), label: '홈' },
    { id: 'chat', icon: pxIcon('chat'), label: '채팅' },
  ];
  const unread = Chat.unread();
  return `
    <nav class="tabbar">
      ${items
        .map(
          (i) => `<button class="tab ${active === i.id ? 'active' : ''}" data-go="${i.id}">
            <span class="tab-icon">${i.icon}${i.id === 'chat' && unread ? `<span class="dot">${unread > 9 ? '9+' : unread}</span>` : ''}</span>
            <span class="tab-label">${i.label}</span>
          </button>`
        )
        .join('')}
    </nav>`;
}

/* ============================ 0. 스플래시 ============================ */
function screenSplash() {
  return `
    <button class="splash" data-skip aria-label="한걸음 시작하기">
      ${sproutLogo('splash-logo')}
      <h1>한걸음</h1>
      <p>천천히, 한 걸음씩 배워요</p>
    </button>`;
}

let splashTimer;
function leaveSplash() {
  clearTimeout(splashTimer);
  if (State.screen !== 'splash') return;
  const user = Store.currentUser();
  if (!user) return go('login');
  go(homeOf(user), { grade: user.grade });
}

/* ====================== 1. 로그인 · 2. 회원가입 ====================== */
function brand(title, sub) {
  return `
    <div class="brand">
      <div class="brand-logo">${sproutLogo()}</div>
      <h1>${title}</h1>
      <p>${sub}</p>
    </div>`;
}

/** 학생 / 지도자 탭 — 폼을 다시 그리지 않도록 라디오 버튼으로 만들었어요. */
function roleTabs() {
  return `
    <div class="role-tabs" role="radiogroup" aria-label="누구로 시작할까요?">
      <label><input type="radio" name="role" value="student" ${State.role === 'student' ? 'checked' : ''} /><span>학생으로</span></label>
      <label><input type="radio" name="role" value="leader" ${State.role === 'leader' ? 'checked' : ''} /><span>지도자로</span></label>
    </div>`;
}

function screenLogin() {
  return `
    <div class="auth-wrap">
      <div class="auth-card">
        ${brand('로그인', '천천히, 한 걸음씩 배워요')}
        <form id="login-form" class="form" novalidate>
          ${roleTabs()}
          <label class="field">
            <span>아이디</span>
            <input type="text" name="id" placeholder="아이디를 입력해 주세요" autocomplete="username" autocapitalize="none" />
          </label>
          <label class="field">
            <span>비밀번호</span>
            <input type="password" name="password" placeholder="비밀번호를 입력해 주세요" autocomplete="current-password" />
          </label>
          <p class="form-error" id="login-error" role="alert"></p>
          <button type="submit" class="btn btn-primary btn-lg btn-block">시작하기</button>
          <label class="check"><input type="checkbox" name="keep" /><span>로그인 상태 유지</span></label>
        </form>
        <button class="btn btn-ghost btn-block" data-go="signup">처음이신가요? 회원가입</button>
      </div>
    </div>`;
}

function screenSignup() {
  return `
    <div class="auth-wrap">
      <div class="auth-card">
        ${brand('회원가입', '학생과 지도자(학부모 · 선생님)는 따로 가입해요')}
        <form id="signup-form" class="form" novalidate>
          ${roleTabs()}
          <label class="field">
            <span>이름</span>
            <input type="text" name="name" placeholder="예: 김지우" maxlength="20" autocomplete="name" />
          </label>
          <label class="field">
            <span>생년월일</span>
            <input type="date" name="birth" max="${todayStr()}" />
          </label>
          <label class="field">
            <span>아이디 <small>(영어 소문자 · 숫자 4~20자)</small></span>
            <input type="text" name="id" placeholder="예: jiwoo12" maxlength="20" autocomplete="username" autocapitalize="none" />
          </label>
          <label class="field">
            <span>비밀번호</span>
            <input type="password" name="password" placeholder="4자 이상" autocomplete="new-password" />
          </label>
          <label class="field">
            <span>비밀번호 확인</span>
            <input type="password" name="password2" placeholder="한 번 더 입력" autocomplete="new-password" />
          </label>
          <div class="agree-box">
            <b>개인정보 수집 · 이용 안내</b>
            <p>이름 · 생년월일 · 아이디 · 학습 기록을 학습 지원과 성과 리포트에 써요.</p>
            <label class="check"><input type="checkbox" name="agree" /><span>개인정보 수집 · 이용에 동의해요</span></label>
          </div>
          <p class="form-error" id="signup-error" role="alert"></p>
          <button type="submit" class="btn btn-primary btn-lg btn-block">가입하고 시작하기</button>
        </form>
        <button class="btn btn-ghost btn-block" data-go="login">이미 계정이 있어요</button>
      </div>
    </div>`;
}

/* ========================= 3. 홈 (과목 선택 들판) ========================= */

/** 들판 위 새싹 장식 위치 (%) */
const WORLD_SPROUTS = [
  { left: 14, top: 20 }, { left: 88, top: 12 }, { left: 44, top: 9 }, { left: 90, top: 42 },
  { left: 10, top: 56 }, { left: 58, top: 88 }, { left: 86, top: 92 }, { left: 8, top: 90 },
];

function screenHome() {
  const user = Store.currentUser();
  const t = Store.todaySummary();
  const pos = { math: { left: 68, top: 27 }, korean: { left: 32, top: 72 } };
  const grade = State.grade || user.grade;

  const islands = SUBJECTS.map((s) => {
    const views = getChapters(s.id, grade).map((c) => Store.chapterGarden(c.id));
    const grown = views.filter((v) => v.passCount >= 1).length;
    const thirsty = views.filter((v) => v.wilted).length;
    return `<button class="island ${s.id}" data-subject="${s.id}" style="left:${pos[s.id].left}%;top:${pos[s.id].top}%">
      <span class="island-icon">${pxIcon(s.id)}</span>
      <span class="island-name">${s.name}</span>
      <span class="island-sub">${pxIcon('sprout')} ${grown} / ${views.length}</span>
      ${thirsty ? `<span class="island-thirsty">🥀 ${THIRSTY_BUBBLE}</span>` : ''}
    </button>`;
  }).join('');

  return `
    ${hud({
      name: user.name,
      title: esc(user.name),
      rightPills: [pill('ok', pxIcon('pencil'), t.solved), pill('fire', pxIcon('fire'), t.streak)],
      logout: true,
    })}
    <main class="page flush">
      <div class="world">
        ${pixelRiver()}
        ${WORLD_SPROUTS.map((d) => `<span class="world-deco" style="left:${d.left}%;top:${d.top}%">${sproutLogo()}</span>`).join('')}
        ${islands}
        <p class="world-hint">어느 밭으로 갈까요?</p>
      </div>
    </main>
    ${tabbar('home')}`;
}

/* ========================= 4. 텃밭 (단원 = 밭) ========================= */
function screenGarden() {
  const subject = getSubject(State.subject);
  const grade = State.grade;
  const views = getChapters(subject.id, grade).map((c) => Store.chapterGarden(c.id));
  const grown = views.filter((v) => v.passCount >= 1).length;

  const plots = views
    .map((v) => {
      const ch = v.chapter;
      return `<div class="plot ${v.wilted ? 'thirsty' : ''}">
        <button class="plot-btn" data-unit="${ch.id}"
                aria-label="${ch.label} ${esc(ch.title)} · ${STAGE_NAME[v.stage]}${v.wilted ? ' · 시들었어요' : ''} · 물 ${v.water}칸">
          <span class="plot-sign">${ch.label}</span>
          ${plantSvg(v.stage, `plot-plant ${v.wilted ? 'wilt' : ''}`)}
          <span class="plot-title">${esc(ch.title)}</span>
          ${waterCells(v)}
          ${v.canGrow ? `<span class="grow-tag">✨ 다시 공부하면 ${STAGE_NAME[STAGES[v.passCount + 2]]}!</span>` : ''}
        </button>
        ${v.wilted ? `<button class="bubble" data-water="${ch.id}" aria-label="${THIRSTY_BUBBLE} 물 주기(복습) 시작">${THIRSTY_BUBBLE}</button>` : ''}
      </div>`;
    })
    .join('');

  const legend = ['seed', 'sprout', 'tree', 'fruit']
    .map(
      (s, i) => `${i ? '<span class="legend-arrow">→</span>' : ''}
        <span class="legend-item">${plantSvg(s)}<b>${STAGE_NAME[s]}</b><small>${i ? `${i}회독` : '공부 시작'}</small></span>`
    )
    .join('');

  return `
    ${hud({
      back: 'home',
      title: `${pxIcon(subject.id)} ${subject.name} 텃밭`,
      rightPills: [pill('ok', pxIcon('sprout'), `${grown} / ${views.length}`)],
    })}
    <div class="grade-tabs">
      ${GRADES.map(
        (g) =>
          `<button class="gtab ${g === grade ? 'active' : ''} ${subject.id}" data-grade="${g}">${g}학년</button>`
      ).join('')}
    </div>
    <main class="page flush">
      <div class="garden">
        <p class="garden-hint">밭을 눌러 공부해요 · 시든 식물은 말풍선을 눌러 물을 줘요 ${pxIcon('drop')}</p>
        <div class="plots">${plots}</div>
        <div class="legend">${legend}</div>
        <span class="worm" aria-hidden="true">🪱</span>
      </div>
    </main>`;
}

/* ========================= 5. 소단원 학습 ========================= */

/** 물 게이지 아래 안내 문구 */
function growthNote(v) {
  const next = STAGE_NAME[STAGES[v.passCount + 2]];
  if (v.wilted) return '식물이 시들고 있어요. 물을 주면 다시 싱싱해져요!';
  if (v.stage === 'fruit') return '열매까지 모두 키웠어요! 🎉';
  if (v.passCount >= 1) {
    if (v.canGrow) return `스스로 다시 공부하면 ${next}로 자라요.`;
    return `${v.dueIn === 1 ? '내일' : `${v.dueIn}일 뒤`}부터 다시 공부하면 ${next}로 자라요.`;
  }
  return '소단원 하나를 끝낼 때마다 물이 한 칸 차요. 가득 차면 새싹이 나요!';
}

function maxButton(v) {
  if (v.max.state === 'passed') return `<div class="max-btn done"><b>MAX</b><span>통과! 물을 가득 채웠어요 ${pxIcon('drop')}</span></div>`;
  if (v.full) return `<div class="max-btn done"><b>MAX</b><span>소단원을 모두 끝내서 물이 가득해요 ${pxIcon('drop')}</span></div>`;
  if (v.max.state === 'locked') {
    return `<button class="max-btn locked" data-max-locked><b>🔒 MAX</b><span>빨갛게 표시된 소단원을 다시 공부하면 열려요</span></button>`;
  }
  return `<button class="max-btn" data-max><b>MAX</b><span>학교에서 이미 배웠나요? 한 번에 물 채우기!</span></button>`;
}

function subSheet(ch, s) {
  const subject = getSubject(ch.subject);
  return `
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${s.sub.no} ${esc(s.sub.title)}">
      <div class="sheet-tag ${subject.id}">${ch.grade}학년 ${subject.name} ${ch.label}</div>
      <button class="icon-btn sheet-close" data-close-sheet aria-label="닫기">✕</button>
      <h2>${esc(ch.title)}</h2>
      <p class="sheet-sub"><b>${s.sub.no}</b> ${esc(s.sub.title)} · 문제 ${s.total}개 · ${s.solved}개 풀었어요</p>
      <div class="sheet-preview ${subject.id}">${esc(s.sub.icon)}</div>
      <button class="btn btn-lg btn-block" data-lesson="${s.sub.idx}">📖 개념 보기</button>
      <button class="btn btn-primary btn-lg btn-block" style="margin-top:10px" data-start-sub="${s.sub.idx}">${pxIcon('pencil')} 문제 풀기</button>
    </section>`;
}

function maxSheet(ch) {
  const n = ch.maxSet.length;
  return `
    <section class="sheet" role="dialog" aria-modal="true" aria-label="MAX 도전">
      <div class="sheet-tag gold">${ch.label} MAX</div>
      <button class="icon-btn sheet-close" data-close-sheet aria-label="닫기">✕</button>
      <h2>⚡ MAX 도전</h2>
      <p class="sheet-sub">학교에서 이미 배운 내용이라면<br>${ch.maxFromTextbook ? '교과서 문제' : '문제'}를 풀고 소단원을 한 번에 건너뛰어요.</p>
      <div class="rowline"><span>🎯 문제</span><b>${ch.maxFromTextbook ? '교과서 문제 ' : ''}${n}문제 · 힌트 없음</b></div>
      <div class="rowline"><span>${pxIcon('drop')} 통과하면</span><b>${n}문제 중 ${Math.ceil(n * MAX_PASS_RATE)}문제 이상 → 물 가득</b></div>
      <div class="rowline"><span>🔒 점수가 낮으면</span><b>다시 공부할 소단원을 알려 줘요</b></div>
      <button class="btn btn-gold btn-lg btn-block" style="margin-top:14px" data-start-max>MAX 도전하기</button>
    </section>`;
}

function screenUnit() {
  const ch = CHAPTER_BY_ID[State.chapterId];
  const v = Store.chapterGarden(ch.id);
  const nextStage = STAGES[v.passCount + 2];

  let sheet = '';
  if (State.sheet && State.sheet.kind === 'sub' && v.subs[State.sheet.idx]) sheet = subSheet(ch, v.subs[State.sheet.idx]);
  if (State.sheet && State.sheet.kind === 'max') sheet = maxSheet(ch);

  let cta = '';
  if (v.wilted) {
    cta = `<button class="btn btn-water btn-lg btn-block" data-water="${ch.id}">${pxIcon('drop')} 물 주기 (복습)</button>`;
  } else if (v.canGrow) {
    cta = `<button class="btn btn-gold btn-lg btn-block" data-grow="${ch.id}">
      ${STAGE_ICON[nextStage]} ${v.passCount + 1}회독 하고 ${STAGE_NAME[nextStage]}로 키우기
    </button>`;
  }

  return `
    <div class="scene">
      <header class="scene-top">
        <button class="round-btn" data-back="garden" aria-label="뒤로 가기">‹</button>
        <h1>${ch.label} · ${esc(ch.title)}</h1>
      </header>

      <div class="scene-plants">
        <figure class="${v.wilted ? 'thirsty' : ''}">
          ${plantSvg(v.stage, v.wilted ? 'wilt' : '')}
          <figcaption>${STAGE_NAME[v.stage]}${v.passCount ? ` · ${v.passCount}회독` : ''}</figcaption>
          ${v.wilted ? `<span class="bubble still">${THIRSTY_BUBBLE}</span>` : ''}
        </figure>
        ${
          nextStage
            ? `<span class="scene-arrow" aria-hidden="true">➜</span>
               <figure class="next">${plantSvg(nextStage)}<figcaption>${STAGE_NAME[nextStage]}</figcaption></figure>`
            : ''
        }
      </div>

      <div class="scene-gauge">${waterCells(v)}<span class="drop" aria-hidden="true">${pxIcon('drop')}</span></div>
      <p class="scene-note">${growthNote(v)}</p>

      <main class="scene-ground">
        ${cta}
        ${v.subs
          .map(
            (s) => `<button class="sub-btn ${s.cleared ? 'cleared' : ''} ${s.weak ? 'weak' : ''}" data-sub="${s.sub.idx}">
              <b>${s.sub.no}</b>
              <span>${esc(s.sub.title)}</span>
              <small>${s.weak ? '다시 공부해요!' : `${s.solved} / ${s.total}`}</small>
            </button>`
          )
          .join('')}
        ${maxButton(v)}
      </main>
    </div>
    ${sheet ? `<div class="overlay" data-backdrop>${sheet}</div>` : ''}`;
}

/* ========================== 6. 개념 학습 ========================== */
function screenLesson() {
  const ch = CHAPTER_BY_ID[State.chapterId];
  const subject = getSubject(ch.subject);
  const s = ch.subunits[State.subIdx] || ch.subunits[0];
  const card = (c, i) => `<div class="concept-card ${i === s.idx ? 'focus' : ''}">
      <div class="cc-icon">${esc(c.icon)}</div>
      <div class="cc-body">
        ${i === s.idx ? '<span class="focus-tag">지금 배울 내용</span>' : ''}
        <strong>${esc(c.title)}</strong>
        <p>${nl(c.text)}</p>
      </div>
    </div>`;
  const others = ch.concept.cards.map((c, i) => (i === s.idx ? '' : card(c, i))).join('');

  return `
    ${hud({ back: 'unit', title: `${s.no} ${esc(s.title)}` })}
    <main class="page">
      <section class="concept-hero ${subject.theme}">
        <div class="concept-emoji">${ch.icon}</div>
        <span class="hero-tag">${ch.grade}학년 ${subject.name} ${ch.label}</span>
        <h2>${esc(ch.title)}</h2>
        <p>${esc(ch.concept.summary)}</p>
      </section>

      <div class="concept-cards">
        ${card(ch.concept.cards[s.idx], s.idx)}
      </div>
      <h3 class="section-title small">이 단원의 다른 내용</h3>
      <div class="concept-cards">${others}</div>

      <button class="btn btn-primary btn-lg btn-block" data-start-sub="${s.idx}">${pxIcon('pencil')} ${s.no} 문제 풀기</button>
    </main>`;
}

/* ========================== 7. 문제 풀기 ========================== */
function startQuiz(mode, questions, opts) {
  if (!questions.length) {
    toast('풀 수 있는 문제가 없어요.', 'error');
    return;
  }
  const o = opts || {};
  go('quiz', {
    chapterId: o.chapterId,
    quiz: {
      mode,
      sess: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      chapterId: o.chapterId,
      sub: o.sub !== undefined ? o.sub : null,
      backTo: o.backTo || 'unit',
      questions,
      index: 0,
      selected: null,
      checked: false,
      correct: false,
      hintOpen: false,
      hintUsed: false,
      results: [],
      startedAt: Date.now(),
      before: Store.chapterGarden(o.chapterId),
      outcome: null,
    },
  });
}

function quizTitle(q) {
  if (q.mode === 'review') return `${pxIcon('drop')} 물 주기`;
  if (q.mode === 'max') return '⚡ MAX 도전';
  if (q.mode === 'pass') return `${STAGE_ICON[STAGES[q.before.passCount + 2]] || pxIcon('sprout')} ${q.before.passCount + 1}회독`;
  const s = CHAPTER_BY_ID[q.chapterId].subunits[q.sub];
  return `${s.no} ${esc(s.title)}`;
}

/** 진행 칸: 문제마다 한 칸. 답을 확인하면 한 칸이 차요. */
function quizCells(q) {
  return `<div class="qcells" role="img" aria-label="${q.questions.length}문제 중 ${q.index + 1}번째">
    ${q.questions.map((_, i) => `<i class="${i < q.results.length ? 'on' : ''} ${i === q.index ? 'now' : ''}"></i>`).join('')}
  </div>`;
}

function screenQuiz() {
  const q = State.quiz;
  const item = q.questions[q.index];
  const total = q.questions.length;
  // MAX는 이미 배운 내용을 확인하는 시험이라 힌트를 숨겨요.
  const hintAllowed = q.mode !== 'max' && !!item.hint;
  // 선택지가 모두 짧으면 두 칸씩 크게, 길면 한 줄에 하나씩 보여 줘요.
  const grid = item.choices.every((c) => [...c].length <= 9 && c.indexOf('\n') < 0);

  return `
    <div class="scene quiz-scene">
      <header class="scene-top">
        <button class="round-btn" data-back="${q.backTo}" aria-label="그만하고 돌아가기">‹</button>
        ${quizCells(q)}
      </header>
      <p class="quiz-title">${quizTitle(q)} · ${q.index + 1} / ${total}</p>

      <section class="question-card">
        ${item.visual ? `<div class="visual">${nl(item.visual)}</div>` : ''}
        <p class="question-text">${nl(item.text)}</p>
        ${item.steps ? `<ol class="steps">${item.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      </section>

      <main class="scene-ground">
        ${
          !hintAllowed
            ? ''
            : q.hintOpen
            ? `<div class="hint-box"><span class="hint-icon">💡</span><p>${nl(item.hint)}</p></div>`
            : `<button class="btn-hint" data-hint>💡 힌트</button>`
        }

        <div class="choices ${grid ? 'grid' : ''}">
          ${item.choices
            .map((c, i) => {
              let cls = `choice c${i % 4}`;
              if (q.checked) {
                if (i === item.answer) cls += ' correct';
                else if (i === q.selected) cls += ' wrong';
                else cls += ' dim';
              } else if (q.selected === i) cls += ' selected';
              const mark = q.checked ? (i === item.answer ? '⭕' : i === q.selected ? '❌' : '') : q.selected === i ? '👆' : '';
              return `<button class="${cls}" data-choice="${i}" ${q.checked ? 'disabled' : ''}>
                        <span class="choice-text">${nl(c)}</span>
                        ${mark ? `<span class="choice-mark">${mark}</span>` : ''}
                      </button>`;
            })
            .join('')}
        </div>

        ${
          q.checked
            ? `<section class="feedback ${q.correct ? '' : 'no'}">
                <div class="fb-head">${q.correct ? '🎉 정답이에요!' : '💪 괜찮아요, 같이 봐요'}</div>
                <div class="fb-body">
                  <strong>📖 풀이</strong>
                  <p>${nl(item.solution)}</p>
                </div>
                ${!q.correct && q.mode !== 'max' ? `<div class="fb-note">${pxIcon('drop')} 이 문제는 다음에 물 줄 때 다시 만나요!</div>` : ''}
              </section>
              <button class="btn btn-primary btn-lg btn-block" data-next>
                ${q.index + 1 < total ? '다음 문제 →' : '마치기 🎉'}
              </button>`
            : `<button class="btn btn-primary btn-lg btn-block" data-submit ${q.selected === null ? 'disabled' : ''}>
                ${q.selected === null ? '답을 골라 주세요' : '답 고르기 완료!'}
              </button>`
        }
      </main>
    </div>`;
}

function submitAnswer() {
  const q = State.quiz;
  const item = q.questions[q.index];
  if (q.selected === null || q.checked) return;

  const correct = q.selected === item.answer;
  const res = safely(() => Store.recordAnswer(item, correct, { mode: q.mode, hint: q.hintUsed, sess: q.sess }));
  if (!res.ok) return; // 저장 실패 시 진행하지 않음

  q.checked = true;
  q.correct = correct;
  q.results.push({ qid: item.id, correct });
  render();
}

function nextQuestion() {
  const q = State.quiz;
  if (q.index + 1 < q.questions.length) {
    q.index += 1;
    q.selected = null;
    q.checked = false;
    q.correct = false;
    q.hintOpen = false;
    q.hintUsed = false;
    render();
    window.scrollTo({ top: 0 });
    return;
  }
  // 세션 끝: 텃밭에 반영
  const res = safely(() => Store.finishSession({ mode: q.mode, chapterId: q.chapterId, sub: q.sub, results: q.results }));
  if (res.ok) q.outcome = res.value;
  go('result');
}

/* ========================== 8. 결과 화면 ========================== */

/** 결과 제목 · 부제 — 무엇이 바뀌었는지를 가장 먼저 알려 줘요. */
function resultHeadline(q, before, after) {
  const max = q.outcome && q.outcome.max;
  if (max && max.passed) return ['⚡ MAX 통과!', '물이 한 번에 가득 찼어요'];
  if (max) return ['조금만 더 공부해요', '다시 공부할 소단원을 표시해 뒀어요'];
  const watered = after.water > before.water;
  if (after.stage === 'seed' && before.stage === 'empty' && watered) {
    return [`${pxIcon('drop')} 씨앗을 심고 물을 줬어요!`, `물 ${after.water} / ${after.subs.length}칸 · 가득 채우면 새싹이 나요`];
  }
  if (after.stage !== before.stage) {
    return {
      seed: ['씨앗을 심었어요!', '소단원을 끝낼 때마다 물을 줄 수 있어요'],
      sprout: [`${pxIcon('sprout')} 새싹이 났어요!`, '물이 가득 찼어요 · 1회독 완료'],
      tree: ['🌳 나무로 자랐어요!', '스스로 다시 공부했어요 · 2회독 완료'],
      fruit: ['🍎 열매가 열렸어요!', '3회독 완료 · 단원을 끝까지 키웠어요'],
    }[after.stage];
  }
  if (q.mode === 'review') {
    return after.wilted ? [`${pxIcon('drop')} 물을 줬어요!`, '조금 더 주면 다 살아나요'] : [`${pxIcon('drop')} 다시 싱싱해졌어요!`, '시든 식물이 원래대로 돌아왔어요'];
  }
  if (watered) return [`${pxIcon('drop')} 물을 줬어요!`, `물 ${after.water} / ${after.subs.length}칸`];
  return ['잘했어요!', ''];
}

function screenResult() {
  const q = State.quiz;
  const correct = q.results.filter((r) => r.correct).length;
  const total = q.results.length;
  const wrong = total - correct;
  const chapter = CHAPTER_BY_ID[q.chapterId];
  const before = q.before;
  const after = (q.outcome && q.outcome.after) || Store.chapterGarden(chapter.id);
  const max = q.outcome && q.outcome.max;
  const minutes = Math.max(1, Math.round((Date.now() - q.startedAt) / 60000));
  const [title, sub] = resultHeadline(q, before, after);

  const week = Store.weekStudy()
    .map((d) => `<i class="${d.studied ? 'on' : ''} ${d.isToday ? 'today' : ''}">${d.studied && d.isToday ? `${pxIcon('fire')}` : d.label}</i>`)
    .join('');

  let actions = '';
  if (max && !max.passed) {
    actions = `<button class="btn btn-primary btn-lg btn-block" data-go="unit">${pxIcon('pencil')} 표시된 소단원 공부하러 가기</button>`;
  } else if (q.mode === 'sub') {
    actions = `
      <button class="btn btn-gold btn-lg btn-block" data-start-sub="${q.sub}">한 번 더 풀기 🔁</button>
      <button class="btn btn-primary btn-lg btn-block" data-go="unit">${pxIcon('drop')} 소단원으로</button>`;
  } else {
    actions = `<button class="btn btn-primary btn-lg btn-block" data-go="garden">${pxIcon('sprout')} 텃밭으로</button>`;
  }

  return `
    <main class="page flush result">
      <span class="confetti" style="top:12px;left:26px">🎊</span>
      <span class="confetti" style="top:30px;right:34px">✨</span>
      <span class="confetti" style="top:74px;left:58px;font-size:16px">🎉</span>
      <span class="confetti" style="top:60px;right:70px;font-size:16px">✨</span>

      <h2>${title}</h2>
      <p class="result-sub">${chapter.icon} ${chapter.label} ${esc(chapter.title)}${sub ? ` · ${sub}` : ''}</p>

      <div class="result-plant">${plantSvg(after.stage, after.wilted ? 'wilt' : '')}</div>
      <div class="gauge result-gauge"><span class="drop" aria-hidden="true">${pxIcon('drop')}</span>${waterCells(after)}</div>

      ${
        max && !max.passed
          ? `<div class="reward-bar red">
              <span>🔒 MAX가 잠겼어요.<br>아래 소단원을 다시 공부하면 열려요.</span>
            </div>
            <div class="weak-chips">
              ${max.weak.map((i) => `<span class="weak-chip">${chapter.subunits[i].no} ${esc(chapter.subunits[i].title)}</span>`).join('')}
            </div>`
          : ''
      }

      <div class="stat-row" style="margin-top:14px">
        <div class="stat"><div class="stat-num">${correct} / ${total}</div><div class="stat-label">맞힌 문제</div></div>
        <div class="stat"><div class="stat-num">${minutes}분</div><div class="stat-label">걸린 시간</div></div>
      </div>

      ${
        wrong
          ? `<div class="reward-bar blue"><span>${pxIcon('drop')} 틀린 ${wrong}문제는 다음에 물 줄 때 다시 만나요</span></div>`
          : `<div class="reward-bar blue"><span>✨ 하나도 틀리지 않았어요!</span></div>`
      }

      <div class="streak-strip">${week}</div>
      <p class="muted-note" style="margin:8px 0 0;font-size:14px">${Store.streak()}일 연속 학습 중이에요!</p>

      <div class="result-actions btn-col">
        ${actions}
        <button class="btn btn-block" data-go="home">${pxIcon('home')} 홈으로</button>
      </div>
    </main>`;
}

/* ========================== 9. 게임 ========================== */

/** 게임 목록 — games/ 폴더에 게임을 넣고 여기에 한 줄 더하면 돼요. */
const GAMES = [
  { id: 'bus', icon: '🚌', name: '버스 타기 국어', desc: '정류장 이름 만들기', src: 'games/bus/index.html' },
  { id: 'dodgeball', icon: '🤾', name: '피구 뺄셈', desc: '남은 친구 세기', src: 'games/dodgeball/index.html' },
];

function screenGames() {
  return `
    ${hud({ title: `${pxIcon('game')} 게임`, rightPills: [pill('fire', pxIcon('fire'), Store.streak())], logout: true })}
    <main class="page">
      <h2 class="games-ask">무슨 게임을 해볼까요?</h2>
      <div class="game-grid">
        ${GAMES.map(
          (g) => `<button class="game-card" data-game="${g.id}">
            <span class="game-thumb" aria-hidden="true">${g.icon}</span>
            <strong>${g.name}</strong>
            <small>${g.desc}</small>
          </button>`
        ).join('')}
        <div class="game-card empty" aria-hidden="true"><span class="game-thumb">⋯</span><strong>더 생겨요</strong></div>
      </div>
    </main>
    ${tabbar('games')}`;
}

function screenPlay() {
  const g = GAMES.find((x) => x.id === State.gameId);
  return `
    ${hud({ back: 'games', title: `${g.icon} ${g.name}` })}
    <iframe class="game-frame" src="${g.src}" title="${g.name}"></iframe>`;
}

/* ========================== 10. 지도자: 학생 리스트 ========================== */
function leaderRow(o) {
  return `<button class="set-row" ${o.attr}>
    <span class="set-ico" aria-hidden="true">${o.icon}</span>
    <span class="set-body"><strong>${o.title}</strong>${o.sub ? `<small>${o.sub}</small>` : ''}</span>
    ${o.badge ? `<span class="set-badge">${o.badge}</span>` : ''}
    <span class="set-go" aria-hidden="true">›</span>
  </button>`;
}

function screenLeader() {
  const user = Store.currentUser();
  const students = Store.leaderStudents();
  const notices = Store.leaderNotices();

  return `
    ${hud({ name: user.name, title: `${esc(user.name)} 지도자님`, logout: true })}
    <main class="page settings">
      <h3 class="set-title">학생 리스트</h3>
      <div class="set-group">
        ${students
          .map((s) =>
            leaderRow({ attr: `data-student="${esc(s.id)}"`, icon: esc([...s.name][0]), title: esc(s.name), sub: `아이디 ${esc(s.id)} · ${s.grade}학년` })
          )
          .join('')}
        ${
          State.adding
            ? `<form id="add-student-form" class="set-add" novalidate>
                <input type="text" name="id" placeholder="학생 아이디" aria-label="학생 아이디" autocapitalize="none" autocomplete="off" />
                <button type="submit" class="btn btn-primary">추가</button>
                <button type="button" class="btn" data-add-cancel>취소</button>
              </form>`
            : `<button class="set-row add" data-add-open><span class="set-ico" aria-hidden="true">＋</span><span class="set-body"><strong>학생 아이디로 추가하기</strong></span></button>`
        }
      </div>
      ${students.length ? '' : '<p class="set-help">학생이 먼저 <b>학생으로</b> 회원가입한 뒤, 그 아이디를 여기에 넣어 주세요.<br>한 지도자가 여러 학생을 맡을 수 있어요.</p>'}

      <h3 class="set-title">더 보기</h3>
      <div class="set-group">
        ${leaderRow({ attr: 'data-go="notices"', icon: '🔔', title: '알림', badge: notices.length || '' })}
        ${leaderRow({ attr: 'data-go="inquiry"', icon: '✉️', title: '문의하기' })}
      </div>
    </main>`;
}

/* ========================== 11. 지도자: 학생 설정 ========================== */
function screenLeaderStudent() {
  const s = Store.myStudent(State.studentId);
  return `
    ${hud({ back: 'leader', title: `${esc(s.name)} 설정` })}
    <main class="page settings">
      <div class="set-group">
        <label class="set-row">
          <span class="set-ico" aria-hidden="true">🤸</span>
          <span class="set-body"><strong>집중력 환기(운동) 기능</strong><small>5분 동안 터치가 없으면 새싹 친구가 운동을 권해요</small></span>
          <input type="checkbox" class="switch" data-motion-toggle ${s.motion ? 'checked' : ''} aria-label="집중력 환기 기능 켜기" />
        </label>
        ${leaderRow({ attr: 'data-go="report"', icon: '📈', title: '성과 리포트', sub: '이번 주 · 이번 달 · 올해' })}
      </div>

      <div class="set-group">
        <button class="set-row danger" data-remove-student><span class="set-ico" aria-hidden="true">➖</span><span class="set-body"><strong>학생 목록에서 빼기</strong><small>학생의 학습 기록은 지워지지 않아요</small></span></button>
      </div>
      <p class="set-help">아이디 ${esc(s.id)} · ${s.grade}학년${s.birth ? ` · ${esc(s.birth)} 출생` : ''}</p>
    </main>`;
}

/* ========================== 12. 지도자: 성과 리포트 ========================== */

/** 지난 기간과의 차이 표시. goodUp: 오르면 좋은 값인지 */
function deltaTag(d, unit, goodUp) {
  if (d === null) return '<span class="delta flat">지난 기간 기록 없음</span>';
  if (d === 0) return '<span class="delta flat">지난 기간과 같아요</span>';
  const good = d > 0 === goodUp;
  return `<span class="delta ${good ? 'good' : 'soft'}">${d > 0 ? '↑' : '↓'} ${Math.abs(d)}${unit}</span>`;
}

/** 독립 해결률 선 그래프 (기록이 있는 칸만 점을 찍고 이어요) */
function soloChart(graph) {
  const W = 320, H = 210, L = 38, R = 12, T = 12, B = 30;
  const x = (i) => L + (graph.length === 1 ? 0 : (i * (W - L - R)) / (graph.length - 1));
  const y = (v) => T + ((100 - v) * (H - T - B)) / 100;
  const pts = graph.map((g, i) => (g.value === null ? null : { x: x(i), y: y(g.value), v: g.value })).filter(Boolean);
  const grid = [0, 25, 50, 75, 100]
    .map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`)
    .join('');
  const step = graph.length > 7 ? 2 : 1; // 12달은 한 달 건너 하나씩 써요.
  const labels = graph.map((g, i) => (i % step ? '' : `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${g.label}</text>`)).join('');
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="독립 해결률 변화 그래프: ${graph.filter((g) => g.value !== null).map((g) => `${g.label} ${g.value}%`).join(', ') || '기록 없음'}">
      ${grid}${labels}
      ${pts.length > 1 ? `<polyline class="line" points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}"/>` : ''}
      ${pts.map((p) => `<circle class="pt" cx="${p.x}" cy="${p.y}" r="4"><title>${p.v}%</title></circle>`).join('')}
    </svg>`;
}

function screenReport() {
  const r = Store.report(State.studentId, State.range);
  const ranges = [['week', '이번 주'], ['month', '이번 달'], ['year', '올해']];
  const rangeName = ranges.find((x) => x[0] === r.range)[1];

  return `
    ${hud({ back: 'lstudent', title: `${esc(r.student.name)}의 성과 리포트` })}
    <main class="page report">
      <div class="seg" role="tablist">
        ${ranges.map(([id, name]) => `<button role="tab" aria-selected="${id === r.range}" class="${id === r.range ? 'on' : ''}" data-range="${id}">${name}</button>`).join('')}
      </div>

      <section class="rp-card">
        <small>학습 성과 요약</small>
        <h2>${r.headline[0]}</h2>
        <p>${r.headline[1]}</p>
        <div class="rp-stats">
          <div class="rp-stat">
            <span>독립 해결률</span>
            <b>${r.solo === null ? '-' : `${r.solo}%`}</b>
            ${deltaTag(r.delta.solo, '%p', true)}
          </div>
          <div class="rp-stat">
            <span>평균 힌트 사용</span>
            <b>${r.hintAvg === null ? '-' : `${r.hintAvg}회`}</b>
            ${deltaTag(r.delta.hintAvg, '회', false)}
          </div>
        </div>
        <p class="rp-foot">독립 해결률 = 힌트 없이 첫 시도에 맞힌 문제 ÷ 푼 문제 · 평균 힌트 = 소단원을 한 번 풀 때 본 힌트 수</p>
      </section>

      <section class="rp-card">
        <h3>유형별 성취도</h3>
        <div class="rp-types">
          ${r.types.map((t) => `<div><b>${t.value === null ? '-' : `${t.value}%`}</b><span>${t.type.name}</span></div>`).join('')}
        </div>
      </section>

      <section class="rp-card">
        <h3>독립 해결률 변화</h3>
        ${soloChart(r.graph)}
      </section>

      <section class="rp-card">
        <h3>${rangeName} 성장 포인트</h3>
        ${
          r.points.length
            ? `<ul class="rp-points">${r.points.map((p) => `<li><span aria-hidden="true">${p.icon}</span><div><strong>${p.title}</strong><p>${p.text}</p></div></li>`).join('')}</ul>`
            : '<p class="rp-empty">이 기간에 푼 문제가 아직 없어요.</p>'
        }
      </section>
    </main>`;
}

/* ========================== 13. 지도자: 알림 · 문의하기 ========================== */
function screenNotices() {
  const list = Store.leaderNotices();
  return `
    ${hud({ back: 'leader', title: '🔔 알림' })}
    <main class="page settings">
      ${
        list.length
          ? `<div class="set-group">${list
              .map((n) => `<button class="set-row" data-student="${esc(n.id)}"><span class="set-ico" aria-hidden="true">${n.icon}</span><span class="set-body"><strong>${esc(n.text)}</strong></span><span class="set-go" aria-hidden="true">›</span></button>`)
              .join('')}</div>`
          : `<div class="empty big"><div class="empty-icon">🔔</div><h2>새 알림이 없어요</h2><p>학생을 추가하면 학습 소식을 여기서 알려 드려요.</p></div>`
      }
    </main>`;
}

function screenInquiry() {
  const sent = Store.myInquiries();
  return `
    ${hud({ back: 'leader', title: '✉️ 문의하기' })}
    <main class="page settings">
      <form id="inquiry-form" class="form" novalidate>
        <label class="field">
          <span>궁금한 점이나 불편한 점을 적어 주세요</span>
          <textarea name="text" rows="5" maxlength="500" placeholder="예: 학생 학년을 바꾸고 싶어요."></textarea>
        </label>
        <button type="submit" class="btn btn-primary btn-lg btn-block">문의 남기기</button>
      </form>
      <p class="set-help">베타 테스트 중이라 문의는 이 기기에 저장돼요. 운영진이 기기를 확인할 때 함께 살펴봐요.</p>
      ${
        sent.length
          ? `<h3 class="set-title">남긴 문의</h3>
             <div class="set-group">${sent
               .map((q) => `<div class="set-row static"><span class="set-body"><strong>${nl(q.text)}</strong><small>${todayStr(new Date(q.at))}</small></span></div>`)
               .join('')}</div>`
          : ''
      }
    </main>`;
}

/* ============================== 렌더 ============================== */
function render() {
  const user = Store.currentUser();

  // 접근 제어
  if (!user && !PUBLIC_SCREENS.includes(State.screen)) State.screen = 'login';
  if (user && user.role === 'leader' && !LEADER_SCREENS.includes(State.screen) && !PUBLIC_SCREENS.includes(State.screen)) State.screen = 'leader';
  if (user && user.role === 'student' && LEADER_SCREENS.includes(State.screen)) State.screen = 'home';
  if (['lstudent', 'report'].includes(State.screen) && !Store.myStudent(State.studentId)) State.screen = 'leader';
  if (['unit', 'lesson'].includes(State.screen) && !CHAPTER_BY_ID[State.chapterId]) State.screen = 'home';
  if (State.screen === 'garden' && !State.subject) State.screen = 'home';
  if (['quiz', 'result'].includes(State.screen) && !State.quiz) State.screen = 'home';
  if (State.screen === 'play' && !GAMES.some((g) => g.id === State.gameId)) State.screen = 'games';
  if (State.screen === 'chatroom' && !Store.allStudents().some((s) => s.id === State.chatWith)) State.screen = 'chat';
  if (user && user.role === 'student' && !State.grade) State.grade = user.grade;

  const views = {
    splash: screenSplash,
    login: screenLogin,
    signup: screenSignup,
    home: screenHome,
    garden: screenGarden,
    unit: screenUnit,
    lesson: screenLesson,
    quiz: screenQuiz,
    result: screenResult,
    games: screenGames,
    play: screenPlay,
    chat: () => Chat.listView(),
    chatroom: () => Chat.roomView(),
    leader: screenLeader,
    lstudent: screenLeaderStudent,
    report: screenReport,
    notices: screenNotices,
    inquiry: screenInquiry,
  };

  app.innerHTML = (views[State.screen] || screenHome)();
  app.className = `screen-${State.screen}`;
  Chat.afterRender(State.screen);
  Motion.afterRender(State.screen);
}

/* ============================ 이벤트 처리 ============================ */
function currentChapter() {
  return CHAPTER_BY_ID[State.chapterId];
}

app.addEventListener('click', (ev) => {
  // 팝업 바깥(어두운 배경)을 누르면 닫혀요.
  if (ev.target.hasAttribute && ev.target.hasAttribute('data-backdrop')) return setSheet(null);

  const el = ev.target.closest(
    '[data-skip],[data-go],[data-back],[data-subject],[data-grade],[data-unit],[data-grow],[data-water],' +
      '[data-sub],[data-max],[data-max-locked],[data-start-max],[data-close-sheet],[data-lesson],[data-start-sub],' +
      '[data-choice],[data-submit],[data-next],[data-hint],[data-logout],[data-game],[data-chat-with],' +
      '[data-student],[data-add-open],[data-add-cancel],[data-remove-student],[data-range]'
  );
  if (!el) return;

  if (el.hasAttribute('data-skip')) return leaveSplash();

  // --- 이동 ---
  if (el.dataset.go) return go(el.dataset.go, { adding: false });
  if (el.dataset.back) {
    // 개념 보기에서 뒤로 가면 보던 소단원 팝업을 다시 열어 줘요.
    if (State.screen === 'lesson' && el.dataset.back === 'unit') {
      return go('unit', { sheet: { kind: 'sub', idx: State.subIdx } });
    }
    return go(el.dataset.back, { adding: false });
  }

  if (el.hasAttribute('data-logout')) {
    safely(() => Store.logOut());
    return go('login', { grade: null, subject: null, quiz: null, studentId: null });
  }

  if (el.dataset.game) return go('play', { gameId: el.dataset.game });
  if (el.dataset.chatWith) return go('chatroom', { chatWith: el.dataset.chatWith });

  // --- 지도자 ---
  if (el.dataset.student) return go('lstudent', { studentId: el.dataset.student });
  if (el.hasAttribute('data-add-open')) {
    State.adding = true;
    render();
    const input = document.querySelector('#add-student-form input');
    return input && input.focus();
  }
  if (el.hasAttribute('data-add-cancel')) {
    State.adding = false;
    return render();
  }
  if (el.hasAttribute('data-remove-student')) {
    if (!confirm('이 학생을 내 학생 목록에서 뺄까요? 학습 기록은 지워지지 않아요.')) return;
    safely(() => Store.removeStudent(State.studentId));
    return go('leader');
  }
  if (el.dataset.range) {
    State.range = el.dataset.range;
    return render();
  }

  // --- 과목 · 학년 · 단원 ---
  if (el.dataset.subject) return go('garden', { subject: el.dataset.subject });
  if (el.dataset.grade) return go('garden', { grade: Number(el.dataset.grade) });
  if (el.dataset.unit) return go('unit', { chapterId: el.dataset.unit });

  // 물 주기(복습): 시든 식물을 원래대로
  if (el.dataset.water) {
    const id = el.dataset.water;
    return startQuiz('review', Store.reviewQuestions(id), { chapterId: id, backTo: State.screen === 'garden' ? 'garden' : 'unit' });
  }
  // 회독: 스스로 다시 공부해서 한 단계 키우기
  if (el.dataset.grow) {
    const id = el.dataset.grow;
    return startQuiz('pass', Store.passQuestions(id), { chapterId: id });
  }

  // --- 소단원 화면 팝업 ---
  if (el.dataset.sub !== undefined) return setSheet({ kind: 'sub', idx: Number(el.dataset.sub) });
  if (el.hasAttribute('data-max')) return setSheet({ kind: 'max' });
  if (el.hasAttribute('data-max-locked')) return toast('빨갛게 표시된 소단원을 다시 공부하면 MAX가 열려요!', 'error');
  if (el.hasAttribute('data-close-sheet')) return setSheet(null);

  if (el.dataset.lesson !== undefined) return go('lesson', { subIdx: Number(el.dataset.lesson) });

  if (el.dataset.startSub !== undefined) {
    const ch = currentChapter();
    const idx = Number(el.dataset.startSub);
    const s = ch.subunits[idx];
    if (!s || !s.questions.length) return toast('이 소단원에는 아직 문제가 없어요.', 'error');
    return startQuiz('sub', s.questions, { chapterId: ch.id, sub: idx });
  }

  if (el.hasAttribute('data-start-max')) {
    const ch = currentChapter();
    return startQuiz('max', ch.maxSet, { chapterId: ch.id });
  }

  // --- 문제 상호작용 ---
  if (el.dataset.choice !== undefined) {
    if (State.quiz.checked) return;
    State.quiz.selected = Number(el.dataset.choice);
    return render();
  }

  if (el.hasAttribute('data-hint')) {
    State.quiz.hintOpen = true;
    State.quiz.hintUsed = true;
    return render();
  }

  if (el.hasAttribute('data-submit')) return submitAnswer();
  if (el.hasAttribute('data-next')) return nextQuestion();
});

app.addEventListener('change', (ev) => {
  // 로그인 · 회원가입의 학생 / 지도자 탭 (다른 화면으로 가도 고른 쪽을 기억해요)
  if (ev.target.name === 'role') State.role = ev.target.value;

  // 지도자: 학생의 집중력 환기 기능 켜고 끄기
  if (ev.target.hasAttribute('data-motion-toggle')) {
    const on = ev.target.checked;
    const res = safely(() => Store.setStudentMotion(State.studentId, on));
    if (!res.ok) return render();
    toast(on ? '집중력 환기 기능을 켰어요.' : '집중력 환기 기능을 껐어요.');
  }
});

// Esc로 팝업 닫기
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && State.sheet) setSheet(null);
});

app.addEventListener('submit', (ev) => {
  const form = ev.target;
  ev.preventDefault();
  const fd = new FormData(form);
  // 폼 안에 name="id"인 입력이 있으면 form.id가 그 입력을 가리켜서, 속성으로 읽어요.
  const formId = form.getAttribute('id');

  if (formId === 'chat-form') {
    if (Chat.send(fd.get('text'))) form.elements.text.value = '';
    return form.elements.text.focus();
  }

  if (formId === 'login-form') {
    try {
      const user = Store.logIn(fd.get('role'), fd.get('id'), fd.get('password'), !!fd.get('keep'));
      return go(homeOf(user), { grade: user.grade });
    } catch (e) {
      document.getElementById('login-error').textContent = e.message;
      return;
    }
  }

  if (formId === 'signup-form') {
    try {
      const user = Store.signUp({
        role: fd.get('role'),
        name: fd.get('name'),
        birth: fd.get('birth'),
        id: fd.get('id'),
        password: fd.get('password'),
        password2: fd.get('password2'),
        agree: !!fd.get('agree'),
      });
      toast(`${user.name}님, 반가워요!`);
      return go(homeOf(user), { grade: user.grade });
    } catch (e) {
      document.getElementById('signup-error').textContent = e.message;
      return;
    }
  }

  if (formId === 'add-student-form') {
    const res = safely(() => Store.addStudent(fd.get('id')));
    if (!res.ok) return;
    toast(`${res.value.name} 학생을 추가했어요.`);
    State.adding = false;
    return render();
  }

  if (formId === 'inquiry-form') {
    const res = safely(() => Store.addInquiry(fd.get('text')));
    if (!res.ok) return;
    toast('문의를 남겼어요.');
    return render();
  }
});

/* ============================== 시작 ============================== */
(function boot() {
  safely(() => Store.syncGarden());
  State.screen = 'splash';
  render();
  splashTimer = setTimeout(leaveSplash, 1800);
})();
