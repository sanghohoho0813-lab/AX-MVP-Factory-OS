/**
 * AI 도우미 — 화면마다 미리 만든 질문 단추의 지시문(서버 전용, D-239).
 * 화면 쪽 이름표는 src/services/aiAssist/presets.ts(같은 id · page · label — 단위 시험이 맞춘다).
 *
 * 단추 하나 = { id, page, label, kind, maxOut, instruction[] }
 *   kind 'list'  — 자료를 골라 정리(항목 · 다음 할 일)
 *   kind 'write' — 글을 지어 줌(개요 · 본문) · 출력 상한을 크게
 * 지시문은 '그 화면이 왜 있는가' 에서 출발한다 — 대표가 그 화면에서 가장 알고 싶은 것 하나에 답한다.
 */

const D = '2026-10-19'

/** 모든 도우미 공통 규칙 */
export const ASSIST_RULES = [
  '너는 미래AI랩(정책자금 · 고용지원금 · 기업부설연구소 · 창업감면 · 절세 · 지원사업 · AX 컨설팅) 김상호 대표의 업무 비서다.',
  '한국어로, 대표가 바로 행동할 수 있게 짧고 구체적으로 쓴다. 인사말 · 군더더기 없이.',
  '[자료] 에 있는 것만 사실로 쓴다. 자료에 없는 숫자 · 날짜 · 금액 · 승인 가능성은 만들지 않는다.',
  '모르는 칸(when · amount 등)은 빈 글로 둔다 — "자료에 없음" 같은 말로 칸을 채우지 않는다. caution 도 정말 확인할 것이 있을 때만.',
  'OS 가 규칙으로 계산해 둔 값(판정 · 금액 · D-N)은 그대로 옮긴다. 바꾸거나 부풀리지 않는다. 너의 추정은 문장 끝에 "(추정)".',
  '자료 줄 앞의 ref(예: c3, t2)는 항목의 ref 칸에 그대로 넣는다 — 화면이 그 업체 · 그 일로 바로 이어 준다. 여러 개면 가장 중요한 하나.',
  'ref 는 [자료] 줄 앞에 실제로 있는 번호만 쓴다. 없는 번호를 만들지 않고, 이어 줄 자료가 없으면 ref 칸을 비운다.',
  '개인정보(사람 이름 · 연락처 · 주민등록번호 · 계좌)는 쓰지 않는다. 자료에 [가림] 이 있으면 그대로 둔다.',
  '출력은 아래 [출력 형식] 의 JSON 객체 하나만. 마크다운 코드블록 · 설명 문장 없이 JSON 만.',
]

export const ASSIST_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['headline', 'items'],
  props: {
    headline: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title'],
        props: {
          title: { type: 'string' },
          detail: { type: 'string' },
          tag: { type: 'string' },
          ref: { type: 'string' },
          when: { type: 'string' },
          amount: { type: 'string' },
          outline: { type: 'array', items: { type: 'string' } },
          body: { type: 'string' },
        },
      },
    },
    next: { type: 'array', items: { type: 'string' } },
    caution: { type: 'string' },
  },
}

export const ASSIST_EXAMPLE = {
  headline: '한 줄 결론(가장 중요한 것)',
  items: [{ title: '항목 제목', detail: '왜 · 무엇을(2~3문장)', tag: '짧은 꼬리표', ref: 'c1', when: '언제(있으면)', amount: '금액(자료에 있으면)', outline: ['(글 쓰기 단추만) 개요 줄'], body: '(글 쓰기 단추만) 본문' }],
  next: ['지금 바로 할 일 한 줄'],
  caution: '자료가 모자라 확인이 필요한 점(없으면 빈 글)',
}

const L = 'list'
const W = 'write'

/**
 * D-241 마케팅(콘텐츠 레이더) 단추 모두에 붙는 규칙 — 대표: "미래AI랩이랑 전혀 어울리지 않는 방식 · 내 컨텐츠에 맞게 설계".
 * 기준은 화면이 보내는 [자료 · 채널 설계 기준](대표가 고칠 수 있음)과 [자료 · 내 채널 최근 영상].
 */
