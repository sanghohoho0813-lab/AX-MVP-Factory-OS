/**
 * 동기 Repository 를 비동기(Promise 반환) 인터페이스로 감싸는 유틸리티.
 *
 * local 데이터 모드에서는 실제 저장이 동기(localStorage)지만, UI·서비스 계층은
 * supabase 모드와 동일한 비동기 계약으로 접근한다. 이렇게 하면 모드가 바뀌어도
 * 호출부를 바꿀 필요가 없다. (실제 네트워크 저장은 supabase 어댑터에서 비동기로 수행)
 */

/** 함수형 멤버의 반환값을 Promise 로 바꾼 타입 */
export type Asyncify<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : T[K]
}

/**
 * 객체의 모든 메서드를 Promise 반환형으로 감싼 Proxy 를 만든다.
 * 동기 예외도 rejected Promise 로 정규화한다.
 */
export function asyncify<T extends object>(target: T): Asyncify<T> {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver)
      if (typeof value === 'function') {
        return (...args: unknown[]): Promise<unknown> => {
          try {
            return Promise.resolve((value as (...a: unknown[]) => unknown).apply(obj, args))
          } catch (err) {
            return Promise.reject(err)
          }
        }
      }
      return value
    },
  }) as unknown as Asyncify<T>
}
