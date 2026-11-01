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
const TEST_COUNT = 10;

/** 과목마다 있는 학습 수준 (학년 · 학기) — 쉬운 것부터 */
function levelsOf(subject) {
  const seen = new Map();
  CHAPTERS.filter((c) => c.subject === subject).forEach((c) => {
    const k = `${c.grade}-${c.term || 1}`;
    if (!seen.has(k)) seen.set(k, { grade: c.grade, term: c.term || 1 });
  });
  return [...seen.values()].sort((a, b) => a.grade - b.grade || a.term - b.term);
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

const Sim = {
  s: null, // 지금 시뮬레이션

  /* ------------------------------ 시작 ------------------------------ */
  /** 단원 시작 (이어하기가 있으면 그 자리부터) */
  open(chapterId, kind, reunionLine) {
    const saved = Store.sim(chapterId);
    if (saved && saved.kind === kind) {
      this.s = saved;
      return this.show();
    }
    const friendId = Store.castFriend(chapterId);
    this.s = {
      key: chapterId,
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
    else this._reviewIntro(reunionLine);
    this.save();
    this.show();
  },

  /** 레벨 테스트 시작 */
  openTest() {
    const saved = Store.sim(TEST_KEY);
    if (saved) {
      this.s = saved;
      return this.show();
    }
    const user = Store.currentUser();
    const qs = this._testQuestions(user.grade);
    this.s = { key: TEST_KEY, kind: 'test', friendId: 'jia', sess: `test-${Date.now()}`, queue: [], qi: 0, used: [], results: [], grade: user.grade, at: Date.now() };
    const q = this.s.queue;
    q.push({ t: 'narr', text: '(새 학교에 온 첫날. 누군가 반갑게 손을 흔들어요.)' });
    q.push({ t: 'say', text: '안녕! 나는 지아야. 우리 학교에 온 걸 환영해!', mood: 'happy' });
    q.push({ t: 'say', text: '교실에 가기 전에 문제 몇 개만 같이 풀어 볼래?\n틀려도 괜찮아. 아는 만큼만 하면 돼!' });
    qs.forEach((x) => q.push({ t: 'problem', qid: x.id, test: true }));
    q.push({ t: 'say', text: '끝까지 해냈다! 정말 열심히 했어.', mood: 'happy' });
    q.push({ t: 'say', text: '이제 교실로 가 보자. 새 친구들이 기다리고 있어!', mood: 'happy' });
    q.push({ t: 'end' });
    this.save();
    this.show();
  },

  /**
   * 레벨 테스트 문제: 지금 학년까지의 내용만 (1학년이면 1학년, 3학년이면 1~3학년)
   *  과목마다 5문제씩, 교과서 수준(쉬움 · 보통)에서 단원이 겹치지 않게 골라요.
   */
  _testQuestions(grade) {
    const G = Math.max(1, Math.min(3, grade || 1));
    const alloc = { 1: [5], 2: [2, 3], 3: [1, 2, 2] }[G];
    const r = genRng(Date.now() % 100000);
    const bySubj = SUBJECTS.map(({ id: subj }) => {
      const out = [];
      alloc.forEach((n, gi) => {
        const chs = r.shuffle(CHAPTERS.filter((c) => c.subject === subj && c.grade === gi + 1));
        for (let k = 0; out.length < alloc.slice(0, gi + 1).reduce((a, b) => a + b, 0) && k < chs.length * 3; k++) {
          const ch = chs[k % chs.length];
          const pool = ch.questions.map((q) => getQuestion(q.id)).filter((q) => q && !q.textbook && q.level !== '상' && !out.some((o) => o.id === q.id));
          if (pool.length) out.push(r.pick(pool));
        }
      });
      return out;
    });
    const mixed = [];
    for (let i = 0; i < 5; i++) bySubj.forEach((l) => l[i] && mixed.push(l[i]));
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
        if (at.length && at.filter((r) => r.correct).length / at.length < 0.6) lv = { grade: g, term: 1 };
      }
      if (!lv) {
        const t = currentTerm();
        lv = { grade: G, term: levelChapters(subj, { grade: G, term: t }).length ? t : 1 };
      }
      if (!levelChapters(subj, lv).length) lv = levelsOf(subj).filter((x) => x.grade <= lv.grade).pop() || levelsOf(subj)[0];
      out[subj] = lv;
    });
    return out;
  },

  /* ------------------------------ 장면 만들기 ------------------------------ */
  ctx() {
    const u = Store.currentUser();
    return { student: (u && (u.nick || u.name)) || '친구', friend: this.friend() };
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
    const sc = this.scenario();
    const q = this.s.queue;
    q.push(...this._lines(sc.intro));
    q.push(this._social('greet', 0));
    q.push({ t: 'gen' });
  },

  _reviewIntro(line) {
    const sc = this.scenario();
    const data = Store.getData();
    const q = this.s.queue;
    const scores = Mastery.chapterScores(data, this.s.chapterId);
    this.s.before = Math.round(mean(scores.map((x) => x.M)));
    // 개념마다 문제 수: 숙달 · 신뢰도가 모두 높으면 확인 문제 하나, 아니면 재설명 + 두 문제
    scores.forEach((x, i) => {
      const good = Mastery.done(x);
      this.s.target[i] = good ? 1 : 2;
      if (!good && x.M < MASTERY_RULES.passM) this.s.remediated[i] = 'need';
    });
    q.push({ t: 'narr', text: `(${josa(this.friend().name, '이', '가')} 반갑게 다가와요.)` });
    q.push({ t: 'say', text: line || pickOne(REUNION_LINES), mood: 'happy' });
    q.push(...this._lines(sc.reunion));
    q.push(this._social(sc.theme, 1));
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
    } else if (s.kind === 'review') {
      for (let guard = 0; guard < 10; guard++) {
        if (s.ci >= ch.subunits.length) {
          add.push({ t: 'say', text: '오늘도 같이 해서 정말 재밌었어!', mood: 'happy' }, { t: 'say', text: '다음에 또 놀자! 약속!', mood: 'happy' }, { t: 'end' });
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
    s.qi += 1;
    while (this.node() && this.node().t === 'gen') {
      this._plan();
      s.qi += 1;
    }
    this.save();
    this.show();
  },

  /** 지금 장면에 맞는 화면으로 */
  show() {
    const n = this.node();
    if (!n) {
      // 줄이 끊겼으면 (예전 저장본 등) 다음 장면을 다시 정해요.
      if (this.s.kind === 'test') return this.finish();
      this.s.queue.push({ t: 'gen' });
      this.s.qi = this.s.queue.length - 2;
      return this.next();
    }
    if (n.t === 'gen') return this.next();
    if (n.t === 'end') return this.finish();
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
    n.picked = i;
    safely(() => Store.recordSocial({ chapterId: this.s.chapterId, key: n.key, theme: n.theme, choice: i, mood: opt.mood, kind: this.s.kind }));
    const replies = opt.reply.map((text) => ({ t: 'say', text, mood: opt.mood }));
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
      s.results.push({ qid: q.id, subject: q.subject, grade: q.grade, correct: r.firstCorrect });
      return this.next();
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
      add.push({ t: 'say', text: '다음엔 분명히 할 수 있을 거야. 같이 또 해 보자!', mood: 'happy' });
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
    go('room');
  },
};
