/* =========================================================================
 * pencil.js — 손글씨 입력 (펜슬 · 손가락)
 *
 *  - 문제는 다른 모드와 똑같고, 답을 내는 방법만 손글씨예요. (problem.js의 입력 방식 'pencil')
 *  - Pointer Events로 펜 · 손가락 · 마우스를 모두 받아요.
 *    팜 리젝션: 펜으로 쓰는 중이거나, 이 문제에서 펜을 한 번이라도 쓰면 손바닥 · 손가락 터치는 무시해요.
 *    펜이 없는 기기에서는 손가락으로 써요.
 *  - 선 굵기: 펜은 필압, 손가락 · 마우스는 빠르기로 자연스럽게 바꿔요.
 *  - 도구: 쓰기 · 지우개(획 지우기) · 되돌리기 · 다 지우기
 *  - 획은 칸 크기에 대한 비율(0~1)로 State.quiz.ink에 저장해요. 화면을 다시 그리거나 iPad를 돌려도 그대로 다시 그려요.
 *  - 손풀이 과정(획 · 지운 횟수 · 멈춘 시간)은 Store.saveInk로 저장만 해 둬요. (보호자 리포트 분석은 나중에)
 * ========================================================================= */

const PENCIL_PAUSE_MS = 1500; // 획 사이가 이만큼 비면 "멈춤"으로 남겨요
const PENCIL_ERASE_R = 0.05; // 지우개 반지름 (칸 너비 비율)

function freshInk() {
  return { strokes: [], history: [], tool: 'pen', penSeen: false, log: { erases: 0, undos: 0, clears: 0, pauses: [] }, lastUp: 0, cands: null, reading: false, note: '' };
}

/** 답의 자리 수만큼 칸: 백 ▲ · 십 ■ · 일 ● (자릿값 색과 같은 토큰) */
function pencilCells(p) {
  return String(p.answer.value).length;
}

function inputPencil(parts) {
  const { q, p } = parts;
  const ink = q.ink || (q.ink = freshInk());
  const n = pencilCells(p);
  const places = Array.from({ length: n }, (_, i) => 10 ** (n - 1 - i));
  if (q.checked) {
    return `<div class="np-display done"><span class="np-value">${pvNum(p.answer.value)}</span>${p.answer.unit ? `<span class="np-unit">${esc(p.answer.unit)}</span>` : ''}<span class="np-mark">⭐ 정답</span></div>`;
  }
  const tool = (id, label) => `<button type="button" class="pc-tool ${ink.tool === id ? 'on' : ''}" data-pc-tool="${id}" aria-pressed="${ink.tool === id}">${label}</button>`;
  return `<div class="pencil">
    ${q.tries.length ? `<p class="np-tried">🤔 써 본 답: ${q.tries.map((t) => esc(responseText(p, t))).join(', ')}</p>` : ''}
    <div class="pc-board" style="--cells:${n}">
      <div class="pc-pad">
        <div class="pc-cells" aria-hidden="true">
          ${places.map((pl) => `<span class="pc-cell pv-cell-${pl}"><small class="pv pv-${pl}">${PV_NAME[pl]}</small></span>`).join('')}
        </div>
        <canvas class="pc-canvas" data-pencil aria-label="여기에 답을 써요. 칸 하나에 숫자 하나씩"></canvas>
      </div>
      ${p.answer.unit ? `<span class="pc-unit">${esc(p.answer.unit)}</span>` : ''}
    </div>
    <div class="pc-tools" role="group" aria-label="쓰기 도구">
      ${tool('pen', '✏️ 쓰기')}${tool('eraser', '🧽 지우개')}
      <button type="button" class="pc-tool" data-pc-undo ${ink.history.length ? '' : 'disabled'}>↩ 되돌리기</button>
      <button type="button" class="pc-tool" data-pc-clear ${ink.strokes.length ? '' : 'disabled'}>🗑 다 지우기</button>
    </div>
    ${ink.note ? `<p class="pc-note" role="status">${esc(ink.note)}</p>` : ''}
    ${
      ink.cands
        ? `<div class="pc-cands" role="group" aria-label="이 숫자 맞아?">
            <p>이 숫자 맞아? 👀</p>
            <div class="pc-cand-row">${ink.cands.map((c) => `<button type="button" class="pc-cand" data-pc-pick="${esc(c)}">${pvNum(c)}</button>`).join('')}</div>
            <button type="button" class="btn btn-block" data-pc-rewrite>✏️ 다시 쓸래요</button>
          </div>`
        : ''
    }
  </div>`;
}

