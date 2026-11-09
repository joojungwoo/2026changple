/* =========================================================================
 * school.js — 학교 화면 (포스터 디자인 그대로)
 *
 *   복도(홈)   과목마다 교실 문 하나. 빨간 화살표가 오늘 갈 교실을 가리켜요.
 *   교실       대단원 = 친구의 자리. 책상 · 캐릭터 모습으로 네 가지 상태를 보여 줘요.
 *                반짝이는 빈자리(지금 배울 단원) · 느낌표 친구(복습할 때) · 앉아 있는 친구(배운 단원) · 자물쇠(아직)
 *   대화       친구 큰 그림 + 이름표 대화 상자 + ▶ / 선택지 / 개념 카드
 *   문제       체크무늬 배경 · 문제 카드 · 소리 버튼 · 숫자↔블록 · 힌트 · 색 카드 3장 · 제출하기
 *   친구 완성  단원을 마치면 친구가 돼요.
 *
 *  화면 좌표는 포스터(1190×1684)의 절반 크기 무대(595×842)에 맞췄어요. (css/school.css)
 *  학생 화면에는 학년 · 학기를 보여 주지 않아요. (보고서 2.2.6 나)
 * ========================================================================= */

const SCH = 'assets/school/';
/** 학생 이름 (대사에 넣을 때) */
function studentName() {
  const u = Store.currentUser();
  return (u && (u.nick || u.name)) || '친구';
}
const SUBJECT_ORDER = ['math', 'korean'];

/** 화면 크기 → 무대 배율 */
const SchoolStage = {
  update() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const col = Math.min(w, h * 0.75);
    document.documentElement.style.setProperty('--su', String(Math.min(w / 595, h / 842)));
    document.documentElement.style.setProperty('--ru', String(col / 512));
    document.documentElement.style.setProperty('--ch', String(h / 768));
  },
};
window.addEventListener('resize', () => SchoolStage.update());
SchoolStage.update();

const sImg = (src, cls, alt) => `<img src="${src}" class="${cls || ''}" alt="${alt || ''}" ${alt ? '' : 'aria-hidden="true"'} draggable="false">`;

function roundBtn(attrs, inner, label) {
  return `<button type="button" class="s-round" ${attrs} aria-label="${label}">${inner}</button>`;
}
const backBtn = (attrs) => roundBtn(attrs, sImg(`${SCH}arrow-left.png`, 's-round-ico'), '뒤로 가기');
const restBtn = () => `<button type="button" class="s-rest" data-s-rest>잠깐 쉬는 시간!</button>`;

/* ============================== 진행 상황 ============================== */
/** 하던 이야기 (예전 버전으로 저장된 것은 새로 시작하니까 '이어서'로 보지 않아요) */
function freshSim(key) {
  const x = Store.sim(key);
  return x && x.v === SIM_VER ? x : null;
}

const School = {
  /** 이 과목의 교실에 앉는 단원들 (이미 친구가 된 예전 단원 + 지금 학습 수준의 단원) */
  roomList(subject) {
    const place = Store.placementOf();
    const lv = place ? place[subject] : firstLevelOf(subject, 1);
    const data = Store.getData();
    const friends = data.friends || {};
    const cur = levelChapters(subject, lv);
    const curIds = new Set(cur.map((c) => c.id));
    const older = CHAPTERS.filter((c) => c.subject === subject && friends[c.id] && !curIds.has(c.id));
    const today = todayStr();
    let currentGiven = false;
    const seats = [...older, ...cur].map((ch) => {
      const f = friends[ch.id];
      let state;
      if (f) state = f.next && f.next <= today ? 'review' : 'done';
      else if (!currentGiven && curIds.has(ch.id)) (state = 'current'), (currentGiven = true);
      else state = 'locked';
      return { ch, state, friend: f ? friendById(chapterFriendId(ch.id, f.friendId)) : null, sim: freshSim(ch.id) };
    });
    const allDone = cur.length > 0 && cur.every((c) => friends[c.id]);
    return { lv, seats, allDone, next: allDone ? nextLevel(subject, lv) : null };
  },

  /** 복도에서 화살표로 가리킬 교실: 복습 → 하던 것 → 친구가 적은 과목 */
  recommend() {
    const rooms = SUBJECT_ORDER.map((s) => ({ s, r: this.roomList(s) }));
    const due = rooms.find((x) => x.r.seats.some((t) => t.state === 'review'));
    if (due) return due.s;
    const going = rooms.find((x) => x.r.seats.some((t) => t.state === 'current' && t.sim));
    if (going) return going.s;
    return rooms.sort((a, b) => a.r.seats.filter((t) => t.friend).length - b.r.seats.filter((t) => t.friend).length)[0].s;
  },
};

