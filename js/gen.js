/* =========================================================================
 * gen.js — 숫자가 바뀌는 문제 만들기 (1학년 수학)
 *
 *  - 회독할 때마다 문제가 바뀌어야 해요(수준은 같고 숫자·물건만 달라요).
 *    소단원마다 문제 틀(template)을 두고, 씨앗 수(seed)로 숫자를 뽑아 문제를 만들어요.
 *  - 만든 문제의 id는 "단원~소단원~틀~씨앗"이라서, id만 있으면 같은 문제를 다시 만들 수 있어요.
 *    (복습 스케줄 · 학습 기록은 id만 저장해요.)
 *  - 틀이 없는 단원(국어, 2·3학년)은 문제은행에서 돌려 가며 뽑아요. → store.js passQuestions
 *  - curriculum.js보다 먼저 로드되어야 합니다.
 * ========================================================================= */

/** 씨앗 수로 만드는 난수 (mulberry32) */
function genRng(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    /** 서로 다른 n개 */
    sample: (arr, n) => r.shuffle(arr).slice(0, n),
  };
  return r;
}

/** 선택지 섞기: 정답 + 오답 → { choices, answer } */
function genChoices(r, correct, wrongs, n) {
  const seen = new Set([String(correct)]);
  const rest = [];
  wrongs.forEach((w) => {
    if (seen.has(String(w))) return;
    seen.add(String(w));
    rest.push(String(w));
  });
  const choices = r.shuffle([String(correct), ...rest.slice(0, (n || 3) - 1)]);
  return { choices, answer: choices.indexOf(String(correct)) };
}

/** 정답 가까이의 수로 오답 만들기 */
function genNear(r, v, lo, hi) {
  const pool = [v - 1, v + 1, v - 2, v + 2, v + 3, v - 3].filter((x) => x >= lo && x <= hi);
  return [...r.shuffle(pool.slice(0, 2)), ...pool.slice(2)];
}

