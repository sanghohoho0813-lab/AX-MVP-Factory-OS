/**
 * 선택지 — 자유입력보다 고르는 쪽을 먼저 준다 (§11).
 *
 * 원칙: 억지 분류로 사실을 왜곡하지 않는다. 그래서 모든 목록의 끝에는 항상 '직접 입력' 이 있고,
 * 고른 값은 그대로 저장된다(코드값으로 바꾸지 않는다). 목록은 중소기업 AX 컨설팅에서
 * 실제로 반복해서 나오는 것만 담았다.
 */

export interface Choice {
  /** 저장될 값 그대로 */
  value: string
  /** 한 줄 설명 (없으면 생략) */
  hint?: string
}

/** S2 — 이 회사에서 가장 먼저 해결할 현장문제 */
export const CORE_PROBLEM_CHOICES: Choice[] = [
  { value: '같은 정보를 여러 곳에 반복해서 입력한다', hint: '수기·엑셀·카톡에 같은 내용을 다시 적는다' },
  { value: '견적·발주 정보가 여러 채널에 흩어져 있다', hint: '전화·카톡·메일로 와서 한곳에 모이지 않는다' },
  { value: '거래처·고객 요청에 대한 응답이 늦어진다', hint: '누가 언제 답할지가 정해져 있지 않다' },
  { value: '납기·일정 지연을 뒤늦게 알게 된다', hint: '문제가 생긴 뒤에야 확인된다' },
  { value: '현장 작업·점검 보고가 누락된다', hint: '보고가 사람에 따라 들쭉날쭉하다' },
  { value: '재고·수요를 감으로 판단한다', hint: '기록이 있어도 판단에 쓰이지 않는다' },
]

/** S2 — 지금은 그 일을 어떻게 처리하고 있는가 */
export const CURRENT_METHOD_CHOICES: Choice[] = [
  { value: '엑셀에 직접 적고 담당자가 눈으로 확인한다' },
  { value: '카카오톡·전화로 주고받고 따로 정리하지 않는다' },
  { value: '수기 장부·종이 서류로 관리한다' },
  { value: '기존 프로그램(ERP·POS 등)이 있지만 이 업무는 밖에서 처리한다' },
  { value: '담당자 한 사람의 경험에 의존한다' },
]

/** S1 — 벤처인증 진행 판단. 내부적으로 go / hold / no_go 로 저장된다 */
export const GATE_CHOICES: { value: 'go' | 'hold' | 'no_go'; label: string; hint: string }[] = [
  { value: 'go', label: '진행할 수 있습니다', hint: '현장문제와 고객이 뚜렷하고, 대표가 직접 설명할 수 있다' },
  { value: 'hold', label: '보강한 뒤에 진행합니다', hint: '사업은 되는데 핵심기술·타깃·숫자 중 약한 곳이 있다 (탈락이 아니다)' },
  { value: 'no_go', label: '지금은 어렵습니다', hint: '문제와 기술이 이어지지 않거나, 사실과 다르게 써야만 이야기가 된다' },
]

/** S8 — AX 기능을 무엇으로 구현하나. AI 라고 부를 수 있는지의 근거가 된다 */
export const AX_MODE_CHOICES: { value: 'rule' | 'scoring' | 'optimization' | 'ml' | 'rag' | 'llm' | 'demo'; label: string; hint: string }[] = [
  { value: 'scoring', label: '조건마다 점수를 매겨 우선순위를 낸다', hint: '가장 흔하다. AI 라고 부르지 않는다' },
  { value: 'rule', label: '정해진 조건으로 자동 판단한다', hint: 'AI 라고 부르지 않는다' },
  { value: 'optimization', label: '일정·배치를 최적으로 짜 준다', hint: 'AI 라고 부르지 않는다' },
  { value: 'ml', label: '데이터를 학습해 예측한다', hint: '실제 모델이 돌 때만 고른다' },
  { value: 'rag', label: '문서를 찾아 근거와 함께 답한다', hint: '실제 검색·생성이 돌 때만' },
  { value: 'llm', label: '자연어로 설명·생성·상담한다', hint: '실제 LLM 이 붙을 때만' },
  { value: 'demo', label: '아직은 시연용 로직이다', hint: '실적처럼 보이게 하지 않는다' },
]

/** S8 — Platform Surface 를 누가 쓰나 */
export const PLATFORM_USER_CHOICES: Choice[] = [
  { value: '거래처 담당자 (발주·납기 조회)' },
  { value: '일반 고객 (예약·주문·조회)' },
  { value: '현장 직원 (작업보고·점검)' },
  { value: '가맹점·지점 담당자' },
  { value: '협력업체 (자료 제출)' },
]
