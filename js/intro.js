/* =========================================================================
 * intro.js — 소개(랜딩) 화면
 *
 *  - 로그인하지 않은 사람이 처음 보는 화면이에요. (시작 화면 → 소개 → 로그인)
 *  - 히어로: 새싹이가 숨쉬고 눈을 깜빡여요. 제목 · 버튼이 차례로 나타나요.
 *  - 아래로 내리면 섹션이 하나씩 자연스럽게 나타나요. (IntersectionObserver, 보일 때만)
 *  - 움직임은 모두 설정의 '움직이는 효과'와 기기의 '동작 줄이기'를 따라요.
 * ========================================================================= */

const INTRO_SECTIONS = [
  { icon: '🧱', title: '같은 문제, 나에게 맞는 모습으로', text: '숫자 · 그림 · 블록 · 듣기 중에서 나에게 쉬운 모습으로 문제를 봐요.' },
  { icon: '🤔', title: '틀려도 괜찮아요', text: '빨간 X 대신 왜 틀렸는지 알려 주고, 한 번 더 해 볼 수 있어요.' },
  { icon: '🤝', title: '새싹이와 같이 공부해요', text: '새싹이가 일부러 틀리면, 내가 선생님이 되어 고쳐 줘요.' },
  { icon: '✏️', title: '손으로 써도 돼요', text: '펜슬이나 손가락으로 답을 써요. 잘 안 읽히면 "이 숫자 맞아?" 하고 물어봐요.' },
  { icon: '🌱', title: '천천히, 내 속도로', text: '시계도 순위도 없어요. 쉬고 싶으면 쉬었다 해요.' },
  { icon: '📊', title: '보호자는 성장 리포트로', text: '혼자 힘으로 푼 문제가 얼마나 늘었는지 한눈에 봐요.' },
];

function screenIntro() {
  return `
    <div class="intro">
      <section class="intro-hero">
        <div class="intro-buddy">${sproutBuddyAlive()}</div>
        <h1 class="intro-title">한걸음</h1>
        <p class="intro-sub">천천히, 한 걸음씩 배워요</p>
        <div class="intro-cta">
          <button class="btn btn-primary btn-lg btn-block" data-go="signup">처음이에요 · 시작하기</button>
          <button class="btn btn-lg btn-block" data-go="login">이미 가입했어요 · 로그인</button>
        </div>
        <p class="intro-scroll" aria-hidden="true">▼ 아래로 내려 보세요</p>
      </section>
      ${INTRO_SECTIONS.map(
        (s, i) => `<section class="intro-sec reveal ${i % 2 ? 'alt' : ''}">
          <span class="intro-ico" aria-hidden="true">${s.icon}</span>
          <div><h2>${s.title}</h2><p>${s.text}</p></div>
        </section>`
      ).join('')}
      <section class="intro-end reveal">
        <div class="intro-buddy small">${sproutBuddyAlive()}</div>
        <button class="btn btn-primary btn-lg btn-block" data-go="signup">새싹이랑 시작하기</button>
      </section>
    </div>`;
}

/** 아래로 내리면 섹션이 나타나요. 움직임을 끄면 처음부터 다 보여요. */
let introObserver = null;
function introAfterRender() {
  if (introObserver) introObserver.disconnect();
  introObserver = null;
  if (State.screen !== 'intro') return;
  const els = document.querySelectorAll('.intro .reveal');
  if (!('IntersectionObserver' in window) || !motionAllowed()) return els.forEach((el) => el.classList.add('in'));
  introObserver = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        introObserver.unobserve(e.target);
      }),
    { threshold: 0.2 }
  );
  els.forEach((el) => introObserver.observe(el));
}

/** 장식 움직임을 써도 되는지: 설정에서 끄지 않았고, 기기에서 '동작 줄이기'를 켜지 않았을 때 */
function motionAllowed() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return document.body.dataset.anim !== 'off';
}
