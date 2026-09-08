"""
How faithful an import is, as a number.

`import-usdz.py` turns a textured model into flat-coloured facets, and whether
it did that well was, until this existed, a matter of opening the asset viewer
and squinting at a vehicle's flank. That is a bad way to tune a subdivision
rule: the livery bug that put red triangles up the side of every ambulance in
the fleet survived three rounds of "that looks better" precisely because it
was never measured, and two of the three things changed to fix it turned out
to make no difference at all.

So this renders the same vehicle twice from the same camera -- once sampling
its texture per pixel, which is what the model actually looks like, and once
from the facets the importer produced -- and reports the mean colour error
between them, and how much of the vehicle is badly wrong rather than slightly
wrong. Both numbers move the right way for the right reasons, and the paired
image it writes shows where the remaining error is.

    pip install usd-core pillow numpy
    python3 tools/import-check.py <pack.usdz> [vehicle ...] [--png DIR]

With no vehicle named it does every vehicle in the pack. `IMPORTER=<path>`
points it at a different copy of `import-usdz.py`, which is how a change to
the subdivision rules is compared against the one in the tree.
"""

import importlib.util
import math
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from pxr import Usd, UsdGeom, Gf

WIDE, HIGH = 1100, 460

_here = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    'importer', os.environ.get('IMPORTER', _here / 'import-usdz.py'))
imp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(imp)


def linear_to_srgb(c):
    c = 0.0 if c < 0.0 else (1.0 if c > 1.0 else c)
    return c * 12.92 if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def vehicles_in_stage(stage):
    """Every top-level vehicle name in the pack, in file order."""
    out = []
    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh):
            continue
        parts = str(prim.GetPath()).split('/')
        if 'RootNode' not in parts:
            continue
        name = parts[parts.index('RootNode') + 1]
        if name not in out:
            out.append(name)
    return out


def camera(pts):
    """
    The vehicle's own side view.

    These models sit at whatever angle they were laid out at in the pack, so
    the view has to be derived rather than assumed: the long axis of the
    footprint is the vehicle's length, and looking across it is the elevation
    a livery is painted for.
    """
    cx = sum(p[0] for p in pts) / len(pts)
    cz = sum(p[2] for p in pts) / len(pts)
    sxx = sum((p[0] - cx) ** 2 for p in pts)
    szz = sum((p[2] - cz) ** 2 for p in pts)
    sxz = sum((p[0] - cx) * (p[2] - cz) for p in pts)
    yaw = 0.5 * math.atan2(2 * sxz, sxx - szz)
    ca, sa = math.cos(-yaw), math.sin(-yaw)

    def proj(p):
        x, z = p[0] - cx, p[2] - cz
        return (x * ca - z * sa, p[1], x * sa + z * ca)
    return proj


def rasterise(faces, proj, ex, scale):
    """A z-buffered image of (points, shader) faces. The shader gets barycentrics."""
    img = np.full((HIGH, WIDE, 3), 26, np.float32)
    seen = np.zeros((HIGH, WIDE), bool)
    depth = np.full((HIGH, WIDE), -1e30, np.float32)
    ys, xs = np.mgrid[0:HIGH, 0:WIDE]
    for points, shade in faces:
        q = [proj(p) for p in points]
        sxy = [((v[0] - ex[0][0]) * scale + 12, HIGH - 16 - (v[1] - ex[1][0]) * scale)
               for v in q]
        (x0, y0), (x1, y1), (x2, y2) = sxy
        lo_x, hi_x = int(max(0, min(x0, x1, x2))), int(min(WIDE - 1, max(x0, x1, x2)) + 1)
        lo_y, hi_y = int(max(0, min(y0, y1, y2))), int(min(HIGH - 1, max(y0, y1, y2)) + 1)
        if hi_x <= lo_x or hi_y <= lo_y:
            continue
        den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(den) < 1e-9:
            continue
        bx = xs[lo_y:hi_y, lo_x:hi_x]
        by = ys[lo_y:hi_y, lo_x:hi_x]
        a = ((y1 - y2) * (bx - x2) + (x2 - x1) * (by - y2)) / den
        b = ((y2 - y0) * (bx - x2) + (x0 - x2) * (by - y2)) / den
        c = 1 - a - b
        hit = (a >= 0) & (b >= 0) & (c >= 0)
        if not hit.any():
            continue
        zz = a * q[0][2] + b * q[1][2] + c * q[2][2]
        hit &= zz > depth[lo_y:hi_y, lo_x:hi_x]
        if not hit.any():
            continue
        px = shade(a, b, c)
        if px.shape[-1] == 4:
            hit &= px[..., 3] >= 128
            if not hit.any():
                continue
        img[lo_y:hi_y, lo_x:hi_x][hit] = px[..., :3][hit]
        seen[lo_y:hi_y, lo_x:hi_x][hit] = True
        depth[lo_y:hi_y, lo_x:hi_x][hit] = zz[hit]
    return img, seen


