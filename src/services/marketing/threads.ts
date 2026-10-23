/**
 * D-273 스레드(Threads) — 대표가 준 스레드 실측 공식(글 996개 수집 · 414개 틀 판정)을 OS 안 글쓰기 도구로.
 *  - 원하는 반응(답글 · 공유 · 공감 · 팔로워) → 틀 23가지(A~W + X) → 첫 줄 · 끝 → 500자 안 · 본문에서 팔지 않기.
 *  - 쓴 글은 규칙 검사(lintThreadPost — 규칙 계산, AI 아님)로 바로 확인하고, 올린 뒤 숫자를 적으면 우리 계정에서 되는 틀이 숫자로 나온다.
 *  - 저장은 새 표 없이 기존 모듈 기록(moduleData · marketing / threads).
 * 출처 문서 이름 · 남의 계정 이름 · 원문 문장은 화면에 두지 않는다 — 틀의 뼈대 · 숫자 · 우리 버전 예시만.
 */
import { generateId } from '../../storage/localStore'
import { nowIso, todayLocalDate } from '../../lib/appClock'
import { deleteRow, listRows, saveRow } from '../moduleData'
import type { AssistAnswer } from '../aiAssist/client'
import type { AssistContext } from '../aiAssist/context'
import { AX_AS_MONEY, AX_DENIED, EMOJI, HYPE, LINK, numberLint, principleLint } from './snsRules'

export const THREADS_MODULE = 'marketing'
export const THREADS_BUCKET = 'threads'
/** 스레드 한 글 한도 */
export const THREAD_MAX = 500

export type ThreadGoal = 'reply' | 'share' | 'like' | 'follow'
export type ThreadTemplateKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X'

export interface ThreadTemplate {
  key: ThreadTemplateKey
  name: string
  /** 강한 반응 한 줄(실측) */
  reaction: string
  goals: ThreadGoal[]
  /** 점수 중앙값(잘 터진 글 기준 · 없으면 null) */
  median: number | null
  /** 뼈대 — 줄 순서 */
  skeleton: string[]
  why: string
  /** 미래AI랩(김팀장)이 쓰면 */
  ours: string
  /** 쓸 때 꼭 지킬 것(있으면) */
  caution?: string
  /** 표본이 적은 틀(1~4개) — 경향만 */
  few?: boolean
  /** 우리 버전 완성 예시(사실 목록에 있는 것만 · [대괄호]는 확인 후 채움) */
  example?: string
  exampleTag?: string
}

