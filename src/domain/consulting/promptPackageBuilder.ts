/**
 * 프롬프트 꾸러미 — 사람이 들고 나가는 것 (MANUAL LLM HANDOFF).
 *
 * 이 파일은 외부 AI 를 부르지 않는다. 프로젝트 상태에서 텍스트를 결정론적으로 만든다:
 *   역할 → 현재 단계 → 회사 사실(상태 표시) → 핵심 줄기 → 단계별 규칙 발췌 → 출력 형식.
 * Master 5,874줄을 통째로 넣지 않는다. 종류마다 필요한 규칙 20~40줄만 싣는다 (SCOPED ACTIVATION, K3·K5).
 * 결과 첫 줄에 `[ARTIFACT] type=… stage=… title="…"` 를 요구해 되돌아올 때 종류를 알아본다.
 *
 * 개인정보 필터는 마지막에 본문·맥락 둘 다에 건다. 필터 전 텍스트는 밖으로 나가지 않는다.
 */

import type {
  ConsultingArtifact,
  ConsultingEvidence,
  ConsultingProject,
  FactKey,
  PrivacyReport,
  PromptPackageType,
  PromptTarget,
  StageKey,
} from '../../types/consulting'
import { factsheetToText } from './factsheetSchema'
import { coreThreadToText } from './coreThread'
import { artifactHeaderLine } from './resultImport'
import { artifactTypeForPrompt } from './artifactDefinitions'
import { stageDef } from './workflowDefinition'
import { mergeReports, redactSensitive } from './privacyFilter'
import { EVIDENCE_SLOTS, FIELD_QUESTION_POOL, FORBIDDEN_PHRASES, PLAN_SECTIONS, RED_FLAGS, SCRIPT_SKELETON } from './qaRules'
import { kipoByCode } from './kipoReferences'

export const PROMPT_TYPE_LABEL: Record<PromptPackageType, string> = {
  PATENT_IDEA: '특허 아이디어 설계',
  PRIOR_ART_REVIEW: '선행기술 검토',
  PATENT_SPEC_DRAFT: '명세서 초안',
  PATENT_CLAIMS_REVIEW: '청구항 검토',
  MVP_STRATEGY: 'MVP 전략 잠금',
  MVP_CLAUDE_CODE_BUILD: 'MVP 빌드 (Claude Code)',
  VENTURE_PLAN_SECTION: '사업계획서 항목',
  VENTURE_FULL_REVIEW: '사업계획서 전체 검토',
  EVIDENCE_REVIEW: 'Claim–Evidence 검토',
  INFOGRAPHIC_BRIEF: '인포그래픽 기획',
  FIELD_REVIEW_SCRIPT: '실사 3분 Script',
  FIELD_REVIEW_QA: '실사 예상 Q&A',
  GENERAL_PROJECT_REVIEW: '프로젝트 전체 검토',
}

export const PROMPT_TYPES: PromptPackageType[] = Object.keys(PROMPT_TYPE_LABEL) as PromptPackageType[]

export const PROMPT_TARGET_LABEL: Record<PromptTarget, string> = {
  general: '일반',
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  claude_code: 'Claude Code',
}

/** 종류별 기본 단계 */
export const PROMPT_DEFAULT_STAGE: Record<PromptPackageType, StageKey> = {
  PATENT_IDEA: 'S3',
  PRIOR_ART_REVIEW: 'S4',
  PATENT_SPEC_DRAFT: 'S6',
  PATENT_CLAIMS_REVIEW: 'S6',
  MVP_STRATEGY: 'S8',
  MVP_CLAUDE_CODE_BUILD: 'S9',
  VENTURE_PLAN_SECTION: 'S11',
  VENTURE_FULL_REVIEW: 'S11',
  EVIDENCE_REVIEW: 'S12',
  INFOGRAPHIC_BRIEF: 'S12',
  FIELD_REVIEW_SCRIPT: 'S15',
  FIELD_REVIEW_QA: 'S15',
  GENERAL_PROJECT_REVIEW: 'S0',
}

export interface BuildInput {
  project: ConsultingProject
  type: PromptPackageType
  target: PromptTarget
  /** 사업계획서 항목 1~7 (VENTURE_PLAN_SECTION 일 때) */
  section?: 1 | 2 | 3 | 4 | 5 | 6 | 7
  /** 인포그래픽 슬롯 (INFOGRAPHIC_BRIEF 일 때) */
  slot?: number
  /** 맥락으로 함께 붙일 최근 산출물 */
  artifacts?: ConsultingArtifact[]
  evidence?: ConsultingEvidence[]
}

export interface BuiltPackage {
  title: string
  stageKey: StageKey
  prompt: string
  context: string
  privacy: PrivacyReport
  section: number | null
}

/* ------------------------------------------------------------------ */
/* 공통 블록                                                            */
/* ------------------------------------------------------------------ */

