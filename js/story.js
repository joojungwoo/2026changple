/* =========================================================================
 * story.js — 확정 시나리오 (「한걸음 | 대단원 인터랙티브 시나리오」)
 *
 *  국어 A '우리 반 비밀 우체통' — 국어 1-2 가 네 단원, 새 친구 도윤 → 하린 → 수아 → 민준
 *  수학 B '여름방학까지 D-100'  — 수학 1-1 다섯 단원, 새 친구 지아 → 태오 → 예린 → 현우 → 소율
 *  (이름 최종 수정 반영: 국어 첫 친구 = 도윤, 둘째 = 하린 / 수학 첫 친구 = 지아)
 *
 *  대단원 하나 = 새 친구 한 명과의 연속 이야기. 소단원은 이야기 속 학습 자리({ learn: 소단원 번호 }).
 *  두 과목의 친구 · 관계 상태(flags)는 따로 저장해요. (data.story.math / data.story.korean)
 *
 *  장면 줄 쓰는 법
 *    '대사'                  이 단원 친구의 말
 *    '(설명)'                상황 설명
 *    ['doyun', '대사']        다른 친구의 말 (id)
 *    ['doyun', '대사', 'sad'] 표정: happy · think · sad
 *    { if: '조건', then: [...], else: [...] }   조건: 'flag' · '!flag' · 'flag=값' · 'a & b'
 *    { choice: 'B1S1', theme, who?, say, options: [{ text, set?, if?, mood?, reply: [...] }] }
 *    { learn: 0 }            소단원 학습 자리 (개념 카드 → 이야기 속 문제 → 숙달될 때까지)
 *    { revisit: true }       친구 되기 전, 기준에 못 닿은 소단원을 한 번 더 보는 자리 (없으면 끝 바로 앞)
 *    { ending: 'math' }      과목 마지막 엔딩 (조건 우선순위로 하나를 골라요)
 *  선택은 점수와 상관없고, 어떤 선택을 해도 다음 단원으로 이어져요. 학습 정오답은 관계에 영향이 없어요.
 * ========================================================================= */

/** 확정 시나리오가 있는 단원 → 그 단원에서 사귀는 친구 */
const STORY_CAST = {
  'm1-1': 'jia', 'm1-2': 'taeo', 'm1-3': 'yerin', 'm1-4': 'hyunwoo', 'm1-5': 'soyul',
  'k1-6': 'doyun', 'k1-7': 'harin', 'k1-8': 'sua', 'k1-9': 'minjun',
};