export const THREAD_TEMPLATES: readonly ThreadTemplate[] = [
  {
    key: 'A',
    name: '만들었다 · 쓸 사람?',
    reaction: '답글 — 좋아요 100개당 답글 93개',
    goals: ['reply'],
    median: 639,
    skeleton: ['대상 부르기', '다들 겪는 불편', '한곳에 모은 도구', '기능 3개', '무료, 필요하면 댓글'],
    why: '결과가 급한 사람들이 받으려고 댓글을 답니다.',
    ours: '3분 AX 진단 · 지원사업 공고 정리 페이지 · 11월 오픈 컨설턴트 OS 의 "먼저 써 볼 컨설턴트?" 모집.',
    caution: '실제로 만든 것만.',
  },
  {
    key: 'B',
    name: '손해 + 숫자',
    reaction: '공유 — 좋아요 100개당 공유 45번',
    goals: ['share'],
    median: 411,
    skeleton: ['대상 사이 소문난 혜택', '제도 이름 + 최대 금액 + 한 줄 설명 ×5', '모르면 손해 한 줄'],
    why: '줄마다 금액이 박혀 있으면 저장하고 남에게 보냅니다. 같은 계정 안에서 보통 글의 4.3배.',
    ours: '벤처기업확인 세금 감면(계정 최고 글 조회 2.4천) · [업종] 대표님이 놓치는 제도 5개(공고 기준 금액만).',
    example:
      '창업 3년 안 된 대표님,\n세금 더 내고 계실 수 있어요.\n\n벤처기업확인을 창업 3년 안에 받으면\n요건 충족 시 법인세·소득세 5년간 50% 감면.\n\n한 해 이익 1억, 5년 같다고 단순 계산하면\n법인 약 1,650만 원 · 개인사업자 약 4,890만 원.\n\n(결과는 확인기관이 정하고, 회사마다 달라요)\n\n창업 몇 년 차예요? 1년 / 2년 / 3년',
    exampleTag: '벤처기업확인',
  },
  {
    key: 'C',
    name: '실화 · 성과',
    reaction: '좋아요 — 답글 0.29',
    goals: ['like'],
    median: 611,
    skeleton: ['바닥이던 과거', '처음 해낸 일', '평생 처음 강조', '교훈 한 줄'],
    why: '바닥 고백 뒤 성과가 나오면 축하 댓글이 붙습니다.',
    ours: '의료폐기물 고객 진행 과정 · IR 후속편 · 고객사에 붙인 AI 기능을 "직원 한 명 들인 셈" 비유로(실제 기능만).',
    caution: '실제 있었던 일만 · 고객 실명 · 매출 · 계약금액 없이.',
  },
  {
    key: 'D',
    name: '쓴소리 · 단정 · 대구',
    reaction: '좋아요',
    goals: ['like'],
    median: 697,
    skeleton: ['소신 선언', '흔한 X 말고 Y — 대구 3~4쌍', '결론 단정', '이유는? 하고 끊기'],
    why: '같은 모양의 대구가 리듬을 만들고, 마지막을 끊으면 다음 글을 기다립니다.',
    ours: '직원 더 뽑기 전에 반복 업무부터 / 외주 앱 몇 달 말고 2주 MVP부터 같은 대구.',
    caution: '다른 컨설턴트 · 업체를 겨누지 않습니다.',
  },
  {
    key: 'E',
    name: '번호 목록 · 따라 하기',
    reaction: '공유 — 0.28 (가장 많은 틀)',
    goals: ['share'],
    median: 628,
    skeleton: ['대부분은 여기서 멈춘다', '한 걸음 더 가면 달라진다', '1~N 순서', '저장해 둬'],
    why: '상위 글은 공유가 좋아요의 50~70%. 찬반이 갈리는 항목을 하나 섞으면 답글도 붙습니다. 같은 계정 안에서 3.7배.',
    ours: '처음부터 다시 한다면 정책자금 · 인증 · 자동화에서 할 것 · 안 할 것 10가지(지원사업이 시간 낭비가 되는 경우도 솔직히).',
  },
  {
    key: 'F',
    name: '자기소개 · 권위',
    reaction: '점수 중앙값 848 · 고정 글로',
    goals: ['follow', 'reply'],
    median: 848,
    skeleton: ['최고 성과 숫자', '기간 · 규모 숫자', '강의 안 판다', '답글로 물어보면 답해 줌'],
    why: '숫자 권위에 "팔지 않는다" 와 "무료로 답해 준다" 를 붙이면 질문 답글이 쏟아집니다. 프로필 맨 위 고정 글 하나는 꼭 이 틀로.',
    ours: '9년 · 100억+ · 사례 250건 + 정책자금 · 벤처확인 궁금한 것 답글로 물어보면 답할게.',
  },
  {
    key: 'G',
    name: '선택형 · 참여 질문',
    reaction: '답글 0.84 · 퍼짐은 약함',
    goals: ['reply'],
    median: 152,
    skeleton: ['직군 부르기', '일하며 불편한 것 적어 줘', '만들어 줄지도 몰라'],
    why: '질문 뒤에 "만들어 줄지도" 라는 보상이 붙어야 됩니다. 보상 없는 질문은 약합니다.',
    ours: '회사에서 매일 반복되는 귀찮은 일 적어 줘, 화면으로 바꿔 볼지도 → AX 수요 모으기.',
    caution: '팔로워가 적을 때는 단독보다 P · T · A 에 질문을 붙이는 편이 낫습니다.',
  },
  {
    key: 'H',
    name: '일정 · 발표 · 뉴스',
    reaction: '공유 — 0.47',
    goals: ['share'],
    median: 376,
    skeleton: ['날짜 · 시간', '대상 · 기간 · 방식(공고 그대로)', '그래서 [이걸] 먼저 해', '필요한 대표님한테 보내 줘'],
    why: '매달 나가던 돈을 0원으로 바꿔 주는 소식 · 접수 일정은 공유가 좋아요보다 많았습니다.',
    ours: '새 AI 도구 · 지원사업 변경을 우리 회사 업무에 붙이면 뭐가 달라지나 3가지로.',
    caution: '공고 원문을 보고 날짜를 확인한 뒤에만.',
  },
  {
    key: 'I',
    name: '판 깔기',
    reaction: '답글 — 0.87',
    goals: ['reply', 'follow'],
    median: 798,
    skeleton: ['대상 많다는 관찰', '여기서 자기 사업 소개해 봐', '노출 보상'],
    why: '자기 홍보할 자리를 주면 답글이 좋아요만큼 붙습니다.',
    ours: '대표님들 회사 소개 한 줄씩 → 반복 업무 적어 준 곳에 화면으로 바꾸는 법 답글.',
    caution: '답글에 실제로 답할 시간이 있는 날 올립니다.',
    example: '스레드에 대표님들 많던데,\n여기서 회사 소개 한 줄씩 해 봐.\n\n· 무슨 일 하는 회사인지\n· 요즘 제일 손 많이 가는 일 하나\n\n반복 업무 적어 준 곳엔\n화면 하나로 바꾸면 어떻게 되는지\n답글로 하나씩 답해 줄게.',
    exampleTag: 'AX',
  },
  {
    key: 'J',
    name: '돈 · 숫자 공개',
    reaction: '답글 — 0.48',
    goals: ['reply'],
    median: 402,
    skeleton: ['신분', '실제로 쓴 돈', '그래도 남는 이유'],
    why: '실제 숫자를 털어놓으면 비슷한 처지 사람들이 답합니다.',
    ours: 'AI 도구에 이번 달 실제로 쓴 비용과 그래도 남는 이유.',
    caution: '실제 숫자만 · 고객 금액 금지.',
    few: true,
  },
  {
    key: 'K',
    name: '고백 · 불안 · 감정',
    reaction: '답글 — 0.49',
    goals: ['like', 'reply'],
    median: 342,
    skeleton: ['힘들다 한 줄', '이대로면… 불안', '같은 처지끼리 친구하자'],
    why: '같은 처지 사람들이 몰려와 답합니다.',
    ours: '지원사업 또 떨어진 대표님들 같은 공통 한숨을 받아 주고, 대표님끼리 모이는 판으로.',
  },
  {
    key: 'L',
    name: '도움 · 추천 요청',
    reaction: '답글 — 0.68',
    goals: ['reply'],
    median: 447,
    skeleton: ['작은 성과', '초보라 두려움', '선배에게 딱 하나만'],
    why: '"딱 하나만" 은 대답하기 쉽습니다. 모은 답이 다음 글 소재가 됩니다.',
    ours: '지원금 받으면 제일 먼저 뭐에 쓰셨어요? 한마디만 → 답을 모아 후속 글.',
  },
  {
    key: 'M',
    name: '개념 · 이름 붙이기',
    reaction: '공유',
    goals: ['share'],
    median: 181,
    skeleton: ['앞으로의 방향', '그 모습 2~3줄', '나는 이걸 OO라고 부른다'],
    why: '흐릿하던 흐름에 이름을 붙여 주면 "이거다" 하고 퍼 갑니다.',
    ours: '작은 회사 AX 는 매일 손으로 하던 일 하나씩 화면으로 바꿔 나가는 방식 — 이름은 대표가 정하고, 정한 뒤로는 모든 글에서 같은 이름.',
    few: true,
    example: '작은 회사 AX는 앞으로 이렇게 갈 거야.\n\n큰 시스템을 한 번에 들이는 게 아니라,\n매일 손으로 하던 일 하나씩\n화면으로 바꿔 나가는 방식.\n\n나는 이걸 \'[한 칸 AX]\'라고 불러.\n한 칸 바꾸는 데 2주면 돼.\n\n너희 회사 첫 칸은 뭐야?',
    exampleTag: 'AX',
  },
  {
    key: 'N',
    name: '풍자 · 반어 · 밈',
    reaction: '좋아요',
    goals: ['like'],
    median: 708,
    skeleton: ['[집단] 특:', '흔한 현실', '반전 한 줄'],
    why: '웃으며 공감하고 지나갑니다 — 사람 모으기에만.',
    ours: '중소기업 특: 엑셀 잘하는 한 명한테 다 몰림. 그 사람 휴가 가면?',
  },
  {
    key: 'O',
    name: '보여 주기',
    reaction: '공유 — 0.26',
    goals: ['share'],
    median: 772,
    skeleton: ['소문난 기능', '내 분야로 실험', '걸린 시간', '설정 통째로 공개', '결과 영상 · 캡처'],
    why: '그대로 따라 할 수 있는 걸 통째로 주면 공유 · 리포스트가 높습니다. 같은 계정 안에서는 들쭉날쭉 — 가끔 쓰는 틀.',
    ours: '실제로 만든 업무 화면 짧은 영상 + 한 줄.',
    caution: '고객사 이름 · 숫자는 가립니다.',
  },
  {
    key: 'P',
    name: '자료 나눔 조건',
    reaction: '답글 1.75 · 점수 중앙값 1,903 (최고)',
    goals: ['reply'],
    median: 1903,
    skeleton: ['막막한 사람 부르기', '댓글 키워드면 자료 보내 줌', '최근 상담 사연', '내 신념 한 줄'],
    why: '"댓글 = 자료" 조건이 그대로 작동합니다. 같은 계정 안에서 3.9배.',
    ours: '벤처기업확인 셀프 점검표(4칸 · DM용 카드 6장)가 이미 있습니다.',
    caution: '자료를 실제로 만든 뒤에만 올리고, DM 은 직접 보냅니다.',
    few: true,
    example: '벤처기업확인 준비가 막막한 대표님.\n\n내가 상담 들어가기 전에 먼저 보는 점검표가 있어.\n업종 제한, 유형, 기술 근거, 조직까지\n한 장으로 체크하는 표야.\n\n필요한 대표님은 댓글에 "점검표" 남겨 줘.\nDM으로 보내 줄게.\n\n(결과는 확인기관이 정하고, 회사마다 달라)',
    exampleTag: '벤처기업확인',
  },
  {
    key: 'Q',
    name: '큐레이션',
    reaction: '공유 0.36 · 점수 중앙값 1,231',
    goals: ['share'],
    median: 1231,
    skeleton: ['대상 + 저장해 둬', '돈부터 쓰지 마', '단계별 기관 · 도구 목록', '한 번 정리하면 큰 차이'],
    why: '저장해 두고 다시 보는 목록입니다. 같은 계정 안에서 3.3배.',
    ours: '정책자금 · 인증 준비할 때 먼저 들어가 볼 곳 목록.',
    caution: '같은 모양 목록에 외부 링크를 붙여 매일 올리면 반응이 0 — 링크 없이, 가끔.',
    example: '정책자금·인증 준비하는 대표님, 이건 저장해 둬.\n\n돈 알아보기 전에 먼저 들어가 볼 곳.\n\n· 기업마당 — 지원사업 공고 모음\n· 중소벤처기업진흥공단 — 정책자금\n· 신용보증기금 · 기술보증기금 — 보증\n· 벤처확인종합관리시스템 — 벤처기업확인\n· [실제로 자주 보는 곳 하나]\n\n한 번 정리해 두면\n공고 볼 때 덜 헤매.',
    exampleTag: '정책자금',
  },
  {
    key: 'R',
    name: '연재 · 후속편',
    reaction: '좋아요',
    goals: ['like', 'follow'],
    median: 183,
    skeleton: ['N일차', '오늘 한 일', '막막함 고백', '그래도 확실한 하나', '앞으로 기록할 것'],
    why: '0에서 시작하는 첫날 고백은 답글이 붙습니다. 같은 계정 안에서는 보통 이하 — 가끔.',
    ours: '2주 MVP 제작 기록 1일차.',
    caution: '고객 동의 받은 프로젝트만.',
  },
  {
    key: 'S',
    name: '비교 · 폭로',
    reaction: '좋아요',
    goals: ['like'],
    median: 455,
    skeleton: ['같은 이름 다른 실체', '항목별 A vs B 4개'],
    why: '나란히 놓으면 내 쪽이 어디인지 스스로 봅니다.',
    ours: '같은 AX 라도 일하는 방식이 바뀐 회사 vs 도구만 깐 회사.',
    caution: '특정 업체 · 컨설턴트를 겨누지 않습니다.',
    few: true,
  },
  {
    key: 'T',
    name: '닿아라 · 대상 호출',
    reaction: '답글 — 0.77 · 타깃 팔로워',
    goals: ['follow', 'reply'],
    median: 826,
    skeleton: ['스레드야 나를 OO에게 데려다줘', '대상 번호 3개', '하나라도 해당되면 인사', '앞으로 올릴 것 약속'],
    why: '불린 사람들이 "나 여기" 하고 손을 듭니다. 타깃 팔로워를 모으는 데 가장 직접적입니다.',
    ours: '서류 · 반복 입력에 하루가 가는 대표님 · 뭐부터 할지 모르는 대표님 · AI 도입이 막막한 대표님.',
    example: '스레드야, 나를 이런 대표님들께 데려다줘.\n\n1. 서류랑 반복 입력에 하루가 다 가는 대표님\n2. 정책자금·벤처확인, 뭐부터 할지 모르는 대표님\n3. AI 도입하고 싶은데 어디서부터인지 막막한 대표님\n\n하나라도 해당되면 인사 남겨 줘.\n여기선 실제 진행 과정만 풀게.',
    exampleTag: '정책자금',
  },
  {
    key: 'U',
    name: '밥줄 공개',
    reaction: '공유 0.42 · 표본 최고점',
    goals: ['share'],
    median: null,
    skeleton: ['내 직업', '팔로워를 위해', '내 밥줄인 일을 혼자 하는 법', '작으면 맡기지 말고 직접 해'],
    why: '전문가가 자기 밥그릇을 내놓는 역설이 신뢰를 만듭니다. 혼자 하기 어려운 칸만 남겨 두면 그게 곧 상담 입구.',
    ours: '작은 회사가 벤처기업확인을 혼자 먼저 따져 보는 4가지.',
    few: true,
    example: '컨설턴트인 내 밥줄인데, 그냥 풀게.\n\n작은 회사는 벤처기업확인,\n혼자서도 먼저 따져 볼 수 있어.\n\n1. 우리 업종이 법으로 제한된 업종인지\n2. 어느 유형이 맞는지 (연구개발 / 혁신성장 / 벤처투자 / 예비벤처)\n3. 우리 기술을 보여 줄 근거가 있는지 (특허 출원, 작동하는 화면)\n4. 연구개발전담부서 같은 조직이 있는지\n\n넷 다 \'예\'면 직접 해 봐도 돼.\n막히는 칸이 있으면 그때 물어봐.\n(결과는 확인기관이 정하고, 회사마다 달라)\n\n저장해 두고 1번부터 체크해 봐.',
    exampleTag: '벤처기업확인',
  },
  {
    key: 'V',
    name: '대놓고 영업',
    reaction: '답글 — 0.95 · 한 달에 한 번',
    goals: ['reply'],
    median: 803,
    skeleton: ['오늘은 대놓고 영업할게', '원칙 한 줄', '맞는 사람 · 안 맞는 사람', '광고 끝'],
    why: '광고라고 먼저 털어놓는 솔직함에 응원 답글이 붙습니다.',
    ours: '2주 MVP 가 맞는 회사 · 안 맞는 회사.',
    caution: '한 달에 한 번만. 자주 쓰면 그냥 광고가 됩니다.',
    few: true,
    example: '오늘은 대놓고 영업할게.\n\n2주 MVP, 이런 회사엔 맞아.\n· 기술 아이디어는 있는데 보여 줄 화면이 없는 회사\n· 벤처기업확인 준비하면서 근거가 부족한 회사\n\n이런 회사엔 안 맞아.\n· 처음부터 전 직원용 큰 시스템이 필요한 회사\n\n맞는 쪽이면 프로필 링크에서 3분 진단부터.\n광고 끝.',
    exampleTag: 'AX',
  },
  {
    key: 'W',
    name: '한 명만 무료',
    reaction: '답글 — 0.69 (표본 1개)',
    goals: ['reply'],
    median: 216,
    skeleton: ['딱 1곳만 무료', '기간 · 분량', '조건은 후기', '실적 한 줄', 'DM'],
    why: '받을 사람이 딱 하나라 손을 들게 됩니다.',
    ours: '실제로 1곳을 무료로 해 줄 여력이 있을 때만.',
    caution: '지어낸 선착순 · 마감은 금지.',
    few: true,
  },
  {
    key: 'X',
    name: '전문가 즉답',
    reaction: '같은 계정 안에서 1.5배 · 시리즈로',
    goals: ['follow'],
    median: null,
    skeleton: ['[직업]이 답합니다', '[자주 받는 질문]?', '네 / 아니요 한 단어', '근데 [조건]', '(설명은 이어 쓰기)'],
    why: '점수 자체는 작지만 단독보다 시리즈 이름으로 쓰기 좋습니다.',
    ours: '정책자금 컨설턴트가 답합니다: 식당도 정책자금 돼요? → 네. 근데 [기본 컨디션 조건]이…',
  },
]