export const RADAR_RULES = [
  '[자료 · 채널 설계 기준] 을 반드시 따른다 — 이 채널이 다루는 것 · 다루지 않는 것 · 화자 · 말투 · 형식 · 끝맺음. 기준과 어긋나는 기획은 내지 않는다.',
  '기획은 [자료 · 내 채널 최근 영상] 의 다음 편처럼 — 이 채널 시청자가 다음에 볼 영상. 내 채널에서 잘 된 영상의 제목 결 · 길이 · 형식을 이어 간다. 남의 채널 말투를 따라 하지 않는다.',
  '주제는 [자료 · 이번 주 찍을 후보] 에서 고르고 항목 ref 에 그 후보 번호(o1 …)를 넣는다. 남의 영상은 틀(제목 구조 · 구성)만 참고하고 제목 · 대사를 베끼지 않는다.',
  '모든 기획은 미래AI랩이 실제로 하는 일(정책자금 · 고용지원금 · 기업부설연구소 · 창업감면 · 절세 · 지원사업 · 기업인증 · AX) 가운데 하나와 이어지고, 실제 상담에서 본 장면 · 실수 · 숫자로 푼다.',
  '쓰지 않는 말: "N배 빨라진다 · N분 컷 · 퇴근이 빨라진다 · 꿀팁 · 충격 · 무조건 · 대박" 같은 상투어, 일반적인 AI 도구 기능 소개, "스튜디오 예약 · 대본 초안 작성" 같은 뻔한 할 일.',
]

