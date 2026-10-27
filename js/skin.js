/* =========================================================================
 * skin.js — 기존 화면 부품에 피그마 픽셀 틀을 입혀요
 *
 *  - 무대(stage.js)로 새로 그린 화면 말고도, 퀴즈 · 설정 · 채팅 · 결과 · 로그인 · 지도자 화면의
 *    버튼 · 카드 · 입력칸이 피그마와 같은 모양(pxkit.js)이 되도록 render 뒤에 클래스를 붙여요.
 *  - 규칙은 아래 표(SKIN_RULES) 하나에서 관리해요. 앞 규칙이 먼저 적용되고, 이미 px가 있으면 건너뛰어요.
 *  - 눌린 상태(고른 것 · 켜진 것)는 피그마 Pressed처럼 그림자 없이 내려앉아요(px-tiled).
 * ========================================================================= */

const SKIN_RULES = [
  // [선택자, 모양, 색, 켜졌을 때 색]
  ['.btn-primary, .btn-gold', 'tile', 'primary'],
  ['.btn-water', 'tile', 'track'],
  ['.btn-subject-math', 'tile', 'purple'],
  ['.btn-subject-korean', 'tile', 'accent'],
  ['.btn:not(.btn-ghost)', 'tile', 'surface'],
  ['.round-btn, .icon-btn', 'round', 'surface'],
  ['.question-card, .sheet, .set-block, .concept-card, .rest-card, .friend-panel, .listen-big, .chat-topic, .report-card, .stat-card, .leader-card, .card, .result-card, .brand', 'panel', 'surface'],
  ['.feedback', 'panel', 'surface'],
  ['.hint-box.why', 'tile', 'blue'],
  ['.hint-box', 'tile', 'yellow'],
  ['.np-display', 'panel', 'surface'],
  ['.pc-cands, .np-tried', 'plate', 'surface'],
  ['.np-key, .pc-tool, .pc-cand, .friend-step:not(.static), .gtab, .sub-btn, .set-row, .friend-row, .game-card:not(.px), .leader-row', 'tile', 'surface', 'primary'],
  ['.friend-step.static', 'plate', 'surface'],
  ['.seg button, .avatar, .mode-card, .rep-toggle button, .role-tab, .range-tabs button, .chat-quick button', 'tile', 'surface', 'primary'],
  ['.pill', 'badge', 'surface'],
  ['.badge', 'badge', 'surface'],
  ['input[type=text]:not(.chat-type), input[type=password], input[type=date], input:not([type]), textarea, select', 'chip', 'surface'],
  ['.schedule .sch.now', 'tile', 'primary'],
  ['.chat-msg .chat-msg-body', 'plate', 'surface'],
  ['.chat-msg.mine .chat-msg-body', 'plate', 'mine'],
];

/** 켜진 상태인지 (고른 보기 · 켜진 설정 · 고른 도구) */
function skinIsOn(el) {
  return el.classList.contains('on') || el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-checked') === 'true';
}

function applySkin(root) {
  const scope = root || document.getElementById('app');
  SKIN_RULES.forEach(([sel, shape, color, onColor]) => {
    scope.querySelectorAll(sel).forEach((el) => {
      if (el.dataset.skin) return;
      el.dataset.skin = '1';
      if (el.classList.contains('px')) return;
      const on = onColor && skinIsOn(el);
      el.classList.add('px', `px-${on ? 'tiled' : shape}`, `px-${on ? onColor : color}`);
    });
  });
}
