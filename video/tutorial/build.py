#!/usr/bin/env python3
"""
안내 영상(D-185) 장면표 → 합성 HTML.

  python3 build.py <a|b> <tall|wide> <작업 폴더>

작업 폴더에 있어야 하는 것:
  build/subs_<k>.json · build/chars_<k>.json   (subs.py 가 만든 자막 · 글자 시각)
  audio/voice_<k>.wav                         (다듬은 음성 — 길이로 DUR 를 정한다)
  cap/*.png · cap/shots.json                  (capture.mjs 가 찍은 팀장 화면)
  fonts/PretendardVariable.woff2 · assets/logo-*.png
결과: <작업 폴더>/comp_<k>_<aspect>.html

시각은 모두 자막 번호(T(i) = i 번째 자막이 뜨는 때)나 말한 낱말(Wd('낱말'))에 묶어 둔다 —
음성을 다시 다듬어도 장면이 말을 따라간다.
"""
import html
import json
import math
import os
import re
import struct
import sys
import wave

K, ASPECT, WORK = sys.argv[1], sys.argv[2], os.path.abspath(sys.argv[3])
HERE = os.path.dirname(os.path.abspath(__file__))
TALL = ASPECT == 'tall'
W, H = (1080, 1920) if TALL else (1920, 1080)
OFFSET, TAIL = 0.6, 2.6
with wave.open(f'{WORK}/audio/voice_{K}.wav') as wf:
    VOICE = wf.getnframes() / wf.getframerate()
DUR = round(VOICE + OFFSET + TAIL, 2)
SUBS = json.load(open(f'{WORK}/build/subs_{K}.json'))
CHARS = json.load(open(f'{WORK}/build/chars_{K}.json'))
GEO = {s['name']: s for s in json.load(open(f'{WORK}/cap/shots.json'))}


def T(i):
    return SUBS[i - 1]['in']


def E(i):
    return SUBS[i - 1]['out']


def Wd(word, after=0.0):
    """말한 낱말이 시작되는 시각(after 뒤 첫 번째)"""
    w = word.replace(' ', '')
    s, t0 = CHARS['script'], CHARS['t0']
    i = s.find(w)
    while i >= 0:
        if t0[i] >= after - 0.05:
            return t0[i]
        i = s.find(w, i + 1)
    raise SystemExit(f'낱말 없음: {word} ({after})')


def A(tall, wide):
    return tall if TALL else wide


def fmt(s):
    s = html.escape(s)
    s = re.sub(r'\*\*(.+?)\*\*', r'<span class="acc">\1</span>', s)
    return s.replace('\n', '<br>')


def at(tin, tout=None, a='up'):
    return f'data-in="{tin:.2f}" data-out="{(tout if tout is not None else 99999):.2f}" data-a="{a}"'


# ---------------------------------------------------------------- 자리
if TALL:
    HX, HY, HW, HFS = 80, 150, 920, 74
    VZ = (54, 470, 972, 820)          # 그림 · 화면 자리 (자막 위 1330 까지)
    BZ = (60, 1548, 960, 290)         # 자막 아래 칩 자리
else:
    HX, HY, HW, HFS = 110, 112, 560, 60
    VZ = (720, 60, 1130, 800)
    BZ = (110, 352, 560, 500)

SCENES = []


class Scene:
    def __init__(self, t0, t1, bg):
        self.t0, self.t1, self.bg, self.parts = t0, t1, bg, []

    def add(self, *h):
        self.parts.extend(h)
        return self

    def render(self):
        cls = 'scene light' if self.bg == 'L' else 'scene'
        grid = '' if self.bg == 'L' else '<div class="grid"></div>'
        return f'<div class="{cls}" {at(self.t0 - .25, self.t1 + .3, "fade")}><div class="bg{self.bg}"></div>{grid}{"".join(self.parts)}</div>'


def scene(t0, t1, bg='D'):
    sc = Scene(t0, t1, bg)
    SCENES.append(sc)
    return sc


def header(sc, eyebrow, title, tin=None, tout=None, fs=None):
    tin = sc.t0 if tin is None else tin
    sc.add(f'<div class="abs eyebrow" style="left:{HX}px;top:{HY}px;width:{HW}px" {at(tin, tout, "left")}>{fmt(eyebrow)}</div>')
    sc.add(f'<div class="abs h2" style="left:{HX}px;top:{HY + 50}px;width:{HW}px;font-size:{fs or HFS}px" {at(tin + .12, tout)}>{fmt(title)}</div>')


NOTE = '화면 속 기업·인물은 예시 데이터입니다'


def note(sc):
    if TALL:
        sc.add(f'<div class="abs note" style="left:0;width:{W}px;top:1866px;text-align:center">{NOTE}</div>')
    else:
        sc.add(f'<div class="abs note" style="right:70px;top:20px;text-align:right">{NOTE}</div>')


def div(box, inner='', style='', attrs=''):
    x, y, w, h = box
    return f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{style}" {attrs}>{inner}</div>'


# ---------------------------------------------------------------- 화면(캡처) 움직이기
def css_size(name):
    b = open(f'{WORK}/cap/{name}.png', 'rb').read(24)
    w, h = struct.unpack('>II', b[16:24])
    return w / 2, h / 2


def _region(k, vw, vh, iw, ih):
    _, rx, ry, rw = k
    s = vw / rw
    rh = vh / s
    return (min(max(rx, 0), max(0, iw - rw)), min(max(ry, 0), max(0, ih - rh)), s)


def _zoom(r, z, vw, vh, iw, ih):
    rx, ry, s = r
    cx, cy = rx + vw / s / 2, ry + vh / s / 2
    s2 = s * (1 + z)
    rw2, rh2 = vw / s2, vh / s2
    return (min(max(cx - rw2 / 2, 0), max(0, iw - rw2)), min(max(cy - rh2 / 2, 0), max(0, ih - rh2)), s2)


def pan(keys, vw, vh, iw, ih, t_end, md=1.1, drift=.03):
    """keys: [(시각, x, y, 보일 폭)] — 앞 자리에서 다음 자리로 md 초 동안 옮기고, 머무는 동안은 아주 천천히 다가간다"""
    R = [_region(k, vw, vh, iw, ih) for k in keys]
    segs, cur = [], R[0]
    for i, k in enumerate(keys):
        t = k[0]
        if i > 0:
            segs.append((t, t + md, cur, R[i]))
            cur = R[i]
        hold0 = t + (md if i > 0 else 0)
        tn = keys[i + 1][0] if i + 1 < len(keys) else t_end
        if drift and tn - hold0 > 1.2:
            d = _zoom(cur, drift * min(1, (tn - hold0) / 5), vw, vh, iw, ih)
            segs.append((hold0, tn, cur, d))
            cur = d
    if not segs:
        segs = [(keys[0][0], keys[0][0] + .01, cur, cur)]
    spec = ';'.join(f'{a:.2f},{b:.2f},{r0[0]:.1f},{r0[1]:.1f},{r0[2]:.4f},{r1[0]:.1f},{r1[1]:.1f},{r1[2]:.4f}' for a, b, r0, r1 in segs)
    return spec, segs


def scale_at(segs, t):
    cur = segs[0][2]
    for a, b, r0, r1 in segs:
        if t < a:
            break
        p = min(1, max(0, (t - a) / max(.001, b - a)))
        cur = tuple(r0[i] + (r1[i] - r0[i]) * p for i in range(3))
    return cur[2]


def _marks(segs, focus, tags):
    out = []
    for f in focus:
        t0, t1, (fx, fy, fw, fh) = f[:3]
        s = scale_at(segs, t0 + .7)
        pad = 8 / s
        out.append(f'<div class="focus" style="left:{fx - pad:.1f}px;top:{fy - pad:.1f}px;width:{fw + 2 * pad:.1f}px;height:{fh + 2 * pad:.1f}px;'
                   f'border-width:{max(2, 5 / s):.2f}px;border-radius:{14 / s:.1f}px;box-shadow:0 0 0 9999px rgba(12,13,16,.3),0 0 {26 / s:.0f}px rgba(184,144,50,.6)" {at(t0, t1, "fast")}></div>')
    for g in tags:
        t0, t1, text, (tx, ty) = g[:4]
        s = scale_at(segs, t0 + .7)
        out.append(f'<div class="tag" style="left:{tx:.1f}px;top:{ty:.1f}px;font-size:{30 / s:.1f}px;padding:{9 / s:.1f}px {20 / s:.1f}px;border-radius:{40 / s:.0f}px;'
                   f'background:var(--gold);color:#16110d" {at(t0, t1, "up")}>{fmt(text)}</div>')
    return ''.join(out)


def browser(sc, shot, keys, focus=(), tags=(), box=None, tin=None, tout=None, a='card', url='MIRAE AI LAB OS', drift=.03, bar=True):
    x, y, w, h = box or VZ
    bh = 40 if bar else 0
    vw, vh = w, h - bh
    iw, ih = css_size(shot)
    tin = sc.t0 if tin is None else tin
    t_end = (tout if tout is not None else sc.t1) + .4
    spec, segs = pan(keys, vw, vh, iw, ih, t_end, drift=drift)
    inner = f'<img class="shot" src="cap/{shot}.png" style="width:{iw:.0f}px">' + _marks(segs, focus, tags)
    barh = f'<div class="barr"><i></i><i></i><i></i><span>{fmt(url)}</span></div>' if bar else ''
    sc.add(f'<div class="abs browser" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px" {at(tin, tout, a)}>{barh}'
           f'<div class="view" style="width:{vw}px;height:{vh}px"><div class="abs" style="left:0;top:0;width:{iw:.0f}px;height:{ih:.0f}px;transform-origin:0 0" data-pan="{spec}">{inner}</div></div></div>')


