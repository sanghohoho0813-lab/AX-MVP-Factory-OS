import {
  BarChart3,
  Building2,
  ClipboardList,
  Filter,
  FolderOpen,
  Home,
  Palette,
  PencilRuler,
  SearchCheck,
  Settings,
} from 'lucide-react'
import type { NavigationItem } from '../types'

export const APP_VERSION = 'v0.1.0'

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { key: 'home', label: '홈', path: '/', icon: Home },
  { key: 'diagnosis', label: '진단 스튜디오', path: '/diagnosis', icon: ClipboardList },
  { key: 'selection', label: '과제선별', path: '/selection', icon: Filter },
  { key: 'mvp-design', label: 'MVP 설계', path: '/mvp-design', icon: PencilRuler },
  { key: 'website-studio', label: '웹사이트 스튜디오', path: '/website-studio', icon: Palette },
  { key: 'validation', label: '현장검증', path: '/validation', icon: SearchCheck },
  { key: 'deliverables', label: '자료 패키지', path: '/deliverables', icon: FolderOpen },
  { key: 'clients', label: '고객사', path: '/clients', icon: Building2 },
  { key: 'reports', label: '리포트', path: '/reports', icon: BarChart3 },
  { key: 'settings', label: '설정', path: '/settings', icon: Settings },
]
