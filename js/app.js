/* =========================================================================
 * app.js — 화면 렌더링 및 흐름 제어
 *
 * 스플래시 → 로그인(학생 / 지도자 탭) · 회원가입(학년 포함)
 *
 * 학생 — 친구 사귀기 학교생활 시뮬레이션 (school.js · sim.js)
 *   처음 한 번: 10문항 레벨 테스트 → 과목마다 학습 시작점(학년 · 학기). 학생 화면에는 학년을 보여 주지 않아요.
 *   복도(홈): 수학 · 국어 교실 문 → 교실: 대단원 = 친구 자리
 *     → 대화(이야기 · 개념 설명 · 사회성 선택지) ↔ 문제(숫자/블록 · 힌트 · 색 카드 · 제출하기)
 *     → 숙달 기준에 닿으면 친구가 돼요. 복습은 친구의 재회 요청(느낌표)으로만 시작해요.
 *   어느 화면에서나 "잠깐 쉬는 시간!" → 쉬었다가 그 자리부터 이어서
 *
 * 지도자 (학부모 · 선생님)
 *   학생 리스트(+ 학생 아이디로 추가) · 알림 · 문의하기
 *     → 학생 설정(학습 수준 확인 · 바꾸기) → 성과 리포트(독립 해결률 · 힌트 · 유형별 성취도 · 성장 그래프 · 성장 포인트 · 개념별 숙달도)
 * ========================================================================= */

const app = document.getElementById('app');

/** 화면 상태 */
const State = {
  screen: 'splash',
  role: 'student', // 로그인 · 회원가입 화면의 탭
  subject: null,
  grade: null,
  term: 1, // 학기 (단원 길 위쪽 칩)
  menu: null, // 단원 길 위쪽 펼침 메뉴: 'grade' | 'term'
  chapterId: null,
  sheet: null, // 화면 위 팝업: { kind: 'rest' } | { kind: 'reunion', ... }
  madeFriend: null, // 방금 친구가 된 친구 id
  roomSay: null, // 교실에서 친구가 하는 짧은 말
  // 지도자
  studentId: null,
  range: 'week', // 성과 리포트 기간
  adding: false, // 학생 추가 칸 열림
  // 지금 문제 (시뮬레이션의 문제 장면 하나)
  quiz: null,
};

/** 로그인 없이 볼 수 있는 화면 */
const PUBLIC_SCREENS = ['splash', 'loading', 'intro', 'login', 'signup'];
/** 피그마 무대(stage.js)로 그리는 화면 */
const FIGMA_SCREENS = ['splash', 'loading'];
/** 학교 화면 (school.js) */
const SCHOOL_SCREENS = ['home', 'room', 'talk', 'quiz', 'friendmade', 'after', 'hunt'];
/** 화면 사이를 오갈 때 펼친 메뉴는 닫아요. */
/** 지도자 화면 */
const LEADER_SCREENS = ['leader', 'lstudent', 'report', 'notices', 'inquiry'];


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
  State.menu = null;
  // 종이 넘김 테마: 지금 화면을 본떠서 책장처럼 넘겨요. (fx.js가 아직 안 왔으면 그냥 바뀌어요)
  if (typeof FX !== 'undefined') FX.beforeNav(State.screen, screen);
  State.sheet = null;
  Speech.stop();
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

/** 서버를 기다리는 저장 동작용 safely */
async function safelyAsync(fn) {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    toast(e.message || '문제가 생겼어요. 다시 시도해 주세요.', 'error');
    return { ok: false, error: e };
  }
}

/** 폼을 보내는 동안 버튼을 잠가요. (두 번 눌러도 한 번만 가요) */
async function busy(form, fn) {
  const btn = form.querySelector('[type="submit"]');
  if (form.dataset.busy) return;
  form.dataset.busy = '1';
  if (btn) btn.disabled = true;
  try {
    return await fn();
  } finally {
    delete form.dataset.busy;
    if (btn && btn.isConnected) btn.disabled = false;
  }
}

/** 로그인한 뒤 첫 화면 */
function homeOf(user) {
  return user.role === 'leader' ? 'leader' : 'home';
}