const STORIES = {
  /* ============================ 수학 B1 · 9까지의 수 · 지아 ============================ */
  'm1-1': {
    title: '축제 준비 첫날',
    scenes: [
      '(입학하고 며칠 뒤, 복도 게시판에 커다란 포스터가 붙었어요.\n"여름 축제 — 여름방학 하는 날!")',
      '안녕! 나는 지아야. 너도 이 포스터 봤어?',
      {
        choice: 'B1S1', theme: 'greet',
        say: '여름방학 전에 우리 반 축제를 열면 어때? 나랑 같이 준비할래?',
        options: [
          { text: '"좋아! 같이 하자!"', set: { festival_style: 'planned' }, mood: 'happy', reply: ['야호! 벌써 신난다. 내가 계획표를 만들어 올게!'] },
          { text: '"다른 친구 의견도 들어 보자."', set: { festival_style: 'open' }, mood: 'think', reply: ['아, 그렇네! 다 같이 하는 축제니까 다른 친구 생각도 궁금하다.'] },
          { text: '"어떤 축제야?" 하고 먼저 물어본다', set: { festival_style: 'curious' }, mood: 'happy', reply: ['물어봐 줘서 고마워! 놀이도 하고, 장식도 하고, 맛있는 것도 나눠 먹는 축제야!'] },
        ],
      },
      {
        choice: 'B1S2', theme: 'together',
        say: '장식이 몇 개 있는지부터 알아보자. 어떻게 할까?',
        options: [
          { text: '"내가 같이 정리할게!"', mood: 'happy', reply: ['둘이 하면 금방 끝나겠다! 하나씩 꼼꼼하게 세어 보자.'] },
          { text: '"친구들에게 나눠 맡기자."', mood: 'think', reply: ['좋은 생각이야! 그럼 우리는 이 상자부터 세어 볼까?'] },
        ],
      },
      { learn: 0 },
      '장식 세기 끝! 너 정말 꼼꼼하다.',
      {
        choice: 'B1S3', theme: 'refuse',
        say: '우리 축제 이름을 뭐라고 할까?',
        options: [
          { text: '"반짝반짝 축제!"', set: { festival_name: '반짝반짝 축제' }, mood: 'happy', reply: ['반짝반짝 축제! 이름만 들어도 신나!'] },
          { text: '"친구랑 함께 축제!"', set: { festival_name: '친구랑 함께 축제' }, mood: 'happy', reply: ['친구랑 함께 축제! 다 같이 하는 느낌이라 좋다.'] },
          { text: '"지아는 어떤 이름이 좋아?"', set: { festival_name: '여름 별빛 축제' }, mood: 'happy', reply: ['내 생각을 물어봐 줘서 고마워! 나는… "여름 별빛 축제" 어때?', '좋아, 그걸로 하자!'] },
        ],
      },
      '부스는 번호 순서대로 줄을 세울 거야. 순서 정하는 거 도와줘!',
      { learn: 1 },
      {
        choice: 'B1S4', theme: 'empathy',
        say: '(지아가 계획표를 꼭 쥐고 있어요.) 혹시… 내가 준비를 잘 못하면 어떡하지?',
        options: [
          { text: '"걱정되는구나."', set: { jia_heard: true }, mood: 'happy', reply: ['응… 걱정된다고 말하니까 조금 가벼워졌어. 알아줘서 고마워.'] },
          { text: '"같이 하면 괜찮아!"', mood: 'happy', reply: ['맞아, 나 혼자 하는 게 아니지! 힘이 난다.'] },
          { text: '"도와줄 친구를 더 찾아보자."', set: { find_helpers: true }, mood: 'think', reply: ['좋아! 친구가 많으면 덜 무섭겠다. 누가 도와줄까?'] },
        ],
      },
      '풍선도 세어 봐야 해. 어느 색이 더 많은지 비교해 줄래?',
      { learn: 2 },
      '(다음 날 아침, 복도 게시판의 포스터 날짜가 바뀌어 있어요!)',
      {
        choice: 'B1S5', theme: 'calm',
        say: '어? 포스터 날짜가 달라졌어! 누가 그랬지? 계획이 다 틀어지면 어떡해…',
        options: [
          { text: '"누가 고쳤는지 같이 찾아보자."', set: { poster_check: 'find' }, mood: 'think', reply: ['그래! 범인… 아니, 고친 사람을 찾아보자.', '(복도 끝에서 누군가 킥킥 웃으며 달아나요.)'] },
          { text: '"괜찮아, 다시 고치면 돼." 하고 지아를 먼저 안심시킨다', set: { poster_check: 'calm' }, mood: 'happy', reply: ['후~ 맞아, 다시 고치면 되지. 네 말 들으니까 마음이 놓여.', '(복도 끝에서 누군가 킥킥 웃으며 달아나요.)'] },
        ],
      },
      { revisit: true },
      '오늘 정말 고마웠어. 너랑 하니까 하나도 안 무서웠어.',
      '{부름}, 우리 이제 진짜 친구야! 축제 준비도 계속 같이 하자!',
    ],
    reunion: ['축제 장식이 더 왔어! 몇 개인지 같이 세어 줄래?', '계획표를 새로 만들었어! 번호 순서가 맞는지 봐 줄래?', '{부름}, 풍선 색깔별로 몇 개인지 또 비교해 보자!'],
  },

  /* ============================ 수학 B2 · 여러 가지 모양 · 태오 ============================ */
  'm1-2': {
    title: '포스터 소동',
    scenes: [
      '(쉬는 시간, 누군가 커다란 종이를 들고 뛰어와요.)',
      {
        if: 'poster_check=find',
        then: ['헤헤… 너 포스터 고친 사람 찾고 있었지? 사실 그거 나야! 나는 태오야.'],
        else: ['지아가 포스터 때문에 걱정했다며? 사실… 그거 나야. 나는 태오야.'],
      },
      {
        choice: 'B2S1', theme: 'calm',
        say: '짜잔! 내가 새로 만든 포스터야! 어… 근데 날짜가 또 틀렸네.',
        options: [
          { text: '"왜 날짜를 바꿨어?" 하고 묻는다', set: { taeo_heard: true }, mood: 'happy', reply: ['어? 혼내지 않고 물어보는 거야? 사실 더 많은 친구가 오면 좋겠어서 날짜를 늦췄어. 근데 지아한테 말을 안 했어…'] },
          { text: '"같이 고치자!"', set: { fixed_together: true }, mood: 'happy', reply: ['정말? 같이 고치면 금방이겠다! 고마워.'] },
          { text: '"지아에게 먼저 알리자."', set: { told_jia: true }, mood: 'think', reply: ['어… 지아한테 혼나면 어떡하지?', ['jia', '태오야, 다음엔 바꾸기 전에 꼭 같이 이야기하자. 알았지?', 'think'], '…응, 알았어. 미안해.'] },
        ],
      },
      {
        choice: 'B2S2', theme: 'empathy',
        say: '나는 사람들이 우리 축제를 재미있다고 생각했으면 좋겠어.',
        options: [
          { text: '"그래서 포스터를 열심히 만들었구나." 하고 마음을 읽어 준다', mood: 'happy', reply: ['응! 내 마음을 알아줬어. 헤헤, 기분 좋다.'] },
          { text: '"더 잘 보이는 문구를 같이 생각해 보자."', mood: 'happy', reply: ['"다 같이 놀자!" 어때? 크게 쓰면 멀리서도 보이겠다!'] },
        ],
      },
      '(태오를 따라 장식 창고에 왔어요. 상자랑 통이랑 공이 잔뜩 쌓여 있어요.)',
      {
        choice: 'B2S3', theme: 'together',
        say: '이 상자랑 통이랑 공을 어디에 놓을까?',
        options: [
          { text: '"모양을 같이 살펴보자."', mood: 'happy', reply: ['좋아! 모양마다 잘 쌓이는지, 잘 굴러가는지 보자.'] },
          { text: '"창고 지도를 그려서 자리를 정하자."', mood: 'happy', reply: ['오, 지도! 모양별로 칸을 나눠서 그리자!'] },
        ],
      },
      '먼저 네모난 것들! 차곡차곡 쌓아 보자.',
      { learn: 0 },
      '이번엔 통처럼 생긴 것들! 눕혀 볼까, 세워 볼까?',
      { learn: 1 },
      '마지막은 공처럼 동그란 것들! 데굴데굴~',
      { learn: 2 },
      {
        choice: 'B2S4', theme: 'calm', who: 'jia',
        say: '(지아가 팔짱을 끼고 있어요.) 태오 때문에 계획이 엉망이야.',
        options: [
          { text: '태오가 했던 말을 전해 준다', set: { tension: 'told' }, mood: 'think', reply: [['jia', '더 많은 친구가 오길 바랐다고? 그건… 몰랐어.', 'think']] },
          { text: '"많이 속상했지?" 하고 지아 마음을 먼저 듣는다', set: { tension: 'heard', jia_heard: true }, mood: 'happy', reply: [['jia', '응… 열심히 만든 계획이라서 그랬어. 들어 줘서 고마워.', 'happy']] },
          { text: '"셋이 같이 이야기해 보자."', set: { tension: 'talk3' }, mood: 'happy', reply: [['jia', '좋아. 태오야, 우리 같이 정하자.', 'happy'], '응! 다음부턴 꼭 같이 정할게.'] },
        ],
      },
      {
        choice: 'B2S5', theme: 'together',
        say: '(태오가 작게 속삭여요.) 나 사실… 모두가 웃을 수 있는 깜짝 놀이를 준비했어.',
        options: [
          { text: '"우와, 같이 준비하자!"', set: { surprise_game: true }, mood: 'happy', reply: ['진짜? 우리 둘만의 작전이다! 헤헤.'] },
          { text: '"지아에게도 먼저 알려 주자."', set: { surprise_game: true, surprise_shared: true }, mood: 'happy', reply: ['그래, 이번엔 꼭 먼저 말할게!', ['jia', '깜짝 놀이? 좋아! 계획표에 자리 만들어 둘게.', 'happy']] },
        ],
      },
      { revisit: true },
      '너 덕분에 장난만 치는 애가 아니라는 걸 보여 줄 수 있었어.',
      '{부름}, 우리 친구 하자! 깜짝 놀이도 꼭 같이 하자!',
    ],
    reunion: ['창고에 새 물건이 들어왔어! 모양별로 나눠 줄래?', '{부름}, 굴러가는 것 찾기 놀이 하자!', '깜짝 놀이에 쓸 물건을 골라야 해. 같이 봐 줄래?'],
  },

  /* ============================ 수학 B3 · 덧셈과 뺄셈 · 예린 ============================ */
  'm1-3': {
    title: '태오와 친해지고 싶어',
    scenes: [
      '(점심시간, 처음 보는 친구가 조심조심 다가와요.)',
      '안녕… 나는 예린이야.',
      {
        choice: 'B3S1', theme: 'refuse',
        say: '너 태오랑 친하지? 나 태오랑 더 친해지고 싶은데… 도와줄래?',
        options: [
          { text: '"그럼 놀이 준비를 같이 하자!"', set: { yerin_help: 'together' }, mood: 'happy', reply: ['같이 준비하면 자연스럽게 말할 수 있겠다! 고마워.'] },
          { text: '"네가 직접 말할 수 있게 도와줄게."', set: { yerin_help: 'brave', yerin_brave: true }, mood: 'happy', reply: ['내가 직접…? 조금 떨리지만, 네가 옆에 있으면 할 수 있을 것 같아.'] },
          { text: '"내가 태오한테 바로 말해 줄게!"', set: { yerin_help: 'told', yerin_secret_leaked: true }, mood: 'think', reply: ['어? 잠깐만, 나 아직 준비가 안 됐는데…', '(그런데 벌써 태오에게 말해 버렸어요.)'] },
        ],
      },
      {
        if: 'yerin_secret_leaked',
        then: [['taeo', '예린이가 나랑 친해지고 싶다고? …혹시 나 놀리는 거 아니지?', 'think']],
        else: [['taeo', '예린이는 내가 장난만 친다고 싫어하나 봐.', 'sad']],
      },
      {
        choice: 'B3S2', theme: 'empathy', who: 'taeo',
        say: '너는 어떻게 생각해?',
        options: [
          { text: '"예린이 마음은 예린이가 말해 줄 거야."', set: { no_guess: true }, mood: 'happy', reply: [['taeo', '아, 그렇구나. 내가 마음대로 생각하면 안 되겠다.', 'happy']] },
          { text: '"우리 셋이 같이 해 보자!"', mood: 'happy', reply: [['taeo', '셋이? 좋아! 재밌겠다!', 'happy']] },
        ],
      },
      {
        choice: 'B3S3', theme: 'together',
        say: '우리 둘이 준비물을 모으면 좋겠다. 어떻게 할까?',
        options: [
          { text: '"같이 모으자!"', mood: 'happy', reply: ['응! 내가 모은 거랑 네가 모은 거랑 합치면 몇 개일까?'] },
          { text: '"역할을 나누자."', mood: 'happy', reply: ['좋아, 나는 리본, 너는 스티커! 나중에 모아서 세어 보자.'] },
        ],
      },
      { learn: 0 },
      ['taeo', '앗! 장식이 몇 개 없어졌어!', 'sad'],
      {
        choice: 'B3S4', theme: 'calm',
        say: '어떡하지? 누가 가져갔을까?',
        options: [
          { text: '"몇 개가 남았는지 같이 세어 보자."', mood: 'happy', reply: ['맞아, 남은 걸 세면 몇 개가 없어졌는지 알 수 있어!'] },
          { text: '"주변 친구들에게 물어보자."', mood: 'think', reply: [['soyul', '(저 멀리 조용한 친구가 고개를 갸웃해요.)'], '물어보기 전에 남은 것부터 세어 볼까?'] },
        ],
      },
      { learn: 1 },
      '이번엔 이어서 세는 연습! 태오가 알려 준 방법이래.',
      { learn: 2 },
      {
        if: 'yerin_secret_leaked',
        then: [
          {
            choice: 'B3S5', theme: 'calm',
            say: '(예린이가 조심스럽게 물어요.) 아까… 나를 대신해서 말한 거야?',
            options: [
              { text: '"허락 없이 말해서 미안해."', set: { yerin_apologized: true }, mood: 'happy', reply: ['사과해 줘서 고마워. 사실 조금 놀랐어.', '그래도 덕분에 태오랑 이야기하게 됐으니까… 이제 괜찮아!'] },
              { text: '"예린아, 이제 네가 직접 말해 봐!" 하고 격려한다', mood: 'think', reply: ['응… 다음엔 나한테 먼저 물어봐 줘. 그래도 응원해 줘서 고마워.'] },
            ],
          },
        ],
        else: [
          {
            choice: 'B3S5', theme: 'empathy',
            say: '(예린이가 웃으며 물어요.) 내가 직접 이야기할 수 있게 도와준 거지?',
            options: [
              { text: '"응! 네가 용기 낸 거야."', set: { yerin_brave: true }, mood: 'happy', reply: ['헤헤, 나 오늘 태오한테 먼저 말 걸었어! 너무 기뻐.'] },
              { text: '"우리 같이 해서 된 거야!"', mood: 'happy', reply: ['맞아, 혼자였으면 못 했을 거야. 고마워!'] },
            ],
          },
        ],
      },
      { revisit: true },
      ['taeo', '예린아, 다음엔 깜짝 놀이도 같이 준비하자!', 'happy'],
      '정말? 좋아! …{부름}, 너 덕분이야.',
      '{부름}, 우리 이제 친구야!',
    ],
    reunion: ['리본이랑 스티커를 또 모았어! 모두 몇 개인지 세어 줄래?', '{부름}, 장식이 몇 개 남았는지 같이 세어 보자!', '태오랑 놀이 준비하는데 너도 와 줄래? 덧셈이 필요해!'],
  },

  /* ============================ 수학 B4 · 비교하기 · 현우 ============================ */
  'm1-4': {
    title: '두 개의 축제',
    scenes: [
      '(축제 준비 회의 시간. 한 친구가 손을 번쩍 들어요.)',
      '나는 현우야. 할 말이 있어!',
      {
        choice: 'B4S1', theme: 'calm',
        say: '왜 지아가 다 정해? 우리 의견도 들어 줘야지!',
        options: [
          { text: '"현우 생각을 먼저 들어 볼게."', set: { conflict_style: 'listen' }, mood: 'happy', reply: ['…정말? 내 말 들어 주는 친구는 처음이야. 나는 무대를 더 크게 하고 싶었어.', ['jia', '(지아가 조금 당황한 얼굴이에요.)', 'think']] },
          { text: '"지아도 열심히 준비했어."', set: { conflict_style: 'jia' }, mood: 'think', reply: [['jia', '알아줘서 고마워…', 'happy'], '흥, 나도 열심히 하고 싶다고!'] },
          { text: '"둘이 같이 이야기해 보면 어때?"', set: { conflict_style: 'both' }, mood: 'happy', reply: ['같이? …좋아, 한번 해 볼게.', ['jia', '나도 현우 생각 들어 볼게.', 'happy']] },
        ],
      },
      { if: 'taeo_heard', then: [['taeo', '나도 예전에 내 말 들어 줘서 좋았어. 현우 말도 들어 보자!', 'happy']] },
      { if: 'yerin_brave', then: [['yerin', '나도… 내 생각 말해 볼게. 무대 옆에 꽃 장식을 하면 좋겠어.', 'happy']] },
      {
        choice: 'B4S2', theme: 'together',
        say: '무대를 여기 둘까? 저쪽이 더 넓어 보이는데.',
        options: [
          { text: '"직접 재어서 비교해 보자."', mood: 'happy', reply: ['좋아! 눈으로만 보면 헷갈리니까 맞대어 보자!'] },
          { text: '"모두 각자 생각을 말해 보자."', mood: 'happy', reply: [['jia', '나는 여기가 좋아.', 'think'], '나는 저기! …그럼 비교해 보고 정하자.'] },
        ],
      },
      { learn: 0 },
      ['jia', '이건 너무 무거운 것 같아…', 'think'],
      {
        choice: 'B4S3', theme: 'together',
        say: '어떻게 옮기지?',
        options: [
          { text: '"안전하게 옮길 방법을 찾자."', mood: 'happy', reply: ['어느 게 더 무거운지 먼저 알아보자! 무거운 건 둘이 들자.'] },
          { text: '"친구들한테 도와 달라고 하자."', mood: 'happy', reply: [['taeo', '내가 도와줄게! 영차!', 'happy'], '고마워! 그럼 무거운 것부터 찾아보자.'] },
        ],
      },
      { learn: 1 },
      {
        choice: 'B4S4', theme: 'together',
        say: '음료를 준비하자. 그런데 컵마다 담을 수 있는 양이 달라.',
        options: [
          { text: '"어느 컵에 더 많이 들어가는지 비교하자."', mood: 'happy', reply: ['좋아! 물을 부어 보면 알 수 있어.'] },
          { text: '"필요한 컵을 먼저 정하자."', mood: 'happy', reply: ['그럼 제일 많이 들어가는 컵부터 찾아야겠다!'] },
        ],
      },
      { learn: 2 },
      '(준비가 거의 끝났어요. 지아와 현우가 마주 섰어요.)',
      ['jia', '내가 너무 혼자 결정했나 봐.', 'sad'],
      '…나도 말을 세게 했어.',
      {
        choice: 'B4S5', theme: 'calm',
        say: '(두 친구가 나를 바라봐요.)',
        options: [
          { text: '"서로 좋은 점을 말해 보자!"', set: { reconciled: true }, mood: 'happy', reply: [['jia', '현우는 용기 있게 말해 줘.', 'happy'], '지아는 계획을 정말 꼼꼼하게 세워. 다음엔 같이 정하자!'] },
          { text: '"각자 바꾸고 싶은 점을 들어 보자."', set: { repair_pending: true }, mood: 'think', reply: [['jia', '나는… 다른 친구 말을 더 들어 볼게.', 'think'], '나는 말을 부드럽게 해 볼게. 아직 조금 어색하지만.'] },
        ],
      },
      '(축제 전날, 준비물 상자가 보이지 않아요. 창고 앞에서 누군가 망설이고 있어요.)',
      {
        choice: 'B4S6', theme: 'greet',
        say: '어? 준비물 상자가 어디 갔지?',
        options: [
          { text: '창고 앞의 친구에게 말을 건다', set: { met_soyul: true }, mood: 'happy', reply: [['soyul', '(조용한 친구가 깜짝 놀라 고개를 들어요.) 어… 안녕.', 'think']] },
          { text: '친구들과 함께 찾아본다', mood: 'think', reply: ['다 같이 찾아보자! …그런데 저 친구, 뭔가 알고 있는 것 같아.'] },
        ],
      },
      { revisit: true },
      '처음엔 다 내 마음대로 안 돼서 화났는데, 너 덕분에 같이 하는 법을 알았어.',
      '{부름}, 우리 친구 하자!',
    ],
    reunion: ['무대 장식 길이를 또 비교해야 해. 도와줄래?', '{부름}, 어느 쪽이 더 무거운지 내기할래?', '새 컵을 샀는데 어느 게 더 많이 들어갈까? 같이 보자!'],
  },

  /* ============================ 수학 B5 · 50까지의 수 · 소율 ============================ */
  'm1-5': {
    title: '축제 당일',
    scenes: [
      { if: 'met_soyul', then: ['아까 말 걸어 줘서 고마웠어. 나는 소율이야.'], else: ['(창고 앞의 친구가 다가와요.) 저기… 나는 소율이야.'] },
      {
        choice: 'B5S1', theme: 'empathy',
        say: '나… 준비물을 다른 방에 옮겨 뒀어. 비가 올까 봐.',
        options: [
          { text: '"챙겨 줘서 고마워!"', set: { soyul_understood: true }, mood: 'happy', reply: ['정말? 혼날까 봐 무서웠는데… 다행이다.'] },
          { text: '"먼저 알려 주면 더 좋았을 거야."', set: { soyul_told: true }, mood: 'think', reply: ['응… 맞아. 다음엔 꼭 먼저 말할게. 알려 줘서 고마워.'] },
          { text: '"같이 다시 옮기자!"', set: { soyul_understood: true }, mood: 'happy', reply: ['같이 해 줄 거야? 고마워! 영차!'] },
        ],
      },
      {
        choice: 'B5S2', theme: 'together',
        say: '물건이 많아서 헷갈려. 같이 세어 줄래?',
        options: [
          { text: '"하나씩 확인하자."', mood: 'happy', reply: ['좋아! 그런데 너무 많아서… 10개씩 묶으면 더 쉬울지도 몰라.'] },
          { text: '"10개씩 묶어서 정리하자."', mood: 'happy', reply: ['10개씩! 그럼 묶음이 몇 개인지만 세면 되겠다!'] },
        ],
      },
      { learn: 0 },
      { learn: 1 },
      {
        choice: 'B5S3', theme: 'refuse', who: 'taeo',
        say: '놀이 순서는 어떻게 정할까?',
        options: [
          { text: '"번호표로 순서를 정하자."', mood: 'happy', reply: [['taeo', '좋아! 번호가 작은 사람부터!', 'happy']] },
          { text: '"모두 의견을 들어 보자."', mood: 'happy', reply: [['hyunwoo', '나는 이번에 순서 정하는 거 도울게.', 'happy'], ['taeo', '좋아, 그럼 번호표로 하자!', 'happy']] },
        ],
      },
      { learn: 2 },
      { revisit: true },
      '(드디어 축제 날! 교실이 반짝반짝 꾸며졌어요.)',
      { if: 'festival_name', then: ['(입구에 "{festival_name}"이라고 크게 쓰여 있어요.)'] },
      { if: 'surprise_game', then: [['taeo', '자, 이제 깜짝 놀이 시간이야! 모두 준비됐어?', 'happy'], ['yerin', '하나, 둘, 셋! (모두가 깔깔 웃어요.)', 'happy']] },
      { if: 'reconciled', then: [['jia', '현우랑 같이 정한 무대야. 어때?', 'happy'], ['hyunwoo', '지아 계획표 덕분에 하나도 안 헷갈렸어!', 'happy']] },
      { if: 'repair_pending', then: [['hyunwoo', '(현우와 지아가 아직 조금 어색하게 서 있어요.)', 'think']] },
      {
        choice: 'B5S4', theme: 'greet',
        say: '누구한테 먼저 가 볼까?',
        options: [
          { text: '지아에게 인사한다', mood: 'happy', reply: [['jia', '{부름}! 처음 포스터 봤던 날 생각나? 여기까지 왔어!', 'happy']] },
          { text: '태오와 예린에게 간다', mood: 'happy', reply: [['taeo', '우리 놀이 봤어? 예린이가 같이 해 줬어!', 'happy'], ['yerin', '{부름} 덕분에 용기 냈어.', 'happy']] },
          { text: '현우와 소율을 돕는다', mood: 'happy', reply: [['hyunwoo', '도와줘서 고마워! 무대가 딱 맞게 됐어.', 'happy'], '나도… 같이 해서 좋았어.'] },
        ],
      },
      ['jia', '축제가 완벽하지는 않았지만 정말 즐거웠어.', 'happy'],
      {
        choice: 'B5S5', theme: 'empathy',
        say: '(축제가 끝나 가요. 마지막으로 무엇을 할까요?)',
        options: [
          { text: '모두에게 "고마워!" 하고 말한다', set: { last_choice: 'thanks' }, mood: 'happy', reply: ['우리도 고마워!'] },
          { text: '서운했던 친구에게 먼저 다가간다', set: { last_choice: 'apologize' }, mood: 'happy', reply: [['hyunwoo', '먼저 와 줘서 고마워. 사실 나도 말 걸고 싶었어.', 'happy']] },
          { text: '가장 기억나는 순간을 이야기한다', set: { last_choice: 'memory' }, mood: 'happy', reply: ['나는 너랑 준비물 세던 게 제일 기억나!'] },
        ],
      },
      { ending: 'math' },
      ['jia', '방학 때도 우리 다 같이 만나서 놀자! 약속!', 'happy'],
      '{부름}, 나랑도 친구 해 줄 거지? 고마워!',
    ],
    reunion: ['방학 전에 남은 물건을 10개씩 묶어 정리하자!', '{부름}, 번호표 순서가 섞였어. 같이 맞춰 줄래?', '축제 사진이 50장이 넘어! 같이 세어 볼래?'],
  },

  /* ============================ 국어 A1 · 기분을 말해요 · 도윤 ============================ */
  'k1-6': {
    title: '첫 번째 편지',
    scenes: [
      '(입학식 날, 새 교실. 한 친구가 두리번두리번 무언가를 찾고 있어요.)',
      {
        choice: 'A1S1', theme: 'greet',
        say: '안녕! 나 도윤이야. 그런데 내 이름표가 없어졌어!',
        options: [
          { text: '"내가 같이 찾아 줄게!"', set: { nametag: 'together' }, mood: 'happy', reply: ['정말? 고마워!', '(도윤이가 먼저 웃으며 손을 잡아요.)'] },
          { text: '"선생님께 여쭤보자."', set: { nametag: 'teacher' }, mood: 'happy', reply: ['아, 그게 좋겠다! 고마워.', '(선생님께서 교실 어딘가에 있을 거라고 하셨어요.)'] },
        ],
      },
      {
        choice: 'A1S2', theme: 'together',
        say: '책상 사이에서 바스락 소리가 나! 어디 있을까?',
        options: [
          { text: '책상부터 살펴본다', mood: 'happy', reply: ['(책상 밑을 보니 종이가 바스락바스락 움직여요.)', '바스락바스락! 여기서 소리가 났어!'] },
          { text: '사물함부터 살펴본다', mood: 'happy', reply: ['(사물함 문을 여니 끼익 소리가 나요.)', '끼익! 여긴 없네. 아, 저기 바스락바스락 소리!'] },
        ],
      },
      '방금 "바스락바스락", "끼익" 같은 말 들었지? 소리나 모양을 따라 하는 말이래!',
      { learn: 0 },
      '(책상 밑 종이 사이에서 이름표가 나왔어요!)',
      {
        choice: 'A1S3', theme: 'empathy',
        say: '찾았다! 나 정말 조마조마했어. 너는 어땠어?',
        options: [
          { text: '"나도 걱정됐어."', mood: 'happy', reply: ['너도 걱정해 줬구나. 같은 마음이라 좋다!'] },
          { text: '"찾아서 신나!"', mood: 'happy', reply: ['나도 신나! 우리 둘 다 신나는 기분이다!'] },
          { text: '"처음엔 조금 무서웠어."', mood: 'happy', reply: ['무서웠는데도 같이 찾아 줬구나. 무섭다고 말해 줘서 고마워.'] },
        ],
      },
      '"조마조마해", "신나", "무서워" 같은 말로 내 마음을 알려 줄 수 있어.',
      { learn: 1 },
      '(교실 뒤 우체통에 접힌 편지가 꽂혀 있어요.\n"여름이 오기 전에 꼭 전하고 싶은 말이 있어.")',
      {
        choice: 'A1S4', theme: 'refuse',
        say: '(누가 쓴 편지일까? 어떻게 할까요?)',
        options: [
          { text: '도윤에게 보여 준다', set: { letter_route: 'shared' }, mood: 'happy', reply: ['우와, 비밀 편지다! 누가 쓴 걸까? 우리 같이 알아보자!'] },
          { text: '혼자 조용히 보관한다', set: { letter_route: 'private' }, mood: 'think', reply: ['(편지를 주머니에 살짝 넣었어요. 누가 쓴 걸까?)'] },
          { text: '선생님께 맡긴다', set: { letter_route: 'teacher' }, mood: 'happy', reply: ['선생님께 맡기면 주인을 찾을 수 있을 거야. 좋은 생각이다!'] },
        ],
      },
      '편지 쓴 친구는 어떤 기분이었을까? 우리도 "나는 ~해서 ~했어" 하고 기분을 말해 보자!',
      { learn: 2 },
      '우리 내일도 같이 놀자!',
      '(그때 교실 뒤에서 누군가 우체통을 열었다 닫는 소리가 나요. 달칵!)',
      {
        choice: 'A1S5', theme: 'together',
        say: '(무슨 소리일까?)',
        options: [
          { text: '무슨 소리인지 살펴본다', set: { heard_mailbox: true }, mood: 'think', reply: ['(우체통 앞에는 아무도 없어요. 편지가 한 장 더 생긴 것 같아요!)'] },
          { text: '도윤을 따라 나간다', mood: 'happy', reply: ['같이 가자! 내일 또 만나!'] },
        ],
      },
      { revisit: true },
      '오늘 이름표 찾아 줘서 정말 고마워.',
      '{부름}, 우리 이제 친구야!',
    ],
    reunion: ['나 오늘 기분 좋은 일 있었어! 흉내 내는 말로 말해 볼게, 들어 줄래?', '{부름}, 우리 기분 말하기 놀이 또 하자!', '이름표 또 잃어버릴 뻔했어… 헤헤, 같이 놀자!'],
  },

  /* ============================ 국어 A2 · 낱말을 정확하게 읽어요 · 하린 ============================ */
  'k1-7': {
    title: '우체통 앞의 아이',
    scenes: [
      { if: 'letter_route=shared', then: [['doyun', '{부름}! 어제 그 편지 말이야, 계속 생각나!', 'happy']] },
      { if: 'letter_route=private', then: ['(주머니 속 편지가 자꾸 생각나요.)'] },
      { if: 'letter_route=teacher', then: [['doyun', '선생님께서 편지 주인을 찾아 주면 좋겠다고 하셨대!', 'happy']] },
      '(쉬는 시간, 우체통 앞에 처음 보는 친구가 서 있어요.)',
      {
        choice: 'A2S1', theme: 'greet',
        say: '아, 난 그냥… 여기 있는 글을 읽고 있었어.',
        options: [
          { text: '"무슨 글이야?" 하고 물어본다', mood: 'think', reply: ['우체통에 붙은 안내문이야. …나는 하린이야.'] },
          { text: '"안녕! 나는 {내이름}." 하고 먼저 인사한다', set: { harin_greeted: true }, mood: 'happy', reply: ['…안녕. 나는 하린이야. 먼저 인사해 줘서 고마워.'] },
        ],
      },
      {
        if: 'letter_route=private',
        then: ['(혹시 하린이가 편지를 쓴 걸까? 속으로 생각해요.)'],
        else: [['doyun', '(도윤이가 작게 속삭여요.) 혹시 하린이가 편지를 쓴 걸까?', 'think']],
      },
      {
        choice: 'A2S2', theme: 'calm',
        say: '(어떻게 할까요?)',
        options: [
          { text: '"직접 물어보고 확인하자."', mood: 'happy', reply: ['(하린이가 고개를 저어요.) 아니야. 나도 편지 주인이 궁금해서 보고 있었어.'] },
          { text: '"아직은 모르겠어."', mood: 'happy', reply: ['(맞아요. 아직 아무것도 몰라요.)'] },
          { text: '"맞을지도 몰라!"', set: { harin_accused: true }, mood: 'sad', reply: ['…나 아니야. 왜 나라고 생각해?', '(하린이가 조금 서운한 얼굴이에요.)'] },
        ],
      },
      '안내문에 받침이 어려운 낱말이 많아서 천천히 읽고 있었어. 같이 읽어 볼래?',
      { learn: 0 },
      '(하린이가 주머니에서 접힌 종이를 꺼내요.)',
      {
        choice: 'A2S3', theme: 'empathy',
        say: '이건 내가 쓴 게 아니라 도서 코너에서 주웠어.',
        options: [
          { text: '종이를 먼저 읽어 본다', mood: 'happy', reply: ['응, 읽어 봐. 글씨가 조금 삐뚤빼뚤해.'] },
          { text: '하린이의 설명을 먼저 듣는다', set: { listened_harin: true }, mood: 'happy', reply: ['…내 말 먼저 들어 주는구나. 그 종이, 책 사이에 끼어 있었어. 주인이 찾을까 봐 가지고 있었어.'] },
        ],
      },
      { learn: 1 },
      '(종이에는 이렇게 적혀 있어요. "말을 걸고 싶은데 용기가 안 나.")',
      {
        choice: 'A2S4', theme: 'empathy',
        say: '누군가 외로운가 봐.',
        options: [
          { text: '"우체통에 다시 넣어 주자."', mood: 'think', reply: ['그래. 주인이 다시 가져갈 수 있게.'] },
          { text: '"같이 주인을 찾아보자."', set: { investigate_together: true }, mood: 'happy', reply: ['…같이? 좋아. 너랑 같이라면.'] },
        ],
      },
      '이 글을 쓴 사람은 무슨 말을 하고 싶었을까? 글쓴이의 마음을 찾아보자.',
      { learn: 2 },
      {
        choice: 'A2S5', theme: 'refuse',
        say: '그런데 이 글씨, 첫 번째 편지랑 달라.',
        options: [
          { text: '"도윤이에게도 알려 주자."', set: { clue_shared: true }, mood: 'happy', reply: ['그래. 도윤이도 같이 찾고 있으니까.', ['doyun', '진짜? 편지가 두 장이라는 거야? 대단한 단서다!', 'happy']] },
          { text: '"우리 둘만의 비밀로 하자."', set: { harin_secret: true }, mood: 'happy', reply: ['…응. 우리 둘만 아는 거야.'] },
        ],
      },
      { revisit: true },
      { if: 'harin_accused', then: ['아까 의심받아서 조금 서운했어. 그래도 끝까지 같이 해 줘서 고마워.'], else: ['…고마워. 내 말 들어 줘서.'] },
      '{부름}, 우리… 친구 할래?',
    ],
    reunion: ['도서 코너에서 받침 어려운 책을 찾았어. 같이 읽어 줄래?', '{부름}, 우체통에 새 글이 붙었어. 같이 읽어 보자.', '…심심하면 나랑 낱말 읽기 놀이 할래?'],
  },

  /* ============================ 국어 A3 · 그림일기를 써요 · 수아 ============================ */
  'k1-8': {
    title: '도윤이랑 친하다며?',
    scenes: [
      { if: 'clue_shared', then: [['doyun', '하린이가 글씨가 다르다고 알려 줬어! 편지가 두 장인가 봐.', 'happy']] },
      { if: 'harin_secret', then: [['harin', '(하린이가 작게 말해요.) 그 쪽지 이야기, 아직 우리 둘만 아는 거지?', 'think']] },
      '(그림일기 시간. 옆자리 친구가 슬쩍 말을 걸어요.)',
      {
        choice: 'A3S1', theme: 'together',
        say: '너 도윤이랑 친하지? 사실 나 도윤이랑 친해지고 싶어. 도와줄래? 아, 나는 수아야!',
        options: [
          { text: '"같이 놀 기회를 만들어 볼게!"', set: { sua_plan: 'play' }, mood: 'happy', reply: ['정말? 고마워! 벌써 두근두근해.'] },
          { text: '"도윤이한테 직접 물어보자."', set: { sua_plan: 'ask' }, mood: 'think', reply: ['직접…? 떨리지만 그게 맞는 것 같아.'] },
          { text: '"도윤이의 어떤 점이 좋아?"', set: { sua_plan: 'why' }, mood: 'happy', reply: ['음… 잘 웃고, 먼저 인사해 주는 거! 나도 그렇게 되고 싶어.'] },
        ],
      },
      '그런데 도윤이 앞에서 말할 때 떨리면 어떡하지? 바르게 말하는 자세를 같이 연습해 줄래?',
      { learn: 0 },
      ['doyun', '(도윤이가 창밖을 보며 혼잣말을 해요.) 나는 새 친구가 생기면… 예전 친구가 날 잊을까 봐 걱정돼.', 'sad'],
      {
        choice: 'A3S2', theme: 'empathy', who: 'doyun',
        say: '너는 그런 적 없어?',
        options: [
          { text: '도윤이의 말을 끝까지 들어 준다', set: { doyun_open: true }, mood: 'happy', reply: [['doyun', '들어 줘서 고마워. 사실 이건 너한테만 하는 말이야.', 'happy']] },
          { text: '"괜찮아! 아무도 안 잊어." 하고 격려한다', mood: 'happy', reply: [['doyun', '정말? 그렇게 말해 주니까 힘이 나!', 'happy']] },
        ],
      },
      {
        choice: 'A3S3', theme: 'refuse',
        say: '(수아가 조심스럽게 물어요.) 도윤이가 나를 싫어하니? 혹시 뭐라고 했어?',
        options: [
          { text: '도윤이의 걱정을 그대로 말해 준다', set: { secret_leaked: true, apology_needed: true }, mood: 'think', reply: ['아… 도윤이가 그런 걱정을 하는구나.', '(도윤이가 나한테만 한 말인데, 말해 버렸어요.)'] },
          { text: '"그건 도윤이 비밀이야. 대신 셋이 같이 놀자!"', set: { respectful_help: true }, mood: 'happy', reply: ['비밀을 지켜 주는구나. 멋지다! 그래, 같이 놀자!'] },
          { text: '"도윤이한테 직접 물어보자."', set: { respectful_help: true }, mood: 'happy', reply: ['응, 내가 직접 물어볼게. 옆에 있어 줘!'] },
        ],
      },
      '오늘 있었던 일을 문장으로 말해 볼까? "언제, 어디에서, 무엇을 했다" 하고!',
      { learn: 1 },
      '(세 친구가 오늘 있었던 일을 그림으로 남겨요.)',
      {
        choice: 'A3S4', theme: 'together',
        say: '난 오늘 처음으로 도윤이한테 말을 걸었어!',
        options: [
          { text: '내가 기억에 남는 순간을 먼저 말한다', mood: 'happy', reply: ['우와, 그 장면을 그리면 되겠다!'] },
          { text: '"수아가 먼저 이야기해 봐!"', mood: 'happy', reply: ['그럼 나는 도윤이랑 웃는 그림을 그릴래. 날짜랑 날씨도 써야지!'] },
        ],
      },
      { learn: 2 },
      '(다음 날 아침, 교실 게시판에 쪽지가 붙어 있어요.\n"도윤이는 친구가 없어질까 봐 무섭대.")',
      {
        choice: 'A3S5', theme: 'calm',
        say: '(누가 붙였을까? 어떻게 할까요?)',
        options: [
          { text: '쪽지를 떼어서 보관한다', set: { note_kept: true }, mood: 'think', reply: ['(다른 친구들이 보기 전에 얼른 떼었어요.)'] },
          { text: '도윤이에게 먼저 알린다', set: { note_told: true }, mood: 'think', reply: [['doyun', '…내 이야기가 왜 저기 있지?', 'sad']] },
        ],
      },
      { revisit: true },
      '네 덕분에 용기 낸 하루였어!',
      '{부름}, 나랑도 친구 해 줄래?',
    ],
    reunion: ['그림일기 또 썼어! 바른 자세로 발표하는 거 봐 줄래?', '{부름}, 오늘 있었던 일 같이 그림일기로 써 보자!', '도윤이랑 놀았던 이야기 들려줄게! 너도 들려줄래?'],
  },

  /* ============================ 국어 A4 · 감동을 나누어요 · 민준 ============================ */
  'k1-9': {
    title: '찢어진 편지의 진실',
    scenes: [
      '(교실 바닥에 찢어진 편지 조각들이 흩어져 있어요.)',
      '나는 민준이야. 이거 봐. 찢어진 종이를 하린이 책상 옆에서 봤어. 하린이가 그런 거 아냐?',
      { if: 'harin_accused', then: [['harin', '…또 나야? 저번에도 나 의심했잖아.', 'sad']] },
      { if: '!harin_accused & listened_harin', then: [['harin', '네가 지난번에 내 말 먼저 들어 줬잖아. 이번에도 들어 줄래?', 'think']] },
      {
        choice: 'A4S1', theme: 'calm',
        say: '(어떻게 할까요?)',
        options: [
          { text: '"책상 옆에 있었다고 하린이가 한 건 아니야."', mood: 'happy', reply: ['음… 듣고 보니 그렇네. 내가 너무 빨리 생각했나?'] },
          { text: '"하린이한테 직접 물어보자."', mood: 'happy', reply: [['harin', '물어봐 줘서 고마워. 나 아니야. 나도 깜짝 놀랐어.', 'happy']] },
          { text: '"민준이 말이 맞을지도 몰라."', set: { harin_accused: true }, mood: 'sad', reply: [['harin', '…나 진짜 아니야.', 'sad'], '(하린이가 고개를 푹 숙여요.)'] },
        ],
      },
      ['doyun', '(도윤이가 쪽지를 들고 와요.) 내 이야기가 왜 쪽지에 적혀 있었어?', 'sad'],
      {
        choice: 'A4S2', theme: 'calm', who: 'doyun',
        say: '나 그거 너한테만 말했는데…',
        options: [
          { if: 'secret_leaked', text: '"내가 수아한테 말했어. 정말 미안해."', set: { apology_completed: true }, mood: 'happy', reply: [['doyun', '…말해 줘서 고마워. 서운했지만, 사과해 주니까 괜찮아졌어.', 'happy']] },
          { text: '"누가 썼는지 같이 알아보자."', mood: 'think', reply: [['doyun', '응… 같이 알아보자.', 'think']] },
        ],
      },
      { if: 'secret_leaked & !apology_completed', then: [['sua', '(수아가 다가와요.) 도윤아, 사실 나도 들은 거야. 우리 같이 사과하자.', 'think'], ['doyun', '…알았어. 다음엔 비밀은 지켜 줘.', 'think']] },
      '누가 무엇을 했는지부터 정리해 보자!',
      { learn: 0 },
      {
        choice: 'A4S3', theme: 'together',
        say: '잠깐! 이 조각들, 날짜도 글씨도 달라!',
        options: [
          { text: '"일어난 일을 차례대로 말해 보자."', mood: 'happy', reply: ['좋아! 처음에 무슨 일이 있었는지부터!'] },
          { text: '"한 명씩 기억나는 걸 말해 보자."', mood: 'happy', reply: [['sua', '나는 그림일기 시간에 쪽지를 봤어.', 'think'], ['doyun', '나는 입학식 날 우체통에서 편지를 봤어!', 'happy']] },
        ],
      },
      { learn: 1 },
      ['harin', '(하린이가 네 칸 그림을 그려 왔어요.) 내가 본 걸 그렸어. 이걸 보면… 내 말을 믿어 줄까?', 'think'],
      {
        choice: 'A4S4', theme: 'empathy', who: 'harin',
        say: '어때?',
        options: [
          { text: '그림을 보고 느낀 점을 말한다', mood: 'happy', reply: [['harin', '그렇게 느꼈구나. 내 그림을 잘 봐 줘서 고마워.', 'happy']] },
          { text: '"그릴 때 어떤 마음이었어?" 하고 물어본다', mood: 'happy', reply: [['harin', '…무서웠어. 아무도 안 믿어 줄까 봐. 물어봐 줘서 고마워.', 'happy']] },
        ],
      },
      { learn: 2 },
      '(알고 보니 편지는 두 장이었어요. 하나는 입학식 날의 첫 번째 편지, 하나는 하린이가 주운 쪽지. 두 종이가 우연히 섞여 찢어진 거였어요.)',
      '미안해, 하린아. 제대로 알아보지 않고 말했어.',
      {
        choice: 'A4S5', theme: 'calm',
        say: '(어떻게 화해하면 좋을까요?)',
        options: [
          { text: '"민준이랑 같이 모두 앞에서 사과하자."', set: { reconciliation_style: 'public' }, mood: 'happy', reply: [['harin', '…모두 앞에서 말해 줘서 고마워.', 'happy']] },
          { text: '"하린이는 어떻게 하면 좋겠어?" 하고 묻는다', set: { reconciliation_style: 'private' }, mood: 'happy', reply: [['harin', '조용히 말해 주면 좋겠어. …응, 이제 괜찮아.', 'happy']] },
        ],
      },
      ['harin', '그리고… 사실 첫 번째 편지, 내가 쓴 거야. 말을 걸 용기가 없어서 편지로 썼어.', 'think'],
      { revisit: true },
      '(우체통에 새 편지가 놓여 있어요.\n"이제는 직접 말할 수 있을 것 같아. 너희랑 친구가 되고 싶어.")',
      ['harin', '(하린이가 조용히 미소 지어요.)', 'happy'],
      {
        choice: 'A4S6', theme: 'together',
        say: '(이 편지를 어떻게 할까요?)',
        options: [
          { text: '교실에서 다 같이 읽는다', set: { letter_read: 'public' }, mood: 'happy', reply: [['doyun', '와, 우리 모두한테 쓴 편지구나!', 'happy']] },
          { text: '주인의 마음을 생각해 조용히 보관한다', set: { letter_read: 'private' }, mood: 'happy', reply: [['harin', '…지켜 줘서 고마워.', 'happy']] },
          { text: '다 같이 답장을 쓴다', set: { letter_read: 'reply' }, mood: 'happy', reply: [['sua', '좋아! 나도 쓸래!', 'happy']] },
        ],
      },
      { ending: 'korean' },
      '{부름}, 사실부터 확인하는 법 너한테 배웠어. 우리 친구 하자!',
    ],
    reunion: ['재미있는 이야기를 읽었어! 일이 일어난 차례대로 같이 정리해 줄래?', '{부름}, 만화 영화 보고 느낌 나누기 하자!', '이번엔 내가 먼저 확인하고 말할게. 같이 이야기 읽어 볼래?'],
  },
};