/* ============================== 복도 (홈) ============================== */
function screenCorridor() {
  const rec = School.recommend();
  // 문 그림(assets/school/home.jpg) 순서: 수학 · 국어 · 방과후. 과목 이름은 그림에 적혀 있어요.
  const doors = SUBJECT_ORDER.map((id, i) => {
    const subj = getSubject(id);
    const room = School.roomList(id);
    const due = room.seats.filter((t) => t.state === 'review').length;
    return `<div class="cor-tile t${i}">
      <button type="button" class="cor-door" data-s-room="${id}" aria-label="${subj.name} 교실로 들어가기${due ? ` (기다리는 친구 ${due}명)` : ''}"></button>
      <button type="button" class="cor-sign" data-s-room="${id}" tabindex="-1" aria-hidden="true"></button>
      ${id === rec ? '<span class="cor-arrow" aria-hidden="true"></span>' : ''}
      ${due ? `<span class="cor-due" aria-hidden="true">${sImg(`${SCH}bubble.png`)}</span>` : ''}
    </div>`;
  }).join('');
  return `<div class="cor" id="corridor">
      <div class="cor-strip"><div class="cor-home">${doors}<div class="cor-tile t2">
        <button type="button" class="cor-door" data-go="after" aria-label="방과후교실로 들어가기 (사귄 친구들과 복습)"></button>
        <button type="button" class="cor-sign" data-go="after" tabindex="-1" aria-hidden="true"></button>
      </div></div></div>
    </div>
    <div class="s-top-right">
      ${roundBtn('data-go="settings"', '<span class="s-round-txt">⚙</span>', '설정')}
      ${roundBtn('data-logout', '<span class="s-round-txt">⏏</span>', '로그아웃')}
    </div>
    <button type="button" class="s-round s-cor-next" data-s-cor-next aria-label="옆 교실 보기">${sImg(`${SCH}arrow-left.png`, 's-round-ico flip')}</button>`;
}

/* ============================== 교실 ============================== */
const ROOM_TOP = 258; // 첫 책상 자리 (교실 그림 좌표, 너비 512)
const ROOM_STEP = 128;

function screenRoom() {
  const subject = State.subject;
  const room = School.roomList(subject);
  const n = room.seats.length;
  const H = ROOM_TOP + n * ROOM_STEP + (room.next ? 150 : 90);
  const seats = room.seats
    .map((t, i) => {
      const left = i % 2 === 0 ? 74 : 300;
      const top = ROOM_TOP + i * ROOM_STEP;
      const look = t.friend ? friendLook(t.friend) : null;
      let who = '';
      if (t.state === 'current') who = `${sImg(`${SCH}sparkle.png`, 'seat-sparkle')}${sImg(`${SCH}ghost.png`, 'seat-person ghost glow')}`;
      else if (t.state === 'locked') who = sImg(`${SCH}ghost.png`, 'seat-person ghost dim');
      else who = `${deskImg(t.friend, 'seat-person')}${t.state === 'review' ? sImg(`${SCH}bubble.png`, 'seat-bubble') : ''}`;
      const label =
        t.state === 'current' ? `새 친구를 만나요: ${t.ch.title}${t.sim ? ' (이어서 하기)' : ''}` :
        t.state === 'review' ? `${josa(t.friend.name, '이', '가')} 기다려요: ${t.ch.title}` :
        t.state === 'done' ? `친구 ${t.friend.name}: ${t.ch.title}` : '아직 열리지 않은 자리';
      return `<button type="button" class="seat seat-${t.state}" style="left:${left}px;top:${top}px" data-s-seat="${t.ch.id}" aria-label="${esc(label)}">
          <span class="seat-who">${who}</span>
          ${sImg(`${SCH}${t.state === 'locked' ? 'desk-locked' : 'desk'}.png`, 'seat-desk')}
          ${t.state === 'current' && t.sim ? '<span class="seat-tag"><span class="sr-only">이어서</span></span>' : ''}
        </button>`;
    })
    .join('');
  const talk = State.roomSay
    ? `<div class="room-say" style="left:${State.roomSay.left}px;top:${State.roomSay.top}px" role="status">${esc(State.roomSay.text)}</div>`
    : '';
  return `<div class="room-wrap">
      <div class="room" style="height:${H}px">
        ${sImg(`${SCH}room-top.png`, 'room-top')}
        ${seats}
        ${talk}
        ${room.next ? `<button type="button" class="room-next" data-s-next-room style="top:${H - 120}px">다음 교실로 가기 ▶</button>` : ''}
      </div>
    </div>
    <div class="s-fixed-back">${backBtn('data-go="home"')}</div>
    ${State.sheet && State.sheet.kind === 'reunion' ? reunionSheet() : ''}`;
}

