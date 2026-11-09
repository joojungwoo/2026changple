/* =========================================================================
 * friends.js — 가상 친구 · 학교생활 시나리오 · 대사
 *
 *  - 대단원 하나 = 새 친구 한 명. 친구는 만나는 차례대로 정해져요. (첫 친구는 늘 지아)
 *  - 시나리오 = 이야기 장면(대사) + 사회성 선택지 + 이야기 속 교과 문제.
 *      SCRIPTS: 시연용으로 직접 쓴 이야기 (1학기 수학 다섯 단원: 첫 등교 → 여름방학식, 분식집 장면)
 *      나머지 단원은 단원 개념 · 사회성 주제로 이야기를 만들어요. (buildGeneric)
 *  - 선택지는 점수와 상관없어요. 무엇을 골라도 이야기는 이어지고, 친구 반응만 달라요. (보고서 2.2.1)
 *  - 칭찬은 정답보다 노력과 과정을 구체적으로 말해요. (보고서 2.2.1.2)
 *  - 대사의 {부름}은 부르는 말(서영아 · 지우야), {이름}은 문장 속 이름(서영이 · 지우), {내이름}은 "내 이름은 ~야"예요.
 * ========================================================================= */

/** 친구 생김새: 작은 그림(교실 자리 · 문제 화면) + 큰 그림(대화). 큰 그림이 없으면 작은 그림을 크게 써요.
 *  tint: 같은 그림을 쓰는 친구를 구별하려고 색을 살짝 바꿔요. */
/** 친구 그림: 큰 그림(640px, 대화 화면) · 작은 그림(-s, 200px, 팝업 · 문제 화면)
 *  px: 책상에 앉아 있는 작은 픽셀 그림 (교실 자리 · 방과후교실). 없으면 작은 그림을 써요.
 *  soft: 큰 픽셀 그림을 줄여 만든 것이라 부드럽게 줄여요. */
const CHR = 'assets/school/chars/';
const FRIEND_LOOKS = {
  jia: { sprite: `${CHR}jia-s.png`, portrait: `${CHR}jia.png`, px: `${CHR}jia-px.png` },
  taeo: { sprite: `${CHR}taeo-s.png?v=5`, portrait: `${CHR}taeo.png?v=5`, px: `${CHR}taeo-px.png` },
  yerin: { sprite: `${CHR}yerin-s.png`, portrait: `${CHR}yerin.png`, px: `${CHR}yerin-px.png`, soft: true },
  hyunwoo: { sprite: `${CHR}hyunwoo-s.png`, portrait: `${CHR}hyunwoo.png` },
  soyul: { sprite: `${CHR}soyul-s.png`, portrait: `${CHR}soyul.png` },
  doyun: { sprite: `${CHR}doyun-s.png?v=5`, portrait: `${CHR}doyun.png?v=5`, px: `${CHR}doyun-px.png` },
  harin: { sprite: `${CHR}harin-s.png`, portrait: `${CHR}harin.png`, px: `${CHR}harin-px.png`, soft: true },
  sua: { sprite: `${CHR}sua-s.png`, portrait: `${CHR}sua.png`, px: `${CHR}sua-px.png` },
  minjun: { sprite: `${CHR}minjun-s.png`, portrait: `${CHR}minjun.png` },
  dain: { sprite: `${CHR}dain-s.png`, portrait: `${CHR}dain.png` },
};
const FEMALE_LOOKS = new Set(['jia', 'yerin', 'soyul', 'harin', 'sua', 'dain']);
/** 확정 시나리오가 없는 단원의 친구가 돌려 쓰는 모습 (다인 모습을 먼저) */
const EXTRA_LOOKS = ['dain', 'yerin', 'doyun', 'sua', 'taeo', 'harin', 'minjun', 'soyul', 'hyunwoo', 'jia'];

/**
 * 친구들 — 확정 시나리오(story.js)의 아홉 친구. 과목마다 따로예요.
 *  수학: 지아 → 태오 → 예린 → 현우 → 소율 / 국어: 도윤 → 하린 → 수아 → 민준
 *  hello: 처음 만날 때 · like: 좋아하는 것 · voice: 읽어 주기 목소리 (기기 음성 · 남/여 · 높이 · 빠르기, js/speech.js)
 */
