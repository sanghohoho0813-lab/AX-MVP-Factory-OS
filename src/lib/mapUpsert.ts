/**
 * PDF 그림 그리기(pdfjs 6)가 쓰는 새 함수(Map · WeakMap getOrInsertComputed)가 아직 없는 브라우저가 많다
 * (이 환경의 Chromium 도 없음 → 그림이 안 나왔다). 없을 때만 표준과 같은 동작으로 채운다.
 * D-255: 서류함 작은 그림만 채우고 있어서, 스캔 PDF 글자 인식(첫 장 그리기)은 그런 브라우저에서 아예 실패했다 — 둘 다 이걸 부른다.
 */
export function ensureMapUpsert() {
  for (const C of [Map, WeakMap]) {
    const proto = C.prototype as unknown as Record<string, unknown>
    if (typeof proto.getOrInsertComputed !== 'function') {
      Object.defineProperty(proto, 'getOrInsertComputed', {
        configurable: true,
        writable: true,
        value(this: Map<unknown, unknown>, key: unknown, make: (k: unknown) => unknown) {
          if (this.has(key)) return this.get(key)
          const v = make(key)
          this.set(key, v)
          return v
        },
      })
    }
    if (typeof proto.getOrInsert !== 'function') {
      Object.defineProperty(proto, 'getOrInsert', {
        configurable: true,
        writable: true,
        value(this: Map<unknown, unknown>, key: unknown, v: unknown) {
          if (!this.has(key)) this.set(key, v)
          return this.get(key)
        },
      })
    }
  }
}