/** 느낌표 친구를 누르면: 재회 요청 */
function reunionSheet() {
  const sh = State.sheet;
  const f = friendById(sh.friendId);
  return `<div class="s-overlay" data-backdrop>
    <section class="s-sheet" role="dialog" aria-modal="true" aria-label="${esc(f.name)}의 재회 요청">
      ${faceImg(f)}
      <div class="s-sheet-bubble"><b>${esc(f.name)}</b><p>${esc(fillLine(sh.line, { student: studentName(), friend: f }))}</p></div>
      <div class="s-sheet-btns">
        <button type="button" class="s-bar" data-s-review="${sh.chapterId}">그래, 같이 하자!</button>
        <button type="button" class="s-bar ghost" data-close-sheet>다음에</button>
      </div>
    </section>
  </div>`;
}

/* ============================== 대화 ============================== */
/** 대화 배경 (assets/school/bg/) — 이야기에서 { bg: '…' }로 바꿔요. */
const TALK_BGS = ['classroom', 'playground', 'library', 'school', 'gate', 'stairs', 'storage', 'videoroom', 'preproom', 'festival'];

function portraitHtml(f, mood) {
  const look = friendLook(f);
  if (look.portrait) return sImg(look.portrait, `talk-portrait big mood-${mood || 'normal'}`);
  return `<img src="${look.sprite}" class="talk-portrait sprite mood-${mood || 'normal'}" alt="" aria-hidden="true" draggable="false"${look.tint ? ` style="filter:${look.tint}"` : ''}>`;
}

function screenTalk() {
  const s = Sim.s;
  const n = Sim.node();
  if (!s || !n) return '';
  const ctx = Sim.ctx();
  // 말하는 친구: 장면에 적힌 친구(다른 친구가 끼어들 때) → 이 단원 친구
  const f = n.who ? friendById(n.who) : Sim.friend();
  let text = fillLine(n.t === 'choice' ? n.say : n.text || '', ctx);
  // 괄호로만 된 글은 상황 설명이에요. (선택지 질문도)
  const narr = n.t === 'narr' || (n.t === 'choice' && /^\(.*\)$/s.test(text.trim()));
  const showPerson = n.t !== 'card' && (!narr || n.who || (n.t === 'choice' && !/^\(.*\)$/s.test(text.trim())));
  let over = '';
  if (n.t === 'card') {
    over = `<button type="button" class="s-speaker card-speaker" data-read-talk aria-label="설명 읽어 주기">${sImg(`${SCH}btn-speaker.png`)}</button>
    <section class="talk-card">
      <div class="talk-card-ico" aria-hidden="true">${esc(n.icon)}</div>
      <h2>${esc(n.title)}</h2>
      <p data-read>${nl(n.text)}</p>
    </section>`;
    text = n.again ? `"${n.title}"을(를) 다시 쉽게 볼게. 그림을 잘 봐!` : `"${n.title}"! 내가 알려 줄게. 위 카드를 같이 보자.`;
  }
  let choices = '';
  if (n.t === 'choice') {
    choices = `<div class="talk-choices" role="group" aria-label="어떻게 말할까?">
      ${n.options.map((o, i) => ((o.if && !storyCond(o.if, ctx.flags)) || (n.gone || []).includes(i) ? '' : `<button type="button" class="talk-choice" data-s-choice="${i}">${esc(fillLine(o.text, ctx))}</button>`)).join('')}
    </div>`;
  }
  const mood = n.mood || (n.t === 'choice' ? null : null);
  const bg = TALK_BGS.includes(s.bg) ? s.bg : 'classroom';
  return `<div class="s-bg bg-${bg}" aria-hidden="true"></div>
    <div class="sst-wrap"><div class="sst talk">
      ${restBtn()}
      ${n.t === 'card' ? '' : `<div class="talk-person ${showPerson ? '' : 'away'} ${n.t === 'choice' ? 'choosing' : ''}">${portraitHtml(f, mood)}</div>`}
      ${over}
      ${choices}
      <section class="talk-box ${narr ? 'narr' : ''} ${n.tip ? 'tip' : ''}" ${n.t === 'choice' ? '' : 'data-s-next'}>
        <span class="talk-name">${n.tip ? '💡 도움말' : narr ? '' : esc(f.name)}</span>
        <p class="talk-text" data-read>${nl(text)}</p>
        ${Sim.canBack() ? '<button type="button" class="talk-prev" data-s-prev aria-label="앞 대사 다시 보기"></button>' : ''}
        ${n.t === 'choice' ? '' : '<span class="talk-arrow" aria-hidden="true"></span>'}
      </section>
      ${n.t === 'choice' ? '' : '<button type="button" class="sr-only" data-s-next>다음</button>'}
    </div></div>
    ${State.sheet && State.sheet.kind === 'rest' ? restSheet() : ''}
    ${State.sheet && State.sheet.kind === 'welcome' ? welcomeSheet() : ''}`;
}