const GLOBAL_RULES = [
  '사실 / LIVE / DEMO / FUTURE / 계획을 섞지 않는다. 모르는 값은 지어내지 말고 "확인 필요" 로 남긴다.',
  '특허·MVP·사업계획서·증빙·실사 답변은 같은 핵심기술(아래 핵심 줄기)을 설명해야 한다.',
  '등록되지 않은 특허는 "특허출원 중" 으로만 쓴다. 출원번호 ≠ 등록번호.',
  '실제 LLM/ML 이 아닌 규칙·점수·계산 로직을 "AI" 라고 부르지 않는다.',
  '근거 없는 숫자(고객수·매출·전환율·점유율)를 만들지 않는다. 시장 숫자에는 기준연도·출처·산식을 붙인다.',
  '대표자가 하지 않은 기술적 발명을 한 것처럼, 없는 자체 개발팀이 있는 것처럼 쓰지 않는다.',
]

function factsFor(project: ConsultingProject, keys?: FactKey[]): string {
  const text = factsheetToText(project.factsheet, keys ? { onlyKeys: keys } : {})
  return text === '' ? '(사실표가 비어 있습니다 — 알려진 것이 없으면 확인 필요로 표시하세요)' : text
}

function threadBlock(project: ConsultingProject): string {
  const t = coreThreadToText(project)
  return t === '' ? '(핵심 줄기가 아직 비어 있습니다)' : t
}

function header(project: ConsultingProject, type: PromptPackageType, stage: StageKey): string {
  const def = stageDef(stage)
  return [
    `# ${PROMPT_TYPE_LABEL[type]} — ${project.clientName}${project.title ? ` · ${project.title}` : ''}`,
    '',
    '당신은 미래AI랩의 특허·AX/플랫폼 MVP·벤처기업확인(혁신성장유형) 통합 컨설팅 워크플로를 돕는 전문가다.',
    `현재 단계: ${stage} ${def.code} (${def.label}) — 이 단계의 목적: ${def.purpose}`,
    '이 프롬프트는 사람이 복사해 넣은 것이고, 결과도 사람이 검토해 시스템에 붙여 넣는다.',
  ].join('\n')
}

function globalBlock(): string {
  return ['## 항상 지킬 것', ...GLOBAL_RULES.map((r) => `- ${r}`)].join('\n')
}

function outputBlock(type: PromptPackageType, stage: StageKey, title: string, sections: string[]): string {
  return [
    '## 출력 형식',
    `결과의 첫 줄은 정확히 다음 한 줄로 시작한다:`,
    artifactHeaderLine(artifactTypeForPrompt(type), stage, title),
    '그 아래는 마크다운으로, 다음 순서의 제목을 쓴다:',
    ...sections.map((s, i) => `${i + 1}. ${s}`),
    '마지막에 "## 확인 필요" 절을 두고, 지어내지 않고 남겨 둔 항목을 적는다.',
  ].join('\n')
}

function targetWrap(target: PromptTarget, prompt: string): string {
  switch (target) {
    case 'claude_code':
      return [
        '[이 프롬프트는 Claude Code 세션에 붙여 넣는다. 저장소를 바꾸기 전에 아래 지시를 먼저 읽는다.]',
        '',
        prompt,
        '',
        '작업 규칙: 실제 결제·SMS·복잡한 권한·Production 인프라를 자동으로 추가하지 않는다. 404·Dead CTA·Placeholder 0. 390/430 실측 후 보고한다.',
      ].join('\n')
    case 'chatgpt':
      return `${prompt}\n\n(답변은 한국어로, 표는 마크다운 표로.)`
    case 'claude':
      return `${prompt}\n\n(답변은 한국어로. 확실하지 않은 사실은 추측하지 말고 "확인 필요" 로 남겨라.)`
    default:
      return prompt
  }
}

/* ------------------------------------------------------------------ */
/* 종류별 규칙 발췌 (20~40줄)                                            */
/* ------------------------------------------------------------------ */

