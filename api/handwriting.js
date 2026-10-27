/* =========================================================================
 * api/handwriting.js — 손글씨 읽기 도우미 (Vercel 서버 함수 + Gemini)
 *
 *  - 기기 안 인식(js/recognize.js)이 확신하지 못할 때만 불려요.
 *  - 받는 것: 손글씨 그림 한 장(흰 바탕 · 검은 글씨 PNG), 종류(digits 숫자 · hangul 한글), 칸 수.
 *    아이 이름 · 아이디 · 문제 · 정답은 보내지 않아요. (정답을 알면 답에 맞춰 읽을 수 있어서)
 *  - 돌려주는 것: 읽은 후보 최대 3개 { candidates: [{ text, confidence }] }
 *    앱은 확신이 높을 때만 그대로 쓰고, 아니면 아이에게 "이 숫자 맞아?"로 물어봐요.
 *  - 환경 변수: GEMINI_API_KEY (필수), GEMINI_MODEL (선택) — api/topics.js와 같아요.
 *  - 아이 손글씨가 구글 서버로 가므로 Gemini 유료 등급 키를 쓰세요. (무료 등급은 데이터를 개선에 쓸 수 있어요)
 * ========================================================================= */

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const MODELS = [...new Set([MODEL, 'gemini-flash-latest'])];
const MAX_IMAGE = 200 * 1024; // 데이터 URL 길이 (작게 줄여서 보내요)

const PROMPT = {
  digits: (cells) =>
    `이 그림은 초등학교 저학년 아이가 손으로 쓴 숫자예요. 칸이 ${cells}개라서 숫자 ${cells}자리를 썼을 가능성이 높아요.\n` +
    '보이는 그대로 읽어 주세요. 계산하거나 고치지 마세요. 헷갈리면 비슷한 후보를 함께 주세요. (최대 3개)\n' +
    'confidence는 0~1 사이 확신도예요.',
  hangul: () =>
    '이 그림은 초등학교 저학년 아이가 손으로 쓴 한글이에요. 보이는 그대로 읽어 주세요. 맞춤법을 고치지 마세요.\n' +
    '헷갈리면 비슷한 후보를 함께 주세요. (최대 3개) confidence는 0~1 사이 확신도예요.',
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'origin' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'no-key' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const image = String(body.image || '');
  const kind = body.kind === 'hangul' ? 'hangul' : 'digits';
  const cells = Math.min(6, Math.max(1, Number(body.cells) || 1));
  const m = image.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m || image.length > MAX_IMAGE) return res.status(400).json({ error: 'image' });

  const ask = (model) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(7000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/png', data: m[1] } }, { text: PROMPT[kind](cells) }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 200,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: { candidates: { type: 'ARRAY', items: { type: 'OBJECT', properties: { text: { type: 'STRING' }, confidence: { type: 'NUMBER' } }, required: ['text', 'confidence'] } } },
            required: ['candidates'],
          },
        },
      }),
    });

  try {
    let r = null;
    for (const model of MODELS) {
      try {
        r = await ask(model);
      } catch (e) {
        r = null;
        continue;
      }
      if (![429, 500, 503].includes(r.status)) break;
    }
    if (!r || !r.ok) return res.status(503).json({ error: 'gemini', status: r && r.status });
    const data = await r.json();
    const text = (((data.candidates || [])[0] || {}).content || { parts: [] }).parts.map((p) => p.text || '').join('');
    const out = (JSON.parse(text).candidates || [])
      .map((c) => ({ text: String(c.text || '').replace(/\s+/g, ''), confidence: Math.max(0, Math.min(1, Number(c.confidence) || 0)) }))
      .filter((c) => c.text && (kind === 'hangul' ? /^[가-힣ㄱ-ㅎㅏ-ㅣ]{1,10}$/.test(c.text) : /^\d{1,6}$/.test(c.text)))
      .slice(0, 3);
    return res.status(200).json({ candidates: out });
  } catch (e) {
    console.error('handwriting', e && e.message);
    return res.status(503).json({ error: 'failed' });
  }
};

module.exports.config = { maxDuration: 20 };