/** 하던 이야기로 돌아왔을 때: 나갈 때 인사와 같은 모양의 팝업 */
function welcomeSheet() {
  const f = Sim.friend();
  return `<div class="s-overlay">
    <section class="s-sheet" role="dialog" aria-modal="true" aria-label="다시 왔어요">
      ${faceImg(f)}
      <div class="s-sheet-bubble"><b>${esc(f.name)}</b><p>${esc(fillLine(State.sheet.line, Sim.ctx()))}</p></div>
      <div class="s-sheet-btns">
        <button type="button" class="s-bar" data-s-resume>응! 이어서 하자</button>
      </div>
    </section>
  </div>`;
}

/** 팝업 · 자리에 쓰는 친구 작은 그림 (색을 바꾼 친구는 tint) */
function faceImg(f, cls) {
  const look = friendLook(f);
  return `<img src="${look.sprite}" class="${cls || 's-sheet-face'}" alt="" aria-hidden="true" draggable="false"${look.tint ? ` style="filter:${look.tint}"` : ''}>`;
}

/** 책상에 앉은 모습: 작은 픽셀 그림이 있으면 그걸 써요. */
function deskImg(f, cls) {
  const look = friendLook(f);
  if (!look.px) return faceImg(f, cls);
  return `<img src="${look.px}" class="${cls} px${look.soft ? ' soft' : ''}" alt="" aria-hidden="true" draggable="false">`;
}

function restSheet() {
  const f = Sim.friend();
  return `<div class="s-overlay">
    <section class="s-sheet" role="dialog" aria-modal="true" aria-label="잠깐 쉬는 시간">
      ${faceImg(f)}
      <div class="s-sheet-bubble"><b>${esc(f.name)}</b><p>${esc(State.sheet.line || REST_LINES[0])}</p></div>
      <div class="s-sheet-btns">
        <button type="button" class="s-bar" data-s-resume>다 쉬었어! 이어서 하기</button>
        <button type="button" class="s-bar ghost" data-s-leave>교실로 나가기</button>
      </div>
    </section>
  </div>`;
}

/** 소리 도움 모드: 대사를 읽어 줘요. */
function talkAfterRender() {
  if (State.screen !== 'talk' || !Sim.s) return;
  const key = `${Sim.s.key}:${Sim.s.qi}`;
  if (State.talkRead === key) return;
  State.talkRead = key;
  if (!Profile.mode().autoRead || State.sheet) return;
  readTalk();
}

/** 지금 대사(개념 카드 · 선택지 포함)를 친구 목소리로 읽어요. */
function readTalk() {
  const n = Sim.node();
  const parts = [];
  const main = Sim.friend();
  const who = n && n.who ? friendById(n.who) : main;
  const narrNode = n && n.t === 'narr';
  Speech.voice = main.voice || null;
  const card = document.querySelector('.talk-card p');
  if (card) parts.push({ text: card.textContent, el: card });
  const t = document.querySelector('.talk-text');
  if (t) parts.push({ text: t.textContent, el: t, voice: narrNode && !n.who ? null : who.voice || null });
  if (n && n.t === 'choice') document.querySelectorAll('.talk-choice').forEach((b, i) => parts.push({ text: `${i + 1}번, ${b.textContent}`, el: b }));
  Speech.read(parts);
}

/* ============================== 문제 ============================== */
const CARD_COLORS = 3;

/** 시뮬레이션의 문제 장면 → 문제 화면 */
function startSimQuiz(q, node) {
  const item = { ...q };
  // 보기 순서를 섞어요 (외워서 맞히지 않게). 이야기 속 문제는 그대로.
  if (!q.story) {
    const r = genRng((Date.now() % 100000) + 7);
    const order = r.shuffle(q.choices.map((_, i) => i));
    item.choices = order.map((i) => q.choices[i]);
    item.answer = order.indexOf(q.answer);
    if (q.why) item.why = order.map((i) => q.why[i]);
  }
  go('quiz', {
    quiz: {
      mode: node.test ? 'test' : 'sim',
      node,
      orig: q,
      questions: [item],
      index: 0,
      results: [],
      startedAt: Date.now(),
      rep: null,
      hintLv: 0,
      elim: null,
      say: null,
      ...freshQuestionState(),
    },
  });
}

function repLabel(p, id) {
  return { numbers: p.math ? '숫자' : '글자', pictures: '그림', blocks: '블록', listen: '듣기' }[id];
}

/** 표현 바꾸기 단추: 숫자(글자) · 블록 · 듣기를 문제 화면에서 바로 골라요. (설정 화면에서 옮겨 왔어요) */
function repSwitch(p, rep) {
  const ids = ['numbers', 'blocks', 'listen'].filter((id) => REPS[id].supports(p));
  if (ids.length < 2) return '';
  return `<div class="q-reps" role="radiogroup" aria-label="문제 보는 방법">${ids
    .map((id) => `<button type="button" role="radio" aria-checked="${id === rep}" class="s-chip ${id === rep ? 'on' : ''}" data-s-rep="${id}">${repLabel(p, id)}</button>`)
    .join('')}</div>`;
}