const FRIEND_CAST = [
  { id: 'jia', subject: 'math', name: '지아', look: 'jia', persona: '꼼꼼한 계획쟁이, 가끔 걱정이 많아요', hello: '안녕! 나는 지아야. 우리 짝꿍 하자!', like: '계획표 만들기', voice: { g: 'f', pitch: 1.45, rate: 1.05 } },
  { id: 'taeo', subject: 'math', name: '태오', look: 'taeo', persona: '장난꾸러기지만 마음이 따뜻해요', hello: '헤헤, 안녕! 나는 태오야. 재밌는 거 하자!', like: '깜짝 놀이', voice: { g: 'm', pitch: 1.5, rate: 1.12 } },
  { id: 'yerin', subject: 'math', name: '예린', look: 'yerin', persona: '수줍지만 용기를 내고 싶어요', hello: '안녕… 나는 예린이야.', like: '리본 만들기', voice: { g: 'f', pitch: 1.6, rate: 0.95 } },
  { id: 'hyunwoo', subject: 'math', name: '현우', look: 'hyunwoo', persona: '자기 생각을 또렷하게 말해요', hello: '나는 현우야. 할 말 있으면 나한테 해!', like: '무대 꾸미기', voice: { g: 'm', pitch: 1.35, rate: 1.05 } },
  { id: 'soyul', subject: 'math', name: '소율', look: 'soyul', persona: '조용하고 친구를 잘 챙겨요', hello: '저기… 나는 소율이야.', like: '물건 정리', voice: { g: 'f', pitch: 1.55, rate: 0.92 } },
  { id: 'doyun', subject: 'korean', name: '도윤', look: 'doyun', persona: '밝고 먼저 인사해요', hello: '안녕! 나 도윤이야!', like: '친구랑 놀기', voice: { g: 'm', pitch: 1.45, rate: 1.1 } },
  { id: 'harin', subject: 'korean', name: '하린', look: 'harin', persona: '말수가 적지만 속이 깊어요', hello: '…안녕. 나는 하린이야.', like: '책 읽기', voice: { g: 'f', pitch: 1.35, rate: 0.95 } },
  { id: 'sua', subject: 'korean', name: '수아', look: 'sua', persona: '친구를 사귀고 싶어 두근거려요', hello: '안녕! 나는 수아야!', like: '그림일기', voice: { g: 'f', pitch: 1.65, rate: 1.08 } },
  { id: 'minjun', subject: 'korean', name: '민준', look: 'minjun', persona: '궁금한 건 바로 말해요', hello: '나는 민준이야. 궁금한 거 있어?', like: '탐정 놀이', voice: { g: 'm', pitch: 1.4, rate: 1.0 } },
];
/** 예전 버전에서 만난 친구 (저장된 기록을 읽을 때만) */
const LEGACY_CAST = {
  junseo: { name: '준서', look: 'minjun' }, seoa: { name: '서아', look: 'dain' },
  minho: { name: '민호', look: 'hyunwoo' }, yuna: { name: '유나', look: 'yerin' },
};
/** 확정 시나리오가 없는 단원에서 만나는 친구 이름 (과목마다 따로) */
const EXTRA_NAMES = {
  math: ['시우', '다온', '이준', '하윤', '은호', '채아', '로운', '아린', '지호', '나은', '건우', '서진', '예준', '라희', '우진', '도하', '연우', '보미', '주원', '윤슬', '다인', '한결'],
  korean: ['서아', '준서', '유나', '민호', '하랑', '시온', '가온', '나래', '이안', '봄이', '세아', '태린', '해솔', '다솜', '라온', '새봄', '은솔', '하람', '단비', '지안', '로하', '푸름'],
};

