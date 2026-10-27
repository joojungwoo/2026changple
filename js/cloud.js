/* =========================================================================
 * cloud.js — 수파베이스 연결 (계정 · 학습 기록 · 지도자)
 *
 *  - config.js에 주소와 키가 있으면 켜져요(Cloud.on). 없으면 예전처럼 이 기기 안에서만 동작해요.
 *  - 앱 화면은 Store를 바로바로(동기) 불러요. 그래서 로그인할 때 내 정보를 서버에서 받아
 *    메모리(Cloud.mem)에 두고, 바뀌면 잠깐 모았다가 서버로 올려요(save → push).
 *  - 학생: 내 학습 기록 하나(JSON)를 올리고 받아요.
 *    지도자: 맡은 학생들의 이름 · 학습 기록을 받아 리포트를 만들어요. (바꾸지는 못해요)
 *  - 표와 보안 규칙: supabase/schema.sql
 *
 *  로그인
 *  - 아이디를 "아이디@emailDomain" 가짜 이메일로 바꿔 수파베이스 Auth에 가입해요.
 *  - 아이들이 4자 비밀번호를 쓸 수 있게, 수파베이스 최소 길이(6자)를 넘도록 앞에 "hg:"를 붙여 보내요.
 *  - 탭마다 다른 친구로 로그인할 수 있게, 로그인 정보는 탭(sessionStorage)에 두고
 *    "로그인 상태 유지"를 켰을 때만 기기(localStorage)에 둬요.
 * ========================================================================= */

const CLOUD_CFG = window.HG_CONFIG || {};
const CLOUD_AUTH_KEY = 'hangeoleum-auth';
const CLOUD_MODE_KEY = 'hangeoleum-auth-mode'; // '1' 기기에 기억 · '0' 이 탭에서만 · 없음 = 새 탭
const CLOUD_PUSH_MS = 800;
const CLOUD_LEADER_REFRESH_MS = 30000;

/** 탭마다 로그인을 따로 기억하는 저장소 (supabase-js의 storage 자리에 넣어요) */
const CloudAuthStorage = {
  _mode() {
    try { return sessionStorage.getItem(CLOUD_MODE_KEY); } catch (e) { return '0'; }
  },
  setMode(keep) {
    try {
      sessionStorage.setItem(CLOUD_MODE_KEY, keep ? '1' : '0');
      if (!keep) localStorage.removeItem(CLOUD_AUTH_KEY);
      sessionStorage.removeItem(CLOUD_AUTH_KEY);
    } catch (e) { /* 저장소를 못 쓰면 이번 탭에서만 로그인돼요. */ }
  },
  getItem(k) {
    try {
      const mode = this._mode();
      if (mode === '1') return localStorage.getItem(k);
      if (mode === '0') return sessionStorage.getItem(k);
      // 새 탭: 기기에 기억한 로그인이 있으면 이어서 써요.
      const v = localStorage.getItem(k);
      if (v) sessionStorage.setItem(CLOUD_MODE_KEY, '1');
      return v;
    } catch (e) {
      return null;
    }
  },
  setItem(k, v) {
    try {
      if (this._mode() === '1') localStorage.setItem(k, v);
      else sessionStorage.setItem(k, v);
    } catch (e) { /* 다음 로그인 때 다시 받아요. */ }
  },
  removeItem(k) {
    try {
      if (this._mode() === '1') localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    } catch (e) { /* 지울 것이 없어요. */ }
  },
};

/** 서버 오류를 아이가 읽을 수 있는 말로 바꿔요. */
function cloudError(e, fallback) {
  const msg = String((e && (e.message || e.error_description)) || e || '');
  if (/fetch|network|Load failed|timeout/i.test(msg)) return new Error('인터넷 연결을 확인하고 다시 해 주세요.');
  return new Error(fallback || '문제가 생겼어요. 잠시 후 다시 해 주세요.');
}