function quizCardsHtml(parts) {
  const { q, item } = parts;
  const tried = new Set(q.tries.map((t) => t.index));
  const long = item.choices.some((c) => [...c].length > 7 || c.includes('\n'));
  return `<div class="ans ${long ? 'long' : ''} n${item.choices.length}">
    ${item.choices
      .map((c, i) => {
        const shape = shapeKind(c);
        let cls = `ans-card ${shape ? `shape shape-${shape}` : `c${i % CARD_COLORS}`}`;
        let mark = '';
        if (q.checked) {
          if (i === item.answer) (cls += ' right'), (mark = '<span class="ans-mark">⭐</span>');
          else cls += ' dim';
        } else if (tried.has(i)) (cls += ' tried'), (mark = '<span class="ans-mark">🤔</span>');
        else if (q.elim && q.elim.includes(i)) (cls += ' tried'), (mark = '<span class="ans-mark">✖</span>');
        else if (q.selected === i) cls += ' on';
        const off = q.checked || tried.has(i) || (q.elim && q.elim.includes(i));
        const len = [...c].length;
        return `<button type="button" class="${cls}" data-s-pick="${i}" ${off ? 'disabled' : ''}>
          <span class="ans-text ${len > 12 ? 'xs' : len > 4 ? 'sm' : ''}" data-read>${shapeColorize(nl(c))}</span>${mark}
        </button>`;
      })
      .join('')}
  </div>`;
}

function screenQuiz() {
  const parts = quizParts();
  const { q, item, p, rep, input } = parts;
  const s = Sim.s;
  const f = Sim.friend();
  const test = q.mode === 'test';
  const hintAllowed = !test && (item.hint || item.steps);
  const ready = input === 'pencil' ? !!(q.ink && q.ink.strokes.length) && !q.ink.reading : !!quizResponse(parts);

  // 카드 안: 그림 / 식 / 블록 + 문제 글. 2단계 힌트에서는 풀이 단계를 보여 줘요.
  const showSteps = q.hintLv >= 2 || q.checked;
  const body = REPS[rep === 'listen' ? 'numbers' : rep].render(p, { checked: showSteps });
  let bubble = '';
  // 레벨 테스트에는 친구가 나오지 않아요.
  if (q.say) bubble = `<div class="q-say ${q.say.kind || ''} ${test ? 'noname' : ''}" role="status">${test ? '' : `<b>${esc(f.name)}</b>`}<span data-read>${shapeColorize(nl(q.say.text))}</span></div>`;

  let action;
  if (q.checked && !q.correct && !test) action = `<button type="button" class="s-submit" data-s-after>알겠어!</button>`;
  else if (q.checked) action = `<button type="button" class="s-submit" disabled>${test ? '좋아!' : '맞았어!'}</button>`;
  else action = `<button type="button" class="s-submit" data-submit ${ready ? '' : 'disabled'}>${input === 'pencil' ? '다 썼어요!' : '제출하기'}</button>`;

  const progress = test
    ? `<div class="q-hunt-head" role="status"><span aria-hidden="true">🗺️</span> 안내도 조각 ${(s.k || 0) + 1} · 문제 <b>${(s.j || 0) + 1}/${HUNT_PER}</b></div>`
    : '';

  // 배경: 지금 이야기 장소(친구와 같은 곳) · 레벨 테스트는 조각을 찾은 곳
  const qbg = test && s ? `" style="background-image:url('${HUNT_BG[huntPlaceOf(s)]}')` : s && TALK_BGS.includes(s.bg) ? ` bg-${s.bg}` : ' bg-check';
  return `<div class="s-bg q-scene${qbg}" aria-hidden="true"></div>
    <div class="sst-wrap"><div class="sst quiz${test ? ' is-test' : ''}">
      ${restBtn()}
      ${progress}
      <section class="q-card rep-${rep}">
        <button type="button" class="s-speaker" data-read-problem aria-label="문제 읽어 주기">${sImg(`${SCH}btn-speaker.png`)}</button>
        <div class="q-body quiz-problem">${body}</div>
        ${test ? '' : faceImg(f, 'q-friend')}
        ${bubble}
      </section>
      <div class="q-tools">
        ${hintAllowed && !q.checked ? `<button type="button" class="s-chip ${q.hintLv ? 'on' : ''}" data-s-hint ${q.hintLv >= 2 ? 'disabled' : ''}>힌트${q.hintLv ? ` ${q.hintLv}` : ''}</button>` : ''}
      </div>
      <div class="q-work quiz-work">
        ${input === 'pencil' ? `<div class="q-pencil">${inputPencil(parts)}</div>` : input === 'numpad' ? inputNumpad(parts) : quizCardsHtml(parts)}
      </div>
      ${action}
    </div></div>
    ${State.sheet && State.sheet.kind === 'rest' ? restSheet() : ''}
    ${State.sheet && State.sheet.kind === 'welcome' ? welcomeSheet() : ''}`;
}

