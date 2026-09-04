import { useState } from 'react'
import { brand } from '../../brand/brand.config'

/**
 * 브랜드 로고 — 밝은 배경(tone=light)과 어두운 배경(tone=dark)용 이미지를 고른다.
 * 이미지 로드에 실패하면 글자 로고로 대체해 빈 칸이 생기지 않게 한다.
 * 링크·클릭 동작은 부모가 감싸서 처리한다(여기서는 그리기만).
 */
export function BrandLogo({
  tone = 'light',
  className = '',
  imgClassName = '',
}: {
  tone?: 'light' | 'dark'
  className?: string
  imgClassName?: string
}) {
  const [failed, setFailed] = useState(false)
  const src = tone === 'dark' ? brand.logoDark : brand.logoLight

  if (failed) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <span
          aria-hidden="true"
          className={`grid size-8 shrink-0 place-items-center rounded-lg text-[0.8rem] font-black ${
            tone === 'dark' ? 'bg-white/10 text-white' : 'bg-navy-900 text-white'
          }`}
        >
          M
        </span>
        <span className={`whitespace-nowrap text-[1rem] font-bold ${tone === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          {brand.brandNameKo}
        </span>
      </span>
    )
  }

  return (
    <span className={`inline-flex min-w-0 items-center ${className}`}>
      <img
        src={src}
        alt={brand.logoAlt}
        width={brand.logoSize.width}
        height={brand.logoSize.height}
        decoding="async"
        onError={() => setFailed(true)}
        className={`block h-9 w-auto max-w-[180px] object-contain ${imgClassName}`}
      />
    </span>
  )
}

/** 로고 옆이나 아래에 두는 제품명 — 로고 자체에는 제품명이 없으므로 따로 그린다 */
export function ProductWordmark({ tone = 'light', className = '' }: { tone?: 'light' | 'dark'; className?: string }) {
  return (
    <span className={`block leading-tight ${className}`}>
      <span className={`block text-[0.95rem] font-bold ${tone === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        {brand.productName}
      </span>
      <span className={`block text-[0.72rem] font-medium tracking-wide ${tone === 'dark' ? 'text-navy-300' : 'text-slate-500'}`}>
        {brand.productSubtitle}
      </span>
    </span>
  )
}
