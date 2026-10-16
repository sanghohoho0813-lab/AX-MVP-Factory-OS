# 식스샵 프로 분해 기록 (REA · 2026-10-16)

대표 지시: "rea 활용해서 sixshop.com 뜯어보고 내 OS 안에서도 활용할 수 있게."
이 문서는 **사실(무엇을 보았나)** 만 적는다. 식스샵의 코드 · 견본 · 문구 · 디자인은 가져오지 않았다 — 우리 OS 의
「홈페이지 만들기」(D-202)는 '블록으로 쌓는 페이지' 라는 생각만 빌려 새로 만들었다.

## 어떻게 보았나

| 무엇 | 방법 | 범위 |
|---|---|---|
| 고객이 만든 공개 사이트(`round-theme-calm.sixshop.site`) | 공개 JS 9개(4.7MB)를 내려받아 **REA `analyze-javascript-application`**(정적 · 실행 안 함) | REA Evidence `ev_3aba0402…958e` · 모듈 1,455 · AST 130만 노드 · 결과 '부분 커버리지'(노드 상한) |
| 같은 사이트의 HTML · 페이지 데이터 | 페이지에 실린 `__NEXT_DATA__` JSON 의 **칸 이름 · 모양만** 읽음(내용은 옮기지 않음) | 1 페이지 |
| 개발자 문서 · 기능 소개 · 요금 | 공개 페이지 61건을 차례로 읽음 | 로그인 · 가입 · 양식 제출 없음 |
| 실제 브라우저로 열어 오가는 요청 기록(REA `analyze-web-bundle`) | **못 함** — 작업 상자의 Chromium 이 망 프록시 인증서를 믿지 않음. 인증서 검사를 끄지 않았다 | — |
| 편집기(store.sixshop.com) | 보지 않음(로그인 필요) | — |

## 1. 기술 구조

- 홍보 사이트(sixshop.com): jQuery · require.js · GSAP — 판매용 소개 페이지.
- **고객 사이트(*.sixshop.site)**: Next.js(페이지 라우터) + `blockMaker.min.js`(블록 런타임) + Handlebars(블록 견본) + swiper/embla(슬라이드).
  - 첫 화면 HTML 에 사이트 전체 데이터가 실려 온다(`dehydratedState` 의 `website` · `page` · `website/settings`).
  - 라우트 수십 개: 상품 · 장바구니 · 결제 · 게시판 · 회원 · 쿠폰 · 마이페이지 …(빌드 매니페스트).

## 2. 데이터 모양(칸 이름만)

```
website.style
  property: color.colorScheme{1..n: background · text · accent}, typography{baseFontSize, body/heading font, page/section title}, layout.section.content.width,
            button{shape, style, color}, product, productBadge, round, animation, sns
  customCode{head, body} · globalSection{top[], bottom[], floating[]}      ← 머리 · 바닥 · 떠 있는 구역
page
  name · featureType · isHomepage · seo{slug, title, description, image, keywords, language, schemaMarkup, noindex} · property.scrollSnap{desktop, mobile}
  sections[]: {id, type, name, visibility{type:'DEVICE', device{mobile, desktop}, pages}, property{style, size, layout, spacing, menus}, blocks[]}
    blocks[]: {id, type, visibility, property{general{title, description, image, backgroundImage…}, section{bgColor, textColor, accentColor}, spacing{mobile, desktop},
               colorSchemeId, items[], contents…, app{name, component, icon, displayName}}, blocks[](안에 또 블록)}
website/settings
  websiteBasicInfo{websiteName, description, favicon, thumbnail} · websiteLegalInfo{businessName, representativeName, licenseNumber, personalInfoManagerName,
  reportNumber, phone, email, address1, address2} · terms[] · 분석 · 광고 픽셀 id · 소셜 로그인 · 적립금 규칙 …
```

## 3. 블록 런타임(REA 가 찾은 것)

