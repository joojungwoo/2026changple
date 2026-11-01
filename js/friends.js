/* =========================================================================
 * friends.js — 가상 친구 · 학교생활 시나리오 · 대사
 *
 *  - 대단원 하나 = 새 친구 한 명. 친구는 만나는 차례대로 정해져요. (첫 친구는 늘 지아)
 *  - 시나리오 = 이야기 장면(대사) + 사회성 선택지 + 이야기 속 교과 문제.
 *      SCRIPTS: 시연용으로 직접 쓴 이야기 (1학기 수학 다섯 단원: 첫 등교 → 여름방학식, 분식집 장면)
 *      나머지 단원은 단원 개념 · 사회성 주제로 이야기를 만들어요. (buildGeneric)
 *  - 선택지는 점수와 상관없어요. 무엇을 골라도 이야기는 이어지고, 친구 반응만 달라요. (보고서 2.2.1)
 *  - 칭찬은 정답보다 노력과 과정을 구체적으로 말해요. (보고서 2.2.1.2)
 *  - 대사의 {이름}은 학생 이름으로 바뀌어요. "지훈" → "지훈이", "지우" → "지우" (뒤에 가 · 야 · 는이 붙어요)
 * ========================================================================= */

/** 친구 생김새: 작은 그림(교실 자리 · 문제 화면) + 큰 그림(대화). 큰 그림이 없으면 작은 그림을 크게 써요. */
const FRIEND_LOOKS = {
  jia: { sprite: 'assets/school/girl.png', portrait: 'assets/school/jia.png', happy: 'assets/school/jia-happy.png' },
  boy: { sprite: 'assets/school/boy.png' },
  'girl-brown': { sprite: 'assets/school/girl-brown.png' },
  'boy-black': { sprite: 'assets/school/boy-black.png' },
  'girl-auburn': { sprite: 'assets/school/girl-auburn.png' },
  'boy-blond': { sprite: 'assets/school/boy-blond.png' },
  'girl-light': { sprite: 'assets/school/girl-light.png' },
  'boy-ash': { sprite: 'assets/school/boy-ash.png' },
};

/**
 * 친구들 (만나는 차례). 성격 · 말투 · 배경 이야기가 저마다 달라요.
 *  hello: 처음 만날 때 자기소개 · like: 좋아하는 것 · cheer: 응원 말버릇
 */
const FRIEND_CAST = [
  { id: 'jia', name: '지아', look: 'jia', persona: '밝고 다정해요', hello: '안녕! 나는 지아야. 우리 짝꿍 하자!', like: '떡볶이', cheer: '할 수 있어!' },
  { id: 'doyun', name: '도윤', look: 'boy', persona: '씩씩하고 운동을 좋아해요', hello: '어, 안녕! 나는 도윤이야. 축구 좋아해?', like: '축구', cheer: '좋아, 가 보자!' },
  { id: 'harin', name: '하린', look: 'girl-brown', persona: '수줍지만 그림을 잘 그려요', hello: '저기… 안녕. 나는 하린이야. 같이 앉아도 돼?', like: '그림 그리기', cheer: '천천히 해도 괜찮아.' },
  { id: 'junseo', name: '준서', look: 'boy-black', persona: '궁금한 게 많은 꼬마 박사예요', hello: '반가워! 나는 준서. 너는 뭘 좋아해?', like: '공룡 책', cheer: '왜 그런지 같이 알아보자!' },
  { id: 'seoa', name: '서아', look: 'girl-auburn', persona: '씩씩하지만 가끔 화가 나요', hello: '안녕, 나는 서아야! 우리 반 반장 할 거야!', like: '줄넘기', cheer: '끝까지 해 보자!' },
  { id: 'minho', name: '민호', look: 'boy-blond', persona: '장난을 좋아하는 개구쟁이예요', hello: '헤헤, 안녕! 나는 민호야. 재밌는 거 하자!', like: '종이비행기', cheer: '우리 둘이면 문제없어!' },
  { id: 'yuna', name: '유나', look: 'girl-light', persona: '차분하고 책을 좋아해요', hello: '안녕, 나는 유나야. 이 책 같이 볼래?', like: '동화책', cheer: '하나씩 하면 돼.' },
  { id: 'taeo', name: '태오', look: 'boy-ash', persona: '전학 와서 아직 낯설어요', hello: '아… 안녕. 나 태오야. 오늘 처음 왔어.', like: '레고', cheer: '나도 같이 할게!' },
];
const EXTRA_NAMES = ['소율', '시우', '다온', '이준', '하윤', '은호', '채아', '로운', '아린', '지호', '나은', '건우', '서진', '예준', '라희', '우진', '수아', '도하', '연우', '하준', '보미', '주원', '윤슬', '현우', '다인', '한결'];