/** 재회 요청 (복습할 때가 된 친구) — 과거 친구의 새 부탁으로 */
const REUNION_LINES = ['나랑 또 놀자!', '우리 다시 이야기할까?', '같이 해 보고 싶은 게 있어!', '{부름}, 부탁이 하나 있는데 들어 줄래?', '보고 싶었어! 잠깐 같이 놀자.', '너한테 보여 주고 싶은 게 생겼어!', '{부름}! 오늘 시간 있어?', '도와줄 사람이 너밖에 없어!'];

/** 하던 이야기로 돌아왔을 때 (쉬는 시간 · 나갔다 다시 들어오면) */
const WELCOME_BACK_LINES = ['잘 쉬다 왔어? 다시 재밌게 놀아 볼까?', '{부름}, 왔구나! 기다리고 있었어.', '물 마시고 왔어? 우리 하던 거 마저 하자!', '어서 와! 아까 하던 데부터 이어서 할게.', '짠! 다시 만났다! 준비됐어?', '푹 쉬었어? 나는 너 기다리면서 몸풀기 했어!'];

/** 교실에서 친구가 된 자리를 눌렀을 때 */
const ROOM_TAP_LINES = ['오늘도 반가워!', '우리 또 만날 거지?', '{부름}, 안녕!', '나 지금 쉬는 중이야~', '방과후교실에서 같이 놀자!', '헤헤, 불렀어?'];

/** 방과후교실에서 친구를 눌렀을 때 (자율 복습) */
const AFTERSCHOOL_LINES = ['나랑 또 놀고 싶구나!', '와, 나 찾아왔어? 같이 놀자!', '{부름}! 마침 심심했는데!', '나랑 연습하러 왔구나? 좋아!', '오늘은 뭐 하고 놀까? 내가 문제 준비해 뒀어!', '반가워! 우리 실력 한번 볼까?'];

/**
 * 학생 이름 부르기 (한국어 호격 조사)
 *  - 세 글자 이상 한글 이름이면 성을 빼고 불러요. (금서영 → 서영)
 *  - 부를 때: 받침이 있으면 '아', 없으면 '야' (서영아 · 지우야)
 *  - 문장 속: 받침이 있으면 '이'를 붙여요. (서영이가 · 지우가)
 */
function givenName(name) {
  const n = String(name || '친구').trim();
  return /^[가-힣]{3,4}$/.test(n) ? n.slice(-2) : n;
}
function hasBatchim(word) {
  const w = String(word || '');
  const c = w.charCodeAt(w.length - 1) - 0xac00;
  return c >= 0 && c <= 11171 && c % 28 !== 0;
}
function callName(name) {
  const n = givenName(name);
  return hasBatchim(n) ? `${n}이` : n;
}
function vocative(name) {
  const n = givenName(name);
  return /[가-힣]$/.test(n) ? n + (hasBatchim(n) ? '아' : '야') : n;
}
function fillLine(text, ctx) {
  const f = ctx.friend || {};
  const full = String(ctx.student || '친구').trim();
  const flags = ctx.flags || {};
  return String(text)
    .replace(/\{hello\}/g, f.hello || '안녕!')
    .replace(/\{좋아하는것\}/g, f.like || '노는 거')
    .replace(/\{부름\}/g, vocative(full))
    .replace(/\{내이름\}/g, full + (hasBatchim(full) ? '이야' : '야'))
    .replace(/\{이름\}/g, callName(full))
    .replace(/\{친구\}/g, f.name || '친구')
    .replace(/\{festival_name\}/g, flags.festival_name || '여름 축제');
}

/** 받침에 따라 조사 고르기: josa('도윤', '이', '가') → '도윤이' · josa('지아', '와', '과') → '지아와' */
function josa(word, withBatchim, without) {
  return String(word || '') + (hasBatchim(word) ? withBatchim : without);
}

/* -------------------------- 사회성 상황 선택지 --------------------------
 * 주제마다 장면 몇 개. 선택지 2~3개, 고른 것에 따라 친구가 다르게 반응해요.
 * mood: happy 웃음 · think 생각 · sad 서운함 (서운해도 다음에 어떻게 하면 좋을지 알려 주고 이야기는 이어져요)
 * ------------------------------------------------------------------------ */
