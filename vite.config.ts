import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * L-9 · D-609 상담 신청 공개 화면(/ask/<12자리>) 전용 첫 쪽 — 빌드가 끝나면 index.html 을 그대로 복사해 머리말만 바꾼 ask.html 을 둔다.
 * 컨설턴트가 글 끝 · 프로필에 붙인 주소를 카카오톡 · 스레드가 미리보기로 읽을 때 OS 이름 · 로고 대신 '상담 신청' 으로 뜨게(vercel.json 이 /ask/* 를 이 파일로).
 * 앱 스크립트 · 조각은 index.html 과 똑같다 — Vite 입구를 둘로 나누면 로그인 화면 첫 조각이 커져서(D-590) 빌드 뒤 복사로 만든다.
 * 하나라도 못 바꾸거나 OS 이름이 남으면 빌드를 멈춘다(OS 이름이 남은 채로 나가지 않게).
 */
const ASK_DESC = '이름과 연락처를 남겨 주시면 연락드려요. 1분이면 돼요.'
const ASK_STEPS: Array<[string, RegExp, string]> = [
  ['아이콘', /<link rel="icon"[^>]*>/, '<link rel="icon" href="data:," />'],
  ['홈 화면 아이콘', /\s*<link rel="apple-touch-icon"[^>]*>/, ''],
  ['홈 화면 넣기', /\s*<link rel="manifest"[^>]*>/, ''],
  ['홈 화면 이름', /\s*<meta name="apple-mobile-web-app-title"[^>]*>/, ''],
  ['설명', /<meta name="description"[^>]*>/, `<meta name="description" content="${ASK_DESC}" />\n    <meta name="robots" content="noindex" />`],
  ['미리보기 제목', /<meta property="og:title"[^>]*>/, '<meta property="og:title" content="상담 신청" />'],
  ['미리보기 설명', /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${ASK_DESC}" />`],
  ['미리보기 그림', /(\s*<meta property="og:image[^>]*>)+/, ''],
  ['카드 모양', /<meta name="twitter:card"[^>]*>/, '<meta name="twitter:card" content="summary" />'],
  ['탭 제목', /<title>[^<]*<\/title>/, '<title>상담 신청</title>'],
  ['로고', /\s*<img class="boot-mark"[^>]*>/, ''],
  ['OS 이름', /\s*<p class="boot-name">[^<]*<\/p>/, ''],
  ['불러오는 중', /<p class="boot-msg">[^<]*<\/p>/, '<p class="boot-msg">상담 신청 화면을 여는 중…</p>'],
]

export function makeAskHtml(indexHtml: string): string {
  let out = indexHtml
  for (const [what, find, to] of ASK_STEPS) {
    if (!find.test(out)) throw new Error(`ask.html: '${what}' 줄을 index.html 에서 찾지 못했어요 — index.html 모양이 바뀌었는지 보세요.`)
    out = out.replace(find, to)
  }
  // HTML 주석 안의 OS 이름 · 결정 번호도 빼 둔다(소스 보기에 남지 않게)
  out = out.replace(/<!--[\s\S]*?-->/g, '')
  const left = ['MIRAE AI LAB', '미래AI랩', '미래에이아이랩', 'og-image', 'manifest.webmanifest'].filter((w) => out.includes(w))
  if (left.length) throw new Error(`ask.html: OS 이름이 남았어요(${left.join(', ')}).`)
  if (!out.includes('type="module"')) throw new Error('ask.html: 앱 스크립트 줄이 없어요.')
  return out
}

function askHtml(): Plugin {
  let outDir = 'dist'
  return {
    name: 'ask-html',
    apply: 'build',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir)
    },
    writeBundle(options) {
      const dir = options.dir ?? outDir
      const index = join(dir, 'index.html')
      if (!existsSync(index)) return
      writeFileSync(join(dir, 'ask.html'), makeAskHtml(readFileSync(index, 'utf8')))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), askHtml()],
})
