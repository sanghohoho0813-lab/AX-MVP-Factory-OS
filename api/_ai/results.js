/**
 * D-638 AI 답 보관(0030 ai_assist_results) — 한 번 누른 요청은 화면을 떠나도 · 휴대폰이 다른 앱으로 가도 답을 다시 받는다.
 *
 *  - 서버 함수가 답을 만든 직후 그 사람 로그인(JWT)으로 한 줄 넣는다(service_role 키 없음 · anon 키 + 그 사람 로그인만).
 *  - 같은 요청 번호로 다시 오면(화면이 '다시 받기' 로 물음) 이 줄을 먼저 본다 — 있으면 AI 를 다시 부르지 않는다(사용량도 안 셈).
 *  - 표가 없는 운영(0030 적용 전) · DB 가 늦을 때는 조용히 넘어간다 — 예전처럼 서버 기억(같은 서버 15분)만으로 돈다.
 *  - 답이 256KB 를 넘으면 '보낸 자료(sent)' 칸을 빼고 넣는다(표가 큰 답을 막는다).
 */

const SUPA_URL_NAMES = ['SUPABASE_URL', 'VITE_SUPABASE_URL']
const SUPA_ANON_NAMES = ['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']
const TIMEOUT_MS = 3000
const MAX_BYTES = 240_000
const ID_RE = /^[A-Za-z0-9_-]{8,80}$/

function envAny(names) {
  for (const n of names) {
    const v = process.env[n]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function target() {
  const base = envAny(SUPA_URL_NAMES).replace(/\/+$/, '')
  const anon = envAny(SUPA_ANON_NAMES)
  return base && anon ? { base, anon } : null
}

async function call(url, init) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 보관할 모양 — 너무 크면 보낸 자료(sent)를 빼고, 그래도 크면 원문(raw)도 뺀다 */
export function storableRun(run) {
  if (!run || typeof run !== 'object') return null
  const size = (v) => Buffer.byteLength(JSON.stringify(v), 'utf8')
  if (size(run) <= MAX_BYTES) return run
  const lean = { ...run, sent: null }
  if (size(lean) <= MAX_BYTES) return lean
  const leaner = { ...lean, raw: '' }
  return size(leaner) <= MAX_BYTES ? leaner : null
}

/** 답 넣기 — 성공하면 true. 표가 없거나 이미 있거나 실패하면 false(조용히) */
export async function saveResult(token, { requestId, assistId, run }) {
  const t = target()
  if (!t || !token || !ID_RE.test(String(requestId || ''))) return false
  const body = storableRun(run)
  if (!body) return false
  const r = await call(`${t.base}/rest/v1/ai_assist_results`, {
    method: 'POST',
    headers: { apikey: t.anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({ request_id: requestId, assist_id: assistId, run: body }),
  })
  return !!r && (r.status === 201 || r.status === 200 || r.status === 204)
}

/** 보관된 답 — { assistId, run } 또는 null(없음 · 표 없음 · 실패) */
export async function loadResult(token, requestId) {
  const t = target()
  if (!t || !token || !ID_RE.test(String(requestId || ''))) return null
  const r = await call(`${t.base}/rest/v1/ai_assist_results?request_id=eq.${encodeURIComponent(requestId)}&select=assist_id,run&limit=1`, {
    headers: { apikey: t.anon, Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!r || r.status !== 200) return null
  try {
    const rows = await r.json()
    const row = Array.isArray(rows) ? rows[0] : null
    return row && row.run && typeof row.run === 'object' ? { assistId: String(row.assist_id || ''), run: row.run } : null
  } catch {
    return null
  }
}