const SOCIAL = {
  greet: [
    {
      say: '너는 이름이 뭐야? 나한테도 알려 줄래?',
      options: [
        { text: '"내 이름은 {내이름}! 반가워."', mood: 'happy', reply: ['{부름}! 이름 예쁘다. 우리 이제 친구야!'] },
        { text: '(고개만 끄덕인다)', mood: 'think', reply: ['괜찮아, 처음엔 떨리지? 나도 그랬어.', '다음엔 "안녕!" 하고 손 흔들어 줘. 그럼 나 엄청 기쁠 거야!'] },
        { text: '"너는 뭐 좋아해?" 하고 물어본다', mood: 'happy', reply: ['나? 나는 {좋아하는것} 좋아해! 먼저 물어봐 줘서 고마워.'] },
      ],
    },
    {
      say: '같이 놀 사람? 나랑 같이 할래?',
      options: [
        { text: '"응, 좋아! 같이 하자!"', mood: 'happy', reply: ['야호! 같이 하니까 더 재밌다!'] },
        { text: '"나도 끼워 줄 수 있어?"', mood: 'happy', reply: ['당연하지! 물어봐 줘서 고마워.'] },
        { text: '(혼자 책상만 본다)', mood: 'think', reply: ['혹시 오늘은 쉬고 싶어? 그래도 괜찮아.', '같이 하고 싶을 땐 "나도!"라고 말해 줘. 언제든 기다릴게.'] },
      ],
    },
  ],
  refuse: [
    {
      say: '{부름}, 네 지우개 나 가져도 돼? 나 이거 정말 갖고 싶어!',
      options: [
        { text: '"미안, 이건 내가 쓰는 거야. 빌려줄 수는 있어!"', mood: 'happy', reply: ['아, 그렇구나! 빌려줘서 고마워. 다 쓰고 꼭 돌려줄게.'] },
        { text: '"싫어!" 하고 뺏는다', mood: 'sad', reply: ['앗… 조금 놀랐어.', '"미안, 안 돼"라고 말해 주면 나도 알아들을 수 있어. 내가 먼저 물어봐서 다행이다!'] },
        { text: '(싫지만 그냥 준다)', mood: 'think', reply: ['어? 혹시 싫었어? 표정이 조금 슬퍼 보여.', '싫을 땐 "안 돼"라고 말해도 괜찮아. 그게 나쁜 게 아니야. 자, 돌려줄게!'] },
      ],
    },
    {
      say: '우리 쉬는 시간에 술래잡기 할래? 아니면 그림 그릴래?',
      options: [
        { text: '"나는 그림 그리고 싶어!"', mood: 'happy', reply: ['좋아! 하고 싶은 걸 말해 줘서 고마워. 그럼 그림 먼저 그리자!'] },
        { text: '"네가 하고 싶은 거 하자."', mood: 'think', reply: ['정말? 너도 하고 싶은 거 말해도 돼!', '그럼 오늘은 술래잡기, 다음엔 네가 고르는 거 하자!'] },
      ],
    },
  ],
  empathy: [
    {
      say: '(친구가 시무룩하다) …나 아까 우유를 쏟았어. 다들 쳐다봐서 창피했어.',
      options: [
        { text: '"많이 속상했겠다. 괜찮아?"', mood: 'happy', reply: ['응… 네가 물어봐 주니까 마음이 조금 나아졌어. 고마워.'] },
        { text: '"나도 쏟은 적 있어! 다 괜찮아져."', mood: 'happy', reply: ['정말? 너도? 나만 그런 게 아니구나. 휴, 다행이다.'] },
        { text: '"하하, 웃기다!"', mood: 'sad', reply: ['…나는 조금 슬펐는데.', '속상한 친구한테는 "괜찮아?" 하고 물어봐 주면 좋아. 이제 괜찮아, 같이 가자!'] },
      ],
    },
    {
      say: '나 이번에 줄넘기 처음으로 열 번 했어! 엄청 연습했거든!',
      options: [
        { text: '"우와, 정말 대단하다! 연습 많이 했구나!"', mood: 'happy', reply: ['헤헤, 알아봐 줘서 고마워! 기분 최고야!'] },
        { text: '"나는 스무 번 할 수 있는데?"', mood: 'think', reply: ['아… 그렇구나. 나는 열 번도 엄청 기뻤는데.', '친구가 기뻐할 땐 "잘했다!" 하고 같이 기뻐해 주자. 그럼 둘 다 기분이 좋아져!'] },
      ],
    },
  ],
  together: [
    {
      say: '이거 혼자 옮기기엔 너무 무거워… 어떡하지?',
      options: [
        { text: '"내가 같이 들어 줄게!"', mood: 'happy', reply: ['고마워! 둘이 드니까 하나도 안 무거워!'] },
        { text: '"선생님께 도와 달라고 하자."', mood: 'happy', reply: ['좋은 생각이야! 도움을 부탁하는 것도 용기야.'] },
        { text: '"나 바빠."', mood: 'think', reply: ['아, 그렇구나…', '친구가 힘들어 보이면 "도와줄까?" 하고 물어봐 줘. 지금은 나랑 같이 해 줄래?'] },
      ],
    },
    {
      say: '우리 모둠에서 누가 무슨 일 할지 정해야 해. 너는 뭐 할래?',
      options: [
        { text: '"나는 색칠할게! 너는 오리기 할래?"', mood: 'happy', reply: ['좋아! 나눠서 하니까 금방 끝나겠다!'] },
        { text: '"다 내가 할래!"', mood: 'think', reply: ['와, 열심히 하려는 마음 멋지다!', '그런데 같이 나눠서 하면 더 재밌을 거야. 나도 하나 해도 될까?'] },
      ],
    },
  ],
  calm: [
    {
      say: '(친구가 쌓던 블록이 무너졌다) 으아! 다 무너졌어! 너무 화나!',
      options: [
        { text: '"우리 같이 숨 크게 쉬어 볼까? 후~"', mood: 'happy', reply: ['후~ … 조금 괜찮아졌어. 다시 쌓으면 되지!'] },
        { text: '"내가 같이 다시 쌓아 줄게!"', mood: 'happy', reply: ['정말? 같이 하니까 더 튼튼하게 쌓을 수 있겠다!'] },
        { text: '"블록 차 버려!"', mood: 'think', reply: ['그러면… 블록이 망가질 것 같아.', '화날 땐 숨을 크게 쉬면 마음이 가라앉아. 같이 해 볼래? 후~'] },
      ],
    },
    {
      say: '네가 내 그림 위에 낙서했잖아! (실수로 크레파스가 미끄러졌다)',
      options: [
        { text: '"미안해, 실수였어. 같이 고쳐 볼까?"', mood: 'happy', reply: ['아, 실수였구나. 사과해 줘서 고마워. 같이 고치면 더 예쁠 거야!'] },
        { text: '"내 잘못 아니야!"', mood: 'sad', reply: ['…나 진짜 속상해.', '실수여도 "미안해"라고 하면 마음이 풀려. 다시 말해 줄래? …고마워, 이제 괜찮아.'] },
      ],
    },
  ],
};
const SOCIAL_ORDER = ['greet', 'refuse', 'empathy', 'together', 'calm'];
const SOCIAL_NAME = { greet: '인사 · 자기소개', refuse: '의견 표현과 거절', empathy: '공감', together: '협력', calm: '갈등 해결과 감정 조절' };

