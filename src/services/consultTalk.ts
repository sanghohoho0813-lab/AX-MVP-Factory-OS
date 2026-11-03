/**
 * D-508 고객에게 이렇게 말하세요 — 맞춤 추천 판정(buildInsights)을 상담 자리에서 그대로 읽을 수 있는 말로.
 *
 * 대표 고도화 최종 목표 "초보자가 써도 바로 컨설팅 전문가가 되게".
 *  - 판정 하나 → 말하기 카드: 고객에게 읽을 2~3문장 · 쉽게 말하면 · 대표님이 자주 묻는 것 · 이렇게는 말하지 마세요 · 부탁할 것.
 *  - 먼저 제안할 것 → 미팅 대본 한 장: 시작 → 먼저 여쭤볼 것 → 제안 1~3 → 받을 서류 → 마무리 · 다음 약속.
 *
 * 숫자 · 판정은 엔진이 낸 글(headline · amount · missing · request)만 쓴다 — 새로 계산하거나 부풀리지 않는다.
 * 규칙으로 만든 글이다('AI' 라고 부르지 않는다). 선정 · 승인 · 금액은 기관 · 세무서가 정한다고 늘 함께 적는다.
 * 고객에게 드리는 종이가 아니라 컨설턴트가 보는 메모다 — 수수료 · 영업자 · 업무 일기는 쓰지 않는다.
 */
import type { ClientOpsRecord } from '../types/clientOps'
import { josa } from '../lib/josa'
import { missingForPicks, topPicks, type Insight } from './clientInsights'
import type { ScenarioRun } from './scenarios'
import type { InsightTone } from './insightLabels'

export interface TalkQA {
  q: string
  a: string
}

export interface TalkCard {
  key: string
  /** 같은 모듈 안 갈래(절세 → 가지급금 · 퇴직금 · 급여/배당 · 법인전환) — 시험 · 화면 표지 */
  topic: string
  label: string
  tone: InsightTone
  /** 고객에게 그대로 읽어도 되는 문장 */
  say: string[]
  /** 판정 근거(화면에만 — 읽을 말이 아니다) */
  basis: string
  /** 쉽게 말하면 — 이 제도가 무엇인지 */
  easy: string
  /** 대표님이 자주 묻는 것 */
  faq: TalkQA[]
  /** 이렇게는 말하지 마세요 */
  avoid: string[]
}

/** 어느 카드에나 붙는 한 줄 — 결정은 기관 · 세무서가 한다 */
export const TALK_CAUTION = "선정 · 승인 · 금액은 기관(세금은 세무서)이 정해요 — '확정 · 무조건'이라고 말하지 않아요."

interface Topic {
  easy: string
  faq: TalkQA[]
  avoid: string[]
}

const REFUND_FAQ: TalkQA[] = [
  { q: '정말 돌려받을 수 있어요?', a: '신고서와 그해 숫자로 보면 가능해 보여요. 세무사가 다시 계산해서 신청(경정청구)하고, 결정은 세무서가 해요.' },
  { q: '언제까지 신청할 수 있어요?', a: '신고 기한이 지난 날부터 5년 안이면 신청할 수 있어요. 오래된 해부터 기한이 먼저 끝나요.' },
  { q: '얼마나 걸려요?', a: '세무서는 보통 신청을 받은 날부터 2개월 안에 결과를 알려 줘요.' },
  { q: '세무조사 받게 되나요?', a: '경정청구는 납세자가 쓸 수 있는 정해진 권리예요. 세무서가 근거 서류를 확인할 수 있어서, 근거를 갖춰 세무사와 함께 신청해요.' },
]

