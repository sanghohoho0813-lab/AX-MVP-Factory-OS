/**
 * 개인정보·비밀 필터 — 프롬프트/맥락을 밖으로 내보내기 직전에 한 번 더 거른다 (Master K10).
 *
 * 무엇을 가리나 (결정론적 정규식)
 *   주민등록번호(######-#######), 계좌번호 표기, 비밀번호/PW 가 적힌 줄의 값, 인증서 비밀번호,
 *   API 키(sk-…, sb_secret_…, AKIA…, ghp_…, xoxb-…), 이메일, 휴대폰 번호.
 *   사업자등록번호(###-##-#####)와 법인등록번호는 회사 공개 정보라 가리지 않는다.
 *
 * 가린 자리에는 `[가림:종류]` 를 남겨 사람이 미리보기에서 알아볼 수 있게 한다.
 */

import type { PrivacyReport } from '../../types/consulting'

const RULES: { kind: keyof Omit<PrivacyReport, 'total'>; re: RegExp; label: string }[] = [
  // 주민등록번호 (뒷자리 첫 숫자 1~8). 사업자번호 ###-##-##### 와 모양이 달라 겹치지 않는다
  { kind: 'rrn', re: /\b\d{6}\s*-\s*[1-8]\d{6}\b/g, label: '주민번호' },
  // 계좌번호: "계좌" 낱말 뒤의 숫자·하이픈 묶음, 또는 10~14자리 하이픈 포함 숫자 (은행명 뒤)
  { kind: 'account', re: /(계좌(?:번호)?\s*[:：]?\s*)([0-9][0-9-]{8,20}[0-9])/g, label: '계좌번호' },
  { kind: 'account', re: /((?:국민|신한|우리|하나|농협|기업|카카오|토스|새마을|우체국|SC|씨티)\s*(?:은행)?\s*)([0-9][0-9-]{8,20}[0-9])/g, label: '계좌번호' },
  // 비밀번호 줄: "비밀번호: 값", "PW 값", "password=값", "인증서 비번 값"
  { kind: 'password', re: /((?:비밀번호|비번|패스워드|암호|인증서\s*(?:비밀번호|비번)|password|passwd|pwd|pw)\s*[:：=]?\s*)(\S+)/gi, label: '비밀번호' },
  // API 키·토큰
  { kind: 'secret', re: /\b(sk-[A-Za-z0-9_-]{8,}|sb_secret_[A-Za-z0-9_-]+|sb_publishable_[A-Za-z0-9_-]+|AKIA[0-9A-Z]{12,}|ghp_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})\b/g, label: 'API키' },
  { kind: 'secret', re: /((?:api[_ -]?key|secret|token|service_role)\s*[:：=]\s*)(\S+)/gi, label: 'API키' },
  // 이메일
  { kind: 'email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, label: '이메일' },
  // 휴대폰
  { kind: 'phone', re: /\b01[016789]\s*-?\s*\d{3,4}\s*-?\s*\d{4}\b/g, label: '휴대폰' },
]

export function emptyPrivacyReport(): PrivacyReport {
  return { rrn: 0, account: 0, password: 0, secret: 0, email: 0, phone: 0, total: 0 }
}

/** 텍스트에서 민감 값을 가리고 개수를 센다 */
/**
 * 법인등록번호(6-7자리)는 주민등록번호와 모양이 같다. "법인(등록)번호" 라벨이 앞에 붙은 것은
 * 회사 공개 정보이므로 잠시 하이픈을 바꿔 두었다가 필터가 끝난 뒤 되돌린다.
 */
const CORP_LABELLED = /(법인\s*(?:등록)?\s*(?:번호)?\s*[:：]?\s*)(\d{6})-(\d{7})/g
const KEEP = '⁠' // word joiner — 사용자 텍스트에 사실상 나오지 않는 문자

export function redactSensitive(text: string): { text: string; report: PrivacyReport } {
  const report = emptyPrivacyReport()
  let out = text.replace(CORP_LABELLED, (_m, label: string, a: string, b: string) => `${label}${a}${KEEP}${b}`)
  for (const rule of RULES) {
    out = out.replace(rule.re, (...args: unknown[]) => {
      report[rule.kind] += 1
      report.total += 1
      // 2-그룹 규칙은 앞 라벨을 남기고 값만 가린다
      const groups = args.slice(1, -2).filter((g) => typeof g === 'string') as string[]
      if (groups.length >= 2) return `${groups[0]}[가림:${rule.label}]`
      return `[가림:${rule.label}]`
    })
  }
  return { text: out.split(KEEP).join('-'), report }
}

/** 미리보기용 — 가린 종류별 한 줄 요약 */
export function privacySummary(r: PrivacyReport): string {
  if (r.total === 0) return '가린 항목 없음'
  const parts: string[] = []
  if (r.rrn) parts.push(`주민번호 ${r.rrn}`)
  if (r.account) parts.push(`계좌 ${r.account}`)
  if (r.password) parts.push(`비밀번호 ${r.password}`)
  if (r.secret) parts.push(`API 키 ${r.secret}`)
  if (r.email) parts.push(`이메일 ${r.email}`)
  if (r.phone) parts.push(`휴대폰 ${r.phone}`)
  return `${parts.join(' · ')} — 총 ${r.total}곳 가림`
}

export function mergeReports(a: PrivacyReport, b: PrivacyReport): PrivacyReport {
  return {
    rrn: a.rrn + b.rrn,
    account: a.account + b.account,
    password: a.password + b.password,
    secret: a.secret + b.secret,
    email: a.email + b.email,
    phone: a.phone + b.phone,
    total: a.total + b.total,
  }
}