/* ------------------------------ 칭찬 · 격려 (모두 반말) ------------------------------ */
const PRAISE = {
  solo: [
    '처음부터 끝까지 혼자 생각해서 풀었네! 차근차근 본 게 멋져.',
    '하나씩 꼼꼼하게 봤구나. 그렇게 하면 실수가 줄어!',
    '스스로 답을 찾았어! 아까보다 훨씬 자신 있어 보여.',
    '문제를 끝까지 읽고 풀었구나. 그게 제일 중요해!',
    '우와, 천천히 생각하더니 딱 맞혔다!',
    '네가 생각한 방법이 정말 좋았어. 나도 따라 해 볼래!',
    '집중하는 모습 멋졌어. 손가락으로 짚으면서 푼 거 다 봤어!',
    '척척 풀었네! 너 오늘 반짝반짝 빛나.',
  ],
  hint: ['힌트를 보고 다시 생각한 게 좋았어. 도움을 잘 쓰는 것도 실력이야!', '힌트를 보고 차근차근 따라갔구나. 다음엔 혼자서도 할 수 있을 거야!', '힌트를 잘 듣고 끝까지 해냈어. 최고야!', '도움을 받아서 끝까지 푼 거, 정말 잘했어!'],
  retry: ['한 번 틀려도 포기하지 않고 다시 생각했네! 그게 진짜 멋진 거야.', '다시 해 보는 용기, 최고야! 틀린 덕분에 더 잘 알게 됐어.', '틀려도 괜찮다고 했지? 두 번째엔 해냈잖아!', '포기 안 하는 너, 진짜 멋있다!'],
  rep: ['그림으로 바꿔서 본 거, 정말 좋은 방법이야!', '블록으로 세어 보니까 더 잘 보이지? 좋은 생각이었어!'],
  faster: ['아까보다 훨씬 빨리 풀었어! 점점 익숙해지고 있구나.', '와, 금방 풀었네! 연습한 게 보여.'],
  streak: ['벌써 연달아 맞혔어! 계속 노력한 게 보여.', '연속으로 맞혔다! 오늘 컨디션 최고구나!', '줄줄이 정답! 나 너무 신나!'],
};
const ENCOURAGE = ['괜찮아! 틀려도 돼. 같이 다시 보자.', '앗, 아깝다! 한 번 더 생각해 볼까?', '괜찮아, 나도 처음엔 헷갈렸어.', '거의 다 왔어! 다시 한 번 해 보자.', '틀리면서 배우는 거야. 천천히 다시 보자!', '음, 조금 헷갈렸구나. 같이 하나씩 보자.', '괜찮아괜찮아! 한 번 더 하면 돼.'];
const SHOW_HOW = ['어려웠지? 괜찮아. 내가 보여 줄게.', '이건 같이 천천히 보자. 다음엔 분명 할 수 있을 거야!', '이번 건 좀 어려웠어. 내가 푸는 거 같이 볼래?', '괜찮아, 이건 나도 처음에 많이 틀렸어. 같이 보자!'];
const AFTER_SHOW = ['다음엔 분명히 할 수 있을 거야. 같이 또 해 보자!', '이제 알겠지? 다음 문제에서 써 보자!', '어려운 거 끝까지 봐 줘서 고마워. 넌 할 수 있어!'];
const TRANSITION = ['하나 더 해 볼까?', '이것도 같이 풀어 보자!', '이번엔 이거야!', '좋아, 다음 거!', '이건 어때? 같이 보자!', '하나만 더 해 볼까? 금방이야!', '자, 다음 문제 나간다~'];
const REMEDIATE_LINES = ['우리 이거 한 번만 더 천천히 보자. 내가 쉽게 알려 줄게!', '잠깐! 이 부분을 다시 보면 훨씬 쉬워질 거야.', '헷갈릴 땐 처음부터 다시 보면 돼. 같이 보자!'];
/** 문제를 맞혔을 때 짧게 */
const RIGHT_LINES = ['맞았어! 🎉', '정답! 대단해! ⭐', '딩동댕! 맞았어! 🎉', '우와, 맞혔다! ✨', '그거야! 정답! 🎉'];
/** 레벨 테스트에서 답을 낸 뒤 (맞았는지 말하지 않아요) */
const TEST_NEXT_LINES = ['좋아! 안내도 조각을 얻으러 가자!', '답을 골랐어! 종이 조각을 챙기자!', '잘했어! 조각을 하나 더 모았어!'];

