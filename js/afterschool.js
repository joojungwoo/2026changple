/* =========================================================================
 * afterschool.js — 방과후교실 (자율 복습)
 *
 *  - 수학 · 국어에서 이미 사귄 친구들이 교실 바닥 칸을 따라 가로 · 세로로만 돌아다녀요.
 *  - 친구를 누르면 "나와 또 놀고 싶구나!" 같은 말(돌아가며 다양하게)을 하고, 그 단원을 복습할 수 있어요.
 *  - 자율 복습은 소단원마다 3문제, 한 번에 최대 10문제. 복습 날짜(느낌표)와는 따로예요.
 * ========================================================================= */

const AFTER_COLS = 7;
const AFTER_ROWS = 8;
const AFTER_CELL = 64; // 무대 너비 448 = 7칸

const AfterSchool = {
  timer: null,
  pos: {}, // chapterId → { c, r, dir }

  /** 사귄 친구들 (단원마다 한 명) */
  friends() {
    const data = Store.getData();
    return Object.entries(data.friends || {})
      .map(([chId, f]) => ({ ch: CHAPTER_BY_ID[chId], friend: friendById(chapterFriendId(chId, f.friendId)) }))
      .filter((x) => x.ch)
      .sort((a, b) => SUBJECT_ORDER.indexOf(a.ch.subject) - SUBJECT_ORDER.indexOf(b.ch.subject) || CHAPTERS.indexOf(a.ch) - CHAPTERS.indexOf(b.ch));
  },

  /** 처음 자리: 겹치지 않게 칸을 나눠 줘요. */
  place(list) {
    const taken = new Set(Object.values(this.pos).map((p) => `${p.c},${p.r}`));
    list.forEach((x, i) => {
      if (this.pos[x.ch.id]) return;
      for (let k = 0; k < AFTER_COLS * AFTER_ROWS; k++) {
        const cell = (i * 11 + k * 5) % (AFTER_COLS * AFTER_ROWS);
        const c = cell % AFTER_COLS;
        const r = Math.floor(cell / AFTER_COLS);
        if (!taken.has(`${c},${r}`)) {
          taken.add(`${c},${r}`);
          this.pos[x.ch.id] = { c, r, dir: 'down' };
          break;
        }
      }
    });
  },

  /** 한 걸음: 친구마다 위 · 아래 · 왼쪽 · 오른쪽 중 하나로 한 칸 (가끔은 가만히) */
  step() {
    const ids = Object.keys(this.pos);
    const taken = new Set(ids.map((id) => `${this.pos[id].c},${this.pos[id].r}`));
    const moves = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    ids.forEach((id) => {
      if (Math.random() < 0.35) return;
      const p = this.pos[id];
      const dirs = Object.keys(moves).sort(() => Math.random() - 0.5);
      for (const d of dirs) {
        const c = p.c + moves[d][0];
        const r = p.r + moves[d][1];
        if (c < 0 || r < 0 || c >= AFTER_COLS || r >= AFTER_ROWS || taken.has(`${c},${r}`)) continue;
        taken.delete(`${p.c},${p.r}`);
        taken.add(`${c},${r}`);
        Object.assign(p, { c, r, dir: d });
        const el = document.querySelector(`[data-a-friend="${id}"]`);
        if (el) {
          el.style.left = `${c * AFTER_CELL}px`;
          el.style.top = `${r * AFTER_CELL}px`;
          el.dataset.dir = d;
        }
        break;
      }
    });
  },

  start() {
    this.stop();
    if (document.body.dataset.anim === 'off' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.timer = setInterval(() => {
      if (State.screen !== 'after') return this.stop();
      if (!State.sheet) this.step();
    }, 1100);
  },
  stop() {
    clearInterval(this.timer);
    this.timer = null;
  },
};

function screenAfter() {
  const list = AfterSchool.friends();
  AfterSchool.place(list);
  const kids = list
    .map((x) => {
      const p = AfterSchool.pos[x.ch.id];
      return `<button type="button" class="af-kid" data-a-friend="${x.ch.id}" data-dir="${p.dir}" style="left:${p.c * AFTER_CELL}px;top:${p.r * AFTER_CELL}px" aria-label="${esc(x.friend.name)}랑 놀기 (${esc(getSubject(x.ch.subject).name)} · ${esc(x.ch.title)})">
          ${faceImg(x.friend, 'af-sprite')}
          <span class="af-name">${esc(x.friend.name)}</span>
        </button>`;
    })
    .join('');
  const empty = list.length
    ? ''
    : `<div class="af-empty"><b>아직 사귄 친구가 없어요</b><p>수학 · 국어 교실에서 친구를 사귀면\n여기서 같이 놀 수 있어요!</p></div>`;
  return `<div class="af-wrap">
      <header class="af-head"><h1>방과후교실</h1><p>친구를 누르면 같이 복습할 수 있어요</p></header>
      <div class="af-floor" style="width:${AFTER_COLS * AFTER_CELL}px;height:${AFTER_ROWS * AFTER_CELL + 14}px">${kids}${empty}</div>
    </div>
    <div class="s-fixed-back">${backBtn('data-go="home"')}</div>
    ${State.sheet && State.sheet.kind === 'after' ? afterSheet() : ''}`;
}

function afterSheet() {
  const sh = State.sheet;
  const ch = CHAPTER_BY_ID[sh.chapterId];
  const f = friendById(sh.friendId);
  return `<div class="s-overlay" data-backdrop>
    <section class="s-sheet" role="dialog" aria-modal="true" aria-label="${esc(f.name)}랑 놀기">
      ${faceImg(f)}
      <div class="s-sheet-bubble"><b>${esc(f.name)}</b><p>${esc(fillLine(sh.line, { student: studentName(), friend: f }))}</p><small class="af-unit">${esc(getSubject(ch.subject).name)} · ${esc(ch.title)}</small></div>
      <div class="s-sheet-btns">
        <button type="button" class="s-bar" data-a-play="${sh.chapterId}">그래, 같이 놀자!</button>
        <button type="button" class="s-bar ghost" data-close-sheet>다음에</button>
      </div>
    </section>
  </div>`;
}

(function bindAfter() {
  const root = document.getElementById('app');
  let lastLine = '';
  root.addEventListener('click', (ev) => {
    const kid = ev.target.closest('[data-a-friend]');
    if (kid && State.screen === 'after') {
      const id = kid.dataset.aFriend;
      const x = AfterSchool.friends().find((y) => y.ch.id === id);
      if (!x) return;
      // 같은 말이 연달아 나오지 않게 돌아가며 골라요.
      const pool = AFTERSCHOOL_LINES.filter((l) => l !== lastLine);
      lastLine = pickOne(pool);
      return setSheet({ kind: 'after', chapterId: id, friendId: x.friend.id, line: lastLine });
    }
    const play = ev.target.closest('[data-a-play]');
    if (play) {
      State.sheet = null;
      AfterSchool.stop();
      return Sim.open(play.dataset.aPlay, 'free');
    }
  });
})();