function bodyFor(input: BuildInput): { title: string; rules: string[]; task: string[]; sections: string[]; facts?: FactKey[] } {
  const p = input.project
  switch (input.type) {
    case 'PATENT_IDEA':
      return {
        title: '특허 아이디어 설계',
        rules: [
          '5개 고정 질문으로 정리한다: ① 현재 문제 ② 기존 방식 ③ 차별 구조 ④ 처리 흐름(입력→데이터 정리→판단/분석/추천/최적화→출력→직원/고객 Action→결과 재반영) ⑤ 권리화 포인트(경쟁사가 가장 쉽게 베낄 구조·처리순서·연결관계).',
          '특허명은 마케팅 문구가 아니라 기술구조가 읽혀야 한다: [대상/데이터] 기반 [핵심 판단·처리] 및 [실행·결과] 시스템/방법/장치.',
          '단순 UI 설명으로 끝내지 않는다. 데이터 저장·정규화 → 판단(Rule/Scoring/Optimization/AI) → 위험도·추천·우선순위 → Action → 실행결과 기록 → 재반영 구조를 쓴다.',
          '발명자는 "구체적인 기술적 사상의 창작에 실제로 기여했는가" 로 판단한다. 대표자의 문제 인식·요구사항 정의는 중요한 사업적 기여이지만 자동으로 발명자가 되는 것은 아니다. 사실대로 확인할 항목으로 남긴다.',
          '고객에게 발명설명서·도면파일을 새로 요구하지 않는다. 회사에 이미 있는 자료(업무흐름·사진·엑셀·카톡·오류 사례)만 전제로 한다.',
        ],
        task: ['위 5개 질문에 답하고, 특허 제목 후보 3개를 낸다.', '권리화 포인트는 청구항이 될 만한 문장 3개로도 적는다.', '발명자·출원인 확인 질문 3개를 만든다.'],
        sections: ['① 현재 문제', '② 기존 방식', '③ 차별 구조', '④ 처리 흐름', '⑤ 권리화 포인트', '특허 제목 후보 3개', '발명자·출원인 확인 질문'],
        facts: ['companyName', 'industry', 'mainProducts', 'coreProblem', 'currentMethod', 'coreTech', 'implemented', 'customers', 'customerSegments'],
      }
    case 'PRIOR_ART_REVIEW':
      return {
        title: '선행기술 검토 설계',
        rules: [
          'KIPRIS 선행기술 조사는 신규성·진보성·중복 가능성 검토다. KIPO 명세서 작성 예시와는 역할이 다르다.',
          '최소 확인: 핵심 키워드 / 동일·유사 목적 특허 / 동일·유사 구성요소 / 동일·유사 처리순서 / 유사 청구항 구조 / 고객사 기존 출원과의 중복.',
          '목적은 "완전히 같은 것이 없다" 가 아니다. 무엇을 빼고, 좁히고, 추가하고, 어떤 결합관계·처리순서를 강조해야 차별화 논리가 서는지 찾는 것이다.',
          '실제 검색 결과를 아는 척하지 않는다. 검색 키워드 세트와 "이런 결과가 나오면 이렇게 좁힌다" 는 판단 규칙을 만든다.',
        ],
        task: ['KIPRIS 검색 키워드 세트(한국어·영어, 동의어 포함) 3묶음.', '유사할 가능성이 높은 선행기술 유형 5개와 각각에 대한 차별화 방향.', '청구항을 좁힐 후보 요소·강조할 결합관계.'],
        sections: ['검색 키워드 세트', '예상 유사 선행기술 유형과 차별화 방향', '청구항 좁히기/강조 후보', '사람이 KIPRIS 에서 확인할 체크리스트'],
        facts: ['coreProblem', 'currentMethod', 'coreTech', 'patent'],
      }
    case 'PATENT_SPEC_DRAFT': {
      const refs = p.kipo.map((s) => kipoByCode(s.code)).filter(Boolean).map((r) => `- ${r!.code} ${r!.title} (${r!.field})`)
      return {
        title: '명세서 초안',
        rules: [
          '명세서 목차: 발명의 명칭 / 기술분야 / 배경기술 / 선행기술문헌 / 발명의 내용(해결하려는 과제·과제 해결 수단·발명의 효과) / 도면의 간단한 설명 / 발명을 실시하기 위한 구체적인 내용 / 부호의 설명 / 청구범위 / 요약서 / 도면.',
          '참고 사례(KIPO 예시)는 목차·문장구조·청구항 형식·도면·요약서 표현만 참고한다. 예시 문장을 그대로 복제하거나 예시의 발명 구성을 이 회사 기술인 것처럼 쓰지 않는다.',
          '첨부된 PDF 가 없는 사례의 세부 문구를 추측해 반영하지 않는다.',
          '도면은 필요한 것만: 시스템 구성도 / 데이터 흐름도 / 핵심 처리순서 / 사용자↔서버↔DB / 분석·추천·제어 흐름 / 결과→실행→피드백. UI 캡처 수십 장보다 발명의 논리가 보이는 도면.',
          '요약서 QA: 기술적 과제·해결수단·효과 명확, 용어 통일, 대표도·인용부호 일치, 마케팅 표현 제거, 400자 이내(출원 직전 실제 서식 글자수 재확인).',
          '"등록" 이라 쓰지 않는다. 출원 단계다.',
          ...(refs.length > 0 ? ['선정된 참고 사례:', ...refs] : ['참고 사례가 아직 선정되지 않았다 — 구조만 제안하고 사례 문구는 쓰지 않는다.']),
        ],
        task: ['위 목차 순서대로 초안을 쓴다. 청구항은 독립항 1 + 종속항 3~6.', '도면 목록과 각 도면에 들어갈 부호를 제안한다.', '요약서를 400자 이내로 쓴다.'],
        sections: ['발명의 명칭', '기술분야', '배경기술', '발명의 내용', '도면의 간단한 설명', '구체적인 내용', '청구범위', '요약서(400자 이내)', '도면 목록'],
        facts: ['companyName', 'representative', 'headOffice', 'coreProblem', 'currentMethod', 'coreTech', 'implemented', 'axCore', 'platformUsers'],
      }
    }
    case 'PATENT_CLAIMS_REVIEW':
      return {
        title: '청구항 검토',
        rules: [
          '청구항은 권리화 포인트(경쟁사가 베끼기 쉬운 구조·처리순서·연결관계)를 보호해야 한다.',
          '독립항은 넓게, 종속항으로 좁힌다. 각 항이 명세서 본문에서 뒷받침되는지 본다.',
          '용어가 명세서·요약서·도면 부호와 일치하는지 본다.',
          '고가치·복잡한 권리범위·거절 가능성이 높은 경우 변리사 검토를 별도 Gate 로 권한다 — 그 판단 근거를 적는다.',
        ],
        task: ['맥락의 청구항을 항별로 검토한다: 뒷받침 여부 / 명확성 / 너무 넓거나 좁은지 / 용어 일치.', '수정 제안을 항별로 낸다.', '변리사 검토가 필요한지와 이유.'],
        sections: ['항별 검토표', '수정 제안', '용어 일치 점검', '변리사 검토 필요 여부'],
        facts: ['coreTech'],
      }
    case 'MVP_STRATEGY':
      return {
        title: 'MVP 전략 잠금 (MVP_SPEC)',
        rules: [
          'Less Scope, Same Polish. 범위는 줄여도 완성도는 낮추지 않는다.',
          '벤처용 최소 구성: AX/관리 대시보드 1 + 고객/거래처/현장용 Platform Surface 1 + Primary Proof Journey 1 + 실제 작동하는 AX 핵심기능 1(최대 2) + Future Preview 총 6~10 + PC/Mobile + 3분 Demo.',
          'Primary Journey 는 특허 핵심기술과 같아야 한다. 핵심가설 문장: "[대상 고객]이 [기존 문제] 때문에 겪는 불편을 [핵심 기능/방식]으로 해결하면 [핵심 행동/전환]을 만들 수 있다."',
          'AX 기능 방식을 정한다(Rule/Scoring/Optimization/예측/추천/RAG/LLM/Demo Logic). 실제 AI 가 아니면 AI 라 부르지 않는다. 결과 아래에 "왜 이 결과인지" 근거 2~3개.',
          'LIVE / DEMO / FUTURE 를 구분한다. Future 기능은 Modal/Drawer 로 설명만 하고 빈 페이지·404 를 만들지 않는다.',
          '상한: Journey 1(최대 2), Wow 1(최대 2), Tier A 3~5, Tier B 3~5, 실제 Route 8~12, Mini Admin 0~1, 실제 외부 API 0~1. NOT PRODUCTION: 결제·SMS·OAuth 전체·다중권한·Multi-tenant·정산·Native 는 기본 제외.',
          'Demo Data 는 업종에 맞고 서로 일관되며 실적처럼 위장하지 않는다. 실제 값이 있으면 실제 값을 쓴다.',
        ],
        task: ['MVP_SPEC 을 채운다: PRODUCT / ONE-LINE VALUE / TARGET USER / CORE PROBLEM / PRIMARY HYPOTHESIS / PRIMARY CTA / PRIMARY PROOF JOURNEY / AX CORE FEATURE(방식 포함) / PLATFORM SURFACE / WOW / COMPLETION STATE / BUSINESS MODEL / LIVE / DEMO / FUTURE 6~10 / TIER A·B / NOT BUILDING / DEMO DATA ASSUMPTION / REFERENCE STYLE / DEFAULT THEME / JUDGE FAST PATH.'],
        sections: ['MVP_SPEC', '핵심가설 문장', 'Primary Journey (단계별)', 'AX 핵심기능과 방식·근거 표시', 'Platform Surface', 'LIVE / DEMO / FUTURE', 'Not Building', '3분 Demo 동선'],
        facts: ['companyName', 'industry', 'mainProducts', 'coreProblem', 'currentMethod', 'coreTech', 'implemented', 'inDevelopment', 'futureDev', 'customers', 'customerSegments', 'platformUsers', 'axCore'],
      }
    case 'MVP_CLAUDE_CODE_BUILD':
      return {
        title: 'MVP 빌드 지시 (Claude Code)',
        rules: [
          '[필수 시작 지시 — RAPID HIGH-FIDELITY MVP v1.1] 이 프로젝트는 미래AI랩 Rapid High-Fidelity MVP System 을 Source of Truth 로 쓴다. 목표는 Production 이 아니라 사업가설 1개를 클릭 가능한 고품질 제품 경험으로 증명하는 것이다.',
          'Hard Blocker 가 없으면 한 번의 실행에서 Strategy 확인 → Build → Desktop/Mobile Render QA → Primary Journey 클릭 QA → Polish → Judge/Devil → P0/P1 수정 → Re-test 까지 간다. "우선 구현했습니다, 다음에 고도화" 금지.',
          'Tier A 화면은 첫 Build 부터 Premium: 강한 Hero, 큰 Typography(본문 17~19px)·낮은 Text Density, Pure White #FFFFFF Surface, Sidebar Color Icon, Premium Motion(Hover 160~220ms, Modal 220~320ms, 숫자 450~700ms), Hover/Pressed/Focus.',
          '실제 Route 8~12, 404 0, Placeholder 0, Dead CTA 0. Future Preview 는 Sheet/Modal 로. Journey Completion: 시작→선택 유지→검증→확인→완료화면→다음 행동→My/History 재진입.',
          'Mobile P0: 390/430 실측. 상단 잘림·Bottom CTA 가림·Drawer 닫기 불가·Overlay 잔존·Keyboard 가림·Journey 중단·404·Back 불가 하나라도 있으면 완료 금지.',
          'AI 는 핵심가설일 때만 실제 API. 아니면 신뢰도 높은 Demo Logic + 근거 2~3개 표시. "AI 분석 중" 애니메이션만 있고 논리가 없으면 실패.',
          '완료 시 MVP_SPEC.md / MVP_STATE.md / QA_REPORT.md(Score·P0·P1·Journey·Mobile·Future·Known Limitation) 를 남기고 URL 을 보고한다.',
          `MVP_SPEC (아래 맥락 문서에 있음)을 먼저 읽고 그대로 구현한다. 특허 핵심기술 = "${p.coreThread.coreTech || p.factsheet.coreTech?.value || '(핵심 줄기 참조)'}".`,
        ],
        task: ['맥락의 MVP_SPEC 을 구현한다. 새 기능을 추가하기 전에 "이 기능이 없으면 심사 결과가 실제로 나빠지는가?" 를 묻고, NO 면 NEXT 로 보낸다.'],
        sections: ['구현 요약', 'Route Map (Tier A/B/C)', 'Primary Journey 클릭 QA 결과', 'Mobile 390/430 결과', 'LIVE/DEMO/FUTURE 표시 위치', 'QA_REPORT 요약', 'Known Limitation'],
        facts: ['companyName', 'industry', 'mainProducts', 'coreTech', 'axCore', 'platformUsers', 'mvpUrl'],
      }
    case 'VENTURE_PLAN_SECTION': {
      const sec = PLAN_SECTIONS.find((s) => s.no === (input.section ?? 1)) ?? PLAN_SECTIONS[0]
      return {
        title: `사업계획서 ${sec.no}. ${sec.title}`,
        rules: [
          `핵심 질문: ${sec.question}`,
          `반드시 포함: ${sec.must.join(' / ')}`,
          `이 항목의 첨부 슬롯: ${sec.slots.join(', ')} — 1,000자 서술은 논리와 주장, 첨부는 그 주장을 눈으로 이해시키는 증거.`,
          '숫자마다 기준연도·출처·산식. 사실표의 상태(확정/미확인/계획/시연용/향후)를 그대로 존중하고, 시연용·미확인 값을 실적으로 쓰지 않는다.',
          '특허·MVP 와 같은 기술명을 쓴다(핵심 줄기). 현재 / 개발 중 / 향후를 구분한다.',
          sec.no === 5 ? '"경쟁사가 없다" 고 쓰지 않는다. 수기/엑셀/전화 방식, 범용 ERP/CRM/POS, 직접 경쟁사, 유사 서비스를 비교한다.' : '',
          sec.no === 4 ? 'TAM(전체 잠재) → SAM(실제 접근 가능) → SOM(3년 내 현실적 확보). 시장규모만 크게 쓰지 않는다. 현재 거래처 기반 SOM 논리.' : '',
          sec.no === 7 ? '자금은 확보 완료 / 신청·협의 중 / 향후 계획으로 구분. 사용처는 개발인력·시스템·장비·인증/특허·마케팅·영업·시설·운영자금. 기술·사업 Milestone 과 연결.' : '',
          '외부개발 사실을 숨기지 않는다. 권장 구조: "대표자와 신청기업이 현장문제·핵심 요구사항·적용방향·사업화 목표를 정의하고, 외부 전문개발 파트너와 협업하여 MVP 를 구현·검증…".',
        ].filter(Boolean),
        task: [`${sec.no}. ${sec.title} 본문을 1,000자 내외로 쓴다.`, '본문에서 주장한 것마다 어떤 첨부(슬롯)로 증명할지 표로 만든다.', '사실표에 없어서 지어낼 뻔한 값은 "확인 필요" 로 남긴다.'],
        sections: ['본문(1,000자 내외)', '주장–증빙 표', '첨부 슬롯 제안', '확인 필요'],
      }
    }
    case 'VENTURE_FULL_REVIEW':
      return {
        title: '사업계획서 전체 검토 (Judge / Devil)',
        rules: [
          '심사위원이 이해해야 할 8개: 실제 문제 / 왜 대표자가 잘 아는가 / 기존 방식과 무엇이 다른가 / 무엇을 실제로 만들었는가 / 특허와 MVP 가 같은 기술인가 / 누가 돈을 내는가 / 3년 성장 / 왜 이 회사가 실행할 수 있는가.',
          'Devil 질문: ERP/CRM 기능 아닌가 / 실제 AI 어디 있나 / 특허와 MVP 관계 / 경쟁사가 바로 만들 수 있지 않나 / 대표가 직접 뭘 했나 / 외주가 다 만든 것 아닌가 / TAM 만 크고 고객 없지 않나 / SOM 근거 / 숫자 실제인가 Demo 인가 / 자금과 매출 연결.',
          `P0 Red Flag 12개: ${RED_FLAGS.map((f) => `#${f.no} ${f.text}`).join(' / ')}`,
          'Judge Scorecard 10축(각 10점): A Problem Reality / B Team Fit / C Technical Differentiation / D Patent↔MVP Consistency / E MVP Proof / F TAM·SAM·SOM Credibility / G Competitive Advantage / H Market Entry·Growth / I Funding Logic / J Evidence·Integrity. 점수는 근거와 함께.',
          'P0 가 하나라도 남으면 점수와 무관하게 Final 이 아니다.',
        ],
        task: ['맥락의 사업계획서·사실표·핵심 줄기를 읽고 P0 12개를 하나씩 판정한다(있음/없음/근거).', 'Devil 질문 10개에 대한 현재 답변 가능성과 보강 방향.', 'Judge 10축 점수(근거 포함)와 총평.'],
        sections: ['P0 Red Flag 판정표', 'Devil 질문별 취약점', 'Judge Scorecard', '수정 우선순위 (P0 → P1)', '확인 필요'],
      }
    case 'EVIDENCE_REVIEW': {
      const ev = (input.evidence ?? []).filter((e) => e.projectId === p.id)
      const rows = EVIDENCE_SLOTS.map((s) => {
        const items = ev.filter((e) => e.slot === s.slot)
        return `- 슬롯 ${s.slot} ${s.where} (${s.direction}, ${s.pages}): ${items.length === 0 ? '비어 있음' : items.map((e) => `[${e.claimStatus}] ${e.claim || e.title}${e.source ? ` ← ${e.source}` : ' (출처 없음)'}`).join(' | ')}`
      })
      return {
        title: 'Claim–Evidence Matrix 검토',
        rules: [
          '핵심 주장마다 상태(LIVE/DEMO/FUTURE/시장/목표) · 특허 연결 · MVP 연결 · 객관증빙 · 들어갈 항목/첨부 슬롯을 표로 만든다.',
          '핵심 주장인데 증빙이 비어 있으면: 증빙 확보 / 표현 약화 / 향후계획으로 이동 / 삭제 중 하나를 고른다.',
          '10개 첨부 슬롯: 기본 1장, 중요한 곳만 2장. 총 10~14장. 내용 없는 장수를 늘리지 않는다.',
          '좋은 장: 제목만 봐도 핵심 이해 / 숫자에 출처 / 현재·향후 구분 / MVP 실제 화면 / 특허와 같은 기술명. 나쁜 장: 텍스트 과다 / 문장 복붙 / 향후를 현재처럼 / TAM·SOM 혼동 / 근거 없는 점유율.',
          '현재 슬롯 상태:',
          ...rows,
        ],
        task: ['Claim–Evidence Matrix 를 완성한다(주장/상태/특허/MVP/증빙/슬롯).', '비어 있거나 출처 없는 슬롯마다 처리 방향(확보·약화·이동·삭제)을 정한다.', '슬롯별 장수 계획(총 10~14장).'],
        sections: ['Claim–Evidence Matrix', '슬롯별 처리 방향', '장수 계획', '확인 필요'],
      }
    }
    case 'INFOGRAPHIC_BRIEF': {
      const s = EVIDENCE_SLOTS.find((x) => x.slot === (input.slot ?? 1)) ?? EVIDENCE_SLOTS[0]
      return {
        title: `인포그래픽 기획 — 슬롯 ${s.slot} ${s.where}`,
        rules: [
          `이 슬롯의 기본 첨부 방향: ${s.direction} (${s.pages}).`,
          '각 장에는 메시지 하나만. 제목만 봐도 핵심이 이해되어야 한다. 디자인보다 메시지가 먼저.',
          '숫자가 있으면 출처·기준연도. 현재와 향후를 시각적으로 구분한다(색·라벨). MVP 는 실제 화면을 쓴다. 특허와 같은 기술명.',
          '사업계획서 문장을 그대로 이미지에 복붙하지 않는다. 향후 기능을 현재처럼 그리지 않는다. TAM 과 SOM 을 혼동하지 않는다.',
          '개인정보(실명·연락처·계좌)가 화면에 노출되지 않게 한다.',
        ],
        task: ['이 슬롯에 넣을 1장(필요하면 2장)의 기획서를 쓴다: 제목 / 한 줄 메시지 / 구성 요소(도형·표·화면 캡처) / 숫자와 출처 / 현재·향후 구분 표시 / 금지 사항 확인.', '디자이너 또는 이미지 도구에 넘길 수 있는 제작 지시문을 붙인다.'],
        sections: ['장 제목과 한 줄 메시지', '구성 요소', '숫자와 출처', '현재/향후 구분', '제작 지시문', '확인 필요'],
      }
    }
    case 'FIELD_REVIEW_SCRIPT':
      return {
        title: '대표자 3분 설명 Script + MVP Demo 동선',
        rules: [
          `3분 구조: ${SCRIPT_SKELETON.join(' → ')}`,
          '대표자의 실제 말투와 업종에 맞게 쓴다. 대표자가 직접 하지 않은 기술적 발명을 한 것처럼 말하지 않는다.',
          'MVP 3분 Demo: 문제 → 대시보드 → 핵심 입력 → AX 분석/판단 → 결과 → Action → 고객/거래처 Surface → Future Preview. 모든 메뉴를 보여주지 않는다.',
          `금지 표현(증빙 없으면): ${FORBIDDEN_PHRASES.map((f) => f.label).join(' / ')}`,
          '대표가 외울 숫자는 8~12개만(설립일·최근 매출·직원수·거래처수·특허 출원번호/출원일·TAM·SAM·SOM·3년 목표·필요자금). 사실표의 확정 값만 쓴다.',
        ],
        task: ['3분 Script 를 구간별 시간과 함께 쓴다.', 'Demo 동선을 클릭 순서로 쓴다.', '외울 숫자 목록(사실표 값 그대로, 없으면 "확인 필요").', '이 회사에서 특히 조심할 표현 5개.'],
        sections: ['3분 Script', 'MVP Demo 동선', '외울 숫자', '조심할 표현', '확인 필요'],
      }
    case 'FIELD_REVIEW_QA':
      return {
        title: '실사 예상 질문 10~15 + 답변 Key Point',
        rules: [
          `기본 질문 풀: ${FIELD_QUESTION_POOL.join(' / ')}`,
          '회사에 맞게 질문을 바꾸고, 답변 Key Point 는 사실표·핵심 줄기와 어긋나지 않게 쓴다.',
          '"누가 무엇을 했습니까?" 에 일관되게 답한다: 대표자/신청기업(현장문제·요구사항·피드백·사업화·현장 적용) vs 외부 파트너(문제 구조화·기술 구체화·설계·구현·문서화). 실제 기여대로.',
          '출원 상태면 "출원 중". 실제 AI 가 아니면 AI 라 하지 않는다. Demo 숫자를 실적처럼 말하지 않는다.',
          '반드시 준비할 증빙 체크리스트(회사·대표자·기술·개발·사업·시장)를 함께 낸다.',
        ],
        task: ['예상 질문 12개(회사 맞춤)와 답변 Key Point.', '가장 위험한 질문 3개와 대응.', '증빙 체크리스트.', 'Mock Review 진행 순서(30분).'],
        sections: ['예상 질문과 Key Point', '위험 질문 3개', '증빙 체크리스트', 'Mock Review 순서', '확인 필요'],
      }
    case 'GENERAL_PROJECT_REVIEW':
    default:
      return {
        title: '프로젝트 전체 검토 · 다음 행동',
        rules: [
          '새 대화에서는 전체 파일을 요약부터 하지 않는다: 상태 → 현재 단계 → 그 단계 규칙 → 필요한 QA → 다음 행동 순.',
          '이미 아는 회사 정보를 다시 묻지 않는다. 현재 단계에 필요한 정보만 최소 묶음으로 요청한다. 다음 단계까지 2~3개만 예고한다.',
          '형식: 현재 단계 / 완료된 것 / 지금 할 것 / 필요한 자료 / 그 다음 단계.',
          'One Core Thread(현장문제→특허→MVP→사업계획서→증빙→실사)가 끊긴 곳이 있으면 먼저 지적한다.',
        ],
        task: ['맥락을 읽고 위 형식으로 답한다.', '핵심 줄기가 끊긴 곳과 사실표에서 위험한 값(미확인·시연용이 실적처럼 쓰일 위험)을 짚는다.', '다음 행동 3개를 이유와 함께.'],
        sections: ['현재 단계', '완료된 것', '지금 할 것', '필요한 자료', '그 다음 단계', '핵심 줄기 점검', '확인 필요'],
      }
  }
}

