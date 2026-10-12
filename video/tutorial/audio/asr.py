import json, sys
from faster_whisper import WhisperModel
k = sys.argv[1]
m = WhisperModel("large-v3", device="cpu", compute_type="int8", cpu_threads=4)
segs, info = m.transcribe(f"voice_{k}.wav", language="ko", beam_size=5, word_timestamps=True,
    vad_filter=True, vad_parameters={"min_silence_duration_ms": 300}, condition_on_previous_text=False,
    initial_prompt="최은혜 팀장님, 김상호 대표, MIRAE AI LAB OS, 미래AI랩, 고객 관리, 업체, 서류함, 맞춤 추천, 확인할 것, 일정, 업무 일기, 크레탑, 정책자금, 지원사업")
out = []
for s in segs:
    out.append({"start": s.start, "end": s.end, "text": s.text, "words": [{"s": w.start, "e": w.end, "w": w.word} for w in (s.words or [])]})
    print(f"[{s.start:7.2f}] {s.text}", flush=True)
json.dump(out, open(f"asr_{k}.json", "w"), ensure_ascii=False, indent=0)
