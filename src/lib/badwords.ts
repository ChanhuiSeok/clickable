// 한국어 및 영문 비속어/욕설/비하 단어 필터링 모듈
// 학교/교육 환경에 맞춘 유해 닉네임 방지

// 1. 핵심 금칙어 패턴 (변형 및 포함 검사)
const PROFANITY_PATTERNS = [
  // 욕설 및 비속어
  /시[바발벌빨]어?/,
  /씨[바발벌빨]어?/,
  /ㅅ[ㅂㅃ]/,
  /ㅂ[ㅅㅆ]/,
  /병[신쉰]/,
  /븅[신쉰]/,
  /지[랄랼]/,
  /ㅈ[ㄹ]/,
  /새[끼키]/,
  /존[나낟]/,
  /좃|좆|조까/,
  /창[녀놈]/,
  /걸레/,
  /느[금앰]마?/,
  /니[금앰]마?/,
  /애[미비]/,
  /엠[창창]/,
  /개[새소돼]/,
  /꺼[져저]/,
  /닥[쳐처]/,
  /미[친칭]/,
  /똘[아이]/,
  /호[로루]/,
  
  // 성적 / 혐오 표현
  /섹[스쓰]/,
  /자[위지털]/,
  /보[지찌]/,
  /자[지찌]/,
  /야동/,
  /포르노/,
  /자살/,
  /일베/,
  /메갈/,

  // 영문 대표 욕설
  /fuck/i,
  /shit/i,
  /bitch/i,
  /asshole/i,
  /dick/i,
  /pussy/i,
  /nigger/i,
];

/**
 * 텍스트에 비속어/욕설이 포함되어 있는지 검사합니다.
 * 특수문자나 공백을 섞어 우회하는 시도도 정규화하여 탐지합니다.
 */
export function checkProfanity(text: string): { isClean: boolean; matchedWord?: string } {
  if (!text || text.trim().length === 0) {
    return { isClean: true };
  }

  const raw = text.trim();

  // 1. 직접 정규식 패턴 매칭
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(raw)) {
      return { isClean: false };
    }
  }

  // 2. 특수문자/공백/숫자 치환하여 우회 시도 검사 (예: "시.발", "씨   발", "ㅅ1ㅂ")
  const normalized = raw
    .replace(/[0-9_\-\s.,~!?@#$%^&*()[\]{}|/\\+=`]/g, '')
    .toLowerCase();

  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(normalized)) {
      return { isClean: false };
    }
  }

  return { isClean: true };
}
