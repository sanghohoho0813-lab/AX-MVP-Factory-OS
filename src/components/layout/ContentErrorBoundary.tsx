/**
 * 본문 오류 울타리 (D-95).
 *
 * 한 화면(특히 원본에서 옮겨 온 큰 모듈 화면)이 그리다 넘어져도 OS 전체가 하얘지지 않게 한다.
 * 사이드바·머리줄은 그대로 남고, 본문 자리에만 "이 화면을 여는 중 문제가 생겼습니다" 가 선다.
 * 다른 화면으로 옮기면(resetKey 가 바뀌면) 저절로 풀린다. 배포 뒤 옛 조각 오류면 한 번 새로고침한다.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isStaleChunkError, reloadOnceForNewVersion } from '../../lib/staleChunk'
import { ErrorPanel } from './ErrorPanel'

interface Props {
  resetKey: string
  children: ReactNode
}
interface State {
  error: unknown
  key: string
}

export class ContentErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // 다른 화면으로 옮기면 오류를 내려놓는다
    if (props.resetKey !== state.key) return { key: props.resetKey, error: null }
    return null
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[화면 오류]', error, info.componentStack)
    if (isStaleChunkError(error)) reloadOnceForNewVersion()
  }

  render() {
    if (this.state.error === null) return this.props.children
    return <ErrorPanel error={this.state.error} onRetry={() => this.setState({ error: null })} />
  }
}