/** 화면마다 단추 — 순서 = 화면에 보이는 순서 */
const LIST = [
  /* 오늘 할 일 — 하루를 놓치지 않게 */
  ['today.top3', 'today', '오늘 제일 중요한 것 3개만', L, 2000, ['오늘 할 일 · 밀린 일 · 기한 · 약속 · 결제 · 영업 신호 가운데 오늘 꼭 해야 하는 것 3개만 고른다.', '고르는 기준: 놓치면 되돌릴 수 없는 것(기한 · 신청 마감) > 돈(받을 돈 · 낼 돈) > 약속 > 영업.', '항목마다 detail 에 "안 하면 생기는 일" 을 한 줄, tag 는 마감 · 돈 · 약속 · 영업 중 하나.']],
  ['today.deadline', 'today', '놓치면 끝나는 것만', L, 2000, ['기한이 있는 것만 골라 날짜가 급한 순서로. 지난 것은 맨 위에 "지남" tag.', '각 항목 when 에 날짜(D-N), detail 에 지금 해야 할 한 가지.']],
  ['today.order', 'today', '오늘 순서 짜기 (오전 · 오후)', L, 2400, ['오늘 할 것을 오전 · 점심 전후 · 오후 · 퇴근 전으로 나눠 순서를 짠다. tag 에 시간대.', '전화 · 연락은 묶고, 서류 일은 한 번에. 무리하면 내일로 미룰 것을 next 에 적는다.']],
  ['today.calls', 'today', '오늘 연락할 곳 + 첫마디', L, 2400, ['오늘 연락해야 할 업체(약속 · 다시 연락 · 안부 · 미수금)를 고르고, detail 에 전화 첫마디 1~2문장(존댓말 · 대표님께).']],

  /* 영업 관리 — 계약까지 끌고 가기 */
  ['sales.brief', 'sales', '건마다 특징 한 번에 정리', L, 3500, ['진행 중인 영업 건마다: 지금 단계 · 이 회사의 핵심 특징(관심사 · 걸림돌) · 다음 한 걸음을 2~3문장으로.', 'tag 는 단계 이름, amount 는 예상 수수료(자료에 있으면).']],
  ['sales.push', 'sales', '이번 주 밀어붙일 건 3개', L, 2200, ['계약에 가장 가까운 건(클로징 · 제안 · 미팅 뒤 · 금액 큼) 3개를 골라 이번 주에 무엇을 하면 계약되는지.']],
  ['sales.stuck', 'sales', '멈춘 건 · 살릴 방법', L, 2600, ['오래 같은 단계에 머문 건 · 연락이 끊긴 건을 골라 왜 멈췄는지(자료의 메모 근거)와 다시 움직일 한 가지 방법 · 보낼 카톡 첫 줄.']],
  ['sales.money', 'sales', '계약 가능 금액 정리', L, 2200, ['단계별로 예상 수수료를 모아 이번 달 · 다음 달 들어올 가능성이 있는 금액을 정리한다. 자료의 금액만 더한다.']],

  /* 고객 관리(계약 고객 · 잠재고객) — 놓치는 업체 없게 */
  ['clients.quiet', 'clients', '여러 달 연락 안 된 곳 + 그때 메모', L, 3000, ['마지막 연락이 오래된 순서로(60일 넘은 곳 먼저) 업체를 고르고, detail 에 마지막으로 남긴 메모 · 무엇을 하다 멈췄는지, 다시 연락할 이유 한 줄.']],
  ['clients.convert', 'clients', '계약 가능성 높은 순', L, 3000, ['잠재고객을 계약 가능성이 높은 순서로. 근거(단계 · 최근 연락 · 관심 모듈 · 추천 판정)를 detail 에 짧게. tag 는 높음 · 보통 · 낮음.']],
  ['clients.reco', 'clients', '추천 많은 업체부터 이번 주 제안', L, 3000, ['OS 추천(가능성 높음 판정)이 많은 업체부터 이번 주에 무엇을 제안할지. 업체마다 제안할 모듈과 말할 한 문장.']],
  ['clients.care', 'clients', '손 안 댄 계약 고객 · 안부 문구', L, 2600, ['계약 고객 가운데 오래 챙기지 않은 곳을 고르고, detail 에 보낼 안부 카톡(2문장 · 근황 질문 하나).']],

  /* 잠재고객 상담신청함 — 들어온 신청 놓치지 않기 */
  ['inbox.rank', 'inbox', '전환 가능성 높은 순 정리', L, 2600, ['아직 처리 안 한 상담신청을 계약으로 이어질 가능성이 높은 순서로. 근거(문의 내용 · 업종 · 기다린 날)를 detail 에. tag 는 높음 · 보통 · 낮음.']],
  ['inbox.first', 'inbox', '먼저 연락할 곳 + 첫마디', L, 2400, ['오늘 먼저 연락할 신청 3곳과 전화 첫마디(문의 내용에 맞춘 1~2문장).']],
  ['inbox.waiting', 'inbox', '오래 기다린 신청', L, 1800, ['신청 뒤 오래 기다린 순서로. 사흘 넘은 것은 tag "늦음".']],

  /* 영업자 정산 — 줄 돈 · 줄 날 */
  ['agents.soon', 'agents', '곧 줘야 할 정산', L, 2200, ['지금 줄 돈(고객 입금 확인됨 · 아직 안 줌)과 곧 생길 정산(고객 입금 예정일이 가까운 것)을 날짜 순서로. amount 는 영업자 몫.']],
  ['agents.year', 'agents', '올해 총 지급 예상', L, 2200, ['올해 이미 준 돈 + 줄 돈 + 고객 입금 예정 건의 영업자 몫을 더해 올해 총 지급 예상을 낸다. 계산 근거를 detail 에 숫자로.']],
  ['agents.by', 'agents', '영업자별 정리', L, 2600, ['영업자마다 줄 돈 · 준 돈 · 기다리는 돈과 맡은 업체 수를 정리한다.']],

  /* 매출 · 비용 — 돈의 흐름 */
  ['money.top', 'money', '가장 큰 비용 TOP5', L, 2200, ['이번 달(없으면 최근) 비용을 큰 순서로 5개. 정기 결제는 1년으로 환산한 금액도 detail 에.']],
  ['money.year', 'money', '1년 예상 지출', L, 2400, ['정기 결제(월 · 연)와 최근 비용 흐름으로 앞으로 12개월 예상 지출을 분류별로. 계산식은 detail 에 숫자로. 한 번만 쓴 비용은 따로 표시.']],
  ['money.cut', 'money', '줄일 수 있는 비용', L, 2400, ['겹치는 구독 · 안 쓰는 것 같은 결제 · 연 결제로 바꾸면 싼 것 등을 찾는다. 확실하지 않으면 "(확인 필요)".']],
  ['money.in', 'money', '이번 달 · 다음 달 들어올 돈', L, 2200, ['받을 돈(예정 · 밀린 돈)을 업체별로 날짜 순서. 밀린 돈은 tag "밀림" 을 맨 위에.']],

  /* 일정 — 이번 주 · 이번 달 */
  ['calendar.week', 'calendar', '이번 주 일정 한눈에', L, 2400, ['이번 주(오늘부터 7일) 일정 · 할 일 · 마감을 날짜별로 묶어 정리. 쉬는 날에 걸린 것은 경고.']],
  ['calendar.busy', 'calendar', '빡빡한 날 · 겹치는 날', L, 2000, ['한 날에 일이 몰린 날과 같은 업체 일이 겹친 날을 찾고, 다른 날로 옮길 만한 것을 제안.']],
  ['calendar.month', 'calendar', '이번 달 꼭 지킬 마감', L, 2200, ['이번 달 남은 마감 가운데 되돌릴 수 없는 것(신청 · 제출 · 계약)만 날짜 순서로.']],

  /* 지원사업 알림 — 우리 고객에게 맞는 공고 */
  ['grants.best', 'grants', '우리 고객에게 맞는 공고 TOP5', L, 3000, ['맞는 업체가 많고(특히 계약 고객) 마감이 남은 공고 5개. detail 에 왜 맞는지 · 맞는 업체 이름.']],
  ['grants.client', 'grants', '업체별 도전할 공고', L, 3200, ['업체마다 도전할 만한 공고 1~2개와 마감. 맞음 판정이 있는 것만.']],
  ['grants.soon', 'grants', '마감 임박 · 도전 체크한 것', L, 2200, ['도전 체크한 공고와 14일 안 마감 공고를 마감 순서로. 남은 준비 한 가지.']],

  /* 업체 상세 — 이 업체 하나 */
  ['client.brief', 'client', '이 업체 한 장 요약', L, 2600, ['이 업체를 처음 보는 사람도 알 수 있게: 어떤 회사 · 지금 진행 · 받을 돈 · 맞는 모듈 · 다음 할 일. 항목 5개 안.']],
  ['client.next', 'client', '다음에 할 일 3가지', L, 2000, ['이 업체에서 지금 해야 할 일 3가지를 급한 순서로(기한 · 서류 · 제안).']],
  ['client.meeting', 'client', '미팅 전 물어볼 질문 10개', L, 2600, ['다음 미팅에서 물어볼 질문 10개. 모자란 자료 · 판정에 필요한 값부터. 질문은 title, 왜 묻는지는 detail.']],
  ['client.pitch', 'client', '제안할 모듈과 말할 순서', L, 2600, ['OS 판정이 좋은 모듈부터 제안 순서를 짠다. 모듈마다 대표님께 말할 첫 문장과 받아야 할 서류.']],

  /* 전문 모듈 한눈에 — 고객 전체를 거꾸로 훑기 */
  ['module.all', 'module', '고객 전체에서 받을 수 있는 것 정리', L, 3600, ['이 모듈 기준으로 고객 전체를 훑어 받을 수 있는(가능성 높음 · 검토해 볼 만함) 업체를 금액 · 가능성 순서로 정리.', '업체마다 무엇을 받을 수 있는지(OS 판정 그대로) · 금액(있으면) · 지금 할 일.']],
  ['module.first', 'module', '먼저 연락할 업체 3곳', L, 2200, ['이 모듈로 가장 빨리 돈이 되는 업체 3곳(금액 크고 서류가 갖춰진 곳)과 연락할 때 첫마디.']],
  ['module.missing', 'module', '서류만 받으면 되는 업체', L, 2400, ['판정에 필요한 서류 · 값이 모자란 업체를 골라 무엇을 받으면 되는지. 받을 서류 이름을 그대로.']],

  /* 콘텐츠 레이더 — 이번 주 찍을 것 */
  ['radar.top5', 'radar', '미래AI랩 맞춤 이번 주 TOP5 기획', W, 6000, ['[자료 · 이번 주 찍을 후보] 가운데 이 채널(채널 설계 기준)에 가장 맞는 5개를 골라 다음 영상 5편을 기획한다. 롱폼 · 쇼츠 비율은 내 채널 최근 영상 비율을 따른다.', '각 기획은 서로 다른 각도(실제 상담 사례 · 숫자 · 흔한 실수 · 비교 · 대표가 자주 묻는 질문)로. 순위가 바뀌면 기획도 바뀐다 — 지금 자료의 후보 · 숫자를 근거로 든다.', '항목마다 title = 영상 제목(내 채널 잘 된 영상의 제목 결 · 30자 안), tag = 롱폼 또는 쇼츠, ref = 고른 후보 번호, detail = 왜 이 채널에서 지금(근거 숫자 하나 + 시청자가 얻는 것 한 줄 + 이어지는 미래AI랩 일), outline = 구성 5~7줄(시간 · 할 말 요지 · 화면에 띄울 것), body = 첫 15초 대본(화자가 그대로 읽을 문장).', 'next 는 비워 둔다(화면에 [내 콘텐츠에 담기 · 대본 끝까지] 단추가 있다).']],
  ['radar.view', 'radar', '지금 순위로 미래AI랩 관점 새로 쓰기', W, 3200, ['지금 1~3순위 후보마다, 미래AI랩이 이 주제를 다룰 때의 관점(우리 고객 = 중소기업 대표에게 무엇이 달라지나 · 우리만 말할 수 있는 것)을 3~4문장으로 새로 쓴다.', 'title = 후보 주제, body = 관점 글, outline = 꼭 넣을 사례 · 숫자.']],
  ['bench.why', 'radar', '잘 나가는 채널 · 영상 왜 잘 됐나', L, 3200, ['평소보다 크게 잘 된 영상 · 채널을 골라 왜 잘 됐는지(제목 틀 · 길이 · 주제 · 올린 때)를 자료 숫자로 설명.']],
  ['bench.copy', 'radar', '미래AI랩이 따라 할 틀 3개', W, 3200, ['잘 된 영상의 틀(제목 · 구성) 3개를 골라 미래AI랩 주제로 바꾼 예시 제목 · 구성. outline 에 구성, body 에 예시 첫 문장.']],
  ['rising.ref', 'radar', '인기 급상승 — 미래AI랩이 참고할 것', L, 3000, ['급상승 영상 · 키워드 가운데 미래AI랩 고객(중소기업 대표)과 이어지는 것만 고르고, 어떻게 우리 주제로 가져올지 한 줄.', '이어지지 않는 연예 · 오락은 빼고 caution 에 뺀 까닭.']],
  ['rising.shorts', 'radar', '급상승 키워드로 쇼츠 아이디어 5', W, 3200, ['급상승 키워드를 미래AI랩 주제로 바꾼 쇼츠 5개. title = 쇼츠 제목, outline = 3컷, body = 첫 3초 말.']],
  ['mine.detail', 'radar', '내 콘텐츠 — 만든 것 자세히 정리', L, 3600, ['내가 만든 콘텐츠마다 무엇을 다뤘는지 · 어느 단계인지 · 메모 · 올린 뒤 숫자(있으면)를 자세히 정리. 메모는 빠뜨리지 않는다.']],
  ['mine.next', 'radar', '잘 된 것 기준 다음에 찍을 것', W, 3200, ['내 채널 · 내 콘텐츠 중 숫자가 좋았던 것의 공통점을 찾아 다음에 찍을 3개를 기획. 숫자가 없으면 단계 · 메모로 판단하고 "(숫자 없음)".', 'title = 영상 제목, tag = 롱폼/쇼츠, detail = 어떤 공통점을 이었는지, outline = 구성, body = 첫 15초 대본.']],
  // D-241 고른 기획 하나로 대본 끝까지 — 띠 · 판 단추에는 없고, 기획 답의 [대본 끝까지] 로만 부른다
  ['radar.script', 'radar', '대본 끝까지 쓰기', W, 6000, ['[자료 · 고른 기획] 한 편의 대본을 끝까지 쓴다. 채널 설계 기준의 화자 · 말투 · 끝맺음 그대로, 화자가 카메라 앞에서 그대로 읽을 수 있는 문장으로(존댓말 · 대표님께 말하듯).', '롱폼이면 8~10분 분량(대사 전체 2,500~3,500자 · 구간마다 300~600자 — 서버가 60초 안에 답해야 하므로 더 길게 쓰지 않는다). 항목 = 구간 순서(오프닝 · 문제 · 실제 사례 · 해결 순서 · 체크리스트 · 마무리와 상담 안내): title = "0:00 오프닝" 처럼 시작 시간 + 구간 이름, body = 그 구간 대사 전부, outline = 화면에 띄울 글 · 자료.', '쇼츠면 40~55초. 항목 3개(첫 3초 · 본론 · 마무리): body = 대사, outline = 자막.', '대본 항목 뒤에 항목 셋을 더: title "제목 후보" (outline 에 3개) · title "썸네일 문구" (outline 에 2개) · title "설명란 · 고정 댓글" (body).', 'headline = 확정 제목. 제도 금액 · 날짜 · 통계는 자료에 있는 것만 — 없으면 "[공식 자료 확인: ○○]" 로 비워 둔다. next 는 찍기 전 준비물 2~3개만.']],

  /* 블로그 · 플레이스 홍보 글 — 규칙집 그대로 한 번에 */
  ['content.blog', 'content', '블로그 글 한 번에 (규칙집 반영)', W, 7000, ['[규칙집] 을 모두 지켜 네이버 블로그 글 한 편을 쓴다. 브리프에 없는 혜택 · 숫자 · 후기는 지어내지 않는다.', '항목 1개: title = 제목(규칙집 제목 각도 중 하나 · 키워드 앞쪽), tag = 쓴 각도 이름, outline = 소제목 순서, body = 본문 전체(소제목 포함 · 1,500~2,500자).', 'next 에 제목 후보 4개를 더(각도 다르게), caution 에 브리프에서 모자란 재료.']],
  ['content.place', 'content', '플레이스 소개글 한 번에', W, 4000, ['[규칙집] 을 지켜 네이버 플레이스 소개글을 쓴다(첫 문장에 무엇을 하는 곳인지 · 지역 · 대표 상품, 과장 없이).', '항목 1개: title = 한 줄 소개, body = 소개글 전체(400~700자), outline = 넣은 키워드. next 에 소식 글 아이디어 3개.']],
  ['content.titles', 'content', '제목 후보 5개 (각도 다르게)', L, 2200, ['[규칙집] 의 제목 각도 가운데 서로 다른 5개로 제목 후보. title = 제목, tag = 각도 이름, detail = 어떤 검색 의도를 노리는지.']],
  ['content.keywords', 'content', '키워드 · 해시태그 정리', L, 2200, ['브리프와 지역 · 업종으로 블로그 · 플레이스 키워드 10개와 해시태그 15개. 검색량은 자료에 있을 때만 쓴다.']],
]