/** 재회 요청 (복습할 때가 된 친구) — 보고서 2.2.1.1 */
const REUNION_LINES = ['나랑 또 놀자!', '우리 다시 이야기할까?', '같이 해 보고 싶은 게 있어!'];

/** 학생 이름 부르기: 받침이 있으면 '이'를 붙여요. (지훈 → 지훈이, 지우 → 지우) */
function callName(name) {
  const n = String(name || '친구').trim();
  const last = n.charCodeAt(n.length - 1) - 0xac00;
  return last >= 0 && last <= 11171 && last % 28 ? `${n}이` : n;
}
function fillLine(text, ctx) {
  const f = ctx.friend || {};
  return String(text)
    .replace(/\{hello\}/g, f.hello || '안녕!')
    .replace(/\{좋아하는것\}/g, f.like || '노는 거')
    .replace(/\{이름\}/g, callName(ctx.student))
    .replace(/\{친구\}/g, f.name || '친구');
}

/** 받침에 따라 조사 고르기: josa('도윤', '이', '가') → '도윤이' · josa('지아', '와', '과') → '지아와' */
function josa(word, withBatchim, without) {
  const w = String(word || '');
  const c = w.charCodeAt(w.length - 1) - 0xac00;
  const has = c >= 0 && c <= 11171 && c % 28 !== 0;
  return w + (has ? withBatchim : without);
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
        { text: '"내 이름은 {이름}야! 반가워."', mood: 'happy', reply: ['{이름}! 이름 예쁘다. 우리 이제 친구야!'] },
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
      say: '{이름}야, 네 지우개 나 가져도 돼? 나 이거 정말 갖고 싶어!',
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

/* ------------------------------ 칭찬 · 격려 ------------------------------ */
const PRAISE = {
  solo: ['처음부터 끝까지 혼자 생각해서 풀었네! 차근차근 본 게 멋져.', '하나씩 꼼꼼하게 세어 봤구나. 그렇게 하면 실수가 줄어!', '스스로 답을 찾았어! 아까보다 훨씬 자신 있어 보여.', '문제를 끝까지 읽고 풀었구나. 그게 제일 중요해!'],
  hint: ['힌트를 보고 다시 생각한 게 좋았어. 도움을 잘 쓰는 것도 실력이야!', '힌트를 보고 차근차근 따라갔구나. 다음엔 혼자서도 할 수 있을 거야!'],
  retry: ['한 번 틀려도 포기하지 않고 다시 생각했네! 그게 진짜 멋진 거야.', '다시 해 보는 용기, 최고야! 틀린 덕분에 더 잘 알게 됐어.'],
  rep: ['그림으로 바꿔서 본 거, 정말 좋은 방법이야!', '블록으로 세어 보니까 더 잘 보이지? 좋은 생각이었어!'],
  faster: ['아까보다 훨씬 빨리 풀었어! 점점 익숙해지고 있구나.'],
  streak: ['벌써 연달아 맞혔어! 계속 노력한 게 보여.'],
};
const ENCOURAGE = ['괜찮아! 틀려도 돼. 같이 다시 보자.', '앗, 아깝다! 한 번 더 생각해 볼까?', '괜찮아, 나도 처음엔 헷갈렸어.'];
const SHOW_HOW = ['어려웠지? 괜찮아. 내가 보여 줄게.', '이건 같이 천천히 보자. 다음엔 분명 할 수 있어!'];
const TRANSITION = ['하나 더 해 볼까?', '이것도 같이 풀어 보자!', '이번엔 이거야!', '좋아, 다음 거!'];
const REMEDIATE_LINES = ['우리 이거 한 번만 더 천천히 보자. 내가 쉽게 알려 줄게!', '잠깐! 이 부분을 다시 보면 훨씬 쉬워질 거야.'];

/* -------------------------- 직접 쓴 이야기 (시연용) --------------------------
 *  첫 등교일 → 여름방학식까지 이어지는 다섯 단원 (수학 1학기) + 분식집 (세 자리 덧셈)
 *  concepts[i]: 그 개념의 이야기 장면 · 이야기 속 문제 · 문제 뒤 대사
 * --------------------------------------------------------------------------- */
const SCRIPTS = {
  'm1-1': {
    title: '첫 등교일',
    theme: 'greet',
    intro: ['(오늘은 학교에 가는 첫날이에요. 교실 문을 열자 누군가 손을 흔들어요.)', '{hello}', '오늘부터 같은 반이야! 우리 교실에 뭐가 있는지 같이 세어 볼래?'],
    concepts: [
      {
        story: ['저기 창가에 화분이 있다! 몇 개인지 하나씩 세어 보자.'],
        problem: { id: 'story-m1-1-0', type: 'visual', level: '중', visual: '🪴 🪴 🪴 🪴 🪴 🪴', text: '창가에 있는 화분은 모두 몇 개일까?', choices: ['5개', '6개', '7개'], answer: 1, hint: '손가락으로 화분을 하나씩 짚으면서 "하나, 둘, 셋…" 세어 봐!', solution: '하나, 둘, 셋, 넷, 다섯, 여섯! 화분은 모두 6개야.' },
        after: ['맞아, 6개! 우리 반 화분 이름도 지어 줄까? 헤헤.'],
      },
      {
        story: ['이제 줄을 서서 급식실에 가야 해. 번호 순서대로 서 보자!'],
        problem: { id: 'story-m1-1-1', type: 'step', level: '중', visual: '3번 → 4번 → ❓ → 6번', text: '4번 친구 다음에는 몇 번 친구가 서야 할까?', steps: ['① 4 다음에 오는 수를 생각해요.', '② 4, 5, 6… 차례대로 세어요.'], choices: ['3번', '5번', '7번'], answer: 1, hint: '4부터 하나씩 세어 봐. 4 다음은?', solution: '4 바로 다음 수는 5야. 그래서 5번 친구가 서면 돼.' },
        after: ['줄을 잘 섰다! 이제 맛있는 거 먹으러 가자!'],
      },
      {
        story: ['급식에 딸기가 나왔어! 나는 딸기 5개, 너는 7개를 받았네.'],
        problem: { id: 'story-m1-1-2', type: 'think', level: '중', visual: '🍓 지아 5개  /  🍓 나 7개', text: '딸기를 더 많이 받은 사람은 누구일까?', steps: ['① 두 수를 찾아요: 5와 7', '② 수의 순서에서 뒤에 오는 수가 더 커요.'], choices: ['지아', '나', '똑같아요'], answer: 1, hint: '1, 2, 3, 4, 5, 6, 7… 7이 5보다 뒤에 있지?', solution: '7은 5보다 뒤에 오는 수라서 더 커. 그래서 내가 더 많이 받았어!' },
        after: ['와, 너 딸기 부자다! 하나 나눠 줄 수 있어? 헤헤, 농담이야!'],
      },
    ],
    ending: ['오늘 정말 재밌었다! 첫날인데 벌써 친해진 것 같아.', '{이름}야, 우리 이제 진짜 친구야!'],
    reunion: ['우리 교실에 새 물건이 생겼대! 같이 세어 볼래?'],
  },
  'm1-2': {
    title: '만들기 시간',
    theme: 'refuse',
    intro: ['(만들기 시간이에요. 상자랑 통이랑 공이 잔뜩 있어요.)', '{hello}', '우리 이걸로 멋진 로봇 만들자! 어떤 모양이 필요할까?'],
    concepts: [
      {
        story: ['로봇 몸통은 잘 쌓이는 모양이 좋겠어. 평평한 면이 있는 거!'],
        problem: { id: 'story-m1-2-0', type: 'visual', level: '중', visual: '📦   ⚽   🥫', text: '평평한 면이 있고 잘 쌓이는 상자 모양은 무엇일까?', choices: ['📦 상자', '⚽ 공', '🥫 통조림 캔'], answer: 0, hint: '굴러가지 않고 차곡차곡 쌓이는 걸 찾아봐!', solution: '📦 상자 모양은 평평한 면만 있어서 잘 쌓여. 로봇 몸통으로 딱이야!' },
        after: ['좋아, 몸통 완성! 이제 다리를 붙이자.'],
      },
      {
        story: ['다리는 굴러가는 바퀴로 하자! 눕히면 굴러가고, 세우면 쌓이는 모양이 뭐였지?'],
        problem: { id: 'story-m1-2-1', type: 'step', level: '중', visual: '🥫 → 눕히면? 굴러가요 / 세우면? 쌓여요', text: '눕히면 굴러가고 세우면 쌓을 수 있는 모양은?', steps: ['① 눕히면 굴러가는 모양을 생각해요.', '② 그중에서 세우면 쌓을 수 있는 모양을 골라요.'], choices: ['상자 모양', '둥근 기둥 모양', '공 모양'], answer: 1, hint: '공은 세워도 굴러가. 통조림 캔은 어떨까?', solution: '둥근 기둥 모양(🥫)은 눕히면 굴러가고 세우면 쌓을 수 있어.' },
        after: ['바퀴 다리 완성! 데굴데굴 잘 굴러간다!'],
      },
      {
        story: ['마지막으로 머리! 어느 쪽으로든 잘 굴러가는 동그란 머리가 귀엽겠다.'],
        problem: { id: 'story-m1-2-2', type: 'think', level: '중', visual: '🏀  📦  🥫', text: '뾰족한 곳이 없고 어느 쪽으로도 굴러가는 모양은?', steps: ['① 뾰족한 곳이 있는지 살펴봐요.', '② 어느 쪽으로 밀어도 굴러가는지 생각해요.'], choices: ['🏀 농구공', '📦 상자', '🥫 캔'], answer: 0, hint: '어디를 밀어도 굴러가는 건 무엇일까?', solution: '🏀 농구공은 공 모양이라 뾰족한 곳이 없고 어느 쪽으로도 굴러가.' },
        after: ['짜잔! 우리 로봇 완성! 이름은 "모양이"로 하자!'],
      },
    ],
    ending: ['같이 만드니까 혼자보다 훨씬 멋지게 됐어!', '{이름}야, 너랑 친구 돼서 정말 좋아!'],
    reunion: ['우리 모양이 로봇 고장 났대! 같이 고쳐 줄래?'],
  },
  'm1-3': {
    title: '운동장 놀이',
    theme: 'empathy',
    intro: ['(쉬는 시간, 운동장에서 친구가 구슬을 세고 있어요.)', '{hello}', '나 구슬 모으는 거 좋아해! 같이 세어 볼래?'],
    concepts: [
      {
        story: ['나한테 구슬이 3개 있는데, 오빠가 2개를 더 줬어!'],
        problem: { id: 'story-m1-3-0', type: 'visual', level: '중', visual: '🔵🔵🔵 ➕ 🔵🔵', text: '구슬은 모두 몇 개가 되었을까?', choices: ['4개', '5개', '6개'], answer: 1, hint: '3개에 2개를 더하면? 3 다음부터 4, 5 하고 세어 봐!', solution: '3 + 2 = 5. 구슬은 모두 5개야!' },
        after: ['5개! 이제 구슬치기 할 수 있겠다!'],
      },
      {
        story: ['앗… 구슬 7개 중에 3개가 굴러가서 잃어버렸어. 속상해…'],
        problem: { id: 'story-m1-3-1', type: 'step', level: '중', visual: '🔵🔵🔵🔵🔵🔵🔵 ➖ 3개', text: '남은 구슬은 몇 개일까?', steps: ['① 처음 구슬: 7개', '② 잃어버린 구슬: 3개', '③ 7에서 3을 빼요.'], choices: ['3개', '4개', '5개'], answer: 1, hint: '7개에서 3개를 하나씩 지워 봐!', solution: '7 − 3 = 4. 구슬이 4개 남았어.' },
        after: ['그래도 4개나 남았네. 같이 세어 줘서 마음이 좀 나아졌어.'],
      },
      {
        story: ['남은 구슬을 두 주머니에 나눠 담을 거야. 6개를 2개랑 몇 개로 가르면 될까?'],
        problem: { id: 'story-m1-3-2', type: 'think', level: '중', visual: '6 → 2 와 ❓', text: '6은 2와 몇으로 가를 수 있을까?', steps: ['① 2에 얼마를 더하면 6이 될까요?', '② 2, 3, 4, 5, 6… 몇 번 세었는지 봐요.'], choices: ['3', '4', '5'], answer: 1, hint: '2에서 6까지 하나씩 세어 봐. 몇 칸을 갔어?', solution: '2와 4를 모으면 6이야. 그래서 6은 2와 4로 가를 수 있어.' },
        after: ['딱 맞게 나눴다! 너 정말 꼼꼼하구나.'],
      },
    ],
    ending: ['아까 속상할 때 같이 있어 줘서 고마웠어.', '{이름}야, 우리 오늘부터 친구 하자!'],
    reunion: ['나 구슬 또 모았어! 같이 세어 볼래?'],
  },
  'm1-4': {
    title: '학교 텃밭',
    theme: 'together',
    intro: ['(학교 텃밭에서 채소를 키우는 날이에요.)', '{hello}', '우리 같이 텃밭 당번이야! 해야 할 일이 많대.'],
    concepts: [
      {
        story: ['오이 두 개를 땄어. 어느 쪽이 더 길까?'],
        problem: { id: 'story-m1-4-0', type: 'visual', level: '중', visual: '🥒 가: ▬▬▬▬▬▬\n🥒 나: ▬▬▬▬', text: '더 긴 오이는 어느 것일까?', choices: ['가', '나', '똑같아요'], answer: 0, hint: '한쪽 끝을 맞추고 다른 쪽 끝을 비교해 봐.', solution: '끝을 맞춰 보면 가 오이가 더 많이 나와 있어. 가가 더 길어.' },
        after: ['가 오이가 더 길다! 오늘 반찬은 오이무침이다!'],
      },
      {
        story: ['이제 수박이랑 사과를 옮겨야 해. 어느 게 더 무거울까? 같이 들어 보자!'],
        problem: { id: 'story-m1-4-1', type: 'step', level: '중', visual: '🍉 수박  ⚖️  🍎 사과', text: '시소에 올리면 아래로 내려가는 쪽은 어느 것일까?', steps: ['① 더 무거운 쪽이 아래로 내려가요.', '② 수박과 사과 중 더 무거운 것을 생각해요.'], choices: ['🍉 수박', '🍎 사과'], answer: 0, hint: '들어 봤을 때 팔이 더 힘든 건 어느 쪽이었지?', solution: '수박이 사과보다 무거워. 무거운 쪽이 아래로 내려가니까 수박 쪽이 내려가.' },
        after: ['둘이 같이 드니까 수박도 거뜬해! 협동 최고!'],
      },
      {
        story: ['물을 줘야 해. 양동이랑 컵 중에 어느 것에 물이 더 많이 들어갈까?'],
        problem: { id: 'story-m1-4-2', type: 'think', level: '중', visual: '🪣 양동이   🥛 컵', text: '물을 더 많이 담을 수 있는 것은?', steps: ['① 그릇의 크기를 비교해요.', '② 더 큰 그릇에 물이 더 많이 들어가요.'], choices: ['🪣 양동이', '🥛 컵', '똑같아요'], answer: 0, hint: '컵으로 양동이를 채우려면 몇 번이나 부어야 할까?', solution: '양동이가 컵보다 훨씬 커서 물을 더 많이 담을 수 있어.' },
        after: ['양동이 덕분에 한 번에 다 줬다! 너랑 같이 해서 금방 끝났어.'],
      },
    ],
    ending: ['너 없었으면 오늘 일 다 못 했을 거야.', '{이름}야, 우리 짱 좋은 팀이다! 친구 하자!'],
    reunion: ['텃밭에 새 채소가 자랐어! 같이 보러 갈래?'],
  },
  'm1-5': {
    title: '여름방학식',
    theme: 'calm',
    intro: ['(내일부터 여름방학! 교실에서 방학식 준비를 해요.)', '{hello}', '방학 전에 교실 정리를 해야 한대. 근데 할 게 너무 많아서 좀 화나!'],
    concepts: [
      {
        story: ['색종이를 10장씩 묶어 정리하자. 10장 묶음 1개랑 낱장 3장이 있어.'],
        problem: { id: 'story-m1-5-0', type: 'visual', level: '중', visual: '📚 10장 묶음 1개  +  📄📄📄', text: '색종이는 모두 몇 장일까?', choices: ['13장', '31장', '4장'], answer: 0, hint: '10장 묶음 하나는 10, 낱장 3장은 3. 10과 3이면?', solution: '10장 묶음 1개와 낱장 3장은 13장이야.' },
        after: ['13장! 화가 좀 풀렸어. 정리하니까 개운하다.'],
      },
      {
        story: ['연필은 10자루씩 4묶음이 있어. 모두 몇 자루일까?'],
        problem: { id: 'story-m1-5-1', type: 'step', level: '중', visual: '✏️ 10자루 묶음 × 4', text: '연필은 모두 몇 자루일까?', steps: ['① 10씩 세어요: 10, 20, …', '② 묶음이 4개니까 네 번 세어요.'], choices: ['14자루', '40자루', '44자루'], answer: 1, hint: '10, 20, 30… 네 번 세어 봐!', solution: '10, 20, 30, 40. 10자루씩 4묶음은 40자루야.' },
        after: ['좋아, 연필 정리 끝! 이제 거의 다 했다!'],
      },
      {
        story: ['마지막으로 사물함 번호를 정리하자. 27번과 32번 중 뒤에 오는 번호는?'],
        problem: { id: 'story-m1-5-2', type: 'think', level: '중', visual: '27   32', text: '두 수 중에서 더 큰 수는 무엇일까?', steps: ['① 10개씩 묶음의 수를 먼저 비교해요: 2와 3', '② 묶음이 많은 쪽이 더 커요.'], choices: ['27', '32', '똑같아요'], answer: 1, hint: '27은 10개 묶음 2개, 32는 10개 묶음 3개야.', solution: '32는 10개씩 묶음이 3개라서 27보다 커.' },
        after: ['다 정리했다! 처음엔 화났는데, 같이 하니까 하나도 안 힘들었어.'],
      },
    ],
    ending: ['방학 동안 너 보고 싶을 거야!', '{이름}야, 방학 끝나도 우리 계속 친구야!'],
    reunion: ['방학 숙제 같이 할래? 너랑 하면 금방 끝날 것 같아!'],
  },
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
    ending: ['같이 계산해 줘서 든든했어!', '{이름}야, 우리 이제 분식집 단짝 친구야!'],
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
    ending: ['너랑 같이 하니까 하나도 안 어려웠어!', '{이름}야, 우리 친구 하자!'],
    reunion: [`우리 "${ch.title}" 다시 해 볼래? 너랑 하면 재밌어!`],
  };
}