const TOPICS: Record<string, Topic> = {
  policy: {
    easy: '정부 · 공공기관이 낮은 금리로 직접 빌려주거나, 은행 대출에 보증을 서 주는 돈이에요. 지원금이 아니라 갚는 돈(대출)이에요.',
    faq: [
      { q: '갚아야 하나요?', a: '네, 대출이라 갚아요. 대신 정책 금리라 보통 일반 대출보다 이자가 낮고, 이자만 내는 기간(거치)을 두는 경우가 많아요. 정확한 금리 · 기간은 기관과 시기마다 달라 신청할 때 확인해요.' },
      { q: '신용이 좋지 않은데 될까요?', a: '기관마다 보는 기준이 달라서 서류로 맞는 기관부터 골라요. 세금이나 4대보험이 밀려 있으면 먼저 정리해야 신청할 수 있어요.' },
      { q: '얼마나 걸려요?', a: '서류가 다 갖춰지면 기관 상담 · 심사 · 현장 확인을 거쳐요. 보통 몇 주 걸리고, 기관 · 시기에 따라 달라요.' },
      { q: '이미 대출이 있어도 되나요?', a: '기존 대출이 있어도 신청할 수 있는 경우가 많지만, 한도와 심사에 반영돼요. 지금 대출 내역(금융거래확인서)을 보고 판단해요.' },
      { q: '신청은 어디서 해요?', a: '기관마다 접수 창구가 달라요(온라인 신청 · 지점 상담). 맞는 기관을 고른 뒤 신청서와 서류를 함께 준비해 드려요.' },
    ],
    avoid: ["'무조건 나와요' · '한도 얼마 확정' — 결정은 기관이 해요.", '지원금(안 갚는 돈)처럼 말하지 않아요 — 대출이에요.'],
  },
  employment: {
    easy: '직원을 새로 뽑거나 계속 고용하면 나라가 인건비 일부를 나눠 주는 지원금(갚지 않아요)과, 늘어난 직원 수만큼 세금을 깎아 주는 세액공제가 있어요.',
    faq: [
      { q: '갚아야 하나요?', a: '지원금은 갚지 않아요. 다만 정해진 기간 고용을 유지해야 하고, 조건을 어기면 받은 돈을 돌려내야 할 수 있어요.' },
      { q: '직원이 금방 그만두면요?', a: '지원금은 고용을 유지한 기간만큼 나와요. 세액공제도 그 뒤 직원 수가 줄면 공제가 줄거나 다시 낼 수 있어 세무사와 함께 봐요.' },
      { q: '어떤 직원이 대상이에요?', a: '보통 만 15~34세 청년 · 만 60세 이상 · 새로 들어온 정규직이 많이 대상이 돼요. 직원마다 나이 · 입사일 · 4대보험 · 근로계약을 보고 골라요.' },
      { q: '대표 가족도 되나요?', a: '사업주의 가족(배우자 · 자녀 등)은 지원 대상에서 빠지는 경우가 많아요. 제도마다 달라서 명부를 보고 하나씩 확인해요.' },
      { q: '언제 신청해요?', a: '채용 전이나 채용 후 정해진 기간 안에 신청해야 하는 제도가 있어요. 기한을 놓치면 못 받으니 채용 계획이 있으면 미리 알려 주세요.' },
    ],
    avoid: ["'직원 모두 받을 수 있어요' — 사람마다 조건이 달라요.", "금액은 1차 추정이에요 — '확정'이라고 하지 않아요."],
  },
  'employment-refund': {
    easy: '지난 신고 때 빠뜨린 통합고용세액공제(늘어난 직원 수만큼 깎아 주는 세금)는 5년 안이면 세무서에 다시 신청(경정청구)해 돌려받을 수 있어요.',
    faq: REFUND_FAQ,
    avoid: ["'바로 입금돼요' — 세무서가 검토한 뒤 결정해요."],
  },
  lab: {
    easy: '회사 안에 연구 전담 조직(기업부설연구소 · 연구개발전담부서)을 인정받으면, 연구원 인건비 같은 연구개발비 일부를 법인세에서 깎아 줘요.',
    faq: [
      { q: '얼마나 깎아 주나요?', a: '중소기업은 일반 연구개발비의 25%를 세액공제로 받는 것이 기본이에요. 이 회사 인건비로 계산한 금액은 화면에서 바로 볼 수 있어요.' },
      { q: '연구원이 꼭 있어야 하나요?', a: '네, 연구만 하는 사람이 있어야 해요. 연구소는 회사 규모에 따라 필요한 연구원 수가 있고 독립된 공간이 필요해요. 연구개발전담부서는 1명부터 가능해요.' },
      { q: '형식만 갖추면 되나요?', a: '아니요. 실제로 연구하고 연구노트 · 인건비 기록을 남겨야 해요. 사후 점검에서 활동이 없으면 인정이 취소되고, 받은 공제를 다시 낼 수 있어요.' },
      { q: '연구소가 있으면 다른 혜택도 있어요?', a: '정책자금 · 지원사업 가점, 벤처 확인 같은 인증에서 유리하게 쓰이는 경우가 많아요.' },
    ],
    avoid: ["'세금이 0원이 돼요' · '서류만 만들면 돼요'"],
  },
  'lab-refund': {
    easy: '연구소가 있는데 신고 때 연구개발비 세액공제를 빠뜨렸다면, 5년 안이면 경정청구로 돌려받을 수 있어요. 그해 연구원 인건비 기록이 있어야 해요.',
    faq: REFUND_FAQ,
    avoid: ["'바로 입금돼요' — 세무서가 검토한 뒤 결정해요.", '연구 기록 없이 청구하지 않아요 — 근거가 있어야 해요.'],
  },
  startup: {
    easy: '창업한 지 5년 안 중소기업은 회사 주소 · 업종 · 대표 나이(청년 여부)에 따라 법인세나 소득세를 일정 비율 깎아 줘요(창업중소기업 세액감면).',
    faq: [
      { q: '따로 신청해야 하나요?', a: '세금 신고할 때 감면 신청을 함께 해요. 지난 신고에서 빠졌다면 5년 안 경정청구로 돌려받을 수 있어요.' },
      { q: '몇 % 깎아 줘요?', a: '회사 주소(수도권 과밀억제권역인지) · 대표 나이 · 창업 형태에 따라 달라요. 판정 화면에 이 회사 감면율이 나와요.' },
      { q: '다른 공제랑 같이 받을 수 있어요?', a: '일부 세액공제와는 같은 해 함께 못 받는 경우가 있어요. 어느 쪽이 큰지 세무사와 계산해서 골라요.' },
      { q: '청년 창업이 뭐예요?', a: '창업할 때 대표 나이가 만 15~34세(군 복무 기간은 더해 줘요)면 청년 창업으로 봐서 감면이 더 커요.' },
    ],
    avoid: ["'세금 안 내셔도 돼요' — 감면율 · 기간 · 업종 조건이 있어요."],
  },
  'startup-refund': {
    easy: '감면 기간 안이었는데 신고서에 창업감면이 빠진 해는, 5년 안이면 경정청구로 돌려받을 수 있어요.',
    faq: REFUND_FAQ,
    avoid: ["'바로 입금돼요' — 세무서가 검토한 뒤 결정해요.", '창업 형태(새로 창업인지 · 이어받았는지)를 확인하기 전엔 단정하지 않아요.'],
  },
  loan: {
    easy: '가지급금은 증빙 없이 회사 통장에서 대표님 쪽으로 나간 돈이에요. 회사가 대표님께 빌려준 돈으로 봐서, 이자(인정이자)를 받은 것으로 계산해 해마다 세금이 붙어요.',
    faq: [
      { q: '왜 문제예요?', a: '갚기 전까지 해마다 인정이자만큼 소득으로 잡혀 세금이 늘어요. 금액이 클수록 손해가 커요.' },
      { q: '어떻게 정리해요?', a: '대표님 돈으로 갚기 · 급여나 상여로 받아 갚기 · 배당이나 퇴직금으로 정리하기 등 방법이 여러 가지예요. 세금이 가장 적은 길을 계산해서 골라요.' },
      { q: '세무조사 걱정은요?', a: '가지급금이 크면 세무서가 눈여겨볼 수 있어요. 그래서 원인과 규모를 먼저 정리하고, 실행은 세무사와 함께 해요.' },
      { q: '그냥 두면 어떻게 돼요?', a: '해마다 인정이자 세금이 붙고, 폐업이나 퇴직 때까지 갚지 못하면 대표님 상여로 보아 세금이 크게 나올 수 있어요.' },
    ],
    avoid: ["'바로 없앨 수 있어요' — 정리 방법마다 세금이 달라 계산한 뒤에 정해요.", "가지급금을 바로 '불법'이라고 말하지 않아요 — 원인 확인이 먼저예요."],
  },
  retire: {
    easy: '대표님 퇴직금은 회사 규정(정관 · 임원 퇴직금 규정)에 따라 받을 수 있는 한도가 있어요. 퇴직소득으로 받으면 같은 돈을 급여로 받을 때보다 세금 부담이 낮은 편이에요.',
    faq: [
      { q: '지금 받을 수 있어요?', a: '실제로 퇴직하거나 중간정산 사유가 있어야 해요. 지금은 한도와 세금을 미리 계산해 두는 단계예요.' },
      { q: '규정이 없으면요?', a: '정관이나 임원 퇴직금 규정을 먼저 정비해야 해요. 주주총회 결의가 필요해요.' },
      { q: '한도보다 많이 받으면요?', a: '한도를 넘는 부분은 퇴직소득이 아니라 근로소득으로 봐서 세금이 늘어요.' },
      { q: '중간정산은 안 되나요?', a: '임원 퇴직금 중간정산은 무주택자 주택 구입 같은 정해진 사유가 있을 때만 인정돼요.' },
    ],
    avoid: ["'세금이 거의 없어요' — 한도 · 근속연수에 따라 달라요."],
  },
  pay: {
    easy: '대표님이 회사 돈을 가져가는 방법(급여 · 상여 · 배당)마다 붙는 세금이 달라요. 이 회사 숫자로 같은 금액을 가져갈 때 세금이 덜 나오는 쪽을 계산했어요.',
    faq: [
      { q: '배당이 항상 유리해요?', a: '아니요. 회사 이익 · 대표님의 다른 소득 · 주주 구성에 따라 달라요. 그래서 이 회사 숫자로 계산해서 비교해요.' },
      { q: '배당하려면 뭐가 필요해요?', a: '배당할 수 있는 이익(이익잉여금)이 있어야 하고, 주주총회(정관에 따라 이사회) 결의와 주식 비율대로 나누는 절차가 필요해요.' },
      { q: '건강보험료도 달라져요?', a: '네, 급여와 배당은 건강보험료 계산이 달라요. 실행 전에 함께 확인해요.' },
      { q: '배당은 언제 해요?', a: '보통 결산이 끝난 뒤 주주총회에서 정해요. 중간배당은 정관에 규정이 있어야 해요.' },
    ],
    avoid: ["'배당이 무조건 싸요' — 이 회사 숫자로 계산한 결과로만 말해요."],
  },
  convert: {
    easy: '개인사업자가 법인으로 바꾸면 세금 구조가 달라져요(종합소득세 → 법인세 + 대표 급여 세금). 이 회사 사업소득으로 둘을 나란히 계산했어요.',
    faq: [
      { q: '법인이 무조건 유리해요?', a: '아니요. 소득이 클수록 유리해지는 경우가 많지만, 대표님이 돈을 가져가는 방법 · 4대보험 · 운영 비용에 따라 달라요.' },
      { q: '바꾸는 데 비용이 드나요?', a: '방법(새로 세우기 · 현물출자 · 사업양수도)에 따라 등기 · 세금 비용이 달라요. 세무사와 시점 · 방법을 정해요.' },
      { q: '거래처 · 통장은 어떻게 돼요?', a: '법인은 새 사업자라 사업자등록 · 통장 · 계약을 법인 이름으로 바꿔야 해요.' },
      { q: '언제 바꾸는 게 좋아요?', a: '성실신고확인 대상이 되거나 소득이 크게 늘 때 많이 검토해요. 시점은 세금 신고 · 부동산 여부에 따라 세무사와 정해요.' },
    ],
    avoid: ["'법인으로 바꾸면 세금이 확 줄어요' — 계산한 숫자로만 말해요."],
  },
  tax: {
    easy: '대표님이 회사 돈을 가져가는 방법(급여 · 배당 · 퇴직금)과 시기를 바꿔 세금 합계를 줄이는 설계예요.',
    faq: [
      { q: '무엇을 드리면 돼요?', a: '주주명부와 대표님 급여(원천징수영수증)가 있으면 계산을 시작할 수 있어요. 재무제표가 있으면 가지급금 · 배당할 수 있는 이익까지 봐요.' },
      { q: '세무사님이 하던 것과 달라요?', a: '세무사님은 신고를 맡고, 저희는 돈을 가져가는 방법을 숫자로 비교해 드려요. 실행은 세무사님과 함께 확인해요.' },
      { q: '지금 바로 바꿔야 하나요?', a: '급할 필요는 없지만, 결산 전에 정하면 선택지가 많아요. 숫자를 보고 올해 할 것과 내년 할 것을 나눠요.' },
    ],
    avoid: ["'세금이 반으로 줄어요' — 계산 전에는 숫자를 말하지 않아요."],
  },
  gift: {
    easy: '대표님 재산이나 회사 주식을 가족에게 미리 넘길 때 드는 세금(증여세)과, 나중에 드는 세금(상속세)을 미리 계산해 두는 설계예요.',
    faq: [
      { q: '미리 넘기면 세금이 줄어요?', a: '주식 가치가 오르기 전에 넘기면 나중에 오른 만큼의 세금을 줄일 수 있는 경우가 있어요. 다만 같은 사람에게 10년 안에 다시 주면 합쳐서 계산해요.' },
      { q: '자녀에게 세금 없이 줄 수 있는 돈은요?', a: '성인 자녀는 10년 동안 5,000만원, 미성년 자녀는 2,000만원까지 증여재산공제가 있어요. 혼인 · 출산 공제가 따로 있을 수 있어요.' },
      { q: '가업승계 특례가 뭐예요?', a: '조건을 갖춘 회사 주식을 자녀에게 넘길 때 증여세를 낮춰 주는 제도예요. 대표 나이 · 경영 기간 · 사후관리 조건이 있어 세무사와 함께 확인해요.' },
      { q: '증여세 신고는 언제까지예요?', a: '증여받은 날이 속한 달의 말일부터 3개월 안에 신고해요. 기한 안에 신고하면 신고세액공제(3%)가 있어요.' },
    ],
    avoid: ["'세금 없이 넘길 수 있어요' — 공제 한도 · 10년 합산 규칙이 있어요."],
  },
  cert: {
    easy: '벤처기업 확인 · 이노비즈 · 메인비즈 같은 인증은 정책자금 · 보증 우대와 지원사업 가점에 쓰이고, 벤처는 세금 감면과도 이어질 수 있어요.',
    faq: [
      { q: '받으면 뭐가 좋아요?', a: '정책자금 · 보증에서 우대받고 지원사업 심사에서 가점이 붙는 경우가 많아요. 창업 3년 안에 벤처 확인을 받으면 창업감면이 커질 수도 있어요.' },
      { q: '얼마나 걸려요?', a: '유형과 준비 정도에 따라 달라요. 서류 심사와 평가 기관 확인(실사)을 거쳐요.' },
      { q: '떨어지면 어떡해요?', a: '그래서 신청 전에 조건을 먼저 점검하고, 부족한 것을 채운 뒤 신청해요.' },
      { q: '벤처 확인은 몇 년 가요?', a: '벤처기업 확인은 보통 3년 동안 유효하고, 끝나기 전에 다시 받아야 해요.' },
      { q: '이노비즈 · 메인비즈는 뭐가 달라요?', a: '이노비즈는 기술혁신형, 메인비즈는 경영혁신형 중소기업 인증이에요. 평가 기준이 달라 회사에 맞는 쪽을 골라요.' },
    ],
    avoid: ["'100% 통과' — 평가 기관이 정해요."],
  },
  grants: {
    easy: '정부 · 지자체가 공고를 내서 뽑는 지원 프로그램이에요(바우처 · 보조금 · 교육 등). 공고마다 조건 · 마감 · 회사가 내는 몫(자부담)이 달라요.',
    faq: [
      { q: '갚아야 하나요?', a: '보조금 · 바우처는 보통 갚지 않아요. 다만 회사가 일부를 부담하는 사업이 많아요. 공고마다 달라요.' },
      { q: '선정될까요?', a: '여러 회사가 경쟁하는 심사라 사업계획서가 중요해요. 조건이 맞는 공고만 골라 준비해요.' },
      { q: '마감이 언제예요?', a: '공고마다 달라요. 화면에 마감일이 있어 늦지 않게 챙겨 드려요.' },
      { q: '사업계획서는 누가 써요?', a: '회사 이야기를 바탕으로 저희가 함께 써요. 대표님은 사업 내용 · 숫자 확인만 해 주시면 돼요.' },
    ],
    avoid: ["'신청만 하면 받아요' — 경쟁 심사예요."],
  },
}