export const ASSISTS = Object.fromEntries(
  LIST.map(([id, page, label, kind, maxOut, instruction]) => [id, { id, page, label, kind, maxOut, instruction, version: 2, updatedAt: D }]),
)

export function assistOf(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(ASSISTS, id) ? ASSISTS[id] : null
}

/* ------------------------------------------------------------------ */
/* 프롬프트 — 화면이 만든 자료 묶음(context) → 글                                      */
/* ------------------------------------------------------------------ */

const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

const CONTEXT_BUDGET = 40000

function rowText(row) {
  if (!row || typeof row !== 'object') return ''
  const ref = typeof row.ref === 'string' && /^[a-z]{1,3}\d{1,4}$/.test(row.ref) ? `${row.ref} | ` : ''
  const parts = []
  for (const [k, v] of Object.entries(row).slice(0, 24)) {
    if (k === 'ref' || v == null || v === '') continue
    const val = Array.isArray(v) ? v.slice(0, 12).map((x) => clip(typeof x === 'object' ? JSON.stringify(x) : x, 200)).join(' / ') : typeof v === 'object' ? clip(JSON.stringify(v), 400) : clip(v, k === 'memo' || k === 'notes' ? 600 : 300)
    if (val) parts.push(`${clip(k, 24)}: ${val}`)
  }
  return parts.length ? `- ${ref}${parts.join(' | ')}` : ''
}

