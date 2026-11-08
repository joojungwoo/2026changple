/* =========================================================================
 * afterschool.js — 방과후교실 (자율 복습)
 *
 *  - 수학 · 국어에서 이미 사귄 친구들이 방과후교실 책상에 앉아 있어요. (돌아다니지 않아요)
 *  - 친구를 누르면 "나와 또 놀고 싶구나!" 같은 말(돌아가며 다양하게)을 하고, 그 단원을 복습할 수 있어요.
 *  - 자율 복습은 소단원마다 3문제, 한 번에 최대 10문제. 복습 날짜(느낌표)와는 따로예요.
 * ========================================================================= */

/** 방과후교실 그림 (assets/school/after/room.jpg, 너비 1021) — 책상 9개.
 *  [의자 가운데 x, 의자 위 y, 책상 앞 그림 left, top, right, bottom]
 *  위 세 자리는 원래 그림의 책상이고, 친구가 늘면 아래로 책상이 이어져요. */
const AFTER_W = 1021;
const AFTER_DESKS = [[326, 532, 190, 580, 450, 815], [724, 740, 585, 793, 855, 1035], [304, 1002, 160, 1055, 445, 1315], [724, 1240, 588, 1288, 848, 1523], [326, 1480, 190, 1528, 450, 1763], [724, 1720, 588, 1768, 848, 2003], [326, 1960, 190, 2008, 450, 2243], [724, 2200, 588, 2248, 848, 2483], [326, 2440, 190, 2488, 450, 2723]];
const AFTER_IMG = 'assets/school/after/';

const AfterSchool = {
  /** 사귄 친구들 (단원마다 한 명) */
  friends() {
    const data = Store.getData();
    return Object.entries(data.friends || {})
      .map(([chId, f]) => ({ ch: CHAPTER_BY_ID[chId], friend: friendById(chapterFriendId(chId, f.friendId)) }))
      .filter((x) => x.ch)
      .sort((a, b) => SUBJECT_ORDER.indexOf(a.ch.subject) - SUBJECT_ORDER.indexOf(b.ch.subject) || CHAPTERS.indexOf(a.ch) - CHAPTERS.indexOf(b.ch));
  },
};

function screenAfter() {
  const list = AfterSchool.friends().slice(0, AFTER_DESKS.length);
  const used = Math.max(3, list.length);
  const H = Math.max(1540, AFTER_DESKS[used - 1][5] + 90);
  const kids = list
    .map((x, i) => {
      const [cx, , l, t, r, b] = AFTER_DESKS[i];
      const look = friendLook(x.friend);
      const img = look.px
        ? `<img src="${look.px}" class="af-kid-img px" alt="" draggable="false">`
        : `<img src="${look.sprite}" class="af-kid-img" alt="" draggable="false">`;
      return `<button type="button" class="af-seat" data-a-friend="${x.ch.id}" style="left:${l}px;top:${t - 250}px;width:${r - l}px;height:${b - t + 250}px" aria-label="${esc(x.friend.name)}랑 놀기 (${esc(getSubject(x.ch.subject).name)} · ${esc(x.ch.title)})">
          <span class="af-kid" style="left:${cx - l}px">${img}</span>
          <img src="${AFTER_IMG}front-${i + 1}.png" class="af-front" alt="" draggable="false">
          <span class="af-name">${esc(x.friend.name)}</span>
        </button>`;
    })
    .join('');
  const empty = list.length
    ? ''
    : `<div class="af-empty"><b>아직 사귄 친구가 없어요</b><p>수학 · 국어 교실에서 친구를 사귀면\n여기 책상에 앉아 있을 거예요!</p></div>`;
  return `<div class="af-wrap">
      <div class="af-room" style="height:${H}px" role="group" aria-label="방과후교실">
        ${kids}${empty}
      </div>
    </div>
    ${list.length ? '<p class="af-hint">친구를 누르면 같이 복습할 수 있어요</p>' : ''}
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
      return Sim.open(play.dataset.aPlay, 'free');
    }
  });
})();
