/**
 * D-499 오늘 대화창 [맞춤 진단서] → 그 업체 화면에서 진단서를 바로 연다.
 * 주소(?diag=1)는 업체 화면이 탭을 맞추며 지워 버려서, 화면 사이 메모리에 30초 동안 '열어 줘' 를 남긴다(닫으면 지움 · 탭이 다시 그려져도 다시 열림).
 */
let req: { id: string; at: number } | null = null
export const DIAG_REQUEST_TTL_MS = 30_000

export function requestDiagnosis(clientId: string): void {
  req = { id: clientId, at: Date.now() }
}
export function diagnosisRequested(clientId: string, now = Date.now()): boolean {
  return !!req && req.id === clientId && now - req.at <= DIAG_REQUEST_TTL_MS
}
export function clearDiagnosisRequest(): void {
  req = null
}