/** 쓰지 않는 틀 */
export const NOT_THIS = { key: 'Z', name: '남의 말 얹기', why: '남의 글을 인용하고 "공감" 한마디만 붙이거나 명언 한 줄만 올린 글 — 좋아요 2개 수준.' }

export const templateOf = (k: string): ThreadTemplate | undefined => THREAD_TEMPLATES.find((t) => t.key === k)

export const GOALS: ReadonlyArray<{ key: ThreadGoal; label: string; hint: string; picks: ThreadTemplateKey[] }> = [
  { key: 'reply', label: '답글 · 문의', hint: '대화가 붙고 문의로 이어지는 글', picks: ['P', 'A', 'I', 'T', 'V', 'G'] },
  { key: 'share', label: '공유 · 저장', hint: '저장해 두고 남에게 보내는 글', picks: ['B', 'U', 'Q', 'E', 'H', 'M'] },
  { key: 'follow', label: '팔로워 모으기', hint: '우리 고객이 될 사람이 손을 드는 글', picks: ['T', 'F', 'I', 'X'] },
  { key: 'like', label: '공감', hint: '퍼지지만 남지 않음 — 사람 모으기에만', picks: ['C', 'D', 'K', 'N', 'S'] },
]

/** 4주 운영안(주 5개) — 요일마다 목적 · 틀 */
export const WEEK_PLAN: Readonly<Record<number, { label: string; goal: ThreadGoal; picks: ThreadTemplateKey[] }>> = {
  1: { label: '저장 · 공유', goal: 'share', picks: ['U', 'Q', 'E', 'B'] },
  2: { label: '관계 · 팔로워', goal: 'follow', picks: ['T', 'I', 'F'] },
  3: { label: '신뢰', goal: 'like', picks: ['C', 'R'] },
  4: { label: '공감 · 논쟁', goal: 'like', picks: ['D', 'N', 'K', 'S'] },
  5: { label: '답글 · 리드', goal: 'reply', picks: ['P', 'A', 'G'] },
}
const DAY = ['일', '월', '화', '수', '목', '금', '토']