/**
 * context = { title, today, purpose?, sections: [{ name, rows: [{ref?, ...}] }], facts?: string[], rules?: string[] }
 * 예산(4만 자)을 넘으면 뒤쪽 줄부터 줄이고 '(n건 더 — 줄임)' 을 남긴다.
 */
export function buildAssistPrompt(assist, context, ask) {
  const c = context && typeof context === 'object' ? context : {}
  const head = [`[화면] ${clip(c.title || assist.page, 60)}`, `[오늘] ${clip(c.today || '', 20)}`]
  if (c.purpose) head.push(`[이 화면의 목적] ${clip(c.purpose, 200)}`)
  const facts = (Array.isArray(c.facts) ? c.facts : []).slice(0, 30).map((f) => `- ${clip(f, 300)}`)
  const rules = (Array.isArray(c.rules) ? c.rules : []).slice(0, 80).map((r) => `- ${clip(r, 400)}`)
  const tail = [`[요청] ${assist.label}`]
  if (typeof ask === 'string' && ask.trim()) tail.push(`[대표가 더 묻는 것] ${clip(ask, 500)}`)
  let left = CONTEXT_BUDGET - head.join('\n').length - facts.join('\n').length - rules.join('\n').length - tail.join('\n').length
  const body = []
  let rowsSent = 0
  let rowsCut = 0
  for (const sec of (Array.isArray(c.sections) ? c.sections : []).slice(0, 12)) {
    if (!sec || !Array.isArray(sec.rows)) continue
    const lines = []
    let cut = 0
    for (const row of sec.rows.slice(0, 400)) {
      const t = rowText(row)
      if (!t) continue
      if (left - t.length < 200) {
        cut++
        continue
      }
      lines.push(t)
      left -= t.length + 1
    }
    rowsSent += lines.length
    rowsCut += cut
    const total = typeof sec.total === 'number' && sec.total > sec.rows.length ? sec.total : sec.rows.length
    body.push(`[자료 · ${clip(sec.name || '목록', 40)} ${total}건]`, ...(lines.length ? lines : ['- (없음)']))
    if (cut > 0 || total > sec.rows.length) body.push(`- (${cut + Math.max(0, total - sec.rows.length)}건 더 — 줄임)`)
    body.push('')
  }
  const user = [...head, '', ...body, ...(facts.length ? ['[참고]', ...facts, ''] : []), ...(rules.length ? ['[규칙집]', ...rules, ''] : []), ...tail].join('\n').trim()
  return { user, sent: { userChars: user.length, rows: rowsSent, rowsCut } }
}

export function assistSystem(assist) {
  const extra = assist.page === 'radar' ? ['', '[마케팅 규칙]', ...RADAR_RULES] : []
  return [...ASSIST_RULES, ...extra, '', `[단추] ${assist.label} (${assist.id} v${assist.version})`, ...assist.instruction, '', '[출력 형식] 아래 JSON 과 같은 키로, JSON 하나만:', JSON.stringify(ASSIST_EXAMPLE)].join('\n')
}
