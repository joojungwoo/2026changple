/* =========================================================================
 * speech.js — 읽어 주기 (기기에 들어 있는 음성만 써요. 서버 · API 키 필요 없음)
 *
 *  - 기기마다 들어 있는 한국어 음성이 달라요. (맥/아이폰: 유나 · Eddy · Reed …,
 *    윈도우 Edge: SunHi · InJoon · Hyunsu …, 안드로이드/크롬: Google 한국의)
 *    아이 목소리가 따로 있는 기기는 거의 없어서, 친구마다 남/여 음성을 고르고
 *    목소리 높이(pitch)를 올려 아이처럼 들리게 해요. 친구마다 높이 · 빠르기가 조금씩 달라요.
 *  - voice: { g: 'f' | 'm', pitch, rate } (js/friends.js FRIEND_CAST의 voice). 없으면 설명하는 목소리.
 *
 *  - Speech.read([{ text, el, voice? }]) : 차례로 읽고, 읽는 동안 그 부분(el)에 .reading 표시를 해요.
 *  - 그림 문자(이모지)는 읽지 않고, 기호는 말로 바꿔 읽어요. (+ → 더하기, ❓ → 몇)
 * ========================================================================= */

/** 음성 이름 우선순위 (앞에 있을수록 먼저). 아이 목소리(SeoHyeon · JiMin)가 있으면 그걸 먼저 써요. */
const VOICE_PREF = {
  f: ['SeoHyeon', 'JiMin', 'SunHi', 'Yuna', '유나', 'Google', 'Sora', '소라', 'Heami', 'Shelley', 'Sandy', 'Flo'],
  m: ['Hyunsu', 'InJoon', 'Minsu', 'GookMin', 'Eddy', 'Reed', 'Rocko', 'BongJin'],
};
const VOICE_SKIP = /Grandma|Grandpa|SoonBok|BongJin/i;
/** 설명(상황 글) 목소리 */
const NARR_VOICE = { g: 'f', pitch: 1, rate: 1 };

const Speech = {
  ok: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
  rate: 0.9,
  _voices: [],
  _queue: [],
  _el: null,
  voice: null, // 지금 화면 친구의 목소리 { g, pitch, rate }

  _pickVoice() {
    if (!this.ok) return;
    this._voices = speechSynthesis.getVoices().filter((v) => /^ko/i.test(v.lang) && !VOICE_SKIP.test(v.name));
  },

  /** 남/여에 맞는 기기 음성. 그 성별 음성이 없으면 다른 한국어 음성 (높이로 구분해요) */
  _voiceFor(g) {
    const vs = this._voices;
    if (!vs.length) return { v: null, same: true };
    for (const name of VOICE_PREF[g] || []) {
      const v = vs.find((x) => x.name.includes(name));
      if (v) return { v, same: true };
    }
    const other = g === 'm' ? 'f' : 'm';
    for (const name of VOICE_PREF[other]) {
      const v = vs.find((x) => x.name.includes(name));
      if (v) return { v, same: false };
    }
    return { v: vs[0], same: false };
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

  /** @param parts [{ text, el?, voice? }] — 앞의 것을 끝까지 읽고 다음 것을 읽어요. voice: null이면 설명 목소리 */
  read(parts) {
    if (!this.ok) return false;
    this.stop();
    this._queue = parts.map((p) => ({ text: this.clean(p.text), el: p.el, voice: p.voice === undefined ? this.voice : p.voice })).filter((p) => p.text);
    this._next();
    return true;
  },

  readEl(el) {
    return this.read([{ text: el.innerText || el.textContent, el }]);
  },

  _next() {
    const part = this._queue.shift();
    if (!part) return this._mark(null);
    const prof = part.voice && typeof part.voice === 'object' ? part.voice : NARR_VOICE;
    const { v, same } = this._voiceFor(prof.g);
    const u = new SpeechSynthesisUtterance(part.text);
    u.lang = 'ko-KR';
    if (v) u.voice = v;
    // 성별에 맞는 음성이 없으면: 남자 친구는 높이를 덜 올리고, 여자 친구는 더 올려 구분해요.
    let pitch = prof.pitch || 1;
    if (!same) pitch += prof.g === 'm' ? -0.25 : 0.15;
    u.pitch = Math.max(0.5, Math.min(2, pitch));
    u.rate = Math.max(0.5, Math.min(1.6, this.rate * (prof.rate || 1)));
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
