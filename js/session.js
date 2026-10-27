/* =========================================================================
 * session.js — '오늘 할 일' 그림 띠 (시각 스케줄)
 *
 *  - 공부 화면 맨 위에 고정해서 지금 무엇을 하는지, 다음에 무엇이 오는지 그림으로 보여 줘요.
 *    지금 단계는 크게 + 굵은 테두리, 끝난 단계는 ✔, 남은 단계는 흐리게.
 *  - 단계 구성은 아래 데이터(SESSION_STEPS · SESSION_PLANS)로만 정해요. 화면 코드에는 단계가 없어요.
 *  - 단시간 집중 모드는 단계가 줄어든 계획을 써요.
 * ========================================================================= */

/** 단계 하나: 그림 · 이름 */
const SESSION_STEPS = {
  concept: { icon: '📖', label: '개념 보기' },
  solve: { icon: '🧩', label: '문제 풀기' },
  friend: { icon: '🤝', label: '친구 돕기' },
  rest: { icon: '🌿', label: '쉬기' },
  done: { icon: '⭐', label: '끝' },
};

/**
 * 공부 종류마다 단계 계획
 *  - optional: 조건이 맞을 때만 들어가요. (개념을 보고 왔을 때 · 틀리는 친구 문제가 있을 때)
 */
const SESSION_PLANS = {
  sub: { steps: ['concept', 'solve', 'friend', 'done'], focus: ['solve', 'rest', 'done'] },
  pass: { steps: ['solve', 'friend', 'done'], focus: ['solve', 'rest', 'done'] },
  review: { steps: ['solve', 'friend', 'done'], focus: ['solve', 'rest', 'done'] },
  max: { steps: ['solve', 'done'], focus: ['solve', 'rest', 'done'] },
};

/** 이번 공부의 단계 목록 */
function sessionPlan(mode, o) {
  const plan = SESSION_PLANS[mode] || SESSION_PLANS.sub;
  return (o.focus ? plan.focus : plan.steps).filter((id) => {
    if (id === 'concept') return !!o.concept;
    if (id === 'friend') return !!o.friend;
    return true;
  });
}

/** 지금 화면이 어느 단계인지 */
function sessionNow() {
  const q = State.quiz;
  if (State.screen === 'lesson') return 'concept';
  if (State.screen === 'quiz') return q && q.questions[q.index] && q.questions[q.index].friend ? 'friend' : 'solve';
  if (State.screen === 'rest') return 'rest';
  if (State.screen === 'result') return 'done';
  return null;
}

/** 그림 띠 */
function scheduleStrip(plan) {
  const now = sessionNow();
  const at = plan.indexOf(now);
  if (at < 0) return '';
  return `<ol class="schedule" aria-label="오늘 할 일: ${plan.map((id) => SESSION_STEPS[id].label).join(', ')}">
    ${plan
      .map((id, i) => {
        const s = SESSION_STEPS[id];
        const state = i < at ? 'done' : i === at ? 'now' : 'todo';
        const sr = state === 'done' ? '끝났어요' : state === 'now' ? '지금 하는 중' : '이따가 해요';
        return `<li class="sch ${state}" aria-current="${state === 'now' ? 'step' : 'false'}">
            <span class="sch-ico" aria-hidden="true">${s.icon}</span>
            <span class="sch-label">${s.label}</span>
            ${state === 'done' ? '<span class="sch-check" aria-hidden="true">✔</span>' : ''}
            <span class="sr-only">${sr}</span>
          </li>${i < plan.length - 1 ? '<li class="sch-arrow" aria-hidden="true">→</li>' : ''}`;
      })
      .join('')}
  </ol>`;
}