/** 쉬는 시간 인사 */
const REST_LINES = [
  '잠깐 쉬자! 물 한 모금 마시고 기지개도 쭉~ 켜 봐.\n하던 곳은 내가 기억해 둘게!',
  '쉬는 시간이다! 눈 감고 숨 크게 한 번 쉬어 봐. 후~\n다녀오면 여기서 기다릴게!',
  '우리 열심히 했다! 잠깐 쉬었다 하자.\n어디까지 했는지 내가 꼭 기억할게.',
  '손목 빙글빙글, 어깨 으쓱으쓱~ 몸 풀고 와!\n돌아오면 바로 이어서 하자!',
];

/**
 * 힌트: 1단계 = 친구가 말해 주는 짧은 힌트
 *       2단계 = 풀이 단계가 있으면 "위에 적어 뒀어", 없으면 친구가 헷갈리는 척하며 오답 하나를 지워요.
 */
function useHint() {
  const q = State.quiz;
  const item = q.questions[0];
  if (q.checked || q.hintLv >= 2) return;
  q.hintLv += 1;
  q.hintUsed = true;
  if (q.hintLv === 1) q.say = { kind: 'hint', text: `💡 ${item.hint || '천천히 다시 읽어 보자! 무엇을 묻는지 손가락으로 짚어 봐.'}` };
  else if (item.steps) q.say = { kind: 'hint', text: `💡 ${pickOne(STEP_HINT_LINES)}` };
  else {
    const wrong = item.choices.map((_, i) => i).filter((i) => i !== item.answer && !q.tries.some((t) => t.index === i) && !(q.elim || []).includes(i));
    if (wrong.length > 1) {
      const out = wrong[Math.floor(Math.random() * wrong.length)];
      q.elim = [...(q.elim || []), out];
      q.say = { kind: 'hint', text: `💡 ${elimLine(item, out)}` };
    } else q.say = { kind: 'hint', text: '💡 이제 두 개 중에 하나야! 문제를 한 번 더 읽고 골라 봐.' };
    if (q.selected !== null && (q.elim || []).includes(q.selected)) q.selected = null;
  }
  render();
}

/** 2단계 힌트: 풀이 단계가 있을 때 */
const STEP_HINT_LINES = ['위에 내가 풀이 순서를 적어 뒀어! 하나씩 따라가 봐.', '문제 아래에 순서를 적어 놨어. ①부터 차례대로 해 보자!', '위에 적어 둔 순서대로 하나씩 해 볼까? 같이 따라가 보자!'];

/** 2단계 힌트: 친구가 직접 해 보는 척하며 오답 하나를 지워요. (근거를 말해 줘요) */
function elimLine(item, i) {
  const c = String(item.choices[i]).replace(/\n/g, ' ');
  const bare = c.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '');
  const word = /^\d+$/.test(bare) ? bare + genJosa(Number(bare), '은', '는') : josa(bare, '은', '는');
  const subj = item.subject || ((item.chapterId || '').startsWith('m') ? 'math' : 'korean');
  const num = /^\d+\s*\S{0,2}$/.test(c);
  const shape = shapeKind(c);
  const lines = shape
    ? [`음… 내가 굴려 보고 쌓아 봤는데 ${word} 아닌 것 같아. 그럼 뭘까?`, `${word} 아닌 것 같아. 평평한 곳이랑 둥근 곳을 다시 봤거든… 남은 것 중에 뭘까?`]
    : num && subj === 'math'
      ? [`내가 하나씩 세어 봤는데 ${word} 아닌 것 같아… 그럼 몇일까?`, `음… 내가 해 봤는데 ${word} 아니더라. 남은 것 중에서 다시 해 보자!`, `${word} 아닌 것 같아. 손가락으로 다시 짚어 봤거든… 그럼 뭘까?`]
      : [`음… 내가 다시 읽어 봤는데 "${c}"${josa(c, '은', '는').slice(-1)} 아닌 것 같아. 남은 것 중에 뭘까?`, `"${c}"${josa(c, '은', '는').slice(-1)} 답이 아닌 것 같아. 문제를 다시 읽고 남은 것 중에서 골라 보자!`];
  return pickOne(lines);
}