/** 판정 하나가 어느 이야기인지 — 같은 모듈이라도 머리글로 나눈다 */
export function talkTopic(ins: Insight): string | null {
  const h = ins.headline
  const refund = /경정청구/.test(h)
  switch (ins.key) {
    case 'policy-funding':
      return 'policy'
    case 'employment':
      return refund ? 'employment-refund' : 'employment'
    case 'labcare':
      return refund ? 'lab-refund' : 'lab'
    case 'startup-tax':
      return refund ? 'startup-refund' : 'startup'
    case 'tax':
      if (ins.label === '법인전환 검토') return 'convert'
      if (/가지급금/.test(h)) return 'loan'
      if (/퇴직금/.test(h)) return 'retire'
      if (/가져간다면/.test(h)) return 'pay'
      return 'tax'
    case 'cert-os':
      return 'cert'
    case 'grants':
      return 'grants'
    default:
      return null
  }
}

/** 머리글을 소리 내 읽는 말로 — ' — ' 는 문장 사이로, 끝은 마침표 */
function spoken(text: string): string {
  const t = text.replace(/\s+—\s+/g, '. ').replace(/\s+/g, ' ').trim()
  return /[.?!]$/.test(t) ? t : `${t}.`
}

const shortName = (m: string) => m.replace(/\s*\(.*\)\s*$/, '').trim()
const listOf = (items: readonly string[]) => items.map(shortName).join(' · ')

