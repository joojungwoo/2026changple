/* =========================================================================
 * problem.js — 문제 데이터 · 표현 방식 · 입력 방식 · 정답 판정
 *
 *  같은 문제를 아이마다 다른 모습으로 보여 주고, 다른 방법으로 답하게 하려고 세 층으로 나눴어요.
 *
 *   문제 데이터 (Problem)   문제의 내용과 정답. 보여 주는 방식과 무관해요.
 *                           기존 문제(보기 고르기)를 어댑터(Problem.from)로 감싸요.
 *                             answer: { kind:'choice', index } 또는 { kind:'number', value, unit }
 *                             math:   { a, b, op }  — 식을 읽어 낼 수 있고 계산이 정답과 맞을 때만
 *   표현 방식 (REPS)        문제를 어떻게 보여 줄지: 숫자(글자) · 그림 · 블록 · 듣기
 *   입력 방식 (INPUTS)      답을 어떻게 낼지: 터치 선택 · 숫자패드 · 손글씨
 *
 *  - 표현 · 입력은 저마다 supports(p)로 "이 문제를 다룰 수 있는지" 스스로 판단해요.
 *    고른 방식이 안 되는 문제면 다음 방식으로 자연스럽게 넘어가요.
 *  - 정답 판정은 입력 방식과 상관없이 judge() 한 곳에서 문제 데이터를 기준으로 해요.
 *  - 화면 조립은 app.js의 screenQuiz가 해요. 방식마다 화면을 따로 만들지 않아요.
 * ========================================================================= */

const PROBLEM_OPS = { '+': '+', '＋': '+', '➕': '+', '−': '-', '-': '-', '×': '*', x: '*', '÷': '/' };
const PROBLEM_OP_SIGN = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/** "3마리" · "12" 같은 보기에서 수와 단위를 읽어요. 수가 아니면 null */
function problemNumber(choice) {
  const m = String(choice).trim().match(/^(-?\d+)\s*([가-힣]{0,3})$/);
  return m ? { value: Number(m[1]), unit: m[2] } : null;
}

function problemCalc(a, op, b) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return a * b;
  return b && a % b === 0 ? a / b : NaN;
}

const Problem = {
  _cache: new WeakMap(),

  /** 기존 문제 → 문제 데이터 */
  from(q) {
    if (this._cache.has(q)) return this._cache.get(q);
    const nums = q.choices.map(problemNumber);
    const units = new Set(nums.map((n) => n && n.unit));
    // 보기가 모두 같은 단위의 수일 때만 숫자로 답할 수 있어요. ("3마리" · "4마리")
    const numeric = nums.every(Boolean) && units.size === 1 ? nums[q.answer] : null;
    const p = {
      q,
      id: q.id,
      subject: q.subject,
      answer: numeric ? { kind: 'number', value: numeric.value, unit: numeric.unit } : { kind: 'choice', index: q.answer },
      math: numeric ? this._math(q, numeric.value) : null,
    };
    this._cache.set(q, p);
    return p;
  },

  /** 그림 · 문장에서 "27 + 15 = ❓" 또는 세로셈을 읽어요. 계산이 정답과 같을 때만 믿어요. */
  _math(q, value) {
    const lines = [q.visual || '', q.text || ''].join('\n').split('\n');
    const ok = (a, o, b) => {
      const op = PROBLEM_OPS[o];
      return op && problemCalc(a, op, b) === value ? { a, b, op } : null;
    };
    for (const l of lines) {
      const m = l.match(/^\s*(\d+)\s*([+＋➕−\-×x÷])\s*(\d+)\s*=\s*(?:❓|\?|□)\s*$/);
      if (m) return ok(Number(m[1]), m[2], Number(m[3]));
    }
    // 세로셈: "  2 5\n+ 1 3"
    for (let i = 0; i + 1 < lines.length; i++) {
      const top = lines[i].match(/^\s*(\d(?:\s?\d)*)\s*$/);
      const bot = lines[i + 1].match(/^\s*([+＋−\-×x])\s*(\d(?:\s?\d)*)\s*$/);
      if (top && bot) return ok(Number(top[1].replace(/\s/g, '')), bot[1], Number(bot[2].replace(/\s/g, '')));
    }
    return null;
  },
};