const Cloud = {
  on: !!(CLOUD_CFG.supabaseUrl && CLOUD_CFG.supabaseKey && window.supabase && window.supabase.createClient),
  sb: null,
  uid: null, // 내 수파베이스 사용자 id (uuid)
  mem: null, // Store가 읽고 쓰는 메모리 DB { users, data, inquiries, session }
  uuidOf: {}, // 아이디 → uuid
  loginOf: {}, // uuid → 아이디
  _pushed: '', // 마지막으로 올린 학습 기록 (같으면 다시 올리지 않아요)
  _timer: null,
  _pulledAt: 0,
  ready: null, // 처음 로그인 정보를 확인하는 동안의 Promise

  _blank() {
    return { users: {}, data: {}, inquiries: [], session: null };
  },

  _email(id) {
    return `${String(id).trim().toLowerCase()}@${CLOUD_CFG.emailDomain || 'hangeoleum.app'}`;
  },

  _pw(pw) {
    return `hg:${pw}`;
  },

  init() {
    this.mem = this._blank();
    if (!this.on) {
      this.ready = Promise.resolve();
      return;
    }
    this.sb = window.supabase.createClient(CLOUD_CFG.supabaseUrl, CLOUD_CFG.supabaseKey, {
      auth: { storage: CloudAuthStorage, storageKey: CLOUD_AUTH_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    // 예전에 로그인해 둔 것이 있으면 받아 와요. 실패해도 로그인 화면으로 가면 돼요.
    this.ready = this.pull().catch((e) => console.warn('cloud restore', e && e.message));
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && this.flush());
  },

  /* ---------------- 받아 오기 ---------------- */
  _addUser(db, p, priv) {
    this.uuidOf[p.login_id] = p.id;
    this.loginOf[p.id] = p.login_id;
    db.users[p.login_id] = {
      id: p.login_id,
      role: p.role,
      name: p.name,
      birth: (priv && priv.birth) || '',
      profile: { name: p.name, grade: p.grade },
      settings: { motion: p.motion !== false },
      students: [],
      cloud: true,
    };
    return db.users[p.login_id];
  },

  async _q(promise) {
    const { data, error } = await promise;
    if (error) throw cloudError(error);
    return data;
  },

  /** 로그인한 사람의 정보를 서버에서 모두 받아 메모리에 둬요. 로그인 안 했으면 null. */
  async pull() {
    const { data: { session } } = await this.sb.auth.getSession();
    if (!session) {
      this._reset();
      return null;
    }
    const uid = session.user.id;
    const sb = this.sb;
    const [p, priv] = await Promise.all([
      this._q(sb.from('profiles').select('*').eq('id', uid).maybeSingle()),
      this._q(sb.from('profile_private').select('id,birth').eq('id', uid).maybeSingle()),
    ]);
    if (!p) throw new Error('계정 정보를 찾지 못했어요. 다시 로그인해 주세요.');

    const db = this._blank();
    const me = this._addUser(db, p, priv);
    if (p.role === 'student') {
      const row = await this._q(sb.from('learning_data').select('data').eq('user_id', uid).maybeSingle());
      db.data[p.login_id] = (row && row.data) || {};
      this._pushed = JSON.stringify(db.data[p.login_id]);
    } else {
      const links = await this._q(sb.from('leader_students').select('student_id').eq('leader_id', uid).order('created_at'));
      const ids = links.map((l) => l.student_id);
      const [ps, privs, datas, inq] = await Promise.all([
        ids.length ? this._q(sb.from('profiles').select('*').in('id', ids)) : [],
        ids.length ? this._q(sb.from('profile_private').select('id,birth').in('id', ids)) : [],
        ids.length ? this._q(sb.from('learning_data').select('user_id,data').in('user_id', ids)) : [],
        this._q(sb.from('inquiries').select('text,created_at').eq('leader_id', uid)),
      ]);
      ids.forEach((id) => {
        const sp = ps.find((x) => x.id === id);
        if (!sp) return;
        this._addUser(db, sp, privs.find((x) => x.id === id));
        const d = datas.find((x) => x.user_id === id);
        db.data[sp.login_id] = (d && d.data) || {};
        me.students.push(sp.login_id);
      });
      db.inquiries = inq.map((q) => ({ from: p.login_id, text: q.text, at: Date.parse(q.created_at) }));
    }
    db.session = p.login_id;
    this.uid = uid;
    this.mem = db;
    this._pulledAt = Date.now();
    return me;
  },

  _reset() {
    clearTimeout(this._timer);
    this.uid = null;
    this.mem = this._blank();
    this._pushed = '';
  },

  /** 지도자 화면에 들어올 때 학생 기록을 가끔 새로 받아요. 바뀌었으면 done()을 불러요. */
  refreshLeader(done) {
    if (!this.on || !this.uid || this._refreshing || Date.now() - this._pulledAt < CLOUD_LEADER_REFRESH_MS) return;
    const me = this.mem.users[this.mem.session];
    if (!me || me.role !== 'leader') return;
    const before = JSON.stringify(this.mem);
    this._refreshing = true;
    this.pull()
      .then(() => JSON.stringify(this.mem) !== before && done())
      .catch(() => {})
      .then(() => (this._refreshing = false));
  },

  /* ---------------- 올리기 ---------------- */
  /** Store._write가 불러요. 잠깐 모았다가 한 번에 올려요. */
  save() {
    if (!this.uid) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.push(), CLOUD_PUSH_MS);
  },

  async push() {
    clearTimeout(this._timer);
    const db = this.mem;
    const me = db.session && db.users[db.session];
    if (!this.uid || !me || me.role !== 'student') return;
    const json = JSON.stringify(db.data[db.session] || {});
    if (json === this._pushed) return;
    const uid = this.uid;
    const { error } = await this.sb.from('learning_data').upsert({ user_id: uid, data: JSON.parse(json) });
    if (error) {
      console.warn('cloud push', error.message);
      if (!this._warned && typeof toast === 'function') toast('공부한 기록을 아직 못 올렸어요. 인터넷이 되면 다시 올릴게요.', 'error');
      this._warned = true;
      if (this.uid === uid) this._timer = setTimeout(() => this.push(), 5000);
      return;
    }
    this._warned = false;
    this._pushed = json;
  },

  flush() {
    if (this._timer) return this.push();
    return Promise.resolve();
  },

  /* ---------------- 계정 ---------------- */
  async signUp(f) {
    CloudAuthStorage.setMode(false);
    const { data, error } = await this.sb.auth.signUp({
      email: this._email(f.id),
      password: this._pw(f.password),
      options: { data: { login_id: f.id, role: f.role, name: f.name, birth: f.birth } },
    });
    if (error) {
      if (/already|registered|exists/i.test(error.message)) throw new Error('이미 쓰고 있는 아이디예요. 다른 아이디를 정해 주세요.');
      if (/rate|too many/i.test(error.message)) throw new Error('가입이 너무 많이 몰렸어요. 잠시 후 다시 해 주세요.');
      console.warn('signup', error.message);
      throw cloudError(error, '가입하지 못했어요. 잠시 후 다시 해 주세요.');
    }
    if (!data.session) throw new Error('가입은 됐지만 로그인하지 못했어요. (관리자: 수파베이스에서 "Confirm email"을 꺼 주세요)');
    return this.pull();
  },

  async logIn(role, id, password, keep) {
    CloudAuthStorage.setMode(!!keep);
    const { error } = await this.sb.auth.signInWithPassword({ email: this._email(id), password: this._pw(password) });
    if (error) {
      if (/invalid|credentials/i.test(error.message)) throw new Error('아이디 또는 비밀번호가 맞지 않아요. 다시 입력해 주세요.');
      throw cloudError(error);
    }
    const me = await this.pull();
    if (!me || me.role !== role) {
      await this.signOut();
      throw new Error('아이디 또는 비밀번호가 맞지 않아요. 다시 입력해 주세요.');
    }
    return me;
  },

  async signOut() {
    await this.flush().catch(() => {});
    this._reset();
    await this.sb.auth.signOut({ scope: 'local' }).catch(() => {});
    CloudAuthStorage.setMode(false);
  },

  /** 예전에 이 기기에만 있던 학습 기록을 서버로 옮겨요. */
  async adoptData(data) {
    if (!this.mem.session) return;
    this.mem.data[this.mem.session] = data;
    this._pushed = '';
    await this.push();
  },

  /* ---------------- 지도자 ---------------- */
  async addStudent(lid) {
    const { data, error } = await this.sb.rpc('add_student', { lid });
    if (error) {
      if (/already/.test(error.message)) throw new Error('이미 추가한 학생이에요.');
      if (/no-student/.test(error.message)) throw new Error('그 아이디의 학생을 찾지 못했어요. 아이디를 다시 확인해 주세요.');
      throw cloudError(error);
    }
    const p = Array.isArray(data) ? data[0] : data;
    const [priv, row] = await Promise.all([
      this._q(this.sb.from('profile_private').select('id,birth').eq('id', p.id).maybeSingle()),
      this._q(this.sb.from('learning_data').select('data').eq('user_id', p.id).maybeSingle()),
    ]);
    this._addUser(this.mem, p, priv);
    this.mem.data[p.login_id] = (row && row.data) || {};
    this.mem.users[this.mem.session].students.push(p.login_id);
    return p.login_id;
  },

  async removeStudent(loginId) {
    const sid = this.uuidOf[loginId];
    if (sid) await this._q(this.sb.from('leader_students').delete().eq('leader_id', this.uid).eq('student_id', sid));
    const me = this.mem.users[this.mem.session];
    me.students = me.students.filter((s) => s !== loginId);
  },

  async setStudentMotion(loginId, on) {
    const { error } = await this.sb.rpc('set_student_motion', { sid: this.uuidOf[loginId], on_: !!on });
    if (error) throw cloudError(error, '설정을 바꾸지 못했어요. 잠시 후 다시 해 주세요.');
    const u = this.mem.users[loginId];
    u.settings = { ...(u.settings || {}), motion: !!on };
  },

  async addInquiry(text) {
    const row = await this._q(this.sb.from('inquiries').insert({ text }).select('text,created_at').single());
    this.mem.inquiries.push({ from: this.mem.session, text: row.text, at: Date.parse(row.created_at) });
  },
};

Cloud.init();
