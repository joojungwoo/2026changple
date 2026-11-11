/* =========================================================================
 * demo.js — 박람회 시연 계정 (서버를 쓰지 않고 이 기기에서만 동작해요)
 *
 *  test01 / test0011 : 전체 둘러보기용
 *    - 로그인할 때마다 처음(레벨 테스트)부터 시작해요.
 *    - 화면 오른쪽 아래 [건너뛰기]: 누르지 않으면 원래 앱 그대로예요.
 *        레벨 테스트  정문 → 계단 단서 → 안내도 완성
 *        이야기      상황 설명 → 사회성 질문 → 개념 설명 → 문제 → "친구를 사귀었어요!"
 *  test02 / test0022 : 복습 · 방과후교실 보여 주기용
 *    - 로그인할 때마다 아래 상태로 시작해요.
 *        국어: 도윤(느낌표) · 하린(방금 사귐) · 수아 자리(새 친구, 물음표)
 *        수학: 지아 · 태오(느낌표) · 예린 자리(새 친구)
 *        방과후교실: 사귄 친구 4명
 *  두 계정 모두 설정 화면에 [시연 처음으로] 단추가 있어요.
 *
 *  시연 기록은 이 탭(sessionStorage)에만 두고, 서버나 다른 계정 기록은 건드리지 않아요.
 * ========================================================================= */

const DEMO_ACCOUNTS = {
  test01: { pw: 'test0011', kind: 'run', name: '시연 1' },
  test02: { pw: 'test0022', kind: 'review', name: '시연 2' },
};
const DEMO_KEY = 'hangeoleum-demo';

const Demo = {
  db: null,

  /** 지금 시연 계정이면 'run' | 'review', 아니면 null */
  kind() {
    const a = this.db && DEMO_ACCOUNTS[this.db.session];
    return a ? a.kind : null;
  },
  run() {
    return this.kind() === 'run';
  },

  /** 처음 상태의 기록 */
  _fresh(id) {
    const a = DEMO_ACCOUNTS[id];
    const now = new Date().toISOString();
    const data = { records: [], srs: {}, studyDays: [], garden: {}, profile: { grade: 1 } };
    if (a.kind === 'review') {
      const today = todayStr();
      const ago = todayStr(new Date(Date.now() - 3 * 86400000));
      const friend = (friendId, due) => {
        const sched = Mastery.firstReview(due ? ago : today);
        return { friendId, madeAt: due ? ago : today, M: 72, lowConf: false, reviews: [], ...sched, ...(due ? { next: today } : {}) };
      };
      data.placement = { math: { grade: 1, term: 1, at: Date.now(), source: 'test' }, korean: { grade: 1, term: 2, at: Date.now(), source: 'test' } };
      data.levelTest = { at: Date.now(), correct: 7, total: 10 };
      data.friends = { 'm1-1': friend('jia', true), 'm1-2': friend('taeo', true), 'k1-6': friend('doyun', true), 'k1-7': friend('harin', false) };
      data.cast = { 'm1-1': 'jia', 'm1-2': 'taeo', 'k1-6': 'doyun', 'k1-7': 'harin' };
      data.studyDays = [ago, today];
    }
    return {
      users: { [id]: { id, role: 'student', name: a.name, birth: '2019-03-01', password: a.pw, createdAt: now, settings: { motion: true }, profile: { name: a.name, grade: 1 } } },
      data: { [id]: data },
      inquiries: [],
      session: id,
      remember: null,
    };
  },

  start(id) {
    this.db = this._fresh(id);
    this.save();
  },
  save() {
    try {
      sessionStorage.setItem(DEMO_KEY, JSON.stringify(this.db));
    } catch (e) { /* 저장소를 못 써도 이 화면에서는 계속 돼요. */ }
  },
  stop() {
    this.db = null;
    try { sessionStorage.removeItem(DEMO_KEY); } catch (e) { /* 지울 것이 없어요. */ }
  },
  restore() {
    try {
      const raw = sessionStorage.getItem(DEMO_KEY);
      const db = raw ? JSON.parse(raw) : null;
      if (db && DEMO_ACCOUNTS[db.session]) this.db = db;
    } catch (e) {
      this.db = null;
    }
  },

  /** 설정 [시연 처음으로] */
  reset() {
    const id = this.db.session;
    Sim.s = null;
    State.quiz = null;
    State.sheet = null;
    this.start(id);
    enterStudent();
  },

  /* ---------------- 건너뛰기 (test01) ---------------- */
  skip() {
    const s = Sim.s;
    if (!s) return;
    Speech.stop();
    if (s.kind === 'test') return this._skipTest(s);
    // 문제 화면 → 바로 친구 완성
    if (State.screen === 'quiz') return Sim.finish();
    const n = Sim.node();
    if (!n) return Sim.finish();
    if (n.t === 'choice') {
      this._pick(n);
      return this._advanceTo(['card', 'problem']);
    }
    if (n.t === 'card') return this._advanceTo(['problem']);
    return this._advanceTo(['choice', 'card', 'problem']);
  },

  /** 레벨 테스트: 정문 → 계단 단서, 계단 → 안내도 완성 */
  _skipTest(s) {
    State.quiz = null;
    s.j = 0;
    if ((s.k || 0) < HUNT_GATE && s.step !== 'done') {
      s.k = HUNT_GATE;
      s.step = 'enter';
    } else {
      s.k = HUNT_PIECES.length;
      s.step = 'map';
    }
    Sim.save();
    go('hunt');
  },

  /** 선택지는 다시 고르기가 없는 보기로 조용히 골라요. (반응 장면은 바로 뒤에 들어가요) */
  _pick(n) {
    const left = (k) => !(n.gone || []).includes(k);
    let i = n.options.findIndex((o, k) => !o.retry && left(k));
    if (i < 0) i = n.options.findIndex((o, k) => left(k));
    const next = Sim.next;
    Sim.next = () => {};
    try {
      Sim.choose(Math.max(0, i));
    } finally {
      Sim.next = next;
    }
  },

  /** 화면 없이 장면을 넘기다가 types 장면에서 멈춰요. 지나는 선택지는 자동으로 골라요. */
  _advanceTo(types) {
    const s = Sim.s;
    for (let guard = 0; guard < 600; guard++) {
      s.qi += 1;
      for (let g = 0; g < 200 && Sim.node() && Sim._control(Sim.node()); g++) s.qi += 1;
      const n = Sim.node();
      if (!n || n.t === 'end') return Sim.finish();
      if (types.includes(n.t)) {
        s.back = [];
        Sim.save();
        return Sim.show();
      }
      if (n.t === 'choice') this._pick(n);
    }
    Sim.finish();
  },

  skipButton() {
    if (!this.run() || !['talk', 'quiz', 'hunt'].includes(State.screen) || !Sim.s) return '';
    if (Sim.s.kind === 'test' && Sim.s.step === 'map') return '';
    return '<button type="button" class="demo-skip" data-demo-skip>건너뛰기 ⏭</button>';
  },

  settingsBlock() {
    if (!this.kind()) return '';
    return `<section class="set-block">
      <h3>시연 계정</h3>
      <p class="set-help">${this.run() ? '레벨 테스트부터 처음 상태로 돌아가요.' : '복습할 친구 · 방금 사귄 친구 · 새 친구가 있는 처음 상태로 돌아가요.'}</p>
      <button type="button" class="btn demo-reset" data-demo-reset>시연 처음으로</button>
    </section>`;
  },
};