/** 받을 것이 서류(종이 · 파일)인지 — 아니면 여쭤서 듣는 정보(직원 수 · 연구 공간 · 창업 형태 …) */
export function isDocName(name: string): boolean {
  return /명부|증명|등본|재무제표|보고서|명세|영수증|계약서|확인서|규정|정관|신고서|사업자등록증|원천징수|주주명부|인정서|신분증|통장|사본/.test(name)
}

/** 서류가 아닌 것 — 상담 자리에서 여쭐 말 */
const ASK_INFO: [RegExp, string][] = [
  [/창업\s*형태/, '처음 새로 창업하신 건가요, 하던 사업을 이어받으신 건가요?'],
  [/급여/, '대표님 급여는 한 달에 어느 정도 받고 계세요?'],
  [/매출/, '작년 매출은 어느 정도였나요?'],
  [/^직원\s*수/, '직원은 지금 몇 분이세요?'],
  [/설립일|창업일/, '회사는 언제 세우셨어요?'],
  [/생년월일/, '대표님 나이(생년)를 여쭤봐도 될까요? 청년 감면 · 지원에 필요해서요.'],
  [/업종/, '주로 어떤 일을 하세요(업종)?'],
  [/주소/, '사업장 주소가 어디세요?'],
]

function askLine(name: string): string {
  const n = shortName(name)
  if (isDocName(n)) return `${josa(n, '을/를')} 받아 볼 수 있을까요?`
  const known = ASK_INFO.find(([re]) => re.test(n))
  if (known) return known[1]
  if (/\s수$/.test(n)) return `${n}는 몇 명이세요?`
  return `${josa(n, '이/가')} 있으세요?`
}