/* ------------------------------------------------------------------ */
/* 조립                                                                 */
/* ------------------------------------------------------------------ */

export function buildPromptPackage(input: BuildInput): BuiltPackage {
  const p = input.project
  const stage: StageKey = PROMPT_DEFAULT_STAGE[input.type]
  const body = bodyFor(input)

  const promptRaw = [
    header(p, input.type, stage),
    '',
    globalBlock(),
    '',
    '## 이 단계의 규칙',
    ...body.rules.map((r) => `- ${r}`),
    '',
    '## 회사 사실 (사실표 발췌 — 괄호 안은 값의 상태·기준일·출처)',
    factsFor(p, body.facts),
    '',
    '## 핵심 줄기 (One Core Thread)',
    threadBlock(p),
    '',
    '## 해야 할 일',
    ...body.task.map((t, i) => `${i + 1}. ${t}`),
    '',
    outputBlock(input.type, stage, body.title, body.sections),
    '',
    '첨부한 "Context" 문서에 사실표 전체·워크스페이스 내용·최근 산출물이 있다. 본문과 다르면 Context 의 최신 값을 따르되, 서로 다른 값을 발견하면 "확인 필요" 에 적는다.',
  ].join('\n')

  const contextRaw = buildContext(p, input)

  const a = redactSensitive(targetWrap(input.target, promptRaw))
  const b = redactSensitive(contextRaw)
  return {
    title: body.title,
    stageKey: stage,
    prompt: a.text,
    context: b.text,
    privacy: mergeReports(a.report, b.report),
    section: input.section ?? null,
  }
}

