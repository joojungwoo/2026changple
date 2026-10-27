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
 * 전송 방식 (ChatNet)
 *  - 수파베이스가 연결되어 있으면(Cloud.on) ChatCloud: 메시지는 messages 표, 새 메시지는 Realtime,
 *    접속 중인 친구는 Presence("online" 채널)로 주고받아요. 다른 기기 친구와도 이야기할 수 있어요.
 *  - 연결 정보가 없으면 ChatLocal: 같은 기기의 localStorage를 함께 써요(탭 두 개 = 친구 두 명).
 *  - 화면 코드(Chat)는 어느 쪽이든 똑같이 불러요.
 * ========================================================================= */

const CHAT_MSG_KEY = 'chageun-chat-rooms-v2';
const CHAT_PRESENCE_KEY = 'chageun-chat-presence-v2';
const CHAT_READ_KEY = 'chageun-chat-read-v2';

const CHAT_MAX_LEN = 60;
const CHAT_KEEP = 100; // 방마다 남겨 두는 메시지 수
const CHAT_MIN_GAP_MS = 1500;
const CHAT_HEARTBEAT_MS = 8000;
const CHAT_ONLINE_MS = 25000; // 이 시간 안에 신호가 온 친구 = 접속 중

/**
 * 피그마 채팅: 글자를 치지 않고 문구나 그림 하나를 골라 보내요. (아이 안전 · 쉬운 사용)
 *  그림은 ':이름:' 글자로 저장하고(서버 · 다른 기기와 같아요), 보여 줄 때 픽셀 그림으로 바꿔요.
 */
const CHAT_PHRASES = ['같이 게임해요', '힘내요', '고마워요', '미안해요', '친구해요', '좋아요'];
const CHAT_EMOJIS = [
  { id: 'thumbs-up', label: '좋아요', src: 'assets/ui/emoji-thumbs-up.svg', w: 36, h: 36 },
  { id: 'thumbs-down', label: '싫어요', src: 'assets/ui/emoji-thumbs-down.svg', w: 36, h: 36 },
  { id: 'smile', label: '웃는 얼굴', src: 'assets/ui/emoji-smile.svg', w: 36, h: 33 },
  { id: 'cry', label: '우는 얼굴', src: 'assets/ui/emoji-cry.svg', w: 36, h: 33 },
  { id: 'heart', label: '하트', src: 'assets/ui/emoji-heart.svg', w: 33, h: 30 },
];
const CHAT_RULES_KEY = 'hangeoleum-chat-rules-until'; // "7일간 보지 않기"
const chatEmoji = (text) => {
  const m = /^:([a-z-]+):$/.exec(String(text || ''));
  return m ? CHAT_EMOJIS.find((e) => e.id === m[1]) : null;
};

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