/** 오답 유형 (같은 실수가 되풀이되는지 보려고): 수로 답하는 문제는 차이, 아니면 고른 보기 */
function mistakeKey(p, res) {
  if (p.answer.kind === 'number') {
    const v = res.kind === 'number' ? Number(res.value) : (problemNumber(p.q.choices[res.index]) || {}).value;
    if (v === undefined || Number.isNaN(v)) return 'other';
    const d = v - p.answer.value;
    if (Math.abs(d) === 1) return 'off-by-one';
    if (Math.abs(d) % 10 === 0 && Math.abs(d) < 1000) return 'place-value';
    return d > 0 ? 'over' : 'under';
  }
  return `pick:${String(p.q.choices[res.index] || '').slice(0, 12)}`;
}

/**
 * 답 내기 (pencil.js도 이 함수를 불러요)
 *  - 첫 시도에 틀리면 친구가 격려하고 왜 틀렸는지 짚어 준 뒤 한 번 더 (레벨 테스트는 바로 다음 문제)
 *  - 두 번째도 틀리면 정답을 보여 주고, 친구가 대화로 풀이를 알려 줘요.
 */
function submitAnswer() {
  const parts = quizParts();
  const { q, item, p, rep, input } = parts;
  const res = quizResponse(parts);
  if (!res || q.checked) return;
  const correct = judge(p, res);
  if (!correct) q.wrongKey = q.wrongKey || mistakeKey(p, res);
  q.attempts = (q.attempts || 0) + 1;
  if (q.inkSave) {
    safely(() => Store.saveInk({ qid: item.id, at: Date.now(), correct, first: q.attempts === 1, ...q.inkSave }));
    q.inkSave = null;
  }
  const test = q.mode === 'test';
  if (!correct && q.attempts === 1 && !test) {
    q.tries.push(res);
    q.say = { kind: 'why', text: `${pickOne(ENCOURAGE)}\n${whyWrong(p, res)}` };
    q.selected = null;
    q.typed = '';
    if (q.ink) q.ink = { ...freshInk(), penSeen: q.ink.penSeen };
    return render();
  }
  q.checked = true;
  q.correct = correct;
  q.result = {
    q: q.orig,
    firstCorrect: correct && q.attempts === 1,
    finalCorrect: correct,
    tries: correct ? q.attempts : q.attempts + 1,
    hintLv: q.hintLv || 0,
    wrong: q.wrongKey || null,
    rep,
    input,
    ms: Date.now() - q.shownAt,
  };
  if (test) q.say = { kind: 'ok', text: pickOne(TEST_NEXT_LINES) };
  else if (correct) q.say = { kind: 'ok', text: pickOne(RIGHT_LINES) };
  else q.say = { kind: 'why', text: `정답은 "${item.choices[item.answer]}"야. 같이 보자!` };
  render();
  // 레벨 테스트는 친구 말을 읽을 시간을 넉넉히 줘요.
  if (correct || test) setTimeout(() => State.quiz === q && Sim.problemDone(q.result), test ? 1900 : 1300);
}

/* ============================== 친구 완성 ============================== */
function screenFriendMade() {
  const f = friendById(State.madeFriend);
  const ch = CHAPTER_BY_ID[State.chapterId];
  const look = friendLook(f);
  return `<div class="s-bg bg-classroom" aria-hidden="true"></div>
    <div class="sst-wrap"><div class="sst made">
      <div class="made-rays" aria-hidden="true"></div>
      ${sImg(`${SCH}sparkle.png`, 'made-sparkle')}
      ${look.portrait ? sImg(look.portrait, 'made-face big') : faceImg(f, 'made-face sprite')}
      <h1 class="made-title"><span>${esc(josa(f.name, '과', '와'))}</span><span>친구가 됐어!</span></h1>
      <p class="made-sub">${esc(josa(f.name, '은', '는'))} 이제 교실 자리에 앉아 있어요. 방과후교실에서도 만날 수 있어요!${ch ? `<br><small>${esc(ch.title)}</small>` : ''}</p>
      <button type="button" class="s-submit made-btn" data-go="room">교실로 가기</button>
    </div></div>`;
}

