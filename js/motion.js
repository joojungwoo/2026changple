/* =========================================================================
 * motion.js — 몸 움직이기 쉬는 시간
 *
 *  - 화면 터치가 5분 동안 없으면 새싹 친구가 크게 나타나
 *    "운동할 시간이에요!" 하고 불러요.
 *  - 새싹 친구를 한 번 누르면 운동 카드(예: 팔 벌려 뛰기 5회)가 나오고,
 *    새싹 친구가 "지켜보고 있다!" 하고 지켜봐요. [완료]를 누르면 하던 화면으로 돌아가요.
 *  - 학생 화면에서만 떠요. 지도자가 학생 설정에서 학생마다 켜고 끌 수 있어요. (Store.motionOn)
 *  - 시연할 때는 주소 뒤에 ?idle=10 을 붙이면 10초로 줄어요.
 * ========================================================================= */

const MOTION_IDLE_MS = (() => {
  const s = Number(new URLSearchParams(location.search).get('idle'));
  return s > 0 ? s * 1000 : 5 * 60 * 1000;
})();

const MOTION_EXERCISES = [
  { icon: '🙆', name: '팔 벌려 뛰기', count: '5회' },
  { icon: '🦘', name: '제자리 뛰기', count: '10회' },
  { icon: '🙌', name: '기지개 쭉 펴기', count: '3번' },
  { icon: '😌', name: '목 천천히 돌리기', count: '3바퀴' },
  { icon: '🤷', name: '어깨 으쓱으쓱', count: '5회' },
  { icon: '🏋️', name: '앉았다 일어나기', count: '5회' },
];

/* 눈 달린 새싹 친구 그림(sproutBuddy)은 js/pixel.js에 있어요. */

const Motion = {
  phase: null, // null | 'call'(운동할 시간이에요!) | 'do'(운동 카드)
  exercise: null,
  timer: null,
  screen: null,

  isOpen() {
    return !!this.phase;
  },

  _eligible() {
    // 게임 중에는 게임 화면(iframe) 안의 터치를 알 수 없어서 띄우지 않아요.
    // 문제를 푸는 중에는 생각하는 중일 수 있어서 방해하지 않아요. (피그마 메모)
    return !!this.screen && !['splash', 'loading', 'play', 'quiz', 'ending'].includes(this.screen) && Store.motionOn();
  },

  /** 터치·키 입력이 있을 때마다 다시 5분을 세요. */
  arm() {
    clearTimeout(this.timer);
    if (this.phase || !this._eligible()) return;
    this.timer = setTimeout(() => this.call(), MOTION_IDLE_MS);
  },

  /** app.js render() 끝에서 불려요. */
  afterRender(screen) {
    this.screen = screen;
    if (this.phase && !this._eligible()) this.close();
    this.arm();
  },

  call() {
    if (!this._eligible()) return;
    this.phase = 'call';
    this.exercise = MOTION_EXERCISES[Math.floor(Math.random() * MOTION_EXERCISES.length)];
    this.paint();
  },

  start() {
    this.phase = 'do';
    this.paint();
  },

  close(done) {
    this.phase = null;
    this.paint();
    if (done) toast('잘했어요! 몸이 개운해졌죠? 💪');
    this.arm();
  },

  paint() {
    const layer = document.getElementById('motion-layer');
    document.body.classList.toggle('motion-open', !!this.phase);
    if (!this.phase) {
      layer.innerHTML = '';
      return;
    }
    const ex = this.exercise;
    // 피그마 '운동 시간 · 새싹 친구 부르기' / '같이 해요' (390×844 무대를 화면에 맞춰 확대)
    layer.innerHTML =
      this.phase === 'call'
        ? `<div class="motion-overlay" role="dialog" aria-modal="true" aria-label="운동할 시간이에요"><div class="zoomed">
            <div class="m-bubble px px-panel px-surface t-h2">운동할 시간이에요!</div>
            <button class="m-buddy" data-motion-start aria-label="새싹 친구 누르고 운동하기"><img src="assets/ui/logo-sprout.png" alt=""></button>
            <button class="f-btn f-button m-btn px px-tile px-primary" data-motion-start style="left:36px;top:576px;width:318px;height:66px">새싹 친구를 눌러 보세요</button>
          </div></div>`
        : `<div class="motion-overlay" role="dialog" aria-modal="true" aria-label="${ex.name} ${ex.count}"><div class="zoomed">
            <div class="m-card px px-panel px-surface"></div>
            <img class="m-small" src="assets/ui/logo-sprout.png" alt="" aria-hidden="true">
            <div class="m-bubble small px px-panel px-surface t-h2">같이 해볼까?</div>
            <p class="m-name">${ex.icon} ${ex.name}</p>
            <p class="m-count">${ex.count}!</p>
            <button class="f-btn f-button m-btn px px-tile px-primary" data-motion-done style="left:63px;top:552px;width:264px;height:66px">다 했어요!</button>
          </div></div>`;
  },
};

document.getElementById('motion-layer').addEventListener('click', (ev) => {
  if (ev.target.closest('[data-motion-start]')) return Motion.start();
  if (ev.target.closest('[data-motion-done]')) return Motion.close(true);
});

['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((t) =>
  document.addEventListener(t, () => Motion.arm(), { passive: true, capture: true })
);
