/**
 * 기업마당 받아오기 줄 (D-143) — 몇 건 · 언제 받았나 · 다음 자동 갱신 · [지금 새로 가져오기].
 * 못 받았을 때는 이유를 쉬운 말로 — 화면은 지난번 받은 공고 · 직접 넣은 공고로 그대로 돈다.
 */
import { RefreshCw } from 'lucide-react'
import { Button } from '../ui/Button'
import { nextRefreshText, type FeedState } from '../../services/grants/grantFeed'

function whenText(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const k = new Date(t + 9 * 3600_000)
  const h = k.getUTCHours()
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(k.getUTCMinutes()).padStart(2, '0')}`
}

export function GrantFeedBar({ feed, onRefresh }: { feed: FeedState; onRefresh: () => void }) {
  const loading = feed.status === 'loading' || feed.status === 'idle'
  const bad = feed.status === 'error' || feed.status === 'no_key' || feed.status === 'unavailable'
  return (
    <section
      aria-label="기업마당 공고 받아오기"
      data-testid="grant-feed"
      data-status={feed.status}
      className="flex flex-row items-center gap-3 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-2.5 sm:gap-4 sm:px-5 sm:py-3"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="t-body break-keep font-semibold text-slate-900" data-testid="grant-feed-count">
          {loading && feed.count === 0 ? '기업마당 공고를 받아 오는 중…' : feed.count > 0 ? `기업마당 공고 ${feed.count.toLocaleString()}건` : '기업마당 공고 아직 없음'}
        </p>
        {/* D-166: 휴대폰은 언제 받았는지만 — 자동 갱신 설명은 넓은 화면에서 */}
        <p className="t-sub break-keep text-slate-500">
          {feed.fetchedAt ? `${whenText(feed.fetchedAt)}에 받음` : ''}
          <span className="max-sm:hidden">{feed.fetchedAt ? ' · ' : ''}매일 아침 9시에 저절로 새로 받아요 (다음: {nextRefreshText()})</span>
        </p>
        {bad && feed.message && (
          <p role="status" className="t-sub break-keep text-warning-800 [overflow-wrap:anywhere]" data-testid="grant-feed-message">
            {feed.message}
          </p>
        )}
      </div>
      <Button variant="secondary" onClick={onRefresh} disabled={feed.status === 'loading'} data-testid="grant-feed-refresh" aria-label={feed.status === 'loading' ? '받는 중' : '지금 새로 가져오기'}>
        <RefreshCw aria-hidden="true" className={`size-4 ${feed.status === 'loading' ? 'animate-spin' : ''}`} />
        <span className="max-sm:hidden">{feed.status === 'loading' ? '받는 중…' : '지금 새로 가져오기'}</span>
        <span className="sm:hidden">{feed.status === 'loading' ? '받는 중' : '새로'}</span>
      </Button>
    </section>
  )
}
