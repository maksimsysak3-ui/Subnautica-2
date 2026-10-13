# Packs the generated recruit portraits into college/src/recruitfaces.ts.
# Input: sheets of 5x10 head-and-shoulders crops (160x200 each) as an RGB jpg plus an alpha jpg
# (from the background-removal step). Output: one transparent WebP data URI per face.
# Usage: python3 tools/recruit-faces.py <dir with h0.jpg,a0.jpg,...> [skip indices, comma separated]
import sys, glob, base64, io, os
from PIL import Image
src = sys.argv[1]; skip = set(int(x) for x in (sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] else []))
out, k = [], 0
for i in range(100):
    h, a = os.path.join(src, f'h{i}.jpg'), os.path.join(src, f'a{i}.jpg')
    if not os.path.exists(h): break
    rgb, al = Image.open(h).convert('RGB'), Image.open(a).convert('L')
    for r in range(rgb.height // 200):
        for c in range(5):
            box = (c * 160, r * 200, c * 160 + 160, r * 200 + 200)
            al_t = al.crop(box)
            if al_t.getextrema()[1] < 40: continue          # empty slot at the end of a sheet
            if k not in skip:
                im = rgb.crop(box).convert('RGBA'); im.putalpha(al_t)
                im = im.resize((128, 160), Image.LANCZOS)
                buf = io.BytesIO(); im.save(buf, 'WEBP', quality=72, method=6)
                out.append('data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode())
            k += 1
with open('college/src/recruitfaces.ts', 'w') as f:
    f.write('// AI-generated portraits of fictional high school recruits (not real people), background removed.\n')
    f.write('// A separate set from the pro game\'s faces. Built by tools/recruit-faces.py.\n')
    f.write('export const RECRUIT_FACES: string[] = [\n' + ',\n'.join(f"'{u}'" for u in out) + ',\n];\n')
print(len(out), 'faces', sum(len(u) for u in out) // 1024, 'KB')
