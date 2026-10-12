# 대본(chunks_<k>.txt) 글자를 최종 음성의 단어 시각(asr_<k>.json)에 맞춘다 — 가이드 8장 그대로(앞 여백 0.6초)
#   python3 subs.py <k> <asr.json> <outdir>   →  <outdir>/subs_<k>.json · subs_<k>.srt · chars_<k>.json(문구 → 시각 찾기용)
import json, re, difflib, sys
k, ASR, OUTD = sys.argv[1], sys.argv[2], sys.argv[3]
OFFSET = 0.6
norm = lambda s: re.sub(r"[^0-9A-Za-z가-힣]", "", s)
CH = [l.replace("\\n", "\n") for l in open(f"chunks_{k}.txt").read().strip().split("\n")]
sc, owner = [], []
for i, c in enumerate(CH):
    n = norm(c.replace("**", "")); sc += list(n); owner += [i] * len(n)
script = "".join(sc)
ac, at0, at1 = [], [], []
for sg in json.load(open(ASR)):
    for w in sg["words"]:
        n = norm(w["w"])
        if not n: continue
        d = (w["e"] - w["s"]) / len(n)
        for j, ch in enumerate(n):
            ac.append(ch); at0.append(w["s"] + j * d); at1.append(w["s"] + (j + 1) * d)
asr = "".join(ac)
sm = difflib.SequenceMatcher(None, script, asr, autojunk=False)
t0 = [None] * len(script); t1 = [None] * len(script); matched = 0
for a, b, size in sm.get_matching_blocks():
    for j in range(size):
        t0[a + j] = at0[b + j]; t1[a + j] = at1[b + j]; matched += 1
known = [i for i in range(len(script)) if t0[i] is not None]
import bisect
for i in range(len(script)):
    if t0[i] is None:
        p = bisect.bisect_left(known, i)
        prev = known[p - 1] if p > 0 else None
        nxt = known[p] if p < len(known) else None
        if prev is None: t0[i] = t1[i] = t0[nxt]
        elif nxt is None: t0[i] = t1[i] = t1[prev]
        else:
            f = (i - prev) / (nxt - prev); t0[i] = t1[prev] + (t0[nxt] - t1[prev]) * f; t1[i] = t0[i]
print(f"[{k}] 대본 {len(script)}자 중 음성과 맞은 글자 {matched} ({matched/len(script):.1%})")
out = []
for i, c in enumerate(CH):
    idx = [j for j, o in enumerate(owner) if o == i]
    out.append({"in": t0[idx[0]] + OFFSET, "out": t1[idx[-1]] + OFFSET, "text": c, "match": sum(1 for j in idx if j in set(known)) / len(idx)})
for i, s in enumerate(out):
    nxt = out[i + 1]["in"] if i + 1 < len(out) else s["out"] + 1.0
    s["in"] = max(0.0, s["in"] - 0.05); s["out"] = min(s["out"] + 0.35, nxt - 0.08)
for i, s in enumerate(out):
    if s["out"] - s["in"] < 0.9:
        lim = out[i + 1]["in"] - 0.08 if i + 1 < len(out) else s["in"] + 0.9
        s["out"] = min(max(s["out"], s["in"] + 0.9), lim)
for s in out: s["in"], s["out"] = round(s["in"], 2), round(s["out"], 2)
low = [(round(s['match'], 2), s['text']) for s in out if s['match'] < 0.6]
short = [s['text'] for s in out if s['out'] - s['in'] < 0.9]
order = all(out[i]['in'] < out[i + 1]['in'] for i in range(len(out) - 1))
print(f"[{k}] 조각 {len(out)} · 60% 미만 맞은 조각 {len(low)} {low[:4]} · 0.9초 미만 {len(short)} {short[:3]} · 순서 {'OK' if order else 'BAD'}")
json.dump([{"in": s["in"], "out": s["out"], "text": s["text"]} for s in out], open(f"{OUTD}/subs_{k}.json", "w"), ensure_ascii=False, indent=1)
def ts(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s_, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s_:02},{ms:03}"
with open(f"{OUTD}/subs_{k}.srt", "w") as f:
    for i, s in enumerate(out, 1):
        f.write(f"{i}\n{ts(s['in'])} --> {ts(s['out'])}\n{s['text'].replace('**', '')}\n\n")
json.dump({"script": script, "t0": [round(x + OFFSET, 3) for x in t0]}, open(f"{OUTD}/chars_{k}.json", "w"), ensure_ascii=False)
