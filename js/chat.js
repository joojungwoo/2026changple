/* =========================================================================
 * chat.js — 친구와 1대1 채팅
 *
 *  - 가입한 학생이면 학교 · 기관이 달라도 누구와나 이야기할 수 있어요. 항상 둘이서만(1대1).
 *  - 채팅은 홈 화면 아래 탭에서만 들어가요. 새 말이 오면 채팅 탭 위에 빨간 점이 떠요.
 *    공부하는 화면에는 버튼도 알림도 띄우지 않아요.
 *  - 채팅 탭: 지금 접속한 친구 목록 → [채팅하기]. 이미 이야기한 친구는 안 읽은 말의 수를 보여 줘요.
 *  - 채팅방: 새싹 챗봇이 이야기 주제를 추천해요. 추천일 뿐이라 하고 싶은 이야기를 자유롭게 해도 돼요.
 *    주제는 서버 함수(api/topics.js)가 Gemini에게 받아 와요. 실패하면 준비해 둔 주제를 보여 줘요.
 *
 * 아이 안전
 *  - 나쁜 말은 보내기 전에 가려요(CHAT_BAD_WORDS). AI 필터 · 신고 · 차단 · 인증코드는 베타 이후에 논의해요.
 *  - 한 번에 CHAT_MAX_LEN자, CHAT_MIN_GAP_MS마다 한 번만 보낼 수 있어요.
 *
 * 전송 방식
 *  - 지금은 서버 없이 같은 기기의 localStorage를 함께 써요(탭 두 개 = 친구 두 명).
 *  - 기기끼리 채팅하려면 ChatNet만 서버(웹소켓 등)로 바꾸면 돼요. 화면 코드는 그대로예요.
 * ========================================================================= */

const CHAT_MSG_KEY = 'chageun-chat-rooms-v2';
const CHAT_PRESENCE_KEY = 'chageun-chat-presence-v2';
const CHAT_READ_KEY = 'chageun-chat-read-v2';

const CHAT_MAX_LEN = 60;
const CHAT_KEEP = 100; // 방마다 남겨 두는 메시지 수
const CHAT_MIN_GAP_MS = 1500;
const CHAT_HEARTBEAT_MS = 8000;
const CHAT_ONLINE_MS = 25000; // 이 시간 안에 신호가 온 친구 = 접속 중

const CHAT_QUICK = ['안녕! 👋', '같이 공부하자!', '잘했어! 👍', '화이팅! 💪', '고마워 😊'];

/** 새싹 챗봇이 추천하는 이야기 주제 */
const CHAT_TOPICS = [
  '오늘 급식에서 뭐가 제일 맛있었는지 이야기해 볼까요?',
  '좋아하는 동물이 무엇인지 물어보세요!',
  '오늘 키운 식물에 대해 이야기해 볼까요?',
  '쉬는 시간에 무엇을 하고 놀았는지 물어보세요!',
  '제일 좋아하는 게임에 대해 이야기해 볼까요?',
  '주말에 하고 싶은 일을 물어보세요!',
  '오늘 기분이 어땠는지 이야기해 볼까요?',
  '좋아하는 과일이 무엇인지 물어보세요!',
  '오늘 배운 것 중에 재미있었던 것을 이야기해 볼까요?',
  '좋아하는 색깔을 물어보세요!',
];

const CHAT_BAD_WORDS = [
  '시발', '씨발', '씨바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '개새', '새끼', 'ㅅㄲ', '존나', 'ㅈㄴ',
  '미친', 'ㅁㅊ', '꺼져', '닥쳐', '죽어', '죽을래', '바보', '멍청', '찐따', '못생', '지랄', 'ㅈㄹ',
];

/** 글자 사이에 띄어쓰기·기호를 넣어도 잡아요. (예: "바 보", "바.보") */
const CHAT_BAD_RE = new RegExp(
  CHAT_BAD_WORDS.map((w) => [...w].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s.\\-_*~!]*')).join('|'),
  'g'
);

