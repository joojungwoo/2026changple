/* =========================================================================
 * intro.js — 소개(랜딩) 화면
 *
 *  - 로그인하지 않은 사람이 처음 보는 화면이에요. (시작 화면 → 소개 → 로그인)
 *  - 히어로: 새싹 로고가 숨쉬고 눈을 깜빡여요. 제목 · 버튼이 차례로 나타나요.
 *  - 아래로 내리면 섹션이 하나씩 자연스럽게 나타나요. (IntersectionObserver, 보일 때만)
 *  - 움직임은 모두 설정의 '움직이는 효과'와 기기의 '동작 줄이기'를 따라요.
 * ========================================================================= */

const INTRO_SECTIONS = [
  { icon: '🏫', title: '친구를 사귀며 배워요', text: '단원마다 새 친구를 만나요. 친구와 이야기하며 학교에서 배운 걸 다시 풀어요.' },
  { icon: '💬', title: '친구에게 어떻게 말할까?', text: '인사하기 · 거절하기 · 공감하기 · 함께하기를 선택지로 연습해요. 무엇을 골라도 괜찮아요.' },
  { icon: '🧱', title: '나에게 맞는 모습으로', text: '숫자 · 블록 · 그림으로 바꿔 보고, 힌트도 한 단계씩 받아요.' },
  { icon: '❗', title: '친구가 다시 놀자고 해요', text: '복습할 때가 되면 친구 머리 위에 느낌표가 떠요. 다시 만나서 같이 풀어요.' },
  { icon: '☕', title: '잠깐 쉬는 시간!', text: '언제든 쉬었다가, 하던 곳부터 이어서 해요.' },
  { icon: '📊', title: '보호자 · 선생님은 리포트로', text: '혼자 힘으로 푼 문제, 힌트, 개념별 숙달도를 한눈에 보고 학습 수준을 조정해요.' },
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
        <button class="btn btn-primary btn-lg btn-block" data-go="signup">친구 만나러 가기</button>
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