def phone(sc, shot, keys, box, tin=None, tout=None, a='push', focus=(), tags=()):
    """keys: [(시각, 스크롤 y)] — 위 머리줄 · 아래 메뉴는 제자리(찍을 때 따로 찍은 것)"""
    x, y, pw = box
    ph = round(pw * 19.7 / 9)
    vw, vh = pw - 28, ph - 28
    sb = round(vw * .075)                 # 상태 표시줄
    ch = vh - sb
    s = vw / 412
    iw, ih = css_size(shot)
    tin = sc.t0 if tin is None else tin
    t_end = (tout if tout is not None else sc.t1) + .4
    spec, segs = pan([(t, 0, yy, 412) for t, yy in keys], vw, ch, iw, ih, t_end, md=1.3, drift=0)
    over = ''
    for c in GEO.get(shot, {}).get('chrome', []):
        if c['edge'] == 'top':
            over += f'<div class="abs" style="left:0;top:0;width:{vw}px;height:{c["h"] * s:.1f}px;background:url(cap/{shot}-top.png) 0 0/{vw}px auto no-repeat"></div>'
        else:
            over += (f'<div class="abs" style="left:0;top:{ch - c["h"] * s:.1f}px;width:{vw}px;height:{c["h"] * s:.1f}px;'
                     f'background:url(cap/{shot}-top.png) 0 {-c["y"] * s:.1f}px/{vw}px auto no-repeat;box-shadow:0 -1px 0 rgba(0,0,0,.06)"></div>')
    inner = f'<img class="shot" src="cap/{shot}.png" style="width:412px">' + _marks(segs, focus, tags)
    status = (f'<div class="abs" style="left:0;top:0;width:{vw}px;height:{sb}px;background:#fff;color:#111;font-weight:750;font-size:{sb * .46:.0f}px;'
              f'display:flex;align-items:center;justify-content:space-between;padding:0 {sb * .9:.0f}px 0 {sb * 1.1:.0f}px"><span>10:24</span><span style="letter-spacing:.1em">▮▮▮</span></div>')
    sc.add(f'<div class="abs phone" style="left:{x}px;top:{y}px;width:{pw}px;height:{ph}px" {at(tin, tout, a)}><div class="view" style="width:{vw}px;height:{vh}px">{status}'
           f'<div class="abs" style="left:0;top:{sb}px;width:{vw}px;height:{ch}px;overflow:hidden;background:#fff">'
           f'<div class="abs" style="left:0;top:0;width:412px;height:{ih:.0f}px;transform-origin:0 0" data-pan="{spec}">{inner}</div>{over}</div></div><div class="notch"></div></div>')


def pair(sc, pc_shot, pc_keys, mo_shot, mo_keys, tin_pc=None, tin_mo=None, pc_focus=(), mo_focus=(), pc_tags=(), tout=None):
    """PC + 휴대폰 같은 화면(가이드: 휴대폰을 보여 줄 때 PC 짝도)"""
    if TALL:
        browser(sc, pc_shot, pc_keys, pc_focus, pc_tags, box=(40, 520, 860, 600), tin=tin_pc, tout=tout)
        phone(sc, mo_shot, mo_keys, (690, 560, 340), tin=tin_mo, tout=tout)
    else:
        browser(sc, pc_shot, pc_keys, pc_focus, pc_tags, box=(720, 96, 920, 650), tin=tin_pc, tout=tout)
        phone(sc, mo_shot, mo_keys, (1500, 128, 340), tin=tin_mo, tout=tout)


# ---------------------------------------------------------------- 그림 조각
def chips(sc, items, box=None, cls='chip sm', align='flex-start', valign='flex-start', gap=16, a='up', fs=None):
    """items: [(시각, 글, 색?, 사라질 시각?, 지울 시각?)]"""
    out = []
    for it in items:
        t, text = it[0], it[1]
        c = it[2] if len(it) > 2 else None
        tout = it[3] if len(it) > 3 else None
        strike = it[4] if len(it) > 4 else None
        st = (f'--c:{c};' if c else '') + (f'font-size:{fs}px;' if fs else '') + ('position:relative;' if strike else '')
        sk = f'<div class="strike" data-strike="{strike:.2f}"></div>' if strike else ''
        out.append(f'<div class="{cls}" style="{st}" {at(t, tout, a)}>{fmt(text)}{sk}</div>')
    sc.add(div(box or BZ, ''.join(out), f'display:flex;flex-wrap:wrap;gap:{gap}px;justify-content:{align};align-content:{valign};align-items:center'))


def numtags(sc, items, box=None, gap=20, fs=None, align='center'):
    """items: [(시각, 번호, 글, 흐려질 시각?)]"""
    out = []
    for it in items:
        t, n, text = it[:3]
        dim = f' data-dim="{it[3]:.2f}"' if len(it) > 3 and it[3] else ''
        out.append(f'<div class="numtag" style="{f"font-size:{fs}px;" if fs else ""}" {at(t, a="left")}{dim}><span class="n">{n}</span><span>{fmt(text)}</span></div>')
    sc.add(div(box or VZ, ''.join(out), f'display:flex;flex-direction:column;gap:{gap}px;justify-content:{align};align-items:flex-start'))


def bubbles(sc, items, box=None, gap=18, fs=None, align='center'):
    out = []
    for i, it in enumerate(items):
        t, text = it[:2]
        side = 'flex-start' if i % 2 == 0 else 'flex-end'
        rad = '28px 28px 28px 8px' if i % 2 == 0 else '28px 28px 8px 28px'
        out.append(f'<div class="bubble" style="align-self:{side};border-radius:{rad};{f"font-size:{fs}px;" if fs else ""}" {at(t, a="card")}>{fmt(text)}</div>')
    sc.add(div(box or VZ, ''.join(out), f'display:flex;flex-direction:column;gap:{gap}px;justify-content:{align}'))


def chain(sc, items, box=None, vertical=False, fs=None, gap=20, colors=None):
    """노드 → 노드. items: [(시각, 글)]"""
    out = []
    arrow = '↓' if vertical else '→'
    for i, (t, text) in enumerate(items):
        if i:
            out.append(f'<div style="font-size:{(fs or 48) * .9:.0f}px;font-weight:800;color:var(--hi)" {at(t - .15, a="fast")}>{arrow}</div>')
        c = (colors or [None] * len(items))[i]
        out.append(f'<div class="node" style="{f"--c:{c};" if c else ""}{f"font-size:{fs}px;" if fs else ""}" {at(t, a="card")}>{fmt(text)}</div>')
    d = 'column' if vertical else 'row'
    sc.add(div(box or VZ, ''.join(out), f'display:flex;flex-direction:{d};flex-wrap:{"nowrap" if vertical else "wrap"};gap:{gap}px;justify-content:center;align-items:center;align-content:center'))


def centered(sc, x, y, inner, attrs='', style=''):
    """(x, y) 를 가운데로 — 움직임은 안쪽 요소에"""
    sc.add(f'<div class="abs" style="left:{x}px;top:{y}px;transform:translate(-50%,-50%);{style}" {attrs}>{inner}</div>')


def hub(sc, x, y, d, text, tin, fs=None, tout=None):
    centered(sc, x, y, f'<div class="hub" style="width:{d}px;height:{d}px;font-size:{fs or d * .16:.0f}px" {at(tin, tout, "scale")}>{fmt(text)}</div>')


def person(sc, x, y, d, initial, label, tin, hi=False, tout=None, dim=None, lfs=None):
    bg = 'radial-gradient(circle at 35% 30%, #E0C76F, #B89032 55%, #8C6B1F)' if hi else 'linear-gradient(160deg,#3E434C,#2B2F37)'
    col = '#15171C' if hi else 'rgba(244,241,236,.85)'
    ring = 'box-shadow:0 0 0 10px rgba(184,144,50,.18),0 24px 48px -20px rgba(0,0,0,.7);' if hi else 'box-shadow:0 24px 48px -20px rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.14);'
    dm = f' data-dim="{dim:.2f}"' if dim else ''
    centered(sc, x, y, f'<div {at(tin, tout, "scale")}{dm} style="display:flex;flex-direction:column;align-items:center;gap:16px">'
             f'<div class="person" style="width:{d}px;height:{d}px;background:{bg};color:{col};font-size:{d * .38:.0f}px;{ring}">{fmt(initial)}</div>'
             f'<div style="font-size:{lfs or max(26, d * .2):.0f}px;font-weight:750;white-space:nowrap;color:{"var(--hi)" if hi else "var(--ink2)"}">{fmt(label)}</div></div>')


def line(sc, x1, y1, x2, y2, t0, t1, w=5, dash=False):
    d = ' stroke-dasharray="2 14"' if dash else ''
    sc.add(f'<svg class="abs" style="left:0;top:0;overflow:visible" width="{W}" height="{H}"><path d="M{x1:.0f} {y1:.0f} L{x2:.0f} {y2:.0f}" stroke="#B89032" stroke-opacity=".75" stroke-width="{w}" fill="none" stroke-linecap="round" data-draw="{t0:.2f},{t1:.2f}"{d}/></svg>')


def card(sc, box, inner, tin, tout=None, a='card', style=''):
    x, y, w, h = box
    sc.add(f'<div class="abs glass" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;padding:30px 36px;display:flex;flex-direction:column;justify-content:center;gap:14px;{style}" {at(tin, tout, a)}>{inner}</div>')


def text(sc, x, y, w, s, tin, cls='h3', tout=None, a='up', style=''):
    sc.add(f'<div class="abs {cls}" style="left:{x}px;top:{y}px;width:{w}px;{style}" {at(tin, tout, a)}>{fmt(s)}</div>')


def logo(sc, x, y, w, tin, light=True, a='scale'):
    f = 'logo-light' if light else 'logo-dark'
    sc.add(f'<img class="abs logo-img" src="assets/{f}.png" style="left:{x}px;top:{y}px;width:{w}px" {at(tin, a=a)}>')


def closing(sc, line1, line2, tin):
    """마무리 — 로고 + 다음 안내"""
    if TALL:
        logo(sc, 240, 560, 600, tin)
        text(sc, 80, 860, 920, line1, tin + .4, 'h1', style='text-align:center;font-size:84px')
        text(sc, 80, 1080, 920, line2, tin + .9, 'p', style='text-align:center')
    else:
        logo(sc, 660, 220, 600, tin)
        text(sc, 260, 480, 1400, line1, tin + .4, 'h1', style='text-align:center;font-size:84px')
        text(sc, 260, 640, 1400, line2, tin + .9, 'p', style='text-align:center')