def check(stage, textures, name, png_dir):
    raw = []
    truth = []
    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh):
            continue
        parts = str(prim.GetPath()).split('/')
        if 'RootNode' not in parts or parts[parts.index('RootNode') + 1] != name:
            continue
        raw += imp.read_mesh(prim, textures)[0]
        _rgb, image, _tn = imp.material_colour(prim, textures)
        if image is None:
            continue
        arr = np.asarray(image.convert('RGBA')).astype(np.float32)
        mesh = UsdGeom.Mesh(prim)
        counts = list(mesh.GetFaceVertexCountsAttr().Get())
        index = list(mesh.GetFaceVertexIndicesAttr().Get())
        uvs = UsdGeom.PrimvarsAPI(prim).GetPrimvar('primvars:st0').Get()
        xform = UsdGeom.Xformable(prim).ComputeLocalToWorldTransform(Usd.TimeCode.Default())
        world = [xform.Transform(Gf.Vec3d(*p)) for p in mesh.GetPointsAttr().Get()]
        at = 0
        for n in counts:
            face = index[at:at + n]
            at += n
            for k in range(1, n - 1):
                tri = [face[0], face[k], face[k + 1]]
                uv = [uvs[i] for i in tri]

                def shade(a, b, c, uv=uv, arr=arr):
                    u = a * uv[0][0] + b * uv[1][0] + c * uv[2][0]
                    v = a * uv[0][1] + b * uv[1][1] + c * uv[2][1]
                    th, tw = arr.shape[0], arr.shape[1]
                    return arr[np.clip(((1 - v) * (th - 1)).astype(int), 0, th - 1),
                               np.clip((u * (tw - 1)).astype(int), 0, tw - 1)]
                truth.append(([world[i] for i in tri], shade))
    if not raw:
        return None
    emitted = imp.subdivide(raw)

    pts = [p for t in raw for p in t[0]]
    proj = camera(pts)
    flat = [proj(p) for p in pts]
    ex = [(min(v[i] for v in flat), max(v[i] for v in flat)) for i in range(3)]
    scale = min(WIDE / (ex[0][1] - ex[0][0]), HIGH / (ex[1][1] - ex[1][0])) * 0.94

    want, saw_a = rasterise(truth, proj, ex, scale)
    got, saw_b = rasterise(
        [(p, (lambda a, b, c, col=np.array(
            [linear_to_srgb(v) * 255 for v in cols[0]], np.float32):
              np.broadcast_to(col, a.shape + (3,))))
         for p, cols in emitted], proj, ex, scale)

    both = saw_a & saw_b
    err = np.abs(want - got).mean(axis=2)[both]
    if png_dir:
        out = Image.new('RGB', (WIDE, HIGH * 2))
        out.paste(Image.fromarray(want.astype(np.uint8)), (0, 0))
        out.paste(Image.fromarray(got.astype(np.uint8)), (0, HIGH))
        out.save(Path(png_dir) / f'check_{name}.png')
    return len(raw), len(emitted), err.mean(), 100.0 * (err > 40).mean()


def main(argv):
    png_dir = None
    if '--png' in argv:
        i = argv.index('--png')
        png_dir = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    pack = Path(argv[0])
    names = argv[1:]
    textures = imp.texture_lookup(pack)
    stage = Usd.Stage.Open(str(pack))
    names = names or vehicles_in_stage(stage)
    print(f'{"vehicle":16s} {"facets":>16s} {"error":>8s} {"bad":>7s}')
    worst = 0.0
    for name in names:
        got = check(stage, textures, name, png_dir)
        if got is None:
            print(f'{name:16s} not in the pack')
            continue
        src, out, err, bad = got
        worst = max(worst, err)
        print(f'{name:16s} {src:6d} -> {out:6d} {err:7.1f} {bad:6.1f}%')
    print(f'\nworst mean colour error {worst:.1f}/255')


if __name__ == '__main__':
    main(sys.argv[1:])
