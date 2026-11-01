/* =========================================================================
 * mastery.js — 개념별 숙달도 · 판단 신뢰도 · 학습 방식 개인화 · 적응형 복습
 *
 *  보고서 2.2.7 · 2.2.8 · 4.3.2 의 산식을 그대로 옮겼어요.
 *
 *  핵심 개념 = 대단원의 소단원 하나 ("단원id:소단원번호"). 모든 문제는 개념 하나에 묶여요.
 *
 *  ① 숙달도 (Mastery Score, 0~100)
 *     최초 학습   M_initial = 100 × (0.50A + 0.25H + 0.1875T + 0.0625S)
 *     복습 이후   M         = 100 × (0.40A + 0.20H + 0.15T + 0.20R + 0.05S)
 *       A 첫 시도 정답률 · H 힌트 독립성 · T 시도 횟수 점수 · R 복습 후 기억 유지 · S 결과 안정성 (모두 0~1)
 *     보정: 변형 문제를 거듭 못 풀거나, 높은 단계 힌트에 기대거나, 같은 오답이 되풀이되면 숙달로 보지 않아요.
 *
 *  ② 판단 신뢰도 (Confidence, 0~100)
 *     최초 학습   C_initial = 100 × (N + V + D + H + K + S) ÷ 6
 *     복습 이후   C         = 100 × (N + V + D + H + K + P + S) ÷ 7
 *       N 문제 수 · V 유형 다양성 · D 난이도 다양성 · H 힌트 독립성 · K 반복 성공 · P 복습 이력 · S 안정성
 *     40 미만 LOW · 70 미만 MEDIUM · 70 이상 HIGH
 *
 *  ③ 단원 완료(친구 되기): 모든 개념이 M ≥ 75 · C ≥ 70 · 힌트 없이 푼 변형 문제 ≥ 1 · 미해결 반복 오답 없음
 *
 *  ④ 학습 방식 개인화: 시각화형 · 단계분해형 · 고차원적 사고 지원형을 33.3%씩 내고,
 *     유형마다 5문항이 새로 쌓일 때마다 비교해서 +10%p / −5%p 조정 (최대 60% · 최소 20%)
 *
 *  ⑤ 적응형 복습: 친구가 된 다음 날 첫 복습 → 잘 기억하면 간격을 늘리고, 많이 잊으면 줄여요.
 *
 *  기준값은 자문 · 테스트로 바뀔 수 있어서 MASTERY_RULES 한 곳에 모았어요.
 * ========================================================================= */

const MASTERY_RULES = {
  passM: 75, // 숙달 기준
  passC: 70, // 신뢰도 HIGH 기준
  lowC: 40, // 신뢰도 LOW 기준
  nFull: 6, // N = 이만큼 풀면 1
  kFull: 4, // K = 첫 시도에 이만큼 맞히면 1
  pFull: 2, // P = 복습을 이만큼 하면 1
  stableWin: 6, // S = 최근 이만큼의 첫 시도 결과로 계산
  perConceptMax: 9, // 한 개념에서 한 번에 푸는 최대 문제 수 (넘으면 다음 개념으로)
  revisitMax: 5, // 단원 끝에서 기준 미달 개념을 다시 볼 때 최대 문제 수 (그래도 미달이면 친구가 되고 복습에서 다시 봐요)
  reviewGaps: [1, 3, 7, 14, 30], // 복습 간격(일)
  typeMin: 5, // 유형 비율을 조정하려면 유형마다 필요한 새 문항 수
  typeGap: 0.15, // 다른 두 유형 평균보다 이만큼 높아야 해요 (15%p)
  typeUp: 10, // 올리는 비율 (%p)
  typeDown: 5, // 나머지 두 유형에서 내리는 비율 (%p)
  typeMax: 60,
  typeFloor: 20,
};

const MASTERY_TYPES = ['visual', 'step', 'think'];
const LEVEL_STEPS = ['하', '중', '상'];