# ================================================================ 1편
def video_a():
    # A1 인사 — 오늘 화면 PC · 휴대폰
    sc = scene(0, T(7))
    header(sc, '안내 영상 1편', '**은혜 팀장님**,\n안녕하세요', tin=.2)
    pair(sc, 'pc-today', [(0, 0, 0, 1440)], 'mo-today', [(T(3), 0), (T(5), 380)], tin_pc=T(2) - .2, tin_mo=T(3) + .1)
    chips(sc, [(T(3) + .5, '써 보실 수 있는 단계', '#A9B1BC'), (T(4), '어디까지 만들었는지'), (T(5), '지금 쓸 수 있는 기능')],
          box=A(BZ, (110, 380, 560, 400)))
    note(sc)

    # A2a 공개 전 — 팀장님 한 분만
    sc = scene(T(7), T(11), 'S')
    header(sc, '파일럿', '당분간\n**팀장님 한 분만**')
    cx, cy = (VZ[0] + VZ[2] / 2, VZ[1] + 330) if TALL else (VZ[0] + VZ[2] / 2, 340)
    gapx = A(190, 215)
    for i, lab in enumerate(['컨설턴트', '컨설턴트', '은혜 팀장님', '컨설턴트', '컨설턴트']):
        hi = i == 2
        person(sc, cx + (i - 2) * gapx, cy, A(150 if hi else 120, 170 if hi else 130), '최' if hi else '컨', lab,
               T(8) + abs(i - 2) * .18 if not hi else T(9), hi=hi, dim=None if hi else T(9) + .2, lfs=A(30, 30))
    chips(sc, [(T(8) + .3, '다른 컨설턴트분께는 아직 비공개', '#8a95a1')], box=div_box(cx, cy + A(230, 250)), align='center')
    chips(sc, [(T(10) - .2, '먼저 열어 드립니다', None)], box=div_box(cx, cy + A(330, 350)), align='center', cls='chip hi')

    # A2b 같이 만들어 가는 첫 번째 파일럿
    sc = scene(T(11), T(15))
    header(sc, '같이 만드는', '**첫 번째**\n**파일럿**')
    cx = VZ[0] + VZ[2] / 2
    y0 = A(620, 210)
    chips(sc, [(T(11) + .2, '완성된 제품 전달', '#8a95a1', None, T(11) + 1.3)], box=div_box(cx, y0), align='center', cls='chip')
    person(sc, cx - A(200, 240), y0 + A(250, 250), A(140, 150), '대표', '저', T(12), hi=False, lfs=30)
    person(sc, cx + A(200, 240), y0 + A(250, 250), A(140, 150), '최', '은혜 팀장님', T(12) + .3, hi=True, lfs=30)
    centered(sc, cx, y0 + A(230, 230), f'<div style="font-size:64px;font-weight:850;color:var(--hi)" {at(T(12) + .6, a="scale")}>⇄</div>')
    text(sc, cx - 300, y0 + A(430, 430), 600, '써 보면서 같이 만들기', T(12) + 1, 'p', style='text-align:center;font-size:40px')
    chips(sc, [(T(13), '첫 번째 파일럿', None)], box=div_box(cx, y0 + A(560, 540)), align='center', cls='chip hi', fs=A(60, 56))

    # A3 한 곳에서
    sc = scene(T(15), T(20))
    header(sc, '이 시스템의 목적', '**한 곳에서**\n처리하게')
    cx, cy = VZ[0] + VZ[2] / 2, VZ[1] + VZ[3] / 2
    rx, ry = A((330, 320), (440, 290))
    items = [(T(16), '고객 관리'), (Wd('서류를', T(16)), '서류'), (T(17), '일정 · 업무'), (Wd('상담', T(17)), '상담 기록'), (T(18), '전문 컨설팅')]
    for i, (t, lab) in enumerate(items):
        ang = -math.pi / 2 + i * 2 * math.pi / 5
        x, y = cx + rx * math.cos(ang), cy + ry * math.sin(ang)
        line(sc, x, y, cx, cy, T(19) - .2 + i * .08, T(19) + .6 + i * .08)
        centered(sc, x, y, f'<div class="chip" style="font-size:{A(44, 42)}px" {at(t, a="scale")}>{lab}</div>')
    hub(sc, cx, cy, A(250, 240), '한 곳에서', T(19), fs=A(48, 46))

    # A4 왼쪽 메뉴 — 오늘 · 확인할 것 · 일정 · 고객 · 영업 · 전문 모듈
    sc = scene(T(20), T(23), 'L')
    header(sc, '처음 로그인하면', '왼쪽 메뉴\n**한눈에 보기**')
    rw = A(560, 620)
    keys = [(T(20), 0, 0, 1440), (T(20) + .7, 0, 40, rw), (T(22), 0, 380, rw)]
    sb = lambda y, h=44: (12, y, 264, h)
    t_today = Wd('오늘', T(20))
    browser(sc, 'pc-today', keys, focus=[
        (t_today, Wd('확인할', T(20)), sb(124)), (Wd('확인할', T(20)), T(21), sb(173)), (T(21), Wd('고객', T(21)), sb(221)),
        (Wd('고객', T(21)), Wd('영업', T(21)), sb(310)), (Wd('영업', T(21)), T(22) + .9, sb(398)), (T(22) + 1.1, T(23) + .4, (12, 552, 264, 176)),
    ], tin=T(20) - .2)
    chips(sc, [(t_today, '오늘'), (Wd('확인할', T(20)), '확인할 것'), (T(21), '일정'), (Wd('고객', T(21)), '고객 관리'), (Wd('영업', T(21)), '영업 관리'),
               (T(22) + .3, '전문 모듈', None)], gap=14)
    note(sc)

    # A5 처음부터 다 익히실 필요 없음
    sc = scene(T(23), T(29), 'L')
    header(sc, '시작하는 법', '다 익히실 필요\n**전혀 없습니다**')
    rows = client_rows()
    browser(sc, 'pc-clients', [(T(23), 310, 90, 1110), (T(25), 320, 440, 1000)],
            focus=[(T(25) + .9, T(26) + .4, (rows[0][0], rows[0][1], rows[0][2], rows[1][1] + rows[1][3] - rows[0][1]))],
            tags=[(Wd('한두', T(25)) + .4, T(29) + .4, '한두 곳만 먼저', (rows[0][0] + 700, rows[0][1] - 52))])
    numtags(sc, [(T(26), 1, '평소 하던 업무 중에'), (T(27), 2, '편할 것 같은 기능부터'), (T(28), 3, '하나씩 써 보기')],
            box=A(BZ, (110, 380, 560, 440)), gap=A(12, 22), fs=A(38, 36))
    note(sc)

    # A6 고객 관리 — 한 업체 안에서
    sc = scene(T(29), T(34), 'L')
    header(sc, '고객 관리', '한 업체 안에서\n**전부 관리**')
    browser(sc, 'pc-client-overview', [(T(29), 300, 80, 1120), (T(31), 320, 360, 1080), (T(32), 320, 1860, 1080), (T(33) + .2, 0, 60, 1440)],
            focus=[(T(30), T(31), (328, 120, 640, 210)), (T(31) + .9, T(32), (349, 386, 1015, 560)), (T(32) + 1.0, T(33) + .2, (328, 1900, 1057, 330))],
            tags=[(T(32) + 1.2, T(33) + .2, '다음 약속 · 진행 업무 · 계약', (349, 1850))])
    chips(sc, [(T(31), '기본 정보'), (Wd('연락처', T(31)), '연락처'), (Wd('상담', T(31)), '상담 내용'), (Wd('진행', T(31)), '진행 업무'),
               (T(32), '서류'), (Wd('일정', T(32)), '일정'), (Wd('메모', T(32)), '메모'), (T(33), '한 업체 안에서', None)], gap=14)
    note(sc)

    # A7a 같은 정보 한 번만 — 서류함
    sc = scene(T(34), T(38), 'L')
    header(sc, '중요하게 생각한 것', '같은 정보\n**한 번만** 입력')
    browser(sc, 'pc-client-docs', [(T(34), 300, 330, 1100), (Wd('재무제표', T(36)) - .9, 320, 720, A(1080, 1180))],
            focus=[(Wd('사업자등록증', T(36)), Wd('법인', T(36)), (331, 760, 522, 232)), (Wd('법인', T(36)), Wd('재무제표', T(36)) - .9, (867, 760, 522, 232)),
                   (Wd('재무제표', T(36)) + .2, T(38) + .3, (331, 1283, 522, 250))],
            tags=[(T(37), T(38) + .4, '한 번 넣어 두면', (880, 1300))])
    chips(sc, [(T(35), '같은 정보 반복 입력', '#8a95a1', None, T(35) + 1.6), (T(37), '한 번만', None)], gap=16)
    note(sc)

    # A7b 다른 기능에서 계속 활용
    sc = scene(T(38), T(43))
    header(sc, '한 번 정리하면', '다른 기능에서\n**계속 활용**')
    if TALL:
        hx, hy, nodes = 540, 720, [(220, 1120), (540, 1120), (860, 1120)]
    else:
        hx, hy, nodes = 960, 460, [(1560, 200), (1560, 460), (1560, 720)]
    mods = [(T(38), '연구소'), (T(39), '기업인증'), (T(40), '정책자금')]
    for i, ((x, y), (t, lab)) in enumerate(zip(nodes, mods)):
        line(sc, hx, hy, x, y, T(42) + i * .15, T(42) + .8 + i * .15)
        centered(sc, x, y, f'<div class="node" style="font-size:{A(44, 46)}px" {at(t, a="card")}>{lab}</div>')
        centered(sc, x, y + A(90, 0), f'<div class="chip sm" style="--c:#8a95a1;position:relative;font-size:30px;padding:8px 18px" {at(t + .3, a="up")}>또 입력<div class="strike" data-strike="{T(41) + i * .25:.2f}"></div></div>',
                 style=A('', f'margin-left:{-250}px'))
    hub(sc, hx, hy, A(300, 300), '업체 정보\n한 번 정리', T(38), fs=A(44, 44))
    centered(sc, hx, hy + A(-250, 230), f'<div class="chip hi" style="font-size:{A(44, 40)}px" {at(T(42) + .9, a="up")}>계속 활용</div>')

    # A8a 서류를 올리면 — 읽어서 회사 정보에
    sc = scene(T(43), T(47), 'L')
    header(sc, '서류 올리기', '읽어서\n**회사 정보에 연결**')
    browser(sc, 'pc-client-smart', [(T(43), 320, 340, 1080), (T(44), 330, 470, 1000), (T(46), 330, 690, 1000)],
            focus=[(T(43) + .5, T(44), (328, 365, 1057, 120)), (T(44) + 1.0, T(46), (349, 578, 1015, 112)), (T(46) + 1.0, T(47) + .4, (349, 1003, 1015, 226))],
            tags=[(T(44) + 1.2, T(46), '바로 넣은 정보', (900, 540)), (T(46) + 1.2, T(47) + .4, '사람이 한 번 확인', (900, 960))])
    chips(sc, [(T(44), '회사 정보에 연결'), (T(45), '바로 넣어도 되는 정보', '#5F6670'), (T(46), '확인이 필요한 정보', '#B89032')], gap=14)
    note(sc)

    # A8b 서류 정리 · 업체 기록
    sc = scene(T(47), T(51), 'L')
    header(sc, '서류함', '정리하고\n**기록에 남김**')
    rb = btn_rect('pc-client-docs', '서류 다시 분류')
    browser(sc, 'pc-client-docs', [(T(47), 640, 300, 760)], focus=[(T(47) + .6, T(49) + .2, rb)], tags=[(T(47) + .8, T(49) + .2, '잘못 · 겹친 서류 정리', (rb[0] - 120, rb[1] + 56))],
            tout=T(49) + .3)
    browser(sc, 'pc-client-smart', [(T(49) - .2, 330, 460, 1000)], focus=[(T(49) + .6, T(51) + .4, (349, 500, 1015, 66))],
            tags=[(T(49) + .8, T(51) + .4, '언제 무엇을 올렸는지', (700, 590))], tin=T(49) - .2, a='fade')
    chips(sc, [(T(47), '잘못 들어간 서류'), (Wd('중복', T(47)), '중복된 서류'), (T(49), '업체 기록에 남음', None)], gap=14)
    note(sc)

    # A9 고객이 많아지면 제일 어려운 것
    sc = scene(T(51), T(55), 'S')
    header(sc, '고객이 많아지면', '제일 어려운 건\n**기억하기**')
    numtags(sc, [(T(52), 1, '오늘 누구한테 연락?'), (T(53), 2, '어떤 서류를 받아야?'), (T(54), 3, '어느 업무가 밀렸나?')],
            box=A((100, 560, 880, 640), (760, 180, 1000, 560)), gap=A(34, 34), fs=A(52, 52))

    # A10 오늘 · 확인할 것 · 일정이 모아서
    sc = scene(T(55), T(59), 'L')
    header(sc, '오늘 · 확인할 것 · 일정', '**모아서**\n보여 줍니다')
    browser(sc, 'pc-today', [(T(55), 310, 90, 1100), (T(56), 310, 1300, 1100), (T(57), 310, 720, 1100), (T(58) + .4, 0, 40, 1440)],
            focus=[(T(56) + 1.0, T(57), (328, 1327, 603, 720)), (T(57) + 1.0, T(58) + .4, (328, 735, 1057, 568))],
            tags=[(T(56) + 1.2, T(57), '다가오는 마감 · 약속', (650, 1290)), (T(57) + 1.2, T(58) + .4, '확인할 것', (1100, 700))])
    chips(sc, [(T(56), '마감이 다가오는 업무'), (Wd('부족한', T(56)), '부족한 서류'), (T(57), '다시 확인할 정보'), (T(58), '한곳에 모아서', None)], gap=14)
    note(sc)

    # A11a 밖에서도 바로 확인 — 휴대폰
    sc = scene(T(59), T(64))
    header(sc, '외부 일정이 많을 때', '밖에서도\n**바로 확인**')
    phone(sc, 'mo-client-overview', [(T(59), 0), (T(62), 560), (T(63), 1240)], A((337, 424, 405), (1110, 64, 360)), tin=T(59) + .2)
    chips(sc, [(T(61), '미팅 중', '#A9B1BC'), (Wd('이동', T(61)), '이동 중', '#A9B1BC'), (T(62), '기본 정보'), (Wd('진행', T(62)), '진행 상황'), (Wd('받아', T(62)), '받아 둔 서류'),
               (T(63), '바로 확인', None)], gap=14)
    note(sc)

    # A11b 파일 찾으러 갈 일이 줄어듦
    sc = scene(T(64), T(68))
    header(sc, '이제는', '파일 찾을 일\n**많이 줄어요**')
    phone(sc, 'mo-client-docs', [(T(64), 0), (T(66), 520)], A((60, 424, 405), (760, 64, 360)), tin=T(64))
    lx = A(520, 1210)
    ly = A(560, 170)
    for i, (t, lab, sk) in enumerate([(T(65), '사무실 다시 가기', T(65) + .7), (Wd('노트북', T(66)), '노트북에서 찾기', Wd('데스크톱', T(66))),
                                      (Wd('데스크톱', T(66)) + .2, '데스크톱 파일 찾기', Wd('데스크톱', T(66)) + 1.3)]):
        sc.add(f'<div class="abs chip" style="left:{lx}px;top:{ly + i * A(120, 130)}px;font-size:{A(40, 44)}px;--c:#8a95a1;position:absolute" {at(t, a="left")}>{lab}<div class="strike" data-strike="{sk:.2f}"></div></div>')
    sc.add(f'<div class="abs chip hi" style="left:{lx}px;top:{ly + 3 * A(120, 130) + 20}px;font-size:{A(46, 50)}px" {at(T(67), a="scale")}>많이 줄어듭니다</div>')
    note(sc)

    # A12 PC · 휴대폰 같은 정보 — 누락 줄이기
    sc = scene(T(68), T(73), 'L')
    header(sc, 'PC · 휴대폰 같은 정보', '**누락**을\n줄입니다')
    pair(sc, 'pc-client-docs', [(T(68), 300, 330, 1120)], 'mo-client-smart', [(T(68), 0), (T(70), 560)], tin_pc=T(68) - .2, tin_mo=T(68) + .3,
         pc_focus=[(T(68) + .7, T(69) + .2, (328, 405, 1057, 335)), (T(69) + .4, T(70) + .6, (331, 760, 1058, 500))])
    chips(sc, [(T(68), '빠진 서류', '#c0563f'), (T(69), '받은 서류', '#5F6670'), (Wd('다음에', T(69)), '다음 할 일'), (T(71), '누락 줄이기', None)], gap=14)
    note(sc)

    # A13 영업 관리 — 상담 → 미팅 → 제안 → 계약
    sc = scene(T(73), T(79), 'L')
    header(sc, '영업 관리 · 다듬는 중', '상담부터\n**계약까지**')
    col = lambda x: (x, 710, 168, 600)
    browser(sc, 'pc-sales', [(T(73), 310, 90, 1110), (T(75), 320, 690, 1080)],
            focus=[(T(75) + 1.0, Wd('미팅', T(76)), col(328)), (Wd('미팅', T(76)), Wd('제안', T(76)), col(506)), (Wd('제안', T(76)), Wd('계약', T(76)), col(861)),
                   (Wd('계약', T(76)), T(77), col(1217)), (T(77) + .4, T(79) + .4, (1226, 1024, 150, 230))],
            tags=[(T(74), T(75), '아직 다듬는 중', (1150, 110)), (T(77) + .6, T(79) + .4, '다음에 할 일', (1080, 990))])
    chain(sc, [(T(76), '상담'), (Wd('미팅', T(76)), '미팅'), (Wd('제안', T(76)), '제안'), (Wd('계약', T(76)), '계약')],
          box=A(BZ, (110, 330, 560, 560)), vertical=not TALL, fs=A(42, 36), gap=A(16, 8))
    note(sc)

    # A14a 더 직관적으로
    sc = scene(T(79), T(82), 'L')
    header(sc, '영업 관리', '더 **직관적**으로\n다듬는 중')
    browser(sc, 'pc-sales', [(T(79), 0, 0, 1440), (T(80), 300, 600, 1140)], tags=[(T(80) + .5, T(82) + .4, '화면 · 흐름 더 쉽게', (900, 640))])
    chips(sc, [(T(79) + .3, '화면'), (T(79) + 1.0, '흐름'), (T(80), '더 직관적으로', None)], gap=14)
    note(sc)

    # A14b 써 보시면서 말씀해 주세요
    sc = scene(T(82), T(86), 'L')
    header(sc, '팀장님께 부탁', '써 보시면서\n**말씀해 주세요**')
    bubbles(sc, [(T(83), '영업 흐름은 이렇게 가는 게\n더 자연스러워요'), (T(84), '이건 굳이 필요 없어요')], box=A((80, 520, 920, 520), (760, 140, 1040, 460)), fs=A(46, 46))
    chips(sc, [(T(85), '바로 반영하기 좋습니다', None)], box=A((80, 1100, 920, 120), (760, 640, 1040, 120)), align='center', cls='chip hi')

    # A15 지금 써 보셔도 좋은 기능
    sc = scene(T(86), T(91))
    header(sc, '전문 기능', '지금 써 보셔도\n**좋은 기능**')
    tiles = [('고용지원금', '지원금 · 회차 · 일정'), ('기업부설연구소', '설립 · 사후관리'), ('지원사업 알림', '업체 기준 공고'),
             ('세금 계산기', '9가지 계산'), ('창업감면', '1분 판정'), ('크레탑 분석', '재무 · 3개년 추이')]
    cols = A(2, 3)
    tw, th, gx, gy = A((440, 200, 30, 28), (350, 230, 26, 26))
    ox = VZ[0] + (VZ[2] - (cols * tw + (cols - 1) * gx)) / 2
    oy = VZ[1] + A(40, 120)
    for i, (n, sub) in enumerate(tiles):
        x, y = ox + (i % cols) * (tw + gx), oy + (i // cols) * (th + gy)
        t = T(87) + i * .5
        sc.add(f'<div class="abs glass" style="left:{x:.0f}px;top:{y:.0f}px;width:{tw}px;height:{th}px;padding:28px 30px;display:flex;flex-direction:column;justify-content:center;gap:10px;border-top:5px solid var(--gold)" {at(t, a="card")}>'
               f'<div style="font-size:{A(46, 44)}px;font-weight:800">{n}</div><div style="font-size:{A(30, 28)}px;color:var(--ink2);font-weight:600">{sub}</div></div>')
    chips(sc, [(T(89), '실제 업무에 써 보셔도 좋아요', None)], box=A((80, oy + 3 * (th + gy) + 10, 920, 100), (720, oy + 2 * (th + gy) + 20, 1130, 100)), align='center', cls='chip hi')

    # A16a 고용지원금 — 지원금 찾기 · 입사일 · 회차
    sc = scene(T(91), T(97), 'L')
    header(sc, '전문 모듈 ①', '**고용지원금**')
    browser(sc, 'pc-employment', [(T(91), 560, 90, 840)], focus=[(T(91) + .8, T(93) + .2, (604, 214, 752, 620))], tout=T(93) + .3, url='고용지원금 · 한눈에 보기')
    browser(sc, 'pc-emp-diagnosis', [(T(93) - .2, 560, 90, 840)], focus=[(T(94), T(95) + .2, (604, 200, 752, 300))], tin=T(93) - .2, tout=T(95) + .3, a='fade', url='고용지원금 · 채용 진단')
    browser(sc, 'pc-emp-schedule', [(T(95) - .2, 560, 130, 840)], focus=[(Wd('입사일', T(95)), T(96), (585, 300, 300, 200)), (T(96) + .3, T(97) + .4, (920, 268, 466, 690))],
            tin=T(95) - .2, a='fade', url='고용지원금 · 회차 일정')
    chips(sc, [(T(93), '여러 지원금 중 검토'), (Wd('입사일', T(95)), '직원 · 입사일 기준'), (T(96), '신청 회차 · 일정', None)], gap=14)
    note(sc)

    # A16b 고용지원금 — 계산 · 진행 상태
    sc = scene(T(97), T(101), 'L')
    header(sc, '고용지원금', '계산하고\n**진행 상태**까지')
    browser(sc, 'pc-emp-wage', [(T(97), 560, 90, 840), (T(97) + 1.2, 570, 600, 820)], focus=[(T(97) + 2.0, T(99) + .2, (604, 668, 752, 300))], tout=T(99) + .3, url='고용지원금 · 급여 계산기')
    browser(sc, 'pc-emp-company', [(T(99) - .2, 560, 180, 840)], focus=[(T(99) + .4, T(100) + .2, (597, 207, 754, 470))], tin=T(99) - .2, tout=T(100) + .3, a='fade', url='고용지원금 · 업체')
    browser(sc, 'pc-emp-board', [(T(100) - .2, 560, 560, 840)], focus=[(T(100) + .5, T(101) + .4, (601, 777, 750, 420))], tags=[(T(100) + .7, T(101) + .4, '진행 상태', (1180, 740))],
            tin=T(100) - .2, a='fade', url='고용지원금 · 진행 보드')
    chips(sc, [(T(97), '급여 · 4대보험 부담'), (Wd('예상', T(97)), '예상 수령액'), (T(99), '업체별 지원금'), (T(100), '진행 상태 관리', None)], gap=14)
    note(sc)

    # A17a 기업부설연구소 — 설립 조건 · 서류
    sc = scene(T(101), T(105), 'L')
    header(sc, '전문 모듈 ②', '**기업부설**\n**연구소**')
    browser(sc, 'pc-labcare', [(T(101), 560, 90, 840)], focus=[(T(101) + .7, T(102) + .2, (572, 250, 813, 219))], tout=T(102) + .3, url='기업부설연구소 · 대시보드')
    browser(sc, 'pc-lab-assessment', [(T(102) - .2, 560, 120, 840), (T(103), 570, 330, 820)], focus=[(T(103) + 1.0, T(104) + .2, (585, 380, 790, 700))],
            tin=T(102) - .2, tout=T(104) + .3, a='fade', url='연구소 · 설립 가능성 체크')
    browser(sc, 'pc-lab-setup-docs', [(T(104) - .2, 560, 90, 840)], focus=[(Wd('설립할', T(104)), T(105) + .4, (572, 307, 813, 226))], tin=T(104) - .2, a='fade', url='연구소 · 설립서류 관리')
    chips(sc, [(Wd('인원', T(103)), '인원'), (Wd('자격', T(103)), '자격'), (Wd('공간', T(103)), '공간'), (T(104), '설립 서류', None)], gap=14)
    note(sc)

    # A17b 사후관리
    sc = scene(T(105), T(109), 'L')
    header(sc, '연구소 · 사후관리', '만든 뒤에도\n**계속 이어서**')
    t1, t2, t3, t4, t5 = Wd('연구노트', T(106)), Wd('변경사항', T(106)), Wd('활동', T(106)), Wd('월간', T(106)), T(107)
    browser(sc, 'pc-lab-notes', [(T(105), 560, 130, 840)], focus=[(t1 + .1, t2, (572, 300, 813, 220))], tout=t2 + .2, url='연구소 · 연구노트')
    browser(sc, 'pc-lab-changes', [(t2 - .2, 560, 330, 840)], focus=[(t2 + .4, t3, (572, 525, 813, 430))], tin=t2 - .2, tout=t3 + .2, a='fade', url='연구소 · 변경사항 관리')
    browser(sc, 'pc-lab-survey', [(t3 - .2, 320, 130, 1080), (t4 - .3, 320, 440, 700)], focus=[(t3 + .3, t4 - .2, (572, 307, 813, 103)), (t4 + .8, t5, (328, 640, 226, 38))],
            tags=[(t4 + .9, t5, '월간 점검', (560, 642))], tin=t3 - .2, tout=t5 + .2, a='fade', url='연구소 · 활동조사 관리')
    browser(sc, 'pc-lab-inspection', [(t5 - .2, 560, 130, 840)], focus=[(t5 + .5, T(109) + .4, (572, 300, 813, 262))], tin=t5 - .2, a='fade', url='연구소 · 현장조사 대비')
    chips(sc, [(t1, '연구노트'), (t2, '변경사항 신고'), (t3, '활동 조사'), (t4, '월간 점검'), (t5, '현장 조사 대비'), (Wd('사후관리', T(107)), '사후관리', None)], gap=14)
    note(sc)

    # A17c 처음부터 사후관리까지
    sc = scene(T(109), T(114), 'L')
    header(sc, '연구소', '**처음부터**\n**사후관리까지**')
    browser(sc, 'pc-lab-tax', [(T(109), 560, 140, 840)], focus=[(T(109) + .6, T(111), (585, 250, 330, 640)), (T(110), T(111) + .2, (925, 381, 460, 400))], tout=T(111) + .3, url='연구소 · 세액공제')
    browser(sc, 'pc-labcare', [(T(111) - .2, 560, 160, 840)], focus=[(T(112), T(114) + .4, (572, 250, 813, 219))], tin=T(111) - .2, a='fade', url='기업부설연구소')
    chain(sc, [(Wd('처음부터', T(112)), '설립'), (Wd('사후관리', T(112)), '사후관리'), (Wd('사후관리', T(112)) + .6, '세액공제')],
          box=A(BZ, (110, 330, 560, 560)), vertical=not TALL, fs=A(40, 36), gap=A(14, 8))
    note(sc)

    # A18a 지원사업 알림
    sc = scene(T(114), T(119), 'L')
    header(sc, '전문 모듈 ③', '**지원사업**\n알림')
    browser(sc, 'pc-grants', [(T(114), 310, 90, 1110), (T(115), 320, 600, 1080), (T(118), 310, 420, 1110)],
            focus=[(T(114) + .6, T(115), (328, 183, 1057, 77)), (T(115) + 1.0, T(117), (328, 722, 1057, 136)), (T(117), T(118), (1290, 722, 95, 560)), (T(118) + 1.0, T(119) + .4, (328, 540, 1057, 161))],
            tags=[(T(115) + 1.2, T(117), '맞는 업체', (1000, 690)), (T(117) + .2, T(118), '접수 마감', (1160, 690)), (T(118) + 1.2, T(119) + .4, '맞는 조건만 거르기', (900, 505))])
    chips(sc, [(T(115), '업체별 맞는 공고'), (T(117), '접수 기간 · 지원 내용'), (T(118), '맞는 조건', None)], gap=14)
    note(sc)

    # A18b 업체 기준으로 먼저
    sc = scene(T(119), T(123), 'L')
    header(sc, '공고가 많으니', '**업체 기준**으로\n먼저 정리')
    pair(sc, 'pc-grants', [(T(119), 310, 520, 1110)], 'mo-grants', [(T(119), 0), (T(121), 560)], tin_pc=T(119) - .2, tin_mo=T(119) + .3)
    chips(sc, [(T(119) + .2, '제목만 보고 일일이 확인', '#8a95a1', None, T(120) + .6), (T(121), '업체 기준으로 먼저', None)], gap=14)
    note(sc)

    # A19a 세금 계산기 9가지
    sc = scene(T(123), T(127))
    header(sc, '전문 모듈 ④ · 절세와 재무', '세금 계산기\n**9가지**')
    nx, ny = A((540, 640), (980, 400))
    centered(sc, nx, ny, f'<div style="display:flex;align-items:baseline;gap:18px" {at(T(125), a="scale")}><span class="num" data-count="{T(125):.2f},{T(125) + 1.1:.2f},0,9">0</span>'
             f'<span class="h2" style="font-size:72px">가지</span></div>')
    calc = [('대표이사', '대표이사 급여'), ('퇴직급여', '퇴직급여'), ('주식양수도', '주식양수도'), ('상속', '상속'), ('가지급금', '가지급금')]
    chips(sc, [(Wd(w, T(126)), lab) for w, lab in calc], box=A((80, 860, 920, 400), (1240, 200, 600, 520)), cls='chip', align=A('center', 'flex-start'), gap=18, fs=A(44, 42))

    # A19b 세금 계산기 화면
    sc = scene(T(127), T(130), 'L')
    header(sc, '세금 계산기', '상담에서\n**자주 쓰는 계산**')
    browser(sc, 'pc-tax', [(T(127), 310, 90, 1110), (T(128), 320, 330, 1000)], focus=[(T(127) + .6, T(128), (328, 180, 1057, 150)), (T(128) + 1.0, T(130) + .4, (328, 354, 1057, 560))])
    chips(sc, [(T(127), '상담에서 자주 확인'), (T(128), '중기이코노미 공개 계산기', None)], gap=14)
    note(sc)

    # A20 창업감면 판정
    sc = scene(T(130), T(133), 'L')
    header(sc, '절세와 재무', '**창업감면**\n판정')
    jb = btn_rect('pc-startup', '1분 판정하기', default=(600, 2330, 760, 60))
    browser(sc, 'pc-startup', [(T(130), 560, 90, 840), (T(131), 570, 380, 820), (T(132), 570, max(0, jb[1] - 500), 820)],
            focus=[(T(130) + .5, T(131), (572, 146, 813, 90)), (T(131) + 1.0, T(132), (600, 410, 780, 470)), (T(132) + 1.0, T(133) + .4, jb)])
    chips(sc, [(T(131), '몇 가지 조건 입력'), (T(132), '감면 가능성 빠르게', None)], gap=14)
    note(sc)

    # A21 크레탑
    sc = scene(T(133), E(137) + .2, 'L')
    header(sc, '절세와 재무', '**크레탑**\n보고서 분석')
    browser(sc, 'pc-cretop', [(T(133), 560, 90, 840), (T(134), 570, 480, 820), (T(135), 570, 1200, 820), (T(136), 570, 900, 820)],
            focus=[(T(134) + 1.0, T(135), (587, 521, 783, 389)), (T(135) + 1.0, T(136), (587, 1230, 783, 760)), (T(136) + 1.0, E(137) + .6, (587, 933, 783, 275))],
            tags=[(T(136) + 1.2, E(137) + .6, '첫 미팅에서 짚을 점', (1000, 895))])
    chips(sc, [(T(133), '크레탑 기업종합보고서'), (T(134), '주요 재무 정보'), (T(135), '재무 비율 · 3개년 추이'), (T(136), '첫 미팅 체크', None)], gap=14)
    note(sc)

    # A22 마무리
    sc = scene(E(137) + .2, DUR)
    closing(sc, '2편에서 이어집니다', '정책자금 · 기업인증 · 앞으로 추가할 기능', E(137) + .2)


# ================================================================ 2편
def video_b():
    # B1 아직 다듬는 중
    sc = scene(0, T(4), 'S')
    header(sc, '안내 영상 2편', '아직\n**다듬는 중**', tin=.2)
    text(sc, *A((80, 600, 920), (760, 200, 1000)), '기능은 이미 상당히 들어가 있지만', T(1), 'p', style='font-size:48px')
    chips(sc, [(Wd('정책자금'), '정책자금'), (Wd('기업인증'), '기업인증')], box=A((80, 760, 920, 300), (760, 340, 1000, 300)), cls='chip hi', fs=A(64, 60), gap=24)

    # B2 정책자금 진단 — 기관 · 서류 · 리스크 · 순서
    sc = scene(T(4), T(9), 'L')
    header(sc, '정책자금', '기관 · 서류 ·\n**준비 순서**')
    t_doc, t_risk = Wd('필요한서류', T(6)), Wd('리스크', T(6))
    browser(sc, 'pc-policy-sample', [(T(4), 560, 100, 840), (T(5), 570, 1180, 820), (t_doc, 570, 6080, 820), (t_risk, 570, 1960, 820), (T(7), 570, 10260, 820)],
            focus=[(T(4) + .6, T(5), (585, 195, 790, 1000)), (T(5) + 1.0, t_doc, (590, 1215, 780, 490)), (t_doc + 1.0, t_risk, (590, 6115, 780, 290)),
                   (t_risk + 1.0, T(7), (597, 1998, 763, 655)), (T(7) + 1.0, T(9) + .4, (590, 10290, 780, 440))],
            url='정책자금 · 진단(예시)')
    chips(sc, [(T(4), '업체 상황 입력'), (T(5), '기관 · 방향'), (t_doc, '필요 서류'), (t_risk, '리스크'), (T(7), '몇 달 준비 순서'), (T(8), '기본 구조는 완성', None)], gap=14)
    note(sc)

    # B3 변수가 많다
    sc = scene(T(9), T(13), 'S')
    header(sc, '정책자금', '**변수**가\n굉장히 많아요')
    var = ['기관마다 다른 기준', '업력', '매출 규모', '신용', '담보 · 보증', '업종', '지역', '신청 시기']
    pos = A([(.28, .1), (.78, .16), (.2, .34), (.62, .38), (.34, .56), (.8, .6), (.18, .78), (.62, .82)],
            [(.25, .12), (.72, .1), (.15, .38), (.5, .32), (.85, .4), (.3, .62), (.68, .66), (.45, .88)])
    for i, (lab, (fx, fy)) in enumerate(zip(var, pos)):
        centered(sc, VZ[0] + fx * VZ[2], VZ[1] + fy * VZ[3] * A(.82, 1), f'<div class="chip" style="font-size:{A(40, 42)}px;--c:{["#B89032", "#A9B1BC", "#D9DDE3"][i % 3]}" {at(T(10) + i * .3, a="scale")}>{lab}</div>')
    chips(sc, [(T(12), '아직 더 다듬는 중', None)], box=A(BZ, (110, 400, 560, 200)), cls='chip hi', align=A('center', 'flex-start'))

    # B4a 기업인증 — 여러 인증을 한 업체 기준으로
    sc = scene(T(13), T(17), 'L')
    header(sc, '기업인증', '여러 인증을\n**한 업체 기준**으로')
    browser(sc, 'pc-cert', [(T(13), 560, 140, 840)], focus=[(T(16), T(17) + .4, (573, 544, 811, 480))], tags=[(T(16) + .2, T(17) + .4, '한 업체 기준', (1150, 505))], url='기업인증 · 인증 한눈에')
    chips(sc, [(Wd('벤처기업', T(14)), '벤처기업'), (Wd('이노비즈', T(14)), '이노비즈'), (Wd('메인비즈', T(14)), '메인비즈'), (Wd('기업부설연구소', T(14)), '기업부설연구소'), (Wd('ISO', T(15)), 'ISO')], gap=14)
    note(sc)

    # B4b 무엇부터 어떤 순서로
    sc = scene(T(17), T(22), 'L')
    header(sc, '기업인증', '무엇부터\n**어떤 순서로**')
    browser(sc, 'pc-cert', [(T(17), 560, 200, 840)], focus=[(T(17) + .5, T(18), (573, 544, 811, 300)), (T(18), T(19), (593, 261, 771, 142)), (T(19), T(20), (593, 462, 771, 44)), (T(20), T(22) + .4, (573, 544, 811, 480))])
    chips(sc, [(T(17), '① 먼저 볼 인증'), (T(18), '② 부족한 정보'), (T(19), '③ 준비할 자료'), (T(20), '④ 진행 순서', None)], gap=14)
    note(sc)

    # B5 공식 기준과 심사 현장
    sc = scene(T(22), T(26))
    header(sc, '기업인증', '공식 기준과\n**실제 심사 현장**')
    if TALL:
        b1, b2, ne, b3 = (80, 540, 400, 260), (600, 540, 400, 260), (540, 670), (80, 860, 920, 160)
    else:
        b1, b2, ne, b3 = (760, 130, 440, 280), (1380, 130, 440, 280), (1290, 270), (760, 470, 1060, 160)
    card(sc, b1, '<div style="font-size:30px;color:var(--ink3);font-weight:700">기준 ①</div><div class="h3">공식 기준</div>', T(22))
    card(sc, b2, '<div style="font-size:30px;color:var(--ink3);font-weight:700">기준 ②</div><div class="h3">실제 심사 현장</div>', T(22) + .8)
    centered(sc, *ne, f'<div class="h1" style="color:var(--hi)" {at(T(22) + 1.6, a="scale")}>≠</div>')
    card(sc, b3, '<div class="h3" style="font-size:44px">상담 때 어떤 정보가 먼저 보여야 할까?</div>', T(23))
    chips(sc, [(T(24), '계속 조정하는 중', None)], box=A((80, 1080, 920, 120), (760, 680, 1060, 120)), cls='chip hi', align='center')

    # B6 써 보시고 말씀해 주세요
    sc = scene(T(26), T(31), 'L')
    header(sc, '팀장님께 부탁', '써 보시고\n**말씀해 주세요**')
    bubbles(sc, [(T(27), '실제 상담에선 이렇게\n판단하지 않아요'), (T(28), '이 질문은 필요 없어요'), (T(29), '이 정보가 먼저\n보여야 해요')], box=A((80, 500, 920, 640), (760, 90, 1040, 600)), fs=A(46, 44))
    chips(sc, [(T(30), '훨씬 빠르게 고칠 수 있어요', None)], box=A((80, 1170, 920, 110), (760, 720, 1040, 110)), align='center', cls='chip hi')

    # B7 앞으로 추가할 기능 — 메뉴 '출시 예정' · 마케팅 · 브랜딩
    sc = scene(T(31), T(37), 'L')
    header(sc, '앞으로', '추가할 기능\n**꽤 있습니다**', tout=T(32) + .2)
    header(sc, '추가 예정 ①', '**마케팅**\n**브랜딩**', tin=T(32) + .1)
    up = side_rect('출시 예정')
    sbox = A((300, 470, 480, 820), (980, 70, 520, 790))
    browser(sc, 'pc-sidebar-upcoming', [(T(31), 0, max(0, up[1] - 40), 288)], focus=[(T(31) + .6, T(32) + .2, (up[0], up[1], up[2], 360))], box=sbox, bar=False, tout=T(32) + .3, drift=0)
    mk = lambda x, y: (x, y, 372, 104)
    browser(sc, 'pc-marketing', [(T(32), 300, 80, 1120), (T(33), 320, 170, 800)],
            focus=[(Wd('블로그', T(34)), Wd('유튜브', T(34)), mk(330, 188)), (Wd('유튜브', T(34)), Wd('SNS', T(34)), mk(722, 188)), (Wd('SNS', T(34)), T(36), mk(722, 307))],
            tags=[(T(36), T(37) + .4, '이 시스템 안에서 같이', (620, 440))], tin=T(32) - .2, a='fade', url='마케팅 · 브랜딩 (도입 예정)')
    chips(sc, [(Wd('블로그', T(34)), '블로그'), (Wd('유튜브', T(34)), '유튜브'), (Wd('SNS', T(34)), 'SNS'), (T(36), '콘텐츠 · 마케팅 활동', None)], gap=14)

    # B8 주제 → 계획 → 올렸는지
    sc = scene(T(37), T(40))
    header(sc, '마케팅 · 브랜딩', '주제 → 계획 →\n**올렸는지**')
    chain(sc, [(T(37), '주제 정하기'), (T(38), '계획하기'), (Wd('올렸는지', T(39)), '올렸는지 ✓')], vertical=TALL, fs=A(52, 50), gap=A(24, 24), colors=['#A9B1BC', '#D9DDE3', '#B89032'])

    # B9 AX 1차 미팅 체크리스트
    sc = scene(T(40), T(46), 'S')
    header(sc, '추가 예정 ②', '**AX 1차 미팅**\n체크리스트')
    cb = A((120, 520, 840, 300), (760, 110, 1000, 300))
    card(sc, cb, '<div style="font-size:30px;font-weight:700;color:var(--ink3)">AX 상담 · 첫 방문</div><div class="h2" style="font-size:60px">1차 미팅 체크리스트</div>'
         '<div style="display:flex;gap:14px;margin-top:6px">' + ''.join('<div style="height:14px;width:{}px;border-radius:7px;background:rgba(255,255,255,.14)"></div>'.format(w) for w in (220, 160, 260)) + '</div>', T(41))
    yb = cb[1] + cb[3] + 40
    sc.add(f'<div class="abs chip" style="left:{cb[0]}px;top:{yb}px;--c:#8a95a1;position:absolute;font-size:{A(40, 42)}px" {at(T(42), a="left")}>일반 영업 체크리스트<div class="strike" data-strike="{T(42) + 1.4:.2f}"></div></div>')
    sc.add(f'<div class="abs chip hi" style="left:{cb[0]}px;top:{yb + 110}px;font-size:{A(44, 46)}px" {at(T(43), a="left")}>AX 상담 첫 방문용</div>')
    sc.add(f'<div class="abs chip" style="left:{cb[0]}px;top:{yb + 220}px;font-size:{A(40, 42)}px" {at(T(44), a="left")}>빠뜨리면 안 되는 질문 · 확인</div>')

    # B10 빠뜨리면 안 되는 질문 6
    sc = scene(T(46), T(53))
    header(sc, 'AX 1차 미팅', '빠뜨리면 안 되는\n**질문들**')
    numtags(sc, [(T(46), 1, '지금 반복하는 업무'), (T(47), 2, '사람이 수기로 하는 일'), (T(48), 3, '대표님이 가장 불편한 것'), (T(49), 4, '직원이 시간을 쓰는 일'),
                 (T(50), 5, '쓰는 프로그램 · 엑셀'), (T(51), 6, '데이터 관리 방식')], box=A((90, 480, 900, 820), (740, 70, 1100, 790)), gap=A(18, 16), fs=A(44, 44))
    chips(sc, [(T(52), '순서대로 확인', None)], box=A(BZ, (110, 400, 560, 200)), cls='chip hi', align=A('center', 'flex-start'))

    # B11 미팅이 끝나면
    sc = scene(T(53), T(57), 'S')
    header(sc, '미팅이 끝나면', '다음 미팅까지\n**자연스럽게**')
    c1, c2 = A(((80, 520, 920, 220), (80, 780, 920, 220)), ((760, 120, 1060, 230), (760, 390, 1060, 230)))
    card(sc, c1, '<div style="font-size:30px;font-weight:700;color:var(--ink3)">미팅 끝나고 바로</div><div class="h3">AX로 바꾸면 <span class="acc">효과가 큰 업무</span></div>', T(54))
    card(sc, c2, '<div style="font-size:30px;font-weight:700;color:var(--ink3)">다음 미팅 준비</div><div class="h3">더 <span class="acc">확인해야 할 것</span></div>', T(55))
    chain(sc, [(T(56), '1차 미팅'), (T(56) + .5, '2차 미팅')], box=A((80, 1040, 920, 200), (760, 660, 1060, 180)), fs=40)

    # B12 매번 다시 찾아보는 것들
    sc = scene(T(57), T(62))
    header(sc, 'AX 상담을 하다 보면', '매번 다시\n**찾아보는 것들**')
    finds = [(T(58), '비슷한 업종 사례'), (T(59), '비슷한 회사의 시스템 구축'), (T(60), '자금 조달 사례')]
    for i, (t, lab) in enumerate(finds):
        bx = A((80, 520 + i * 170, 920, 140), (760, 110 + i * 175, 1060, 145))
        card(sc, bx, f'<div style="display:flex;align-items:center;gap:26px"><div style="width:64px;height:64px;border-radius:50%;border:6px solid var(--gold);flex:none;position:relative"></div><div class="h3" style="font-size:46px">{lab}</div></div>', t, a='left')
    chips(sc, [(T(61), '매번 따로 다시 찾아보기', '#c0563f')], box=A((80, 1050, 920, 120), (760, 660, 1060, 120)), align='center', cls='chip')

    # B13a 업체를 열면 유사 사례
    sc = scene(T(62), T(66), 'L')
    header(sc, '추가 예정 ③', '업체를 열면\n**유사 사례**')
    browser(sc, 'pc-client-overview', [(T(62), 300, 80, 1120)])
    pb = A((300, 760, 700, 500), (1280, 300, 540, 520))
    cases = [(Wd('AX구축', T(63)), 'AX 구축 사례'), (Wd('정책자금', T(64)), '정책자금 · 보증 사례'), (Wd('투자', T(64)), '투자 사례')]
    inner = '<div style="font-size:28px;font-weight:800;color:var(--hi);letter-spacing:.08em">비슷한 사례 · 준비 중</div>' + ''.join(
        f'<div style="padding:16px 20px;border-radius:16px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);font-size:36px;font-weight:750" {at(t, a="left")}>{lab}</div>' for t, lab in cases)
    sc.add(div(pb, inner, 'padding:30px;display:flex;flex-direction:column;gap:16px;background:#1C1F25;border-radius:26px;box-shadow:0 40px 90px -30px rgba(0,0,0,.6);color:#f4f1ec', at(T(62) + .8, a='card')))
    chips(sc, [(T(65), '바로 찾아볼 수 있게', None)], box=A(BZ, (110, 400, 560, 200)), cls='chip hi', align=A('center', 'flex-start'))

    # B13b 처음부터 찾지 않고 바로 준비
    sc = scene(T(66), T(69), 'L')
    header(sc, '미팅 전 준비', '처음부터 찾지 않고\n**바로 준비**')
    chain(sc, [(T(66) + .2, '자료를 처음부터 찾기'), (T(67), '시스템 안에서 유사 사례'), (T(68), '바로 미팅 준비')], vertical=True, fs=A(44, 46), gap=18,
          colors=['#8a95a1', '#B89032', '#343942'])

    # B14a 법인 컨설팅 모듈들
    sc = scene(T(69), T(74))
    header(sc, '추가 예정 ④', '**법인 컨설팅**\n모듈들')
    mods = [('정관', '정관 정비'), ('가지급금', '가지급금 정리'), ('미처분', '미처분 이익잉여금'), ('이익소각', '이익소각 · 자기주식'), ('임원보수', '임원보수 · 퇴직금 규정'),
            ('법인전환', '법인전환'), ('사내근로복지기금', '사내근로복지기금'), ('주식가치평가', '주식가치평가'), ('직무발명', '직무발명보상')]
    chips(sc, [(Wd(w, T(69)), lab, ['#B89032', '#A9B1BC', '#D9DDE3'][i % 3]) for i, (w, lab) in enumerate(mods)], box=A((70, 480, 940, 820), (740, 80, 1110, 780)),
          cls='chip', align='center', valign='center', gap=A(18, 20), fs=A(40, 42), a='scale')
    chips(sc, [(T(74) - .6, '법인 컨설팅', None)], box=A(BZ, (110, 400, 560, 200)), cls='chip hi', align=A('center', 'flex-start'))

    # B14b 자주 쓰는 업무부터 하나씩 — 메뉴 '출시 예정'
    sc = scene(T(74), T(79), 'L')
    header(sc, '만드는 순서', '**자주 쓰는**\n**업무부터**')
    up = side_rect('출시 예정')
    browser(sc, 'pc-sidebar-upcoming', [(T(74), 0, max(0, up[1] - 40), 288), (T(77), 0, up[1] + 260, 288)], box=A((300, 470, 480, 820), (980, 70, 520, 790)), bar=False, drift=0)
    chips(sc, [(T(76), '한꺼번에 만들기', '#8a95a1', None, T(76) + 1.4), (T(77), '자주 쓰는 업무부터'), (T(78), '하나씩 제대로', None)], gap=14)

    # B15 월 구독 서비스로
    sc = scene(T(79), T(83))
    header(sc, '이 시스템을 만드는 이유', '**월 구독**\n서비스로')
    cx = VZ[0] + VZ[2] / 2
    chips(sc, [(T(80), '제 업무만 편하게', '#8a95a1', None, T(80) + 1.6)], box=div_box(cx, A(560, 160)), align='center', cls='chip')
    for i in range(4):
        person(sc, cx + (i - 1.5) * A(190, 200), A(780, 380), A(110, 110), '컨', '컨설턴트', T(81) + i * .15, lfs=26)
    chips(sc, [(T(82), '월 구독 서비스로 출시', None)], box=div_box(cx, A(1010, 600)), align='center', cls='chip hi', fs=A(56, 56))

    # B16a 기본형 월 9만 9천 원
    sc = scene(T(83), T(88))
    header(sc, '가격 그림 (계획)', '기본형\n**월 9만 9천 원**')
    price_rows(sc, [(T(84), '기본형', '월 9.9만 원', .22, False)], top=A(560, 160))
    chips(sc, [(Wd('기업성장', T(86)), '기업 성장'), (Wd('절세와', T(86)), '절세 · 재무'), (Wd('마케팅', T(86)), '마케팅'), (Wd('AX', T(86)), 'AX'), (T(87), '전문 모듈 계속 추가', None)],
          box=A((80, 820, 920, 400), (760, 420, 1060, 360)), gap=16, cls='chip')

    # B16b 모듈이 늘면
    sc = scene(T(88), T(94))
    header(sc, '가격 그림 (계획)', '모듈이 늘면\n**월 50만 원 이상**')
    price_rows(sc, [(T(88), '기본형', '월 9.9만 원', .22, False), (T(89), '모듈 추가', '월 20~30만 원', .58, True), (T(92), '전체 기능', '월 50만 원 이상', 1.0, False)], top=A(560, 160))
    chips(sc, [(T(89) + .5, '확정 가격이 아닌 계획', '#8a95a1')], box=A((80, 1120, 920, 100), (760, 640, 1060, 100)), align=A('center', 'flex-start'), cls='chip sm')

    # B17 CRM 이 아니라 전체 과정
    sc = scene(T(94), T(100), 'S')
    header(sc, '최종 그림', 'CRM이 아니라\n**전체 과정**')
    cb = A((80, 500, 920, 150), (760, 90, 1060, 150))
    sc.add(div(cb, f'<div class="h3" style="font-size:44px;position:relative;display:inline-block">CRM — 이름 · 연락처 저장<div class="strike" data-strike="{Wd("CRM", T(94)) + .5:.2f}"></div></div>',
               'display:flex;align-items:center;justify-content:center', at(T(94), a='up')))
    steps = [(T(95), '만나고'), (Wd('자료를', T(95)), '자료 받고'), (Wd('분석', T(95)), '분석'), (T(96), '방향 판단'), (T(97), '업무 진행'), (Wd('사후관리', T(97)), '일정 · 사후관리')]
    chain(sc, steps, box=A((60, 690, 960, 420), (740, 270, 1100, 380)), fs=A(38, 40), gap=A(12, 14))
    chips(sc, [(T(98), '한 시스템 안에서', None)], box=A((80, 1150, 920, 110), (760, 690, 1060, 110)), align='center', cls='chip hi')

    # B18 같이 수익
    sc = scene(T(100), T(105))
    header(sc, '판매가 시작되면', '**같이 수익**을\n만드는 구조')
    cx = VZ[0] + VZ[2] / 2
    yy = A(700, 320)
    person(sc, cx - A(220, 260), yy, A(150, 160), '대표', '저', T(100) + .2, lfs=30)
    person(sc, cx + A(220, 260), yy, A(150, 160), '최', '은혜 팀장님', T(102), hi=True, lfs=30)
    for i in range(3):
        person(sc, cx + A(220, 260) + (i - 1) * A(130, 140), yy + A(290, 280), A(80, 84), '컨', '', T(102) + .8 + i * .15, lfs=20)
    text(sc, cx + A(220, 260) - 200, yy + A(380, 360), 400, '다른 컨설턴트분께 소개', T(102) + 1.2, 'p', style='text-align:center;font-size:34px')
    chips(sc, [(T(104), '같이 수익을 만드는 구조', None)], box=div_box(cx, A(1250, 800)), align='center', cls='chip hi', fs=A(50, 48))

    # B19a 눈치 보지 마시고 피드백 많이
    sc = scene(T(105), T(108), 'L')
    header(sc, '부탁드립니다', '눈치 보지 마시고\n**피드백 많이**')
    chips(sc, [(T(106), '정말 눈치 보지 마시고'), (T(107), '피드백을 많이', None)], box=A((80, 640, 920, 400), (760, 260, 1060, 400)), cls='chip', align='center', valign='center', gap=30, fs=A(56, 56))

    # B19b 이런 말씀 전부 좋아요
    sc = scene(T(108), T(115), 'L')
    header(sc, '팀장님 피드백', '이런 말씀\n**전부 좋아요**')
    bubbles(sc, [(T(108), '왜 이렇게 만들었어요?'), (T(109), '이 기능은 실제로 안 써요'), (T(110), '버튼 위치가 불편해요'), (T(111), '이 화면은 너무 복잡해요'),
                 (T(112), '이런 기능 있었으면 좋겠어요'), (T(113), '실제 상담에선 이렇게 해요')], box=A((70, 470, 940, 840), (740, 60, 1110, 800)), gap=A(14, 12), fs=A(40, 38))
    chips(sc, [(T(114), '전부 좋습니다', None)], box=A(BZ, (110, 400, 560, 200)), cls='chip hi', align=A('center', 'flex-start'), fs=A(52, 50))

    # B20 불편한 부분을 많이
    sc = scene(T(115), T(120))
    header(sc, '오히려', '**불편한 부분**을\n많이')
    chain(sc, [(T(115) + .2, '좋게 말씀하기'), (T(116), '불편한 부분 많이'), (T(117), '빨리 고치기'), (T(118), '판매할 수 있는 수준')], vertical=True, fs=A(44, 44), gap=A(14, 12),
          colors=['#5F6670', '#B89032', '#A9B1BC', '#B89032'])

    # B21a 중요한 기준
    sc = scene(T(120), T(124), 'S')
    header(sc, '팀장님 의견은', '제품 방향의\n**중요한 기준**')
    chips(sc, [(T(120) + .2, '일반 사용자 한 명의 의견', '#8a95a1', None, T(121) + .4), (T(122), '초기 제품 방향의 중요한 기준', None)],
          box=A((60, 620, 960, 500), (740, 220, 1100, 400)), cls='chip', align='center', valign='center', gap=40, fs=A(46, 48))

    # B21b 당분간 둘이 먼저
    sc = scene(T(124), T(127))
    header(sc, '당분간', '**팀장님하고 저**\n둘이 먼저')
    cx = VZ[0] + VZ[2] / 2
    chips(sc, [(T(124), '다른 분께는 아직 비공개', '#8a95a1')], box=div_box(cx, A(560, 150)), align='center')
    person(sc, cx - A(170, 200), A(800, 400), A(150, 160), '대표', '저', T(125), lfs=30)
    person(sc, cx + A(170, 200), A(800, 400), A(150, 160), '최', '은혜 팀장님', T(125) + .3, hi=True, lfs=30)
    chips(sc, [(T(126), '제대로 만들어 보겠습니다', None)], box=div_box(cx, A(1060, 650)), align='center', cls='chip hi')

    # B22 마무리
    sc = scene(T(127), DUR)
    if TALL:
        text(sc, 80, 520, 920, '작은 것이라도\n**전부 말씀해 주세요**', T(128), 'h1', style='text-align:center;font-size:80px')
        text(sc, 80, 860, 920, '감사합니다', T(129), 'h2', style='text-align:center;color:var(--hi)')
        logo(sc, 290, 1040, 500, T(129) + .4)
    else:
        text(sc, 160, 250, 1600, '작은 것이라도 **전부 말씀해 주세요**', T(128), 'h1', style='text-align:center;font-size:76px')
        text(sc, 160, 420, 1600, '감사합니다', T(129), 'h2', style='text-align:center;color:var(--hi)')
        logo(sc, 685, 560, 550, T(129) + .4)


# ---------------------------------------------------------------- 도움 함수(장면에서 씀)
def div_box(cx, cy, w=None, h=140):
    w = w or A(940, 1100)
    return (cx - w / 2, cy - h / 2, w, h)


def client_rows():
    """고객 관리 현황표의 업체 줄 위치"""
    els = GEO['pc-clients']['els']
    rows = [e for e in els if e['tag'] in ('li', 'tr', 'article') and e['y'] > 480 and e['w'] > 800]
    rows.sort(key=lambda e: e['y'])
    if len(rows) < 2:
        return [(328, 520, 1057, 120), (328, 650, 1057, 120)]
    return [(r['x'], r['y'], r['w'], r['h']) for r in rows[:2]]


def btn_rect(shot, label, default=None):
    for e in GEO[shot]['els']:
        if e['text'].startswith(label) and e['w'] < 600:
            return (e['x'], e['y'], e['w'], e['h'])
    if default:
        return default
    raise SystemExit(f'단추 없음: {shot} {label}')


def side_rect(label):
    for e in GEO['pc-sidebar-upcoming']['els']:
        if e['text'].startswith(label):
            return (e['x'], e['y'], e['w'], e['h'])
    return (12, 680, 264, 44)


def price_rows(sc, rows, top):
    """가격 막대 — (시각, 이름, 값, 길이 0~1, 범위 표시)"""
    x0, w0 = (VZ[0] + 20, VZ[2] - 40)
    lw, vw_ = A(200, 220), A(300, 320)
    bw = w0 - lw - vw_ - 40
    for i, (t, name, val, frac, dash) in enumerate(rows):
        y = top + i * A(170, 150)
        sc.add(f'<div class="abs" style="left:{x0}px;top:{y}px;width:{w0}px;height:110px;display:flex;align-items:center;gap:20px" {at(t, a="left")}>'
               f'<div style="width:{lw}px;font-size:40px;font-weight:800;flex:none">{name}</div>'
               f'<div class="bar" style="width:{bw}px;height:40px;border-radius:20px;flex:none"><div class="fill{" dash" if dash else ""}" style="border-radius:20px" data-grow="{t + .2:.2f},{t + 1.2:.2f},{bw * frac:.0f}"></div></div>'
               f'<div style="width:{vw_}px;font-size:{A(40, 42)}px;font-weight:850;color:var(--hi);flex:none;white-space:nowrap">{val}</div></div>')


# ---------------------------------------------------------------- 내보내기
(video_a if K == 'a' else video_b)()

subs = [[round(s['in'], 3), round(s['out'], 3), s['text']] for s in SUBS]
tpl = open(f'{HERE}/comp.tpl.html', encoding='utf-8').read()
out = (tpl.replace('/*W*/', str(W)).replace('/*H*/', str(H)).replace('/*ASPECT*/', ASPECT)
       .replace('/*SUBS*/', json.dumps(subs, ensure_ascii=False)).replace('/*DUR*/', str(DUR))
       .replace('<!--SCENES-->', '\n'.join(s.render() for s in SCENES)).replace('<!--GUIDES-->', ''))
path = f'{WORK}/comp_{K}_{ASPECT}.html'
open(path, 'w', encoding='utf-8').write(out)
print(path, 'DUR', DUR, '장면', len(SCENES))