function chatClean(text) {
  let hit = false;
  const out = text.replace(CHAT_BAD_RE, (m) => {
    hit = true;
    return '♡'.repeat([...m.replace(/[\s.\-_*~!]/g, '')].length);
  });
  return { text: out, hit };
}

/** 둘만의 방 이름 */
const chatRoom = (a, b) => [a, b].sort().join('|');

/* ------------------------------ 전송 계층 ------------------------------ */
const ChatNet = {
  _get(key, blank) {
    try {
      return JSON.parse(localStorage.getItem(key)) || blank;
    } catch (e) {
      return blank;
    }
  },
  _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      throw new Error('메시지를 저장하지 못했어요. 잠시 후 다시 해 주세요.');
    }
  },

  messages(room) {
    return this._get(CHAT_MSG_KEY, {})[room] || [];
  },

  /** 내가 들어 있는 방 전부 { 상대 id: 메시지[] } */
  myRooms(me) {
    const all = this._get(CHAT_MSG_KEY, {});
    const out = {};
    Object.keys(all).forEach((room) => {
      const pair = room.split('|');
      if (pair.includes(me)) out[pair[0] === me ? pair[1] : pair[0]] = all[room];
    });
    return out;
  },

  post(room, msg) {
    const all = this._get(CHAT_MSG_KEY, {});
    all[room] = (all[room] || []).concat(msg).slice(-CHAT_KEEP);
    this._set(CHAT_MSG_KEY, all);
  },

  beat(me) {
    const all = this._get(CHAT_PRESENCE_KEY, {});
    const now = Date.now();
    // 오래된 신호는 치워요.
    Object.keys(all).forEach((id) => now - all[id].at > CHAT_ONLINE_MS * 4 && delete all[id]);
    all[me.id] = { name: me.name, at: now };
    this._set(CHAT_PRESENCE_KEY, all);
  },

  leave(id) {
    const all = this._get(CHAT_PRESENCE_KEY, {});
    if (!all[id]) return;
    delete all[id];
    this._set(CHAT_PRESENCE_KEY, all);
  },

  online() {
    const all = this._get(CHAT_PRESENCE_KEY, {});
    const now = Date.now();
    return Object.keys(all)
      .filter((id) => now - all[id].at < CHAT_ONLINE_MS)
      .map((id) => ({ id, name: all[id].name }));
  },

  readAt(me, room) {
    return (this._get(CHAT_READ_KEY, {})[me] || {})[room] || 0;
  },

  markRead(me, room, at) {
    const all = this._get(CHAT_READ_KEY, {});
    all[me] = { ...(all[me] || {}), [room]: at };
    this._set(CHAT_READ_KEY, all);
  },

  /** 다른 탭에서 바뀐 것을 알려 줘요. kind: 'msg' | 'presence' */
  listen(fn) {
    window.addEventListener('storage', (ev) => {
      if (ev.key === CHAT_MSG_KEY) fn('msg');
      if (ev.key === CHAT_PRESENCE_KEY) fn('presence');
    });
  },
};

/* ------------------------------ 새싹 챗봇 ------------------------------ */
/**
 * 추천 주제는 서버 함수(api/topics.js → Gemini)에서 여러 개를 한꺼번에 받아 돌려 써요.
 * 서버가 없거나(내 컴퓨터에서 실행) 실패하면 준비해 둔 CHAT_TOPICS로 대신해요.
 * 아이들이 나눈 대화는 서버로 보내지 않아요.
 */
const CHAT_TOPIC_CACHE = 'chageun-chat-topics';