/** '…만 보내 주시면' — 서류가 아닌 것이 섞이면 '알려 주시면' */
const giveVerb = (items: readonly string[]) => (items.every((m) => isDocName(m)) ? '보내 주시면' : '알려 주시면')

/** 고객에게 읽을 문장 — 엔진 글만 쓴다 */
function sayLines(ins: Insight, topic: string): string[] {
  const out: string[] = []
  const label = ins.label
  if (ins.tone === 'need') {
    if (ins.missing.length) out.push(`대표님, ${label} 쪽은 ${listOf(ins.missing)}만 ${giveVerb(ins.missing)} 가능 여부를 바로 확인해 드릴게요.`)
    else out.push(`대표님, ${label} 쪽은 몇 가지만 더 확인하면 판정할 수 있어요. ${spoken(ins.headline)}`)
    return out
  }
  if (ins.tone === 'no') {
    out.push(`대표님, ${josa(label, '은/는')} 지금 자료로는 어려워 보여요. ${spoken(ins.headline)}`)
    out.push('대신 먼저 말씀드린 것부터 챙기시는 게 좋겠어요.')
    return out
  }
  if (ins.tone === 'done') {
    out.push(`대표님, ${label} — ${spoken(ins.headline)}`)
    return out
  }
  // 볼 만함 · 바로 제안
  const policy = /^진행 가능성\s+(\S+)\s+·\s+추천 기관\s+(.+)$/.exec(ins.headline)
  const loan = /^가지급금\s+(\S+?)\s+—/.exec(ins.headline)
  const retire = /세후 약\s+(\S+)/.exec(ins.headline)
  const pay = /—\s*(급여|배당)\s*쪽/.exec(ins.headline)
  const staff = /^직원\s+(\d+)명\s+—\s+(.+)$/.exec(ins.headline)
  const refund = topic.endsWith('-refund')
  if (topic === 'policy' && policy) out.push(`대표님, 지금 받은 자료로 보면 정책자금은 ${policy[2]} 쪽이 가장 맞고, 진행 가능성은 '${policy[1]}'으로 보여요.`)
  else if (topic === 'loan' && loan) out.push(`대표님, 재무제표를 보니 가지급금이 ${loan[1]} 있어요. 그대로 두면 인정이자 · 세금으로 해마다 손해가 생겨요.`)
  else if (topic === 'retire' && retire) out.push(`대표님, 지금 규정대로 퇴직금을 한도까지 받으시면 세금을 떼고 약 ${retire[1]}이 남는 것으로 계산돼요.`)
  else if (topic === 'pay' && pay) out.push(`대표님이 1억을 더 가져가신다면, 이 회사 숫자로는 ${pay[1]} 쪽이 세금이 덜 나와요.`)
  else if (staff) out.push(`대표님, 직원이 ${staff[1]}명이시니 ${spoken(staff[2])}`)
  // 머리글에 모듈 이름이 없으면 앞에 붙인다('감면 가능성은 있으나 …' → '창업감면 쪽은 감면 가능성은 있으나 …')
  else out.push(`대표님, ${refund || ins.headline.includes(label.replace(/\s.*$/, '')) ? '' : `${label} 쪽은 `}${spoken(ins.headline)}`)
  if (ins.amount) out.push(`숫자로는 ${josa(ins.amount, '으로/로')} 나와요 — 확정 금액이 아니라 지금 자료로 계산한 값이에요.`)
  if (ins.request) out.push(`신청에 필요한 서류 ${ins.request.count}가지는 목록으로 보내 드릴게요.`)
  else if (ins.missing.length) out.push(`${josa(listOf(ins.missing), '을/를')} ${giveVerb(ins.missing)} 더 정확하게 말씀드릴게요.`)
  else out.push(refund ? '괜찮으시면 세무사님과 다시 계산해서 신청을 준비해 보겠습니다.' : '괜찮으시면 이것부터 준비해 보겠습니다.')
  return out
}

