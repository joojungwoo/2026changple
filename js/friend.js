/* =========================================================================
 * friend.js — '틀리는 친구' 새싹이
 *
 *  - 새싹이는 선생님이 아니라 같이 공부하는 친구예요. 먼저 문제를 풀다가 일부러 틀리고, 아이가 고쳐 줘요.
 *  - 문제 데이터에 characterAttempt(새싹이의 틀린 풀이)와 errorType(실수 종류)을 붙여요.
 *    문제에 직접 적어 두면 그것을 쓰고, 없으면 덧셈 · 뺄셈 식에서 자동으로 만들어요.
 *  - 흐름: 새싹이 풀이 보기 → "어? 맞았나?" → 아이가 틀린 곳을 눌러요 → 바른 답을 써요
 *          → "고마워! 이제 알겠다!"
 *  - 그림은 friendAvatar() 하나만 바꾸면 돼요. (지금은 앱의 오리지널 새싹 도트 그림)
 * ========================================================================= */

/** 실수 종류: 이름 · 아이에게 보여 줄 도움말 */
const ERROR_TYPES = {
  'no-carry': { name: '받아올림 빠뜨림', tip: '일의 자리끼리 더해서 10이 넘으면, 십의 자리로 1을 올려 줘야 해요.' },
  'no-borrow': { name: '받아내림 빠뜨림', tip: '일의 자리에서 뺄 수 없으면, 십의 자리에서 10을 빌려 와야 해요.' },
  'count-extra': { name: '하나 더 셈', tip: '이어 셀 때는 처음 수 다음부터 세어요. 처음 수를 또 세면 하나가 많아져요.' },
  'op-swap': { name: '더하기 · 빼기 바꿈', tip: '문제를 다시 읽어 봐요. 더하는 문제인지 빼는 문제인지 살펴봐요.' },
};

const Friend = {
  /** 새싹이의 틀린 풀이 { answer, steps[], wrongStep, errorType } 또는 null */
  attempt(p) {
    if (p.q.characterAttempt && p.q.errorType) return { ...p.q.characterAttempt, errorType: p.q.errorType };
    const m = p.math;
    if (!m || !['+', '-'].includes(m.op) || m.a > 999 || m.b > 999) return null;
    const { a, b } = m;
    const ao = a % 10;
    const bo = b % 10;
    const right = p.answer.value;
    const sign = m.op === '+' ? '+' : '−';
    let out = null;
    if (m.op === '+' && a >= 10 && ao + bo >= 10) {
      const wrong = right - 10;
      out = {
        errorType: 'no-carry',
        answer: wrong,
        steps: [`일의 자리: ${ao} + ${bo} = ${ao + bo} → ${(ao + bo) % 10}${genJosa((ao + bo) % 10, '을', '를')} 써요.`, `십의 자리: ${Math.floor(a / 10)} + ${Math.floor(b / 10)} = ${Math.floor(a / 10) + Math.floor(b / 10)}`, `답: ${wrong}`],
        wrongStep: 1,
      };
    } else if (m.op === '-' && a >= 10 && ao < bo) {
      const ones = bo - ao;
      const tens = Math.floor(a / 10) - Math.floor(b / 10);
      const wrong = tens * 10 + ones;
      out = {
        errorType: 'no-borrow',
        answer: wrong,
        steps: [`일의 자리: ${ao}에서 ${bo}${genJosa(bo, '을', '를')} 못 빼니까 ${bo} − ${ao} = ${ones}`, `십의 자리: ${Math.floor(a / 10)} − ${Math.floor(b / 10)} = ${tens}`, `답: ${wrong}`],
        wrongStep: 0,
      };
    } else if (m.op === '+' && a < 10 && b < 10 && b > 0) {
      const counted = Array.from({ length: b + 1 }, (_, i) => a + i);
      out = {
        errorType: 'count-extra',
        answer: right + 1,
        steps: [`${a}부터 이어 세요: ${counted.join(', ')}`, `답: ${right + 1}`],
        wrongStep: 0,
      };
    } else {
      const wrong = m.op === '+' ? Math.abs(a - b) : a + b;
      out = { errorType: 'op-swap', answer: wrong, steps: [`${a} ${m.op === '+' ? '−' : '+'} ${b}${genJosa(b, '을', '를')} 했어요.`, `답: ${wrong}`], wrongStep: 0 };
    }
    // 새싹이 답이 정답과 같거나 보기에 없는 이상한 수면 쓰지 않아요.
    if (!out || out.answer === right || out.answer < 0) return null;
    out.sign = sign;
    return out;
  },

  /** 공부 목록에서 친구 돕기 문제 하나를 골라 끝에 붙여요. (한 번 맞힌 문제를 골라 친구에게 알려 주기 좋게) */
  pick(list) {
    const cand = list.filter((q) => this.attempt(Problem.from(q)));
    if (!cand.length) return null;
    const q = cand[Math.floor(Math.random() * cand.length)];
    return { ...q, friend: true };
  },
};

