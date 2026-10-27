/* =========================================================================
 * profile.js — 아이 프로필 · 학습 모드
 *
 *  - 프로필은 학생의 학습 기록(data.profile)에 함께 저장해요. 수파베이스를 쓰면 기기를 바꿔도 따라와요.
 *    읽기 · 쓰기는 Store.profile() / Store.setProfile()로만 해요. (저장 방식이 바뀌어도 여기만 그대로)
 *  - 학습 모드 4종은 화면을 따로 만들지 않고, "입력 방식 + 세션 규칙 + 읽어 주기" 묶음이에요.
 *    퀴즈 화면(app.js screenQuiz)이 Profile.mode()를 보고 알맞게 조립해요.
 * ========================================================================= */

const PROFILE_DEFAULTS = {
  nick: '', // 별명 (비우면 이름)
  grade: null, // 1~3 (비우면 생년월일로 어림한 학년)
  avatar: '🌱',
  rep: 'numbers', // 기본 표현 방식: numbers · pictures · blocks · listen
  font: 'm', // 글자 크기: m 보통 · l 크게 · xl 아주 크게
  ttsRate: 'normal', // 읽어 주기 속도: slow · normal · fast
  layout: 'auto', // 화면 배치: auto · portrait · landscape
  anim: 'normal', // 애니메이션: off · low · normal
  animTheme: 'grass', // 스와이프 테마 (Phase 3)
  mode: 'basic', // 학습 모드: basic · pencil · focus · sound
  focusMin: 6, // 단시간 집중 모드: 한 번에 공부하는 시간(분)
};

const PROFILE_AVATARS = ['🌱', '🐶', '🐱', '🐰', '🐻', '🐼', '🐸', '🐯', '🦊', '🐧'];
const PROFILE_TTS_RATE = { slow: 0.75, normal: 0.9, fast: 1.05 };

/** 학습 모드: 입력 방식 + 세션 규칙 + 읽어 주기 */
const MODES = {
  basic: { label: '기본 모드', icon: '👆', desc: '손가락으로 눌러서 답해요.', input: 'choice' },
  pencil: { label: '펜슬 모드', icon: '✏️', desc: '답을 손글씨로 써요. (손가락으로도 돼요)', input: 'pencil' },
  focus: { label: '단시간 집중 모드', icon: '🎯', desc: '짧게 공부하고 쉬어요. 문제 수가 줄어요.', input: 'choice', focus: true },
  sound: { label: '소리 도움 모드', icon: '🔊', desc: '문제와 보기를 읽어 줘요. 글자를 누르면 다시 읽어 줘요.', input: 'choice', autoRead: true, tapRead: true },
};
/** 단시간 집중 모드에서 한 번에 푸는 문제 수 */
const FOCUS_COUNT = 5;

const Profile = {
  get() {
    const saved = (typeof Store !== 'undefined' && Store.profile()) || {};
    return { ...PROFILE_DEFAULTS, ...saved };
  },

  set(patch) {
    Store.setProfile(patch);
    this.apply();
  },

  mode() {
    return MODES[this.get().mode] || MODES.basic;
  },

  /** 글자 크기 · 애니메이션 · 화면 배치 · 읽기 속도를 화면에 반영해요. (render 때마다 불러요) */
  apply() {
    const p = this.get();
    const b = document.body;
    b.dataset.font = p.font;
    b.dataset.anim = p.anim;
    b.dataset.layout = p.layout;
    Speech.rate = PROFILE_TTS_RATE[p.ttsRate] || 0.9;
    Layout.update();
  },
};

/**
 * 화면 배치: 가로로 넓으면 문제 | 풀이를 나란히, 세로면 위 | 아래.
 *  - 자동은 기기 방향을 따라가고, 세로 · 가로를 고르면 그 배치를 유지해요.
 *    (웹에서는 iPad 회전을 잠글 수 없어서 "고정"은 배치를 유지한다는 뜻이에요)
 *  - 회전해도 다시 그리지 않고 #app의 클래스만 바꿔요. 그래서 풀던 문제 · 쓰던 손글씨가 그대로예요.
 */
const Layout = {
  wide() {
    const pref = document.body.dataset.layout || 'auto';
    if (pref === 'portrait') return false;
    if (pref === 'landscape') return window.innerWidth >= 700;
    return window.innerWidth > window.innerHeight && window.innerWidth >= 900;
  },
  update() {
    const el = document.getElementById('app');
    if (el) el.classList.toggle('wide', this.wide());
  },
};
window.addEventListener('resize', () => Layout.update());
window.addEventListener('orientationchange', () => Layout.update());
