/* =========================================================================
 * tools/check-style.js — 문제 글 규칙 검사 (node tools/check-style.js [단원 id 일부])
 *
 *  1. 단계 풀이: 마지막 단계가 아닌데 정답이 들어 있는 단계 (화면에서 "직접 해 봐"로 가려져요)
 *  2. 단계 풀이: 마지막 단계에 정답이 들어 있는 단계 (답을 말하지 말고 "그럼 어떤 모양일까?"처럼 물어요)
 *  3. 힌트에 정답이 들어 있음
 *  4. 힌트 · 풀이 · 단계 · 개념 카드가 존댓말 (모두 친구 말투 = 반말)
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
];
vm.runInContext(`
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl = (s) => esc(s).replace(/\\n/g, '<br>');
  const pxIcon = () => '';
  const sproutLogo = () => '<svg></svg>';
`, ctx);
const src = files.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
vm.runInContext(src + `;globalThis.__api = { CHAPTERS, Problem, stepGivesAnswer, genSet, hasGenerator };`, ctx);
const api = ctx.__api;
const only = process.argv[2] || '';

// 존댓말 끝: ~요 · ~니다 (문장 끝 또는 줄 끝)
const POLITE = /(요|니다)(?=[.!?~…)」"'”’]*(\s|$))/m;

const out = { stepMid: [], stepLast: [], hint: [], polite: [], card: [] };
const seen = new Set();
api.CHAPTERS.forEach((c) => {
  if (only && !c.id.includes(only)) return;
  (c.concept.cards || []).forEach((card, i) => {
    if (POLITE.test(card.text)) out.card.push(`${c.id} 카드${i + 1} "${card.title}": ${card.text.replace(/\n/g, ' / ')}`);
  });
  const qs = [];
  c.subunits.forEach((s) => {
    qs.push(...s.questions);
    if (api.hasGenerator(c.id, s.idx)) qs.push(...api.genSet(c.id, s.idx, 12, 1));
  });
  qs.forEach((q) => {
    const key = q.id.includes('~') ? q.id.split('~').slice(0, 3).join('~') : q.id;
    let p;
    try {
      p = api.Problem.from(q);
    } catch (e) {
      return;
    }
    if (q.steps) {
      q.steps.forEach((st, i) => {
        if (!api.stepGivesAnswer(p, st)) return;
        if (i < q.steps.length - 1) out.stepMid.push(`${q.id} 단계${i + 1}: ${st}   (정답: ${q.choices[q.answer]})`);
        else out.stepLast.push(`${q.id} 마지막 단계: ${st}   (정답: ${q.choices[q.answer]})`);
      });
    }
    if (q.hint && api.stepGivesAnswer(p, q.hint)) out.hint.push(`${q.id} 힌트: ${q.hint.replace(/\n/g, ' / ')}   (정답: ${q.choices[q.answer]})`);
    if (seen.has(key)) return; // 틀로 만든 문제는 틀마다 한 번만 말투를 봐요
    seen.add(key);
    [['힌트', q.hint], ['풀이', q.solution], ...(q.steps || []).map((s, i) => [`단계${i + 1}`, s])].forEach(([k, t]) => {
      if (t && POLITE.test(t)) out.polite.push(`${q.id} ${k}: ${t.replace(/\n/g, ' / ')}`);
    });
  });
});

const show = (title, list) => {
  console.log(`\n## ${title}: ${list.length}개`);
  list.slice(0, 500).forEach((x) => console.log('  ' + x));
};
show('마지막이 아닌 단계에 정답 (가려져요)', out.stepMid);
show('마지막 단계에 정답 (답을 말하지 말고 묻기)', out.stepLast);
show('힌트에 정답', out.hint);
show('존댓말 (힌트 · 풀이 · 단계)', out.polite);
show('존댓말 (개념 카드)', out.card);
const total = Object.values(out).reduce((a, l) => a + l.length, 0);
console.log(total ? `\n남은 것 ${total}개` : '\n모두 통과');
