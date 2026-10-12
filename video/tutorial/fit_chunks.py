# 자막 조각을 '한 줄 16자(공백 포함) · 두 줄' 에 맞춘다. 넘치는 조각은 단어 경계에서 다시 감싸고, 세 줄이 되면 둘로 나눈다.
import sys, re
MAX = 16
def plain(s): return s.replace('**', '')
def wrap(words):
    lines = [[]]
    for w in words:
        cur = ' '.join(lines[-1] + [w])
        if lines[-1] and len(plain(cur)) > MAX: lines.append([w])
        else: lines[-1].append(w)
    return [' '.join(l) for l in lines]
def fix_bold(lines):
    # 줄을 넘는 ** 짝을 줄마다 닫고 연다
    out, open_ = [], False
    for l in lines:
        if open_: l = '**' + l
        n = l.count('**')
        if n % 2 == 1: l = l + '**'; open_ = not open_ if False else True
        else: open_ = False if not (open_ and n % 2 == 0) else open_
        out.append(l)
    return out
for f in sys.argv[1:]:
    src = [l.rstrip('\n') for l in open(f) if l.strip()]
    out = []
    for c in src:
        lines = c.split('\\n')
        if all(len(plain(l)) <= MAX for l in lines) and len(lines) <= 2:
            out.append(c); continue
        words = ' '.join(lines).split(' ')
        w = wrap(words)
        for i in range(0, len(w), 2):
            out.append('\\n'.join(w[i:i + 2]))
    # ** 짝 맞추기 — 조각 안에서 홀수면 조각 끝에서 닫고 다음 조각 앞에서 연다
    fixed, carry = [], False
    for c in out:
        if carry: c = '**' + c
        carry = False
        if c.count('**') % 2 == 1: c += '**'; carry = True
        c = c.replace('****', '')
        fixed.append(c)
    open(f, 'w').write('\n'.join(fixed) + '\n')
    bad = [c for c in fixed if any(len(plain(l)) > MAX for l in c.split('\\n')) or len(c.split('\\n')) > 2]
    print(f, len(src), '->', len(fixed), 'still long:', bad[:5])
