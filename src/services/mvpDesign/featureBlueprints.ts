import type { RecommendedMvpTemplate } from '../../types/selection'
import type {
  BusinessRuleType,
  FeatureAutomationMode,
  FeatureScope,
  FeatureType,
  FieldType,
  ProcessingKind,
} from '../../types/mvpDesign'

/**
 * 규칙 기반 기능 청사진.
 * 템플릿(과제 성격)마다 실제 동작(입력→처리→출력)을 정의한 기능 후보를 제공한다.
 * 결정적: 동일 입력이면 항상 동일 청사진을 만든다.
 */

export interface RuleBlueprint {
  key: string
  name: string
  type: BusinessRuleType
  condition: string
  outcome: string
  needsConfirmation: boolean
}

export interface FieldBlueprint {
  name: string
  label: string
  type: FieldType
  required: boolean
  detail: string
  sensitive: boolean
  computedFrom: string
}

export interface EntityBlueprint {
  key: string
  name: string
  label: string
  description: string
  fields: FieldBlueprint[]
}

export interface FeatureBlueprint {
  key: string
  name: string
  summary: string
  type: FeatureType
  automationMode: FeatureAutomationMode
  input: string
  processing: string
  processingKind: ProcessingKind
  output: string
  defaultScope: FeatureScope
  usesAi: boolean
  humanReviewRequired: boolean
  /** 전문가 최종판단 경계에 걸리는 기능(세무·노무·법률·의료 판정 등) */
  expertJudgmentBoundary: boolean
  /** 이 기능이 다루는 엔티티 청사진 키 */
  entityKeys: string[]
  /** 이 기능이 만드는 업무 규칙 */
  rules: RuleBlueprint[]
}

export interface TemplateBlueprint {
  entities: EntityBlueprint[]
  features: FeatureBlueprint[]
}

const RECORD_FIELDS: FieldBlueprint[] = [
  { name: 'title', label: '건 제목', type: 'text', required: true, detail: '업무 건을 식별하는 제목', sensitive: false, computedFrom: '' },
  { name: 'owner', label: '담당자', type: 'reference', required: true, detail: '역할: 담당자', sensitive: false, computedFrom: '' },
  { name: 'status', label: '상태', type: 'enum', required: true, detail: '접수/진행/완료/보류', sensitive: false, computedFrom: '' },
  { name: 'createdAt', label: '등록일', type: 'datetime', required: true, detail: '자동 기록', sensitive: false, computedFrom: '' },
  { name: 'note', label: '비고', type: 'long_text', required: false, detail: '자유 메모', sensitive: false, computedFrom: '' },
]

