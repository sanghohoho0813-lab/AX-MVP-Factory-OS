# 0.9초 안 되는 자막 조각을 앞뒤 조각과 합친다(두 줄 · 한 줄 16자 안에 들어갈 때만)
import json, sys, re
MAX = 16
plain = lambda s: s.replace('**', '')
def fits(text):
    words = plain(text).split(' '); lines = ['']
    for w in words:
        cand = (lines[-1] + ' ' + w).strip()
        if len(cand) <= MAX or not lines[-1]: lines[-1] = cand
        else: lines.append(w)
    return len(lines) <= 2
def wrap(text):
    words = text.split(' '); lines = ['']
    for w in words:
        cand = (lines[-1] + ' ' + w).strip()
        if len(plain(cand)) <= MAX or not lines[-1]: lines[-1] = cand
        else: lines.append(w)
    return '\\n'.join(lines)
k, subs = sys.argv[1], json.load(open(sys.argv[2]))
chunks = [s['text'].replace('\n', ' ') for s in subs]
dur = [s['out'] - s['in'] for s in subs]
merged, i, n = [], 0, 0
while i < len(chunks):
    c = chunks[i]
    if dur[i] < 0.9:
        if i + 1 < len(chunks) and fits(c + ' ' + chunks[i + 1]):
            merged.append(wrap(c + ' ' + chunks[i + 1])); i += 2; n += 1; continue
        if merged and fits(merged[-1].replace('\\n', ' ') + ' ' + c):
            merged[-1] = wrap(merged[-1].replace('\\n', ' ') + ' ' + c); i += 1; n += 1; continue
    merged.append(subs[i]['text'].replace('\n', '\\n')); i += 1
open(f'chunks_{k}.txt', 'w').write('\n'.join(merged) + '\n')
print(k, '합침', n, len(chunks), '->', len(merged))