/** 학생: 레벨 테스트를 아직 안 했으면 테스트부터, 했으면 복도로 */
function enterStudent() {
  if (!Store.placementOf()) return Sim.openTest();
  go('home');
}

/* ------------------------------ 그림 ------------------------------ */

/* ------------------------------ 공통 조각 ------------------------------ */

/**
 * 상단 HUD
 * @param {object} o { back, name, avatar, title, rightPills[], logout, settings }
 */
function hud(o) {
  const opts = o || {};
  let lead = `<span class="icon-btn" aria-hidden="true">${pxIcon('sprout')}</span>`;
  if (opts.back) lead = `<button class="icon-btn" data-back="${opts.back}" aria-label="뒤로 가기">←</button>`;
  else if (opts.name) lead = `<span class="hud-avatar" aria-hidden="true"><span>${esc(opts.avatar || [...opts.name][0] || '🌱')}</span></span>`;
  return `
    <header class="hud">
      ${lead}
      ${opts.title ? `<h1 class="hud-title">${opts.title}</h1>` : ''}
      <span class="hud-spacer"></span>
      ${(opts.rightPills || []).join('')}
      ${opts.settings ? `<button class="icon-btn" data-go="settings" aria-label="설정"><span aria-hidden="true">⚙️</span></button>` : ''}
      ${opts.logout ? `<button class="icon-btn" data-logout aria-label="로그아웃">${pxIcon('door')}</button>` : ''}
    </header>`;
}

function pill(kind, icon, text) {
  return `<span class="pill ${kind}"><span class="ico">${icon}</span>${esc(String(text))}</span>`;
}

/* ============================ 0. 스플래시 ============================ */

let splashTimer;
function leaveSplash() {
  clearTimeout(splashTimer);
  if (!['splash', 'loading'].includes(State.screen)) return;
  // 서버에서 예전 로그인을 확인하는 중이면 로딩 화면을 보여 주고 끝날 때까지 기다려요.
  if (!Cloud.restored) {
    if (State.screen === 'splash') go('loading');
    return Cloud.ready.then(() => ((Cloud.restored = true), leaveSplash()));
  }
  const user = Store.currentUser();
  if (!user) return go('intro');
  if (user.role === 'student') return enterStudent();
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
          <label class="field" data-student-only ${State.role === 'leader' ? 'hidden' : ''}>
            <span>학년 <small>(학생만)</small></span>
            <select name="grade">
              <option value="1">1학년</option><option value="2">2학년</option><option value="3">3학년</option>
            </select>
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

/* ========================== 문제 풀이 도우미 ==========================
 * 화면은 school.js의 screenQuiz. 손글씨(pencil.js)도 이 도우미들을 써요.
 * ===================================================================== */


/**
 * 지금 문제의 문제 데이터 · 표현 방식 · 입력 방식
 *  - 표현: 문제 풀이 중에 바꾼 것 → 프로필 기본값 → 숫자(글자)
 *  - 입력: 학습 모드의 입력 → 안 되는 문제면 숫자패드 → 터치 선택
 */
/** 문제 하나를 시작할 때의 상태 */
function freshQuestionState() {
  return {
    selected: null, // 고른 카드 번호
    typed: '', // 숫자패드: 쓰고 있는 수
    tries: [], // 한 번 틀린 답
    checked: false,
    correct: false,
    hintUsed: false,
    shownAt: Date.now(),
    readKey: null, // 소리 도움 모드: 이미 읽어 준 화면
    ink: null, // 손글씨 (pencil.js)
    inkSave: null,
  };
}

function quizParts() {
  const q = State.quiz;
  const item = q.questions[q.index];
  const p = Problem.from(item);
  const rep = pickRep(p, 'numbers'); // 보기 방법 버튼은 없앴어요 (그림이 필요한 문제는 시각화형 문제가 따로 있어요)
  // 펜슬 모드: 손글씨 → (안 되면) 숫자패드 → 색 카드
  const input = pickInput(p, Profile.mode().input);
  return { q, item, p, rep, input };
}

/** 지금 입력된 답 (없으면 null) */
function quizResponse(parts) {
  const { q, input } = parts;
  if (input === 'choice') return q.selected === null ? null : { kind: 'choice', index: q.selected };
  return q.typed === '' ? null : { kind: 'number', value: Number(q.typed) };
}

/** 답을 내는 곳: 숫자패드 */
function inputNumpad(parts) {
  const { q, p } = parts;
  const unit = p.answer.unit ? `<span class="np-unit">${esc(p.answer.unit)}</span>` : '';
  const shown = q.checked ? String(p.answer.value) : q.typed;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];
  const label = { clear: '처음부터', back: '⌫ 지우기' };
  return `<div class="numpad">
    <div class="np-display ${q.checked ? 'done' : ''}" aria-live="polite">
      <span class="np-value">${shown ? pvNum(shown) : '<span class="np-empty">?</span>'}</span>${unit}
      ${q.checked ? '<span class="np-mark">⭐ 정답</span>' : ''}
    </div>
    ${q.tries.length && !q.checked ? `<p class="np-tried">🤔 써 본 답: ${q.tries.map((t) => esc(responseText(p, t))).join(', ')}</p>` : ''}
    ${
      q.checked
        ? ''
        : `<div class="np-keys">${keys
            .map((k) => `<button type="button" class="np-key ${label[k] ? 'fn' : ''}" data-key="${k}" aria-label="${label[k] || k}">${label[k] || k}</button>`)
            .join('')}</div>`
    }
  </div>`;
}