/** 새싹이 그림 (바꾸기 쉽게 한 곳에만) */
function friendAvatar(mood) {
  return `<span class="friend-avatar ${mood || ''}" aria-hidden="true">${sproutBuddy()}</span>`;
}

/** 친구 돕기: 새싹이의 풀이를 보고 틀린 곳을 찾아요. */
function friendLookHtml(parts) {
  const { q, p } = parts;
  const at = Friend.attempt(p);
  const say =
    q.friendSay ||
    '내가 먼저 풀어 봤어! 어? 맞았나? 🤔<br><b>틀린 곳이 있으면 눌러 줘.</b>';
  return `<section class="friend-panel">
    <div class="friend-talk">${friendAvatar('think')}<p class="friend-bubble" data-read>${say}</p></div>
    <ol class="friend-steps">
      ${at.steps.map((s, i) => `<li><button type="button" class="friend-step" data-friend-step="${i}">${esc(s)}</button></li>`).join('')}
    </ol>
    <button type="button" class="btn btn-block" data-friend-ok>다 맞은 것 같아</button>
  </section>`;
}

/** 틀린 곳을 찾은 뒤: 새싹이 풀이에 표시하고, 바른 답을 쓰게 해요. */
function friendFixHtml(parts) {
  const { p } = parts;
  const at = Friend.attempt(p);
  return `<section class="friend-panel fixed">
    <div class="friend-talk">${friendAvatar('think')}<p class="friend-bubble" data-read>맞아, 여기가 이상해! 바른 답을 알려 줄래?</p></div>
    <ol class="friend-steps">
      ${at.steps.map((s, i) => `<li><span class="friend-step static ${i === at.wrongStep ? 'found' : ''}">${i === at.wrongStep ? '🔍 ' : ''}${esc(s)}</span></li>`).join('')}
    </ol>
    <div class="hint-box"><span class="hint-icon" aria-hidden="true">💡</span><p data-read>${esc(ERROR_TYPES[at.errorType].tip)}</p></div>
  </section>`;
}

(function bindFriend() {
  document.getElementById('app').addEventListener('click', (ev) => {
    const q = State.quiz;
    if (!q || State.screen !== 'quiz') return;
    const step = ev.target.closest('[data-friend-step]');
    if (step) {
      const at = Friend.attempt(Problem.from(q.questions[q.index]));
      if (Number(step.dataset.friendStep) === at.wrongStep) q.friendStage = 'fix';
      else q.friendSay = '거기는 맞게 한 것 같아. 다른 곳도 볼래? 👀';
      return render();
    }
    if (ev.target.closest('[data-friend-ok]')) {
      // 두 번째에는 새싹이가 스스로 틀린 곳을 알려 줘요. (막혀서 멈추지 않게)
      q.friendOk = (q.friendOk || 0) + 1;
      if (q.friendOk >= 2) q.friendStage = 'fix';
      else q.friendSay = '음… 정말? 답을 직접 계산해서 맞춰 볼래? 🤔<br><b>이상한 곳을 눌러 줘.</b>';
      return render();
    }
  });
})();