/* ------------------------------ 전송 계층: 이 기기 안 ------------------------------ */
const ChatLocal = {
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

  /** 이름을 아는 학생 { 아이디: 이름 } */
  people() {
    const out = {};
    Store.allStudents().forEach((s) => (out[s.id] = s.name));
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

/* ------------------------------ 전송 계층: 수파베이스 ------------------------------ */
const ChatCloud = {
  me: null, // 내 아이디
  rooms: {}, // 방 → 메시지[]
  reads: {}, // 방 → 마지막으로 읽은 시각(ms)
  names: {}, // 이름을 아는 학생 { 아이디: 이름 }
  onlineIds: [],
  fns: [],
  _inbox: null,
  _pres: null,
  _readTimers: {},

  _emit(kind) {
    this.fns.forEach((fn) => fn(kind));
  },

  /** 모르는 학생의 아이디 · 이름을 서버에서 알아 와요. (by: 'id' = uuid, 'login_id' = 아이디) */
  async _learn(by, keys) {
    const want = keys.filter((k) => k && (by === 'id' ? !Cloud.loginOf[k] : !this.names[k]));
    if (!want.length) return;
    const rows = await Cloud._q(Cloud.sb.from('profiles').select('id,login_id,name,role').in(by, [...new Set(want)]));
    rows.forEach((p) => {
      Cloud.uuidOf[p.login_id] = p.id;
      Cloud.loginOf[p.id] = p.login_id;
      if (p.role === 'student') this.names[p.login_id] = p.name;
    });
  },

  _toMsg(row) {
    const from = Cloud.loginOf[row.sender_id];
    return { id: row.id, from, name: this.names[from] || from, text: row.text, at: Date.parse(row.created_at) };
  },

  _add(row) {
    const other = Cloud.loginOf[row.sender_id === Cloud.uid ? row.recipient_id : row.sender_id];
    if (!other || !this.me) return false;
    const room = chatRoom(this.me, other);
    const list = (this.rooms[room] = this.rooms[room] || []);
    if (list.some((m) => m.id === row.id)) return false;
    list.push(this._toMsg(row));
    list.sort((a, b) => a.at - b.at);
    if (list.length > CHAT_KEEP) list.splice(0, list.length - CHAT_KEEP);
    return true;
  },

  async _start(me) {
    const sb = Cloud.sb;
    const uid = Cloud.uid;
    this.names[me.id] = me.name;
    const [msgs, reads] = await Promise.all([
      Cloud._q(
        sb.from('messages').select('id,sender_id,recipient_id,text,created_at')
          .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
          .order('created_at', { ascending: false })
          .limit(500)
      ),
      Cloud._q(sb.from('chat_reads').select('friend_id,read_at')),
    ]);
    await this._learn('id', [...msgs.map((m) => m.sender_id), ...msgs.map((m) => m.recipient_id), ...reads.map((r) => r.friend_id)]);
    if (this.me !== me.id) return; // 그 사이에 로그아웃했어요.
    msgs.reverse().forEach((m) => this._add(m));
    reads.forEach((r) => {
      const f = Cloud.loginOf[r.friend_id];
      if (f) this.reads[chatRoom(me.id, f)] = Date.parse(r.read_at);
    });
    this._emit('msg');

    const { data: { session } } = await sb.auth.getSession();
    if (!session || this.me !== me.id) return;
    await sb.realtime.setAuth(session.access_token);
    if (this.me !== me.id) return;

    // 나에게 온 새 메시지 (RLS 덕분에 내 것만 와요)
    this._join(me, () =>
      sb.channel(`inbox-${uid}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${uid}` }, async (p) => {
        await this._learn('id', [p.new.sender_id]).catch(() => {});
        if (this._add(p.new)) this._emit('msg');
      })
    , '_inbox');

    // 접속 중인 친구. 이름은 Presence에 실린 것을 믿지 않고 서버의 프로필로 확인해요.
    this._join(me, () => {
      const ch = sb.channel('online', { config: { private: true, presence: { key: me.id } } });
      return ch.on('presence', { event: 'sync' }, async () => {
        if (this._pres !== ch) return;
        const keys = Object.keys(ch.presenceState());
        await this._learn('login_id', keys).catch(() => {});
        this.onlineIds = keys.filter((k) => this.names[k]);
        this._emit('presence');
      });
    }, '_pres', (ch) => ch.track({ at: Date.now() }));
  },

  /**
   * 채널에 들어가요. 로그인 토큰이 바뀌는 순간과 겹치면 들어가다 멈출 때가 있어서,
   * 10초 안에 못 들어가거나 끊기면 채널을 새로 만들어 다시 들어가요.
   */
  _join(me, make, slot, onJoin) {
    const sb = Cloud.sb;
    const ch = make();
    this[slot] = ch;
    let done = false;
    const retry = () => {
      if (done || this[slot] !== ch || this.me !== me.id) return;
      done = true;
      sb.removeChannel(ch);
      this[slot] = null;
      setTimeout(() => this.me === me.id && !this[slot] && this._join(me, make, slot, onJoin), 1500);
    };
    const timer = setTimeout(retry, 10000);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        if (onJoin && this[slot] === ch) onJoin(ch);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        retry();
      }
    });
    return ch;
  },

  _stop() {
    if (this._inbox) Cloud.sb.removeChannel(this._inbox);
    if (this._pres) Cloud.sb.removeChannel(this._pres);
    this._inbox = this._pres = null;
    this.me = null;
    this.rooms = {};
    this.reads = {};
    this.onlineIds = [];
  },

  messages(room) {
    return this.rooms[room] || [];
  },

  myRooms(me) {
    const out = {};
    Object.keys(this.rooms).forEach((room) => {
      const pair = room.split('|');
      if (pair.includes(me)) out[pair[0] === me ? pair[1] : pair[0]] = this.rooms[room];
    });
    return out;
  },

  people() {
    return this.names;
  },

  /**
   * 보내기: 화면에 먼저 보여 주고, 서버가 받으면 서버의 id · 시각으로 바꿔요. (msg를 그대로 고쳐요)
   * @returns {Promise} 실패하면 메시지를 목록에서 빼고 오류를 던져요.
   */
  post(room, msg) {
    const friend = room.split('|').find((id) => id !== this.me);
    const rid = Cloud.uuidOf[friend];
    if (!rid) throw new Error('친구를 찾지 못했어요.');
    const list = (this.rooms[room] = this.rooms[room] || []);
    list.push(msg);
    return Cloud.sb
      .from('messages')
      .insert({ recipient_id: rid, text: msg.text })
      .select('id,created_at')
      .single()
      .then(({ data, error }) => {
        if (error) {
          list.splice(list.indexOf(msg), 1);
          if (/too-fast/.test(error.message)) throw new Error('천천히 보내요 🐢');
          throw cloudError(error, '메시지를 보내지 못했어요. 다시 해 볼까요?');
        }
        msg.id = data.id;
        msg.at = Date.parse(data.created_at);
        return msg;
      });
  },

  beat(me) {
    if (this.me === me.id || !Cloud.uid) return;
    this._stop();
    this.me = me.id;
    this._start(me).catch((e) => console.warn('chat start', e && e.message));
  },

  leave(id) {
    if (this.me === id) this._stop();
  },

  online() {
    return this.onlineIds.map((id) => ({ id, name: this.names[id] }));
  },

  readAt(me, room) {
    return this.reads[room] || 0;
  },

  /** 읽은 시각은 잠깐 모았다가 서버에 남겨요. (다른 기기에서도 빨간 점이 맞게) */
  markRead(me, room, at) {
    if (at <= (this.reads[room] || 0)) return;
    this.reads[room] = at;
    const friend = room.split('|').find((id) => id !== me);
    const fid = Cloud.uuidOf[friend];
    if (!fid) return;
    clearTimeout(this._readTimers[room]);
    this._readTimers[room] = setTimeout(() => {
      Cloud.sb.from('chat_reads').upsert({ user_id: Cloud.uid, friend_id: fid, read_at: new Date(at).toISOString() })
        .then(({ error }) => error && console.warn('chat read', error.message));
    }, 1000);
  },

  listen(fn) {
    this.fns.push(fn);
  },
};

