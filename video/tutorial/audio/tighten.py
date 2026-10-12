# 문장 사이 쉼 줄이기 (가이드 7-② 기반, 대표 요청으로 조금 더 짧게)
#  · 0.30초 이하(문장 안 짧은 숨)는 그대로
#  · 그보다 긴 쉼은 넘는 부분만 40% 로 — 0.86s→0.52s · 1.10s→0.62s
#  · 쉼 가운데만 잘라 냄(말 끝 숨·말 첫소리 보존), 이음매 8ms 교차
import wave, numpy as np, json, sys
k = sys.argv[1]
w = wave.open(f'sped_{k}.wav'); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32)
hop = int(sr*.01); n = len(x)//hop
db = 20*np.log10(np.sqrt(np.mean((x[:n*hop]/32768).reshape(n,hop)**2,axis=1))+1e-12)
sil = db < -38
runs, i = [], 0
while i < n:
    if sil[i]:
        j = i
        while j < n and sil[j]: j += 1
        a, b = i*.01, j*.01
        if b-a >= .30 and a > .05 and b < n*.01-.05: runs.append((a, b))
        i = j
    else: i += 1
KEEP, RATIO = .30, .40
cuts = []
for a, b in runs:
    L = b-a; newL = KEEP+(L-KEEP)*RATIO; cut = L-newL
    mid = (a+b)/2; cuts.append((mid-cut/2, cut))
xf = int(sr*.008); out, pos = [], 0
for c0, cl in cuts:
    s0, s1 = int(c0*sr), int((c0+cl)*sr)
    seg = x[pos:s0].copy()
    if out and xf:
        prev = out[-1]; ramp = np.linspace(0, 1, xf)
        prev[-xf:] = prev[-xf:]*(1-ramp)+seg[:xf]*ramp; seg = seg[xf:]
    out.append(seg); pos = s1
out.append(x[pos:]); y = np.concatenate(out)
# 맨 앞·맨 뒤 무음도 0.15초만 남김
yy = np.abs(y) > 32768*10**(-45/20)
first = max(0, np.argmax(yy)-int(sr*.15)); last = min(len(y), len(y)-np.argmax(yy[::-1])+int(sr*.25))
y = y[first:last]
wo = wave.open(f'tight_{k}.wav', 'w'); wo.setnchannels(1); wo.setsampwidth(2); wo.setframerate(sr)
wo.writeframes(np.clip(y, -32768, 32767).astype(np.int16).tobytes()); wo.close()
json.dump(cuts, open(f'cuts_{k}.json', 'w'))
print(f"{k}: 줄인 쉼 {len(cuts)}곳 · {sum(c for _, c in cuts):.1f}s 줄어듦 · {len(x)/sr:.1f}s → {len(y)/sr:.1f}s")
