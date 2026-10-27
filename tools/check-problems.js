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
const ctx = { window: {}, console, document: { getElementById: () => null } };
ctx.window = ctx;
vm.createContext(ctx);
const files = [
  'js/gen.js', 'js/bank/m1.js', 'js/bank/k1.js', 'js/bank/k1b.js', 'js/bank/max-m1.js', 'js/bank/m2.js',
  'js/bank/k2.js', 'js/bank/m3.js', 'js/bank/k3.js', 'js/subunits.js', 'js/curriculum.js', 'js/problem.js',
];
// app.js에 있는 글자 다듬기 도우미
vm.runInContext(`
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl = (s) => esc(s).replace(/\\n/g, '<br>');
  const pxIcon = () => '';
`, ctx);
const src = files.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
vm.runInContext(src + `
;globalThis.__api = { CHAPTERS, Problem, REPS, repsFor, INPUTS, pickInput, judge, problemNumber, problemCalc, whyWrong, genSet, hasGenerator };
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
    try {
      const html = api.REPS[id].render(p);
      if (typeof html !== 'string' || !html.length) throw new Error('빈 화면');
      count.renders++;
      count.reps[id] = (count.reps[id] || 0) + 1;
    } catch (e) {
      fail.push([q.id, `rep ${id}`, e.message]);
    }
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

console.log(JSON.stringify(count, null, 2));
if (fail.length) {
  console.error(`실패 ${fail.length}개`);
  fail.slice(0, 30).forEach((f) => console.error(' ', f.join(' | ')));
  process.exit(1);
}
console.log('모두 통과');
