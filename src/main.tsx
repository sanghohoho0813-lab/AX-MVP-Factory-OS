import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installStaleChunkReload } from './lib/staleChunk'
import { installAutoLabel } from './lib/a11yAutoLabel'

// D-95: 배포 뒤 열려 있던 탭이 옛 화면 조각을 못 받으면 한 번만 새로고침한다
installStaleChunkReload()
// D-101: 옮겨 온 원본 모듈 화면의 이름 없는 칸·기호 단추에 읽는 이름을 붙인다
installAutoLabel()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