/** 소리 도움 모드: 문제가 바뀌면 문제 → 보기 차례로 읽어 줘요. */
function readProblem() {
  if (typeof Sim !== 'undefined' && Sim.s) Speech.voice = Sim.friend().voice || null;
  const parts = [];
  const add = (el) => el && parts.push({ text: el.innerText || el.textContent, el });
  const card = document.querySelector('.quiz-problem');
  if (!card) return;
  card.querySelectorAll('.question-text, .steps li:not(.step-hidden)').forEach(add);
  document.querySelectorAll('.quiz-work .ans-card:not(:disabled) .ans-text').forEach((el, i) => parts.push({ text: `${i + 1}번, ${el.textContent}`, el }));
  Speech.read(parts);
}

function afterQuizRender() {
  if (State.screen !== 'quiz') return;
  Pencil.mount();
  const q = State.quiz;
  const key = `${q.orig && q.orig.id}:${q.tries.length}:${q.checked}:${q.hintLv}`;
  if (!Profile.mode().autoRead || q.readKey === key) return;
  q.readKey = key;
  if (Sim.s) Speech.voice = Sim.friend().voice || null;
  if (q.say) {
    const say = document.querySelector('.q-say span');
    if (say) Speech.readEl(say);
  } else readProblem();
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
  const unseen = notices.filter((n) => !Notices.seen(n)).length;

  return `
    ${hud({ name: user.name, title: `${esc(user.name)} 지도자님`, logout: true })}
    <main class="page settings">
      <h3 class="set-title">학생 리스트</h3>
      <div class="set-group">
        ${students
          .map((s) =>
            leaderRow({ attr: `data-student="${esc(s.id)}"`, icon: esc([...s.name][0]), title: esc(s.name), sub: `아이디 ${esc(s.id)}` })
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
        ${leaderRow({ attr: 'data-go="notices"', icon: '🔔', title: '알림', badge: unseen || '' })}
        ${leaderRow({ attr: 'data-go="inquiry"', icon: '✉️', title: '문의하기' })}
      </div>
    </main>`;
}

/* ========================== 11. 지도자: 학생 설정 ========================== */
/**
 * 학생 설정
 *  - 학습 수준: 레벨 테스트로 정해진 학년 · 학기를 보여 주고, 지도자가 바꿀 수 있어요. (학생 화면에는 안 보여요)
 *  - 친구(단원) 현황: 친구가 된 단원 · 복습 날
 */