/* test01: 수학 1단원(지아) 첫 문제는 늘 "딸기만 세기" (딸기 · 바나나를 섞어 헷갈리지 않게) */
const DEMO_FIRST_Q = withChapter(
  {
    id: 'm1-1-demo1', sub: 0, type: 'step', level: '중',
    visual: '🍓 🍌 🍓 🍓 🍓 🍓 🍌',
    text: '딸기만 세면 몇 개인가요?',
    steps: ['① 🍓에만 ○를 해.', '② ○를 한 것만 하나씩 짚으며 세어 봐. 몇 개일까?'],
    choices: ['7개', '5개', '4개'], answer: 1,
    hint: '🍌 바나나는 세지 마!\n🍓만 하나씩 짚으며 "하나, …" 하고 세어 봐.\n마지막에 말한 수가 답이야.',
    solution: '🍓만 세면 5개야. (바나나는 2개)',
  },
  CHAPTER_BY_ID['m1-1']
);
QUESTION_BY_ID[DEMO_FIRST_Q.id] = DEMO_FIRST_Q;
(function pinFirstProblem() {
  const show = Sim.show;
  Sim.show = function () {
    const s = this.s;
    const n = this.node();
    if (Demo.run() && s && s.kind === 'learn' && s.chapterId === 'm1-1' && n && n.t === 'problem' && !(s.used || []).length) {
      n.qid = DEMO_FIRST_Q.id;
      n.ci = 0;
    }
    return show.call(this);
  };
})();

/* 시연 중에는 Store가 이 탭의 시연 기록만 읽고 써요. */
(function patchStore() {
  const read = Store._read;
  const write = Store._write;
  const logIn = Store.logIn;
  const logOut = Store.logOut;
  Store._read = function () {
    return Demo.db || read.call(this);
  };
  Store._write = function (db) {
    if (Demo.db) return Demo.save();
    return write.call(this, db);
  };
  Store.logIn = async function (role, id, password, keep) {
    const key = (id || '').trim().toLowerCase();
    const a = DEMO_ACCOUNTS[key];
    if (a && role === 'student' && password === a.pw) {
      if (Cloud.on && Cloud.uid) await Cloud.signOut().catch(() => {});
      Sim.s = null;
      State.quiz = null;
      Demo.start(key); // 로그인할 때마다 처음 상태
      return this._user(Demo.db, key);
    }
    if (Demo.db) Demo.stop();
    return logIn.call(this, role, id, password, keep);
  };
  Store.logOut = function () {
    if (Demo.db) {
      Demo.stop();
      Sim.s = null;
      return;
    }
    return logOut.call(this);
  };
  Demo.restore();
})();

document.getElementById('app').addEventListener('click', (ev) => {
  if (ev.target.closest('[data-demo-skip]')) return Demo.skip();
  if (ev.target.closest('[data-demo-reset]')) return Demo.reset();
});
