/* =========================================================================
 * api/tts.js — 친구 목소리 읽어 주기 (Vercel 서버 함수 + Typecast)
 *
 *  - 브라우저는 { text, voice } 만 보내요. voice는 Typecast 성우의 한국어 이름이에요. (아래 VOICES)
 *  - Typecast API 키는 Vercel 환경 변수에만 있어요.
 *      TYPECAST_API_KEY  (필수)  https://typecast.ai 개발자 페이지에서 만든 키
 *      TYPECAST_MODEL    (선택)  기본값 ssfm-v31
 *  - 성우 이름 → voice_id는 처음 한 번 성우 목록(/v3/voices)에서 찾아 기억해요.
 *  - 키가 없거나 실패하면 503을 돌려주고, 앱은 기기에 들어 있는 목소리로 대신 읽어요.
 * ========================================================================= */

const MODEL = process.env.TYPECAST_MODEL || 'ssfm-v31';
const API = 'https://api.typecast.ai';
/** 친구들에게 붙인 성우 (js/friends.js의 voice) — 이 이름만 받아요. */
const VOICES = ['서윤', '호빈이', '하준', '수아', '하율', '채린', '류은', '민수'];
const MAX_LEN = 300;

let voiceIds = null; // { 이름: voice_id }

async function loadVoices(key) {
  if (voiceIds) return voiceIds;
  const r = await fetch(`${API}/v3/voices?model=${encodeURIComponent(MODEL)}`, { headers: { 'X-API-KEY': key } });
  if (!r.ok) throw new Error(`voices ${r.status}`);
  const list = await r.json();
  const map = {};
  (Array.isArray(list) ? list : list.voices || list.result || []).forEach((v) => {
    const name = v.voice_name && typeof v.voice_name === 'object' ? v.voice_name.kor : v.voice_name;
    if (name && VOICES.includes(String(name).trim()) && !map[name]) map[String(name).trim()] = v.voice_id;
  });
  voiceIds = map;
  return map;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 돼요.' });
  const key = process.env.TYPECAST_API_KEY;
  if (!key) return res.status(503).json({ error: 'TYPECAST_API_KEY가 없어요.' });
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  const text = String((body && body.text) || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
  const voice = String((body && body.voice) || '').trim();
  if (!text || !VOICES.includes(voice)) return res.status(400).json({ error: '읽을 글이나 목소리 이름이 맞지 않아요.' });
  try {
    const ids = await loadVoices(key);
    const voiceId = ids[voice];
    if (!voiceId) return res.status(503).json({ error: `성우 "${voice}"를 찾지 못했어요.` });
    const r = await fetch(`${API}/v1/text-to-speech`, {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voice_id: voiceId,
        text,
        model: MODEL,
        language: 'kor',
        prompt: { emotion_type: 'preset', emotion_preset: 'normal' },
        output: { audio_format: 'mp3' },
      }),
    });
    if (!r.ok) return res.status(503).json({ error: `Typecast ${r.status}` });
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', r.headers.get('content-type') || 'audio/mpeg');
    // 같은 대사는 브라우저가 다시 받지 않게 (대사는 바뀌지 않아요)
    res.setHeader('Cache-Control', 'public, max-age=604800');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(503).json({ error: String(e.message || e) });
  }
};
