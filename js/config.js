/* =========================================================================
 * config.js — 수파베이스 연결 정보
 *
 *  - 수파베이스 대시보드 → Project Settings → API (또는 Data API) 에서 복사해요.
 *      supabaseUrl  Project URL            예) https://abcd1234.supabase.co
 *      supabaseKey  anon / publishable 키  (브라우저에 들어가도 되는 공개 키)
 *    service_role / secret 키는 절대 여기에 넣지 마세요.
 *  - 둘 중 하나라도 비어 있으면 예전처럼 이 기기 안에서만 동작해요. (서버 없이 개발할 때)
 *  - emailDomain: 아이디를 "아이디@emailDomain" 가짜 이메일로 바꿔 가입해요. 메일은 보내지 않아요.
 *    한 번 정하면 바꾸지 마세요. 바꾸면 이미 가입한 아이디로 로그인할 수 없어요.
 * ========================================================================= */
window.HG_CONFIG = {
  supabaseUrl: 'https://nhsdnuwsoeuicwwbbdbi.supabase.co',
  supabaseKey: 'sb_publishable_2PKrOveqZfIlEM6E86eAYQ_Ny53yOJ7',
  emailDomain: 'hangeoleum.app',
};
