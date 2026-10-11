/* =========================================================================
 * store.js
 * localStorage 기반 데이터 저장소
 *  - 계정: 학생 / 지도자(학부모·선생님). 지도자는 학생 아이디로 학생을 여러 명 맡아요.
 *  - 학습 기록(LearningRecord): 힌트 사용 여부까지 남겨 성과 리포트에 써요.
 *  - 복습 스케줄(SpacedRepetition): 복습할 때가 되면 텃밭 식물이 시들어요.
 *  - 텃밭(Garden): 단원별 물 게이지 · 식물 단계 · 회독 · MAX
 *  - 성과 리포트: 독립 해결률 · 힌트 사용 · 유형별 성취도 · 성장 그래프
 * ========================================================================= */

const DB_KEY = 'chageun-app-db-v1';

/**
 * 복습 간격(일)
 *  - 틀린 문제: 다음 날 복습 → 맞힐 때마다 3일 → 7일 → 14일 → 30일 뒤로 늘어요.
 *  - 자문을 받아 "며칠 안 보면 시들지"가 정해지면 이 표만 바꾸면 돼요.
 */
const SRS_INTERVALS = [1, 3, 7, 14, 30];

/** 단원 복습 간격(일): 1회독을 마친 단원은 틀린 문제가 없어도 이 간격으로 물을 줘야 해요. */
const REVIEW_INTERVALS = [3, 7, 14, 30];

/** 물 주기(복습) 한 번에 푸는 문제 수: 틀렸던 문제가 적으면 새 문제로 채워요. */
const REVIEW_MIN = 5;
const REVIEW_MAX = 10;

/**
 * 텃밭 식물 단계
 *  empty 빈 밭 → seed 씨앗(공부 시작) → sprout 새싹(1회독) → tree 나무(2회독) → fruit 열매(3회독)
 */
const STAGES = ['empty', 'seed', 'sprout', 'tree', 'fruit'];

/** 회독 간격(일): 1회독 하루 뒤부터 2회독, 2회독 일주일 뒤부터 3회독을 할 수 있어요. */
const PASS_INTERVALS = [1, 7];

/** 회독 퀴즈에서 소단원마다 뽑는 문제 수 */
const PASS_PER_SUB = 7;

/** MAX 통과 기준 (정답률) */
const MAX_PASS_RATE = 0.8;

const ROLE_NAME = { student: '학생', leader: '지도자' };

/** 저장 실패를 알리기 위한 전용 에러 */
class StorageError extends Error {}

function todayStr(d) {
  const t = d || new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const day = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateStr, n) {
  const t = parseDay(dateStr);
  t.setDate(t.getDate() + n);
  return todayStr(t);
}

function diffDays(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / 86400000);
}

/** 생년월일로 학년 어림하기 (만 6세가 되는 해의 다음 해 3월 입학). 1~3학년 밖이면 가까운 학년. */
function gradeFromBirth(birth) {
  const y = Number(String(birth || '').slice(0, 4));
  if (!y) return 1;
  return Math.min(3, Math.max(1, new Date().getFullYear() - y - 6));
}

/**
 * 탭마다 로그인을 따로 기억해요. (한 기기에서 두 친구가 탭 두 개로 채팅할 수 있게)
 * "로그인 상태 유지"를 켜면 새 탭도 마지막 로그인으로 시작해요.
 */
const TAB_SESSION_KEY = 'chageun-tab-session';

function tabSession(value) {
  try {
    if (value === undefined) return sessionStorage.getItem(TAB_SESSION_KEY);
    sessionStorage.setItem(TAB_SESSION_KEY, value === null ? '' : value);
  } catch (e) {
    return null;
  }
  return value;
}