/* ============================== 이벤트 ============================== */
(function bindSchool() {
  const root = document.getElementById('app');
  root.addEventListener('click', (ev) => {
    const el = ev.target.closest(
      '[data-s-room],[data-s-cor-next],[data-s-seat],[data-s-review],[data-s-next-room],[data-s-next],[data-s-choice],' +
        '[data-s-leave],[data-s-rest],[data-s-resume],[data-s-pick],[data-s-rep],[data-s-hint],[data-s-after],[data-submit],[data-read-problem],' +
        '[data-s-prev],[data-read-talk]'
    );
    if (!el) return;
    const d = el.dataset;

    if (d.sRoom) return go('room', { subject: d.sRoom, roomSay: null });
    if (el.hasAttribute('data-s-cor-next')) {
      const c = document.getElementById('corridor');
      const w = c ? c.querySelector('.cor-tile').offsetWidth : 0;
      if (c) c.scrollTo({ left: c.scrollLeft + w * 0.9 >= c.scrollWidth - c.clientWidth - 4 ? 0 : c.scrollLeft + w, behavior: 'smooth' });
      return;
    }

    // --- 교실 ---
    if (d.sSeat) {
      const room = School.roomList(State.subject);
      const t = room.seats.find((x) => x.ch.id === d.sSeat);
      if (!t) return;
      if (t.state === 'current') return Sim.open(t.ch.id, 'learn');
      if (t.state === 'review') return setSheet({ kind: 'reunion', chapterId: t.ch.id, friendId: t.friend.id, line: pickOne(REUNION_LINES) });
      const i = room.seats.indexOf(t);
      const left = (i % 2 === 0 ? 74 : 300) - 20;
      const top = ROOM_TOP + i * ROOM_STEP - 120;
      if (t.state === 'done') {
        State.roomSay = { left, top, text: fillLine(pickOne([`나 ${t.friend.name}! 다음에 또 놀자~`, ...ROOM_TAP_LINES]), { student: studentName(), friend: t.friend }) };
      } else {
        State.roomSay = { left, top, text: '앞자리 친구를 먼저 만나 볼까?' };
        el.classList.add('shake');
      }
      render();
      clearTimeout(State.roomSayT);
      State.roomSayT = setTimeout(() => {
        State.roomSay = null;
        if (State.screen === 'room') render();
      }, 2200);
      return;
    }
    if (d.sReview) {
      const line = State.sheet && State.sheet.line;
      State.sheet = null;
      return Sim.open(d.sReview, 'review', line);
    }
    if (el.hasAttribute('data-s-next-room')) {
      const room = School.roomList(State.subject);
      if (!room.next) return;
      const res = safely(() => Store.setPlacement({ [State.subject]: room.next }, 'auto'));
      if (res.ok) toast('새 교실이 열렸어요! 새 친구들이 기다려요.');
      return render();
    }

    // --- 대화 ---
    if (el.hasAttribute('data-s-next')) {
      if (State.sheet) return;
      Speech.stop();
      return Sim.next();
    }
    if (el.hasAttribute('data-s-prev')) {
      if (State.sheet) return;
      Speech.stop();
      return Sim.back();
    }
    if (el.hasAttribute('data-read-talk')) {
      if (!Speech.ok) return toast('이 기기에서는 읽어 주기를 쓸 수 없어요.', 'error');
      return readTalk();
    }
    if (d.sChoice !== undefined) return Sim.choose(Number(d.sChoice));
    if (el.hasAttribute('data-s-leave')) {
      State.sheet = null;
      return Sim.leave();
    }
    if (el.hasAttribute('data-s-rest')) {
      Speech.stop();
      return setSheet({ kind: 'rest', line: pickOne(REST_LINES) });
    }
    if (el.hasAttribute('data-s-resume')) return setSheet(null);

    // --- 문제 ---
    if (State.screen !== 'quiz' || !State.quiz) return;
    const q = State.quiz;
    if (d.sPick !== undefined) {
      if (q.checked) return;
      q.selected = Number(d.sPick);
      render();
      if (Profile.mode().tapRead) {
        const t = document.querySelector(`[data-s-pick="${d.sPick}"] .ans-text`);
        if (t) Speech.readEl(t);
      }
      return;
    }
    if (d.sRep) {
      q.rep = d.sRep;
      State.repPref = d.sRep;
      q.readKey = null;
      Speech.stop();
      return render();
    }
    if (el.hasAttribute('data-s-hint')) return useHint();
    if (el.hasAttribute('data-submit')) return quizParts().input === 'pencil' ? pencilSubmit() : submitAnswer();
    if (el.hasAttribute('data-s-after')) return Sim.problemDone(q.result);
    if (el.hasAttribute('data-read-problem')) {
      if (!Speech.ok) return toast('이 기기에서는 읽어 주기를 쓸 수 없어요.', 'error');
      return readProblem();
    }
  });

  // 숫자패드 (펜슬 모드에서 손글씨가 안 되는 기기 · 문제)
  root.addEventListener('click', (ev) => {
    const k = ev.target.closest('[data-key]');
    const q = State.quiz;
    if (!k || State.screen !== 'quiz' || !q || q.checked) return;
    const key = k.dataset.key;
    if (key === 'back') q.typed = q.typed.slice(0, -1);
    else if (key === 'clear') q.typed = '';
    else if (q.typed.length < 5) q.typed = (q.typed === '0' ? '' : q.typed) + key;
    render();
  });

  // 대화 화면: 스페이스 · 엔터로도 넘겨요.
  document.addEventListener('keydown', (ev) => {
    if (State.screen !== 'talk' || State.sheet || !['Enter', ' ', 'ArrowRight'].includes(ev.key)) return;
    const n = Sim.node();
    if (!n || n.t === 'choice' || ev.target.closest('button,input,textarea')) return;
    ev.preventDefault();
    Sim.next();
  });
})();
