/** 현장 검증 감사표(QA 전용 — 화면에 없음). 실행: npx vite build --config vite.certaudit.config.mjs && node .cert-out/audit.mjs */
import { assessAll } from '../core/assess'
import { RECOMMENDATION_LABEL, READINESS_LABEL } from '../core/types'
import { FIELD_COS } from './fieldFixtures'

for (const [k, c] of Object.entries(FIELD_COS)) {
  console.log(`\n=== ${k} ${c.companyName}`)
  for (const a of assessAll(c)) console.log(`${a.label.padEnd(8)} | ${RECOMMENDATION_LABEL[a.recommendation].padEnd(10)} | ${READINESS_LABEL[a.readiness].padEnd(8)} | ${a.oneLine} | ${a.reasons.map((r) => (r.state === 'ok' ? '✓' : r.state === 'warn' ? '△' : r.state === 'no' ? '✗' : '?') + r.text).join(' / ')} | 자료 ${a.haveEvidence.length}/${a.haveEvidence.length + a.missingEvidence.length}`)
}

import { buildInspectionPackage, inspectionPackageText, ownerQuestionMessage } from '../core/inspectionPackage'
import { buildSubmitGate, missingDocsRequest, submissionDocs } from '../core/submitGate'
import { buildClientSummary, clientSummaryText } from '../core/clientSummary'
import { buildRoadmap } from '../core/roadmap'
import { handoffText, inspectionHandoff } from '../core/handoff'
import { explainFor } from '../core/explain'
import { runSelfCheck } from '../core/selfCheck'
import { INNOBIZ_BANK } from '../innobiz/innobizGuides'
import { MAINBIZ_BANK } from '../mainbiz/mainbizGuides'
import { INNOBIZ_CHECK } from '../innobiz/innobizCheck'
import { MAINBIZ_CHECK } from '../mainbiz/mainbizCheck'
import { CERT_RULES } from '../rules/officialRules'

const label = (id: string) => Object.values(CERT_RULES).flatMap((r) => r.evidence).find((e) => e.id === id)?.label ?? id
for (const [k, c, cert] of [['A', FIELD_COS.A, 'innobiz'], ['B', FIELD_COS.B, 'mainbiz'], ['C', FIELD_COS.C, 'innobiz'], ['D', FIELD_COS.D, 'mainbiz']] as const) {
  const bank = cert === 'innobiz' ? INNOBIZ_BANK : MAINBIZ_BANK
  const sc = cert === 'innobiz' ? INNOBIZ_CHECK : MAINBIZ_CHECK
  const pkg = buildInspectionPackage({ cert, bank, selfCheck: sc, answers: {}, ctx: c, prep: {}, labelOf: label })
  console.log(`\n################ ${k} ${c.companyName} — ${cert} 패키지\n` + inspectionPackageText(pkg))
  console.log('\n--- 대표 질문 문구\n' + ownerQuestionMessage(c.companyName, CERT_RULES[cert].label, pkg.ownerQuestions, '미래경영 김상호 대표'))
  console.log('\n--- 자료 요청\n' + missingDocsRequest(c.companyName, cert, submissionDocs(cert, c), '미래경영 김상호 대표'))
  const gate = buildSubmitGate({ cert, ctx: c, selfCheck: sc, answers: {}, pkg })
  console.log('\n--- 제출 전 확인: ' + gate.verdict + '\n' + gate.items.map((x) => (x.ok ? '✓ ' : '△ ') + x.text).join('\n'))
  const all = assessAll(c)
  console.log('\n--- 30초 설명\n' + explainFor(all.find((a) => a.key === cert)!, c, '김상호 대표').thirty)
  console.log('\n--- 고객 요약\n' + clientSummaryText(buildClientSummary(all, c, buildRoadmap(all, c)), '미래경영 김상호 대표'))
  const h = handoffText(inspectionHandoff(pkg, all.find((a) => a.key === cert)!, runSelfCheck(sc, c, {})))
  console.log(`\n--- AI 묶음 ${h.length}자 ${h.split('\n').length}줄`)
}
