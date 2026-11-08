/* =========================================================================
 * sim.js — 친구 사귀기 시뮬레이션 엔진
 *
 *  한 판(시뮬레이션) = 장면(node)이 차례로 놓인 줄(queue). 지금 장면이 끝나면 다음 장면으로 가요.
 *    say    친구 대사 · narr 상황 설명 · card 개념 설명 카드
 *    choice 사회성 선택지 (점수와 무관, 반응만 달라요)
 *    problem 교과 문제 (문제 화면으로 가요)
 *    gen    여기 오면 학습 데이터를 보고 다음 장면을 정해요 (적응형)
 *    end    끝 → 친구가 됨 / 복습 마침 / 레벨 테스트 마침
 *
 *  종류
 *    learn  처음 만나는 친구: 개념마다 [이야기 → 개념 설명 → 문제…] 숙달 기준에 닿으면 다음 개념.
 *           기준에 못 미치면 처음부터 되풀이하지 않고 재설명 · 변형 문제를 대화 사이에 넣어요. (보고서 4.6.1)
 *    review 친구의 재회 요청(느낌표)으로만 시작. 약한 개념 · 잦은 오답 · 힌트를 많이 쓴 유형 위주로 골라요.
 *    test   처음 한 번, 10문항 레벨 테스트 → 학습 시작점(학년 · 학기)
 *
 *  진행 상태는 장면이 바뀔 때마다 저장돼요. 쉬는 시간 · 뒤로 가기 · 앱을 닫아도 그 자리부터 이어서 해요.
 * ========================================================================= */

const TEST_KEY = '__test';
/** 자율 복습(방과후교실): 소단원마다 문제 수 · 한 번에 최대 문제 수 */
const FREE_PER_SUB = 3;
const FREE_MAX = 10;
const TEST_COUNT = 10;

/** 과목마다 있는 학습 수준 (학년 · 학기) — 쉬운 것부터 */
/**
 * 학습 순서. 국어 1학년은 확정 시나리오(도윤 → 하린 → 수아 → 민준)가 있는 2학기 단원을 먼저 하고,
 * 그다음 한글 기초(1학기 단원)를 해요. (이야기가 있는 단원으로 시작하게)
 */
const STORY_FIRST = { korean: { 1: 2 } };
function levelOrder(subject, lv) {
  const first = STORY_FIRST[subject] && STORY_FIRST[subject][lv.grade];
  return lv.grade * 10 + (first ? (lv.term === first ? 0 : lv.term) : lv.term);
}
function levelsOf(subject) {
  const seen = new Map();
  CHAPTERS.filter((c) => c.subject === subject).forEach((c) => {
    const k = `${c.grade}-${c.term || 1}`;
    if (!seen.has(k)) seen.set(k, { grade: c.grade, term: c.term || 1 });
  });
  return [...seen.values()].sort((a, b) => levelOrder(subject, a) - levelOrder(subject, b));
}
/** 이 학년에서 처음 배우는 학기 */
function firstLevelOf(subject, grade) {
  return levelsOf(subject).find((x) => x.grade === grade) || { grade, term: 1 };
}
function levelChapters(subject, lv) {
  return CHAPTERS.filter((c) => c.subject === subject && c.grade === lv.grade && (c.term || 1) === lv.term);
}
function nextLevel(subject, lv) {
  const all = levelsOf(subject);
  const i = all.findIndex((x) => x.grade === lv.grade && x.term === lv.term);
  return i >= 0 ? all[i + 1] || null : all[0];
}
function levelName(lv) {
  return lv ? `${lv.grade}학년 ${lv.term}학기` : '-';
}

/** 지금 학기 (8월 ~ 1월은 2학기) */
function currentTerm() {
  const m = hgNow().getMonth() + 1;
  return m >= 8 || m <= 1 ? 2 : 1;
}

const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

/** 이야기 저장본 버전: 시나리오가 바뀌면 올려요. 다른 버전으로 저장된 하던 이야기는 새로 시작해요. */
const SIM_VER = 4;

