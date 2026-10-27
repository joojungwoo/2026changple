/* =========================================================================
 * tools/check-problems.js — 문제 전수 검사 (node tools/check-problems.js)
 *
 *  모든 문제를 문제 데이터(problem.js)로 바꾼 뒤
 *   - 쓸 수 있는 표현 방식마다 화면 조각이 오류 없이 만들어지는지
 *   - 입력 방식(터치 선택 · 숫자패드 · 손글씨)마다 정답은 맞다고, 오답은 틀리다고 판정하는지
 *   - 식으로 읽어 낸 문제(math)의 계산이 정답과 같은지
 *  를 확인해요. 브라우저 없이 node만 있으면 돼요.
 * ========================================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { window: {}, console, document: { getElementById: () => ({ addEventListener() {} }) } };
ctx.window = ctx;
vm.createContext(ctx);
const files = [
  'js/gen.js', 'js/bank/m1.js', 'js/bank/k1.js', 'js/bank/k1b.js', 'js/bank/max-m1.js', 'js/bank/m2.js',
  'js/bank/k2.js', 'js/bank/m3.js', 'js/bank/k3.js', 'js/subunits.js', 'js/curriculum.js', 'js/problem.js',
  'js/friend.js', 'js/recognize.js',
];
// app.js에 있는 글자 다듬기 도우미
vm.runInContext(`
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl = (s) => esc(s).replace(/\\n/g, '<br>');
  const pxIcon = () => '';
  const sproutLogo = () => '<svg></svg>';
`, ctx);
const src = files.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
vm.runInContext(src + `
;globalThis.__api = { CHAPTERS, Problem, REPS, repsFor, INPUTS, pickInput, judge, problemNumber, problemCalc, whyWrong, genSet, hasGenerator,
  Friend, ERROR_TYPES, stepGivesAnswer, RECOG_TEMPLATES, recognizeDigit, recognizeNumber };
`, ctx);
const api = ctx.__api;

const all = [];
api.CHAPTERS.forEach((c) => {
  c.subunits.forEach((s) => {
    all.push(...s.questions);
    if (api.hasGenerator(c.id, s.idx)) all.push(...api.genSet(c.id, s.idx, 30, 1));
  });
  (c.maxSet || []).forEach((q) => all.push(q));
});

const fail = [];
const count = { problems: 0, renders: 0, judged: 0, numberAnswer: 0, math: 0, reps: {}, inputs: {} };
for (const q of all) {
  count.problems++;
  let p;
  try {
    p = api.Problem.from(q);
  } catch (e) {
    fail.push([q.id, 'from', e.message]);
    continue;
  }
  // 표현 방식
  for (const id of api.repsFor(p)) {
    for (const checked of [false, true]) {
      try {
        const html = api.REPS[id].render(p, { checked });
        if (typeof html !== 'string' || !html.length) throw new Error('빈 화면');
        // 답을 확인하기 전에는 정답이 적힌 단계를 보여 주지 않아요.
        if (!checked && q.steps) q.steps.filter((st) => api.stepGivesAnswer(p, st)).forEach((st) => html.includes(st.replace(/&/g, '&amp;')) && fail.push([q.id, `rep ${id} 정답 단계 보임`, st]));
        count.renders++;
        if (!checked) count.reps[id] = (count.reps[id] || 0) + 1;
      } catch (e) {
        fail.push([q.id, `rep ${id}`, e.message]);
      }
    }
  }
  // 틀리는 친구: 새싹이 답은 정답과 달라야 하고, 실수 종류와 틀린 단계가 있어야 해요.
  const at = api.Friend.attempt(p);
  if (at) {
    count.friend = (count.friend || 0) + 1;
    if (at.answer === p.answer.value || !api.ERROR_TYPES[at.errorType] || !at.steps[at.wrongStep]) fail.push([q.id, 'friend', JSON.stringify(at)]);
  }
  // 입력 방식: 정답은 맞고, 오답은 틀려야 해요.
  for (const want of ['choice', 'numpad', 'pencil']) {
    const input = api.pickInput(p, want);
    count.inputs[`${want}→${input}`] = (count.inputs[`${want}→${input}`] || 0) + 1;
    if (input === 'choice') {
      q.choices.forEach((_, i) => {
        if (api.judge(p, { kind: 'choice', index: i }) !== (i === q.answer)) fail.push([q.id, 'judge choice', i]);
        count.judged++;
      });
    } else {
      const v = p.answer.value;
      if (!api.judge(p, { kind: 'number', value: v })) fail.push([q.id, `judge ${input} 정답`, v]);
      if (api.judge(p, { kind: 'number', value: v + 1 })) fail.push([q.id, `judge ${input} 오답`, v + 1]);
      count.judged += 2;
    }
  }
  if (p.answer.kind === 'number') {
    count.numberAnswer++;
    // 숫자로 판정하는 정답과 보기의 정답이 같아야 해요.
    if (api.problemNumber(q.choices[q.answer]).value !== p.answer.value) fail.push([q.id, 'number answer', q.choices[q.answer]]);
    // 같은 수의 보기가 두 개면 숫자로 답할 때 헷갈려요.
    const vals = q.choices.map((c) => api.problemNumber(c).value);
    if (new Set(vals).size !== vals.length) fail.push([q.id, '같은 수 보기', vals.join(',')]);
  }
  if (p.math) {
    count.math++;
    if (api.problemCalc(p.math.a, p.math.op, p.math.b) !== p.answer.value) fail.push([q.id, 'math', JSON.stringify(p.math)]);
  }
  // 틀린 이유 도움말은 오답마다 글이 있어야 해요.
  q.choices.forEach((_, i) => {
    if (i === q.answer) return;
    const why = api.whyWrong(p, { kind: 'choice', index: i });
    if (!why || typeof why !== 'string') fail.push([q.id, 'whyWrong', i]);
  });
}

// 손글씨: 숫자 본을 조금씩 비틀어 써도 읽는지 (실제 아이 글씨보다 쉬운 검사예요)
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647), seed / 2147483647);
const warp = (strokes) => {
  const ang = (rnd() - 0.5) * 0.35, sx = 0.75 + rnd() * 0.5, sy = 0.75 + rnd() * 0.5, sh = (rnd() - 0.5) * 0.3;
  return strokes.map((st) => st.map(([x, y]) => {
    x = (x - 50) * sx + (y - 50) * sh; y = (y - 50) * sy;
    return [x * Math.cos(ang) - y * Math.sin(ang) + 50 + (rnd() - 0.5) * 5, x * Math.sin(ang) + y * Math.cos(ang) + 50 + (rnd() - 0.5) * 5];
  }));
};
let read = 0, tries = 0, sureWrong = 0;
for (let k = 0; k < 20; k++) api.RECOG_TEMPLATES.forEach(([d, st]) => {
  const r = api.recognizeNumber([warp(st)]);
  tries++;
  if (r.text === d) read++;
  else if (r.sure) sureWrong++;
});
count.handwriting = { tries, read, sureWrong };
if (read / tries < 0.95) fail.push(['손글씨', '읽기', `${read}/${tries}`]);
if (sureWrong) fail.push(['손글씨', '확신했는데 틀림', sureWrong]);

console.log(JSON.stringify(count, null, 2));
if (fail.length) {
  console.error(`실패 ${fail.length}개`);
  fail.slice(0, 30).forEach((f) => console.error(' ', f.join(' | ')));
  process.exit(1);
}
console.log('모두 통과');
