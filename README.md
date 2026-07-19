# AX MVP Factory OS

업종 맞춤형 AX MVP 설계·제작 운영 시스템 — 내부 운영 OS (SaaS 아님)

> ⚠️ 이 프로젝트는 미래 AI 랩 쇼핑몰과 완전히 분리되어 있습니다.
> 쇼핑몰의 Supabase·인증·상품·결제·고객 데이터에 절대 연결하지 마세요.

## 현재 상태: S1 — 기반 구축

- owner 로그인, 고객사·프로젝트 관리, Stage 0~7 / MVP Level 0~5, 대시보드
- 다음 스프린트: S2 설문 시스템 → S3 판정 → S4 Stage-Gate 심화 → S5 산출물 → S6 데이터

## 실행 방법

```bash
npm install
cp .env.example .env   # Supabase URL/키 입력
npm run dev            # 개발 서버
npm run build          # 타입체크 + 프로덕션 빌드
```

Supabase 없이 UI만 볼 때(개발 전용): `.env` 에 `VITE_DEV_MOCK=1` — 데이터는 메모리에만 존재.

## 최초 1회 설정 (대표님이 직접)

1. https://supabase.com 에서 **새 프로젝트** 생성 (쇼핑몰 프로젝트와 별개!)
2. SQL Editor 에서 `supabase/migrations/001_s1_foundation.sql` 전체 실행
3. Authentication → Users → **Add user** 로 owner 계정(이메일/비밀번호) 생성
   - 첫 번째로 생성된 계정이 자동으로 owner 역할이 됩니다
4. Project Settings → API 에서 URL 과 anon key 를 복사해 `.env` 에 입력

## 마이그레이션 규칙

`supabase/migrations/` 안의 파일을 **번호 순서대로** SQL Editor 에서 실행합니다.
모든 파일은 재실행 안전(idempotent)하게 작성합니다.

## 구조

```
src/lib/types.ts    도메인 타입·상수 (Stage 0~7 ≠ Level 0~5)
src/lib/repo.ts     데이터 접근 계층 (Supabase + 개발용 목)
src/lib/auth.tsx    인증 컨텍스트 (owner, staff 예약)
src/components/     AppShell(사이드바·하단내비), ui(배지·버튼·폼)
src/pages/          Login / Dashboard / Companies / Projects / Settings
supabase/migrations 001_s1_foundation.sql
docs/               제품 설계안
```