/**
 * 정답 판정 — 입력 방식과 무관하게 여기서만 해요.
 * @param p 문제 데이터
 * @param res { kind:'choice', index } | { kind:'number', value }
 */
function judge(p, res) {
  if (!res) return false;
  if (res.kind === 'choice') return res.index === p.q.answer;
  if (res.kind === 'number') return p.answer.kind === 'number' && Number(res.value) === p.answer.value;
  return false;
}

/** 답을 보기 번호로 바꿔요. (보기 고르기와 같은 기록을 남기려고) */
function responseChoice(p, res) {
  if (res.kind === 'choice') return res.index;
  const i = p.q.choices.findIndex((c) => {
    const n = problemNumber(c);
    return n && n.value === Number(res.value);
  });
  return i;
}

/** 답을 글로 (기록 · 읽어 주기 · 틀린 이유 힌트에 써요) */
function responseText(p, res) {
  if (res.kind === 'choice') return p.q.choices[res.index];
  return `${res.value}${p.answer.unit || ''}`;
}

/* ------------------------------ 틀린 이유 힌트 ------------------------------ */
/**
 * 고른 답에 맞춰 짧은 도움말을 골라요. 문제에 why[보기 번호]가 있으면 그것을 먼저 써요.
 * 수로 답하는 문제는 차이를 보고 흔한 실수를 짚어 줘요. 모르면 문제의 힌트를 보여 줘요.
 */
function whyWrong(p, res) {
  const q = p.q;
  const idx = responseChoice(p, res);
  if (q.why && idx >= 0 && q.why[idx]) return q.why[idx];
  const fallback = q.hint ? `다시 생각해 볼까요? ${q.hint}` : '다른 답을 골라 볼까요? 천천히 다시 읽어 봐요.';
  if (p.answer.kind !== 'number') return fallback;
  const c = p.answer.value;
  const w = res.kind === 'number' ? Number(res.value) : (problemNumber(q.choices[res.index]) || {}).value;
  if (w === undefined || Number.isNaN(w)) return fallback;
  const m = p.math;
  if (c >= 10 && w >= 10 && String(c).length === 2 && String(w) === String(c).split('').reverse().join('')) {
    return '십의 자리와 일의 자리 숫자가 바뀌었어요. 몇십인지 먼저 볼까요?';
  }
  if (m && m.op === '+' && w === Math.abs(m.a - m.b)) return '빼기를 했어요. "모두", "더"는 더하라는 말이에요.';
  if (m && m.op === '-' && w === m.a + m.b) return '더하기를 했어요. "남은", "더 많은"은 빼라는 말이에요.';
  if (m && (m.op === '+' || m.op === '-') && Math.abs(w - c) === 10) return '10만큼 차이 나요. 받아올림이나 받아내림을 했는지 살펴봐요.';
  const inText = String(q.text || '').match(/\d+/g) || [];
  if (inText.map(Number).includes(w)) return '문제에 있는 수를 그대로 골랐어요. 무엇을 묻는지 다시 읽어 볼까요?';
  if (w === c - 1) return '하나 모자라요. 하나씩 짚으면서 다시 세어 볼까요?';
  if (w === c + 1) return '하나 더 많아요. 같은 것을 두 번 센 건 아닌지 살펴봐요.';
  return fallback;
}

/* ------------------------------ 표현 방식 ------------------------------ */
/** 그림으로 나타낼 수 있는 덧셈 · 뺄셈 (너무 많으면 세기 어려워요) */
const PICTURE_MAX = 20;
const PICTURE_THINGS = ['🍎', '⭐', '🐟', '🎈', '🌷', '🍓'];

function repVisualHtml(q) {
  return q.visual ? `<div class="visual">${nl(q.visual)}</div>` : '';
}

function repTextHtml(q) {
  return `<p class="question-text" data-read>${nl(q.text)}</p>
    ${q.steps ? `<ol class="steps">${q.steps.map((s) => `<li data-read>${esc(s)}</li>`).join('')}</ol>` : ''}`;
}