function screenLeaderStudent() {
  const s = Store.myStudent(State.studentId);
  const place = Store.placementOf(s.id);
  const data = Store.dataOf(s.id);
  const test = data.levelTest;
  const srcName = { test: '레벨 테스트', leader: '지도자가 바꿈', auto: '단원을 다 마치고 다음으로', default: '기본값' };
  const levelRows = SUBJECTS.map((subj) => {
    const lv = place && place[subj.id];
    const opts = levelsOf(subj.id)
      .map((x) => `<option value="${x.grade}-${x.term}" ${lv && lv.grade === x.grade && lv.term === x.term ? 'selected' : ''}>${levelName(x)}</option>`)
      .join('');
    return `<label class="set-row">
      <span class="set-ico" aria-hidden="true">${subj.icon}</span>
      <span class="set-body"><strong>${subj.name}</strong><small>${lv ? `${levelName(lv)} · ${srcName[lv.source] || ''}` : '레벨 테스트 전이에요'}</small></span>
      <select class="lv-select" data-level="${subj.id}" aria-label="${subj.name} 학습 학년 · 학기">${place ? '' : '<option value="">-</option>'}${opts}</select>
    </label>`;
  }).join('');
  const today = todayStr();
  const friends = Object.entries(data.friends || {}).map(([chId, f]) => ({ ch: CHAPTER_BY_ID[chId], f, who: friendById(chapterFriendId(chId, f.friendId)) })).filter((x) => x.ch);
  return `
    ${hud({ back: 'leader', title: `${esc(s.name)} 설정` })}
    <main class="page settings">
      <h3 class="set-title">학습 수준</h3>
      <div class="set-group">${levelRows}</div>
      <p class="set-help">${test ? `레벨 테스트: ${test.total}문제 중 ${test.correct}문제 정답 (${todayStr(new Date(test.at))})` : '학생이 처음 들어오면 10문항 레벨 테스트를 해요.'}<br>학생 화면에는 학년 · 학기를 보여 주지 않아요. 바꾸면 학생의 교실이 그 학년 · 학기 단원으로 바뀌어요.</p>

      <div class="set-group">
        ${leaderRow({ attr: 'data-go="report"', icon: '📈', title: '성과 리포트', sub: '독립 해결률 · 힌트 · 유형별 성취도 · 성장 그래프 · 개념별 숙달도' })}
      </div>

      <h3 class="set-title">친구가 된 단원 ${friends.length}개</h3>
      ${
        friends.length
          ? `<div class="set-group">${friends
              .map(({ ch, f, who }) => `<div class="set-row static"><span class="set-ico" aria-hidden="true">${f.next <= today ? '❗' : '🙂'}</span>
                <span class="set-body"><strong>${esc(who.name)} · ${esc(ch.title)}</strong><small>${getSubject(ch.subject).name} · 숙달도 ${f.M}점 · ${f.next <= today ? '오늘 복습할 차례' : `다음 복습 ${f.next}`}${f.lowConf ? ' · 판단 근거가 부족해 복습을 앞당겼어요' : ''}</small></span></div>`)
              .join('')}</div>`
          : '<p class="set-help">아직 친구가 된 단원이 없어요.</p>'
      }

      <div class="set-group">
        <button class="set-row danger" data-remove-student><span class="set-ico" aria-hidden="true">➖</span><span class="set-body"><strong>학생 목록에서 빼기</strong><small>학생의 학습 기록은 지워지지 않아요</small></span></button>
      </div>
      <p class="set-help">아이디 ${esc(s.id)}</p>
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

      ${reportMastery(r.student.id)}

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

/**
 * 개념별 숙달도 · 판단 신뢰도 · 학습 방식 비율 · 소단원별 힌트 · 사회성 연습 (리포트 아래쪽)
 */
function reportMastery(studentId) {
  const data = Store.dataOf(studentId);
  const chIds = [...new Set(data.records.filter((r) => r.concept && (r.mode === 'sim' || r.mode === 'review')).map((r) => r.chapterId))];
  const mix = Mastery.mix(data);
  const typeRow = MASTERY_TYPES.map((t) => `<div><b>${Math.round(mix.ratio[t])}%</b><span>${QUESTION_TYPES[t].name}</span></div>`).join('');
  const lastEval = mix.history[mix.history.length - 1];
  const rows = chIds
    .map((id) => {
      const ch = CHAPTER_BY_ID[id];
      if (!ch) return '';
      return Mastery.chapterScores(data, id)
        .map((sc, i) => {
          const rs = Mastery.records(data, sc.concept);
          const hintAvg = rs.length ? Math.round((rs.reduce((a, r) => a + (r.hintLv || 0), 0) / rs.length) * 10) / 10 : 0;
          const ok = Mastery.done(sc);
          return `<tr><td>${i === 0 ? `<b>${esc(ch.title)}</b><br>` : ''}${esc(ch.subunits[i].title)}</td>
            <td class="${ok ? 'good' : sc.M >= 75 ? '' : 'soft'}">${sc.n ? sc.M : '-'}</td>
            <td><span class="conf conf-${sc.level}">${sc.n ? sc.level : '-'}</span></td>
            <td>${sc.n ? hintAvg : '-'}</td>
            <td>${sc.n ? (ok ? '숙달' : sc.flags.includes('error') ? '같은 실수 반복' : sc.flags.includes('variant') ? '변형 문제 연습' : sc.flags.includes('hint') ? '힌트 의존' : sc.flags.includes('forgot') ? '기억 유지 필요' : '연습 중') : '-'}</td></tr>`;
        })
        .join('');
    })
    .join('');
  const social = data.social || [];
  const byTheme = {};
  social.forEach((x) => {
    const t = (byTheme[x.theme] = byTheme[x.theme] || { n: 0, happy: 0 });
    t.n += 1;
    if (x.mood === 'happy') t.happy += 1;
  });
  return `
    <section class="rp-card">
      <h3>학습 방식 개인화 (유형별 제공 비율)</h3>
      <div class="rp-types">${typeRow}</div>
      <p class="rp-foot">${lastEval && lastEval.best ? `최근 평가에서 ${QUESTION_TYPES[lastEval.best].name} 문제의 성과가 높아 비율을 높였어요.` : '유형마다 5문항이 쌓일 때마다 다시 평가해요. 한 유형은 20%~60% 안에서 조정돼요.'}</p>
    </section>
    <section class="rp-card">
      <h3>개념별 숙달도 · 판단 신뢰도</h3>
      ${
        rows
          ? `<div class="rp-table-wrap"><table class="rp-table"><thead><tr><th>개념</th><th>숙달도</th><th>신뢰도</th><th>평균 힌트</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table></div>`
          : '<p class="rp-empty">아직 시뮬레이션에서 푼 문제가 없어요.</p>'
      }
      <p class="rp-foot">숙달도 75점 이상 · 신뢰도 HIGH(70점 이상) · 힌트 없이 푼 변형 문제 · 반복 오답 없음 → 친구가 돼요. 최초 학습은 복습 항목을 뺀 산식을 써요.</p>
    </section>
    <section class="rp-card">
      <h3>사회성 연습 (친구와의 대화 선택)</h3>
      ${
        social.length
          ? `<ul class="rp-points">${Object.entries(byTheme)
              .map(([t, v]) => `<li><span aria-hidden="true">💬</span><div><strong>${SOCIAL_NAME[t] || t}</strong><p>${v.n}번 연습 · 친구가 기뻐한 선택 ${v.happy}번</p></div></li>`)
              .join('')}</ul>`
          : '<p class="rp-empty">아직 대화 연습 기록이 없어요.</p>'
      }
      <p class="rp-foot">대화 선택은 교과 점수와 따로 기록해요. 어떤 선택을 해도 감점되거나 친구가 되는 데 제한이 없어요.</p>
    </section>`;
}

/* ========================== 13. 지도자: 알림 · 문의하기 ========================== */
/** 알림 읽음 표시: 한 번 본 알림은 다른 화면에 갔다 와도 "새 알림"으로 세지 않아요. (이 기기에 기억) */
const Notices = {
  key() {
    const u = Store.currentUser();
    return `hg-notice-seen:${u ? u.id : ''}`;
  },
  id: (n) => `${todayStr()}|${n.id}|${n.text}`,
  _read() {
    try {
      return JSON.parse(localStorage.getItem(this.key()) || '[]');
    } catch (e) {
      return [];
    }
  },
  seen(n) {
    return this._read().includes(this.id(n));
  },
  markAll(list) {
    const ids = [...new Set([...this._read(), ...list.map((n) => this.id(n))])].slice(-300);
    try {
      localStorage.setItem(this.key(), JSON.stringify(ids));
    } catch (e) {
      /* 저장을 못 하면 다음에 다시 새 알림으로 보여요 */
    }
  },
};

function screenNotices() {
  const list = Store.leaderNotices();
  Notices.markAll(list);
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
  const student = user && user.role === 'student';

  // 접근 제어
  if (!user && !PUBLIC_SCREENS.includes(State.screen)) State.screen = 'login';
  if (user && user.role === 'leader' && !LEADER_SCREENS.includes(State.screen) && !PUBLIC_SCREENS.includes(State.screen)) State.screen = 'leader';
  if (student && LEADER_SCREENS.includes(State.screen)) State.screen = 'home';
  if (['lstudent', 'report'].includes(State.screen) && !Store.myStudent(State.studentId)) State.screen = 'leader';
  if (State.screen === 'settings' && !student) State.screen = user ? homeOf(user) : 'login';
  if (['talk', 'quiz', 'hunt'].includes(State.screen) && !Sim.s) State.screen = 'home';
  if (State.screen === 'quiz' && !State.quiz) State.screen = 'home';
  if (State.screen === 'room' && !getSubject(State.subject)) State.screen = 'home';
  if (State.screen === 'friendmade' && !State.madeFriend) State.screen = 'room';
  // 레벨 테스트를 안 했으면 교실보다 테스트가 먼저예요.
  if (student && ['home', 'room', 'friendmade', 'after'].includes(State.screen) && !Store.placementOf()) return Sim.openTest();
  if (student && !State.grade) State.grade = user.grade;

  const views = {
    splash: screenSplash,
    login: screenLogin,
    signup: screenSignup,
    home: screenCorridor,
    room: screenRoom,
    talk: screenTalk,
    hunt: screenHunt,
    quiz: screenQuiz,
    friendmade: screenFriendMade,
    after: screenAfter,
    loading: screenLoading,
    intro: screenIntro,
    settings: screenSettings,
    leader: screenLeader,
    lstudent: screenLeaderStudent,
    report: screenReport,
    notices: screenNotices,
    inquiry: screenInquiry,
  };

  Profile.apply();
  app.innerHTML = (views[State.screen] || screenCorridor)();
  app.className = `screen-${State.screen}${FIGMA_SCREENS.includes(State.screen) ? ' figma' : ''}${SCHOOL_SCREENS.includes(State.screen) ? ' school' : ''}`;
  Layout.update();
  applySkin();
  Stage.paint();
  loadingAfterRender();
  afterQuizRender();
  talkAfterRender();
  huntAfterRender();
  introAfterRender();
  if (State.screen === 'home') {
    const c = document.getElementById('corridor');
    if (c && State.corridorX) c.scrollLeft = State.corridorX;
    if (c) c.addEventListener('scroll', () => (State.corridorX = c.scrollLeft), { passive: true });
  }
  if (typeof FX !== 'undefined') {
    FX.onRender();
    // 친구가 된 순간: 크게 축하 (한 번만)
    if (State.screen === 'friendmade' && State.celebrated !== State.madeFriend + State.chapterId) {
      State.celebrated = State.madeFriend + State.chapterId;
      FX.celebrate();
    }
  }
  if (LEADER_SCREENS.includes(State.screen)) Cloud.refreshLeader(render);
}

/* ============================ 이벤트 처리 ============================ */

app.addEventListener('click', async (ev) => {
  // 팝업 바깥(어두운 배경)을 누르면 닫혀요.
  if (ev.target.hasAttribute && ev.target.hasAttribute('data-backdrop')) return setSheet(null);

  // 소리 도움 모드: 글자를 누르면 다시 읽어 줘요.
  if (Profile.mode().tapRead) {
    const r = ev.target.closest('[data-read]');
    if (r && !r.closest('button')) Speech.readEl(r);
  }

  const el = ev.target.closest(
    '[data-skip],[data-go],[data-back],[data-close-sheet],[data-logout],' +
      '[data-student],[data-add-open],[data-add-cancel],[data-remove-student],[data-range]'
  );
  if (!el) return;

  if (el.hasAttribute('data-skip')) return leaveSplash();

  // --- 이동 ---
  if (el.dataset.go) return go(el.dataset.go, { adding: false });
  if (el.dataset.back) return go(el.dataset.back, { adding: false });
  if (el.hasAttribute('data-close-sheet')) return setSheet(null);

  if (el.hasAttribute('data-logout')) {
    if (!confirm('로그아웃할까요?')) return;
    Sim.s = null;
    await safelyAsync(() => Store.logOut());
    return go('login', { grade: null, subject: null, quiz: null, studentId: null });
  }

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
    const res = await safelyAsync(() => Store.removeStudent(State.studentId));
    if (!res.ok) return;
    return go('leader');
  }
  if (el.dataset.range) {
    State.range = el.dataset.range;
    return render();
  }
});

app.addEventListener('change', async (ev) => {
  // 로그인 · 회원가입의 학생 / 지도자 탭 (다른 화면으로 가도 고른 쪽을 기억해요)
  if (ev.target.name === 'role') State.role = ev.target.value;

  // 회원가입: 학년은 학생만 골라요.
  if (ev.target.name === 'role') {
    const g = document.querySelector('[data-student-only]');
    if (g) g.hidden = ev.target.value !== 'student';
  }

  // 지도자: 학생의 학습 학년 · 학기 바꾸기
  if (ev.target.dataset && ev.target.dataset.level) {
    const subj = ev.target.dataset.level;
    const [g, t] = ev.target.value.split('-').map(Number);
    if (!g) return;
    ev.target.disabled = true;
    const res = await safelyAsync(() => Store.setStudentLevel(State.studentId, subj, g, t));
    if (res.ok) toast(`${getSubject(subj).name} 학습 수준을 ${levelName({ grade: g, term: t })}로 바꿨어요.`);
    return render();
  }
});

// Esc로 팝업 닫기
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && State.sheet) setSheet(null);
});

app.addEventListener('submit', async (ev) => {
  const form = ev.target;
  ev.preventDefault();
  const fd = new FormData(form);
  // 폼 안에 name="id"인 입력이 있으면 form.id가 그 입력을 가리켜서, 속성으로 읽어요.
  const formId = form.getAttribute('id');

  if (formId === 'login-form') {
    return busy(form, async () => {
      try {
        const user = await Store.logIn(fd.get('role'), fd.get('id'), fd.get('password'), !!fd.get('keep'));
        if (user.role === 'student') return enterStudent();
        go(homeOf(user), { grade: user.grade });
      } catch (e) {
        const el = document.getElementById('login-error');
        if (el) el.textContent = e.message;
      }
    });
  }

  if (formId === 'signup-form') {
    return busy(form, async () => {
      try {
        const user = await Store.signUp({
          role: fd.get('role'),
          name: fd.get('name'),
          birth: fd.get('birth'),
          id: fd.get('id'),
          password: fd.get('password'),
          password2: fd.get('password2'),
          agree: !!fd.get('agree'),
          grade: Number(fd.get('grade')) || null,
        });
        toast(`${user.name}님, 반가워요!`);
        if (user.role === 'student') return enterStudent();
        go(homeOf(user), { grade: user.grade });
      } catch (e) {
        const el = document.getElementById('signup-error');
        if (el) el.textContent = e.message;
      }
    });
  }

  if (formId === 'add-student-form') {
    const res = await busy(form, () => safelyAsync(() => Store.addStudent(fd.get('id'))));
    if (!res || !res.ok) return;
    toast(`${res.value.name} 학생을 추가했어요.`);
    State.adding = false;
    return render();
  }

  if (formId === 'inquiry-form') {
    const res = await busy(form, () => safelyAsync(() => Store.addInquiry(fd.get('text'))));
    if (!res || !res.ok) return;
    toast('문의를 남겼어요.');
    return render();
  }
});

/* ============================== 시작 ============================== */
(function boot() {
  State.screen = 'splash';
  render();
  splashTimer = setTimeout(leaveSplash, 1800);
  loadFx();
})();

/** 스와이프 효과(fx.js)는 첫 화면이 뜬 뒤 한가할 때 불러와요. 첫 로딩을 느리게 하지 않으려고. */
function loadFx() {
  const add = () => {
    const sc = document.createElement('script');
    sc.src = 'js/fx.js?v=27';
    sc.async = true;
    document.body.appendChild(sc);
  };
  if ('requestIdleCallback' in window) requestIdleCallback(add, { timeout: 2500 });
  else setTimeout(add, 1200);
}