/** 과목 마지막 엔딩 — 조건 우선순위대로 하나를 골라요. 모든 엔딩은 긍정적이에요. */
const STORY_ENDINGS = {
  korean: [
    {
      id: 'A_END3', when: 'apology_needed & apology_completed', title: '다시 시작하는 편지',
      lines: [['doyun', '서운했지만 네 말을 들으니 알 것 같아.', 'happy'], ['minjun', '나도 미안해. 우리 새 편지 쓰자!', 'happy'], '(모두 함께 새 편지를 써요.)'],
    },
    {
      id: 'A_END2', when: 'respectful_help & reconciliation_style=private', title: '조용한 우정',
      lines: [['doyun', '다 말하지 않아도 친구일 수 있구나.', 'happy'], ['harin', '내 이야기를 기다려 줘서 고마워.', 'happy']],
    },
    {
      id: 'A_END4', when: 'clue_shared & reconciliation_style=public', title: '용기 낸 한마디',
      lines: ['(나도 용기를 내서 말해요. "나도 너희랑 친구가 되고 싶어!")', ['harin', '우리도!', 'happy'], ['doyun', '우리 모두 답장 쓸게!', 'happy'], ['sua', '나도!', 'happy']],
    },
    {
      id: 'A_END1', when: '', title: '함께 쓰는 편지',
      lines: [['doyun', '우리 모두 편지를 써 볼까?', 'happy'], ['harin', '이번에는 내가 먼저 읽어 줄게.', 'happy'], ['sua', '나도 용기를 낼래.', 'happy'], ['minjun', '사실부터 확인하는 친구가 될게.', 'happy']],
    },
  ],
  math: [
    {
      id: 'B_END3', when: 'repair_pending & last_choice=apologize', title: '화해의 축제',
      lines: [['jia', '나도 네 말을 들어 볼게.', 'happy'], ['hyunwoo', '다음엔 같이 정하자.', 'happy']],
    },
    {
      id: 'B_END2', when: 'surprise_game & taeo_heard', title: '깜짝 놀이 축제',
      lines: [['taeo', '내 생각을 들어 줘서 고마워!', 'happy'], ['yerin', '함께해서 즐거웠어.', 'happy']],
    },
    {
      id: 'B_END1', when: 'reconciled & soyul_understood', title: '함께 만든 축제',
      lines: [['jia', '우리 모두가 준비한 축제야!', 'happy'], ['hyunwoo', '네 의견도 정말 좋았어.', 'happy']],
    },
    {
      id: 'B_END4', when: '', title: '작은 축제, 큰 마음',
      lines: [['soyul', '작아도 우리 축제잖아.', 'happy'], '(모두 서로에게 "고마워!" 하고 말해요.)'],
    },
  ],
};