const REPS = {
  numbers: {
    label: (p) => (p.subject === 'korean' ? '글자' : '숫자'),
    icon: (p) => (p.subject === 'korean' ? '📝' : '🔢'),
    supports: () => true,
    render(p) {
      const q = p.q;
      // 식이 있는 문제는 그림 대신 식을 크게 보여 줘요.
      if (p.math) {
        return `<div class="visual equation" aria-label="${p.math.a} ${PROBLEM_OP_SIGN[p.math.op]} ${p.math.b}">
            ${p.math.a} ${PROBLEM_OP_SIGN[p.math.op]} ${p.math.b} = <span class="eq-blank">?</span>
          </div>${repTextHtml(q)}`;
      }
      return repVisualHtml(q) + repTextHtml(q);
    },
  },
  pictures: {
    label: () => '그림',
    icon: () => '🍎',
    supports: (p) => p.subject === 'math' && (!!(p.math && ['+', '-'].includes(p.math.op) && Math.max(p.math.a, p.math.b) <= PICTURE_MAX) || /\p{Extended_Pictographic}/u.test(p.q.visual || '')),
    render(p) {
      const q = p.q;
      const m = p.math;
      if (m && ['+', '-'].includes(m.op) && Math.max(m.a, m.b) <= PICTURE_MAX) {
        const t = PICTURE_THINGS[(m.a * 7 + m.b) % PICTURE_THINGS.length];
        const group = (n, cls) => `<span class="pic-group ${cls || ''}">${Array(n).fill(`<i>${t}</i>`).join('')}</span>`;
        const body =
          m.op === '+'
            ? `${group(m.a)}<span class="pic-op">➕</span>${group(m.b)}`
            : `<span class="pic-group">${Array(m.a).fill(0).map((_, i) => `<i class="${i >= m.a - m.b ? 'gone' : ''}">${t}</i>`).join('')}</span>`;
        return `<div class="visual pictures" aria-label="${m.a} ${PROBLEM_OP_SIGN[m.op]} ${m.b}">${body}</div>${repTextHtml(q)}`;
      }
      return repVisualHtml(q) + repTextHtml(q);
    },
  },
  // 블록형(십 모형 · 일 모형)은 Phase 2에서 붙여요.
  listen: {
    label: () => '듣기',
    icon: () => '🎧',
    supports: () => true,
    render(p) {
      return `<button type="button" class="listen-big" data-read-problem aria-label="문제 듣기">
          <span class="listen-ico" aria-hidden="true">🔊</span>
          <span>눌러서 문제 듣기</span>
        </button>
        <details class="listen-text"><summary>글로 보기</summary>${repVisualHtml(p.q)}${repTextHtml(p.q)}</details>`;
    },
  },
};
const REP_ORDER = ['numbers', 'pictures', 'blocks', 'listen'];

/** 이 문제에서 쓸 수 있는 표현 방식 */
function repsFor(p) {
  return REP_ORDER.filter((id) => REPS[id] && REPS[id].supports(p));
}

/** 원하는 표현 방식이 안 되면 숫자(글자)로 */
function pickRep(p, want) {
  return REPS[want] && REPS[want].supports(p) ? want : 'numbers';
}

/* ------------------------------ 입력 방식 ------------------------------ */
const INPUTS = {
  choice: {
    supports: () => true,
  },
  numpad: {
    supports: (p) => p.answer.kind === 'number' && p.answer.value >= 0 && p.answer.value < 100000,
  },
  // 손글씨는 Phase 2에서 붙여요. 그때까지는 숫자패드로 넘어가요.
  pencil: {
    supports: () => false,
  },
};
/** 원하는 입력이 안 되는 문제면 차례로 넘어가요: 손글씨 → 숫자패드 → 터치 선택 */
const INPUT_FALLBACK = { pencil: 'numpad', numpad: 'choice', choice: null };

function pickInput(p, want) {
  let id = want || 'choice';
  while (id && !(INPUTS[id] && INPUTS[id].supports(p))) id = INPUT_FALLBACK[id];
  return id || 'choice';
}
