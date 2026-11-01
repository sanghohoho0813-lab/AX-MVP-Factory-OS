/**
 * D-479 한글 이름순 비교 — `a.localeCompare(b, 'ko')` 와 순서가 같다(표준이 같은 비교기로 정해 둠).
 * localeCompare 에 'ko' 를 주면 비교할 때마다 비교기를 새로 만들어, 업체 1,000곳 · 확인할 것 5,000건 정렬이 수십 배 느렸다.
 */
export const koCompare: (a: string, b: string) => number = new Intl.Collator('ko').compare