/** 오늘 요일 계획(주말은 null) */
export function todayPlan(today: string = todayLocalDate()): { day: string; label: string; goal: ThreadGoal; picks: ThreadTemplateKey[] } | null {
  const d = new Date(`${today}T00:00:00`)
  const w = d.getDay()
  const p = WEEK_PLAN[w]
  return p ? { day: DAY[w], ...p } : null
}

export const FIRST_LINES: ReadonlyArray<{ label: string; example: string; note: string }> = [
  { label: '고백', example: '솔직히 말하면, 나도 처음엔 [ ]였어.', note: '점수 중앙값 1,232 — 가장 높음' },
  { label: '숫자 · 결과', example: '2주 만에 작동하는 화면이 나왔어.', note: '같은 계정 안에서 3.9배' },
  { label: '대상 부르기', example: '창업 3년 안 된 대표님,', note: '같은 계정 안에서 3.5배 · 넓게 부르기' },
  { label: '뉴스 · 사실', example: '[기관]이 [날짜]부터 [변경]한대.', note: '공유 0.46 · 날짜는 원문 확인 뒤' },
  { label: '인사 · 소개', example: '안녕, 김팀장이야.', note: '답글형' },
  { label: '반전 예고', example: '다들 반대로 알고 있는 거 하나.', note: '좋아요형' },
  { label: '금지 명령', example: 'AX 처음이면 이것부터 만들지 마.', note: '공유 0.46' },
  { label: '단정 · 도발', example: '서류는 계획을 말하고, 화면은 실력을 말해.', note: '좋아요형' },
  { label: '감정 · 감탄', example: '와, 이건 나도 처음 봤어.', note: '답글형' },
  { label: '질문', example: '(첫 줄 질문은 가장 낮음 — 끝 줄로)', note: '점수 중앙값 286' },
]