/** 사회성 장면 하나 (주제 안에서 단원마다 다른 장면) */
function socialFor(ch, theme, k) {
  const list = SOCIAL[theme] || SOCIAL.greet;
  return list[(chapterIndex(ch) + k) % list.length];
}

/** 이 학생이 이 단원에서 만나는 친구 (처음 만날 때 정해져서 저장돼요) */
function friendById(id) {
  const base = FRIEND_CAST.find((f) => f.id === id);
  if (base) return base;
  const m = String(id || '').match(/^x(\d+)$/);
  if (!m) return FRIEND_CAST[0];
  const n = Number(m[1]);
  const looks = Object.keys(FRIEND_LOOKS).filter((k) => k !== 'jia');
  const src = FRIEND_CAST[1 + (n % (FRIEND_CAST.length - 1))];
  return { ...src, id, name: EXTRA_NAMES[n % EXTRA_NAMES.length], look: looks[n % looks.length], hello: `안녕! 나는 ${EXTRA_NAMES[n % EXTRA_NAMES.length]}야. 만나서 반가워!` };
}

/** 다음에 만날 친구 id: 이미 만난 친구는 빼고 차례대로 */
function nextFriendId(taken) {
  const used = new Set(taken);
  const free = FRIEND_CAST.find((f) => !used.has(f.id));
  if (free) return free.id;
  for (let n = 0; ; n++) if (!used.has(`x${n}`)) return `x${n}`;
}

function friendLook(f) {
  return FRIEND_LOOKS[f.look] || FRIEND_LOOKS.boy;
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