/* -------------------------- 직접 쓴 이야기 (시연용) --------------------------
 *  첫 등교일 → 여름방학식까지 이어지는 다섯 단원 (수학 1학기) + 분식집 (세 자리 덧셈)
 *  concepts[i]: 그 개념의 이야기 장면 · 이야기 속 문제 · 문제 뒤 대사
 * --------------------------------------------------------------------------- */
const SCRIPTS = {
  // 포스터 장면: 분식집 (세 자리 덧셈 — 자리끼리 그대로 더해요)
  'm3-1': {
    title: '분식집 가는 날',
    theme: 'together',
    intro: ['(잠깐 쉬는 시간! 친구가 신나게 다가와요.)', '{hello}', '수업 끝나고 같이 분식집 갈래?'],
    concepts: [
      {
        story: ['우리 분식집 가자!\n떡볶이는 234원, 튀김은 152원이야.\n총 얼마가 필요할까?'],
        problem: { id: 'story-m3-1-0', type: 'visual', level: '중', visual: '234 + 152 = ❓', text: '234 + 152 는 얼마인가요?', choices: ['386', '376', '586'], answer: 0, hint: '백은 백끼리, 십은 십끼리, 일은 일끼리 더해 봐!', solution: '백: 2 + 1 = 3, 십: 3 + 5 = 8, 일: 4 + 2 = 6. 그래서 386이야.' },
        after: ['386원만 챙기면 되는구나.\n맞아~ 자리끼리 그대로 더하면 돼.\n{이름}가 해냈어!'],
      },
      {
        story: ['어? 어묵도 먹고 싶다! 어묵은 158원인데, 떡볶이랑 같이 사면?'],
        problem: { id: 'story-m3-1-1', type: 'step', level: '중', visual: '234 + 158 = ❓', text: '234 + 158 은 얼마인가요?', steps: ['① 일의 자리: 4 + 8 = 12 → 2를 쓰고 1을 올려요.', '② 십의 자리: 3 + 5 + 1 = 9', '③ 백의 자리: 2 + 1 = 3'], choices: ['382', '392', '492'], answer: 1, hint: '일의 자리끼리 더하면 10이 넘어! 십의 자리로 1을 올려 줘.', solution: '4 + 8 = 12라서 1을 올려요. 3 + 5 + 1 = 9, 2 + 1 = 3. 그래서 392원이야.' },
        after: ['392원! 받아올림도 척척이네!'],
      },
      {
        story: ['내 지갑에 500원이 있어. 386원을 내면 얼마가 남을까?'],
        problem: { id: 'story-m3-1-2', type: 'think', level: '중', visual: '500 − 386 = ❓', text: '500 − 386 은 얼마인가요?', steps: ['① 일의 자리부터 빼요. 0에서 6을 뺄 수 없으니 받아내려요.', '② 차례대로 계산해요.'], choices: ['114', '124', '214'], answer: 0, hint: '386에 얼마를 더하면 500이 될까? 거꾸로 생각해도 돼!', solution: '500 − 386 = 114. 114원이 남아!' },
        after: ['114원 남는다! 다음에 사탕 하나 사 먹자, 헤헤.'],
      },
    ],
    ending: ['같이 계산해 줘서 든든했어!', '{부름}, 우리 이제 분식집 단짝 친구야!'],
    reunion: ['분식집에 새 메뉴가 나왔대! 같이 계산해 볼래?'],
  },
};

