/**
 * 홍보 글 → 대표 AI 전략실 자료로 보내기 (D-203 · 대표만).
 *
 * 새 AI 호출을 만들지 않는다 — 이미 있는 대표 전용 AI 전략실(D-200)의 '자료' 에 글을 한 장 넣고,
 * 대표가 거기서 '자유 AI 작업' 으로 다듬는다. 작업실이 없으면 업체 정보로 하나 만든다(ClientAiTab 과 같은 방식).
 * 넣는 글은 makeMaterial 이 주민번호 · 비밀번호 · 키 · 계좌 · 휴대폰을 지운 뒤 저장한다.
 */
import { makeMaterial, relationForClient, sameMaterial, withCaseActivity } from '../../services/ownerAi/caseUtil'
import type { OwnerAiRepo } from '../../services/ownerAi/repo'
import { patchCase, registerCase } from '../../services/ownerAi/workflow'
import type { ClientOpsRecord } from '../../types/clientOps'

export async function sendDraftToOwnerAi(
  repo: OwnerAiRepo,
  ident: { workspaceId: string | null; userId: string | null },
  record: ClientOpsRecord,
  title: string,
  text: string,
): Promise<{ caseId: string; added: boolean }> {
  const cases = await repo.listCases()
  let c = cases.find((x) => x.clientId === record.id && !x.archivedAt) ?? null
  if (!c) {
    c = await registerCase(repo, {
      companyName: record.companyName,
      bizNo: record.businessNumber,
      industry: record.industry,
      homepageUrl: record.homepage ?? '',
      relation: relationForClient(record),
      clientId: record.id,
      workspaceId: ident.workspaceId,
      userId: ident.userId,
    })
  }
  const at = new Date().toISOString()
  const m = makeMaterial({ kind: 'paste', title: `홍보 글 · ${title}`, text, source: '홍보 글 만들기' }, at)
  if (sameMaterial(c.materials, m)) return { caseId: c.id, added: false }
  const next = await patchCase(repo, c, (x) => withCaseActivity({ ...x, materials: [m, ...x.materials].slice(0, 200) }, `홍보 글 만들기에서 자료 1개 넣음 — ${title}`, at))
  return { caseId: next.id, added: true }
}