const ChatNet = Cloud.on ? ChatCloud : ChatLocal;

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
    const names = ChatNet.people();
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
    // 채팅방에 새로 들어오면: 주의 사항 팝업을 다시 보여 주고, 고른 것 · 패널은 비워요.
    if (screen === 'chatroom' && this.screen !== 'chatroom') {
      this._rulesSeen = false;
      this.pick = null;
      this.panel = false;
    }
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
    // 안 읽은 수는 친구가 보낸 말만 세요. 그래서 친구가 보낸 마지막 말까지 읽었다고 남겨요.
    const theirs = ChatNet.messages(room).filter((m) => m.from !== this.me.id);
    if (theirs.length) ChatNet.markRead(this.me.id, room, theirs[theirs.length - 1].at);
  },

  _scrollDown() {
    const list = document.getElementById('chat-list');
    if (list) list.scrollTop = list.scrollHeight;
    if (this.screen === 'chatroom') window.scrollTo(0, document.documentElement.scrollHeight);
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
  /** 이야기할 수 있는 친구인지 (app.js 접근 제어) */
  knows(id) {
    return !!id && !!ChatNet.people()[id];
  },

  _friend() {
    const name = ChatNet.people()[State.chatWith];
    return name ? { id: State.chatWith, name, online: ChatNet.online().some((f) => f.id === State.chatWith) } : null;
  },

  /** 말풍선 (피그마: 친구 = 크림색 왼쪽, 나 = 초록 오른쪽, 꼬리 달림) */
  _msgHtml(m) {
    const mine = m.from === this.me.id;
    const t = new Date(m.at);
    const time = `${t.getHours() < 12 ? '오전' : '오후'} ${((t.getHours() + 11) % 12) + 1}:${String(t.getMinutes()).padStart(2, '0')}`;
    const e = chatEmoji(m.text);
    const body = e ? `<img src="${e.src}" alt="${e.label}" width="${e.w}" height="${e.h}">` : `<span class="chat-text">${esc(m.text)}</span>`;
    return `<li class="chat-msg ${mine ? 'mine' : ''}" id="m-${esc(m.id)}">
      <span class="chat-bubble px px-badge ${mine ? 'px-mine' : 'px-surface'} ${e ? 'emoji' : ''}" title="${mine ? '나' : esc(m.name)} · ${time}">
        ${body}<img class="tail" src="assets/ui/bubble-tail-${mine ? 'mine' : 'friend'}.svg" alt="" aria-hidden="true">
      </span>
    </li>`;
  },

  _appendMessages(msgs) {
    const list = document.getElementById('chat-list');
    if (!list) return;
    const empty = list.querySelector('.chat-empty');
    if (empty) empty.remove();
    list.insertAdjacentHTML('beforeend', msgs.map((m) => this._msgHtml(m).replace('class="chat-msg', 'class="chat-msg new')).join(''));
    this._scrollDown();
  },

  _onlineHtml(f) {
    return f.online ? `🟢 지금 함께 있어요` : `😴 지금은 없어요`;
  },

  _paintOnline() {
    const el = document.getElementById('chat-online');
    const f = this._friend();
    if (!el || !f) return;
    el.textContent = this._onlineHtml(f);
    el.classList.toggle('off', !f.online);
    const send = document.querySelector('[data-chat-send]');
    if (send) send.disabled = !f.online || !this._outgoing();
  },

  // 고른 것 · 선택 패널 · 탭 (피그마 '문구 선택' · '이모지 선택' · '미리보기')
  pick: null, // { kind: 'phrase' | 'emoji', value }
  panel: false,
  tab: 'phrase',

  _rulesHidden() {
    try {
      return Number(localStorage.getItem(CHAT_RULES_KEY) || 0) > Date.now();
    } catch (e) {
      return false;
    }
  },

  /** 들어올 때 팝업 (피그마 '채팅 주의 사항') */
  _rulesHtml() {
    const row = (icon, w, h, text, top) => `<div class="rule-row" style="top:${top}px"><img src="${icon}" alt="" aria-hidden="true" width="${w}" height="${h}"><p class="t-body">${text}</p></div>`;
    return `<div class="f-popup chat-rules" role="dialog" aria-modal="true" aria-label="채팅 주의 사항">
      <div class="f-scrim" aria-hidden="true"></div>
      <div class="popup-panel px px-panel px-surface" style="top:218px;height:408px"></div>
      ${row('assets/ui/emoji-heart.svg', 33, 30, '상대방의 기분을<br>생각해서 보내요', 266)}
      ${row('assets/ui/icon-moon.svg', 30, 30, '늦은 시간 연락하지 않아요', 356)}
      ${row('assets/ui/emoji-smile.svg', 36, 33, '친구와 함께<br>즐겁게 소통해요', 446)}
      <button class="f-btn f-button px px-tile px-surface" data-chat-rules="week" style="left:45px;top:548px;width:168px">7일간 보지 않기</button>
      <button class="f-btn f-button px px-tile px-primary" data-chat-rules="close" style="left:225px;top:548px;width:114px">닫기</button>
      ${fPlate('채팅 주의 사항', 'popup-title', 'style="top:200px"')}
    </div>`;
  },

  /**
   * 글 칸: 직접 쳐도 되고, 패널에서 문구를 고르면 칸에 채워져요. 그림을 고르면 칸에 그림이 보여요.
   * (쓰는 동안에는 화면을 다시 그리지 않아요. 글자가 지워지거나 키보드가 닫히지 않게)
   */
  _fieldHtml() {
    const e = this.pick && this.pick.kind === 'emoji' ? CHAT_EMOJIS.find((x) => x.id === this.pick.value) : null;
    const text = this.pick && this.pick.kind !== 'emoji' ? this.pick.value : '';
    return `${e ? `<img class="field-emoji" src="${e.src}" alt="${e.label}" width="${e.w}" height="${e.h}">` : ''}
      <input id="chat-input" class="chat-type t-body" type="text" maxlength="${CHAT_MAX_LEN}" enterkeyhint="send" autocomplete="off"
        placeholder="${e ? '' : '보낼 말을 쓰거나 골라요'}" aria-label="보낼 말" value="${esc(text)}">`;
  },

  /** 보낼 것 (글 · 고른 문구 · 그림) */
  _outgoing() {
    if (!this.pick) return '';
    if (this.pick.kind === 'emoji') return `:${this.pick.value}:`;
    return String(this.pick.value || '').trim();
  },

  _panelHtml() {
    const tabBtn = (id, label) => `<button class="f-btn chat-tab px px-badge ${this.tab === id ? 'px-primary' : 'px-surface'}" data-chat-tab="${id}" aria-pressed="${this.tab === id}">${label}</button>`;
    const sel = (kind, v) => this.pick && this.pick.kind === kind && this.pick.value === v;
    const body =
      this.tab === 'phrase'
        ? `<div class="pick-grid phrases">${CHAT_PHRASES.map((p) => `<button class="f-btn pick px px-tile ${sel('phrase', p) ? 'px-mine' : 'px-white'}" data-chat-pick="phrase" data-value="${esc(p)}" aria-pressed="${sel('phrase', p)}"><span class="t-h2">${esc(p)}</span></button>`).join('')}</div>`
        : `<div class="pick-grid emojis">${CHAT_EMOJIS.map((e) => `<button class="f-btn pick px px-tile ${sel('emoji', e.id) ? 'px-mine' : 'px-white'}" data-chat-pick="emoji" data-value="${e.id}" aria-pressed="${sel('emoji', e.id)}" aria-label="${e.label}"><img src="${e.src}" alt="" width="${Math.round(e.w * 4 / 3)}" height="${Math.round(e.h * 4 / 3)}"></button>`).join('')}</div>`;
    return `<div class="chat-panel">
      <div class="chat-tabs">${tabBtn('phrase', '문구')}${tabBtn('emoji', '그림')}</div>
      ${body}
    </div>`;
  },

  roomView() {
    this.me = this._me();
    const f = this._friend();
    const msgs = ChatNet.messages(chatRoom(this.me.id, f.id));
    const showRules = !this._rulesSeen && !this._rulesHidden();
    return `
      <div class="chat-sky" aria-hidden="true">
        ${[[18, 168, 96], [258, 222, 72], [36, 396, 72], [270, 486, 96], [120, 640, 72]].map(([x, y, w]) => `<img src="assets/ui/cloud.svg" alt="" style="left:${x}px;top:${y}px;width:${w}px">`).join('')}
      </div>
      <div class="fixed-top chat-head"><div class="zoomed" style="height:150px">
        ${fRound('data-back="chat" style="left:16px;top:57px"', UI_IMG.back, '뒤로 가기')}
        <span class="chat-avatar px px-round px-surface" aria-hidden="true"><img src="assets/ui/sprout-purple.svg" alt="" width="42" height="30"></span>
        ${fPlate(esc(f.name), 'chat-name-plate')}
        <span class="chat-online ${f.online ? '' : 'off'}" id="chat-online">${this._onlineHtml(f)}</span>
      </div></div>
      <main class="chat-room">
        <div class="chat-topic px px-plate px-surface">
          <img src="${UI_IMG.logo}" alt="" aria-hidden="true" width="30" height="30">
          <p><b>새싹이 추천</b> <span id="chat-topic">${esc(ChatBot.topic())}</span></p>
          <button type="button" class="f-btn chat-topic-next" data-chat-topic aria-label="다른 주제 보기">🔄</button>
        </div>
        <ol class="chat-list" id="chat-list" aria-live="polite">
          ${msgs.length ? msgs.map((m) => this._msgHtml(m)).join('') : '<li class="chat-empty t-body">아직 나눈 이야기가 없어요. 먼저 인사해 볼까요? 👋</li>'}
        </ol>
      </main>
      <div class="fixed-bottom chat-foot"><div class="zoomed">
        <div class="chat-input">
          <div class="chat-field px px-badge px-white">
            ${this._fieldHtml()}
            <button class="f-btn chat-open" data-chat-open aria-label="문구 · 그림 고르기" aria-expanded="${this.panel}">${this.panel ? '⌨️' : '😊'}</button>
          </div>
          <button class="f-btn chat-send px px-plate px-primary" data-chat-send aria-label="보내기" ${f.online && this._outgoing() ? '' : 'disabled'}><img src="assets/ui/icon-paper-plane.svg" alt="" width="33" height="24"></button>
        </div>
        ${this.panel ? this._panelHtml() : '<div class="chat-home-space"></div>'}
      </div></div>
      ${showRules ? `<div class="fixed-top" style="z-index:30;bottom:0"><div class="zoomed" style="height:844px">${this._rulesHtml()}</div></div>` : ''}`;
  },

  /** 글 칸 · 고른 것을 보내요. 보내면 칸을 비우고 패널을 닫아요. */
  sendPicked() {
    const text = this._outgoing();
    if (!text) return false;
    if (!this.send(text)) return false;
    this.pick = null;
    this.panel = false;
    render();
    return true;
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
    const tempId = msg.id;
    const res = safely(() => ChatNet.post(chatRoom(me.id, f.id), msg));
    if (!res.ok) return false;
    this.lastSentAt = msg.at;
    this._appendMessages([msg]);
    if (res.value && res.value.then) {
      // 서버로 보내는 중: 받으면 서버의 id로 바꾸고, 실패하면 화면에서도 빼요.
      res.value
        .then(() => {
          const el = document.getElementById(`m-${tempId}`);
          if (el) el.id = `m-${msg.id}`;
          if (this.screen === 'chatroom') this._markRead();
        })
        .catch((e) => {
          const el = document.getElementById(`m-${tempId}`);
          if (el) el.remove();
          toast(e.message, 'error');
        });
    } else {
      this._markRead();
    }
    if (clean.hit) toast('친구가 속상할 수 있는 말은 가렸어요 🌷', 'error');
    return true;
  },
};