export type EndingKind = 'material' | 'join' | 'want' | 'choice' | 'series' | 'open' | 'link' | 'none'
export const ENDINGS: ReadonlyArray<{ key: EndingKind; label: string; note: string; good: boolean }> = [
  { key: 'material', label: '자료 나눔 조건', note: '"댓글에 ○○ 남기면 보내 줄게" — 점수 중앙값 1,859 · 자료가 있을 때만', good: true },
  { key: 'join', label: '참여 요청', note: '"여기 적어 줘" — 같은 계정 안에서 2.7배', good: true },
  { key: 'want', label: '쓸 사람? · 저요', note: '답글이 좋아요보다 많음(1.13)', good: true },
  { key: 'series', label: '후속편 예고', note: '공유가 붙음(0.35) · 같은 계정 안에서 1.8배', good: true },
  { key: 'choice', label: '고르기 쉬운 질문', note: 'A / B / C · 몇 년 차 — 보상과 같이', good: true },
  { key: 'open', label: '열린 질문', note: '"어떻게 생각해?" — 답글은 붙어도 점수 중앙값 286', good: false },
  { key: 'link', label: '링크 · 상담 안내', note: '점수 중앙값 183 — 거의 꼴찌', good: false },
  { key: 'none', label: '그냥 끝 · 단정', note: '나쁘진 않지만 대답할 거리가 없음', good: false },
]

export const TOPIC_TAGS = ['정책자금', '벤처기업확인', '정부지원사업', 'AX', '경영컨설팅'] as const

/** 소재가 멀면 이 순서로(우리 분야 우선 주제) */
export const PRIORITY_TOPICS: ReadonlyArray<{ topic: string; tag: (typeof TOPIC_TAGS)[number] }> = [
  { topic: '심사 · 자금에서 우리 회사를 보여 줄 근거가 없다(작동하는 화면 = 눈에 띄는 자료)', tag: 'AX' },
  { topic: '벤처기업확인 세금 혜택을 놓치는 손해', tag: '벤처기업확인' },
  { topic: 'AI에 뒤처질까 걱정, 어디부터 할지 모름', tag: 'AX' },
  { topic: '반복 입력 · 대표가 다 확인해야 돌아가는 회사', tag: 'AX' },
]

/** 남의 글에 다는 전문가 답글(하루 3개) */
export const EXPERT_REPLY = '현장에서 보면 [사실 하나]도 같이 봐요.\n[그게 왜 중요한지 한 줄].'

/** 하루 10분 */
export const ROUTINE: ReadonlyArray<{ key: string; when: string; what: string; min: string }> = [
  { key: 'scan', when: '아침', what: '주제 태그(정책자금 · 벤처기업확인 · 정부지원사업) 인기 글 5개 훑고, 각각 어느 틀인지 붙이기', min: '3분' },
  { key: 'write', when: '아침', what: '오늘 글 1개 — 틀 고르기 → 쓰는 순서대로 → 규칙 검사', min: '4분' },
  { key: 'answer', when: '올린 뒤', what: '1시간은 답글에 바로 답하기 · "저요" 에는 링크로', min: '수시' },
  { key: 'expert', when: '점심 · 저녁', what: '업계 상위 글에 전문가 답글 3개(칭찬 한 줄 말고 사실 하나 더하기)', min: '3분' },
  { key: 'record', when: '금요일', what: '기록표 채우기 → 틀별 평균 비교 → 다음 주 틀 비중 정하기', min: '10분' },
]

/** 올리기 전 확인(검수 체크리스트 — 규칙 검사가 못 보는 것) */
export const BEFORE_POST = [
  '첫 줄이 "우리가 하는 것" 이 아니라 대표 입장의 손해 · 결과 · 질문인가',
  '실화(C) · 만들었다(A)는 실제 있었던 일 · 실제 만든 것인가',
  '일정 글(H)은 공고 원문으로 날짜 · 방식을 확인했는가',
  '자료 나눔(P)은 자료를 실제로 만들어 두었는가',
]

/* ------------------------------------------------------------------ */
/* 저장 모양                                                            */
/* ------------------------------------------------------------------ */

export interface ThreadStats {
  views: number | null
  likes: number | null
  replies: number | null
  reposts: number | null
  shares: number | null
  inquiries: number | null
}
export const STAT_KEYS: ReadonlyArray<{ key: keyof ThreadStats; label: string }> = [
  { key: 'views', label: '조회' },
  { key: 'likes', label: '좋아요' },
  { key: 'replies', label: '답글' },
  { key: 'reposts', label: '리포스트' },
  { key: 'shares', label: '공유' },
  { key: 'inquiries', label: '문의' },
]
export const EMPTY_STATS: ThreadStats = { views: null, likes: null, replies: null, reposts: null, shares: null, inquiries: null }

export interface ThreadPost {
  id: string
  savedAt: string
  template: ThreadTemplateKey | ''
  goal: ThreadGoal | ''
  topic: string
  tag: string
  body: string
  /** 본인 댓글(조회 1,000 넘으면 · 진단 · 자료 안내는 여기만) */
  selfComment: string
  /** 올리기 전 확인할 것([대괄호] · 확인할 숫자) */
  checks: string[]
  status: 'draft' | 'posted'
  /** 올린 날 YYYY-MM-DD */
  postedOn: string
  stats: ThreadStats
  source: 'hand' | 'ai' | 'example'
}

const TEMPLATE_KEYS = new Set<string>(THREAD_TEMPLATES.map((t) => t.key))
const GOAL_KEYS = new Set<string>(GOALS.map((g) => g.key))
const str = (v: unknown, n = 2000) => (typeof v === 'string' ? v.slice(0, n) : '')
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null)

export function normalizeThreadPost(raw: unknown, id: string): ThreadPost | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const body = str(r.body, 4000)
  if (!body.trim()) return null
  const s = (r.stats && typeof r.stats === 'object' ? r.stats : {}) as Record<string, unknown>
  const t = str(r.template, 2)
  const g = str(r.goal, 10)
  return {
    id,
    savedAt: str(r.savedAt, 40) || nowIso(),
    template: (TEMPLATE_KEYS.has(t) ? t : '') as ThreadTemplateKey | '',
    goal: (GOAL_KEYS.has(g) ? g : '') as ThreadGoal | '',
    topic: str(r.topic, 300),
    tag: str(r.tag, 30),
    body,
    selfComment: str(r.selfComment, 500),
    checks: Array.isArray(r.checks) ? r.checks.filter((x): x is string => typeof x === 'string').slice(0, 12).map((x) => x.slice(0, 200)) : [],
    status: r.status === 'posted' ? 'posted' : 'draft',
    postedOn: /^\d{4}-\d{2}-\d{2}$/.test(str(r.postedOn, 10)) ? str(r.postedOn, 10) : '',
    stats: { views: num(s.views), likes: num(s.likes), replies: num(s.replies), reposts: num(s.reposts), shares: num(s.shares), inquiries: num(s.inquiries) },
    source: r.source === 'ai' || r.source === 'example' ? r.source : 'hand',
  }
}

