import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installStaleChunkReload } from './lib/staleChunk'

// D-95: 배포 뒤 열려 있던 탭이 옛 화면 조각을 못 받으면 한 번만 새로고침한다
installStaleChunkReload()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
