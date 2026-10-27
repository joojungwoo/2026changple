/* =========================================================================
 * speech.js — 읽어 주기 (브라우저에 들어 있는 음성, 인터넷 · 비용 없음)
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
    this._mark(null);
    if (this.ok) speechSynthesis.cancel();
  },

  /** @param parts [{ text, el? }] — 앞의 것을 끝까지 읽고 다음 것을 읽어요. */
  read(parts) {
    if (!this.ok) return false;
    this.stop();
    this._queue = parts.map((p) => ({ text: this.clean(p.text), el: p.el })).filter((p) => p.text);
    this._next();
    return true;
  },

  readEl(el) {
    return this.read([{ text: el.innerText || el.textContent, el }]);
  },

  _next() {
    const part = this._queue.shift();
    if (!part) return this._mark(null);
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
