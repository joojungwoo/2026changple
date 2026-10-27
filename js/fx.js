/* =========================================================================
 * fx.js — 쓸어넘길 때 반응하는 재미 효과 (스와이프 테마) + 보상 축하
 *
 *  - 첫 화면이 뜬 뒤에 늦게 불러와요(app.js loadFx). 첫 로딩을 느리게 하지 않으려고.
 *  - 캔버스 하나(#fx-layer)를 화면 위에 덮고(누르기는 통과), 테마만 바꿔 끼워요. FX_THEMES
 *      grass  풀밭: 화면 아래 풀잎이 쓸어넘긴 방향 · 빠르기만큼 휘었다가 용수철처럼 돌아와요
 *      ripple 물결: 손가락이 지나간 자리에 물결이 퍼져요 (빠를수록 크게)
 *      bubble 비눗방울: 지나간 길에 방울이 생겨 손 방향으로 날아가다 톡 터져요
 *      star   별가루: 손가락 궤적에 반짝이 꼬리가 남아요
 *      page   종이 넘김: 쓸어넘기면 모서리가 따라 접히고, 화면이 바뀔 때 책장처럼 넘어가요
 *  - 문제 푸는 화면 · 게임 · 채팅방 · 손글씨 칸에서는 동작하지 않아요. (FX_SCREENS에 있는 화면만)
 *  - 설정의 '움직이는 효과'(끄기 · 약하게 · 보통)와 기기의 '동작 줄이기'를 따라요.
 *  - 움직일 것이 없으면 그리기를 멈추고, 앱이 안 보이면(다른 앱으로 가면) 멈춰요.
 * ========================================================================= */

/** 효과가 동작하는 화면: 화면 전환 · 메뉴 · 보상 화면만 */
const FX_SCREENS = ['intro', 'login', 'signup', 'home', 'unit', 'games', 'chat', 'result', 'rest', 'settings'];
const FX_MAX_PARTS = 160;

