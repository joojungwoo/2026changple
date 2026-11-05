/* =========================================================================
 * speech.js — 읽어 주기
 *
 *  - 친구마다 목소리가 달라요: Typecast 성우(api/tts.js)로 읽고, 서버가 없거나 실패하면
 *    브라우저에 들어 있는 음성으로 대신 읽어요. (한 번 실패하면 그 뒤로는 바로 기기 음성)
 *  - parts의 voice: 성우 이름 (js/friends.js FRIEND_CAST의 voice). 없으면 Speech.voice(지금 친구)를 써요.
 *
 *  - Speech.read([{ text, el }]) : 차례로 읽고, 읽는 동안 그 부분(el)에 .reading 표시를 해요.
 *  - 그림 문자(이모지)는 읽지 않고, 기호는 말로 바꿔 읽어요. (+ → 더하기, ❓ → 몇)
 *  - 속도는 프로필의 읽어 주기 속도를 따라요. (Speech.rate)
 * ========================================================================= */

const Speech = {
  ok: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
  rate: 0.9,
  _voice: null,
  _queue: [],
  _el: null,
  voice: null, // 지금 화면 친구의 목소리 (성우 이름)
  remote: true, // Typecast 서버를 써 볼지 (실패하면 꺼져요)
  _audio: null,
  _cache: new Map(), // "목소리|글" → 소리 주소
  _token: 0,

  _pickVoice() {
    if (!this.ok) return;
    const vs = speechSynthesis.getVoices().filter((v) => /^ko/i.test(v.lang));
    this._voice = vs.find((v) => v.localService) || vs[0] || null;
  },

  /** 읽기 좋게 다듬어요. */
  clean(text) {
    return String(text || '')
      .replace(/(\d+)\s*\/\s*(\d+)/g, '$2분의 $1')
      .replace(/(\d)\s*[+＋➕]\s*(?=\d)/g, '$1 더하기 ')
      .replace(/(\d)\s*[−\-]\s*(?=\d)/g, '$1 빼기 ')
      .replace(/(\d)\s*[×x]\s*(?=\d)/g, '$1 곱하기 ')
      .replace(/(\d)\s*÷\s*(?=\d)/g, '$1 나누기 ')
      .replace(/=\s*(❓|\?|□)/g, '는 몇')
      .replace(/=/g, '는')
      .replace(/❓|□/g, ' 몇 ')
      .replace(/[①②③④⑤]/g, (c) => `${'①②③④⑤'.indexOf(c) + 1}, `)
      .replace(/→/g, ', ')
      .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}▬■□◆●○✖]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  _mark(el) {
    if (this._el) this._el.classList.remove('reading');
    this._el = el || null;
    if (this._el) this._el.classList.add('reading');
  },

  stop() {
    this._queue = [];
    this._token += 1;
    this._mark(null);
    if (this._audio) {
      this._audio.pause();
      this._audio = null;
    }
    if (this.ok) speechSynthesis.cancel();
  },

  /** @param parts [{ text, el? }] — 앞의 것을 끝까지 읽고 다음 것을 읽어요. */
  read(parts) {
    if (!this.ok && !this.remote) return false;
    this.stop();
    this._queue = parts.map((p) => ({ text: this.clean(p.text), el: p.el, voice: p.voice === undefined ? this.voice : p.voice })).filter((p) => p.text);
    this._next();
    return true;
  },

  /** 친구 목소리(Typecast)로 읽기. 안 되면 false */
  async _remote(part, token) {
    if (!this.remote || !part.voice || location.protocol === 'file:') return false;
    const key = `${part.voice}|${part.text}`;
    try {
      let url = this._cache.get(key);
      if (!url) {
        const r = await fetch('api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: part.text, voice: part.voice }) });
        if (!r.ok || !/audio/.test(r.headers.get('content-type') || '')) throw new Error(`tts ${r.status}`);
        url = URL.createObjectURL(await r.blob());
        this._cache.set(key, url);
      }
      if (token !== this._token) return true; // 그사이에 멈췄어요
      const a = new Audio(url);
      this._audio = a;
      this._mark(part.el);
      a.onended = a.onerror = () => {
        if (token !== this._token) return;
        this._audio = null;
        if (this._queue.length) this._next();
        else this._mark(null);
      };
      await a.play();
      return true;
    } catch (e) {
      this.remote = false; // 서버가 없으면 (예: python http.server) 기기 음성으로
      return false;
    }
  },

  readEl(el) {
    return this.read([{ text: el.innerText || el.textContent, el }]);
  },

  async _next() {
    const part = this._queue.shift();
    if (!part) return this._mark(null);
    const token = this._token;
    if (await this._remote(part, token)) return;
    if (token !== this._token || !this.ok) return;
    const u = new SpeechSynthesisUtterance(part.text);
    u.lang = 'ko-KR';
    u.rate = this.rate;
    if (this._voice) u.voice = this._voice;
    u.onstart = () => this._mark(part.el);
    u.onend = u.onerror = () => {
      if (this._queue.length) this._next();
      else this._mark(null);
    };
    speechSynthesis.speak(u);
  },
};

if (Speech.ok) {
  Speech._pickVoice();
  speechSynthesis.addEventListener('voiceschanged', () => Speech._pickVoice());
}
