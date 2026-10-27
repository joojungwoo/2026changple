/* =========================================================================
 * settings.js — 설정 (프로필 · 학습 모드)
 *
 *  - 홈 화면의 ⚙️ 버튼을 누르면 바로 열려요. 학생도 스스로 바꿀 수 있어요.
 *  - 바꾸면 바로 저장하고 바로 반영돼요. (Profile.set → Store.setProfile)
 * ========================================================================= */

/** 고를 수 있는 값 [값, 이름] */
const SETTING_CHOICES = {
  grade: [[1, '1학년'], [2, '2학년'], [3, '3학년']],
  rep: [['numbers', '🔢 숫자'], ['pictures', '🍎 그림'], ['blocks', '🧱 블록'], ['listen', '🎧 듣기']],
  font: [['m', '보통'], ['l', '크게'], ['xl', '아주 크게']],
  ttsRate: [['slow', '느리게'], ['normal', '보통'], ['fast', '빠르게']],
  layout: [['auto', '자동'], ['portrait', '세로'], ['landscape', '가로']],
  anim: [['off', '끄기'], ['low', '약하게'], ['normal', '보통']],
  focusMin: [[5, '5분'], [6, '6분'], [7, '7분']],
  animTheme: [['grass', '🌿 풀밭'], ['ripple', '💧 물결'], ['bubble', '🫧 비눗방울'], ['star', '✨ 별가루'], ['page', '📖 종이 넘김']],
};

function settingGroup(key, title, help, extra) {
  // 학년은 따로 정하지 않았으면 생년월일로 어림한 학년을 보여 줘요.
  const cur = key === 'grade' ? Store.currentUser().grade : Profile.get()[key];
  return `<section class="set-block">
    <h3>${title}</h3>
    ${help ? `<p class="set-help">${help}</p>` : ''}
    <div class="seg" role="radiogroup" aria-label="${title}">
      ${SETTING_CHOICES[key]
        .map(([v, label]) => `<button type="button" role="radio" aria-checked="${v === cur}" class="${v === cur ? 'on' : ''}" data-pf="${key}" data-val="${v}">${v === cur ? '✔ ' : ''}${label}</button>`)
        .join('')}
    </div>
    ${extra || ''}
  </section>`;
}

function screenSettings() {
  const user = Store.currentUser();
  const pf = Profile.get();
  return `
    ${hud({ back: 'home', title: '⚙️ 설정' })}
    <main class="page settings">
      <section class="set-block">
        <h3>프로필</h3>
        <label class="set-field">별명
          <input id="pf-nick" maxlength="10" value="${esc(pf.nick)}" placeholder="${esc(user.name)}" />
        </label>
        <div class="avatars" role="radiogroup" aria-label="아바타">
          ${PROFILE_AVATARS.map((a) => `<button type="button" role="radio" aria-checked="${a === pf.avatar}" class="avatar ${a === pf.avatar ? 'on' : ''}" data-pf="avatar" data-val="${a}" aria-label="아바타 ${a}">${a}</button>`).join('')}
        </div>
      </section>
      ${settingGroup('grade', '학년')}

      <section class="set-block">
        <h3>학습 모드</h3>
        <div class="mode-cards" role="radiogroup" aria-label="학습 모드">
          ${Object.entries(MODES)
            .map(
              ([id, m]) => `<button type="button" role="radio" aria-checked="${id === pf.mode}" class="mode-card ${id === pf.mode ? 'on' : ''}" data-pf="mode" data-val="${id}">
                <span class="mode-ico" aria-hidden="true">${m.icon}</span>
                <span><b>${m.label}${id === pf.mode ? ' ✔' : ''}</b><small>${m.desc}</small></span>
              </button>`
            )
            .join('')}
        </div>
      </section>
      ${pf.mode === 'focus' ? settingGroup('focusMin', '한 번에 공부하는 시간', `시간이 지나면 풀던 문제까지만 하고 쉬어요. 한 번에 ${FOCUS_COUNT}문제까지 풀어요.`) : ''}

      ${settingGroup('rep', '기본으로 보는 방법', '문제를 풀다가 위쪽 버튼으로 바꿔 볼 수도 있어요.')}
      ${settingGroup('font', '글자 크기')}
      ${settingGroup('ttsRate', '읽어 주기 속도', '', '<button type="button" class="btn btn-block set-try" data-tts-try>🔊 들어 보기</button>')}
      ${settingGroup('layout', '화면 배치', '자동은 iPad를 돌리는 방향을 따라가요. 가로면 문제와 풀이가 나란히 보여요.')}
      ${settingGroup('anim', '움직이는 효과', '문제를 푸는 동안에는 늘 꺼져 있어요. 기기에서 "동작 줄이기"를 켜도 꺼져요.')}
      ${pf.anim === 'off' ? '' : settingGroup('animTheme', '쓸어넘기기 효과', '화면을 손가락으로 쓸면 반응해요. 이 화면에서 바로 쓸어 보세요.')}
    </main>`;
}

/* ------------------------------ 이벤트 ------------------------------ */
(function bindSettings() {
  const root = document.getElementById('app');

  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-pf]');
    if (b) {
      const key = b.dataset.pf;
      const raw = b.dataset.val;
      const val = ['grade', 'focusMin'].includes(key) ? Number(raw) : raw;
      const res = safely(() => Profile.set({ [key]: val }));
      if (!res.ok) return;
      if (key === 'grade') State.grade = val;
      return render();
    }
    if (ev.target.closest('[data-tts-try]')) {
      if (!Speech.read([{ text: '안녕! 나는 새싹이야. 이 빠르기로 읽어 줄게.' }])) toast('이 기기에서는 읽어 주기를 쓸 수 없어요.', 'error');
    }
  });

  root.addEventListener('change', (ev) => {
    if (ev.target.id !== 'pf-nick') return;
    const res = safely(() => Profile.set({ nick: ev.target.value.trim().slice(0, 10) }));
    if (res.ok) toast('별명을 바꿨어요.');
  });

})();