/** 날짜 당기기 (시연용 ?day=3 → 사흘 뒤로) — 오늘 날짜를 쓰는 곳은 모두 hgNow()를 거쳐요. */
const HG_DAY_OFFSET = (() => {
  try {
    const q = new URLSearchParams(location.search).get('day');
    if (q !== null) sessionStorage.setItem('hg-day', q);
    return Number(sessionStorage.getItem('hg-day')) || 0;
  } catch (e) {
    return 0;
  }
})();
function hgNow() {
  return new Date(Date.now() + HG_DAY_OFFSET * 86400000);
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const Mastery = {
  /** 이 개념의 학습 기록 (시뮬레이션 · 복습에서 푼 것만) */
  records(data, concept) {
    return (data.records || []).filter((r) => r.concept === concept && (r.mode === 'sim' || r.mode === 'review'));
  },

  /** 이 개념에서 낼 수 있는 유형 · 난이도 수 (없는 유형까지 요구하지 않으려고) */
  available(concept) {
    const qs = this.pool(concept, 1);
    return { types: Math.max(1, new Set(qs.map((q) => q.type)).size), levels: Math.max(1, new Set(qs.map((q) => q.level)).size) };
  },

  /**
   * 개념 하나의 점수
   * @returns {{M, C, level, initial, n, parts, variantSolved, repeatedError, weakError, flags[]}}
   */
  score(data, concept) {
    const rs = this.records(data, concept);
    const R_ = MASTERY_RULES;
    const n = rs.length;
    if (!n) return { M: 0, C: 0, level: 'LOW', initial: true, n: 0, parts: {}, variantSolved: false, repeatedError: false, flags: [] };

    const firsts = rs.map((r) => (r.correct ? 1 : 0));
    const hintOf = (r) => Math.min(2, r.hintLv !== undefined ? r.hintLv : r.hint ? 1 : 0);
    const A = mean(firsts);
    const H = 1 - mean(rs.map((r) => hintOf(r) / 2));
    const T = mean(rs.map((r) => ((r.tries || 1) <= 1 ? 1 : r.tries === 2 ? 0.5 : 0)));
    const win = firsts.slice(-R_.stableWin);
    let changes = 0;
    for (let i = 1; i < win.length; i++) if (win[i] !== win[i - 1]) changes++;
    const S = win.length < 2 ? 0.5 : 1 - changes / (win.length - 1);

    // 복습: 마지막 복습에서 첫 시도에 맞힌 비율
    const reviews = rs.filter((r) => r.mode === 'review');
    const reviewSess = [...new Set(reviews.map((r) => r.sess))];
    const initial = reviewSess.length === 0;
    const lastSess = reviewSess[reviewSess.length - 1];
    const R = initial ? null : mean(reviews.filter((r) => r.sess === lastSess).map((r) => (r.correct ? 1 : 0)));

    let M = initial ? 100 * (0.5 * A + 0.25 * H + 0.1875 * T + 0.0625 * S) : 100 * (0.4 * A + 0.2 * H + 0.15 * T + 0.2 * R + 0.05 * S);

    const avail = this.available(concept);
    const N = clamp01(n / R_.nFull);
    const V = clamp01(new Set(rs.map((r) => r.type)).size / Math.min(3, avail.types));
    const D = clamp01(new Set(rs.map((r) => r.level)).size / Math.min(3, avail.levels));
    const K = clamp01(firsts.reduce((a, b) => a + b, 0) / R_.kFull);
    const P = clamp01(reviewSess.length / R_.pFull);
    let C = initial ? (100 * (N + V + D + H + K + S)) / 6 : (100 * (N + V + D + H + K + P + S)) / 7;

    // ---- 보정 ----
    const flags = [];
    const variants = rs.filter((r) => r.variant);
    const variantSolved = variants.some((r) => r.correct && !hintOf(r));
    if (!variantSolved && variants.filter((r) => !r.correct).length >= 2) {
      M = Math.min(M, R_.passM - 1);
      flags.push('variant'); // 같은 모양은 풀지만 변형 문제에서 거듭 막혀요
    }
    if (rs.length >= 2 && rs.filter((r) => hintOf(r) >= 2).length / rs.length >= 0.5) {
      M = Math.min(M, R_.passM - 1);
      flags.push('hint'); // 높은 단계 힌트에 기대요
    }
    // 같은 오답 유형이 두 번 이상, 그 뒤로 첫 시도에 맞힌 적이 없으면 "미해결"
    const keys = {};
    let repeatedError = false;
    let weakError = null;
    rs.forEach((r, i) => {
      if (r.wrong) keys[r.wrong] = (keys[r.wrong] || []).concat(i);
    });
    Object.entries(keys).forEach(([k, idx]) => {
      if (idx.length < 2) return;
      const fixed = rs.slice(idx[idx.length - 1] + 1).some((r) => r.correct);
      if (!fixed) (repeatedError = true), (weakError = k);
    });
    if (repeatedError) flags.push('error');
    if (!initial) {
      const before = rs.filter((r) => r.mode === 'sim');
      if (before.length && mean(before.map((r) => (r.correct ? 1 : 0))) - R >= 0.4) flags.push('forgot'); // 많이 잊었어요
    }

    M = Math.round(M);
    C = Math.round(C);
    const level = C >= R_.passC ? 'HIGH' : C >= R_.lowC ? 'MEDIUM' : 'LOW';
    return { M, C, level, initial, n, parts: { A, H, T, R, S, N, V, D, K, P }, variantSolved, repeatedError, weakError, flags };
  },

  /** 개념 숙달 (단원 완료 조건) */
  done(sc) {
    return sc.M >= MASTERY_RULES.passM && sc.C >= MASTERY_RULES.passC && sc.variantSolved && !sc.repeatedError;
  },

  /**
   * 다음 학습 행동 (보고서 2.2.7.3 표)
   *  advance   숙달 · 신뢰도 모두 높음 → 다음 개념으로
   *  confirm   숙달 높음 · 신뢰도 낮음 → 다른 유형의 확인 문제
   *  remediate 숙달 낮음 · 신뢰도 높음 → 취약점: 재설명 + 단계 문제 + 쉬운 변형 → 일반 변형
   *  diagnose  숙달 · 신뢰도 모두 낮음 → 추가 진단 문제
   */
  nextAction(sc) {
    if (this.done(sc)) return 'advance';
    const hiM = sc.M >= MASTERY_RULES.passM;
    const hiC = sc.C >= MASTERY_RULES.passC;
    if (hiM) return 'confirm'; // 신뢰도가 낮거나, 변형 문제 · 반복 오답 조건이 남았어요
    if (hiC || sc.repeatedError) return 'remediate';
    return sc.n >= 3 && sc.parts.A < 0.5 ? 'remediate' : 'diagnose';
  },

  /** 단원의 개념 목록 */
  concepts(chapterId) {
    const ch = CHAPTER_BY_ID[chapterId];
    return ch ? ch.subunits.map((s) => `${chapterId}:${s.idx}`) : [];
  },

  chapterScores(data, chapterId) {
    return this.concepts(chapterId).map((c) => ({ concept: c, ...this.score(data, c) }));
  },

  /* -------------------------- 학습 방식 개인화 -------------------------- */
  mix(data) {
    const m = data.typeMix || {};
    return { ratio: m.ratio || { visual: 33.3, step: 33.3, think: 33.4 }, from: m.from || 0, history: m.history || [] };
  },

  /**
   * 유형별 성과 비교 → 비율 조정. 기록이 쌓일 때마다 불러요. 평가했으면 새 mix를, 아직이면 null.
   *  첫 시도 정답률이 다른 두 유형 평균보다 15%p 이상 높고, 힌트 · 시도 횟수도 같거나 나으면 +10 / −5 / −5
   */
  evaluate(data) {
    const R_ = MASTERY_RULES;
    const mix = this.mix(data);
    const fresh = (data.records || []).slice(mix.from).filter((r) => r.mode === 'sim' || r.mode === 'review');
    const by = {};
    MASTERY_TYPES.forEach((t) => (by[t] = fresh.filter((r) => typeOf(r.type) === t)));
    if (MASTERY_TYPES.some((t) => by[t].length < R_.typeMin)) return null; // 데이터가 모자라면 그대로
    const stat = {};
    MASTERY_TYPES.forEach((t) => {
      const rs = by[t];
      stat[t] = { acc: mean(rs.map((r) => (r.correct ? 1 : 0))), hint: mean(rs.map((r) => r.hintLv || 0)), tries: mean(rs.map((r) => r.tries || 1)) };
    });
    let best = null;
    MASTERY_TYPES.forEach((t) => {
      const others = MASTERY_TYPES.filter((o) => o !== t);
      const avg = (k) => mean(others.map((o) => stat[o][k]));
      if (stat[t].acc >= avg('acc') + R_.typeGap && stat[t].hint <= avg('hint') && stat[t].tries <= avg('tries')) {
        if (!best || stat[t].acc > stat[best].acc) best = t;
      }
    });
    const ratio = { ...mix.ratio };
    if (best) {
      ratio[best] += R_.typeUp;
      MASTERY_TYPES.filter((o) => o !== best).forEach((o) => (ratio[o] -= R_.typeDown));
      // 최대 60% · 최소 20%: 넘친 만큼은 나머지에 돌려줘요.
      for (let k = 0; k < 3; k++) {
        MASTERY_TYPES.forEach((t) => {
          if (ratio[t] > R_.typeMax) {
            const extra = ratio[t] - R_.typeMax;
            ratio[t] = R_.typeMax;
            MASTERY_TYPES.filter((o) => o !== t).forEach((o) => (ratio[o] += extra / 2));
          }
          if (ratio[t] < R_.typeFloor) {
            const need = R_.typeFloor - ratio[t];
            ratio[t] = R_.typeFloor;
            const donors = MASTERY_TYPES.filter((o) => o !== t && ratio[o] > R_.typeFloor);
            donors.forEach((o) => (ratio[o] -= need / donors.length));
          }
        });
      }
      MASTERY_TYPES.forEach((t) => (ratio[t] = Math.round(ratio[t] * 10) / 10));
    }
    return {
      ratio,
      from: (data.records || []).length,
      history: [...mix.history, { at: Date.now(), ratio, best, stat }].slice(-20),
    };
  },

  /** 비율대로 유형 하나 고르기 (이 개념에 있는 유형 안에서) */
  pickType(data, types, rnd) {
    const ratio = this.mix(data).ratio;
    const list = MASTERY_TYPES.filter((t) => types.has(t));
    if (!list.length) return null;
    const total = list.reduce((a, t) => a + ratio[t], 0);
    let x = (rnd === undefined ? Math.random() : rnd) * total;
    for (const t of list) {
      x -= ratio[t];
      if (x <= 0) return t;
    }
    return list[list.length - 1];
  },

  /* ------------------------------ 문제 고르기 ------------------------------ */
  _pools: {},
  /** 개념에서 낼 수 있는 문제 (문제은행 + 숫자가 바뀌는 틀) */
  pool(concept, seed) {
    const key = `${concept}|${seed || 1}`;
    if (this._pools[key]) return this._pools[key];
    const [chId, sub] = concept.split(':');
    const ch = CHAPTER_BY_ID[chId];
    const s = ch && ch.subunits[Number(sub)];
    if (!s) return [];
    let qs = s.questions.filter((q) => q && !q.textbook);
    if (hasGenerator(chId, s.idx)) qs = qs.concat(genSet(chId, s.idx, 6, seed || 1).map((q) => getQuestion(q.id)).filter(Boolean));
    this._pools[key] = qs;
    return qs;
  },

  /**
   * 다음 문제
   * @param data 학습 데이터
   * @param concept 개념
   * @param o { used:Set(qid), action, review:boolean, seed }
   */
  pick(data, concept, o) {
    const opt = o || {};
    const used = opt.used || new Set();
    const seed = opt.seed || Date.now() % 100000;
    const r = genRng(seed);
    const rs = this.records(data, concept);
    const ever = new Set((data.records || []).map((x) => x.qid));
    let pool = this.pool(concept, 1).filter((q) => !used.has(q.id));
    if (!pool.length) pool = this.pool(concept, seed).filter((q) => !used.has(q.id)); // 다 썼으면 새 숫자로
    if (!pool.length) pool = this.pool(concept, 1);
    if (!pool.length) return null;

    // 난이도: 처음은 쉬운 것부터, 혼자 맞히면 한 칸 위로, 틀리면 한 칸 아래로
    const last = rs[rs.length - 1];
    let li = 0;
    if (last) {
      li = Math.max(0, LEVEL_STEPS.indexOf(last.level));
      if (last.correct && !last.hintLv) li = Math.min(2, li + 1);
      else if (!last.correct) li = Math.max(0, li - 1);
    }
    if (opt.action === 'remediate') li = 0;
    if (opt.review) li = Math.min(2, Math.max(1, li));

    // 유형: 개인화 비율대로. 확인 문제는 지금까지와 다른 유형, 재학습은 단계분해형 · 시각화형 먼저
    const types = new Set(pool.map((q) => q.type));
    let type = this.pickType(data, types, r.next());
    if (opt.action === 'confirm' && last) {
      const seen = new Set(rs.map((x) => x.type));
      const fresh = MASTERY_TYPES.filter((t) => types.has(t) && !seen.has(t));
      if (fresh.length) type = fresh[Math.floor(r.next() * fresh.length)];
      else if (types.size > 1 && types.has(last.type)) type = this.pickType(data, new Set([...types].filter((t) => t !== last.type)), r.next());
    }
    if (opt.action === 'remediate') type = types.has('step') ? 'step' : types.has('visual') ? 'visual' : type;
    if (opt.wantType && types.has(opt.wantType)) type = opt.wantType;

    const score = (q) => {
      let s = 0;
      if (q.type === type) s += 4;
      s += 3 - Math.abs(LEVEL_STEPS.indexOf(q.level) - li);
      if (!ever.has(q.id)) s += 2; // 처음 보는 문제
      if (opt.review && q.generated) s += 1; // 복습은 숫자가 바뀐 변형 문제를 좋아해요
      return s + r.next() * 0.5;
    };
    return [...pool].sort((a, b) => score(b) - score(a))[0];
  },

  /** '변형 문제': 이 개념에서 처음 본 모양(유형 · 난이도)과 다르거나, 숫자가 바뀐 문제 · 이야기 속 문제 */
  isVariant(data, concept, q) {
    const rs = this.records(data, concept);
    if (!rs.length) return false;
    const first = rs[0];
    return q.type !== first.type || q.level !== first.level || !!q.generated || !!q.story;
  },

  /* ------------------------------ 적응형 복습 ------------------------------ */
  /** 친구가 된 날 → 첫 복습은 다음 날 */
  firstReview(today) {
    return { stage: 0, next: addDays(today, MASTERY_RULES.reviewGaps[0]) };
  },

  /**
   * 복습을 마친 뒤 다음 복습 날
   *  - 숙달도가 유지 · 상승하고 신뢰도가 높으면 간격을 한 칸 늘려요.
   *  - 많이 떨어졌거나(20점 이상, 예: 95 → 70) 60점 밑이면 다음 날 다시. 조금 떨어졌으면 한 칸 줄여요.
   *    지금 점수가 같아도 이전 이력에 따라 다른 길로 가요. (꾸준히 70점대 ↔ 95에서 70으로 떨어짐)
   */
  afterReview(prev, before, after, today) {
    const gaps = MASTERY_RULES.reviewGaps;
    let stage = prev ? prev.stage : 0;
    const drop = before - after.M;
    if (after.M >= MASTERY_RULES.passM && after.C >= MASTERY_RULES.passC && drop <= 5) stage = Math.min(gaps.length - 1, stage + 1);
    else if (drop >= 20 || after.M < 60) stage = 0;
    else if (drop >= 10 || after.M < MASTERY_RULES.passM) stage = Math.max(0, stage - 1);
    return { stage, next: addDays(today, gaps[stage]) };
  },
};