/** 직접 쓴 이야기 속 문제를 문제 표에 올려요. (기록 · 리포트에서 id로 찾을 수 있게) */
(() => {
  Object.entries(SCRIPTS).forEach(([chId, sc]) => {
    const ch = CHAPTER_BY_ID[chId];
    if (!ch) return;
    sc.concepts.forEach((c, i) => {
      if (!c.problem) return;
      const q = withChapter({ ...c.problem, sub: i, story: true }, ch);
      c.problem = q;
      QUESTION_BY_ID[q.id] = q;
    });
  });
})();

/* ------------------------- 그 밖의 단원: 이야기 만들기 ------------------------- */
const PLACES = ['교실', '쉬는 시간', '도서관', '급식실', '운동장', '미술 시간', '학교 축제', '현장 체험학습'];

function chapterIndex(ch) {
  return CHAPTERS.indexOf(ch);
}

/** 단원 → 이야기 (직접 쓴 것이 없으면 만들어요) */
function scenarioFor(ch) {
  if (SCRIPTS[ch.id]) return SCRIPTS[ch.id];
  const i = chapterIndex(ch);
  const place = PLACES[i % PLACES.length];
  const theme = SOCIAL_ORDER[i % SOCIAL_ORDER.length];
  const subj = ch.subject === 'math' ? '수학' : '국어';
  return {
    title: `${place}에서`,
    theme,
    intro: [`(${place}. 처음 보는 친구가 다가와요.)`, '{hello}', `나 요즘 "${ch.title}" 배우는데 좀 헷갈려. 같이 해 볼래?`],
    concepts: ch.subunits.map((s, k) => ({
      story: [k === 0 ? `먼저 "${s.title}"부터 보자!` : k === 1 ? `이번엔 "${s.title}"! 이것도 ${subj} 시간에 배웠지?` : `마지막으로 "${s.title}"! 우리 거의 다 왔어!`],
      problem: null,
      after: [k === 2 ? '우와, 다 했다!' : '좋아, 하나 끝!'],
    })),
    ending: ['너랑 같이 하니까 하나도 안 어려웠어!', '{부름}, 우리 친구 하자!'],
    reunion: [`우리 "${ch.title}" 다시 해 볼래? 너랑 하면 재밌어!`],
  };
}