const FX = {
  canvas: null,
  g: null,
  w: 0,
  h: 0,
  parts: [], // 물결 · 방울 · 별가루 · 축하 조각
  blades: [], // 풀잎
  curl: { size: 0, target: 0, side: 1, y: 0 }, // 종이 모서리
  last: null, // 마지막 손가락 위치 { x, y, t }
  vel: { x: 0, y: 0 }, // 손가락 빠르기 (px/ms)
  spawnD: 0,
  running: false,
  lastSwipe: { vx: 0, t: 0 },

  theme() {
    // 예전 '풀밭' 테마(화면 아래 풀)는 없앴어요. 풀은 단원 길에서 스크롤할 때 움직여요(ui.js ScrollGrass).
    const t = (typeof Profile !== 'undefined' && Profile.get().animTheme) || 'star';
    return t === 'grass' ? 'star' : t;
  },
  level() {
    if (!motionAllowed()) return 0;
    return document.body.dataset.anim === 'low' ? 0.45 : 1;
  },
  active() {
    return this.level() > 0 && FX_SCREENS.includes(State.screen);
  },

  init() {
    const c = document.createElement('canvas');
    c.id = 'fx-layer';
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    this.canvas = c;
    this.g = c.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => !document.hidden && this.kick());

    // 펜 · 마우스는 Pointer Events, 손가락은 Touch Events로 받아요.
    // (손가락으로 쓸면 브라우저가 스크롤을 시작하면서 pointercancel을 보내서, 그 뒤 움직임을 놓치지 않으려고)
    const opt = { passive: true };
    document.addEventListener('pointerdown', (e) => e.pointerType !== 'touch' && this.start(e.clientX, e.clientY, e.target), opt);
    document.addEventListener('pointermove', (e) => e.pointerType !== 'touch' && e.buttons && this.move(e.clientX, e.clientY), opt);
    document.addEventListener('pointerup', (e) => e.pointerType !== 'touch' && this.end(), opt);
    document.addEventListener('touchstart', (e) => this.start(e.touches[0].clientX, e.touches[0].clientY, e.target), opt);
    document.addEventListener('touchmove', (e) => this.move(e.touches[0].clientX, e.touches[0].clientY), opt);
    document.addEventListener('touchend', () => this.end(), opt);
    document.addEventListener('touchcancel', () => this.end(), opt);
    this.onRender();
  },

  /** 캔버스는 앱이 있는 곳에만 깔아요. (넓은 화면에서 앱 밖까지 풀이 나지 않게) */
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const app = document.getElementById('app').getBoundingClientRect();
    this.ox = Math.max(0, app.left);
    this.w = Math.min(window.innerWidth, app.width) || window.innerWidth;
    this.h = window.innerHeight;
    Object.assign(this.canvas.style, { left: `${this.ox}px`, width: `${this.w}px` });
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._makeGrass();
    this.kick(true);
  },

  /** render() 끝에서 불려요: 화면이 바뀌면 효과를 비우거나 다시 그려요. */
  onRender() {
    if (!this.canvas) return;
    this.canvas.style.display = this.active() ? 'block' : 'none';
    const app = document.getElementById('app').getBoundingClientRect();
    if (Math.abs(app.left - (this.ox || 0)) > 1 || Math.abs(Math.min(window.innerWidth, app.width) - this.w) > 1) return this.resize();
    if (!this.active()) {
      this.parts = [];
      this.curl.size = this.curl.target = 0;
    }
    this._makeGrass();
    this.kick(true);
  },

  /* ---------------- 손가락 ---------------- */
  start(x, y, target) {
    x -= this.ox || 0;
    // 글자 칸 · 손글씨 칸 위에서는 효과를 내지 않아요.
    if (!this.active() || (target && target.closest && target.closest('input, textarea, [data-pencil]'))) return (this.last = null);
    this.last = { x, y, t: performance.now() };
    this.gesture = 0;
  },

  move(x, y) {
    if (!this.last || !this.active()) return;
    x -= this.ox || 0;
    const now = performance.now();
    const dt = Math.max(8, now - this.last.t);
    const vx = (x - this.last.x) / dt;
    const vy = (y - this.last.y) / dt;
    // 빠르기는 부드럽게 따라가요.
    this.vel.x = this.vel.x * 0.6 + vx * 0.4;
    this.vel.y = this.vel.y * 0.6 + vy * 0.4;
    const d = Math.hypot(x - this.last.x, y - this.last.y);
    this.gesture += d;
    this.spawnD += d;
    if (Math.abs(this.vel.x) > 0.3) this.lastSwipe = { vx: this.vel.x, t: now };
    this._themeMove(x, y, d);
    this.last = { x, y, t: now };
    this.kick();
  },

  end() {
    this.last = null;
    this.curl.target = 0;
    this.kick();
  },

  _themeMove(x, y, d) {
    const L = this.level();
    const speed = Math.min(3, Math.hypot(this.vel.x, this.vel.y));
    const theme = this.theme();
    if (theme === 'grass') {
      // 아래쪽에 가까울수록, 빠를수록 세게 휘어요.
      const near = Math.max(0.25, Math.min(1, 1 - (this.groundY() - y) / (this.h * 0.7)));
      this.blades.forEach((b) => {
        const dx = Math.abs(b.x - x);
        if (dx > 140) return;
        b.v += this.vel.x * 0.011 * (1 - dx / 140) * near * L;
      });
    } else if (theme === 'ripple') {
      if (this.spawnD > 26 / L) {
        this.spawnD = 0;
        this._add({ kind: 'ripple', x, y, r: 4, max: 26 + speed * 46, life: 0, dur: 760 });
      }
    } else if (theme === 'bubble') {
      if (this.spawnD > 30 / L) {
        this.spawnD = 0;
        this._add({ kind: 'bubble', x, y, vx: this.vel.x * 0.25, vy: this.vel.y * 0.25 - 0.05, r: 6 + Math.random() * 6 + speed * 4, life: 0, dur: 900 + Math.random() * 600 });
      }
    } else if (theme === 'star') {
      const n = Math.max(1, Math.round((1 + speed * 2) * L));
      for (let i = 0; i < n; i++) {
        this._add({ kind: 'star', x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, vx: -this.vel.x * 0.12 + (Math.random() - 0.5) * 0.12, vy: -this.vel.y * 0.12 + (Math.random() - 0.5) * 0.12, s: 3 + Math.random() * 4, life: 0, dur: 500 + Math.random() * 300, hue: Math.random() });
      }
    } else if (theme === 'page') {
      // 쓸어넘긴 거리만큼 반대쪽 모서리가 접혀요.
      this.curl.side = this.vel.x < 0 ? 1 : -1;
      this.curl.y = y;
      this.curl.target = Math.min(160, this.gesture * 0.45) * L;
    }
  },

  _add(p) {
    this.parts.push(p);
    if (this.parts.length > FX_MAX_PARTS) this.parts.splice(0, this.parts.length - FX_MAX_PARTS);
  },

  /* ---------------- 풀밭 ---------------- */
  groundY() {
    // 탭바가 있으면 그 위에 풀이 나요. (탭바 글자를 가리지 않게)
    const bar = document.querySelector('.tabbar');
    return bar ? bar.getBoundingClientRect().top : this.h;
  },
  _makeGrass() {
    if (!this.canvas || this.theme() !== 'grass' || !this.active()) return (this.blades = []);
    const gap = this.level() < 1 ? 22 : 13;
    const old = this.blades;
    this.blades = [];
    for (let x = 4, i = 0; x < this.w; x += gap, i++) {
      const prev = old[i];
      this.blades.push({ x: x + ((i * 7) % 5), h: 18 + ((i * 37) % 17), a: prev ? prev.a : 0, v: prev ? prev.v : 0, dark: i % 3 === 0 });
    }
  },

  /* ---------------- 보상 축하 ---------------- */
  /** 세션을 마쳤을 때: 짧게 톡 터지는 축하 (테마와 상관없이) */
  celebrate() {
    const L = this.level();
    if (!L || !FX_SCREENS.includes(State.screen)) return;
    const n = Math.round(60 * L);
    const cx = this.w / 2;
    const cy = this.h * 0.32;
    const colors = ['#ffc93c', '#6cc24a', '#7ccdf2', '#ff9aa2', '#8b7bf0'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.25 + Math.random() * 0.55;
      this._add({ kind: 'confetti', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.35, s: 5 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.02, life: 0, dur: 1100 + Math.random() * 400, color: colors[i % colors.length] });
    }
    this.kick();
  },

  /* ---------------- 종이 넘김: 화면이 바뀔 때 ---------------- */
  /** go() 바로 앞에서 불려요. 지금 화면을 본떠서 책장처럼 넘겨요. */
  beforeNav(from, to) {
    if (this.theme() !== 'page' || !this.level() || !FX_SCREENS.includes(from) || !FX_SCREENS.includes(to) || from === to) return;
    const app = document.getElementById('app');
    const r = app.getBoundingClientRect();
    const sheet = app.cloneNode(true);
    sheet.removeAttribute('id');
    sheet.classList.add('fx-page');
    Object.assign(sheet.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    // 최근에 오른쪽→왼쪽으로 쓸었으면 왼쪽으로 넘기고, 빠를수록 빨리 넘어가요.
    const recent = performance.now() - this.lastSwipe.t < 600;
    const dir = recent && this.lastSwipe.vx > 0 ? 1 : -1;
    const speed = recent ? Math.min(2.5, Math.abs(this.lastSwipe.vx)) : 0.8;
    const ms = Math.round(Math.max(320, 720 - speed * 160) / Math.max(this.level(), 0.6));
    sheet.style.transformOrigin = dir < 0 ? 'left center' : 'right center';
    sheet.style.transition = `transform ${ms}ms cubic-bezier(.4,.1,.3,1), filter ${ms}ms ease`;
    document.body.appendChild(sheet);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        sheet.style.transform = `perspective(1600px) rotateY(${dir < 0 ? -100 : 100}deg)`;
        sheet.style.filter = 'brightness(.85)';
      })
    );
    setTimeout(() => sheet.remove(), ms + 60);
  },

  /* ---------------- 그리기 ---------------- */
  kick(force) {
    if (this.running || document.hidden) {
      if (force && !this.running) this.draw(0);
      return;
    }
    this.running = true;
    let prev = performance.now();
    const step = (now) => {
      if (document.hidden) return (this.running = false);
      const dt = Math.min(40, now - prev);
      prev = now;
      const busy = this.draw(dt);
      if (busy) requestAnimationFrame(step);
      else this.running = false; // 움직일 것이 없으면 멈춰요.
    };
    requestAnimationFrame(step);
  },

  /** 한 장면 그리기. 아직 움직이는 것이 있으면 true */
  draw(dt) {
    const g = this.g;
    g.clearRect(0, 0, this.w, this.h);
    if (!this.active()) return false;
    let busy = false;

    // 풀밭
    if (this.theme() === 'grass' && this.blades.length) {
      const base = this.groundY();
      const ink = '#4a2f1a';
      this.blades.forEach((b) => {
        // 용수철: 휘어진 만큼 되돌아가려 하고, 조금씩 힘이 빠져요.
        b.v += (-0.0009 * b.a - 0.012 * b.v) * dt;
        b.a = Math.max(-1.1, Math.min(1.1, b.a + b.v * dt));
        if (Math.abs(b.a) > 0.002 || Math.abs(b.v) > 0.0002) busy = true;
        const tipX = b.x + Math.sin(b.a) * b.h;
        const tipY = base - Math.cos(b.a) * b.h;
        g.beginPath();
        g.moveTo(b.x - 3, base);
        g.quadraticCurveTo(b.x + Math.sin(b.a) * b.h * 0.4, base - b.h * 0.55, tipX, tipY);
        g.quadraticCurveTo(b.x + Math.sin(b.a) * b.h * 0.4 + 2, base - b.h * 0.5, b.x + 3, base);
        g.closePath();
        g.fillStyle = b.dark ? '#7ea453' : '#9cbd6d';
        g.fill();
        g.lineWidth = 1.5;
        g.strokeStyle = ink;
        g.stroke();
      });
    }

    // 조각들
    this.parts = this.parts.filter((p) => {
      p.life += dt;
      const t = p.life / p.dur;
      if (t >= 1) {
        if (p.kind === 'bubble') for (let i = 0; i < 6; i++) this._add({ kind: 'drop', x: p.x, y: p.y, vx: Math.cos(i) * 0.15, vy: Math.sin(i) * 0.15, life: 0, dur: 260 });
        return false;
      }
      busy = true;
      if (p.kind === 'ripple') {
        g.beginPath();
        g.arc(p.x, p.y, 4 + (p.max - 4) * Math.sqrt(t), 0, Math.PI * 2);
        g.lineWidth = 3 * (1 - t) + 1;
        g.strokeStyle = `rgba(61, 143, 196, ${0.55 * (1 - t)})`;
        g.stroke();
      } else if (p.kind === 'bubble') {
        p.vy -= 0.00012 * dt; // 둥실 떠올라요
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.985;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.fillStyle = 'rgba(200, 235, 255, .28)';
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = 'rgba(61, 143, 196, .7)';
        g.stroke();
        g.beginPath();
        g.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.22, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,255,255,.9)';
        g.fill();
      } else if (p.kind === 'drop') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        g.fillStyle = `rgba(61, 143, 196, ${1 - t})`;
        g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      } else if (p.kind === 'star') {
        p.x += p.vx * dt;
        p.y += p.vy * dt + 0.00005 * dt * p.life;
        const s = p.s * (1 - t);
        g.fillStyle = p.hue > 0.5 ? `rgba(255, 201, 60, ${1 - t})` : `rgba(255, 255, 255, ${1 - t})`;
        g.beginPath();
        g.moveTo(p.x, p.y - s * 1.6);
        g.lineTo(p.x + s * 0.4, p.y - s * 0.4);
        g.lineTo(p.x + s * 1.6, p.y);
        g.lineTo(p.x + s * 0.4, p.y + s * 0.4);
        g.lineTo(p.x, p.y + s * 1.6);
        g.lineTo(p.x - s * 0.4, p.y + s * 0.4);
        g.lineTo(p.x - s * 1.6, p.y);
        g.lineTo(p.x - s * 0.4, p.y - s * 0.4);
        g.closePath();
        g.fill();
      } else if (p.kind === 'confetti') {
        p.vy += 0.0009 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.globalAlpha = 1 - Math.max(0, t - 0.7) / 0.3;
        g.fillStyle = p.color;
        g.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
        g.restore();
      }
      return true;
    });

    // 종이 모서리
    if (this.theme() === 'page') {
      const c = this.curl;
      c.size += (c.target - c.size) * Math.min(1, dt * 0.012);
      if (Math.abs(c.target - c.size) > 0.5) busy = true;
      if (c.size > 1) {
        const s = c.size;
        const x0 = c.side > 0 ? this.w : 0;
        const y0 = this.h;
        g.beginPath();
        g.moveTo(x0 - c.side * s, y0);
        g.lineTo(x0, y0 - s);
        g.lineTo(x0 - c.side * s * 0.92, y0 - s * 0.92);
        g.closePath();
        g.fillStyle = '#f3e8ca';
        g.shadowColor = 'rgba(0,0,0,.25)';
        g.shadowBlur = 10;
        g.fill();
        g.shadowBlur = 0;
        g.lineWidth = 2;
        g.strokeStyle = '#4a2f1a';
        g.stroke();
      }
    }
    return busy;
  },
};

FX.init();