/** 판정 하나 → 말하기 카드(이야기가 없는 모듈 · 크레탑은 없음) */
export function talkCard(ins: Insight): TalkCard | null {
  const topic = talkTopic(ins)
  if (!topic) return null
  const t = TOPICS[topic]
  return {
    key: ins.key,
    topic,
    label: ins.label,
    tone: ins.tone,
    say: sayLines(ins, topic),
    basis: ins.detail,
    easy: t.easy,
    faq: t.faq,
    avoid: t.avoid,
  }
}

/** 말하기 카드를 복사할 글로(카톡 메모 · 미팅 노트) */
export function talkText(card: TalkCard): string {
  return [
    `[${card.label}] 고객에게 이렇게 말하세요`,
    ...card.say.map((s) => `· ${s}`),
    '',
    `쉽게 말하면 — ${card.easy}`,
    '',
    '대표님이 물으면',
    ...card.faq.flatMap((f) => [`Q. ${f.q}`, `A. ${f.a}`]),
    '',
    '이렇게는 말하지 마세요',
    ...card.avoid.map((a) => `· ${a}`),
    `· ${TALK_CAUTION}`,
  ].join('\n')
}

export interface ScriptSection {
  id: string
  title: string
  lines: string[]
  /** 제안 칸 — 대표님이 물을 만한 것(두 개만) */
  faq?: TalkQA[]
  /** 문답 머리(없으면 '대표님이 물으면') */
  faqTitle?: string
  /** 제안 칸 — 그 모듈(말하기 카드 탭으로 이어짐) */
  key?: string
}

export interface MeetingScript {
  company: string
  /** 먼저 제안할 것 수(0 이면 '자료 받는 미팅') */
  pickCount: number
  sections: ScriptSection[]
}

/**
 * D-508 대표님이 망설이시면 — 제안을 들은 뒤 자주 나오는 말에 초보 컨설턴트가 할 말(일반 응대 · 어느 회사에나).
 * 밀어붙이지 않는다 — 기다려 드리고, 자료만 먼저 · 세무사와 함께 · 안 된 이유부터 · 서류는 우리가 정리. 수수료 이야기는 여기 넣지 않는다(컨설턴트 메모).
 */
