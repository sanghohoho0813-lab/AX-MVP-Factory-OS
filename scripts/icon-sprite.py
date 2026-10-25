# D-284 대표 아이콘 → 메뉴용 한 장 그림. 원본 zip 을 푼 폴더(파일 이름 순서 = 칸 순서 01 ~ 21)
#   python3 scripts/icon-sprite.py <폴더> src/assets/icons/feature-icons.webp 128   (Pillow 필요 — 저장소 의존성 아님)
import sys, glob, os
from PIL import Image
src, out, cell = sys.argv[1], sys.argv[2], int(sys.argv[3])
files = sorted(glob.glob(os.path.join(src, '*.png')))
assert len(files) == 21, len(files)
sheet = Image.new('RGBA', (cell * len(files), cell), (0, 0, 0, 0))
for i, f in enumerate(files):
    im = Image.open(f).convert('RGBA')
    bbox = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    im = im.crop(bbox)
    side = int(max(im.size) * 1.06)  # 둘레 3% 여백
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
    small = sq.convert('RGBa').resize((cell, cell), Image.LANCZOS, reducing_gap=3.0).convert('RGBA')
    sheet.alpha_composite(small, (i * cell, 0))
    print(i, os.path.basename(f))
sheet.save(out, 'WEBP', quality=85, method=6, alpha_quality=90)
print('webp', os.path.getsize(out))
