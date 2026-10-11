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

/* ---------------------------- 2단원 재료 ---------------------------- */
const GEN_SHAPES = [
  {
    name: '상자 모양',
    things: ['📦 택배 상자', '🎁 선물 상자', '🎲 주사위', '🧱 벽돌', '📕 두꺼운 책', '🧊 네모난 얼음'],
    says: ['뾰족한 부분이 있고 잘 쌓을 수 있어요.', '평평한 부분만 있어서 굴러가지 않아요.'],
  },
  {
    name: '둥근 기둥 모양',
    things: ['🥫 통조림 캔', '🥁 북', '🔋 건전지', '🕯️ 양초', '🧻 두루마리 휴지', '🥤 음료수 컵'],
    says: ['눕히면 굴러가고, 세우면 쌓을 수 있어요.', '평평한 부분도 있고 둥근 부분도 있어요.'],
  },
  {
    name: '공 모양',
    things: ['⚽ 축구공', '🏀 농구공', '🎾 테니스공', '🏐 배구공', '🔮 구슬', '🍊 귤'],
    says: ['어느 쪽으로 굴려도 잘 굴러가요.', '평평한 부분이 없어서 쌓을 수 없어요.'],
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
        hint: '평평한 부분과 둥근 부분이 있는지 살펴보세요.',
        solution: `${ok}은(는) ${me.name}이에요. ${me.says[0]}`,
      };
    },
    (r) => {
      const ok = r.pick(me.things);
      const wrongs = others.map((o) => r.pick(o.things));
      return {
        type: 'visual', level: '하', visual: [ok, ...wrongs].map((t) => t.split(' ')[0]).sort().join('   '),
        text: `${me.name}인 물건은 무엇인가요?`,
        ...genChoices(r, ok, wrongs),
        hint: me.says[0],
        solution: `${ok}이(가) ${me.name}이에요.`,
      };
    },
    (r) => {
      const say = r.pick(me.says);
      return {
        type: 'think', level: '중', visual: `💬 "${say}"`,
        text: '친구가 설명하는 모양은 무엇인가요?',
        ...genChoices(r, me.name, names),
        hint: '세 가지 모양을 하나씩 굴려 보고 쌓아 본다고 생각해 보세요.',
        solution: `${me.name}은(는) ${say}`,
      };
    },
    (r) => {
      const two = r.sample(me.things, 2);
      const odd = r.pick(r.pick(others).things);
      return {
        type: 'step', level: '중', visual: r.shuffle([...two, odd]).map((t) => t.split(' ')[0]).join('   '),
        text: '모양이 다른 물건 하나는 무엇인가요?',
        steps: ['① 물건마다 어떤 모양인지 생각해요.', '② 같은 모양 둘을 찾아요.', '③ 남은 하나를 골라요.'],
        ...genChoices(r, odd, two),
        hint: `${me.name}이 두 개 있어요.`,
        solution: `${two[0]}, ${two[1]}은(는) ${me.name}이에요. ${odd}만 달라요.`,
      };
    },
    (r) => {
      const n = r.int(2, 4);
      const mine = r.sample(me.things, n);
      const rest = [...r.sample(others[0].things, r.int(1, 2)), ...r.sample(others[1].things, r.int(1, 2))];
      return {
        type: 'step', level: '상', visual: r.shuffle([...mine, ...rest]).map((t) => t.split(' ')[0]).join(' '),
        text: `${me.name}은 모두 몇 개인가요?`,
        steps: [`① ${me.name}에만 ○를 해요.`, '② ○를 한 물건을 하나씩 세어요.'],
        ...genChoices(r, `${n}개`, genNear(r, n, 1, 6).map((x) => `${x}개`)),
        hint: `${me.says[0]} 이런 물건만 세어요.`,
        solution: `${mine.join(', ')} → 모두 ${n}개예요.`,
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
      solution: `${big}이(가) ${small}보다 ${bigVerb}. 답은 ${ok}이에요.`,
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
        return {
          type: 'visual', level: '하', visual: row(t.e, n),
          text: `${t.n}은(는) 모두 몇 ${t.u}인가요?`,
          ...genChoices(r, `${n}${t.u}`, genNear(r, n, 1, 9).map((x) => `${x}${t.u}`)),
          hint: '손가락으로 하나씩 짚으면서 세어 보아요.',
          solution: `하나씩 세면 ${GEN_NATIVE.slice(1, n + 1).join(', ')} → 모두 ${n}${t.u}예요.`,
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
          hint: native ? '하나, 둘, 셋… 순서대로 세어 보세요.' : '일, 이, 삼… 순서대로 세어 보세요.',
          solution: `${n}${genJosa(n, '은', '는')} "${GEN_NATIVE[n]}" 또는 "${GEN_SINO[n]}"${genJosa(n, '이', '')}라고 읽어요.`,
        };
      },
      (r) => {
        const [a, b] = r.sample(GEN_THINGS.filter((t) => t.u === '개'), 2);
        const n = r.int(2, 5);
        const m = r.int(1, 4);
        return {
          type: 'step', level: '중', visual: r.shuffle([...Array(n).fill(a.e), ...Array(m).fill(b.e)]).join(' '),
          text: `${a.n}만 세면 몇 개인가요?`,
          steps: [`① ${a.e}에만 ○를 해요.`, '② ○를 한 것을 하나씩 세어요.'],
          ...genChoices(r, `${n}개`, [`${n + m}개`, ...genNear(r, n, 1, 9).map((x) => `${x}개`)]),
          hint: `${b.n}은(는) 세지 않아요.`,
          solution: `${a.e}만 세면 ${n}개예요. (${b.n}은(는) ${m}개)`,
        };
      },
      (r) => {
        const t = r.pick([['🍪', '과자', '접시'], ['🍬', '사탕', '주머니'], ['🥕', '당근', '바구니']]);
        const n = r.int(2, 6);
        return {
          type: 'think', level: '중', visual: `${row(t[0], n)}  →  (빈 ${t[2]})`,
          text: `${t[2]}에 ${t[1]}이(가) ${n}개 있었어요. 모두 먹었어요. 남은 ${t[1]}의 수는 무엇인가요?`,
          ...genChoices(r, '0', [String(n), '1']),
          hint: '아무것도 없는 것을 나타내는 수가 있어요.',
          solution: '아무것도 없는 것은 0이라 쓰고 "영"이라고 읽어요.',
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
          hint: down ? '수가 하나씩 작아지고 있어요.' : '수를 순서대로 세어 보세요.',
          solution: `${seq.join(', ')} 순서예요. ❓는 ${ans}${genJosa(ans, '이에요', '예요')}.`,
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
          hint: up ? `${n} 바로 다음 수를 생각해요.` : `${n} 바로 앞의 수를 생각해요.`,
          solution: `${n}보다 1만큼 더 ${up ? '큰' : '작은'} 수는 ${ans}${genJosa(ans, '이에요', '예요')}.`,
        };
      },
      (r) => {
        const five = r.sample(GEN_ANIMALS, 5);
        const k = r.int(2, 5);
        const left = r.int(0, 1) === 1;
        const ok = left ? five[k - 1] : five[5 - k];
        return {
          type: 'step', level: '상', visual: `왼쪽  ${five.map((a) => a[0]).join(' ')}  오른쪽`,
          text: `${left ? '왼쪽' : '오른쪽'}에서 ${GEN_ORDER[k]}에 있는 동물은 무엇인가요?`,
          steps: [`① ${left ? '왼쪽' : '오른쪽'} 끝에서 시작해요.`, `② 첫째, 둘째… ${GEN_ORDER[k]}까지 세어요.`],
          ...genChoices(r, `${ok[0]} ${ok[1]}`, r.shuffle(five.filter((a) => a !== ok)).map((a) => `${a[0]} ${a[1]}`)),
          hint: `${left ? '왼쪽' : '오른쪽'}부터 손가락으로 짚으며 세어요.`,
          solution: `${left ? '왼쪽' : '오른쪽'}에서 ${GEN_ORDER[k]}는 ${ok[0]} ${ok[1]}이에요.`,
        };
      },
      (r) => {
        const n = r.int(2, 8);
        return {
          type: 'think', level: '중', visual: `${n - 1}   ❓   ${n + 1}`,
          text: `${n - 1}${genJosa(n - 1, '과', '와')} ${n + 1} 사이에 있는 수는 무엇인가요?`,
          ...genChoices(r, n, [n - 1, n + 1]),
          hint: `${n - 1} 다음에 오는 수예요.`,
          solution: `${n - 1}, ${n}, ${n + 1} 순서예요. 사이에 있는 수는 ${n}${genJosa(n, '이에요', '예요')}.`,
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
          hint: '하나씩 짝을 지어 보세요. 남는 쪽이 더 많아요.',
          solution: `${a.n} ${n}, ${b.n} ${m}. ${Math.max(n, m)}${genJosa(Math.max(n, m), '이', '가')} ${Math.min(n, m)}보다 커요. 더 ${more ? '많은' : '적은'} 것은 ${ok.n}이에요.`,
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
          hint: '수를 순서대로 셀 때 뒤에 나오는 수가 더 커요.',
          solution: `${Math.max(a, b)}${genJosa(Math.max(a, b), '은', '는')} ${Math.min(a, b)}보다 커요. 더 ${big ? '큰' : '작은'} 수는 ${ans}${genJosa(ans, '이에요', '예요')}.`,
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
          steps: ['① 작은 수부터 순서대로 놓아요.', `② 가장 ${big ? '뒤' : '앞'}에 있는 수를 골라요.`],
          ...genChoices(r, ans, three.filter((x) => x !== ans)),
          hint: '1부터 9까지 세면서 어느 수가 먼저 나오는지 보세요.',
          solution: `작은 수부터 놓으면 ${sorted.join(', ')}. 가장 ${big ? '큰' : '작은'} 수는 ${ans}${genJosa(ans, '이에요', '예요')}.`,
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
          hint: `${a}${genJosa(a, '과', '와')} ${b} 중에서 더 ${more ? '큰' : '작은'} 수를 찾아요.`,
          solution: `${Math.max(a, b)}${genJosa(Math.max(a, b), '이', '가')} ${Math.min(a, b)}보다 커요. 더 ${more ? '많이' : '적게'} 가진 친구는 ${ok}이에요.`,
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
          hint: `${a}에서 시작해서 ${b}만큼 이어 세어 보세요.`,
          solution: `${a} + ${b} = ${a + b} → 모두 ${a + b}${t.u}예요.`,
        };
      },
      (r) => {
        const a = r.int(1, 7);
        const b = r.int(1, 9 - a);
        return {
          type: 'think', level: '중', visual: `${a} + ${b} = ❓`,
          text: `${a} 더하기 ${b}${genJosa(b, '은', '는')} 얼마인가요?`,
          ...genChoices(r, a + b, genNear(r, a + b, 1, 9)),
          hint: `손가락 ${a}개를 펴고, ${b}개를 더 펴 보세요.`,
          solution: `${a} + ${b} = ${a + b}. ${a}${genJosa(a, '과', '와')} ${b}의 합은 ${a + b}${genJosa(a + b, '이에요', '예요')}.`,
        };
      },
      (r) => {
        const t = r.pick([['🍓', '딸기', '바구니', '땄어요'], ['🐝', '벌', '꽃밭', '날아왔어요'], ['🥚', '달걀', '둥지', '낳았어요']]);
        const a = r.int(2, 6);
        const b = r.int(1, 9 - a > 3 ? 3 : 9 - a);
        return {
          type: 'step', level: '상', visual: `${row(t[0], a)}  +  ${row(t[0], b)}`,
          text: `${t[2]}에 ${t[1]}이(가) ${a}개 있어요. ${b}개를 더 ${t[3]}. 모두 몇 개인가요?`,
          steps: [`① 처음 수를 찾아요 → ${a}`, `② 더해진 수를 찾아요 → ${b}`, `③ 덧셈식을 써요 → ${a} + ${b}`],
          ...genChoices(r, `${a + b}개`, [`${a - b > 0 ? a - b : a + b + 1}개`, ...genNear(r, a + b, 1, 9).map((x) => `${x}개`)]),
          hint: '"더", "모두"라는 말이 나오면 더해요.',
          solution: `${a} + ${b} = ${a + b} → 모두 ${a + b}개예요.`,
        };
      },
      (r) => {
        const a = r.int(1, 9);
        const front = r.int(0, 1) === 1;
        return {
          type: 'think', level: '중', visual: front ? `0 + ${a} = ❓` : `${a} + 0 = ❓`,
          text: front ? `아무것도 없는데 ${a}개를 받았어요. 모두 몇 개인가요?` : `${a}개가 있는데 더 받지 않았어요. 모두 몇 개인가요?`,
          ...genChoices(r, a, [0, a + 1 > 9 ? a - 1 : a + 1]),
          hint: '0은 아무것도 없다는 뜻이에요.',
          solution: `0을 더하면 수가 그대로예요. 답은 ${a}${genJosa(a, '이에요', '예요')}.`,
        };
      },
    ],
    // 3-2 빼기
    [
      (r) => {
        const t = r.pick([['🍬', '사탕', '개를 먹었어요'], ['🎈', '풍선', '개가 터졌어요'], ['🍪', '과자', '개를 먹었어요'], ['🍎', '사과', '개를 먹었어요']]);
        const a = r.int(3, 9);
        const b = r.int(1, a - 1);
        return {
          type: 'visual', level: '하', visual: `${row(t[0], a - b)} ${row('✖️', b)}`,
          text: `${t[1]}이(가) ${a}개 있었어요. ${b}${t[2]}. 남은 ${t[1]}은(는) 몇 개인가요?`,
          ...genChoices(r, `${a - b}개`, genNear(r, a - b, 0, 9).map((x) => `${x}개`)),
          hint: '✖️ 표시가 없는 것만 세어 보세요.',
          solution: `${a} − ${b} = ${a - b} → ${a - b}개가 남아요.`,
        };
      },
      (r) => {
        const a = r.int(2, 9);
        const b = r.int(1, a - 1);
        return {
          type: 'think', level: '중', visual: `${a} − ${b} = ❓`,
          text: `${a} 빼기 ${b}${genJosa(b, '은', '는')} 얼마인가요?`,
          ...genChoices(r, a - b, genNear(r, a - b, 0, 9)),
          hint: `손가락 ${a}개를 펴고, ${b}개를 접어 보세요.`,
          solution: `${a} − ${b} = ${a - b}. ${a}${genJosa(a, '과', '와')} ${b}의 차는 ${a - b}${genJosa(a - b, '이에요', '예요')}.`,
        };
      },
      (r) => {
        const t = r.pick([['🍅', '토마토', '🥔', '감자'], ['🍎', '사과', '🍐', '배'], ['🔴', '빨간 구슬', '🔵', '파란 구슬']]);
        const a = r.int(4, 9);
        const b = r.int(1, a - 1);
        return {
          type: 'step', level: '상', visual: `${row(t[0], a)}\n${row(t[2], b)}`,
          text: `${t[1]}은(는) ${t[3]}보다 몇 개 더 많은가요?`,
          steps: ['① 위아래로 하나씩 짝을 지어요.', '② 짝이 없는 것을 세어요.', `③ 뺄셈식으로 써요 → ${a} − ${b}`],
          ...genChoices(r, `${a - b}개`, [`${a}개`, ...genNear(r, a - b, 1, 9).map((x) => `${x}개`)]),
          hint: '"몇 개 더 많은가"는 큰 수에서 작은 수를 빼요.',
          solution: `${a} − ${b} = ${a - b} → ${a - b}개 더 많아요.`,
        };
      },
      (r) => {
        const a = r.int(2, 9);
        const all = r.int(0, 1) === 1;
        return {
          type: 'think', level: '중', visual: all ? `${a} − ${a} = ❓` : `${a} − 0 = ❓`,
          text: all ? `콩 ${a}개를 모두 심었어요. 남은 콩은 몇 개인가요?` : `콩 ${a}개를 하나도 심지 않았어요. 남은 콩은 몇 개인가요?`,
          ...genChoices(r, all ? 0 : a, all ? [a, 1] : [0, a - 1]),
          hint: all ? '모두 없어지면 아무것도 남지 않아요.' : '하나도 빼지 않으면 그대로예요.',
          solution: all ? `${a} − ${a} = 0. 하나도 남지 않아요.` : `${a} − 0 = ${a}. 그대로 ${a}개예요.`,
        };
      },
    ],
    // 3-3 이어 세기 · 모으기와 가르기
    [
      (r) => {
        const a = r.int(2, 6);
        const b = r.int(1, 3);
        const steps = Array.from({ length: b }, (_, i) => a + i + 1);
        return {
          type: 'visual', level: '하', visual: `${a}  →  ${steps.map(() => '⬜').join('  ')}`,
          text: `${a}에서 ${b}만큼 이어 세면 마지막 수는 무엇인가요?`,
          ...genChoices(r, a + b, genNear(r, a + b, 1, 9)),
          hint: `${a} 다음 수부터 ${b}번 세어요.`,
          solution: `${a} 하고 ${steps.join(', ')}. 마지막 수는 ${a + b}${genJosa(a + b, '이에요', '예요')}.`,
        };
      },
      (r) => {
        const a = r.int(1, 6);
        const b = r.int(1, 9 - a > 5 ? 5 : 9 - a);
        return {
          type: 'visual', level: '중', visual: `${row('🔴', a)}   ${row('🔵', b)}\n   ↘   ↙\n     ❓`,
          text: `${a}${genJosa(a, '과', '와')} ${b}${genJosa(b, '을', '를')} 모으면 얼마인가요?`,
          ...genChoices(r, a + b, genNear(r, a + b, 1, 9)),
          hint: '두 묶음을 한곳에 모아서 세어 보세요.',
          solution: `${a}${genJosa(a, '과', '와')} ${b}${genJosa(b, '을', '를')} 모으면 ${a + b}${genJosa(a + b, '이', '가')} 돼요.`,
        };
      },
      (r) => {
        const n = r.int(4, 9);
        const a = r.int(1, n - 1);
        return {
          type: 'step', level: '상', visual: `    ${n}\n   ↙   ↘\n  ${a}     ❓`,
          text: `${n}${genJosa(n, '을', '를')} ${a}${genJosa(a, '과', '와')} 어떤 수로 가를 수 있나요?`,
          steps: [`① ⭕를 ${n}개 그려요.`, `② ${a}개를 묶어요.`, '③ 남은 ⭕를 세어요.'],
          ...genChoices(r, n - a, genNear(r, n - a, 1, 9).filter((x) => x !== a)),
          hint: `${a}에 얼마를 더하면 ${n}${genJosa(n, '이', '가')} 되는지 생각해요.`,
          solution: `${n}${genJosa(n, '은', '는')} ${a}${genJosa(a, '과', '와')} ${n - a}${genJosa(n - a, '으로', '로')} 가를 수 있어요.`,
        };
      },
      (r) => {
        const n = r.int(4, 9);
        const a = r.int(1, n - 1);
        return {
          type: 'think', level: '상', visual: `${a} + ❓ = ${n}`,
          text: `${a}에 얼마를 더하면 ${n}${genJosa(n, '이', '가')} 되나요?`,
          ...genChoices(r, n - a, genNear(r, n - a, 1, 9)),
          hint: `${a}에서 ${n}까지 이어 세면서 손가락을 접어 보세요.`,
          solution: `${a} + ${n - a} = ${n}. 답은 ${n - a}${genJosa(n - a, '이에요', '예요')}.`,
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
          hint: '왼쪽 끝이 맞춰져 있어요. 오른쪽 끝을 보세요.',
          solution: `오른쪽으로 더 멀리 간 것이 더 길어요. 더 ${long ? '긴' : '짧은'} 것은 ${ok}이에요.`,
        };
      },
      genPairTemplate(GEN_LONG, '더 긴', '더 짧은', '더 길어요', '두 물건을 나란히 놓았다고 생각해 보세요.'),
      (r) => {
        const names = r.sample(GEN_LINE_THINGS, 3);
        const lens = r.sample([2, 3, 4, 5, 6, 7, 8], 3);
        const long = r.int(0, 1) === 1;
        const target = long ? Math.max(...lens) : Math.min(...lens);
        const ok = names[lens.indexOf(target)];
        return {
          type: 'step', level: '중', visual: names.map((n, i) => `${bar(lens[i])}  ${n}`).join('\n'),
          text: `가장 ${long ? '긴' : '짧은'} 것은 무엇인가요?`,
          steps: ['① 왼쪽 끝이 맞는지 확인해요.', `② 오른쪽 끝이 가장 ${long ? '멀리 간' : '가까운'} 것을 찾아요.`],
          ...genChoices(r, ok, names.filter((n) => n !== ok)),
          hint: '셋을 비교할 때는 "가장"이라는 말을 써요.',
          solution: `오른쪽 끝을 보면 ${ok}이(가) 가장 ${long ? '길어요' : '짧아요'}.`,
        };
      },
      (r) => {
        const [a, b, c] = r.sample(GEN_LINE_THINGS, 3);
        const long = r.int(0, 1) === 1;
        return {
          type: 'think', level: '상', visual: `${a} > ${b}\n${b} > ${c}`,
          text: `${a}은(는) ${b}보다 길어요. ${b}은(는) ${c}보다 길어요. 가장 ${long ? '긴' : '짧은'} 것은 무엇인가요?`,
          ...genChoices(r, long ? a : c, [b, long ? c : a]),
          hint: '긴 것부터 차례로 줄을 세워 보세요.',
          solution: `긴 것부터 ${a}, ${b}, ${c} 순서예요. 가장 ${long ? '긴' : '짧은'} 것은 ${long ? a : c}이에요.`,
        };
      },
    ],
    // 4-2 무게
    [
      genPairTemplate(GEN_HEAVY, '더 무거운', '더 가벼운', '더 무거워요', '두 손에 하나씩 들었다고 생각해 보세요.'),
      (r) => {
        const [down, up] = r.sample(GEN_KIDS, 2);
        const heavy = r.int(0, 1) === 1;
        return {
          type: 'visual', level: '중', visual: `⬇️ ${down}          ${up} ⬆️`,
          text: `시소에서 ${down} 쪽이 내려갔어요. 더 ${heavy ? '무거운' : '가벼운'} 친구는 누구인가요?`,
          ...genChoices(r, heavy ? down : up, [heavy ? up : down, '두 친구가 같아요']),
          hint: '시소는 무거운 쪽이 아래로 내려가요.',
          solution: `내려간 쪽이 더 무거워요. 더 ${heavy ? '무거운' : '가벼운'} 친구는 ${heavy ? down : up}이에요.`,
        };
      },
      (r) => {
        const three = r.pick(GEN_HEAVY3);
        const heavy = r.int(0, 1) === 1;
        const ok = heavy ? three[0] : three[2];
        return {
          type: 'step', level: '중', visual: r.shuffle(three).join('   '),
          text: `가장 ${heavy ? '무거운' : '가벼운'} 것은 무엇인가요?`,
          steps: ['① 둘씩 골라 어느 것이 더 무거운지 생각해요.', `② 가장 ${heavy ? '무거운' : '가벼운'} 것을 골라요.`],
          ...genChoices(r, ok, three.filter((t) => t !== ok)),
          hint: '들기 가장 힘든 것이 가장 무거워요.',
          solution: `무거운 것부터 ${three.join(', ')} 순서예요. 가장 ${heavy ? '무거운' : '가벼운'} 것은 ${ok}이에요.`,
        };
      },
      (r) => {
        const [a, b, c] = r.sample(GEN_KIDS, 3);
        const heavy = r.int(0, 1) === 1;
        return {
          type: 'think', level: '상', visual: `⬇️ ${a}   ${b} ⬆️\n⬇️ ${b}   ${c} ⬆️`,
          text: `${a}은(는) ${b}보다 무거워요. ${b}은(는) ${c}보다 무거워요. 가장 ${heavy ? '무거운' : '가벼운'} 친구는 누구인가요?`,
          ...genChoices(r, heavy ? a : c, [b, heavy ? c : a]),
          hint: '무거운 친구부터 차례로 줄을 세워 보세요.',
          solution: `무거운 순서는 ${a}, ${b}, ${c}이에요. 가장 ${heavy ? '무거운' : '가벼운'} 친구는 ${heavy ? a : c}이에요.`,
        };
      },
    ],
    // 4-3 담을 수 있는 양
    [
      genPairTemplate(GEN_MUCH, '담을 수 있는 양이 더 많은', '담을 수 있는 양이 더 적은', '더 많이 담을 수 있어요', '물을 가득 채운다고 생각해 보세요. 큰 그릇에 더 많이 들어가요.'),
      (r) => {
        const [x, y] = r.sample([1, 2, 3, 4, 5], 2);
        const more = r.int(0, 1) === 1;
        const ok = (x > y) === more ? '가' : '나';
        return {
          type: 'visual', level: '하', visual: `가 컵  ${water(x)}\n나 컵  ${water(y)}`,
          text: `똑같은 컵에 물을 담았어요. 물이 더 ${more ? '많은' : '적은'} 컵은 무엇인가요?`,
          ...genChoices(r, `${ok} 컵`, [`${ok === '가' ? '나' : '가'} 컵`, '둘이 같아요']),
          hint: '같은 컵이라면 물의 높이를 보면 돼요.',
          solution: `파란 칸이 많을수록 물이 많아요. 물이 더 ${more ? '많은' : '적은'} 컵은 ${ok} 컵이에요.`,
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
          steps: ['① 컵마다 파란 칸을 세어요.', `② 칸이 가장 ${more ? '많은' : '적은'} 컵을 골라요.`],
          ...genChoices(r, `${ok} 컵`, names.filter((n) => n !== ok).map((n) => `${n} 컵`)),
          hint: '물의 높이가 높을수록 물이 많아요.',
          solution: `파란 칸은 가 ${lv[0]}칸, 나 ${lv[1]}칸, 다 ${lv[2]}칸이에요. 가장 ${more ? '많은' : '적은'} 컵은 ${ok} 컵이에요.`,
        };
      },
      (r) => {
        const [big, small] = r.pick(GEN_MUCH);
        const n = r.int(3, 6);
        return {
          type: 'think', level: '상', visual: `${small} × ${n}번  →  ${big} 가득`,
          text: `${small.slice(small.indexOf(' ') + 1)}(으)로 물을 ${n}번 부었더니 ${big.slice(big.indexOf(' ') + 1)}이(가) 가득 찼어요. 담을 수 있는 양이 더 많은 것은 무엇인가요?`,
          ...genChoices(r, big, [small, '둘이 같아요']),
          hint: '여러 번 부어야 가득 차는 그릇이 더 커요.',
          solution: `${n}번이나 부어야 가득 찼어요. ${big}에 더 많이 담을 수 있어요.`,
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
          hint: `10개씩 묶음 1개와 낱개 ${k}개예요.`,
          solution: `10개씩 묶음 1개와 낱개 ${k}개 → ${n}개예요.`,
        };
      },
      (r) => {
        const a = r.int(1, 9);
        return {
          type: 'visual', level: '하', visual: `${'🔴'.repeat(a)}${'⚪'.repeat(10 - a)}`,
          text: `10은 ${a}${genJosa(a, '과', '와')} 어떤 수로 가를 수 있나요?`,
          ...genChoices(r, 10 - a, genNear(r, 10 - a, 1, 9)),
          hint: '하얀 구슬을 세어 보세요.',
          solution: `10은 ${a}${genJosa(a, '과', '와')} ${10 - a}${genJosa(10 - a, '으로', '로')} 가를 수 있어요.`,
        };
      },
      (r) => {
        const k = r.int(1, 9);
        const n = 10 + k;
        const read = (x) => `십${GEN_SINO[x - 10]}`;
        return {
          type: 'think', level: '중', visual: String(n),
          text: `수 ${n}${genJosa(n, '을', '를')} 바르게 읽은 것은 무엇인가요?`,
          ...genChoices(r, read(n), genNear(r, n, 11, 19).map(read)),
          hint: '10개씩 묶음 1개는 "십"이라고 읽어요.',
          solution: `${n}${genJosa(n, '은', '는')} "${read(n)}"${genJosa(k, '이', '')}라고 읽어요.`,
        };
      },
      (r) => {
        const a = r.int(6, 9);
        const b = r.int(11 - a, 9);
        const seq = Array.from({ length: b }, (_, i) => a + i + 1);
        return {
          type: 'step', level: '상', visual: `${'⚫'.repeat(a)}   ${'⚪'.repeat(b)}`,
          text: `${a}${genJosa(a, '과', '와')} ${b}${genJosa(b, '을', '를')} 모으면 얼마인가요?`,
          steps: [`① ${a}에서 시작해요.`, `② ${b}번 이어 세요 → ${seq.slice(0, 2).join(', ')}…`, '③ 마지막 수가 답이에요.'],
          ...genChoices(r, a + b, genNear(r, a + b, 10, 19)),
          hint: `${a} 하고 ${seq[0]}, ${seq[1] || ''}… 이어 세어 보세요.`,
          solution: `${a} 하고 ${seq.join(', ')}. 모으면 ${a + b}${genJosa(a + b, '이에요', '예요')}.`,
        };
      },
      (r) => {
        const n = r.int(11, 18);
        const a = r.int(Math.max(2, n - 9), 9);
        return {
          type: 'step', level: '상', visual: `    ${n}\n   ↙   ↘\n  ${a}     ❓`,
          text: `${n}${genJosa(n, '을', '를')} ${a}${genJosa(a, '과', '와')} 어떤 수로 가를 수 있나요?`,
          steps: [`① 바둑돌 ${n}개를 놓아요.`, `② ${a}개를 한쪽으로 옮겨요.`, '③ 남은 바둑돌을 세어요.'],
          ...genChoices(r, n - a, genNear(r, n - a, 1, 12).filter((x) => x !== a)),
          hint: `${a}에서 ${n}까지 이어 세면서 손가락을 접어 보세요.`,
          solution: `${n}${genJosa(n, '은', '는')} ${a}${genJosa(a, '과', '와')} ${n - a}${genJosa(n - a, '으로', '로')} 가를 수 있어요.`,
        };
      },
    ],
    // 5-2 10개씩 묶어 세기
    [
      (r) => {
        const t = r.int(2, 5);
        return {
          type: 'visual', level: '하', visual: Array(t).fill('🔟').join(' '),
          text: `10개씩 묶음이 ${t}개 있어요. 모두 몇 개인가요?`,
          ...genChoices(r, `${t * 10}개`, [t * 10 - 10, t * 10 + 10, t].map((x) => `${x}개`)),
          hint: '십, 이십, 삼십… 10씩 뛰어 세어 보세요.',
          solution: `10개씩 묶음 ${t}개는 ${t * 10}이에요.`,
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
          hint: '묶음의 수를 앞에, 낱개의 수를 뒤에 써요.',
          solution: `10개씩 묶음 ${t}개 → ${t * 10}, 낱개 ${k}개 → 모두 ${n}개예요.`,
        };
      },
      (r) => {
        const t = r.int(2, 4);
        const k = r.int(1, 9);
        const n = t * 10 + k;
        const askTens = r.int(0, 1) === 1 || t === k;
        return {
          type: 'step', level: '중', visual: String(n),
          text: `${n}에서 ${askTens ? '10개씩 묶음은 몇 개' : '낱개는 몇 개'}인가요?`,
          steps: [`① 앞의 수 ${t} → 10개씩 묶음`, `② 뒤의 수 ${k} → 낱개`],
          ...genChoices(r, `${askTens ? t : k}개`, [askTens ? k : t, n, (askTens ? t : k) + 1].filter((x) => x !== (askTens ? t : k)).map((x) => `${x}개`)),
          hint: '두 자리 수에서 앞의 수는 묶음, 뒤의 수는 낱개예요.',
          solution: `${n}${genJosa(n, '은', '는')} 10개씩 묶음 ${t}개와 낱개 ${k}개예요.`,
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
          hint: '십, 이십, 삼십, 사십, 오십 순서예요.',
          solution: `${t * 10}은 "${words[t]}" 또는 "${native[t]}"이라고 읽어요.`,
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
          hint: `10개씩 ${t}${thing[1]}은(는) ${t * 10}개예요.`,
          solution: `${t * 10}개와 ${k}개 → 모두 ${n}개예요.`,
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
          hint: '수가 1씩 커지고 있어요.',
          solution: `${seq.join(', ')} 순서예요. ❓는 ${seq[hole]}${genJosa(seq[hole], '이에요', '예요')}.`,
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
          hint: up ? `${n} 바로 다음 수예요.` : `${n} 바로 앞의 수예요.`,
          solution: `${n}보다 1만큼 더 ${up ? '큰' : '작은'} 수는 ${ans}${genJosa(ans, '이에요', '예요')}.`,
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
          hint: sameTens ? '10개씩 묶음의 수가 같으면 낱개의 수를 비교해요.' : '10개씩 묶음의 수부터 비교해요.',
          solution: `${Math.max(a, b)}${genJosa(Math.max(a, b), '은', '는')} ${Math.min(a, b)}보다 커요. 더 ${big ? '큰' : '작은'} 수는 ${ans}${genJosa(ans, '이에요', '예요')}.`,
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
          steps: ['① 10개씩 묶음의 수를 먼저 비교해요.', '② 묶음의 수가 같으면 낱개의 수를 비교해요.', `③ 가장 ${big ? '큰' : '작은'} 수를 골라요.`],
          ...genChoices(r, ans, three.filter((x) => x !== ans)),
          hint: '앞의 수(10개씩 묶음)가 클수록 큰 수예요.',
          solution: `작은 수부터 놓으면 ${sorted.join(', ')}. 가장 ${big ? '큰' : '작은'} 수는 ${ans}${genJosa(ans, '이에요', '예요')}.`,
        };
      },
      (r) => {
        const n = r.int(12, 48);
        return {
          type: 'think', level: '중', visual: `${n - 1}   ❓   ${n + 1}`,
          text: `${n - 1}${genJosa(n - 1, '과', '와')} ${n + 1} 사이에 있는 수는 무엇인가요?`,
          ...genChoices(r, n, [n - 1, n + 1]),
          hint: `${n - 1} 바로 다음 수예요.`,
          solution: `${n - 1}, ${n}, ${n + 1} 순서예요. 사이에 있는 수는 ${n}${genJosa(n, '이에요', '예요')}.`,
        };
      },
    ],
  ],
};

/* ============================== 만들기 ============================== */
const GEN_CACHE = {};

/** 한글 조사 "은(는)" 같은 표기를 앞 글자의 받침에 맞게 골라요. */
function genFixJosa(s) {
  const pairs = { '은(는)': ['은', '는'], '이(가)': ['이', '가'], '을(를)': ['을', '를'], '와(과)': ['과', '와'], '(으)로': ['으로', '로'], '이에요': ['이에요', '예요'] };
  return String(s).replace(/([가-힣])(\s?)(은\(는\)|이\(가\)|을\(를\)|와\(과\)|\(으\)로|이에요)/g, (m, ch, sp, j) => {
    const code = (ch.charCodeAt(0) - 0xac00) % 28;
    const [withFinal, without] = pairs[j];
    // "(으)로"는 ㄹ 받침 뒤에서도 "로"예요.
    const final = j === '(으)로' ? code !== 0 && code !== 8 : code !== 0;
    return ch + (final ? withFinal : without);
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