/* ------------------------------ 이벤트 ------------------------------ */
document.getElementById('app').addEventListener('click', (ev) => {
  if (State.screen === 'chatroom') {
    const rules = ev.target.closest('[data-chat-rules]');
    if (rules) {
      if (rules.dataset.chatRules === 'week') {
        try { localStorage.setItem(CHAT_RULES_KEY, String(Date.now() + 7 * 86400000)); } catch (e) { /* 이번만 닫아요. */ }
      }
      Chat._rulesSeen = true;
      return render();
    }
    if (ev.target.closest('[data-chat-open]')) {
      Chat.panel = !Chat.panel;
      return render();
    }
    const tab = ev.target.closest('[data-chat-tab]');
    if (tab) {
      Chat.tab = tab.dataset.chatTab;
      return render();
    }
    const pick = ev.target.closest('[data-chat-pick]');
    if (pick) {
      Chat.pick = { kind: pick.dataset.chatPick, value: pick.dataset.value };
      render();
      if (Profile.mode().tapRead) Speech.read([{ text: pick.dataset.chatPick === 'emoji' ? pick.getAttribute('aria-label') : pick.dataset.value }]);
      return;
    }
    const send = ev.target.closest('[data-chat-send]');
    if (send && !send.disabled) return Chat.sendPicked();
  }
  if (ev.target.closest('[data-chat-topic]')) {
    const el = document.getElementById('chat-topic');
    if (el) el.textContent = ChatBot.next();
  }
});

// 글 칸에 쓰기: 다시 그리지 않고 보낼 것 · 보내기 버튼만 바꿔요. Enter로도 보내요.
document.getElementById('app').addEventListener('input', (ev) => {
  if (ev.target.id !== 'chat-input') return;
  Chat.pick = ev.target.value ? { kind: 'text', value: ev.target.value } : null;
  const emoji = document.querySelector('.field-emoji');
  if (emoji) emoji.remove();
  ev.target.placeholder = '보낼 말을 쓰거나 골라요';
  Chat._paintOnline();
});
document.getElementById('app').addEventListener('keydown', (ev) => {
  if (ev.target.id !== 'chat-input' || ev.key !== 'Enter' || ev.isComposing) return;
  ev.preventDefault();
  const send = document.querySelector('[data-chat-send]');
  if (send && !send.disabled) Chat.sendPicked();
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
