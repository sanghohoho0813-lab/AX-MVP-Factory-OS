/**
 * 저장 직렬화 큐 (Stage 12C).
 * - enqueue 순서대로만 실행 → 느린 이전 저장이 빠른 최신 저장을 덮어쓰는 순서 역전 방지.
 * - 단조 증가 seq → 더 최신 요청이 대기 중이면 오래된 비최종 요청을 건너뛸 수 있음(중복 방지).
 * - close() 이후에는 새 작업이 실행되지 않음 → submitted 이후 draft 저장 차단.
 * UI 와 무관한 순수 로직이라 mock 없이 단위 테스트가 가능하다.
 */

export interface SerialSaveQueue {
  /** 새 저장 요청 번호 발급 (단조 증가) */
  nextSeq(): number
  /** 현재 최신 요청 번호 */
  currentSeq(): number
  /** 제출 완료 등으로 큐를 닫는다 — 이후 enqueue 작업은 실행되지 않는다 */
  close(): void
  isClosed(): boolean
  /** 작업을 직렬로 실행한다. 이전 작업의 성공·실패와 무관하게 순서는 보존된다. */
  enqueue(run: () => Promise<void>): Promise<void>
}

export function createSerialSaveQueue(): SerialSaveQueue {
  let chain: Promise<void> = Promise.resolve()
  let seq = 0
  let closed = false
  return {
    nextSeq: () => ++seq,
    currentSeq: () => seq,
    close: () => {
      closed = true
    },
    isClosed: () => closed,
    enqueue(run: () => Promise<void>): Promise<void> {
      const guarded = async () => {
        if (closed) return
        await run()
      }
      const p = chain.then(guarded, guarded)
      chain = p.catch(() => {})
      return p
    },
  }
}