const Store = {
  /* ---------------- 저수준 입출력 ---------------- */
  _read() {
    let db;
    try {
      const raw = localStorage.getItem(DB_KEY);
      db = raw ? JSON.parse(raw) : null;
    } catch (e) {
      db = null; // 저장소 손상 시 빈 DB로 복구
    }
    if (!db || typeof db !== 'object') db = {};
    db.users = db.users || {};
    db.data = db.data || {};
    db.inquiries = db.inquiries || [];
    // db.session에는 "로그인 상태 유지"로 기억한 계정만 저장돼 있어요.
    db.remember = db.session || null;
    const tab = tabSession();
    db.session = tab !== null ? tab || null : db.remember;
    if (db.session && !db.users[db.session]) db.session = null;
    return db;
  },

  _write(db) {
    const { remember, ...rest } = db;
    try {
      localStorage.setItem(DB_KEY, JSON.stringify({ ...rest, session: remember || null }));
    } catch (e) {
      throw new StorageError('데이터를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  },

  _setSession(db, id, keep) {
    db.session = id;
    db.remember = keep ? id : null;
    tabSession(id);
  },

  _blankData() {
    return { records: [], srs: {}, studyDays: [], garden: {} };
  },

  /** 예전 버전 계정(이메일 · 프로필 사진 · 게스트)도 지금 모양으로 읽어요. */
  _user(db, id) {
    const u = db.users[id];
    if (!u) return null;
    const p = u.profile || {};
    const role = u.role === 'leader' ? 'leader' : 'student';
    return {
      id,
      role,
      name: u.name || p.name || id,
      birth: u.birth || '',
      grade: [1, 2, 3].includes(p.grade) ? p.grade : gradeFromBirth(u.birth),
      motion: !u.settings || u.settings.motion !== false,
      students: role === 'leader' ? (u.students || []).filter((s) => db.users[s]) : [],
    };
  },

  /* ---------------- 계정 ---------------- */
  /**
   * 회원가입: 이름 · 생년월일 · 아이디 · 비밀번호 + 개인정보 동의
   * @param {{role, name, birth, id, password, password2, agree}} f
   */
  signUp(f) {
    const role = f.role === 'leader' ? 'leader' : 'student';
    const name = (f.name || '').trim().slice(0, 20);
    const id = (f.id || '').trim().toLowerCase();
    const birth = (f.birth || '').trim();
    if (!name) throw new Error('이름을 입력해 주세요.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || todayStr(parseDay(birth)) !== birth || birth > todayStr() || birth < '1900-01-01') {
      throw new Error('생년월일을 골라 주세요.');
    }
    if (!/^[a-z0-9_]{4,20}$/.test(id)) throw new Error('아이디는 영어 소문자 · 숫자 4~20자로 만들어 주세요.');
    if (!f.password || f.password.length < 4) throw new Error('비밀번호는 4자 이상으로 정해 주세요.');
    if (f.password2 !== undefined && f.password !== f.password2) throw new Error('비밀번호가 서로 달라요. 다시 확인해 주세요.');
    if (!f.agree) throw new Error('개인정보 수집 · 이용에 동의해 주세요.');

    const db = this._read();
    if (db.users[id]) throw new Error('이미 쓰고 있는 아이디예요. 다른 아이디를 정해 주세요.');

    const now = new Date().toISOString();
    db.users[id] = { id, role, name, birth, password: f.password, agreedAt: now, createdAt: now, settings: { motion: true } };
    if (role === 'student') {
      db.users[id].profile = { name, grade: gradeFromBirth(birth) };
      db.data[id] = this._blankData();
    } else {
      db.users[id].students = [];
    }
    this._setSession(db, id, false);
    this._write(db);
    return this._user(db, id);
  },

  /** 로그인: 학생 탭과 지도자 탭이 따로예요. 어떤 항목이 틀렸는지는 알려 주지 않아요. */
  logIn(role, id, password, keep) {
    const key = (id || '').trim().toLowerCase();
    const db = this._read();
    const raw = db.users[key];
    const user = this._user(db, key);
    if (!raw || !raw.password || raw.password !== password || user.role !== role) {
      throw new Error('아이디 또는 비밀번호가 맞지 않아요. 다시 입력해 주세요.');
    }
    this._setSession(db, key, !!keep);
    this._write(db);
    return user;
  },

  logOut() {
    const db = this._read();
    this._setSession(db, null, false);
    this._write(db);
  },

  currentUser() {
    const db = this._read();
    return db.session ? this._user(db, db.session) : null;
  },

  /** 채팅 상대 찾기용: 가입한 학생 모두 */
  allStudents() {
    const db = this._read();
    return Object.keys(db.users)
      .filter((id) => db.users[id].password)
      .map((id) => this._user(db, id))
      .filter((u) => u.role === 'student');
  },

  /** 집중력 환기(운동) 기능: 학생에게만 뜨고, 지도자가 학생마다 켜고 끌 수 있어요. */
  motionOn() {
    const u = this.currentUser();
    return !!u && u.role === 'student' && u.motion;
  },

  /* ---------------- 지도자 ---------------- */
  _leader(db) {
    const u = db.session && db.users[db.session];
    if (!u || u.role !== 'leader') throw new Error('지도자 계정으로 로그인해 주세요.');
    u.students = u.students || [];
    return u;
  },

  leaderStudents() {
    const db = this._read();
    const me = db.session ? this._user(db, db.session) : null;
    return me ? me.students.map((id) => this._user(db, id)) : [];
  },

  /** 학생 아이디로 내 학생 목록에 추가 */
  addStudent(studentId) {
    const id = (studentId || '').trim().toLowerCase();
    if (!id) throw new Error('학생 아이디를 입력해 주세요.');
    const db = this._read();
    const me = this._leader(db);
    const s = this._user(db, id);
    if (!s || s.role !== 'student' || !db.users[id].password) throw new Error('그 아이디의 학생을 찾지 못했어요. 아이디를 다시 확인해 주세요.');
    if (me.students.includes(id)) throw new Error('이미 추가한 학생이에요.');
    me.students.push(id);
    this._write(db);
    return s;
  },

  removeStudent(studentId) {
    const db = this._read();
    const me = this._leader(db);
    me.students = me.students.filter((s) => s !== studentId);
    this._write(db);
  },

  /** 내가 맡은 학생인지 확인하고 돌려줘요. */
  myStudent(studentId) {
    const db = this._read();
    const me = db.session ? this._user(db, db.session) : null;
    return me && me.role === 'leader' && me.students.includes(studentId) ? this._user(db, studentId) : null;
  },

  setStudentMotion(studentId, on) {
    const db = this._read();
    const me = this._leader(db);
    if (!me.students.includes(studentId)) throw new Error('내 학생 목록에 없는 학생이에요.');
    const u = db.users[studentId];
    u.settings = { ...(u.settings || {}), motion: !!on };
    this._write(db);
  },

  /** 문의하기: 서버가 없어서 지금은 이 기기에만 남겨 둬요. */
  addInquiry(text) {
    const t = (text || '').trim().slice(0, 500);
    if (!t) throw new Error('문의할 내용을 적어 주세요.');
    const db = this._read();
    const me = this._leader(db);
    db.inquiries.push({ from: me.id || db.session, text: t, at: Date.now() });
    this._write(db);
  },

  myInquiries() {
    const db = this._read();
    return db.inquiries.filter((q) => q.from === db.session).sort((a, b) => b.at - a.at);
  },

  /** 알림: 맡은 학생들의 학습 기록에서 만들어요. */
  leaderNotices() {
    const db = this._read();
    const me = db.session ? this._user(db, db.session) : null;
    if (!me) return [];
    const today = todayStr();
    const out = [];
    me.students.forEach((id) => {
      const s = this._user(db, id);
      const data = this._dataOf(db, id);
      const solved = data.records.filter((r) => r.date === today).length;
      const thirsty = CHAPTERS.filter((ch) => this._gardenView(data, ch).wilted).length;
      const last = data.studyDays.length ? [...data.studyDays].sort().pop() : null;
      if (solved) out.push({ icon: '✏️', id, text: `${s.name} 학생이 오늘 ${solved}문제를 풀었어요.` });
      if (thirsty) out.push({ icon: '🥀', id, text: `${s.name} 학생의 텃밭에 복습을 기다리는 식물이 ${thirsty}개 있어요.` });
      if (last && diffDays(last, today) >= 3) out.push({ icon: '📅', id, text: `${s.name} 학생이 ${diffDays(last, today)}일 동안 공부하지 않았어요.` });
      if (!last) out.push({ icon: '🌱', id, text: `${s.name} 학생이 아직 공부를 시작하지 않았어요.` });
    });
    return out;
  },

  /* ---------------- 학습 데이터 ---------------- */
  _dataOf(db, id) {
    const d = db.data[id] || this._blankData();
    d.records = d.records || [];
    d.srs = d.srs || {};
    d.studyDays = d.studyDays || [];
    d.garden = d.garden || {};
    return d;
  },

  _myData(db) {
    db.data[db.session] = this._dataOf(db, db.session);
    return db.data[db.session];
  },

  getData() {
    const db = this._read();
    return db.session ? this._dataOf(db, db.session) : this._blankData();
  },

  /**
   * 문제 풀이 결과 기록 + 복습 스케줄 갱신
   * @param {object} q 문제
   * @param {boolean} correct 정답 여부
   * @param {{mode:'sub'|'max'|'pass'|'review', hint:boolean, sess:string}} o
   */
  recordAnswer(q, correct, o) {
    const db = this._read();
    if (!db.session) throw new Error('로그인이 필요해요.');
    const data = this._myData(db);
    const today = todayStr();

    data.records.push({
      qid: q.id,
      chapterId: q.chapterId,
      subject: q.subject,
      grade: q.grade,
      type: q.type,
      sub: q.sub,
      correct: !!correct,
      hint: o.hint ? 1 : 0,
      mode: o.mode,
      sess: o.sess,
      date: today,
      at: Date.now(),
    });
    if (!data.studyDays.includes(today)) data.studyDays.push(today);

    // ----- 복습 스케줄 -----
    const cur = data.srs[q.id];
    if (!correct) {
      // 틀린 문제 → 내일 복습. 그때까지 복습하지 않으면 식물이 시들어요.
      data.srs[q.id] = { qid: q.id, chapterId: q.chapterId, stage: 0, next: addDays(today, SRS_INTERVALS[0]), lapses: (cur ? cur.lapses : 0) + 1 };
    } else if (cur) {
      const stage = cur.stage + 1;
      if (stage >= SRS_INTERVALS.length) delete data.srs[q.id]; // 충분히 익혔어요.
      else data.srs[q.id] = { ...cur, stage, next: addDays(today, SRS_INTERVALS[stage]) };
    }

    this._write(db);
  },

  /* ---------------- 텃밭 ---------------- */

  /** 단원에서 오늘 복습해야 하는 틀린 문제 (오래 기다린 것부터) */
  _dueWrong(data, ch) {
    const today = todayStr();
    return Object.values(data.srs)
      .filter((s) => s.next <= today && (getQuestion(s.qid) || {}).chapterId === ch.id)
      .sort((a, b) => (a.next < b.next ? -1 : 1));
  },

  /**
   * 단원 하나의 텃밭 상태 (저장된 값 + 학습 기록에서 계산)
   *  - 소단원의 문제를 모두 한 번 이상 풀면 물 한 칸. MAX를 통과하면 모든 칸이 한 번에 차요.
   *  - 물이 가득(1회독) → 새싹. 스스로 다시 공부(회독 퀴즈)하면 나무 → 열매로 자라요.
   *  - 복습할 때가 되면 시들어요(wilted). 물 주기(복습)를 하면 원래대로 돌아오지만 자라지는 않아요.
   */
  _gardenView(data, ch) {
    const g = (data.garden && data.garden[ch.id]) || {};
    const passes = g.passes || [];
    const max = g.max || { state: 'open', weak: [] };
    const today = todayStr();

    const solvedIds = new Set();
    data.records.forEach((r) => {
      if (r.chapterId === ch.id) solvedIds.add(r.qid);
    });

    const maxPassed = max.state === 'passed';
    const subs = ch.subunits.map((s) => {
      const solved = s.questions.filter((q) => solvedIds.has(q.id)).length;
      const total = s.questions.length;
      return { sub: s, solved, total, cleared: maxPassed || solved >= total, weak: max.state === 'locked' && max.weak.includes(s.idx) };
    });

    const water = subs.filter((s) => s.cleared).length;
    const full = water === subs.length;
    const passCount = Math.min(3, Math.max(passes.length, full ? 1 : 0));
    const stage = STAGES[passCount ? passCount + 1 : solvedIds.size ? 1 : 0];

    // 시들기: 틀린 문제의 복습 날이 됐거나, 단원 복습 날이 됐을 때
    const dueCount = stage === 'empty' ? 0 : this._dueWrong(data, ch).length;
    const reviewDue = passCount >= 1 && !!g.review && g.review.next <= today;
    const wilted = dueCount > 0 || reviewDue;

    // 다음 회독까지 남은 날 (0이면 오늘 할 수 있어요)
    let dueIn = null;
    if (passCount >= 1 && passCount < 3) {
      const last = passes[passCount - 1];
      const wait = PASS_INTERVALS[passCount - 1];
      dueIn = last ? Math.max(0, diffDays(today, addDays(last, wait))) : wait;
    }

    return { chapter: ch, stage, passCount, water, full, subs, max, wilted, dueCount, dueIn, canGrow: dueIn === 0 && !wilted };
  },

  chapterGarden(chapterId) {
    const ch = CHAPTER_BY_ID[chapterId];
    return ch ? this._gardenView(this.getData(), ch) : null;
  },

  /**
   * 문제 풀이 세션을 마쳤을 때 텃밭 반영
   * @param {{mode:'sub'|'max'|'pass'|'review', chapterId, sub, results:{qid,correct}[]}} s
   * @returns {{ max: null|{passed, weak, correct, total}, after }}
   */
  finishSession(s) {
    const db = this._read();
    if (!db.session) throw new Error('로그인이 필요해요.');
    const data = this._myData(db);
    const ch = CHAPTER_BY_ID[s.chapterId];
    if (!ch) return { max: null, after: null };

    const before = this._gardenView(data, ch);
    const g = (data.garden[ch.id] = data.garden[ch.id] || {});
    g.passes = g.passes || [];
    g.max = g.max || { state: 'open', weak: [] };
    const today = todayStr();
    const restart = () => (g.review = { stage: 0, next: addDays(today, REVIEW_INTERVALS[0]) });

    // MAX: 기준 이상이면 물을 가득, 아니면 틀린 문제의 소단원을 표시하고 잠가요.
    let maxResult = null;
    if (s.mode === 'max') {
      const total = s.results.length;
      const correct = s.results.filter((r) => r.correct).length;
      const passed = total > 0 && correct >= Math.ceil(total * MAX_PASS_RATE);
      const weak = [...new Set(s.results.filter((r) => !r.correct).map((r) => (getQuestion(r.qid) || {}).sub).filter((i) => i !== undefined))].sort();
      g.max = passed ? { state: 'passed', weak: [] } : { state: 'locked', weak };
      maxResult = { passed, weak, correct, total };
    }

    // 표시된 소단원을 끝까지 다시 풀면 표시를 지우고, 모두 지우면 MAX가 다시 열려요.
    if (s.mode === 'sub' && g.max.state === 'locked') {
      g.max.weak = g.max.weak.filter((i) => i !== s.sub);
      if (!g.max.weak.length) g.max.state = 'open';
    }

    const view = this._gardenView(data, ch);
    if (view.full && g.passes.length === 0) {
      // 1회독 달성일을 남겨 두어야 2회독 시기를 계산할 수 있어요.
      g.passes.push(today);
      restart();
    } else if (s.mode === 'pass' && before.canGrow && g.passes.length === before.passCount) {
      // 스스로 다시 공부했을 때만 한 단계 자라요.
      g.passes.push(today);
      restart();
    } else if (s.mode === 'review' && g.review) {
      // 물 주기: 시든 식물이 원래대로 돌아와요. 다음 복습은 더 나중에.
      const stage = Math.min(g.review.stage + 1, REVIEW_INTERVALS.length - 1);
      g.review = { stage, next: addDays(today, REVIEW_INTERVALS[stage]) };
    }

    this._write(db);
    return { max: maxResult, after: this._gardenView(data, ch) };
  },

  /** 선택지 순서를 섞은 문제 (id는 그대로) */
  _shuffled(q, r) {
    const order = r.shuffle(q.choices.map((_, i) => i));
    return { ...q, choices: order.map((i) => q.choices[i]), answer: order.indexOf(q.answer) };
  },

  /**
   * 회독 퀴즈 문제 고르기 — 소단원마다 PASS_PER_SUB문제, 회독마다 문제가 달라요.
   *  - 문제 틀이 있는 소단원(gen.js): 수준은 같고 숫자가 다른 새 문제를 만들어요.
   *  - 틀이 없는 소단원: 문제은행에서 회독마다 다른 자리부터 돌려 뽑고, 선택지 순서를 섞어요.
   */
  passQuestions(chapterId) {
    const ch = CHAPTER_BY_ID[chapterId];
    if (!ch) return [];
    const passNo = this.chapterGarden(chapterId).passCount + 1;
    const seed = (Date.now() % 100000) + passNo * 100003;
    const r = genRng(seed);
    const picked = [];
    ch.subunits.forEach((s) => {
      if (hasGenerator(ch.id, s.idx)) {
        picked.push(...genSet(ch.id, s.idx, PASS_PER_SUB, seed + s.idx * 1000).map((q) => getQuestion(q.id)));
        return;
      }
      const pool = s.questions;
      const n = Math.min(PASS_PER_SUB, pool.length);
      const start = pool.length ? ((passNo - 1) * PASS_PER_SUB) % pool.length : 0;
      for (let i = 0; i < n; i++) picked.push(this._shuffled(pool[(start + i) % pool.length], r));
    });
    return picked.sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
  },

  /**
   * 물 주기(복습) 문제 고르기
   *  - 복습 날이 된 틀린 문제를 먼저(최대 REVIEW_MAX), 모자라면 단원에서 새 문제로 REVIEW_MIN까지 채워요.
   */
  reviewQuestions(chapterId) {
    const ch = CHAPTER_BY_ID[chapterId];
    if (!ch) return [];
    const seed = Date.now() % 100000;
    const r = genRng(seed);
    const picked = this._dueWrong(this.getData(), ch).slice(0, REVIEW_MAX).map((s) => this._shuffled(getQuestion(s.qid), r));
    const have = new Set(picked.map((q) => q.id));
    const subs = r.shuffle(ch.subunits);
    for (let i = 0; picked.length < REVIEW_MIN && i < REVIEW_MIN * 4; i++) {
      const s = subs[i % subs.length];
      const q = hasGenerator(ch.id, s.idx)
        ? getQuestion(genSet(ch.id, s.idx, 1, seed + i * 17)[0].id)
        : s.questions.length ? this._shuffled(r.pick(s.questions), r) : null;
      if (!q || have.has(q.id)) continue;
      have.add(q.id);
      picked.push(q);
    }
    return picked;
  },

  /** 예전 버전 기록으로 이미 1회독한 단원에 달성일을 채워 넣어요. (부팅 시 1회) */
  syncGarden() {
    const db = this._read();
    if (!db.session || !db.data[db.session]) return;
    const data = this._myData(db);
    let changed = false;
    CHAPTERS.forEach((ch) => {
      const g = data.garden[ch.id];
      if ((!g || !g.passes || !g.passes.length) && this._gardenView(data, ch).full) {
        data.garden[ch.id] = { max: { state: 'open', weak: [] }, ...(g || {}), passes: [todayStr()] };
        changed = true;
      }
    });
    if (changed) this._write(db);
  },

  /* ---------------- 학생 화면용 요약 ---------------- */

  /** 최근 7일 학습 여부 (결과 화면의 주간 스트릭 표시용) */
  weekStudy() {
    const set = new Set(this.getData().studyDays);
    const labels = ['일', '월', '화', '수', '목', '금', '토'];
    const today = new Date();
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const ds = todayStr(d);
      out.push({ label: labels[d.getDay()], date: ds, studied: set.has(ds), isToday: i === 0 });
    }
    return out;
  },

  /** 연속 학습 일수: 하루 1문제 이상 풀면 인정, 하루라도 비면 초기화 */
  streak() {
    const data = this.getData();
    if (!data.studyDays.length) return 0;
    const days = [...data.studyDays].sort().reverse();
    const today = todayStr();
    let cursor;
    if (days[0] === today) cursor = today;
    else if (days[0] === addDays(today, -1)) cursor = days[0];
    else return 0;

    let count = 0;
    for (const d of days) {
      if (d === cursor) {
        count += 1;
        cursor = addDays(cursor, -1);
      } else if (d < cursor) {
        break;
      }
    }
    return count;
  },

  todaySummary() {
    const today = todayStr();
    return { solved: this.getData().records.filter((r) => r.date === today).length, streak: this.streak() };
  },

  /* ---------------- 성과 리포트 (지도자) ---------------- */

  /** 기간: 이번 주(월~일) · 이번 달 · 올해. back=1이면 바로 앞 기간. */
  _period(range, back) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const b = back || 0;
    if (range === 'year') return { start: `${y - b}-01-01`, end: `${y - b}-12-31` };
    if (range === 'month') return { start: todayStr(new Date(y, m - b, 1)), end: todayStr(new Date(y, m - b + 1, 0)) };
    const monday = new Date(y, m, now.getDate() - ((now.getDay() + 6) % 7) - 7 * b);
    return { start: todayStr(monday), end: addDays(todayStr(monday), 6) };
  },

  /**
   * 기록 묶음 하나의 지표
   *  - 독립 해결률 = 힌트 없이 첫 시도에 맞힌 문제 수 ÷ 전체 풀이 문제 수 × 100
   *  - 평균 힌트 사용 = 소단원을 한 번 풀 때 힌트를 본 횟수의 평균
   *  - 유형별 성취도 = 문제마다 점수(혼자 정답 1 · 힌트 보고 정답 0.5 · 오답 0)의 평균 × 100
   *    ※ 문제 재구성 프롬프트의 score가 정해지면 scoreOf만 바꾸면 돼요.
   */
  _measure(rs) {
    const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);
    const solo = (r) => r.correct && !r.hint;
    const scoreOf = (r) => (r.correct ? (r.hint ? 0.5 : 1) : 0);

    const sessions = {};
    rs.forEach((r) => {
      if (r.mode !== 'sub' || !r.sess) return;
      sessions[r.sess] = (sessions[r.sess] || 0) + (r.hint || 0);
    });
    const sessHints = Object.values(sessions);

    const byType = {};
    Object.keys(QUESTION_TYPES).forEach((t) => {
      const list = rs.filter((r) => typeOf(r.type) === t);
      byType[t] = list.length ? Math.round((list.reduce((a, r) => a + scoreOf(r), 0) / list.length) * 100) : null;
    });

    return {
      total: rs.length,
      solo: pct(rs.filter(solo).length, rs.length),
      hintAvg: sessHints.length ? Math.round((sessHints.reduce((a, b) => a + b, 0) / sessHints.length) * 10) / 10 : null,
      byType,
    };
  },

  /**
   * 학생 한 명의 성과 리포트
   * @param {string} studentId
   * @param {'week'|'month'|'year'} range
   */
  report(studentId, range) {
    const db = this._read();
    const student = this._user(db, studentId);
    const all = this._dataOf(db, studentId).records;
    const within = (p) => all.filter((r) => r.date >= p.start && r.date <= p.end);
    const period = this._period(range, 0);
    const rs = within(period);
    const now = this._measure(rs);
    const prev = this._measure(within(this._period(range, 1)));
    const delta = (a, b) => (a === null || b === null ? null : Math.round((a - b) * 10) / 10);

    // 성장 그래프: 주간 = 요일별 · 월간 = 주차별 · 연간 = 월별
    let labels;
    let slot;
    if (range === 'year') {
      labels = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
      slot = (r) => Number(r.date.slice(5, 7)) - 1;
    } else if (range === 'month') {
      labels = ['1주', '2주', '3주', '4주'];
      slot = (r) => Math.min(3, Math.floor((Number(r.date.slice(8, 10)) - 1) / 7)); // 29일부터는 4주에 넣어요.
    } else {
      labels = ['월', '화', '수', '목', '금', '토', '일'];
      slot = (r) => diffDays(period.start, r.date);
    }
    const buckets = labels.map(() => []);
    rs.forEach((r) => buckets[slot(r)] && buckets[slot(r)].push(r));
    const graph = labels.map((label, i) => ({ label, value: this._measure(buckets[i]).solo, count: buckets[i].length }));

    const types = Object.values(QUESTION_TYPES).map((t) => ({ type: t, value: now.byType[t.id], delta: delta(now.byType[t.id], prev.byType[t.id]) }));
    const d = { solo: delta(now.solo, prev.solo), hintAvg: delta(now.hintAvg, prev.hintAvg) };

    // 성장 포인트: 좋아진 것만 긍정적인 문장으로 알려요.
    const word = { week: '지난주', month: '지난달', year: '작년' }[range];
    const points = [];
    if (d.solo > 0) points.push({ icon: '✅', title: '도움 없이 푸는 능력이 성장했어요.', text: `${word}보다 독립 해결률이 ${d.solo}%p 올랐어요.` });
    if (d.hintAvg < 0) points.push({ icon: '💡', title: '힌트를 덜 보고도 풀고 있어요.', text: `소단원 한 번에 보는 힌트가 ${word}보다 ${Math.abs(d.hintAvg)}회 줄었어요.` });
    types.filter((t) => t.delta > 0).forEach((t) => points.push({ icon: '🌱', title: `${t.type.name} 문제를 더 잘 풀게 됐어요.`, text: `${word}보다 성취도가 ${t.delta}%p 올랐어요.` }));
    if (!points.length && now.total) {
      points.push({ icon: '🌱', title: '꾸준히 공부하고 있어요.', text: `이 기간에 ${now.total}문제를 풀었어요. 한 걸음씩 나아가는 중이에요.` });
    }

    let headline = ['아직 학습 기록이 없어요', '문제를 풀면 여기에 성과가 나타나요.'];
    if (now.total) headline = ['꾸준히 공부하고 있어요!', `이 기간에 ${now.total}문제를 풀었습니다.`];
    if (d.hintAvg < 0) headline = ['힌트를 덜 보고 풀어요!', `${word}보다 적은 도움으로 문제를 풀고 있습니다.`];
    if (d.solo > 0) headline = ['혼자 해결하는 문제가 늘었어요!', `${word}보다 적은 도움으로 문제를 풀고 있습니다.`];

    return { student, range, period, total: now.total, solo: now.solo, hintAvg: now.hintAvg, delta: d, types, graph, points, headline };
  },
};