/** 수 뒤에 붙는 조사: 3'은' · 4'는' */
function genJosa(n, withFinal, without) {
  return [0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? withFinal : without;
}

/** 낱말 뒤에 붙는 조사: 받침이 있으면 withFinal ("둘"이라고 · "셋"이라고 · "넷"이라고) */
function genJw(word, withFinal, without) {
  const code = String(word).trim().slice(-1).charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return without;
  return code % 28 ? withFinal : without;
}

const GEN_NATIVE = ['영', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
const GEN_SINO = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구', '십'];
const GEN_ORDER = ['', '첫째', '둘째', '셋째', '넷째', '다섯째'];
const GEN_THINGS = [
  { e: '🍎', n: '사과', u: '개' }, { e: '🐤', n: '병아리', u: '마리' }, { e: '⭐', n: '별', u: '개' },
  { e: '🐟', n: '물고기', u: '마리' }, { e: '🎈', n: '풍선', u: '개' }, { e: '🌷', n: '꽃', u: '송이' },
  { e: '🚗', n: '자동차', u: '대' }, { e: '🍓', n: '딸기', u: '개' }, { e: '🐰', n: '토끼', u: '마리' },
];
const GEN_KIDS = ['민지', '준호', '서아', '도윤', '하린', '지우'];
const GEN_ANIMALS = [['🐶', '강아지'], ['🐱', '고양이'], ['🐰', '토끼'], ['🐻', '곰'], ['🐼', '판다'], ['🐸', '개구리'], ['🐯', '호랑이']];

const row = (e, n) => Array(n).fill(e).join(' ');
/** 수를 10개씩 끊어 그리기 */
const tens = (e, n) => {
  const lines = [];
  for (let i = 0; i < n; i += 10) lines.push(Array(Math.min(10, n - i)).fill(e).join(''));
  return lines.join('\n');
};

/** 1~19를 세는 말: 하나 … 열 … 열아홉 */
const genCountWord = (n) => (n <= 10 ? GEN_NATIVE[n] : `열${GEN_NATIVE[n - 10]}`);

/**
 * 이어 세기에서 힌트로 보여 줄 수: start 다음부터 한두 개만.
 * more개를 이어 세면 마지막 수(start+more)가 답이라서, 많아야 more-1개까지만 보여 줘요. (답은 말하지 않아요)
 */
const genShown = (start, more, dir) => Array.from({ length: Math.min(2, more - 1) }, (_, i) => start + (dir || 1) * (i + 1));

/**
 * 그림을 짚으며 이어 세기 힌트 (덧셈)
 *  e: 짚을 그림 · start: 이미 센 수 · more: 더 셀 개수 · what: 더 셀 것의 이름
 */
function genCountOnHint(e, start, more, what) {
  const shown = genShown(start, more);
  if (!shown.length) return `이제 ${what}을(를) 짚으며 ${genCountWord(start)} 바로 다음 수를 말해 봐.\n그 수가 답이야.`;
  return [`이제 ${what}을(를) 하나씩 짚으며 이어 세어 봐.`, ...shown.map((v) => `${e} ${genCountWord(v)}~`), '…', '마지막에 말한 수가 답이야.'].join('\n');
}

/** 손가락으로 펴며(+) · 접으며(−) 세기 힌트 */
function genFingerHint(start, more, dir) {
  const verb = dir > 0 ? '더 펴면' : '접으면';
  const shown = genShown(start, more, dir);
  if (!shown.length) return `손가락 한 개를 ${verb} 몇이 될까?`;
  return [...shown.map((v, i) => `${i ? '또 한 개' : '한 개'} ${verb} → ${v}`), '…', dir > 0 ? '다 펴고 나서 마지막에 말한 수가 답이야.' : '다 접고 나서 펴져 있는 손가락을 세어 봐.'].join('\n');
}

/** 수와 읽는 말 짝 (앞뒤 수만 보여 주고, 물어본 수는 ❓로 비워 둬요) */
function genReadTable(n, lo, hi, read, label = (x) => x) {
  const lines = [];
  if (n - 1 >= lo) lines.push(`${label(n - 1)} → ${read(n - 1)}`);
  lines.push(`${label(n)} → ❓`);
  if (n + 1 <= hi) lines.push(`${label(n + 1)} → ${read(n + 1)}`);
  return lines.join('\n');
}

/* ---------------------------- 2단원 재료 ---------------------------- */
/** 모양을 가려내는 기준 → 그게 무슨 뜻인지 (모양 이름은 아이가 직접 골라요) */
const GEN_SHAPE_HINT = [
  '이렇게 살펴봐!',
  '평평한 부분만 있고 뾰족한 곳이 있어? → 잘 쌓이지만 굴러가지 않아. 상자처럼 생겼어.',
  '평평한 부분도, 둥근 부분도 있어? → 눕히면 굴러가고 세우면 쌓여. 기둥처럼 생겼어.',
  '평평한 부분 없이 모두 둥글어? → 어느 쪽으로든 데굴데굴 굴러가. 공처럼 생겼어.',
].join('\n');

const GEN_SHAPES = [
  {
    name: '상자 모양',
    things: ['📦 택배 상자', '🎁 선물 상자', '🎲 주사위', '🧱 벽돌', '🧃 주스 팩', '🧊 네모난 얼음'],
    says: ['뾰족한 곳이 있고, 평평한 부분만 있어.', '잘 쌓이지만, 굴러가지는 않아.'],
    look: '평평한 부분만 있고 뾰족한 곳이 있는 것',
    like: '평평한 부분이 있어서 잘 쌓여. 대신 공처럼 굴러가지는 않아.',
  },
  {
    name: '둥근 기둥 모양',
    things: ['🥫 통조림 캔', '🥁 북', '🔋 건전지', '🕯️ 양초', '🧻 두루마리 휴지', '🪵 통나무'],
    says: ['눕히면 굴러가고, 세우면 쌓을 수 있어.', '평평한 부분도 있고, 둥근 부분도 있어.'],
    look: '위아래는 평평하고 옆은 둥근 것',
    like: '눕히면 데굴데굴 굴러가고, 세우면 차곡차곡 쌓을 수 있어.',
  },
  {
    name: '공 모양',
    things: ['⚽ 축구공', '🏀 농구공', '🎾 테니스공', '🏐 배구공', '🔮 구슬', '🍊 귤'],
    says: ['어느 쪽으로 굴려도 잘 굴러가.', '평평한 부분이 없어서 쌓을 수 없어.'],
    look: '평평한 부분 없이 모두 둥근 것',
    like: '어디나 둥글어서 어느 쪽으로든 굴러가. 대신 쌓기는 어려워.',
  },
];

/** 2단원: 소단원(모양)마다 같은 틀을 써요. */
function genShapeTemplates(k) {
  const me = GEN_SHAPES[k];
  const others = GEN_SHAPES.filter((_, i) => i !== k);
  const names = GEN_SHAPES.map((s) => s.name);
  return [
    (r) => {
      const ok = r.pick(me.things);
      return {
        type: 'visual', level: '하', visual: ok.split(' ')[0],
        text: `${ok.slice(ok.indexOf(' ') + 1)}은(는) 어떤 모양인가요?`,
        ...genChoices(r, me.name, names),
        hint: GEN_SHAPE_HINT,
        solution: `${ok}은(는) ${me.name}(이)야. ${me.name}은(는) ${me.like}`,
      };
    },
    (r) => {
      const ok = r.pick(me.things);
      const wrongs = others.map((o) => r.pick(o.things));
      return {
        type: 'visual', level: '하', visual: [ok, ...wrongs].map((t) => t.split(' ')[0]).sort().join('   '),
        text: `${me.name}인 물건은 무엇인가요?`,
        ...genChoices(r, ok, wrongs),
        hint: `${me.name}은(는) ${me.look}이야.\n${me.says[1]}\n아래 답 중에서 이런 물건을 찾아봐.`,
        solution: `${ok}이(가) ${me.name}(이)야. ${me.like}`,
      };
    },
    (r) => {
      const say = r.pick(me.says);
      return {
        type: 'think', level: '중', visual: `💬 "${say}"`,
        text: '친구가 설명하는 모양은 무엇인가요?',
        ...genChoices(r, me.name, names),
        hint: GEN_SHAPE_HINT,
        solution: `친구 말처럼 ${say} 그래서 ${me.name}(이)야.`,
      };
    },
    (r) => {
      const two = r.sample(me.things, 2);
      const odd = r.pick(r.pick(others).things);
      return {
        type: 'step', level: '중', visual: r.shuffle([...two, odd]).map((t) => t.split(' ')[0]).join('   '),
        text: '모양이 다른 물건 하나는 무엇인가요?',
        steps: ['① 물건마다 평평한 부분, 둥근 부분이 있는지 봐.', '② 같은 모양 두 개를 찾아.', '③ 남은 하나는 무엇일까?'],
        ...genChoices(r, odd, two),
        hint: `세 물건 중 두 개는 같은 모양이고, 하나만 달라.\n${GEN_SHAPE_HINT}`,
        solution: `${two[0]}, ${two[1]}은(는) ${me.name}(이)야. ${odd}만 모양이 달라.`,
      };
    },
    (r) => {
      const n = r.int(2, 4);
      const mine = r.sample(me.things, n);
      const rest = [...r.sample(others[0].things, r.int(1, 2)), ...r.sample(others[1].things, r.int(1, 2))];
      return {
        type: 'step', level: '상', visual: r.shuffle([...mine, ...rest]).map((t) => t.split(' ')[0]).join(' '),
        text: `${me.name}은 모두 몇 개인가요?`,
        steps: [`① ${me.look}에만 ○를 해.`, '② ○를 한 물건을 하나씩 짚으며 세어 봐. 몇 개일까?'],
        ...genChoices(r, `${n}개`, genNear(r, n, 1, 6).map((x) => `${x}개`)),
        hint: `${me.name}은(는) ${me.look}이야.\n${me.says[1]}\n이런 물건만 하나씩 짚으며 세어 봐. 다른 모양은 세지 마!`,
        solution: `${mine.join(', ')} → ${me.name}은(는) 모두 ${n}개야.`,
      };
    },
  ];
}

/* ---------------------------- 4단원 재료 ---------------------------- */
/** [더 큰 쪽, 더 작은 쪽] */
const GEN_LONG = [['🚆 기차', '🚲 자전거'], ['🪢 줄넘기', '✏️ 연필'], ['🥢 젓가락', '🪥 칫솔'], ['🚌 버스', '🚗 승용차'], ['🧹 빗자루', '🥄 숟가락'], ['🦒 기린의 목', '🐶 강아지의 목']];
const GEN_HEAVY = [['🍉 수박', '🍓 딸기'], ['🐘 코끼리', '🐱 고양이'], ['🎒 책가방', '✏️ 연필'], ['🪑 의자', '🧢 모자'], ['⚽ 축구공', '🎈 풍선'], ['🚗 자동차', '🚲 자전거']];
const GEN_HEAVY3 = [['🐘 코끼리', '🐶 강아지', '🐜 개미'], ['🪑 의자', '🎒 가방', '✏️ 연필'], ['🍉 수박', '🍎 사과', '🍓 딸기'], ['🚌 버스', '🚲 자전거', '🛴 킥보드']];
const GEN_MUCH = [['🪣 양동이', '🥛 컵'], ['🛁 욕조', '🪣 양동이'], ['🫖 주전자', '🥄 숟가락'], ['🍲 냄비', '☕ 찻잔'], ['🧴 큰 물통', '🥤 작은 컵']];
const GEN_LINE_THINGS = ['연필', '크레파스', '색연필', '빨대', '리본', '막대'];

/** 길이를 막대로 그리기 */
const bar = (n) => '━'.repeat(n);
const water = (n) => '🟦'.repeat(n) + '⬜'.repeat(5 - n);

/** 둘을 견주는 틀 (bigWord: 더 긴/무거운, smallWord: 더 짧은/가벼운) */
function genPairTemplate(pairs, bigWord, smallWord, bigVerb, hint) {
  return (r) => {
    const [big, small] = r.pick(pairs);
    const askBig = r.int(0, 1) === 1;
    const ok = askBig ? big : small;
    return {
      type: 'think', level: '하', visual: r.shuffle([big, small]).join('     '),
      text: `둘 중에서 ${askBig ? bigWord : smallWord} 것은 무엇인가요?`,
      ...genChoices(r, ok, [askBig ? small : big, '둘이 같아요']),
      hint,
      solution: `${big}이(가) ${small}보다 ${bigVerb}. 그래서 답은 ${ok}(이)야.`,
    };
  };
}

/* ============================== 문제 틀 ============================== */
window.GENERATORS = {
  /* ------------------------- 1. 9까지의 수 ------------------------- */
  'm1-1': [
    // 1-1 하나씩 세기
    [
      (r) => {
        const t = r.pick(GEN_THINGS);
        const n = r.int(2, 9);
        const lines = Array.from({ length: n }, (_, i) => `${t.e.repeat(i + 1)} ${GEN_NATIVE[i + 1]}${i === n - 1 ? '!' : '~'}`);
        return {
          type: 'visual', level: '하', visual: row(t.e, n),
          text: `${t.n}은(는) 모두 몇 ${t.u}인가요?`,
          ...genChoices(r, `${n}${t.u}`, genNear(r, n, 1, 9).map((x) => `${x}${t.u}`)),
          hint: `손가락으로 하나씩 짚으면서 세어 봐!\n${lines.join('\n')}`,
          solution: `하나씩 세면 ${GEN_NATIVE.slice(1, n + 1).join(', ')} → 모두 ${n}${t.u}야.`,
        };
      },
      (r) => {
        const n = r.int(1, 9);
        const native = r.int(0, 1) === 1;
        const words = native ? GEN_NATIVE : GEN_SINO;
        return {
          type: 'think', level: '하', visual: String(n),
          text: `수 ${n}${genJosa(n, '을', '를')} 바르게 읽은 것은 무엇인가요?`,
          ...genChoices(r, words[n], genNear(r, n, 1, 9).map((x) => words[x])),
          hint: `수와 읽는 말을 짝지어 봐!\n${genReadTable(n, 1, 9, (x) => words[x])}\n❓ 자리에는 앞뒤 말 사이에 오는 말이 들어가. 아래 답 중에서 찾아봐.`,
          solution: `${n}${genJosa(n, '은', '는')} "${GEN_NATIVE[n]}" 또는 "${GEN_SINO[n]}"${genJosa(n, '이', '')}라고 읽어.`,
        };
      },
      (r) => {
        const [a, b] = r.sample(GEN_THINGS.filter((t) => t.u === '개'), 2);
        const n = r.int(2, 5);
        const m = r.int(1, 4);
        return {
          type: 'step', level: '중', visual: r.shuffle([...Array(n).fill(a.e), ...Array(m).fill(b.e)]).join(' '),
          text: `${a.n}만 세면 몇 개인가요?`,
          steps: [`① ${a.e}에만 ○를 해.`, '② ○를 한 것만 하나씩 짚으며 세어 봐. 몇 개일까?'],
          ...genChoices(r, `${n}개`, [`${n + m}개`, ...genNear(r, n, 1, 9).map((x) => `${x}개`)]),
          hint: `${b.e} ${b.n}은(는) 세지 마!\n${a.e}만 하나씩 짚으며 "하나, …" 하고 세어 봐.\n마지막에 말한 수가 답이야.`,
          solution: `${a.e}만 세면 ${n}개야. (${b.n}은(는) ${m}개)`,
        };
      },
      (r) => {
        const t = r.pick([['🍪', '과자', '접시'], ['🍬', '사탕', '주머니'], ['🥕', '당근', '바구니']]);
        const n = r.int(2, 6);
        return {
          type: 'think', level: '중', visual: `${row(t[0], n)}  →  (빈 ${t[2]})`,
          text: `${t[2]}에 ${t[1]}이(가) ${n}개 있었어요. 모두 먹었어요. 남은 ${t[1]}의 수는 무엇인가요?`,
          ...genChoices(r, '0', [String(n), '1']),
          hint: `모두 먹으면 ${t[2]}에 하나도 없어.\n아무것도 없는 것을 나타내는 수가 따로 있어. 그 수를 찾아봐.`,
          solution: '아무것도 없는 것은 0이라고 쓰고 "영"이라고 읽어.',
        };
      },
    ],
    // 1-2 수의 순서
    [
      (r) => {
        const start = r.int(1, 5);
        const hole = r.int(1, 3);
        const down = r.int(0, 2) === 0;
        const seq = [0, 1, 2, 3, 4].map((i) => (down ? start + 4 - i : start + i));
        const ans = seq[hole];
        return {
          type: 'visual', level: '하', visual: seq.map((v, i) => (i === hole ? '❓' : v)).join('  '),
          text: '❓에 알맞은 수는 무엇인가요?',
          ...genChoices(r, ans, genNear(r, ans, 1, 9)),
          hint: down
            ? '왼쪽부터 소리 내어 읽어 봐. 수가 하나씩 작아지고 있어.\n❓ 바로 왼쪽 수보다 하나 작은 수가 들어가.'
            : '왼쪽부터 소리 내어 읽어 봐. 수가 하나씩 커지고 있어.\n❓ 바로 왼쪽 수 다음에 오는 수가 들어가.',
          solution: `${seq.join(', ')} 순서야. ❓는 ${ans}${genJosa(ans, '이야', '야')}.`,
        };
      },
      (r) => {
        const up = r.int(0, 1) === 1;
        const n = up ? r.int(1, 8) : r.int(2, 9);
        const ans = up ? n + 1 : n - 1;
        return {
          type: 'think', level: '중', visual: up ? `${n}  →  ❓` : `❓  →  ${n}`,
          text: `${n}보다 1만큼 더 ${up ? '큰' : '작은'} 수는 무엇인가요?`,
          ...genChoices(r, ans, [up ? n - 1 : n + 1, ...genNear(r, ans, 0, 9)].filter((x) => x !== n && x >= 0)),
          hint: up
            ? `더 큰 쪽으로 한 칸 → 바로 다음 수야.\n수를 처음부터 순서대로 세어 봐. ${n} 바로 다음에 말하는 수가 답이야.`
            : `더 작은 쪽으로 한 칸 → 바로 앞의 수야.\n수를 처음부터 순서대로 세어 봐. ${n}${genJosa(n, '을', '를')} 말하기 바로 전에 말한 수가 답이야.`,
          solution: `${n}보다 1만큼 더 ${up ? '큰' : '작은'} 수는 ${ans}${genJosa(ans, '이야', '야')}.`,
        };
      },
      (r) => {
        const five = r.sample(GEN_ANIMALS, 5);
        const k = r.int(2, 5);
        const left = r.int(0, 1) === 1;
        const ok = left ? five[k - 1] : five[5 - k];
        const side = left ? '왼쪽' : '오른쪽';
        return {
          type: 'step', level: '상', visual: `왼쪽  ${five.map((a) => a[0]).join(' ')}  오른쪽`,
          text: `${side}에서 ${GEN_ORDER[k]}에 있는 동물은 무엇인가요?`,
          steps: [`① ${side} 끝 동물에 손가락을 올려.`, `② "첫째, 둘째, …" 하고 ${GEN_ORDER[k]}까지 짚어 봐. 손가락이 멈춘 동물은 누구일까?`],
          ...genChoices(r, `${ok[0]} ${ok[1]}`, r.shuffle(five.filter((a) => a !== ok)).map((a) => `${a[0]} ${a[1]}`)),
          hint: `${side} 끝부터 시작해!\n손가락으로 하나씩 짚으며 "첫째, 둘째, …" 하고 세어 봐.\n"${GEN_ORDER[k]}"라고 말할 때 멈춰.`,
          solution: `${side}에서 ${GEN_ORDER[k]}에 있는 동물은 ${ok[0]} ${ok[1]}(이)야.`,
        };
      },
      (r) => {
        const n = r.int(2, 8);
        return {
          type: 'think', level: '중', visual: `${n - 1}   ❓   ${n + 1}`,
          text: `${n - 1}${genJosa(n - 1, '과', '와')} ${n + 1} 사이에 있는 수는 무엇인가요?`,
          ...genChoices(r, n, [n - 1, n + 1]),
          hint: `수를 순서대로 세어 봐.\n${n - 1} 바로 다음, ${n + 1} 바로 앞에 오는 수가 사이에 있어.`,
          solution: `${n - 1}, ${n}, ${n + 1} 순서야. 사이에 있는 수는 ${n}${genJosa(n, '이야', '야')}.`,
        };
      },
    ],
    // 1-3 크기 비교
    [
      (r) => {
        const [a, b] = r.sample(GEN_THINGS, 2);
        const n = r.int(1, 8);
        let m = r.int(1, 8);
        if (m === n) m = n + 1;
        const more = r.int(0, 1) === 1;
        const ok = (n > m) === more ? a : b;
        return {
          type: 'visual', level: '하', visual: `${row(a.e, n)}\n${row(b.e, m)}`,
          text: `${a.n}와(과) ${b.n} 중에서 더 ${more ? '많은' : '적은'} 것은 무엇인가요?`,
          ...genChoices(r, ok.n, [ok === a ? b.n : a.n, '둘이 같아요']),
          hint: '위아래로 하나씩 짝을 지어 봐.\n짝 없이 남는 것이 있는 쪽 → 더 많아.\n먼저 짝이 다 떨어지는 쪽 → 더 적어.',
          solution: `${a.n} ${n}, ${b.n} ${m}. ${Math.max(n, m)}${genJosa(Math.max(n, m), '이', '가')} ${Math.min(n, m)}보다 커. 더 ${more ? '많은' : '적은'} 것은 ${ok.n}(이)야.`,
        };
      },
      (r) => {
        const [a, b] = r.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 2);
        const big = r.int(0, 1) === 1;
        const ans = big ? Math.max(a, b) : Math.min(a, b);
        return {
          type: 'think', level: '하', visual: `${a}     ${b}`,
          text: `두 수 중에서 더 ${big ? '큰' : '작은'} 수는 무엇인가요?`,
          ...genChoices(r, ans, [a === ans ? b : a, '두 수가 같아요']),
          hint: '수를 처음부터 순서대로 세어 봐.\n먼저 나오는 수 → 더 작아.\n나중에 나오는 수 → 더 커.',
          solution: `${Math.max(a, b)}${genJosa(Math.max(a, b), '은', '는')} ${Math.min(a, b)}보다 커. 더 ${big ? '큰' : '작은'} 수는 ${ans}${genJosa(ans, '이야', '야')}.`,
        };
      },
      (r) => {
        const three = r.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 3);
        const big = r.int(0, 1) === 1;
        const ans = big ? Math.max(...three) : Math.min(...three);
        const sorted = [...three].sort((x, y) => x - y);
        return {
          type: 'step', level: '상', visual: three.join('     '),
          text: `세 수 중에서 가장 ${big ? '큰' : '작은'} 수는 무엇인가요?`,
          steps: ['① 세 수를 작은 수부터 순서대로 놓아 봐.', `② 줄의 맨 ${big ? '뒤' : '앞'}에 있는 수는 무엇일까?`],
          ...genChoices(r, ans, three.filter((x) => x !== ans)),
          hint: '수를 처음부터 순서대로 세어 봐.\n세 수 중에서 가장 먼저 나오는 수 → 가장 작아.\n가장 나중에 나오는 수 → 가장 커.',
          solution: `작은 수부터 놓으면 ${sorted.join(', ')}. 가장 ${big ? '큰' : '작은'} 수는 ${ans}${genJosa(ans, '이야', '야')}.`,
        };
      },
      (r) => {
        const [k1, k2] = r.sample(GEN_KIDS, 2);
        const t = r.pick([['구슬', '개'], ['색연필', '자루'], ['딱지', '장'], ['스티커', '장']]);
        const [a, b] = r.sample([2, 3, 4, 5, 6, 7, 8, 9], 2);
        const more = r.int(0, 1) === 1;
        const ok = (a > b) === more ? k1 : k2;
        return {
          type: 'think', level: '중', visual: `${k1} ${a}${t[1]}   /   ${k2} ${b}${t[1]}`,
          text: `${t[0]}을(를) 더 ${more ? '많이' : '적게'} 가진 친구는 누구인가요?`,
          ...genChoices(r, ok, [ok === k1 ? k2 : k1, '두 친구가 같아요']),
          hint: `${a}${genJosa(a, '과', '와')} ${b} 중에서 더 ${more ? '큰' : '작은'} 수를 찾아봐.\n그 수만큼 가진 친구가 더 ${more ? '많이' : '적게'} 가진 친구야.`,
          solution: `${Math.max(a, b)}${genJosa(Math.max(a, b), '이', '가')} ${Math.min(a, b)}보다 커. 더 ${more ? '많이' : '적게'} 가진 친구는 ${ok}${genJw(ok, '이야', '야')}.`,
        };
      },
    ],
  ],

  /* ------------------------- 2. 여러 가지 모양 ------------------------- */
  'm1-2': [genShapeTemplates(0), genShapeTemplates(1), genShapeTemplates(2)],

  /* ------------------------- 3. 덧셈과 뺄셈 ------------------------- */
  'm1-3': [
    // 3-1 더하기
    [
      (r) => {
        const t = r.pick(GEN_THINGS);
        const a = r.int(1, 5);
        const b = r.int(1, 9 - a > 4 ? 4 : 9 - a);
        return {
          type: 'visual', level: '하', visual: `${row(t.e, a)}   ➕   ${row(t.e, b)}`,
          text: `${t.n}은(는) 모두 몇 ${t.u}인가요?`,
          ...genChoices(r, `${a + b}${t.u}`, genNear(r, a + b, 1, 9).map((x) => `${x}${t.u}`)),
          hint: `➕ 앞의 ${t.n}은(는) 이미 ${a}${t.u}야.\n${t.e.repeat(a)}\n${genCountOnHint(t.e, a, b, `➕ 뒤의 ${t.n}`)}`,
          solution: `${a} + ${b} = ${a + b} → ${t.n}은(는) 모두 ${a + b}${t.u}야.`,
        };
      },
      (r) => {
        const a = r.int(1, 7);
        const b = r.int(1, 9 - a);
        return {
          type: 'think', level: '중', visual: `${a} + ${b} = ❓`,
          text: `${a} 더하기 ${b}${genJosa(b, '은', '는')} 얼마인가요?`,
          ...genChoices(r, a + b, genNear(r, a + b, 1, 9)),
          hint: `손가락 ${a}개를 먼저 펴 봐.\n그다음 + 뒤의 수만큼 손가락을 하나씩 더 펴면서 이어 세어 봐.\n${genFingerHint(a, b, 1)}`,
          solution: `${a} + ${b} = ${a + b}. ${a}에 ${b}${genJosa(b, '을', '를')} 더하면 모두 ${a + b}${genJosa(a + b, '이야', '야')}.`,
        };
      },
      (r) => {
        const t = r.pick([['🍓', '딸기', '바구니', '땄어요'], ['🐝', '벌', '꽃밭', '날아왔어요'], ['🥚', '달걀', '둥지', '낳았어요']]);
        const a = r.int(2, 6);
        const b = r.int(1, 9 - a > 3 ? 3 : 9 - a);
        return {
          type: 'step', level: '상', visual: `${row(t[0], a)}  +  ${row(t[0], b)}`,
          text: `${t[2]}에 ${t[1]}이(가) ${a}개 있어요. ${b}개를 더 ${t[3]}. 모두 몇 개인가요?`,
          steps: [`① 처음에 있던 수를 찾아 → ${a}`, `② 더 생긴 수를 찾아 → ${b}`, `③ ${a} + ${b}${genJosa(b, '을', '를')} 이어 세어 봐. 모두 몇 개일까?`],
          ...genChoices(r, `${a + b}개`, [`${a - b > 0 ? a - b : a + b + 1}개`, ...genNear(r, a + b, 1, 9).map((x) => `${x}개`)]),
          hint: `"더", "모두"라는 말이 나오면 더하는 거야.\n처음 ${t[1]}은(는) 이미 ${a}개야.\n${genCountOnHint(t[0], a, b, `+ 뒤의 ${t[1]}`)}`,
          solution: `${a} + ${b} = ${a + b} → ${t[1]}은(는) 모두 ${a + b}개야.`,
        };
      },
      (r) => {
        const a = r.int(1, 9);
        const front = r.int(0, 1) === 1;
        return {
          type: 'think', level: '중', visual: front ? `0 + ${a} = ❓` : `${a} + 0 = ❓`,
          text: front ? `아무것도 없는데 ${a}개를 받았어요. 모두 몇 개인가요?` : `${a}개가 있는데 더 받지 않았어요. 모두 몇 개인가요?`,
          ...genChoices(r, a, [0, a + 1 > 9 ? a - 1 : a + 1]),
          hint: '0은 아무것도 없다는 뜻이야.\n아무것도 없는 것을 더하면 늘어나는 게 없어.\n그럼 모두 몇 개일까?',
          solution: `0을 더하면 수가 그대로야. 답은 ${a}${genJosa(a, '이야', '야')}.`,
        };
      },
    ],
    // 3-2 빼기
    [
      (r) => {
        const t = r.pick([['🍬', '사탕', '개를 먹었어요'], ['🎈', '풍선', '개가 터졌어요'], ['🍪', '과자', '개를 먹었어요'], ['🍎', '사과', '개를 먹었어요']]);
        const a = r.int(3, 9);
        const b = r.int(1, a - 1);
        const left = a - b;
        const shown = Array.from({ length: Math.min(2, left - 1) }, (_, i) => `${t[0].repeat(i + 1)} ${GEN_NATIVE[i + 1]}~`);
        return {
          type: 'visual', level: '하', visual: `${row(t[0], a - b)} ${row('✖️', b)}`,
          text: `${t[1]}이(가) ${a}개 있었어요. ${b}${t[2]}. 남은 ${t[1]}은(는) 몇 개인가요?`,
          ...genChoices(r, `${a - b}개`, genNear(r, a - b, 0, 9).map((x) => `${x}개`)),
          hint: shown.length
            ? `✖️는 없어진 ${t[1]}(이)야. 세지 마!\n✖️ 없는 ${t[1]}만 하나씩 짚으며 세어 봐.\n${shown.join('\n')}\n…\n마지막에 말한 수가 남은 개수야.`
            : `✖️는 없어진 ${t[1]}(이)야. 세지 마!\n✖️ 없는 ${t[1]}만 짚으며 세어 봐. 몇 개가 남았을까?`,
          solution: `${a} − ${b} = ${a - b} → ${t[1]}은(는) ${a - b}개가 남았어.`,
        };
      },
      (r) => {
        const a = r.int(2, 9);
        const b = r.int(1, a - 1);
        return {
          type: 'think', level: '중', visual: `${a} − ${b} = ❓`,
          text: `${a} 빼기 ${b}${genJosa(b, '은', '는')} 얼마인가요?`,
          ...genChoices(r, a - b, genNear(r, a - b, 0, 9)),
          hint: `손가락 ${a}개를 펴 봐.\n그다음 − 뒤의 수만큼 손가락을 하나씩 접으면서 거꾸로 세어 봐.\n${genFingerHint(a, b, -1)}`,
          solution: `${a} − ${b} = ${a - b}. ${a}개에서 ${b}개를 빼면 ${a - b}개가 남아.`,
        };
      },
      (r) => {
        const t = r.pick([['🍅', '토마토', '🥔', '감자'], ['🍎', '사과', '🍐', '배'], ['🔴', '빨간 구슬', '🔵', '파란 구슬']]);
        const a = r.int(4, 9);
        const b = r.int(1, a - 1);
        return {
          type: 'step', level: '상', visual: `${row(t[0], a)}\n${row(t[2], b)}`,
          text: `${t[1]}은(는) ${t[3]}보다 몇 개 더 많은가요?`,
          steps: [`① 위의 ${t[0]}와 아래의 ${t[2]}를 하나씩 짝 지어 봐.`, `② 짝이 없는 ${t[0]}만 세어 봐. 몇 개일까?`],
          ...genChoices(r, `${a - b}개`, [`${a}개`, ...genNear(r, a - b, 1, 9).map((x) => `${x}개`)]),
          hint: `위아래로 하나씩 짝을 지어 봐.\n짝 없이 남는 ${t[1]}이(가) 바로 "더 많은" 만큼이야.\n남는 것만 세어 봐.`,
          solution: `${a} − ${b} = ${a - b} → ${t[1]}이(가) ${a - b}개 더 많아.`,
        };
      },
      (r) => {
        const a = r.int(2, 9);
        const all = r.int(0, 1) === 1;
        return {
          type: 'think', level: '중', visual: all ? `${a} − ${a} = ❓` : `${a} − 0 = ❓`,
          text: all ? `콩 ${a}개를 모두 심었어요. 남은 콩은 몇 개인가요?` : `콩 ${a}개를 하나도 심지 않았어요. 남은 콩은 몇 개인가요?`,
          ...genChoices(r, all ? 0 : a, all ? [a, 1] : [0, a - 1]),
          hint: all ? '콩을 모두 심었으면 손에 남은 콩이 있을까?\n아무것도 없는 것을 나타내는 수를 떠올려 봐.' : '하나도 심지 않았으면 콩이 줄어들지 않아.\n처음에 있던 콩이 몇 개였는지 봐.',
          solution: all ? `${a} − ${a} = 0. 하나도 남지 않아.` : `${a} − 0 = ${a}. 그대로 ${a}개야.`,
        };
      },
    ],
    // 3-3 이어 세기 · 모으기와 가르기
    [
      (r) => {
        const a = r.int(2, 6);
        const b = r.int(1, 3);
        const steps = Array.from({ length: b }, (_, i) => a + i + 1);
        const shown = genShown(a, b);
        return {
          type: 'visual', level: '하', visual: `${a}  →  ${steps.map(() => '⬜').join('  ')}`,
          text: `${a}에서 ${b}만큼 이어 세면 마지막 수는 무엇인가요?`,
          ...genChoices(r, a + b, genNear(r, a + b, 1, 9)),
          hint: shown.length
            ? `⬜ 한 칸에 수를 하나씩 넣어 봐. ${a} 바로 다음 수부터 시작해.\n${shown.map((v) => `⬜ → ${v}`).join('\n')}\n…\n마지막 칸에 넣은 수가 답이야.`
            : `⬜ 칸이 하나야. ${a} 바로 다음 수를 넣어 봐.\n그 수가 답이야.`,
          solution: `${a} 하고 ${steps.join(', ')}. 마지막 수는 ${a + b}${genJosa(a + b, '이야', '야')}.`,
        };
      },
      (r) => {
        const a = r.int(1, 6);
        const b = r.int(1, 9 - a > 5 ? 5 : 9 - a);
        return {
          type: 'visual', level: '중', visual: `${row('🔴', a)}   ${row('🔵', b)}\n   ↘   ↙\n     ❓`,
          text: `${a}${genJosa(a, '과', '와')} ${b}${genJosa(b, '을', '를')} 모으면 얼마인가요?`,
          ...genChoices(r, a + b, genNear(r, a + b, 1, 9)),
          hint: `🔴 빨간 구슬은 이미 ${a}개야.\n${genCountOnHint('🔵', a, b, '🔵 파란 구슬')}`,
          solution: `${a}${genJosa(a, '과', '와')} ${b}${genJosa(b, '을', '를')} 모으면 ${a + b}${genJosa(a + b, '이', '가')} 돼.`,
        };
      },
      (r) => {
        const n = r.int(4, 9);
        const a = r.int(1, n - 1);
        return {
          type: 'step', level: '상', visual: `    ${n}\n   ↙   ↘\n  ${a}     ❓`,
          text: `${n}${genJosa(n, '을', '를')} ${a}${genJosa(a, '과', '와')} 어떤 수로 가를 수 있나요?`,
          steps: [`① ⭕를 ${n}개 그려 봐.`, '② 그중에서 왼쪽 아래 수만큼 ⭕를 묶어.', '③ 묶지 않은 ⭕를 세어 봐. 몇 개일까?'],
          ...genChoices(r, n - a, genNear(r, n - a, 1, 9).filter((x) => x !== a)),
          hint: `손가락 ${n}개를 펴 봐.\n왼쪽 아래 수만큼 손가락을 접어.\n아직 펴져 있는 손가락이 ❓ 자리의 수야.`,
          solution: `${n}${genJosa(n, '은', '는')} ${a}${genJosa(a, '과', '와')} ${n - a}${genJosa(n - a, '으로', '로')} 가를 수 있어.`,
        };
      },
      (r) => {
        const n = r.int(4, 9);
        const a = r.int(1, n - 1);
        return {
          type: 'think', level: '상', visual: `${a} + ❓ = ${n}`,
          text: `${a}에 얼마를 더하면 ${n}${genJosa(n, '이', '가')} 되나요?`,
          ...genChoices(r, n - a, genNear(r, n - a, 1, 9)),
          hint: `식의 맨 앞 수에서 시작해.\n그다음 수부터 ${n}까지 이어 세면서 손가락을 하나씩 펴 봐.\n${n}에서 멈추고, 편 손가락이 몇 개인지 세어 봐.`,
          solution: `${a} + ${n - a} = ${n}. 답은 ${n - a}${genJosa(n - a, '이야', '야')}.`,
        };
      },
    ],
  ],

  /* ------------------------- 4. 비교하기 ------------------------- */
  'm1-4': [
    // 4-1 길이
    [
      (r) => {
        const [a, b] = r.sample(GEN_LINE_THINGS, 2);
        const [x, y] = r.sample([2, 3, 4, 5, 6, 7, 8], 2);
        const long = r.int(0, 1) === 1;
        const ok = (x > y) === long ? a : b;
        return {
          type: 'visual', level: '하', visual: `${bar(x)}  ${a}\n${bar(y)}  ${b}`,
          text: `더 ${long ? '긴' : '짧은'} 것은 무엇인가요?`,
          ...genChoices(r, ok, [ok === a ? b : a, '둘이 같아요']),
          hint: '왼쪽 끝이 똑같이 맞춰져 있어.\n그러면 오른쪽 끝을 봐.\n오른쪽으로 더 멀리 간 것 → 더 길어.\n먼저 끝나는 것 → 더 짧아.',
          solution: `오른쪽으로 더 멀리 간 것이 더 길어. 더 ${long ? '긴' : '짧은'} 것은 ${ok}(이)야.`,
        };
      },
      genPairTemplate(GEN_LONG, '더 긴', '더 짧은', '더 길어', '두 물건을 왼쪽 끝을 맞춰서 나란히 놓았다고 생각해 봐.\n오른쪽으로 더 많이 삐져나오는 것 → 더 길어.\n덜 나오는 것 → 더 짧아.'),
      (r) => {
        const names = r.sample(GEN_LINE_THINGS, 3);
        const lens = r.sample([2, 3, 4, 5, 6, 7, 8], 3);
        const long = r.int(0, 1) === 1;
        const target = long ? Math.max(...lens) : Math.min(...lens);
        const ok = names[lens.indexOf(target)];
        return {
          type: 'step', level: '중', visual: names.map((n, i) => `${bar(lens[i])}  ${n}`).join('\n'),
          text: `가장 ${long ? '긴' : '짧은'} 것은 무엇인가요?`,
          steps: ['① 왼쪽 끝이 맞춰져 있는지 확인해.', `② 오른쪽 끝을 손가락으로 짚어 봐. 가장 ${long ? '멀리 간' : '먼저 끝나는'} 것은 무엇일까?`],
          ...genChoices(r, ok, names.filter((n) => n !== ok)),
          hint: '세 줄의 오른쪽 끝을 하나씩 짚어 봐.\n오른쪽으로 가장 멀리 간 것 → 가장 길어.\n가장 먼저 끝나는 것 → 가장 짧아.',
          solution: `오른쪽 끝을 보면 ${ok}이(가) 가장 ${long ? '길어' : '짧아'}.`,
        };
      },
      (r) => {
        const [a, b, c] = r.sample(GEN_LINE_THINGS, 3);
        const long = r.int(0, 1) === 1;
        return {
          type: 'think', level: '상', visual: `${a} > ${b}\n${b} > ${c}`,
          text: `${a}은(는) ${b}보다 길어요. ${b}은(는) ${c}보다 길어요. 가장 ${long ? '긴' : '짧은'} 것은 무엇인가요?`,
          ...genChoices(r, long ? a : c, [b, long ? c : a]),
          hint: '긴 것부터 차례로 줄을 세워 봐.\n두 문장에 모두 나오는 것은 줄의 가운데에 서.\n가운데보다 긴 것은 맨 앞, 짧은 것은 맨 뒤야.',
          solution: `긴 것부터 ${a}, ${b}, ${c} 순서야. 가장 ${long ? '긴' : '짧은'} 것은 ${long ? a : c}(이)야.`,
        };
      },
    ],
    // 4-2 무게
    [
      genPairTemplate(GEN_HEAVY, '더 무거운', '더 가벼운', '더 무거워', '두 손에 하나씩 들었다고 생각해 봐.\n들기 힘들고 손이 아래로 쑥 내려가는 것 → 더 무거워.\n가뿐하게 들리는 것 → 더 가벼워.'),
      (r) => {
        const [down, up] = r.sample(GEN_KIDS, 2);
        const heavy = r.int(0, 1) === 1;
        return {
          type: 'visual', level: '중', visual: `⬇️ ${down}          ${up} ⬆️`,
          text: `시소에서 ${down} 쪽이 내려갔어요. 더 ${heavy ? '무거운' : '가벼운'} 친구는 누구인가요?`,
          ...genChoices(r, heavy ? down : up, [heavy ? up : down, '두 친구가 같아요']),
          hint: '시소는 무거운 쪽이 아래로 내려가.\n⬇️ 내려간 쪽 → 더 무거워.\n⬆️ 올라간 쪽 → 더 가벼워.',
          solution: `내려간 쪽이 더 무거워. 더 ${heavy ? '무거운' : '가벼운'} 친구는 ${heavy ? down : up}${genJw(heavy ? down : up, '이야', '야')}.`,
        };
      },
      (r) => {
        const three = r.pick(GEN_HEAVY3);
        const heavy = r.int(0, 1) === 1;
        const ok = heavy ? three[0] : three[2];
        return {
          type: 'step', level: '중', visual: r.shuffle(three).join('   '),
          text: `가장 ${heavy ? '무거운' : '가벼운'} 것은 무엇인가요?`,
          steps: ['① 둘씩 골라서 어느 것이 더 무거운지 생각해 봐.', `② 셋 중에서 가장 ${heavy ? '무거운' : '가벼운'} 것은 무엇일까?`],
          ...genChoices(r, ok, three.filter((t) => t !== ok)),
          hint: '하나씩 들어 본다고 생각해 봐.\n들기 가장 힘든 것 → 가장 무거워.\n가장 가뿐하게 들리는 것 → 가장 가벼워.',
          solution: `무거운 것부터 ${three.join(', ')} 순서야. 가장 ${heavy ? '무거운' : '가벼운'} 것은 ${ok}(이)야.`,
        };
      },
      (r) => {
        const [a, b, c] = r.sample(GEN_KIDS, 3);
        const heavy = r.int(0, 1) === 1;
        const ok = heavy ? a : c;
        return {
          type: 'think', level: '상', visual: `⬇️ ${a}   ${b} ⬆️\n⬇️ ${b}   ${c} ⬆️`,
          text: `${a}은(는) ${b}보다 무거워요. ${b}은(는) ${c}보다 무거워요. 가장 ${heavy ? '무거운' : '가벼운'} 친구는 누구인가요?`,
          ...genChoices(r, heavy ? a : c, [b, heavy ? c : a]),
          hint: '무거운 친구부터 차례로 줄을 세워 봐.\n두 문장에 모두 나오는 친구는 줄의 가운데에 서.\n그 친구보다 무거운 친구는 맨 앞, 가벼운 친구는 맨 뒤야.',
          solution: `무거운 순서는 ${a}, ${b}, ${c}(이)야. 가장 ${heavy ? '무거운' : '가벼운'} 친구는 ${ok}${genJw(ok, '이야', '야')}.`,
        };
      },
    ],
    // 4-3 담을 수 있는 양
    [
      genPairTemplate(GEN_MUCH, '담을 수 있는 양이 더 많은', '담을 수 있는 양이 더 적은', '더 많이 담을 수 있어', '물을 가득 채운다고 생각해 봐.\n그릇이 더 크면 → 물이 더 많이 들어가.\n그릇이 더 작으면 → 물이 더 적게 들어가.'),
      (r) => {
        const [x, y] = r.sample([1, 2, 3, 4, 5], 2);
        const more = r.int(0, 1) === 1;
        const ok = (x > y) === more ? '가' : '나';
        return {
          type: 'visual', level: '하', visual: `가 컵  ${water(x)}\n나 컵  ${water(y)}`,
          text: `똑같은 컵에 물을 담았어요. 물이 더 ${more ? '많은' : '적은'} 컵은 무엇인가요?`,
          ...genChoices(r, `${ok} 컵`, [`${ok === '가' ? '나' : '가'} 컵`, '둘이 같아요']),
          hint: '컵이 똑같으면 물의 높이만 보면 돼.\n파란 칸 🟦이 많으면 → 물이 더 많아.\n파란 칸이 적으면 → 물이 더 적어.',
          solution: `파란 칸이 많을수록 물이 많아. 물이 더 ${more ? '많은' : '적은'} 컵은 ${ok} 컵이야.`,
        };
      },
      (r) => {
        const lv = r.sample([1, 2, 3, 4, 5], 3);
        const names = ['가', '나', '다'];
        const more = r.int(0, 1) === 1;
        const target = more ? Math.max(...lv) : Math.min(...lv);
        const ok = names[lv.indexOf(target)];
        return {
          type: 'step', level: '중', visual: names.map((n, i) => `${n} 컵  ${water(lv[i])}`).join('\n'),
          text: `똑같은 컵 세 개에 물을 담았어요. 물이 가장 ${more ? '많은' : '적은'} 컵은 무엇인가요?`,
          steps: ['① 컵마다 파란 칸 🟦을 세어 봐.', `② 파란 칸이 가장 ${more ? '많은' : '적은'} 컵은 어느 컵일까?`],
          ...genChoices(r, `${ok} 컵`, names.filter((n) => n !== ok).map((n) => `${n} 컵`)),
          hint: '컵이 똑같으면 물의 높이만 보면 돼.\n파란 칸이 가장 많은 컵 → 물이 가장 많아.\n파란 칸이 가장 적은 컵 → 물이 가장 적어.',
          solution: `파란 칸은 가 ${lv[0]}칸, 나 ${lv[1]}칸, 다 ${lv[2]}칸이야. 가장 ${more ? '많은' : '적은'} 컵은 ${ok} 컵이야.`,
        };
      },
      (r) => {
        const [big, small] = r.pick(GEN_MUCH);
        const n = r.int(3, 6);
        return {
          type: 'think', level: '상', visual: `${small} × ${n}번  →  ${big} 가득`,
          text: `${small.slice(small.indexOf(' ') + 1)}(으)로 물을 ${n}번 부었더니 ${big.slice(big.indexOf(' ') + 1)}이(가) 가득 찼어요. 담을 수 있는 양이 더 많은 것은 무엇인가요?`,
          ...genChoices(r, big, [small, '둘이 같아요']),
          hint: '작은 그릇으로 여러 번 부어야 가득 차는 그릇이 있어.\n여러 번 부어야 차는 그릇 → 더 많이 담을 수 있어.',
          solution: `${n}번이나 부어야 가득 찼어. ${big}에 더 많이 담을 수 있어.`,
        };
      },
    ],
  ],

  /* ------------------------- 5. 50까지의 수 ------------------------- */
  'm1-5': [
    // 5-1 10과 십몇
    [
      (r) => {
        const k = r.int(1, 9);
        const n = 10 + k;
        return {
          type: 'visual', level: '하', visual: `${'🔵'.repeat(10)}\n${'🔵'.repeat(k)}`,
          text: '구슬은 모두 몇 개인가요? (윗줄은 10개예요.)',
          ...genChoices(r, `${n}개`, genNear(r, n, 10, 19).map((x) => `${x}개`)),
          hint: `윗줄은 이미 10개야. "열"까지 센 거야.\n${genCountOnHint('🔵', 10, k, '아랫줄 구슬')}`,
          solution: `10개씩 묶음 1개와 낱개 ${k}개 → 모두 ${n}개야.`,
        };
      },
      (r) => {
        const a = r.int(1, 9);
        return {
          type: 'visual', level: '하', visual: `${'🔴'.repeat(a)}${'⚪'.repeat(10 - a)}`,
          text: `10은 ${a}${genJosa(a, '과', '와')} 어떤 수로 가를 수 있나요?`,
          ...genChoices(r, 10 - a, genNear(r, 10 - a, 1, 9)),
          hint: '구슬은 모두 10개야.\n🔴 빨간 구슬이 앞의 수만큼 있어. 빨간 구슬은 세지 마!\n⚪ 하얀 구슬만 하나씩 짚으며 세어 봐. 그 수가 답이야.',
          solution: `10은 ${a}${genJosa(a, '과', '와')} ${10 - a}${genJosa(10 - a, '으로', '로')} 가를 수 있어.`,
        };
      },
      (r) => {
        const k = r.int(1, 9);
        const n = 10 + k;
        const read = (x) => `십${GEN_SINO[x - 10]}`;
        const ex = n === 12 ? 15 : 12;
        return {
          type: 'think', level: '중', visual: String(n),
          text: `수 ${n}${genJosa(n, '을', '를')} 바르게 읽은 것은 무엇인가요?`,
          ...genChoices(r, read(n), genNear(r, n, 11, 19).map(read)),
          hint: `10은 "십"이라고 읽어.\n10보다 큰 수는 "십" 다음에 뒤의 수를 붙여 읽어.\n예) ${ex} → 십 + ${GEN_SINO[ex - 10]} → ${read(ex)}\n${n}의 뒤의 수는 어떻게 읽을까?`,
          solution: `${n}${genJosa(n, '은', '는')} "${read(n)}"${genJosa(k, '이', '')}라고 읽어.`,
        };
      },
      (r) => {
        const a = r.int(6, 9);
        const b = r.int(11 - a, 9);
        const seq = Array.from({ length: b }, (_, i) => a + i + 1);
        const shown = genShown(a, b);
        return {
          type: 'step', level: '상', visual: `${'⚫'.repeat(a)}   ${'⚪'.repeat(b)}`,
          text: `${a}${genJosa(a, '과', '와')} ${b}${genJosa(b, '을', '를')} 모으면 얼마인가요?`,
          steps: [`① ⚫는 이미 ${a}개야. ${a}에서 시작해.`, `② ⚪를 하나씩 짚으며 이어 세어 봐 → ${shown.length ? `${shown.join(', ')}, …` : '…'}`, '③ 마지막 ⚪에서 말한 수는 몇일까?'],
          ...genChoices(r, a + b, genNear(r, a + b, 10, 19)),
          hint: `⚫ 검은 바둑돌은 이미 ${a}개야.\n${genCountOnHint('⚪', a, b, '⚪ 흰 바둑돌')}`,
          solution: `${a} 하고 ${seq.join(', ')}. 모으면 ${a + b}${genJosa(a + b, '이야', '야')}.`,
        };
      },
      (r) => {
        const n = r.int(11, 18);
        const a = r.int(Math.max(2, n - 9), 9);
        return {
          type: 'step', level: '상', visual: `    ${n}\n   ↙   ↘\n  ${a}     ❓`,
          text: `${n}${genJosa(n, '을', '를')} ${a}${genJosa(a, '과', '와')} 어떤 수로 가를 수 있나요?`,
          steps: [`① 바둑돌 ${n}개를 놓아 봐.`, '② 왼쪽 아래 수만큼 바둑돌을 한쪽으로 옮겨.', '③ 남은 바둑돌을 세어 봐. 몇 개일까?'],
          ...genChoices(r, n - a, genNear(r, n - a, 1, 12).filter((x) => x !== a)),
          hint: `왼쪽 아래 수에서 시작해.\n그다음 수부터 ${n}까지 이어 세면서 손가락을 하나씩 펴 봐.\n${n}에서 멈추고, 편 손가락이 몇 개인지 세어 봐.`,
          solution: `${n}${genJosa(n, '은', '는')} ${a}${genJosa(a, '과', '와')} ${n - a}${genJosa(n - a, '으로', '로')} 가를 수 있어.`,
        };
      },
    ],
    // 5-2 10개씩 묶어 세기
    [
      (r) => {
        const t = r.int(2, 5);
        const tensWord = ['', '십', '이십', '삼십', '사십', '오십'];
        const shown = genShown(0, t).map((x) => `🔟 ${tensWord[x]}~`);
        return {
          type: 'visual', level: '하', visual: Array(t).fill('🔟').join(' '),
          text: `10개씩 묶음이 ${t}개 있어요. 모두 몇 개인가요?`,
          ...genChoices(r, `${t * 10}개`, [t * 10 - 10, t * 10 + 10, t].map((x) => `${x}개`)),
          hint: `🔟 하나는 10개야.\n🔟를 하나씩 짚으며 10씩 뛰어 세어 봐.\n${shown.join('\n')}\n…\n마지막에 말한 수가 답이야.`,
          solution: `10개씩 묶음 ${t}개는 ${t * 10}${genJosa(t * 10, '이야', '야')}.`,
        };
      },
      (r) => {
        const t = r.int(2, 4);
        const k = r.int(1, 9);
        const n = t * 10 + k;
        return {
          type: 'visual', level: '중', visual: `${Array(t).fill('🔟').join(' ')}   ${'🔹'.repeat(k)}`,
          text: `10개씩 묶음 ${t}개와 낱개 ${k}개는 모두 몇 개인가요?`,
          ...genChoices(r, `${n}개`, [k * 10 + t, n + 10 > 50 ? n - 10 : n + 10, t + k].filter((x) => x !== n).map((x) => `${x}개`)),
          hint: '10개씩 묶음의 수를 앞에, 낱개의 수를 뒤에 나란히 써.\n예) 묶음 1개, 낱개 5개 → 15',
          solution: `10개씩 묶음 ${t}개 → ${t * 10}, 낱개 ${k}개 → 모두 ${n}개야.`,
        };
      },
      (r) => {
        const t = r.int(2, 4);
        const k = r.int(1, 9);
        const n = t * 10 + k;
        const askTens = r.int(0, 1) === 1 || t === k;
        const ans = askTens ? t : k;
        // 예시 수: 정답 숫자가 들어가지 않게 골라요.
        const et = [1, 2, 3, 4].find((x) => x !== ans && x !== t);
        const eo = [5, 6, 7, 8, 9, 3].find((x) => x !== ans && x !== et && x !== k);
        return {
          type: 'step', level: '중', visual: String(n),
          text: `${n}에서 ${askTens ? '10개씩 묶음은 몇 개' : '낱개는 몇 개'}인가요?`,
          steps: ['① 두 자리 수에서 앞에 쓴 수는 10개씩 묶음의 수야.', '② 뒤에 쓴 수는 낱개의 수야.', `③ 그럼 ${n}에서 ${askTens ? '앞에 쓴 수' : '뒤에 쓴 수'}는 무엇일까?`],
          ...genChoices(r, `${ans}개`, [askTens ? k : t, n, ans + 1].filter((x) => x !== ans).map((x) => `${x}개`)),
          hint: `두 자리 수에서 앞의 수 → 10개씩 묶음, 뒤의 수 → 낱개야.\n예) ${et}${eo} → 10개씩 묶음 ${et}개, 낱개 ${eo}개`,
          solution: `${n}${genJosa(n, '은', '는')} 10개씩 묶음 ${t}개와 낱개 ${k}개야.`,
        };
      },
      (r) => {
        const t = r.int(2, 5);
        const words = ['', '십', '이십', '삼십', '사십', '오십'];
        const native = ['', '열', '스물', '서른', '마흔', '쉰'];
        return {
          type: 'think', level: '중', visual: String(t * 10),
          text: `수 ${t * 10}을 바르게 읽은 것은 무엇인가요?`,
          ...genChoices(r, `${words[t]}(${native[t]})`, [t - 1, t + 1 > 5 ? t - 2 : t + 1].map((x) => `${words[x]}(${native[x]})`)),
          hint: `10씩 커지는 수와 읽는 말을 짝지어 봐!\n${genReadTable(t, 1, 5, (x) => `${words[x]}(${native[x]})`, (x) => x * 10)}\n❓ 자리에는 앞뒤 말 사이에 오는 말이 들어가.`,
          solution: `${t * 10}은 "${words[t]}" 또는 "${native[t]}"${genJw(native[t], '이', '')}라고 읽어.`,
        };
      },
      (r) => {
        const t = r.int(2, 4);
        const k = r.int(1, 9);
        const n = t * 10 + k;
        const thing = r.pick([['사탕', '봉지'], ['달걀', '판'], ['색연필', '통'], ['구슬', '주머니']]);
        return {
          type: 'think', level: '상', visual: `${Array(t).fill('🔟').join(' ')}   ${'🔹'.repeat(k)}`,
          text: `${thing[0]}이(가) 10개씩 ${t}${thing[1]} 있어요. 낱개로 ${k}개가 더 있어요. 모두 몇 개인가요?`,
          ...genChoices(r, `${n}개`, [t + k, k * 10 + t, n + 1].filter((x) => x !== n).map((x) => `${x}개`)),
          hint: `10개씩 ${t}${thing[1]}은(는) 10개씩 묶음 ${t}개야.\n묶음의 수를 앞에, 낱개의 수를 뒤에 나란히 써 봐.`,
          solution: `${t * 10}개와 ${k}개 → 모두 ${n}개야.`,
        };
      },
    ],
    // 5-3 수의 순서와 크기 비교
    [
      (r) => {
        const start = r.int(11, 45);
        const hole = r.int(1, 3);
        const seq = [0, 1, 2, 3, 4].map((i) => start + i);
        return {
          type: 'visual', level: '하', visual: seq.map((v, i) => (i === hole ? '❓' : v)).join('  '),
          text: '❓에 알맞은 수는 무엇인가요?',
          ...genChoices(r, seq[hole], genNear(r, seq[hole], 1, 50)),
          hint: '왼쪽부터 소리 내어 읽어 봐. 수가 1씩 커지고 있어.\n❓ 바로 왼쪽 수 다음에 오는 수가 들어가.',
          solution: `${seq.join(', ')} 순서야. ❓는 ${seq[hole]}${genJosa(seq[hole], '이야', '야')}.`,
        };
      },
      (r) => {
        const up = r.int(0, 1) === 1;
        const n = up ? r.int(10, 49) : r.int(11, 50);
        const ans = up ? n + 1 : n - 1;
        return {
          type: 'think', level: '중', visual: up ? `${n}  →  ❓` : `❓  →  ${n}`,
          text: `${n}보다 1만큼 더 ${up ? '큰' : '작은'} 수는 무엇인가요?`,
          ...genChoices(r, ans, [up ? n - 1 : n + 1, up ? n + 10 : n - 10].filter((x) => x > 0)),
          hint: up ? `1만큼 더 큰 수는 바로 다음 수야.\n${n}부터 소리 내어 하나 더 세어 봐.` : `1만큼 더 작은 수는 바로 앞의 수야.\n${n}에서 거꾸로 하나 세어 봐.`,
          solution: `${n}보다 1만큼 더 ${up ? '큰' : '작은'} 수는 ${ans}${genJosa(ans, '이야', '야')}.`,
        };
      },
      (r) => {
        const [a, b] = r.sample(Array.from({ length: 40 }, (_, i) => i + 11), 2);
        const big = r.int(0, 1) === 1;
        const ans = big ? Math.max(a, b) : Math.min(a, b);
        const sameTens = Math.floor(a / 10) === Math.floor(b / 10);
        return {
          type: 'think', level: '중', visual: `${a}     ${b}`,
          text: `두 수 중에서 더 ${big ? '큰' : '작은'} 수는 무엇인가요?`,
          ...genChoices(r, ans, [a === ans ? b : a, '두 수가 같아요']),
          hint: sameTens
            ? '두 수의 앞의 수(10개씩 묶음)가 같아.\n그러면 뒤의 수(낱개)를 비교해 봐.\n뒤의 수가 더 크면 → 더 큰 수야.'
            : '두 수의 앞의 수(10개씩 묶음)부터 비교해 봐.\n앞의 수가 더 크면 → 더 큰 수야.',
          solution: `${Math.max(a, b)}${genJosa(Math.max(a, b), '은', '는')} ${Math.min(a, b)}보다 커. 더 ${big ? '큰' : '작은'} 수는 ${ans}${genJosa(ans, '이야', '야')}.`,
        };
      },
      (r) => {
        const three = r.sample(Array.from({ length: 40 }, (_, i) => i + 11), 3);
        const big = r.int(0, 1) === 1;
        const ans = big ? Math.max(...three) : Math.min(...three);
        const sorted = [...three].sort((x, y) => x - y);
        return {
          type: 'step', level: '상', visual: three.join('     '),
          text: `세 수 중에서 가장 ${big ? '큰' : '작은'} 수는 무엇인가요?`,
          steps: ['① 10개씩 묶음의 수(앞의 수)를 먼저 비교해 봐.', '② 앞의 수가 같으면 낱개의 수(뒤의 수)를 비교해 봐.', `③ 그럼 가장 ${big ? '큰' : '작은'} 수는 무엇일까?`],
          ...genChoices(r, ans, three.filter((x) => x !== ans)),
          hint: '앞의 수(10개씩 묶음)가 클수록 큰 수야.\n앞의 수가 같으면 뒤의 수(낱개)가 큰 쪽이 더 커.',
          solution: `작은 수부터 놓으면 ${sorted.join(', ')}. 가장 ${big ? '큰' : '작은'} 수는 ${ans}${genJosa(ans, '이야', '야')}.`,
        };
      },
      (r) => {
        const n = r.int(12, 48);
        return {
          type: 'think', level: '중', visual: `${n - 1}   ❓   ${n + 1}`,
          text: `${n - 1}${genJosa(n - 1, '과', '와')} ${n + 1} 사이에 있는 수는 무엇인가요?`,
          ...genChoices(r, n, [n - 1, n + 1]),
          hint: `수를 순서대로 세어 봐.\n${n - 1} 바로 다음, ${n + 1} 바로 앞에 오는 수가 사이에 있어.`,
          solution: `${n - 1}, ${n}, ${n + 1} 순서야. 사이에 있는 수는 ${n}${genJosa(n, '이야', '야')}.`,
        };
      },
    ],
  ],
};