export const HESITATE: readonly TalkQA[] = [
  { q: '생각 좀 해 볼게요', a: '네, 천천히 정하셔도 돼요. 자료만 먼저 받아 두면, 정하실 때 바로 시작할 수 있고 기한을 놓치지 않게 챙겨 드려요.' },
  { q: '세무사님이 다 알아서 해 줘요', a: '세무사님은 신고를 맡으시고, 저희는 받을 수 있는 지원 · 공제를 찾아 신청까지 챙겨요. 찾은 내용은 세무사님과 함께 확인해서 진행해요.' },
  { q: '전에 해 봤는데 안 됐어요', a: '그때 어떤 이유로 안 됐는지 알려 주시면 그 부분부터 먼저 점검해요. 해마다 조건 · 예산이 바뀌기도 해요.' },
  { q: '서류 챙길 시간이 없어요', a: '어디서 떼는지까지 정리한 목록을 보내 드려요. 종이 서류는 휴대폰으로 찍어 보내 주셔도 돼요.' },
  { q: '정말 받을 수 있어요?', a: "확정은 기관 심사(세금은 세무서)로 정해져요. 지금 자료로 될 만한 것과 어려운 것을 솔직하게 나눠 말씀드릴게요." },
]

/**
 * 미팅 대본 한 장 — 먼저 제안할 것(같은 엔진 · 같은 순서) 그대로.
 * 제안이 없으면 '자료 받는 미팅'(판정에 필요한 것부터 여쭙기).
 */
export function meetingScript(record: Pick<ClientOpsRecord, 'companyName'>, insights: readonly Insight[]): MeetingScript {
  const company = record.companyName || '이 회사'
  const picks = topPicks(insights).map((p) => ({ p, card: talkCard(p) })).filter((x): x is { p: Insight; card: TalkCard } => !!x.card)
  const need = missingForPicks(insights, 4)
  const sections: ScriptSection[] = []
  sections.push({
    id: 'open',
    title: '시작',
    lines: [
      `대표님, 보내 주신 자료로 ${josa(company, '을/를')} 먼저 정리해 왔습니다.`,
      picks.length ? `오늘은 바로 챙기실 수 있는 것 ${picks.length}가지를 말씀드리고, 필요한 자료를 정리해 드릴게요.` : '오늘은 회사 상황을 여쭙고, 받을 수 있는 지원을 판정하는 데 필요한 자료를 정리해 드릴게요.',
    ],
  })
  sections.push({
    id: 'ask',
    title: '먼저 여쭤볼 것',
    lines: [...new Set([...need.map(askLine), '올해 사람을 더 뽑을 계획이 있으세요?', '요즘 회사 자금은 어디에 가장 많이 필요하세요?'])],
  })
  picks.forEach(({ p, card }, i) => {
    sections.push({ id: `pick-${p.key}`, key: p.key, title: `제안 ${i + 1} · ${p.label}`, lines: card.say, faq: card.faq.slice(0, 2) })
  })
  // 제안을 들은 뒤 망설이시면 — 밀어붙이지 않는 응대(제안이 있을 때만)
  if (picks.length) sections.push({ id: 'hesitate', title: '대표님이 망설이시면', lines: [], faq: [...HESITATE], faqTitle: '이렇게 말씀하시면' })
  // 받을 서류는 종이 · 파일만(직원 수 · 연구 공간 같은 것은 위 '먼저 여쭤볼 것' 에서 듣는다)
  const docs = [...new Set([...picks.flatMap(({ p }) => (p.request ? [`${p.label} 신청 서류 ${p.request.count}가지(목록은 따로 보내 드림)`] : [])), ...need.filter(isDocName).map(shortName)])]
  if (docs.length) sections.push({ id: 'docs', title: '받을 서류', lines: ['다음 자료만 보내 주시면 바로 이어서 진행할게요.', ...docs.map((d) => `· ${d}`)] })
  const first = picks[0]?.p.label
  sections.push({
    id: 'close',
    title: '마무리 · 다음 약속',
    lines: [
      first ? `대표님, 오늘 전부 정하실 필요는 없어요. ${josa(first, '을/를')} 먼저 준비하고, 결과를 보고 나머지를 이어서 보시죠.` : '대표님, 자료를 받으면 받을 수 있는 것을 정리해서 다시 말씀드릴게요.',
      '자료 받는 대로 결과를 정리해서 연락드릴게요. 다음 미팅은 언제가 편하세요?',
    ],
  })
  return { company, pickCount: picks.length, sections }
}

/** 미팅 대본을 복사할 글로 */
export function meetingScriptText(s: MeetingScript): string {
  const out: string[] = [`[${s.company}] 미팅 대본`, '']
  s.sections.forEach((sec, i) => {
    out.push(`${i + 1}. ${sec.title}`)
    out.push(...sec.lines.map((l) => (l.startsWith('· ') ? `   ${l}` : `   ${l}`)))
    if (sec.faq?.length) {
      out.push(`   ${sec.faqTitle ?? '대표님이 물으면'}`)
      out.push(...sec.faq.flatMap((f) => [`   Q. ${f.q}`, `   A. ${f.a}`]))
    }
    out.push('')
  })
  out.push(`※ ${TALK_CAUTION}`)
  return out.join('\n')
}

/** D-508 상황 예시(scenarios — 같은 엔진) 하나 → 그 모듈 이야기 */
export function scenarioTopic(r: Pick<ScenarioRun, 'id' | 'module'>): string {
  switch (r.module) {
    case 'policy-funding':
      return 'policy'
    case 'employment':
      return 'employment'
    case 'labcare':
      return 'lab'
    case 'startup-tax':
      return 'startup'
    default:
      if (r.id === 'tax-loan') return 'loan'
      if (r.id === 'tax-retire') return 'retire'
      if (r.id === 'calc-t9-convert') return 'convert'
      if (/^tax-(cash|salary|treasury)/.test(r.id)) return 'pay'
      if (/^tax-(gift|succession|inherit)|^calc-t[78]/.test(r.id)) return 'gift'
      return 'tax'
  }
}

