/* =========================================================================
 * stage.js — 피그마 화면(390×844)을 iPad · 휴대폰 화면에 꽉 차게
 *
 *  - 무대(.stage): 피그마 좌표 그대로(390×844 px)로 그리고 CSS zoom으로 확대해요.
 *      배율 --u = min(화면 너비 / 390, 화면 높이 / 844)  → 피그마와 같은 비율 · 같은 배치
 *  - 배경(.fbg): 피그마처럼 무대에 맞춘 그림을 가운데 두고, 남는 양옆은 그림을 좌우로 뒤집어
 *    이어 붙여요. 뒤집힌 그림은 이음새가 맞아서 풍경이 끊기지 않고 이어져 보여요.
 *    (그래서 표지판 · 배처럼 배경 위에 놓인 것이 피그마와 같은 자리에 와요)
 *  - 무대 위아래로 남는 곳은 하늘색(--sky) · 땅색(--ground)으로 채워요.
 * ========================================================================= */

const STAGE_W = 390;
const STAGE_H = 844;

/** 배경 그림: 파일 · 원본 크기 (피그마에서 390×844에 object-fit: cover로 채웠어요) */
const STAGE_BGS = {
  valley: { src: 'assets/ui/bg-valley.jpg', w: 1088, h: 1920 },
  field: { src: 'assets/ui/bg-field.jpg', w: 768, h: 1376 },
  meadow: { src: 'assets/ui/bg-meadow.png', w: 502, h: 898 },
};

const Stage = {
  u: 1,
  _strips: {}, // 그림 + 뒤집은 그림을 나란히 붙인 띠 (dataURL)
  _loading: {},

  /** 이 크기의 무대에서 배경 그림이 놓이는 자리 (피그마 cover와 같은 계산) */
  cover(bg, h) {
    const b = STAGE_BGS[bg];
    const s = Math.max(STAGE_W / b.w, (h || STAGE_H) / b.h);
    return { w: b.w * s, h: b.h * s, x: (STAGE_W - b.w * s) / 2, y: ((h || STAGE_H) - b.h * s) / 2 };
  },

  /** 그림 + 좌우 뒤집은 그림 → 이어 붙이면 끊김 없는 띠 */
  strip(bg) {
    if (this._strips[bg]) return this._strips[bg];
    if (this._loading[bg]) return null;
    this._loading[bg] = true;
    const b = STAGE_BGS[bg];
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1400 / img.height); // 너무 큰 캔버스는 피해요
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w * 2;
      c.height = h;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, w, h);
      g.save();
      g.translate(w * 2, 0);
      g.scale(-1, 1);
      g.drawImage(img, 0, 0, w, h);
      g.restore();
      this._strips[bg] = c.toDataURL(bg === 'meadow' ? 'image/png' : 'image/jpeg', 0.9);
      this.paint();
    };
    img.src = b.src;
    return null;
  },

  update() {
    const u = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    this.u = u;
    document.documentElement.style.setProperty('--u', String(u));
    this.paint();
  },

  /** 배경 띠를 무대에 맞춰 놓아요. (render 뒤 · 화면 크기가 바뀔 때) */
  paint() {
    document.querySelectorAll('.fbg[data-bg]').forEach((el) => {
      const bg = el.dataset.bg;
      const stage = el.parentElement.querySelector('.stage');
      const h = Number(el.dataset.h) || STAGE_H;
      const c = this.cover(bg, h);
      let u = this.u;
      let left;
      let top;
      if (stage) {
        const sr = stage.getBoundingClientRect();
        const pr = el.parentElement.getBoundingClientRect();
        left = sr.left - pr.left;
        top = sr.top - pr.top;
      } else {
        // 무대가 없는 화면(문제풀기 등): 화면 높이에 맞춘 가상 무대를 가운데에 두고 배경만 깔아요.
        u = window.innerHeight / STAGE_H;
        left = (window.innerWidth - STAGE_W * u) / 2;
        top = 0;
      }
      const url = this._strips[bg] || this.strip(bg);
      // 띠 한 칸 = 그림 2장 너비. 원본 그림이 피그마 자리(무대 왼쪽 + c.x)에 오게 맞춰요.
      Object.assign(el.style, {
        top: `${top + c.y * u}px`,
        height: `${c.h * u}px`,
        backgroundImage: url ? `url("${url}")` : `url("${STAGE_BGS[bg].src}")`,
        backgroundSize: url ? `${c.w * 2 * u}px ${c.h * u}px` : `${c.w * u}px ${c.h * u}px`,
        backgroundPosition: `${left + c.x * u}px 0`,
        backgroundRepeat: url ? 'repeat-x' : 'no-repeat',
      });
    });
  },
};

/**
 * 피그마 화면 하나
 * @param o { cls, bg, sky, ground, h (무대 높이, 기본 844), body (무대 안 HTML), over (무대 밖 위에 겹칠 HTML) }
 */
function stageScreen(o) {
  const h = o.h || STAGE_H;
  return `<div class="fscr ${o.cls || ''}" style="--sky:${o.sky || '#96c6ea'};--ground:${o.ground || '#8ebc64'}">
    ${o.bg ? `<div class="fbg" data-bg="${o.bg}" data-h="${o.bgH || STAGE_H}" aria-hidden="true"></div>` : ''}
    ${o.under || ''}
    <div class="stage" style="height:${h}px">${o.body || ''}</div>
    ${o.over || ''}
  </div>`;
}

window.addEventListener('resize', () => Stage.update());
Stage.update();
