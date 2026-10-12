# 안내 영상 (D-185) — 만드는 법

최은혜 팀장님용 안내 영상 1편 · 2편을 **가로(16:9) · 세로(9:16)** 두 벌씩 만든다.
대본 음성(TTS 원본)은 저장소에 넣지 않는다 — 아래 순서로 다시 만들 수 있게 도구만 둔다.

1. 음성 — `ffmpeg atempo=1.1` → `audio/tighten.py`(문장 사이 쉼 줄이기) → 2-pass loudnorm −14 LUFS
2. 받아쓰기 — `audio/asr.py`(faster-whisper large-v3, 단어 시각) → 손으로 고친 대본 `chunks_<k>.txt`
3. 자막 시각 — `subs.py <k> <asr.json> <out>` (대본 글자 ↔ 음성 단어 정렬, 앞 여백 0.6초)
4. 화면 — `capture.mjs <폴더>`: 로컬 DB + PostgREST 에 예시 업체를 넣고 **팀장(Pilot) 계정으로 로그인한 실제 화면**을 찍는다(PC 1440 · 휴대폰 412).
   로그인한 뒤 설정 › 화면에서 테마를 고르고 찍는다 — 기본 **오닉스 골드**(대표 지시), 다른 테마는 `THEME=deep-teal` 처럼
5. 장면 — `build.py <a|b> <tall|wide> <작업 폴더>` → `comp_<k>_<aspect>.html` (render(t) 하나로 정해지는 합성 화면)
6. 렌더 — `render.mjs <comp.html> --video <out.mp4> <voice.wav>` (30fps · H.264 CRF 18 · AAC 192k · 길이 = 음성 + 0.6 + 2.6초)

화면 속 기업 · 인물은 모두 예시 데이터다.