const ChatBot = {
  list: CHAT_TOPICS,
  at: Math.floor(Math.random() * CHAT_TOPICS.length),
  fromAi: false,
  loading: false,

  topic() {
    return this.list[this.at % this.list.length];
  },

  next() {
    this.at += 1;
    // AI 주제를 한 바퀴 다 봤으면 새로 받아 와요.
    if (this.fromAi && this.at % this.list.length === 0) this.load(true);
    return this.topic();
  },

  _use(topics) {
    // 서버에서도 걸렀지만, 화면에 쓰기 전에 나쁜 말 목록으로 한 번 더 확인해요.
    const ok = topics.filter((t) => typeof t === 'string' && t.length <= 40 && !chatClean(t).hit);
    if (ok.length < 3) return;
    this.list = ok;
    this.at = 0;
    this.fromAi = true;
    const el = document.getElementById('chat-topic');
    if (el) el.textContent = this.topic();
  },

  /** 채팅방에 들어올 때 불러요. 이 탭에서 이미 받았으면 다시 부르지 않아요. */
  load(force) {
    if (this.loading || (this.fromAi && !force)) return;
    if (!force) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(CHAT_TOPIC_CACHE));
        if (Array.isArray(saved) && saved.length) return this._use(saved);
      } catch (e) { /* 저장된 것이 없으면 새로 받아요. */ }
    }
    this.loading = true;
    fetch('api/topics')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!d || !Array.isArray(d.topics)) return;
        try { sessionStorage.setItem(CHAT_TOPIC_CACHE, JSON.stringify(d.topics)); } catch (e) { /* 저장 못 해도 괜찮아요. */ }
        this._use(d.topics);
      })
      .catch(() => {}) // 준비해 둔 주제를 그대로 써요.
      .then(() => (this.loading = false));
  },
};