const Pencil = {
  canvas: null,
  ctx: null,
  cur: null, // 쓰고 있는 획
  activeId: null,

  ink() {
    return State.quiz && State.quiz.ink;
  },

  /** render 뒤에 불러요: 캔버스 크기를 맞추고 저장된 획을 다시 그려요. */
  mount() {
    const c = document.querySelector('[data-pencil]');
    this.canvas = c;
    if (!c) return;
    this.ctx = c.getContext('2d');
    this.resize();
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    c.addEventListener('pointerup', (e) => this.up(e));
    c.addEventListener('pointercancel', (e) => this.up(e));
    c.addEventListener('pointerleave', (e) => this.up(e));
  },

  resize() {
    const c = this.canvas;
    if (!c || !c.isConnected) return;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.redraw();
  },

  _pt(e) {
    const r = this.canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, Date.now(), e.pointerType === 'pen' ? e.pressure || 0.5 : -1];
  },

  /** 팜 리젝션 */
  _reject(e) {
    const ink = this.ink();
    if (!ink) return true;
    if (e.pointerType === 'pen') return false;
    if (e.pointerType === 'touch' && (ink.penSeen || this.activeId !== null || Date.now() - ink.lastUp < 300 && ink.lastType === 'pen')) return true;
    return !e.isPrimary;
  },

  down(e) {
    const ink = this.ink();
    if (!ink || this._reject(e)) return;
    e.preventDefault();
    if (e.pointerType === 'pen') ink.penSeen = true;
    this.activeId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (err) { /* 캡처를 못 해도 캔버스 안에서는 그대로 써져요. */ }
    ink.cands = null;
    const p = this._pt(e);
    if (ink.tool === 'eraser') return this._erase(p);
    if (ink.lastUp && p[2] - ink.lastUp > PENCIL_PAUSE_MS && ink.strokes.length) ink.log.pauses.push(p[2] - ink.lastUp);
    this.cur = { type: e.pointerType, pts: [p] };
    ink.strokes.push(this.cur);
  },

  move(e) {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    const ink = this.ink();
    // 펜은 사이사이의 점(coalesced)까지 받아 선이 매끄러워요.
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs.length ? evs : [e]) {
      const p = this._pt(ev);
      if (ink.tool === 'eraser') this._erase(p);
      else if (this.cur) this.cur.pts.push(p);
    }
    this.redraw();
  },

  up(e) {
    if (e.pointerId !== this.activeId) return;
    const ink = this.ink();
    this.activeId = null;
    if (ink) {
      ink.lastUp = Date.now();
      ink.lastType = e.pointerType;
      if (this.cur) {
        if (this.cur.pts.length < 2) this.cur.pts.push([this.cur.pts[0][0] + 0.002, this.cur.pts[0][1] + 0.002, Date.now(), this.cur.pts[0][3]]);
        ink.history.push({ kind: 'add', stroke: this.cur });
      }
    }
    this.cur = null;
    this._tools();
  },

  _erase(p) {
    const ink = this.ink();
    const r = this.canvas.getBoundingClientRect();
    const hit = ink.strokes.filter((s) => s.pts.some((q) => Math.hypot((q[0] - p[0]) * r.width, (q[1] - p[1]) * r.height) < PENCIL_ERASE_R * r.width));
    if (!hit.length) return;
    ink.strokes = ink.strokes.filter((s) => !hit.includes(s));
    ink.history.push({ kind: 'erase', strokes: hit });
    ink.log.erases += hit.length;
    this.redraw();
  },

  undo() {
    const ink = this.ink();
    const h = ink.history.pop();
    if (!h) return;
    ink.log.undos++;
    if (h.kind === 'add') ink.strokes = ink.strokes.filter((s) => s !== h.stroke);
    else ink.strokes.push(...h.strokes);
    ink.cands = null;
  },

  clear() {
    const ink = this.ink();
    if (!ink.strokes.length) return;
    ink.history.push({ kind: 'erase', strokes: ink.strokes });
    ink.strokes = [];
    ink.log.clears++;
    ink.cands = null;
  },

  /** 버튼만 켜고 꺼요. (쓰는 중에 화면 전체를 다시 그리지 않으려고) */
  _tools() {
    const ink = this.ink();
    const u = document.querySelector('[data-pc-undo]');
    const c = document.querySelector('[data-pc-clear]');
    if (u) u.disabled = !ink.history.length;
    if (c) c.disabled = !ink.strokes.length;
    const submit = document.querySelector('[data-submit]');
    if (submit) {
      submit.disabled = !ink.strokes.length;
      submit.textContent = ink.strokes.length ? '다 썼어요!' : '답을 써 주세요';
    }
  },

  redraw() {
    const c = this.canvas;
    const ink = this.ink();
    if (!c || !ink) return;
    const r = c.getBoundingClientRect();
    const g = this.ctx;
    g.clearRect(0, 0, r.width, r.height);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#4a2f1a';
    const base = Math.max(4, r.height * 0.045);
    ink.strokes.forEach((s) => {
      for (let i = 1; i < s.pts.length; i++) {
        const a = s.pts[i - 1];
        const b = s.pts[i];
        let w;
        if (b[3] >= 0) w = base * (0.45 + b[3] * 1.1); // 펜: 필압
        else {
          // 손가락 · 마우스: 빠를수록 조금 가늘게
          const v = Math.hypot((b[0] - a[0]) * r.width, (b[1] - a[1]) * r.height) / Math.max(1, b[2] - a[2]);
          w = base * Math.max(0.65, 1.15 - v * 0.25);
        }
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(a[0] * r.width, a[1] * r.height);
        g.lineTo(b[0] * r.width, b[1] * r.height);
        g.stroke();
      }
    });
  },

  /** 획을 칸별로 나눠요. (획 가운데가 들어 있는 칸) */
  cells(n) {
    const ink = this.ink();
    const r = this.canvas.getBoundingClientRect();
    const out = Array.from({ length: n }, () => []);
    ink.strokes.forEach((s) => {
      const cx = s.pts.reduce((a, p) => a + p[0], 0) / s.pts.length;
      const i = Math.min(n - 1, Math.max(0, Math.floor(cx * n)));
      out[i].push(s.pts.map((p) => [p[0] * r.width, p[1] * r.height]));
    });
    return out;
  },

  /** Gemini에 보낼 그림: 흰 바탕 · 검은 글씨 · 칸 줄 없이, 작게 */
  png() {
    const r = this.canvas.getBoundingClientRect();
    const h = 96;
    const w = Math.round((r.width / r.height) * h);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#000';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = 4;
    this.ink().strokes.forEach((s) => {
      g.beginPath();
      s.pts.forEach((p, i) => (i ? g.lineTo(p[0] * w, p[1] * h) : g.moveTo(p[0] * w, p[1] * h)));
      g.stroke();
    });
    return c.toDataURL('image/png');
  },

  /** 손풀이 과정 저장용 (작게 줄여서) */
  record(result) {
    const ink = this.ink();
    return {
      strokes: ink.strokes.map((s) => ({ type: s.type, t0: s.pts[0][2], pts: s.pts.map((p) => [Math.round(p[0] * 1000), Math.round(p[1] * 1000), p[2] - s.pts[0][2]]) })),
      erases: ink.log.erases,
      undos: ink.log.undos,
      clears: ink.log.clears,
      pauses: ink.log.pauses,
      ...result,
    };
  },
};