/* 8개 추천 MVP 템플릿별 청사진 */
export const TEMPLATE_BLUEPRINTS: Record<RecommendedMvpTemplate, TemplateBlueprint> = {
  diagnosis_decision: {
    entities: [
      {
        key: 'case',
        name: 'DiagnosisCase',
        label: '판정 대상 건',
        description: '판정·분류 대상이 되는 업무 건',
        fields: [
          ...RECORD_FIELDS,
          { name: 'inputSummary', label: '입력 요약', type: 'long_text', required: true, detail: '판정 기준이 되는 입력값', sensitive: false, computedFrom: '' },
          { name: 'result', label: '판정 결과', type: 'enum', required: false, detail: '규칙 기반 판정 결과(사람 확정 전 초안)', sensitive: false, computedFrom: '입력값 + 규칙' },
          { name: 'confidence', label: '판정 근거', type: 'long_text', required: false, detail: '어떤 규칙으로 나온 결과인지', sensitive: false, computedFrom: '' },
        ],
      },
    ],
    features: [
      {
        key: 'case_intake',
        name: '판정 요청 입력',
        summary: '판정에 필요한 항목을 입력받아 건을 등록한다.',
        type: 'input_form',
        automationMode: 'manual_only',
        input: '판정 대상 정보(항목별 입력값)',
        processing: '필수값 검증 후 건으로 저장',
        processingKind: 'validate',
        output: '등록된 판정 대상 건',
        defaultScope: 'must',
        usesAi: false,
        humanReviewRequired: false,
        expertJudgmentBoundary: false,
        entityKeys: ['case'],
        rules: [
          { key: 'required_check', name: '필수 항목 검증', type: 'validation', condition: '필수 입력값이 비어 있으면', outcome: '저장을 막고 누락 항목을 표시한다', needsConfirmation: false },
        ],
      },
      {
        key: 'rule_decision',
        name: '규칙 기반 판정',
        summary: '입력값과 정의된 기준으로 판정 초안을 만든다.',
        type: 'rule_calculation',
        automationMode: 'human_confirm',
        input: '등록된 판정 대상 건',
        processing: '기준표에 따라 분류·판정 초안 산출',
        processingKind: 'classify',
        output: '판정 초안 + 근거(사람 확정 대상)',
        defaultScope: 'must',
        usesAi: false,
        humanReviewRequired: true,
        expertJudgmentBoundary: true,
        entityKeys: ['case'],
        rules: [
          { key: 'decision_threshold', name: '판정 기준값', type: 'threshold', condition: '입력값이 기준 구간에 들어가면', outcome: '해당 구간의 판정 결과를 초안으로 제시한다', needsConfirmation: true },
          { key: 'expert_flag', name: '전문가 확인 대상 표시', type: 'exception', condition: '전문가 최종판단이 필요한 조건이면', outcome: '자동 판정 대신 담당 전문가 확인 대상으로 표시한다', needsConfirmation: false },
        ],
      },
      {
        key: 'case_list',
        name: '판정 건 목록·검색',
        summary: '판정 건을 상태·기간으로 조회한다.',
        type: 'list_view',
        automationMode: 'full_auto',
        input: '검색·필터 조건',
        processing: '조건에 맞는 건 조회·정렬',
        processingKind: 'aggregate',
        output: '판정 건 목록',
        defaultScope: 'should',
        usesAi: false,
        humanReviewRequired: false,
        expertJudgmentBoundary: false,
        entityKeys: ['case'],
        rules: [],
      },
    ],
  },
  document_report: {
    entities: [
      {
        key: 'doc',
        name: 'DocumentJob',
        label: '문서 작성 건',
        description: '초안을 생성할 문서·보고서 건',
        fields: [
          ...RECORD_FIELDS,
          { name: 'sourceData', label: '원천 자료', type: 'long_text', required: true, detail: '문서에 반영할 항목', sensitive: false, computedFrom: '' },
          { name: 'draft', label: '문서 초안', type: 'long_text', required: false, detail: '생성된 초안(사람 검토 대상)', sensitive: false, computedFrom: '원천 자료 + 양식' },
          { name: 'finalDoc', label: '확정 문서', type: 'file', required: false, detail: '담당자 확정본', sensitive: false, computedFrom: '' },
        ],
      },
    ],
    features: [
      {
        key: 'doc_input',
        name: '문서 항목 입력',
        summary: '문서에 들어갈 핵심 항목을 입력받는다.',
        type: 'input_form',
        automationMode: 'manual_only',
        input: '문서 항목값',
        processing: '항목 검증 후 저장',
        processingKind: 'validate',
        output: '문서 작성 건',
        defaultScope: 'must',
        usesAi: false,
        humanReviewRequired: false,
        expertJudgmentBoundary: false,
        entityKeys: ['doc'],
        rules: [
          { key: 'field_required', name: '핵심 항목 검증', type: 'validation', condition: '문서 필수 항목이 비면', outcome: '초안 생성을 막는다', needsConfirmation: false },
        ],
      },
      {
        key: 'doc_draft',
        name: '문서 초안 생성',
        summary: '입력 항목을 양식에 채워 초안을 만든다.',
        type: 'document_generation',
        automationMode: 'assisted',
        input: '문서 작성 건 + 문서 양식',
        processing: '양식 치환 규칙으로 초안 생성',
        processingKind: 'generate_draft',
        output: '문서 초안(사람 검토·수정 대상)',
        defaultScope: 'must',
        usesAi: false,
        humanReviewRequired: true,
        expertJudgmentBoundary: false,
        entityKeys: ['doc'],
        rules: [
          { key: 'template_fill', name: '양식 치환 규칙', type: 'calculation', condition: '입력 항목이 준비되면', outcome: '양식의 지정 위치에 항목값을 채운다', needsConfirmation: false },
        ],
      },
      {
        key: 'doc_confirm',
        name: '초안 검토·확정',
        summary: '담당자가 초안을 수정·확정하고 내려받는다.',
        type: 'detail_view',
        automationMode: 'human_confirm',
        input: '문서 초안',
        processing: '담당자 수정 반영 후 확정본 저장',
        processingKind: 'store',
        output: '확정 문서',
        defaultScope: 'should',
        usesAi: false,
        humanReviewRequired: true,
        expertJudgmentBoundary: false,
        entityKeys: ['doc'],
        rules: [],
      },
    ],
  },
  schedule_progress: {
    entities: [
      {
        key: 'task',
        name: 'WorkTask',
        label: '업무 건',
        description: '일정·진행 상태를 관리하는 업무 건',
        fields: [
          ...RECORD_FIELDS,
          { name: 'dueDate', label: '기한', type: 'date', required: false, detail: '완료 기한', sensitive: false, computedFrom: '' },
          { name: 'progress', label: '진행률', type: 'number', required: false, detail: '0~100', sensitive: false, computedFrom: '' },
        ],
      },
    ],
    features: [
      {
        key: 'task_register',
        name: '업무 등록·배정',
        summary: '업무 건을 등록하고 담당자·기한을 배정한다.',
        type: 'input_form',
        automationMode: 'manual_only',
        input: '업무 내용·담당자·기한',
        processing: '검증 후 저장·배정',
        processingKind: 'route_notify',
        output: '배정된 업무 건',
        defaultScope: 'must',
        usesAi: false,
        humanReviewRequired: false,
        expertJudgmentBoundary: false,
        entityKeys: ['task'],
        rules: [
          { key: 'assign_owner', name: '담당자 배정 규칙', type: 'routing', condition: '업무 유형이 지정되면', outcome: '기본 담당자에게 배정하고 알림 대상에 넣는다', needsConfirmation: true },
        ],
      },
      {
        key: 'task_board',
        name: '진행 현황 보드',
        summary: '상태별 업무 현황을 한눈에 본다.',
        type: 'status_tracking',
        automationMode: 'full_auto',
        input: '업무 건 집합',
        processing: '상태·기한 기준 집계',
        processingKind: 'aggregate',
        output: '상태별 현황 목록',
        defaultScope: 'must',
        usesAi: false,
        humanReviewRequired: false,
        expertJudgmentBoundary: false,
        entityKeys: ['task'],
        rules: [
          { key: 'overdue_flag', name: '지연 표시 규칙', type: 'threshold', condition: '기한이 지났고 완료가 아니면', outcome: '지연 상태로 표시한다', needsConfirmation: false },
        ],
      },
      {
        key: 'task_notify',
        name: '기한 알림',
        summary: '기한 임박·지연 건을 담당자에게 알린다.',
        type: 'notification',
        automationMode: 'full_auto',
        input: '기한 임박·지연 업무',
        processing: '조건 충족 건 알림 발송',
        processingKind: 'route_notify',
        output: '담당자 알림',
        defaultScope: 'should',
        usesAi: false,
        humanReviewRequired: false,
        expertJudgmentBoundary: false,
        entityKeys: ['task'],
        rules: [],
      },
    ],
  },
  quotation_cost_profit: {
    entities: [
      {
        key: 'quote',
        name: 'Quotation',
        label: '견적 건',
        description: '견적·원가·마진을 계산하는 건',
        fields: [
          ...RECORD_FIELDS,
          { name: 'items', label: '견적 항목', type: 'long_text', required: true, detail: '품목·수량·단가', sensitive: false, computedFrom: '' },
          { name: 'cost', label: '원가', type: 'currency', required: false, detail: '집계 원가', sensitive: false, computedFrom: '항목 단가 합계' },
          { name: 'margin', label: '마진', type: 'currency', required: false, detail: '견적가-원가', sensitive: false, computedFrom: '견적가 - 원가' },
        ],
      },
    ],
    features: [
      {
        key: 'quote_input',
        name: '견적 항목 입력',
        summary: '품목·수량·단가를 입력한다.',
        type: 'input_form',
        automationMode: 'manual_only',
        input: '품목·수량·단가',
        processing: '항목 검증 후 저장',
        processingKind: 'validate',
        output: '견적 건',
        defaultScope: 'must',
        usesAi: false,
        humanReviewRequired: false,
        expertJudgmentBoundary: false,
        entityKeys: ['quote'],
        rules: [
          { key: 'unit_required', name: '단가 검증', type: 'validation', condition: '단가·수량이 비거나 음수면', outcome: '계산을 막고 표시한다', needsConfirmation: false },
        ],
      },
      {
        key: 'cost_calc',
        name: '원가·마진 계산',
        summary: '항목으로 원가·마진을 자동 계산한다.',
        type: 'rule_calculation',
        automationMode: 'full_auto',
        input: '견적 항목',
        processing: '단가·수량으로 원가·마진 산출',
        processingKind: 'calculate',
        output: '원가·마진·견적서 초안',
        defaultScope: 'must',
        usesAi: false,
        humanReviewRequired: false,
        expertJudgmentBoundary: false,
        entityKeys: ['quote'],
        rules: [
          { key: 'margin_formula', name: '마진 계산식', type: 'calculation', condition: '원가·견적가가 준비되면', outcome: '마진 = 견적가 - 원가, 마진율을 계산한다', needsConfirmation: false },
          { key: 'low_margin', name: '저마진 경고', type: 'threshold', condition: '마진율이 기준 미만이면', outcome: '경고 표시(승인 대상)', needsConfirmation: true },
        ],
      },
    ],
  },
  inventory_asset_field: {
    entities: [
      {
        key: 'item',
        name: 'InventoryItem',
        label: '재고·자산 항목',
        description: '재고·자산·현장 기록 대상',
        fields: [
          ...RECORD_FIELDS,
          { name: 'quantity', label: '수량', type: 'number', required: true, detail: '현재 수량', sensitive: false, computedFrom: '' },
          { name: 'location', label: '위치', type: 'text', required: false, detail: '보관·설치 위치', sensitive: false, computedFrom: '' },
        ],
      },
    ],
    features: [
      {
        key: 'item_record',
        name: '입출고·현장 기록',
        summary: '입출고·현장 상황을 기록한다.',
        type: 'input_form',
        automationMode: 'manual_only',
        input: '항목·수량·위치·사진',
        processing: '검증 후 수량 갱신',
        processingKind: 'rule_transform',
        output: '갱신된 재고 기록',
        defaultScope: 'must',
        usesAi: false,
        humanReviewRequired: false,
        expertJudgmentBoundary: false,
        entityKeys: ['item'],
        rules: [
          { key: 'stock_calc', name: '수량 증감 규칙', type: 'calculation', condition: '입출고가 기록되면', outcome: '현재 수량을 증감한다', needsConfirmation: false },
          { key: 'low_stock', name: '부족 경고', type: 'threshold', condition: '수량이 기준 미만이면', outcome: '부족 표시·알림', needsConfirmation: true },
        ],
      },
      {
        key: 'item_list',
        name: '재고 현황 조회',
        summary: '재고·자산 현황을 위치·상태로 조회한다.',
        type: 'list_view',
        automationMode: 'full_auto',
        input: '조회 조건',
        processing: '조건별 집계',
        processingKind: 'aggregate',
        output: '재고 현황',
        defaultScope: 'should',
        usesAi: false,
        humanReviewRequired: false,
        expertJudgmentBoundary: false,
        entityKeys: ['item'],
        rules: [],
      },
    ],
  },
  customer_sales: {
    entities: [
      {
        key: 'lead',
        name: 'CustomerLead',
        label: '고객·상담 건',
        description: '고객·영업·상담 관리 대상',
        fields: [
          ...RECORD_FIELDS,
          { name: 'customerName', label: '고객명', type: 'text', required: true, detail: '고객·업체명', sensitive: true, computedFrom: '' },
          { name: 'contact', label: '연락처', type: 'text', required: false, detail: '연락처(개인정보)', sensitive: true, computedFrom: '' },
          { name: 'stage', label: '영업 단계', type: 'enum', required: true, detail: '문의/상담/제안/성사/실패', sensitive: false, computedFrom: '' },
        ],
      },
    ],
    features: [
      {
        key: 'lead_register',
        name: '고객·상담 등록',
        summary: '문의·상담 건을 등록·배정한다.',
        type: 'input_form',
        automationMode: 'manual_only',
        input: '고객·문의 내용',
        processing: '검증·개인정보 보호 처리 후 저장',
        processingKind: 'validate',
        output: '상담 건',
        defaultScope: 'must',
        usesAi: false,
        humanReviewRequired: false,
        expertJudgmentBoundary: false,
        entityKeys: ['lead'],
        rules: [
          { key: 'privacy_min', name: '개인정보 최소수집', type: 'permission', condition: '연락처 등 민감정보 접근 시', outcome: '권한 있는 역할만 조회하도록 제한한다', needsConfirmation: false },
        ],
      },
      {
        key: 'lead_pipeline',
        name: '영업 단계 관리',
        summary: '상담 건의 단계 전이를 관리한다.',
        type: 'status_tracking',
        automationMode: 'human_confirm',
        input: '상담 건',
        processing: '단계 전이 기록·후속 알림',
        processingKind: 'route_notify',
        output: '단계별 현황',
        defaultScope: 'should',
        usesAi: false,
        humanReviewRequired: false,
        expertJudgmentBoundary: false,
        entityKeys: ['lead'],
        rules: [
          { key: 'stage_flow', name: '단계 전이 규칙', type: 'lifecycle', condition: '이전 단계가 완료되면', outcome: '다음 단계로 이동 가능', needsConfirmation: false },
        ],
      },
    ],
  },
  data_collection_validation: {
    entities: [
      {
        key: 'record',
        name: 'DataRecord',
        label: '수집 데이터',
        description: '수집·검수 대상 데이터',
        fields: [
          ...RECORD_FIELDS,
          { name: 'value', label: '데이터 값', type: 'long_text', required: true, detail: '수집 항목값', sensitive: false, computedFrom: '' },
          { name: 'valid', label: '검수 결과', type: 'boolean', required: false, detail: '검증 통과 여부', sensitive: false, computedFrom: '검증 규칙' },
        ],
      },
    ],
    features: [
      {
        key: 'collect_form',
        name: '데이터 수집 입력',
        summary: '흩어진 데이터를 한 양식으로 수집한다.',
        type: 'input_form',
        automationMode: 'manual_only',
        input: '수집 항목값',
        processing: '표준 양식으로 저장',
        processingKind: 'store',
        output: '수집 데이터',
        defaultScope: 'must',
        usesAi: false,
        humanReviewRequired: false,
        expertJudgmentBoundary: false,
        entityKeys: ['record'],
        rules: [],
      },
      {
        key: 'validate_rule',
        name: '누락·오류 검수',
        summary: '규칙으로 누락·형식 오류를 검출한다.',
        type: 'data_validation',
        automationMode: 'full_auto',
        input: '수집 데이터',
        processing: '검증 규칙 적용·오류 표시',
        processingKind: 'validate',
        output: '검수 결과 + 오류 목록',
        defaultScope: 'must',
        usesAi: false,
        humanReviewRequired: false,
        expertJudgmentBoundary: false,
        entityKeys: ['record'],
        rules: [
          { key: 'format_check', name: '형식 검증 규칙', type: 'validation', condition: '값이 형식·범위를 벗어나면', outcome: '오류로 표시하고 사유를 남긴다', needsConfirmation: false },
          { key: 'missing_check', name: '누락 검증 규칙', type: 'validation', condition: '필수 항목이 비면', outcome: '누락으로 표시한다', needsConfirmation: false },
        ],
      },
    ],
  },
  approval_workflow: {
    entities: [
      {
        key: 'request',
        name: 'ApprovalRequest',
        label: '승인 요청',
        description: '요청·승인·반려·재제출 대상',
        fields: [
          ...RECORD_FIELDS,
          { name: 'requester', label: '요청자', type: 'reference', required: true, detail: '역할: 요청자', sensitive: false, computedFrom: '' },
          { name: 'approver', label: '승인자', type: 'reference', required: true, detail: '역할: 승인자', sensitive: false, computedFrom: '' },
          { name: 'decision', label: '처리 결과', type: 'enum', required: false, detail: '승인/반려/보류', sensitive: false, computedFrom: '' },
        ],
      },
    ],
    features: [
      {
        key: 'request_submit',
        name: '승인 요청 제출',
        summary: '요청 내용을 작성·제출한다.',
        type: 'input_form',
        automationMode: 'manual_only',
        input: '요청 내용',
        processing: '검증 후 승인자에게 라우팅',
        processingKind: 'route_notify',
        output: '승인 대기 요청',
        defaultScope: 'must',
        usesAi: false,
        humanReviewRequired: false,
        expertJudgmentBoundary: false,
        entityKeys: ['request'],
        rules: [
          { key: 'route_approver', name: '승인자 배정 규칙', type: 'routing', condition: '요청 유형·금액에 따라', outcome: '지정 승인자에게 배정한다', needsConfirmation: true },
        ],
      },
      {
        key: 'approve_decide',
        name: '승인·반려 처리',
        summary: '승인자가 승인·반려하고 사유를 남긴다.',
        type: 'approval_flow',
        automationMode: 'human_confirm',
        input: '승인 대기 요청',
        processing: '결정 기록·상태 전이·알림',
        processingKind: 'route_notify',
        output: '승인/반려 결과',
        defaultScope: 'must',
        usesAi: false,
        humanReviewRequired: true,
        expertJudgmentBoundary: false,
        entityKeys: ['request'],
        rules: [
          { key: 'resubmit', name: '반려 재제출 규칙', type: 'lifecycle', condition: '반려되면', outcome: '요청자에게 반환해 재제출 가능하게 한다', needsConfirmation: false },
        ],
      },
    ],
  },
}
