# AX MVP Factory OS

중소기업의 업무·데이터 상태를 진단하고, 구축 가치가 높은 AX 과제를 선별하며,
적정 MVP 범위 설계 → 현장검증 → 자금조달 자료화까지 관리하는 내부 운영 시스템입니다.

## 현재 단계

**1단계 / 12단계 — 기반·디자인 시스템·레이아웃·메인 대시보드**

- 전체 애플리케이션 셸 (반응형 사이드바 + 상단 헤더)
- 공통 디자인 토큰 (`src/index.css`의 `@theme`)
- 전체 메뉴 라우팅 (홈 외 메뉴는 빈 상태 안내 페이지)
- 메인 대시보드: KPI 스트립 · 주간 운영 타임라인 · 오늘의 우선순위 · 고객사 포트폴리오 건강도
- 타입 안전한 로컬 데모 데이터 (`src/data/`) — 아직 DB(Supabase) 미연결

## 기술 스택

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4 (`@tailwindcss/vite`)
- React Router 7
- Lucide React (아이콘)

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 타입 검사 + 프로덕션 빌드
npm run lint     # oxlint
npm run preview  # 빌드 결과 미리보기
```

## 구조

```
src/
  components/
    layout/      AppShell, Sidebar, Header
    dashboard/   MetricStrip, WeeklyTimeline, PriorityList, PortfolioHealth
    ui/          Button, StatusBadge, ProgressBar, SearchInput, PageHeader, Modal, Toast
  data/          navigation, demo(데모 데이터), modules(빈 상태 페이지 정의)
  lib/           statusMeta(상태 색·라벨 매핑), useDismissable
  pages/         DashboardPage, EmptyModulePage
  types/         공용 타입 정의
```
