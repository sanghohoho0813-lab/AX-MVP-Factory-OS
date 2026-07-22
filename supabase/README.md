# Supabase (Stage 12A)

Stage 1~11 의 localStorage 데모 구조를 워크스페이스 단위 클라우드 저장으로
옮기기 위한 **DB·인증·RLS 기반**입니다. 이 디렉터리는 SQL 마이그레이션과
테스트만 포함하며, 애플리케이션 코드는 `src/` 에 있습니다.

## 검증 상태 (중요)

- 이 저장소에는 **실제 Supabase 연결 정보(.env)가 없습니다.** 따라서 아래 SQL/RLS/RPC는
  **로컬 또는 원격 Supabase 인스턴스에서 아직 런타임 검증되지 않았습니다.**
- `local` 데이터 모드(기본값)에서 Stage 1~11 기능은 기존과 동일하게 동작하며 회귀 검증됩니다.
- `supabase` 모드는 아래 절차로 프로젝트를 연결한 뒤에만 실제로 검증할 수 있습니다.
- 연결 전에는 "실제 Supabase 검증 완료" 라고 보고하지 않습니다.

## 구성

| 파일 | 내용 |
| --- | --- |
| `config.toml` | 로컬 Supabase CLI 설정(비밀값 아님) |
| `migrations/20260721000001_stage12a_base.sql` | 프로필·워크스페이스·멤버십·초대·UI설정 + 30개 도메인 테이블 |
| `migrations/20260721000002_stage12a_rls.sql` | 멤버십 헬퍼, 신규가입 트리거, 워크스페이스/초대 RPC, RLS 정책 |
| `migrations/20260721000003_stage12a_public_rpc.sql` | 공개 설문/로컬테스트 토큰 RPC (해시 조회, 렌더 필드만 반환) |
| `migrations/20260721000004_stage12a_audit.sql` | 감사 로그, 로컬 데이터 가져오기 작업/항목 |
| `seed.sql` | 최소 시드(비밀 계정 생성 안 함) |
| `tests/rls_test.sql` | pgTAP RLS 격리·권한·공개토큰 회귀 테스트 |

## 보안 원칙 (코드로 강제)

- 브라우저에는 **anon key만** 사용합니다. `service_role` 키는 프런트엔드에 넣지 않습니다.
  (`src/data/dataMode.ts` 가 anon 자리 service_role 키를 감지해 차단)
- **비밀값은 Git 에 커밋하지 않습니다.** `.env*` 는 `.gitignore` 에 있고, `.env.example` 만 커밋합니다.
- **RLS 로 격리**합니다. 클라이언트 필터로 대체하지 않습니다. 모든 도메인 테이블에
  `enable/force row level security` + 멤버십 정책이 있습니다.
- "모든 authenticated 전체 SELECT" 정책은 없습니다.
- 공개 토큰 **원문은 저장하지 않고** sha256 해시만 저장합니다. 공개 RPC 는 토큰이 가리키는
  한 행/한 워크스페이스 범위에서만 동작하며, 렌더링에 필요한 필드만 반환합니다.

## 로컬 실행 절차

```bash
# 1) Supabase CLI 로컬 스택 시작
supabase start

# 2) 마이그레이션 적용 (config/migrations 자동 인식)
supabase db reset          # 로컬 개발 DB 를 마이그레이션+seed 로 재구성

# 3) RLS 테스트
supabase test db

# 4) 앱 연결: .env.local 작성 (예시는 .env.example)
#    VITE_DATA_MODE=supabase
#    VITE_SUPABASE_URL=... (로컬: http://localhost:54321)
#    VITE_SUPABASE_ANON_KEY=... (supabase start 출력의 anon key)
npm run dev
```

## 원격(클라우드) 연결

```bash
supabase link --project-ref <your-project-ref>
supabase db push            # 마이그레이션을 원격에 적용 (기존 객체 DROP 하지 않음)
```

원격 배포 시 anon key / URL 은 배포 환경 변수로만 주입하고 저장소에 커밋하지 않습니다.
