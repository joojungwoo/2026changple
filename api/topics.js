/* =========================================================================
 * api/topics.js — 새싹 챗봇: 채팅 주제 추천 (Vercel 서버 함수 + Gemini)
 *
 *  - 브라우저는 이 함수만 불러요. Gemini API 키는 Vercel 환경 변수에만 있어요.
 *      GEMINI_API_KEY  (필수)  Google AI Studio에서 만든 키
 *      GEMINI_MODEL    (선택)  기본값 gemini-flash-latest (항상 최신 Flash 모델)
 *  - 아이들이 나눈 대화나 이름은 보내지 않아요. "주제 몇 개 만들어 줘"만 물어봐요.
 *  - 한 번에 주제 여러 개를 받아 브라우저가 돌려 쓰므로 호출 수가 적어요.
 *  - 키가 없거나 Gemini가 실패하면 503을 돌려주고, 앱은 준비해 둔 주제(chat.js)로 대신해요.
 * ========================================================================= */

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
/** 모델이 붐벼서(429·500·503) 실패하면 차례로 다음 모델에게 물어봐요. */
const MODELS = [...new Set([MODEL, 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite'])];
const COUNT = 8;
const MAX_LEN = 40;

const SYSTEM = `너는 초등학교 1~3학년 아이들의 채팅을 도와주는 "새싹이"야.
친구와 둘이 이야기할 때 쓸 수 있는 대화 주제를 추천해 줘.

규칙
- 한 문장, 공백 포함 ${MAX_LEN}자 이내. 쉬운 낱말만 써.
- 반드시 "~에 대해 이야기해 볼까요?" 또는 "~ 물어보세요!" 모양으로 끝내.
- 학교생활, 놀이, 음식, 동물, 취미, 오늘 기분처럼 누구나 편하게 말할 수 있는 주제만.
- 집 주소, 전화번호, 가족 사정, 성적, 외모, 돈, 무서운 것, 연애, 싸움처럼
  개인 정보를 묻거나 속상할 수 있는 주제는 절대 쓰지 마.
- 주제끼리 서로 겹치지 않게 해.`;

/** 추천 주제가 규칙에 맞는지 서버에서도 한 번 더 확인해요. */
function clean(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map((t) => String(t || '').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length >= 6 && t.length <= MAX_LEN && /(볼까요\?|보세요!)$/.test(t))
    .filter((t) => !/[<>{}]|https?:|전화|주소|비밀번호/.test(t))
    .filter((t) => (seen.has(t) ? false : seen.add(t)));
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });

  // 다른 사이트가 이 함수를 끌어다 쓰지 못하게 해요. (주소창에서 직접 열면 Origin이 없어요.)
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'origin' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'no-key' });

  try {
    const ask = (model) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(7000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: `대화 주제 ${COUNT + 4}개를 추천해 줘.` }] }],
        generationConfig: {
          temperature: 1,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json',
          responseSchema: { type: 'ARRAY', items: { type: 'STRING' } },
        },
      }),
      });

    let r = null;
    let used = MODEL;
    for (const model of MODELS) {
      used = model;
      try {
        r = await ask(model);
      } catch (e) {
        r = null; // 시간 초과 → 다음 모델
        continue;
      }
      if (![429, 500, 503].includes(r.status)) break;
    }
    if (!r) return res.status(503).json({ error: 'timeout' });
    if (!r.ok) {
      // 원인을 바로 알 수 있게 Gemini가 돌려준 상태와 설명을 함께 알려 줘요. (키는 들어 있지 않아요.)
      const body = await r.text();
      let reason = '';
      try { reason = JSON.parse(body).error.message; } catch (e) { reason = body; }
      console.error('gemini', used, r.status, body.slice(0, 300));
      return res.status(503).json({ error: 'gemini', status: r.status, model: used, reason: String(reason).slice(0, 200) });
    }
    const data = await r.json();
    const text = (((data.candidates || [])[0] || {}).content || { parts: [] }).parts.map((p) => p.text || '').join('');
    const topics = clean(JSON.parse(text)).slice(0, COUNT);
    if (topics.length < 3) return res.status(503).json({ error: 'empty' });
    return res.status(200).json({ topics });
  } catch (e) {
    console.error('topics', e && e.message);
    return res.status(503).json({ error: 'failed' });
  }
};

// 모델 세 개를 차례로 물어볼 수 있게 실행 시간을 넉넉히 둬요.
module.exports.config = { maxDuration: 30 };