/** 레벨 테스트 (두 과목 공통 도입 · 한 번만) — 교문에서 교실까지 */
const TEST_STORY = {
  intro: [
    '(입학식 날 아침. 교문 앞에서 두 친구가 손을 흔들어요.)',
    ['jia', '안녕! 나는 지아야. 너도 1학년이지?', 'happy'],
    ['doyun', '나는 도윤이야! 우리가 교실까지 같이 가 줄게.', 'happy'],
    ['jia', '가는 길에 문제가 숨어 있대. 같이 풀어 볼래?\n틀려도 괜찮아. 아는 만큼만 하면 돼!'],
  ],
  // 몇 번째 문제 뒤에 나오는 장면
  between: {
    2: ['(교문 안 안내판 앞에 왔어요. "1학년 교실은 2층")', ['doyun', '안내판 잘 읽었지? 계속 가 보자!']],
    4: ['(신발장 앞이에요. 내 번호 칸에 신발을 쏙 넣어요.)', ['jia', '절반 왔어! 잘하고 있어.', 'happy']],
    6: ['(계단을 하나, 둘… 천천히 올라가요.)', ['doyun', '거의 다 왔어. 힘내!']],
    8: ['(복도 끝에 시간표가 붙어 있어요.)', ['jia', '이제 두 문제만 더!', 'happy']],
  },
  outro: [
    ['jia', '도착! 끝까지 해냈다! 정말 열심히 했어.', 'happy'],
    '(교실 뒤 게시판에 "여름 축제" 포스터가 붙어 있어요.)',
    ['jia', '여름 축제? 와, 재밌겠다!', 'happy'],
    '(그때 도윤이가 교실 뒤 우체통에서 접힌 편지를 꺼내요.)',
    ['doyun', '어? 편지가 있어! "여름이 오기 전에 꼭 전하고 싶은 말이 있어."', 'think'],
    ['doyun', '누가 쓴 걸까? 궁금하다!', 'think'],
    ['jia', '수학 교실에서는 내가, 국어 교실에서는 도윤이가 기다릴게. 또 만나!', 'happy'],
  ],
};

/* ------------------------------ 조건 · 엔딩 ------------------------------ */
/** 조건 글 'a & !b & c=값' → 참 / 거짓 */
function storyCond(cond, flags) {
  if (!cond) return true;
  const f = flags || {};
  return String(cond)
    .split('&')
    .map((x) => x.trim())
    .filter(Boolean)
    .every((part) => {
      if (part[0] === '!') return !f[part.slice(1)];
      const eq = part.indexOf('=');
      if (eq > 0) return String(f[part.slice(0, eq)]) === part.slice(eq + 1);
      return !!f[part];
    });
}

function storyEnding(subject, flags) {
  const list = STORY_ENDINGS[subject] || [];
  return list.find((e) => storyCond(e.when, flags)) || list[list.length - 1];
}