window.addEventListener('resize', () => Pencil.resize());

/**
 * "다 썼어요!" → 읽기
 *  1) 기기 안에서 읽어서 확실하면 바로 답으로
 *  2) 아니면 Gemini에게 (칸 수와 맞는 확실한 답이면 바로 답으로)
 *  3) 그래도 아니면 후보를 보여 주고 아이가 골라요.
 */
async function pencilSubmit() {
  const parts = quizParts();
  const { q, p } = parts;
  const ink = q.ink;
  if (!ink || !ink.strokes.length || ink.reading) return;
  const n = pencilCells(p);
  const local = recognizeNumber(Pencil.cells(n));
  if (local.empty) {
    ink.note = `칸 ${n}개에 숫자를 하나씩 써 주세요.`;
    return render();
  }
  if (local.sure) return pencilAccept(local.text, 'local', local);

  ink.reading = true;
  ink.note = '읽는 중이에요… 👀';
  render();
  const remote = await recognizeRemote(Pencil.png(), 'digits', n);
  ink.reading = false;
  ink.note = '';
  if (State.quiz !== q || q.checked) return;
  const ok = (remote || []).filter((c) => /^\d+$/.test(c.text) && c.text.length === n);
  if (ok.length && ok[0].confidence >= 0.85 && (ok[0].text === local.text || !ok[1] || ok[1].confidence < 0.5)) return pencilAccept(ok[0].text, 'gemini', local);
  ink.cands = [...new Set([...ok.map((c) => c.text), ...local.candidates])].slice(0, 3);
  ink.via = remote ? 'gemini' : 'local';
  render();
}

function pencilAccept(text, via, local) {
  const q = State.quiz;
  const { p } = quizParts();
  // 읽은 수가 정답이 아니면 바로 채점하지 않아요. 아이가 "맞아"를 눌러야 그 답으로 채점해요.
  // (잘못 읽어서 오답이 되는 일이 없게)
  if (via !== 'picked' && !judge(p, { kind: 'number', value: Number(text) })) {
    q.ink.cands = [...new Set([text, ...((local && local.candidates) || [])])].slice(0, 3);
    q.ink.via = via;
    return render();
  }
  q.inkSave = Pencil.record({ read: text, via, local: local && local.text });
  q.typed = String(Number(text));
  submitAnswer();
}

(function bindPencil() {
  document.getElementById('app').addEventListener('click', (ev) => {
    const q = State.quiz;
    if (!q || State.screen !== 'quiz' || !q.ink) return;
    const t = ev.target.closest('[data-pc-tool]');
    if (t) {
      q.ink.tool = t.dataset.pcTool;
      return render();
    }
    if (ev.target.closest('[data-pc-undo]')) return Pencil.undo(), render();
    if (ev.target.closest('[data-pc-clear]')) return Pencil.clear(), render();
    if (ev.target.closest('[data-pc-rewrite]')) {
      Pencil.clear();
      q.ink.tool = 'pen';
      return render();
    }
    const pick = ev.target.closest('[data-pc-pick]');
    if (pick) {
      q.ink.cands = null;
      return pencilAccept(pick.dataset.pcPick, 'picked');
    }
  });
})();