/* ------------------------------ 채팅 ------------------------------ */
const Chat = {
  screen: null,
  lastSentAt: 0,
  me: null,

  /** 나 { id, name } — 학생만 채팅해요. */
  _me() {
    const user = Store.currentUser();
    return user && user.role === 'student' ? { id: user.id, name: user.name } : null;
  },

  _unreadIn(friendId, msgs) {
    const read = ChatNet.readAt(this.me.id, chatRoom(this.me.id, friendId));
    return msgs.filter((m) => m.from !== this.me.id && m.at > read).length;
  },

  /** 안 읽은 말 전체 (채팅 탭의 빨간 점) */
  unread() {
    const me = this.me || this._me();
    if (!me) return 0;
    this.me = me;
    const rooms = ChatNet.myRooms(me.id);
    return Object.keys(rooms).reduce((n, id) => n + this._unreadIn(id, rooms[id]), 0);
  },

  /** 채팅 탭에 보여 줄 친구: 지금 접속한 친구 + 안 읽은 말을 남긴 친구 */
  friends() {
    const me = this.me;
    const rooms = ChatNet.myRooms(me.id);
    const names = {};
    Store.allStudents().forEach((s) => (names[s.id] = s.name));
    const online = new Set(ChatNet.online().map((f) => f.id).filter((id) => id !== me.id && names[id]));
    const rows = [...new Set([...online, ...Object.keys(rooms).filter((id) => names[id])])].map((id) => ({
      id,
      name: names[id],
      online: online.has(id),
      talked: !!(rooms[id] && rooms[id].length),
      unread: rooms[id] ? this._unreadIn(id, rooms[id]) : 0,
    }));
    return rows.filter((f) => f.online || f.unread).sort((a, b) => b.unread - a.unread || (a.name < b.name ? -1 : 1));
  },

  /** app.js render() 끝에서 불려요. */
  afterRender(screen) {
    const prev = this.me;
    this.me = this._me();
    this.screen = screen;
    if (prev && (!this.me || prev.id !== this.me.id)) ChatNet.leave(prev.id);
    if (this.me) ChatNet.beat(this.me);
    if (screen === 'chatroom') {
      ChatBot.load();
      this._markRead();
      this._scrollDown();
    }
  },

  _markRead() {
    const room = chatRoom(this.me.id, State.chatWith);
    const msgs = ChatNet.messages(room);
    if (msgs.length) ChatNet.markRead(this.me.id, room, msgs[msgs.length - 1].at);
  },

  _scrollDown() {
    const list = document.getElementById('chat-list');
    if (list) list.scrollTop = list.scrollHeight;
  },

  /** 채팅 탭 위 빨간 점만 다시 그려요. */
  paintDot() {
    const icon = document.querySelector('.tab[data-go="chat"] .tab-icon');
    if (!icon) return;
    const old = icon.querySelector('.dot');
    if (old) old.remove();
    const n = this.unread();
    if (n) icon.insertAdjacentHTML('beforeend', `<span class="dot">${n > 9 ? '9+' : n}</span>`);
  },

  /* ---------- 다른 탭에서 온 변화 ---------- */
  onRemote(kind) {
    if (!this.me) return;
    if (this.screen === 'chat') return this.refreshList();
    if (this.screen === 'chatroom') {
      if (kind === 'presence') return this._paintOnline();
      const room = chatRoom(this.me.id, State.chatWith);
      const fresh = ChatNet.messages(room).filter((m) => !document.getElementById(`m-${m.id}`));
      if (fresh.length) this._appendMessages(fresh);
      return this._markRead();
    }
    if (kind === 'msg') this.paintDot();
  },

  /* ---------- 채팅 탭: 친구 목록 ---------- */
  _sig(friends) {
    return friends.map((f) => `${f.id}:${f.online ? 1 : 0}:${f.unread}`).join(',');
  },

  /** 친구 목록이 바뀌었을 때만 다시 그려요. */
  refreshList() {
    if (this._sig(this.friends()) !== this.listSig) render();
  },

  listView() {
    const me = (this.me = this._me());
    const friends = this.friends();
    this.listSig = this._sig(friends);
    return `
      ${hud({ title: `${pxIcon('chat')} 채팅`, logout: true })}
      <main class="page">
        <h3 class="section-title" style="margin-top:0">🟢 현재 접속 중인 친구</h3>
        ${
          friends.length
            ? `<ul class="friend-list">
                ${friends
                  .map(
                    (f) => `<li>
                      <button class="friend-row" data-chat-with="${esc(f.id)}">
                        <span class="friend-face ${f.online ? 'on' : ''}" aria-hidden="true">${esc([...f.name][0] || '🙂')}</span>
                        <span class="friend-name">${esc(f.name)}${f.online ? '' : ' <small>· 지금은 없어요</small>'}</span>
                        ${
                          f.unread
                            ? `<span class="friend-unread" aria-label="안 읽은 말 ${f.unread}개">${f.unread > 9 ? '9+' : f.unread}</span>`
                            : `<span class="friend-go">${f.talked ? '이어서 하기' : '채팅하기'}</span>`
                        }
                      </button>
                    </li>`
                  )
                  .join('')}
              </ul>`
            : `<div class="empty big">
                <div class="empty-icon">😴</div>
                <h2>지금 접속한 친구가 없어요</h2>
                <p>친구가 들어오면 여기에 보여요.<br>${esc(me.name)} 친구, 조금 있다가 다시 와 볼까요?</p>
              </div>`
        }
        <p class="muted-note">친구와 둘이서만 이야기해요 · 고운 말을 써요 🌷</p>
      </main>
      ${tabbar('chat')}`;
  },

  /* ---------- 채팅방 ---------- */
  _friend() {
    const u = Store.allStudents().find((s) => s.id === State.chatWith);
    return u ? { id: u.id, name: u.name, online: ChatNet.online().some((f) => f.id === u.id) } : null;
  },

  _msgHtml(m) {
    const mine = m.from === this.me.id;
    const t = new Date(m.at);
    const time = `${t.getHours() < 12 ? '오전' : '오후'} ${((t.getHours() + 11) % 12) + 1}:${String(t.getMinutes()).padStart(2, '0')}`;
    return `<li class="chat-msg ${mine ? 'mine' : ''}" id="m-${esc(m.id)}">
      <span class="chat-msg-body">
        <span class="chat-name">${mine ? '나' : esc(m.name)}<time>${time}</time></span>
        <span class="chat-text">${esc(m.text)}</span>
      </span>
    </li>`;
  },

  _appendMessages(msgs) {
    const list = document.getElementById('chat-list');
    if (!list) return;
    const empty = list.querySelector('.chat-empty');
    if (empty) empty.remove();
    list.insertAdjacentHTML('beforeend', msgs.map((m) => this._msgHtml(m)).join(''));
    this._scrollDown();
  },

  _onlineHtml(f) {
    return f.online
      ? `<span class="chat-online-label">🟢 ${esc(f.name)} 친구가 지금 함께 있어요</span>`
      : `<span class="chat-online-none">😴 ${esc(f.name)} 친구가 지금은 없어요. 들어오면 이야기할 수 있어요.</span>`;
  },

  _paintOnline() {
    const el = document.getElementById('chat-online');
    const f = this._friend();
    if (!el || !f) return;
    el.innerHTML = this._onlineHtml(f);
    document.querySelectorAll('#chat-form input, #chat-form button, .chat-quick button').forEach((b) => (b.disabled = !f.online));
  },

  roomView() {
    this.me = this._me();
    const f = this._friend();
    const msgs = ChatNet.messages(chatRoom(this.me.id, f.id));
    const dis = f.online ? '' : 'disabled';
    return `
      ${hud({ back: 'chat', title: `💬 ${esc(f.name)}` })}
      <div class="chat-online" id="chat-online">${this._onlineHtml(f)}</div>
      <div class="chat-topic">
        <span class="chat-bot" aria-hidden="true">${sproutLogo()}</span>
        <p><b>새싹이의 추천 주제</b><span id="chat-topic">${esc(ChatBot.topic())}</span></p>
        <button type="button" class="icon-btn" data-chat-topic aria-label="다른 주제 보기">🔄</button>
      </div>
      <main class="page flush chat-page">
        <ol class="chat-list" id="chat-list" aria-live="polite">
          ${msgs.length ? msgs.map((m) => this._msgHtml(m)).join('') : '<li class="chat-empty">아직 나눈 이야기가 없어요. 먼저 인사해 볼까요? 👋</li>'}
        </ol>
      </main>
      <div class="chat-quick">
        ${CHAT_QUICK.map((q) => `<button type="button" data-chat-quick="${esc(q)}" ${dis}>${esc(q)}</button>`).join('')}
      </div>
      <form id="chat-form" class="chat-form" autocomplete="off">
        <input type="text" name="text" maxlength="${CHAT_MAX_LEN}" placeholder="친구에게 할 말" aria-label="보낼 말" ${dis} />
        <button type="submit" class="btn btn-primary" ${dis}>보내기</button>
      </form>`;
  },

  send(raw) {
    const me = this._me();
    const f = this._friend();
    const text = String(raw || '').trim().slice(0, CHAT_MAX_LEN);
    if (!me || !f || !text) return false;
    if (!f.online) {
      toast('친구가 지금은 없어요.', 'error');
      return false;
    }
    if (Date.now() - this.lastSentAt < CHAT_MIN_GAP_MS) {
      toast('천천히 보내요 🐢', 'error');
      return false;
    }
    const clean = chatClean(text);
    const msg = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, from: me.id, name: me.name, text: clean.text, at: Date.now() };
    const res = safely(() => ChatNet.post(chatRoom(me.id, f.id), msg));
    if (!res.ok) return false;
    this.lastSentAt = msg.at;
    this._appendMessages([msg]);
    this._markRead();
    if (clean.hit) toast('친구가 속상할 수 있는 말은 가렸어요 🌷', 'error');
    return true;
  },
};

/* ------------------------------ 이벤트 ------------------------------ */
document.getElementById('app').addEventListener('click', (ev) => {
  const q = ev.target.closest('[data-chat-quick]');
  if (q && !q.disabled) return Chat.send(q.dataset.chatQuick);
  if (ev.target.closest('[data-chat-topic]')) {
    const el = document.getElementById('chat-topic');
    if (el) el.textContent = ChatBot.next();
  }
});

ChatNet.listen((kind) => Chat.onRemote(kind));

setInterval(() => {
  if (!Chat.me) return;
  ChatNet.beat(Chat.me);
  if (Chat.screen === 'chatroom') Chat._paintOnline(); // 나간 친구 정리
  if (Chat.screen === 'chat') Chat.refreshList();
}, CHAT_HEARTBEAT_MS);

window.addEventListener('pagehide', () => {
  if (Chat.me) ChatNet.leave(Chat.me.id);
});