/** 올린 글은 올린 날 순, 그다음 쓰다 둔 글(저장한 순) */
export function sortThreadPosts(xs: readonly ThreadPost[]): ThreadPost[] {
  return [...xs].sort((a, b) => (a.status !== b.status ? (a.status === 'posted' ? -1 : 1) : (b.postedOn || b.savedAt).localeCompare(a.postedOn || a.savedAt) || b.savedAt.localeCompare(a.savedAt)))
}

export async function listThreadPosts(workspaceId: string | null): Promise<ThreadPost[]> {
  const rows = await listRows(workspaceId, THREADS_MODULE, THREADS_BUCKET)
  return sortThreadPosts(rows.map((r) => normalizeThreadPost(r.data, r.id)).filter((x): x is ThreadPost => x !== null))
}

export type ThreadInput = Omit<ThreadPost, 'id' | 'savedAt'> & Partial<Pick<ThreadPost, 'id' | 'savedAt'>>

export async function saveThreadPost(workspaceId: string | null, input: ThreadInput): Promise<ThreadPost> {
  const id = input.id ?? `thr_${generateId()}`
  const clean = normalizeThreadPost({ ...input, savedAt: input.savedAt ?? nowIso() }, id)
  if (!clean) throw new Error('글이 비어 있습니다.')
  const { id: _i, ...data } = clean
  void _i
  await saveRow(workspaceId, THREADS_MODULE, THREADS_BUCKET, { id, data: data as unknown as Record<string, unknown> })
  return clean
}

export async function removeThreadPost(workspaceId: string | null, id: string): Promise<void> {
  await deleteRow(workspaceId, THREADS_MODULE, THREADS_BUCKET, id)
}

/* ------------------------------------------------------------------ */
/* 점수 · 기록표                                                        */
/* ------------------------------------------------------------------ */

/** 기본 점수 = 좋아요 + 답글×3 + 리포스트×2 + 공유×3 (숫자를 하나도 안 적었으면 null) */
export function threadScore(s: ThreadStats): number | null {
  if (s.likes == null && s.replies == null && s.reposts == null && s.shares == null) return null
  return (s.likes ?? 0) + (s.replies ?? 0) * 3 + (s.reposts ?? 0) * 2 + (s.shares ?? 0) * 3
}

export interface TemplateRecord {
  key: ThreadTemplateKey
  name: string
  posts: number
  /** 점수를 적은 글 수 */
  scored: number
  avgScore: number | null
  avgViews: number | null
  inquiries: number
}

/** 틀별 평균 — 우리 계정에서 되는 틀(점수 높은 순 · 점수 없는 틀은 뒤) */
export function templateRecords(posts: readonly ThreadPost[]): TemplateRecord[] {
  const by = new Map<ThreadTemplateKey, ThreadPost[]>()
  for (const p of posts) if (p.status === 'posted' && p.template) by.set(p.template, [...(by.get(p.template) ?? []), p])
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
  return [...by.entries()]
    .map(([key, xs]) => {
      const scores = xs.map((p) => threadScore(p.stats)).filter((x): x is number => x != null)
      const views = xs.map((p) => p.stats.views).filter((x): x is number => x != null)
      return { key, name: templateOf(key)?.name ?? key, posts: xs.length, scored: scores.length, avgScore: avg(scores), avgViews: avg(views), inquiries: xs.reduce((a, p) => a + (p.stats.inquiries ?? 0), 0) }
    })
    .sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1) || b.posts - a.posts)
}