/** 사회성 장면 하나 (주제 안에서 단원마다 다른 장면) */
function socialFor(ch, theme, k) {
  const list = SOCIAL[theme] || SOCIAL.greet;
  return list[(chapterIndex(ch) + k) % list.length];
}

/** 친구 id → 친구 (예전 기록의 친구 · 이름을 붙인 친구 xm3 · xk2 · x5도 읽어요) */
function friendById(id) {
  const base = FRIEND_CAST.find((f) => f.id === id);
  if (base) return base;
  if (LEGACY_CAST[id]) return { id, subject: 'math', ...LEGACY_CAST[id], hello: `안녕! 나는 ${LEGACY_CAST[id].name}야.`, like: '노는 거' };
  const m = String(id || '').match(/^x([mk]?)(\d+)$/);
  if (!m) return FRIEND_CAST[0];
  const subject = m[1] === 'k' ? 'korean' : 'math';
  const n = Number(m[2]);
  const names = EXTRA_NAMES[subject];
  const looks = EXTRA_LOOKS;
  const name = names[n % names.length];
  return { id, subject, name, look: looks[n % looks.length], hello: `안녕! 나는 ${josa(name, '이야', '야')}. 만나서 반가워!`, like: '노는 거', voice: { g: FEMALE_LOOKS.has(looks[n % looks.length]) ? 'f' : 'm', pitch: 1.4 + (n % 3) * 0.08, rate: 1 } };
}

/** 이 단원의 친구: 확정 시나리오 단원은 정해진 친구, 아니면 과목마다 이름을 차례로 붙여요. */
function nextFriendId(chapterId, taken) {
  if (STORY_CAST[chapterId]) return STORY_CAST[chapterId];
  const ch = CHAPTER_BY_ID[chapterId];
  const k = ch && ch.subject === 'korean' ? 'k' : 'm';
  const used = new Set(taken);
  for (let n = 0; ; n++) if (!used.has(`x${k}${n}`)) return `x${k}${n}`;
}
/** 저장된 친구 id를 고쳐 읽어요: 확정 시나리오 단원은 늘 정해진 친구 */
function chapterFriendId(chapterId, savedId) {
  return STORY_CAST[chapterId] || savedId;
}

function friendLook(f) {
  return FRIEND_LOOKS[f.look] || FRIEND_LOOKS.dain;
}

/** 칭찬 고르기: 노력 · 과정 중심 */
function praiseFor(o) {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  if (o.tries > 1) return pick(PRAISE.retry);
  if (o.hintLv > 0) return pick(PRAISE.hint);
  if (o.rep && o.rep !== 'numbers') return o.rep === 'blocks' ? PRAISE.rep[1] : PRAISE.rep[0];
  if (o.streak >= 3) return pick(PRAISE.streak);
  if (o.faster) return pick(PRAISE.faster);
  return pick(PRAISE.solo);
}