/* ============================== 만들기 ============================== */
const GEN_CACHE = {};

/** 한글 조사 "은(는)" 같은 표기를 앞 글자의 받침에 맞게 골라요. ("(이)야" → 받침 있으면 "이야", 없으면 "야") */
function genFixJosa(s) {
  const pairs = { '은(는)': ['은', '는'], '이(가)': ['이', '가'], '을(를)': ['을', '를'], '와(과)': ['과', '와'], '(으)로': ['으로', '로'], '이에요': ['이에요', '예요'], '(이)야': ['이야', '야'] };
  return String(s).replace(/([가-힣])(\s?)(은\(는\)|이\(가\)|을\(를\)|와\(과\)|\(으\)로|이에요|\(이\)야)/g, (m, ch, sp, j) => {
    const code = (ch.charCodeAt(0) - 0xac00) % 28;
    const [withFinal, without] = pairs[j];
    // "(으)로"는 ㄹ 받침 뒤에서도 "로"예요.
    const final = j === '(으)로' ? code !== 0 && code !== 8 : code !== 0;
    return ch + (j === '(이)야' ? '' : sp) + (final ? withFinal : without);
  });
}

/** id("단원~소단원~틀~씨앗")로 문제 하나 만들기 */
function genQuestion(id) {
  if (GEN_CACHE[id]) return GEN_CACHE[id];
  const [chId, sub, tpl, seed] = id.split('~');
  const list = window.GENERATORS[chId] && window.GENERATORS[chId][Number(sub)];
  const make = list && list[Number(tpl)];
  if (!make) return null;
  // 이웃한 씨앗끼리 비슷한 문제가 나오지 않도록 id 전체를 섞어서(FNV-1a) 난수의 씨앗으로 써요.
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  const q = make(genRng(h ^ (h >>> 15)));
  ['text', 'hint', 'solution', 'visual'].forEach((k) => q[k] && (q[k] = genFixJosa(q[k])));
  q.choices = q.choices.map(genFixJosa);
  if (q.steps) q.steps = q.steps.map(genFixJosa);
  q.id = id;
  q.sub = Number(sub);
  q.generated = true;
  GEN_CACHE[id] = q;
  return q;
}

/**
 * 소단원 하나에서 서로 다른 문제 n개 만들기
 *  - 틀을 차례로 돌려 써서 유형이 고르게 섞여요.
 *  - 같은 그림·같은 질문이 겹치면 다음 씨앗으로 넘어가요.
 */
function genSet(chId, sub, n, seed) {
  const list = (window.GENERATORS[chId] || [])[sub] || [];
  const out = [];
  const seen = new Set();
  let s = seed >>> 0;
  for (let i = 0; out.length < n && i < n * 12 && list.length; i++, s++) {
    const q = genQuestion(`${chId}~${sub}~${i % list.length}~${s}`);
    if (!q || q.answer < 0) continue;
    const key = `${q.visual || ''}|${q.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

function hasGenerator(chId, sub) {
  return !!((window.GENERATORS[chId] || [])[sub] || []).length;
}