/** 이번 주(월~일) 올린 글 */
export function postsThisWeek(posts: readonly ThreadPost[], today: string = todayLocalDate()): ThreadPost[] {
  const d = new Date(`${today}T00:00:00`)
  const back = (d.getDay() + 6) % 7
  const mon = new Date(d.getTime() - back * 86400000)
  const from = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`
  return posts.filter((p) => p.status === 'posted' && p.postedOn >= from && p.postedOn <= today)
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
/** 기록표 CSV(주 1회 시트 한 장과 같은 칸) */
export function recordsCsv(posts: readonly ThreadPost[]): string {
  const head = ['날짜', '틀', '첫 줄', '조회', '좋아요', '답글', '리포스트', '공유', '문의', '점수', '주제 태그']
  const rows = posts.filter((p) => p.status === 'posted').map((p) => [p.postedOn, p.template ? `${p.template} ${templateOf(p.template)?.name ?? ''}` : '', firstLineOf(p.body), p.stats.views, p.stats.likes, p.stats.replies, p.stats.reposts, p.stats.shares, p.stats.inquiries, threadScore(p.stats), p.tag])
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
}

/* ------------------------------------------------------------------ */
/* 규칙 검사 — 규칙 계산(AI 아님)                                         */
/* ------------------------------------------------------------------ */

export const firstLineOf = (body: string) => (body.split('\n').find((l) => l.trim()) ?? '').trim()
/** 글자가 있는 줄 — 끝의 고지 괄호 줄("(결과는 확인기관이 …)")은 끝 방식에서 뺀다 */
const contentLines = (body: string) => {
  const xs = body.split('\n').map((l) => l.trim()).filter(Boolean)
  while (xs.length > 1 && /^\(.*\)$/.test(xs[xs.length - 1])) xs.pop()
  return xs
}

export function endingOf(body: string): EndingKind {
  const xs = contentLines(body)
  const last = xs[xs.length - 1] ?? ''
  const tail = xs.slice(-3).join(' ')
  if (/https?:\/\/|www\.|litt\.ly/i.test(last) || /상담\s*(?:신청|문의)/.test(last)) return 'link'
  if (/댓글[에로]?\s*["'“‘]?[^"'”’\n]{0,12}["'”’]?\s*(?:남기|남겨|달아|적어|써)/.test(tail) && /(?:보내|드릴|드려|줄게|준다)/.test(tail)) return 'material'
  if (/쓸\s*사람|써\s*볼\s*사람|필요한\s*사람\s*\?|저요/.test(xs.slice(-2).join(' '))) return 'want'
  if (/다음\s*(?:글|편)|후속|내일\s*(?:올릴|풀)|이어서\s*(?:올릴|풀)|[0-9]+\s*편에서/.test(last)) return 'series'
  if (/[?？]\s*$/.test(last)) return /\/|[A-C]\s*[·,]\s*[A-C]|몇\s*년\s*차|어느\s*쪽|뭐야\s*[?？]|어디야\s*[?？]/.test(last) ? 'choice' : 'open'
  if (/\S\s*\/\s*\S+\s*\/\s*\S/.test(last)) return 'choice'
  if (xs.some((l) => /(?:적어|남겨|알려|말해|해)\s*(?:줘|주세요|줄래|봐)[.!]?$/.test(l))) return 'join'
  return 'none'
}

export type LintLevel = 'ok' | 'warn' | 'bad'
export interface LintLine {
  key: string
  level: LintLevel
  text: string
}

const SELL = /상담\s*(?:신청|문의|예약)|문의\s*(?:주세요|하세요|환영)|연락\s*주세요|DM\s*주세요|할인|가격\s*[:은는]|[0-9,]+\s*원부터|지금\s*신청|프로필\s*링크/
const PRIVATE = /(?:매출|계약\s*금액?|수수료)\s*[0-9]/
const KNOCK = /(?:다른|타)\s*(?:컨설턴트|컨설팅|업체|회사)[^\n]{0,24}(?:사기|엉터리|별로|거르|조심|믿지\s*마)/

/**
 * 스레드 공식의 지켜야 할 줄을 글자로 확인한다. recent = 이미 저장한 글(같은 틀 반복 · V 한 달 한 번).
 * bad = 고칠 것(그래도 저장은 된다), warn = 보면 좋은 것.
 */
export function lintThreadPost(input: { body: string; template?: string; tag?: string; selfComment?: string; recent?: readonly ThreadPost[]; id?: string; today?: string; facts?: string }): { lines: LintLine[]; chars: number; firstLine: string; ending: EndingKind; bad: number; warn: number } {
  const body = input.body.replace(/\r\n?/g, '\n')
  const text = body.trim()
  const chars = text.length
  const first = firstLineOf(text)
  const ending = endingOf(text)
  const out: LintLine[] = []
  const add = (key: string, level: LintLevel, t: string) => out.push({ key, level, text: t })
  const today = input.today ?? todayLocalDate()

  add('len', chars > THREAD_MAX ? 'bad' : chars === 0 ? 'warn' : 'ok', chars > THREAD_MAX ? `${chars}자 — 한 글은 ${THREAD_MAX}자 안(1번 글에서 끝내기). ${chars - THREAD_MAX}자 줄이기` : `${chars}자 / ${THREAD_MAX}자`)
  const fl = first.length
  if (first) {
    // 15~25자가 가장 잘 됐다 — 10~30자는 통과(권장만 적음), 그 밖은 고칠 것
    if (/[?？]\s*$/.test(first)) add('first-q', 'warn', '첫 줄이 질문 — 질문으로 연 글이 가장 낮았어요(286). 질문은 끝 줄로')
    else if (fl >= 10 && fl <= 30) add('first', 'ok', fl >= 15 && fl <= 25 ? `첫 줄 ${fl}자` : `첫 줄 ${fl}자(15~25자가 가장 잘 됨)`)
    else add('first', 'warn', `첫 줄 ${fl}자 — 15~25자(대상 · 손해 · 숫자 · 결과 · 단정 · 고백)로`)
  }
  const lines = text ? text.split('\n').filter((l) => l.trim()).length : 0
  if (lines > 15) add('lines', 'warn', `${lines}줄 — 상위 글은 3~15줄. 한 줄에 한 생각으로 줄이기`)
  if (LINK.test(text)) add('link', 'bad', '본문에 링크 — 링크로 끝난 글은 거의 꼴찌(183). 링크는 본인 댓글 · "저요" 답글로')
  if (input.template !== 'V' && SELL.test(text)) add('sell', 'bad', '본문에 상담 · 판매 안내 — 본문에서 팔지 않기(본인 댓글로). 대놓고 영업은 V 틀로 한 달에 한 번')
  const hype = HYPE.exec(text)
  if (hype) add('hype', 'bad', `"${hype[0]}" — 보장 · 과장 · 지어낸 선착순은 쓰지 않아요`)
  if (/벤처/.test(text) && /감면|혜택|세금|받으면|받을|확인받|신청/.test(text) && !/확인\s*기관/.test(text)) add('venture', 'warn', '벤처 이야기 — "(결과는 확인기관이 정하고, 회사마다 달라)" 괄호를 붙여요')
  if (AX_AS_MONEY.test(text) && !AX_DENIED.test(text)) add('ax-money', 'bad', 'AX · 화면을 자금 받는 수단처럼 썼어요 — AX 는 일하는 방식을 바꾸는 일, 자금은 기관 심사')
  // D-274 대표 운영 원칙(가점 · 성공 약속 · 기본 컨디션 괄호) · 사실 목록에 없는 숫자
  if (text) out.push(...principleLint(text), ...numberLint(text, input.facts ?? ''))
  if (PRIVATE.test(text)) add('private', 'warn', '매출 · 계약금액 · 수수료 숫자 — 고객 숫자라면 빼요')
  if (KNOCK.test(text)) add('knock', 'bad', '다른 컨설턴트 · 업체를 깎아내리는 말은 쓰지 않아요')
  const brackets = text.match(/\[[^\]\n]{1,40}\]/g) ?? []
  if (brackets.length) add('brackets', 'warn', `[대괄호] ${brackets.length}칸 남음 — 사실을 확인해 채우거나 빼기: ${brackets.slice(0, 3).join(' ')}`)
  const midEmoji = text.split('\n').some((l) => {
    const t = l.trim()
    const i = t.search(EMOJI)
    return i > 1
  })
  if (midEmoji) add('emoji', 'warn', '문장 중간 이모지 — 이모지 · 기호는 줄 맨 앞 표시(✅ · 1. · →)로만')
  const endLabel = ENDINGS.find((e) => e.key === ending)
  const tpl = input.template ? templateOf(input.template) : undefined
  // 그냥 끝은 공유 · 공감 글(저장해 둬 · 단정)이면 괜찮다 — 답글을 노리는 글에서만 고칠 것(V 는 '광고 끝' 이 뼈대)
  const noneOk = ending === 'none' && !!tpl && (!tpl.goals.includes('reply') || tpl.key === 'V')
  if (text)
    add(
      'ending',
      endLabel?.good || noneOk ? 'ok' : ending === 'link' ? 'bad' : 'warn',
      endLabel?.good ? `끝: ${endLabel.label}` : noneOk ? '끝: 그냥 끝 · 단정(이 틀은 괜찮아요)' : ending === 'open' ? '끝이 열린 질문 — 고르기 쉬운 질문(A/B/C · 몇 년 차)이나 자료 나눔으로 바꾸면 더 퍼져요' : ending === 'link' ? '끝이 링크 · 상담 안내 — 본인 댓글로 옮기기' : '끝에 대답하기 쉬운 것 하나(고르기 쉬운 질문 · 쓸 사람? · 자료 나눔 · 후속편)를 붙이면 답글이 붙어요',
    )
  add('tag', input.tag ? 'ok' : 'warn', input.tag ? `주제 태그: ${input.tag}` : '주제 태그 1개를 고르세요(정책자금 · 벤처기업확인 · 정부지원사업 · AX · 경영컨설팅)')
  if (input.selfComment && LINK.test(input.selfComment)) add('comment', 'ok', '링크는 본인 댓글에 — 조회 1,000 넘은 글에만 달기')

  const others = (input.recent ?? []).filter((p) => p.id !== input.id)
  if (input.template === 'V') {
    const month = today.slice(0, 7)
    const v = others.find((p) => p.template === 'V' && (p.postedOn || p.savedAt.slice(0, 10)).slice(0, 7) === month)
    if (v) add('v-month', 'bad', `대놓고 영업(V)은 한 달에 한 번 — 이번 달 이미 ${(v.postedOn || v.savedAt.slice(0, 10)).slice(5).replace('-', '/')} 에 썼어요`)
  }
  if (input.template) {
    const last2 = others.filter((p) => p.status === 'posted').slice(0, 2)
    if (last2.length === 2 && last2.every((p) => p.template === input.template)) add('repeat', 'warn', `최근 두 글도 ${input.template} 틀 — 같은 틀을 매일 똑같이 반복하면 반응이 줄어요`)
  }
  return { lines: out, chars, firstLine: first, ending, bad: out.filter((l) => l.level === 'bad').length, warn: out.filter((l) => l.level === 'warn').length }
}

/* ------------------------------------------------------------------ */
/* 초안 · AI 부르기                                                      */
/* ------------------------------------------------------------------ */

/** 틀대로 빈 글 — 뼈대 줄을 [대괄호] 칸으로(규칙 초안 · AI 아님) */
export function skeletonDraft(t: ThreadTemplate, topic = ''): string {
  const lines = t.skeleton.map((s) => (s.startsWith('[') ? s : `[${s}]`))
  if (topic.trim()) lines[0] = `${lines[0]} ← ${topic.trim()}`
  return lines.join('\n\n')
}

export interface ThreadDraft {
  firstLine: string
  template: ThreadTemplateKey | ''
  body: string
  ending: string
  selfComment: string
  checks: string[]
}

/** threads.write 답 → 글 3개(본문이 빈 것은 버림) */
export function parseThreadDrafts(a: AssistAnswer | null): { drafts: ThreadDraft[]; tag: string } {
  if (!a) return { drafts: [], tag: '' }
  const drafts = a.items
    .map((it) => {
      const t = /[A-X]/.exec(String(it.tag ?? '').toUpperCase())?.[0] ?? ''
      const body = String(it.body ?? '').replace(/\r\n?/g, '\n').trim()
      return {
        firstLine: String(it.title ?? '').trim() || firstLineOf(body),
        template: (TEMPLATE_KEYS.has(t) ? t : '') as ThreadTemplateKey | '',
        body,
        ending: String(it.when ?? '').trim(),
        selfComment: String(it.detail ?? '').trim(),
        checks: (it.outline ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 8),
      }
    })
    .filter((d) => d.body)
    .slice(0, 3)
  const tag = (a.next ?? []).map((n) => TOPIC_TAGS.find((t) => String(n).includes(t)) ?? '').find(Boolean) ?? ''
  return { drafts, tag }
}

/** threads.write 에 보낼 자료 — 고른 목표 · 틀 · 소재 · 더 쓸 사실 · 참고 글(뼈대만 · 저장 안 함) · 최근 올린 글의 틀 */
export function threadsContext(input: { goal: ThreadGoal | ''; template: ThreadTemplateKey | ''; topic: string; tag: string; facts: string; reference: string; recent: readonly ThreadPost[]; today?: string }): AssistContext {
  const today = input.today ?? todayLocalDate()
  const t = input.template ? templateOf(input.template) : undefined
  const goal = GOALS.find((g) => g.key === input.goal)
  const plan = todayPlan(today)
  const sections: AssistContext['sections'] = [
    {
      name: '쓸 글',
      rows: [
        {
          목표: goal ? `${goal.label} — ${goal.hint}` : '(고르지 않음 — 소재에 맞게)',
          고른틀: t ? `${t.key} ${t.name} — 뼈대: ${t.skeleton.join(' → ')}` : '(고르지 않음 — 목표에 맞는 틀 셋)',
          목표에맞는틀: goal ? goal.picks.join(' · ') : '',
          소재: input.topic.trim() || '(비어 있음 — 우리 분야 우선 주제에서)',
          주제태그: input.tag || '',
          오늘요일계획: plan ? `${plan.day}요일 ${plan.label} — ${plan.picks.join(' · ')}` : '주말',
        },
      ],
    },
  ]
  const ref = input.reference.trim()
  if (ref) sections.push({ name: '참고 글(뼈대만 · 문장 쓰지 않기)', rows: ref.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 30).map((l) => ({ 줄: l.slice(0, 200) })) })
  const recent = input.recent.filter((p) => p.status === 'posted').slice(0, 7)
  sections.push({ name: '최근 올린 글', rows: recent.map((p) => ({ 날짜: p.postedOn, 틀: p.template, 첫줄: firstLineOf(p.body).slice(0, 60) })) })
  const facts = input.facts.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 12)
  return {
    title: '스레드 글 쓰기',
    today,
    purpose: '김팀장(미래AI랩) 스레드 계정에 올릴 글 — 실측 공식대로 500자 안 · 본문에서 팔지 않기',
    sections,
    ...(facts.length ? { facts: facts.map((f) => `이번 글에 더 쓸 사실: ${f}`) } : {}),
  }
}