- `BlockMaker` 클래스 — `init` · `apply` · `onReady` · `config` · `disconnectedCallback`(웹 컴포넌트 수명) · 비공개 메서드 40여 개.
- 상수: `BM_APPLY_LIMIT_PER_WINDOW` · `BM_APPLY_WINDOW_MS`(다시 그리기 횟수 제한) · `BM_USER_SCRIPT_WAIT_MS` · `BM_ERROR_LOG_LIMIT` · `DATA_TOKEN` ·
  `AUTH_ALLOWED_HOST_SUFFIXES` + `isAuthAllowedApiUrl`(블록이 부를 수 있는 주소 제한) · `reportBlockError`.
- 블록이 읽는 데이터: products · productDetail · categories · board · posts · reviews · search(키워드 · 태그 · 조회수/좋아요/날짜 범위) — `window.Storefront.get(store|product|catalog|category|board|post|review)`.
- 서버 주소 146개 중 대부분이 `/website/*`(장바구니 · 결제 · 주문 · 반품 · 후기 · 게시글 · 회원 · 등급 · 쿠폰 · 적립금 · 문의 · sitemap) + 카카오싱크 · 네이버 · 애플 로그인.
- 브라우저 저장: localStorage `sixshop-user-info` · sessionStorage `custom-checkout` · `boardWriteFromList` · `guestPostModifyContext` · IndexedDB · 서비스 워커.

## 4. 공개 문서로 본 것(요약)

- 블록 = 파일 하나에 `<style>` · `<template>`(Handlebars 일부 + 헬퍼 60개쯤) · `<script>`. 설정 칸 20종(글 · 긴 글 · 서식 글 · 범위 · 체크 · 라디오 · 고르기 ·
  색 · 그림 · 영상 · 파일 · 목록(2단) · 링크 · 메뉴(3단) · 상품 · 상품 상세 · 분류 · 게시판 · 글 · 후기).
- 블록 API `bm`: container · context · onContextChange · onDestroy · apply · config · call(HTTP) · do(이동 · 알림 · 창 · 주소 찾기 · 로그인 …).
- AI: 글 · 사진 · 피그마 · HTML · 다른 사이트 주소로 페이지 · 블록 만들기 / 운영 에이전트 / MCP 도구 54개(블록 · 테마 · 페이지 · 구역 · 상품 · 주문 · 사용자 DB).
- 요금(월 · 연간 결제): 무료 0원 · 홈페이지 12,300원 · 쇼핑몰 21,800원.

## 5. 우리 OS 에 들인 것 · 들이지 않은 것

| 식스샵 | 우리 OS(D-202 홈페이지 만들기) |
|---|---|
| 페이지 = 구역 · 블록을 쌓음, 블록마다 설정 칸 | 같은 생각 — 블록 12종 · 칸 정의(글 · 긴 글 · 고르기 · 켜고 끄기 · 그림 · 목록) |
| 색 묶음 · 글꼴 · 단추 모양을 사이트에 하나 | 색 6 · 글꼴 2 · 모서리 3(대비 기준을 시험으로 잼) |
| 블록마다 PC · 휴대폰 보이기 | 같음(hide-pc · hide-m) |
| 사업자 정보(websiteLegalInfo) | **업체 기록에서 자동** — 상호 · 대표 · 사업자등록번호 · 주소 · 대표 전화 · 메일 |
| AI 로 페이지 만들기 | 들이지 않음(규칙: LLM 호출 0) — 대신 **업종 견본 9 + 업체 기록**으로 초안, 견본 문구는 '확인' 표시 |
| 블록 안 자바스크립트 · 외부 호출 | 들이지 않음 — 만든 HTML 에 스크립트 0(안전 · 어디에 올려도 됨) |
| 호스팅 · 도메인 · 쇼핑몰 · 결제 | 들이지 않음 — HTML 한 장 내려받기(1단계) |

다음 후보: 공개 주소로 게시(+ 사이트 상담 신청 → 상담신청함) · 대표 전용 AI 작업실로 문구 초안(서버 함수 · 대표만) · 블록 더(지도 그림 · 갤러리 · 후기).