const Sim = {
  s: null, // 지금 시뮬레이션

  /* ------------------------------ 시작 ------------------------------ */
  /** 단원 시작 (이어하기가 있으면 그 자리부터) */
  open(chapterId, kind, reunionLine) {
    const key = kind === 'free' ? `free:${chapterId}` : chapterId;
    let saved = Store.sim(key);
    // 예전 버전에서 하던 이야기(예전 친구 · 예전 대사)는 버리고 확정 시나리오로 새로 시작해요.
    if (saved && (saved.v !== SIM_VER || (STORY_CAST[chapterId] && saved.friendId !== STORY_CAST[chapterId]))) {
      safely(() => Store.saveSim(key, null));
      saved = null;
    }
    if (saved && saved.kind === kind) {
      this.s = saved;
      this.show();
      // 하던 이야기로 돌아오면 친구가 반갑게 맞아 줘요. (나갈 때 쉬는 시간 인사와 같은 모양)
      if (['talk', 'quiz'].includes(State.screen)) setSheet({ kind: 'welcome', line: pickOne(WELCOME_BACK_LINES) });
      return;
    }
    const friendId = Store.castFriend(chapterId);
    this.s = {
      v: SIM_VER,
      key,
      kind,
      chapterId,
      friendId,
      sess: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      queue: [],
      qi: 0,
      ci: 0,
      started: {},
      count: {},
      remediated: {},
      lowConf: {},
      used: [],
      streak: 0,
      target: {},
      at: Date.now(),
    };
    if (kind === 'learn') this._learnIntro();
    else this._reviewIntro(reunionLine, kind === 'free');
    this.save();
    this.show();
  },

  /** 레벨 테스트 시작 */
  openTest() {
    let saved = Store.sim(TEST_KEY);
    if (saved && (saved.v !== SIM_VER || saved.hv !== 2)) {
      // 예전 방식(조각 10개)으로 하던 레벨 테스트는 처음부터
      safely(() => Store.saveSim(TEST_KEY, null));
      saved = null;
    }
    if (saved) {
      this.s = saved; // 모은 조각 · 지금 단계 그대로 이어서
      return go('hunt');
    }
    const user = Store.currentUser();
    const qs = this._testQuestions(user.grade);
    // 안내도 조각 찾기 (js/hunt.js): step = welcome → find → open → (문제) → got → … → map
    this.s = { v: SIM_VER, key: TEST_KEY, kind: 'test', friendId: null, sess: `test-${Date.now()}`, queue: [], qi: 0, used: [], results: [], qids: qs.map((x) => x.id), hv: 2, k: 0, j: 0, step: 'welcome', grade: user.grade, at: Date.now() };
    this.save();
    go('hunt');
  },

  /**
   * 레벨 테스트 문제: 교과서 문제(MAX_BANK)만 그대로 내요. (시각화형 · 단계분해형 같은 바꾼 문제는 내지 않아요)
   *  과목마다 5문제씩, 지금 학년까지의 단원에서 단원이 겹치지 않게 골라요.
   *  교과서 문제가 아직 없는 학년(2 · 3학년)은 있는 학년의 교과서 문제로 내요.
   */
  _testQuestions(grade) {
    const G = Math.max(1, Math.min(3, grade || 1));
    const r = genRng(Date.now() % 100000);
    const book = (ch) => ((window.MAX_BANK || {})[ch.id] || []).map((q) => getQuestion(q.id)).filter(Boolean);
    const bySubj = SUBJECTS.map(({ id: subj }) => {
      let chs = CHAPTERS.filter((c) => c.subject === subj && c.grade <= G && book(c).length);
      if (!chs.length) chs = CHAPTERS.filter((c) => c.subject === subj && book(c).length);
      chs = r.shuffle(chs);
      const out = [];
      for (let k = 0; out.length < TEST_COUNT / 2 && k < chs.length * 4; k++) {
        const pool = book(chs[k % chs.length]).filter((q) => !out.some((o) => o.id === q.id));
        if (pool.length) out.push(r.pick(pool));
      }
      return out;
    });
    const mixed = [];
    for (let i = 0; i < TEST_COUNT / 2; i++) bySubj.forEach((l) => l[i] && mixed.push(l[i]));
    return mixed.slice(0, TEST_COUNT);
  },

  /** 레벨 테스트 결과 → 과목마다 학습 시작점 */
  _placement(s) {
    const out = {};
    const G = Math.max(1, Math.min(3, s.grade || 1));
    SUBJECTS.forEach(({ id: subj }) => {
      const rs = s.results.filter((r) => r.subject === subj);
      let lv = null;
      for (let g = 1; g <= G && !lv; g++) {
        const at = rs.filter((r) => r.grade === g);
        if (at.length && at.filter((r) => r.correct).length / at.length < 0.6) lv = firstLevelOf(subj, g);
      }
      if (!lv) {
        const t = currentTerm();
        lv = { grade: G, term: levelChapters(subj, { grade: G, term: t }).length ? t : 1 };
        // 1학년 국어는 학기와 상관없이 이야기 단원부터
        if (STORY_FIRST[subj] && STORY_FIRST[subj][G]) lv = firstLevelOf(subj, G);
      }
      if (!levelChapters(subj, lv).length) lv = levelsOf(subj).filter((x) => x.grade <= lv.grade).pop() || levelsOf(subj)[0];
      out[subj] = lv;
    });
    return out;
  },

  /* ------------------------------ 장면 만들기 ------------------------------ */
  ctx() {
    const u = Store.currentUser();
    const ch = this.chapter();
    return { student: (u && (u.nick || u.name)) || '친구', friend: this.friend(), flags: ch ? Store.story(ch.subject).flags : {} };
  },
  friend() {
    return friendById(this.s ? this.s.friendId : 'jia');
  },
  chapter() {
    return this.s && CHAPTER_BY_ID[this.s.chapterId];
  },
  scenario() {
    return scenarioFor(this.chapter());
  },
  /** 확정 시나리오가 있는 단원이면 그 이야기 */
  story() {
    return this.s && STORIES[this.s.chapterId];
  },
  flags() {
    const ch = this.chapter();
    return ch ? Store.story(ch.subject).flags : {};
  },

  /**
   * 이야기 장면 → 장면 줄 (story.js의 쓰는 법)
   *  조건 · 학습 자리 · 엔딩은 그 자리에 왔을 때 정해요. (앞에서 고른 선택이 반영되게)
   */
  _compile(list, who) {
    const out = [];
    (list || []).forEach((x) => {
      if (typeof x === 'string') out.push(/^\(.*\)$/s.test(x) ? { t: 'narr', text: x } : { t: 'say', text: x, who });
      else if (Array.isArray(x)) out.push(/^\(.*\)$/s.test(x[1]) ? { t: 'narr', text: x[1], who: x[0], mood: x[2] } : { t: 'say', who: x[0], text: x[1], mood: x[2] });
      else if (x.if !== undefined) out.push({ t: 'if', cond: x.if, then: x.then || [], else: x.else || [] });
      else if (x.choice) out.push({ t: 'choice', key: x.choice, theme: x.theme || 'together', who: x.who, say: x.say, options: x.options });
      else if (x.learn !== undefined) out.push({ t: 'slot', ci: x.learn });
      else if (x.revisit) out.push({ t: 'revisit' });
      else if (x.ending) out.push({ t: 'ending', subject: x.ending });
      else if (x.bg) out.push({ t: 'bg', bg: x.bg });
    });
    return out;
  },

  _lines(list, mood) {
    return (list || []).map((text) => (/^\(.*\)$/s.test(text) ? { t: 'narr', text } : { t: 'say', text, mood }));
  },

  _social(theme, k) {
    const sc = socialFor(this.chapter(), theme, k);
    return { t: 'choice', theme, key: `${theme}:${SOCIAL[theme].indexOf(sc)}`, say: sc.say, options: sc.options };
  },

  _card(ci, again) {
    const ch = this.chapter();
    const card = ch.concept.cards[ci] || {};
    return { t: 'card', ci, icon: card.icon || '💡', title: ch.subunits[ci].title, text: card.text || '', again: !!again };
  },

  _learnIntro() {
    const st = this.story();
    if (st) {
      this.s.script = true;
      this.s.queue.push(...this._compile(st.scenes), { t: 'end' });
      return;
    }
    const sc = this.scenario();
    const q = this.s.queue;
    q.push(...this._lines(sc.intro));
    q.push(this._social('greet', 0));
    q.push({ t: 'gen' });
  },

  _reviewIntro(line, free) {
    const st = this.story();
    const sc = this.scenario();
    const data = Store.getData();
    const q = this.s.queue;
    const scores = Mastery.chapterScores(data, this.s.chapterId);
    this.s.before = Math.round(mean(scores.map((x) => x.M)));
    // 개념마다 문제 수
    //  복습(느낌표): 숙달 · 신뢰도가 모두 높으면 확인 문제 하나, 아니면 재설명 + 두 문제
    //  자율 복습(방과후교실): 소단원마다 3문제, 모두 합쳐 10문제까지
    scores.forEach((x, i) => {
      const good = Mastery.done(x);
      this.s.target[i] = free ? FREE_PER_SUB : good ? 1 : 2;
      if (!good && x.M < MASTERY_RULES.passM) this.s.remediated[i] = 'need';
    });
    if (free) this.s.cap = FREE_MAX;
    q.push({ t: 'narr', text: `(${josa(this.friend().name, '이', '가')} 반갑게 다가와요.)` });
    q.push({ t: 'say', text: line || pickOne(REUNION_LINES), mood: 'happy' });
    if (st) q.push({ t: 'say', text: pickOne(st.reunion) });
    else q.push(...this._lines(sc.reunion));
    if (!free) q.push(this._social(sc.theme, 1));
    q.push({ t: 'gen' });
  },

  /** gen 장면: 학습 데이터를 보고 다음 장면을 정해요. */
  _plan() {
    const s = this.s;
    const ch = this.chapter();
    const data = Store.getData();
    const add = [];
    const problem = (ci, action, extra) => {
      const concept = `${ch.id}:${ci}`;
      const q = Mastery.pick(data, concept, { used: new Set(s.used), action, review: s.kind === 'review', seed: (Date.now() % 100000) + s.used.length * 31 });
      if (q) add.push({ t: 'problem', qid: q.id, ci, action, ...(extra || {}) });
    };

    if (s.kind === 'learn') {
      const sc = this.scenario();
      for (let guard = 0; guard < 10; guard++) {
        if (s.ci >= ch.subunits.length) {
          // 친구가 되기 전에: 기준에 못 닿은 개념만 골라 한 번 더 (단원 전체를 되풀이하지 않아요)
          const weak = ch.subunits.map((_, i) => i).filter((i) => !Mastery.done(Mastery.score(data, `${ch.id}:${i}`)));
          if (weak.length && !s.round2) {
            s.round2 = weak;
            s.ci = weak[0];
            weak.forEach((i) => ((s.count[i] = 0), (s.remediated[i] = 0)));
            add.push({ t: 'say', text: '친구 되기 전에, 아까 조금 헷갈렸던 거 딱 한 번만 더 같이 해 볼까?', mood: 'think' });
            continue;
          }
          add.push(...this._lines(sc.ending, 'happy'), { t: 'end' });
          break;
        }
        const ci = s.ci;
        if (s.round2 && !s.round2.includes(ci)) {
          s.ci += 1;
          continue;
        }
        const beat = sc.concepts[ci] || {};
        if (!s.started[ci]) {
          s.started[ci] = 1;
          add.push(...this._lines(beat.story));
          add.push(this._card(ci));
          if (beat.problem && !s.used.includes(beat.problem.id)) add.push({ t: 'problem', qid: beat.problem.id, ci, action: 'story', after: beat.after });
          else problem(ci, 'start', { after: beat.after });
          break;
        }
        const score = Mastery.score(data, `${ch.id}:${ci}`);
        const n = s.count[ci] || 0;
        const cap = s.round2 ? MASTERY_RULES.revisitMax : MASTERY_RULES.perConceptMax;
        if (Mastery.done(score) || n >= cap) {
          if (Mastery.done(score)) delete s.lowConf[ci];
          else s.lowConf[ci] = 1; // 기준엔 못 닿았지만 너무 길어지지 않게 넘어가고, 복습에서 다시 봐요
          s.ci += 1;
          if (!s.round2 && (s.ci === 1 || s.ci === 2)) add.push(sc.theme === 'greet' ? (s.ci === 1 ? this._social('greet', 1) : this._social('empathy', 0)) : this._social(sc.theme, s.ci - 1));
          continue;
        }
        const action = Mastery.nextAction(score);
        if (action === 'remediate' && !s.remediated[ci]) {
          s.remediated[ci] = 1;
          add.push({ t: 'say', text: pickOne(REMEDIATE_LINES), mood: 'think' }, this._card(ci, true));
        } else add.push({ t: 'say', text: pickOne(TRANSITION) });
        problem(ci, action);
        break;
      }
    } else if (s.kind === 'review' || s.kind === 'free') {
      const total = Object.values(s.count).reduce((a, b) => a + b, 0);
      for (let guard = 0; guard < 10; guard++) {
        if (s.ci >= ch.subunits.length || (s.cap && total >= s.cap)) {
          add.push({ t: 'say', text: pickOne(['오늘도 같이 해서 정말 재밌었어!', '너랑 하니까 시간 가는 줄 몰랐어!', '와, 우리 오늘 엄청 많이 했다!']), mood: 'happy' }, { t: 'say', text: pickOne(['다음에 또 놀자! 약속!', '{부름}, 또 놀러 와!', '내일도 기다릴게!']), mood: 'happy' }, { t: 'end' });
          break;
        }
        const ci = s.ci;
        if ((s.count[ci] || 0) >= (s.target[ci] || 1)) {
          s.ci += 1;
          continue;
        }
        if (s.remediated[ci] === 'need') {
          s.remediated[ci] = 1;
          add.push({ t: 'say', text: '이거 기억나? 같이 한 번 더 보자!', mood: 'think' }, this._card(ci, true));
        } else add.push({ t: 'say', text: pickOne(TRANSITION) });
        problem(ci, (s.count[ci] || 0) === 0 ? 'confirm' : 'start');
        break;
      }
    }
    // 끝이 아니면 다음 장면을 정할 자리를 남겨요.
    if (!add.some((x) => x.t === 'end')) add.push({ t: 'gen' });
    s.queue.splice(s.qi + 1, 0, ...add);
  },

  /* ------------------------------ 진행 ------------------------------ */
  node() {
    return this.s && this.s.queue[this.s.qi];
  },

  save() {
    if (this.s) safely(() => Store.saveSim(this.s.key, this.s));
  },

  /** 다음 장면으로 */
  next() {
    const s = this.s;
    if (!s) return go('home');
    // 되돌아가기(◀)용: 대사 · 개념 카드만 쌓고, 문제나 선택을 지나면 비워요.
    const cur = this.node();
    if (cur && ['say', 'narr', 'card'].includes(cur.t)) (s.back = s.back || []).push(s.qi);
    else s.back = [];
    s.qi += 1;
    for (let guard = 0; guard < 200 && this.node() && this._control(this.node()); guard++) s.qi += 1;
    this.save();
    this.show();
  },

  /** 앞 대사로 되돌아가기 (◀ 버튼) */
  back() {
    const s = this.s;
    if (!s || !s.back || !s.back.length) return;
    s.qi = s.back.pop();
    this.save();
    this.show();
  },
  canBack() {
    return !!(this.s && this.s.back && this.s.back.length);
  },

  /** 화면 없이 처리하는 장면. 한 번 처리한 장면은 되돌아갔다 다시 와도 또 처리하지 않아요. */
  _control(n) {
    if (n.done) return true;
    const r = this._control1(n);
    if (r) n.done = true;
    return r;
  },

  _control1(n) {
    const s = this.s;
    if (n.t === 'bg') {
      s.bg = n.bg;
      return true;
    }
    const put = (list) => s.queue.splice(s.qi + 1, 0, ...list);
    if (n.t === 'gen') {
      this._plan();
      return true;
    }
    if (n.t === 'if') {
      put(this._compile(storyCond(n.cond, this.flags()) ? n.then : n.else));
      return true;
    }
    if (n.t === 'slot') {
      // 소단원 학습 자리: 개념 카드 → 문제 → (숙달될 때까지) 문제
      s.ci = n.ci;
      s.started[n.ci] = 1;
      put([this._card(n.ci), ...this._pickProblem(n.ci, 'start'), { t: 'slotgen', ci: n.ci }]);
      return true;
    }
    if (n.t === 'slotgen' || n.t === 'reslot') {
      const ci = n.ci;
      const data = Store.getData();
      const score = Mastery.score(data, `${s.chapterId}:${ci}`);
      if (n.t === 'reslot') {
        s.count[ci] = 0;
        put([{ t: 'say', text: pickOne(TRANSITION) }, this._card(ci, true), ...this._pickProblem(ci, 'remediate'), { t: 'slotgen', ci, re: 1 }]);
        return true;
      }
      const cap = n.re ? MASTERY_RULES.revisitMax : MASTERY_RULES.perConceptMax;
      if (Mastery.done(score) || (s.count[ci] || 0) >= cap) {
        if (Mastery.done(score)) delete s.lowConf[ci];
        else s.lowConf[ci] = 1; // 너무 길어지지 않게 이야기를 이어 가고, 복습에서 다시 봐요
        return true;
      }
      const action = Mastery.nextAction(score);
      const lead = [];
      if (action === 'remediate' && !s.remediated[ci]) {
        s.remediated[ci] = 1;
        lead.push({ t: 'say', text: pickOne(REMEDIATE_LINES), mood: 'think' }, this._card(ci, true));
      } else lead.push({ t: 'say', text: pickOne(TRANSITION) });
      const prob = this._pickProblem(ci, action);
      if (!prob.length) return true;
      put([...lead, ...prob, { t: 'slotgen', ci, re: n.re }]);
      return true;
    }
    if (n.t === 'revisit') {
      // 친구가 되기 전에: 기준에 못 닿은 소단원만 한 번 더 (이야기 전체를 되풀이하지 않아요)
      const ch = this.chapter();
      const data = Store.getData();
      const weak = ch.subunits.map((_, i) => i).filter((i) => s.started[i] && !Mastery.done(Mastery.score(data, `${ch.id}:${i}`)));
      if (weak.length && !s.round2) {
        s.round2 = weak;
        put([{ t: 'say', text: '친구 되기 전에, 아까 조금 헷갈렸던 거 딱 한 번만 더 같이 해 볼까?', mood: 'think' }, ...weak.map((ci) => ({ t: 'reslot', ci }))]);
      }
      return true;
    }
    if (n.t === 'ending') {
      const end = storyEnding(n.subject, this.flags());
      if (end) {
        safely(() => Store.setStoryEnding(n.subject, end.id));
        put([{ t: 'narr', text: `(✨ 엔딩 · ${end.title} ✨)` }, ...this._compile(end.lines)]);
      }
      return true;
    }
    return false;
  },

  /** 이 소단원에서 풀 문제 하나 (없으면 빈 줄) */
  _pickProblem(ci, action) {
    const s = this.s;
    const q = Mastery.pick(Store.getData(), `${s.chapterId}:${ci}`, { used: new Set(s.used), action, review: false, seed: (Date.now() % 100000) + s.used.length * 31 });
    return q ? [{ t: 'problem', qid: q.id, ci, action }] : [];
  },

  /** 지금 장면에 맞는 화면으로 */
  show() {
    if (this.s && this.s.kind === 'test') return go('hunt');
    const n = this.node();
    if (!n) {
      // 줄이 끊겼으면 (예전 저장본 등) 다음 장면을 다시 정해요.
      if (this.s.kind === 'test' || this.s.script) return this.finish();
      this.s.queue.push({ t: 'gen' });
      this.s.qi = this.s.queue.length - 2;
      return this.next();
    }
    if (['gen', 'if', 'slot', 'slotgen', 'reslot', 'revisit', 'ending', 'bg'].includes(n.t)) {
      for (let guard = 0; guard < 200 && this.node() && this._control(this.node()); guard++) this.s.qi += 1;
      this.save();
      return this.show();
    }
    if (n.t === 'end') return this.finish();
    if (this.s.kind === 'test') return go('hunt');
    if (n.t === 'problem') {
      const q = getQuestion(n.qid);
      if (!q) return this.next();
      startSimQuiz(q, n);
      return;
    }
    go('talk', { talkMood: n.mood || null, talkPick: null });
  },

  /** 사회성 선택 */
  choose(i) {
    const n = this.node();
    if (!n || n.t !== 'choice' || n.picked !== undefined) return;
    const opt = n.options[i];
    if (!opt) return;
    n.picked = i;
    safely(() => Store.recordSocial({ chapterId: this.s.chapterId, key: n.key, theme: n.theme, choice: i, mood: opt.mood, kind: this.s.kind }));
    const ch = this.chapter();
    if (opt.set && ch) safely(() => Store.setStoryFlags(ch.subject, opt.set));
    // 확정 시나리오의 반응은 장면 줄, 예전 사회성 장면은 이 친구의 대사
    const replies = this._compile(opt.reply, n.who).map((x) => (x.t === 'say' && !x.mood ? { ...x, mood: opt.mood } : x));
    // 미숙한 선택(retry): 친구의 반응 → 짧은 도움말 → 같은 상황에서 다시 골라요. (고른 보기는 빼고)
    if (opt.retry) {
      if (opt.tip) replies.push({ t: 'narr', text: opt.tip, tip: true });
      const left = n.options.filter((o, k) => k !== i && !(n.gone || []).includes(k));
      if (left.length) replies.push({ ...n, picked: undefined, done: undefined, again: true, say: opt.again || n.say, options: n.options, gone: [...(n.gone || []), i] });
    }
    this.s.queue.splice(this.s.qi + 1, 0, ...replies);
    this.next();
  },

  /**
   * 문제를 마쳤을 때 (문제 화면이 불러요)
   * @param r { q, firstCorrect, finalCorrect, tries, hintLv, wrong, rep, input, ms }
   */
  problemDone(r) {
    const s = this.s;
    const n = this.node();
    const q = r.q;
    const data = Store.getData();
    const concept = `${q.chapterId}:${q.sub}`;
    const variant = Mastery.isVariant(data, concept, q);
    // 평소보다 빨랐는지 (칭찬에 써요)
    const times = data.records.filter((x) => x.concept === concept && x.ms > 0).map((x) => x.ms).sort((a, b) => a - b);
    const faster = times.length >= 3 && r.ms < times[Math.floor(times.length / 2)] * 0.8;
    const saved = safely(() =>
      Store.recordSim(q, { ...r, mode: s.kind === 'review' ? 'review' : s.kind === 'test' ? 'test' : 'sim', sess: s.sess, variant })
    );
    if (!saved.ok) return;
    s.used.push(q.id);

    if (s.kind === 'test') {
      s.results.push({ qid: q.id, subject: q.subject, grade: q.grade, correct: r.firstCorrect, input: r.input });
      return Hunt.afterProblem();
    }
    const ci = n.ci !== undefined ? n.ci : q.sub;
    s.count[ci] = (s.count[ci] || 0) + 1;
    s.streak = r.firstCorrect ? (s.streak || 0) + 1 : 0;
    if (s.kind === 'review' && !r.firstCorrect) s.target[ci] = Math.min(4, (s.target[ci] || 1) + 1); // 복습에서 막히면 한 문제 더

    const add = [];
    if (r.finalCorrect) {
      add.push({ t: 'say', text: praiseFor({ tries: r.tries, hintLv: r.hintLv, rep: r.rep, streak: s.streak, faster }), mood: 'happy' });
      if (n.after) add.push(...this._lines(n.after, 'happy'));
    } else {
      add.push({ t: 'say', text: pickOne(SHOW_HOW), mood: 'think' });
      add.push({ t: 'say', text: q.solution, mood: 'think', solution: true });
      add.push({ t: 'say', text: pickOne(AFTER_SHOW), mood: 'happy' });
    }
    s.queue.splice(s.qi + 1, 0, ...add);
    this.next();
  },

  /** 끝 */
  finish() {
    const s = this.s;
    if (!s) return go('home');
    if (s.kind === 'test') {
      const place = this._placement(s);
      safely(() => Store.setPlacement({ ...place, result: { correct: s.results.filter((r) => r.correct).length, total: s.results.length } }, 'test'));
      safely(() => Store.saveSim(TEST_KEY, null));
      this.s = null;
      return go('home');
    }
    const chId = s.chapterId;
    if (s.kind === 'learn') {
      const scores = Mastery.chapterScores(Store.getData(), chId);
      safely(() => Store.makeFriend(chId, { friendId: s.friendId, M: Math.round(mean(scores.map((x) => x.M))), lowConf: Object.keys(s.lowConf).length > 0 }));
      safely(() => Store.saveSim(chId, null));
      this.s = null;
      return go('friendmade', { chapterId: chId, madeFriend: s.friendId });
    }
    if (s.kind === 'free') {
      safely(() => Store.saveSim(s.key, null));
      this.s = null;
      toast('친구랑 신나게 놀았어요!');
      return go('after');
    }
    safely(() => Store.finishReview(chId, s.before));
    safely(() => Store.saveSim(chId, null));
    this.s = null;
    toast('친구와 다시 만나서 즐거웠어요!');
    return go('room');
  },

  /** 나가기 (진행 상태는 이미 저장돼 있어요) */
  leave() {
    const s = this.s;
    this.save();
    this.s = null;
    Speech.stop();
    if (s && s.kind === 'test') return go('home');
    if (s && s.kind === 'free') return go('after');
    go('room', { subject: (CHAPTER_BY_ID[s && s.chapterId] || {}).subject || State.subject });
  },
};