/** Context 문서 — 사실표 전체 + 작업공간 + 최근 산출물 (필터 전) */
export function buildContext(p: ConsultingProject, input: Pick<BuildInput, 'artifacts' | 'type'>): string {
  const lines: string[] = []
  lines.push(`# CONTEXT — ${p.clientName}${p.title ? ` · ${p.title}` : ''}`)
  lines.push(`현재 단계: ${p.currentStage} · 게이트: ${p.gate.decision ?? '미결'}`)
  lines.push('')
  lines.push('## 사실표 (VENTURE FACTSHEET)')
  lines.push(factsheetToText(p.factsheet) || '(비어 있음)')
  lines.push('')
  lines.push('## 핵심 줄기')
  lines.push(coreThreadToText(p) || '(비어 있음)')
  lines.push('')

  const patentLines = [
    ['현재 문제', p.patent.problem], ['기존 방식', p.patent.existingMethod], ['차별 구조', p.patent.differentStructure],
    ['처리 흐름', p.patent.processFlow], ['권리화 포인트', p.patent.claimPoint], ['제목 후보', p.patent.titleCandidates],
    ['선행기술 키워드', p.patent.priorArtKeywords], ['선행기술 검토', p.patent.priorArtFindings],
    ['발명자', p.patent.inventors], ['출원인', p.patent.applicant], ['권리귀속 메모', p.patent.rightsNote],
    ['출원 상태', p.patent.filingStatus === 'none' ? '미출원' : p.patent.filingStatus === 'filed' ? `출원 중 (${p.patent.applicationNumber} · ${p.patent.filedAt})` : '등록'],
  ].filter(([, v]) => v.trim() !== '')
  if (patentLines.length > 0) {
    lines.push('## 특허 작업공간')
    for (const [k, v] of patentLines) lines.push(`${k}: ${v.trim()}`)
    lines.push('')
  }

  const mvpLines = Object.entries({
    PRODUCT: p.mvp.productName, 'ONE-LINE VALUE': p.mvp.oneLineValue, 'TARGET USER': p.mvp.targetUser, 'PRIMARY JOURNEY': p.mvp.primaryJourney,
    'AX CORE FEATURE': p.mvp.axCoreFeature, 'AX MODE': p.mvp.axMode, 'PLATFORM SURFACE': p.mvp.platformSurface, LIVE: p.mvp.live, DEMO: p.mvp.demo,
    FUTURE: p.mvp.future, 'NOT BUILDING': p.mvp.notBuilding, 'DEMO DATA ASSUMPTION': p.mvp.demoDataAssumption, URL: p.mvp.mvpUrl, 'REFERENCE STYLE': p.mvp.referenceStyle,
  }).filter(([, v]) => v.trim() !== '')
  if (mvpLines.length > 0) {
    lines.push('## MVP_SPEC (작업공간)')
    for (const [k, v] of mvpLines) lines.push(`${k}: ${v.trim()}`)
    lines.push('')
  }

  const secLines = PLAN_SECTIONS.filter((s) => p.venture.sections[s.no].outline.trim() !== '')
  if (secLines.length > 0) {
    lines.push('## 사업계획서 항목 요지')
    for (const s of secLines) lines.push(`${s.no}. ${s.title}: ${p.venture.sections[s.no].outline.trim()}`)
    lines.push('')
  }

  const arts = (input.artifacts ?? []).filter((a) => a.projectId === p.id && a.status !== 'superseded')
  // 종류별 최신 버전만, 최대 6개, 각 4,000자
  const latest = new Map<string, ConsultingArtifact>()
  for (const a of arts) {
    const cur = latest.get(a.type)
    if (!cur || cur.version < a.version) latest.set(a.type, a)
  }
  const picked = [...latest.values()].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt)).slice(0, 6)
  if (picked.length > 0) {
    lines.push('## 최근 산출물 (종류별 최신)')
    for (const a of picked) {
      lines.push(`### ${a.title} (${a.type} v${a.version} · ${a.stageKey})`)
      lines.push(a.content.length > 4000 ? `${a.content.slice(0, 4000)}\n…(이하 생략)` : a.content)
      lines.push('')
    }
  }
  return lines.join('\n').trim()
}

/** 다운로드 파일 이름 */
export function packageFileName(p: ConsultingProject, type: PromptPackageType, kind: 'prompt' | 'context'): string {
  const safe = (p.clientName || 'project').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 30)
  return `${safe}_${type}_${kind}.md`
}