/**
 * 상황 예시 말하기 — '{상황}' 경우를 이 회사 숫자로 계산해 봤어요 → 결과 한 줄 → 금액(엔진 값 그대로) → 빠진 숫자.
 * 아직 계산하지 못한 상황(need)은 무엇만 알려 주시면 되는지.
 */
export function scenarioTalk(r: ScenarioRun): TalkCard {
  const topic = scenarioTopic(r)
  const t = TOPICS[topic]
  const missing = r.needs.filter((n) => !n.ok).map((n) => n.label)
  const say: string[] = []
  if (r.state === 'need') {
    say.push(`대표님, '${r.title}' 경우를 계산해 보려면 ${missing.length ? `${listOf(missing)}만 ${giveVerb(missing)}` : '몇 가지만 더 알려 주시면'} 바로 숫자로 보여 드릴게요.`)
  } else {
    say.push(`대표님, '${r.title}' 경우를 이 회사 숫자로 계산해 봤어요.`)
    say.push(spoken(r.headline))
    if (r.amount) say.push(`숫자로는 ${josa(r.amount, '으로/로')} 나와요 — 확정 금액이 아니라 지금 자료로 계산한 값이에요.`)
    if (r.state === 'partial' && missing.length) say.push(`${josa(listOf(missing), '을/를')} ${giveVerb(missing)} 더 정확하게 다시 계산해 드릴게요.`)
  }
  return { key: r.module, topic, label: r.title, tone: r.state === 'need' ? 'need' : 'maybe', say, basis: r.lines.filter((l) => l !== r.headline).slice(0, 2).join(' · '), easy: t.easy, faq: t.faq, avoid: t.avoid }
}

/** 이야기 이름(찾기 결과 표지) */
export const TOPIC_LABEL: Record<string, string> = {
  policy: '정책자금',
  employment: '고용지원금',
  'employment-refund': '빠진 공제 돌려받기',
  lab: '연구소',
  'lab-refund': '빠진 공제 돌려받기',
  startup: '창업감면',
  'startup-refund': '빠진 공제 돌려받기',
  loan: '가지급금',
  retire: '퇴직금',
  pay: '급여 · 배당',
  convert: '법인전환',
  tax: '절세',
  gift: '증여 · 상속',
  cert: '기업인증',
  grants: '지원사업',
  hesitate: '대표님이 망설이시면',
}

export interface FaqHit {
  topic: string
  label: string
  q: string
  a: string
}

/** 찾기에 쓰는 낱말 — 두 글자 이상 · 조사 · 어미는 뗀다 */
function tokensOf(text: string): string[] {
  return text
    .replace(/[?!.,·()'"“”‘’~\-—]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/(은|는|이|가|을|를|에|에서|으로|로|도|만|요|나요|까요|세요|해요|돼요|되나요|인가요|있어요|없어요)$/, ''))
    .filter((w) => w.length >= 2)
}

/**
 * D-508 대표님이 물은 말 → 가장 가까운 '대표님이 물으면' 답(모든 이야기) · 용어 뜻 — 규칙으로 찾는다(AI 아님).
 * 같은 답이 여러 이야기에 있으면(경정청구 세 가지) 한 번만. 맞는 것이 없으면 빈 목록.
 */
export function faqSearch(query: string, terms: Record<string, string> = {}, limit = 5): FaqHit[] {
  const qs = tokensOf(query)
  if (!qs.length) return []
  const hits: (FaqHit & { score: number })[] = []
  const seen = new Set<string>()
  for (const [topic, t] of Object.entries(TOPICS)) {
    const label = TOPIC_LABEL[topic] ?? topic
    for (const f of t.faq) {
      if (seen.has(f.q + f.a)) continue
      let score = 0
      for (const w of qs) {
        if (f.q.includes(w)) score += 3
        if (f.a.includes(w)) score += 1
        if (label.includes(w)) score += 2
      }
      if (score > 0) {
        seen.add(f.q + f.a)
        hits.push({ topic, label, q: f.q, a: f.a, score })
      }
    }
  }
  for (const f of HESITATE) {
    let score = 0
    for (const w of qs) {
      if (f.q.includes(w)) score += 3
      if (f.a.includes(w)) score += 1
    }
    if (score > 0) hits.push({ topic: 'hesitate', label: TOPIC_LABEL.hesitate, q: f.q, a: f.a, score })
  }
  for (const [term, def] of Object.entries(terms)) {
    let score = 0
    for (const w of qs) if (term.includes(w) || w.includes(term)) score += 4
    if (score > 0) hits.push({ topic: 'term', label: '용어', q: `${josa(term, '이/가')} 뭐예요?`, a: def, score })
  }
  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((h) => ({ topic: h.topic, label: h.label, q: h.q, a: h.a }))
}
