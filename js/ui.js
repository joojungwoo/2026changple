/* =========================================================================
 * ui.js — 시작 화면 · 로딩 화면 (피그마 390×844 무대)
 *
 *  - 학생 화면(복도 · 교실 · 대화 · 문제)은 school.js로 옮겼어요.
 *  - 픽셀 틀은 pxkit.js 클래스: px px-<모양> px-<색>
 * ========================================================================= */

const UI_IMG = {
  logo: 'assets/ui/logo-sprout.png',
  pencil: 'assets/ui/icon-pencil.png',
  house: 'assets/ui/icon-house.png',
  chat: 'assets/ui/icon-chat.svg',
  back: 'assets/ui/back.svg',
  gear: 'assets/ui/icon-gear.svg',
  boat: 'assets/ui/icon-boat.svg',
  math: 'assets/ui/icon-math.png',
  korean: 'assets/ui/icon-korean.png',
  chevron: 'assets/ui/icon-chevron-down.svg',
  droplet: 'assets/ui/icon-droplet.svg',
  sparkle: 'assets/ui/icon-sparkle.svg',
  arrow: 'assets/ui/icon-arrow-right.svg',
  book: 'assets/ui/icon-book.svg',
  stage: { empty: 'assets/ui/stage-seed.png', seed: 'assets/ui/stage-seed.png', sprout: 'assets/ui/stage-sprout.png', tree: 'assets/ui/stage-tree.png', fruit: 'assets/ui/stage-fruit.png' },
};

const img = (src, alt, cls) => `<img src="${src}" alt="${alt || ''}" ${cls ? `class="${cls}"` : ''} ${alt ? '' : 'aria-hidden="true"'} draggable="false">`;

/** 동그란 픽셀 버튼 (피그마 Icon Button 48×48) */
function fRound(attrs, icon, label, cls) {
  return `<button class="f-btn f-round px px-round px-surface ${cls || ''}" ${attrs} aria-label="${label}">${img(icon)}</button>`;
}

/** 이름표 (피그마 Name Plate) */
function fPlate(text, cls, attrs) {
  const tag = attrs ? 'button' : 'div';
  return `<${tag} class="f-plate f-btn px px-plate px-surface ${cls || ''}" ${attrs || ''}>${text}</${tag}>`;
}

function screenSplash() {
  return stageScreen({
    cls: 'scr-splash',
    sky: '#fefbe8',
    ground: '#fefbe8',
    body: `<button class="f-btn" data-skip aria-label="한걸음 시작하기" style="left:0;top:0;width:390px;height:844px;background:none;border:0"></button>
      ${img(UI_IMG.logo, '', 'splash-logo-img')}
      <h1 class="splash-name">한걸음</h1>`,
  });
}

/** 로딩: 새싹 + "로딩중" + 점 세 개 (0.4초마다 금색 점이 옆으로) */
function screenLoading() {
  return stageScreen({
    cls: 'scr-loading',
    sky: '#fefbe8',
    ground: '#fefbe8',
    body: `${img(UI_IMG.logo, '', 'loading-logo')}
      <p class="loading-text" role="status">로딩중</p>
      <div class="loading-dots" aria-hidden="true"><i class="px px-cell px-primary"></i><i class="px px-cell px-surface"></i><i class="px px-cell px-surface"></i></div>`,
  });
}
let loadingTimer = null;
function loadingAfterRender() {
  clearInterval(loadingTimer);
  if (State.screen !== 'loading') return;
  let at = 0;
  loadingTimer = setInterval(() => {
    at = (at + 1) % 3;
    document.querySelectorAll('.loading-dots i').forEach((d, i) => {
      d.classList.toggle('px-primary', i === at);
      d.classList.toggle('px-surface', i !== at);
    });
  }, 400);
}
