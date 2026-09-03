"""
Turns the USDZ car packs into data the game can load.

Run once, offline, and commit what it writes. It is a build-time tool, not
part of the game: the game has no USD parser and never sees a .usdz.

What comes out is one binary blob per vehicle -- quantised positions, a colour
per vertex, and an index list -- base64'd into a TypeScript module. Normals are
not stored: the mesh builder computes a flat normal per triangle, which is what
these models want anyway and saves a quarter of the file.

Colour comes from the material. Where a material has a texture, the triangle's
UV centroid is sampled from it, which works because a low-poly pack's atlas is
flat patches rather than gradients; where it has none, the diffuse colour is
used directly.

    pip install usd-core pillow
    python3 tools/import-usdz.py <dir-of-usdz> src/assets/fleet-data.ts
"""

import base64
import io
import json
import struct
import sys
import zipfile
from pathlib import Path

from pxr import Usd, UsdGeom, UsdShade, Gf
from PIL import Image

# Which vehicles to take, and what to call them in the library. Real
# manufacturer names are trademarks, and the rest of this project's brands are
# fictional on purpose, so each model is named for what it is instead.
WANTED = {
    'Ultimate_Low-Poly_Car_Pack.usdz': {
        'Zenvo': ('car.hypercar', 'Hypercar', 4.7),
        'Sterrato': ('car.rallysuper', 'Rally supercar', 4.6),
        'Artura': ('car.midsuper', 'Mid-engined supercar', 4.6),
        'Mercedes': ('car.luxsaloon', 'Luxury saloon', 5.0),
        'Ford': ('car.hothatch', 'Hot hatch', 4.4),
        'Ferrari': ('car.supercar', 'Supercar', 4.7),
        'Land_Rover': ('car.luxsuv', 'Luxury SUV', 5.0),
    },
    'Low_poly_cars_pack (1).usdz': {
        'Transport1': ('car.boxtruck', 'Box truck', 6.6),
        'Transport2': ('car.icecream', 'Ice cream van', 5.4),
        'Transport3': ('car.ambulance', 'Ambulance', 5.9),
        'Transport4': ('car.oldsaloon', 'Old saloon', 4.6),
        'Transport5': ('car.bubblecar', 'Bubble car', 4.1),
        'Transport6': ('car.police', 'Police car', 4.8),
        'Transport7': ('car.compactsuv', 'Compact SUV', 4.3),
    },
}
# The third pack is one object per vehicle. Objects past the mid forties are
# loose parts laid out flat -- wheels, panels, a parts sheet -- rather than
# vehicles, so only the road-going ones are taken.
THIRD = 'Low_Poly_cars_pack.usdz'
THIRD_WANTED = {
    'Object_0': ('car.saloon', 'Saloon', 4.7),
    'Object_2': ('car.hatchback', 'Hatchback', 4.1),
    'Object_7': ('car.pickup', 'Pickup truck', 5.4),
    'Object_12': ('car.van', 'Panel van', 5.4),
    'Object_18': ('car.sedan', 'Sedan', 4.8),
    'Object_27': ('car.pickup4x4', 'Off-road pickup', 5.6),
    'Object_28': ('car.trailer', 'Tipping trailer', 4.4),
}


def texture_lookup(usdz_path):
    """Every image in the archive, by file name, loaded once."""
    out = {}
    with zipfile.ZipFile(usdz_path) as z:
        for n in z.namelist():
            if n.lower().endswith(('.jpg', '.jpeg', '.png')):
                out[Path(n).name] = Image.open(io.BytesIO(z.read(n))).convert('RGB')
    return out


def material_colour(prim, textures):
    """(rgb, image) for a mesh: a flat colour, a texture, or a mid grey."""
    mat = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()[0]
    if not mat:
        return (0.6, 0.6, 0.6), None
    surf = mat.GetSurfaceOutput()
    src = surf.GetConnectedSources()[0] if surf else None
    if not src:
        return (0.6, 0.6, 0.6), None
    shader = UsdShade.Shader(src[0].source)
    diff = shader.GetInput('diffuseColor')
    if diff:
        conn = diff.GetConnectedSources()[0]
        if conn:
            tex = UsdShade.Shader(conn[0].source)
            fileIn = tex.GetInput('file')
            if fileIn and fileIn.Get() is not None:
                name = Path(str(fileIn.Get()).strip('@')).name
                if name in textures:
                    return (0.6, 0.6, 0.6), textures[name]
        val = diff.Get()
        if val is not None:
            return (float(val[0]), float(val[1]), float(val[2])), None
    return (0.6, 0.6, 0.6), None


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def collect(stage, prims, textures):
    """Triangles in world space, each with a flat colour."""
    tris = []
    for prim in prims:
        mesh = UsdGeom.Mesh(prim)
        pts = mesh.GetPointsAttr().Get()
        counts = mesh.GetFaceVertexCountsAttr().Get()
        idx = mesh.GetFaceVertexIndicesAttr().Get()
        if not pts or not counts:
            continue
        xf = UsdGeom.Xformable(prim).ComputeLocalToWorldTransform(Usd.TimeCode.Default())
        world = [xf.Transform(Gf.Vec3d(p[0], p[1], p[2])) for p in pts]
        rgb, img = material_colour(prim, textures)
        uvs = None
        for nm in ('primvars:st', 'primvars:st0', 'primvars:UVMap'):
            a = prim.GetAttribute(nm)
            if a and a.Get() is not None:
                uvs = a.Get()
                break
        base = 0
        for c in counts:
            face = [idx[base + k] for k in range(c)]
            for k in range(1, c - 1):
                corner = (face[0], face[k], face[k + 1])
                col = rgb
                if img is not None and uvs is not None and len(uvs) > max(corner):
                    u = sum(uvs[i][0] for i in corner) / 3.0
                    v = sum(uvs[i][1] for i in corner) / 3.0
                    px = int(min(max(u, 0.0), 1.0) * (img.width - 1))
                    py = int((1.0 - min(max(v, 0.0), 1.0)) * (img.height - 1))
                    r, g, b = img.getpixel((px, py))
                    col = (r / 255.0, g / 255.0, b / 255.0)
                tris.append(([world[i] for i in corner], col))
            base += c
    return tris


def pack(tris, target_len):
    """Recentre, stand on the ground, face +x, scale to a real length."""
    xs = [p[0] for t, _ in tris for p in t]
    ys = [p[1] for t, _ in tris for p in t]
    zs = [p[2] for t, _ in tris for p in t]
    ex, ey, ez = max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)
    # The longest horizontal axis is the vehicle's length; put it on x.
    swap = ez > ex
    length = max(ex, ez)
    s = target_len / length if length > 1e-6 else 1.0
    cx, cz = (max(xs) + min(xs)) / 2, (max(zs) + min(zs)) / 2
    y0 = min(ys)

    verts, index, out = {}, [], []
    for corner, col in tris:
        for p in corner:
            x, z = (p[0] - cx) * s, (p[2] - cz) * s
            if swap:
                x, z = z, -x
            key = (round(x, 4), round((p[1] - y0) * s, 4), round(z, 4),
                   round(col[0], 3), round(col[1], 3), round(col[2], 3))
            i = verts.get(key)
            if i is None:
                i = len(out)
                verts[key] = i
                out.append(key)
            index.append(i)
    return out, index


def encode(out, index):
    xs = [v[0] for v in out]
    ys = [v[1] for v in out]
    zs = [v[2] for v in out]
    lo = (min(xs), min(ys), min(zs))
    hi = (max(xs), max(ys), max(zs))
    span = [max(hi[i] - lo[i], 1e-6) for i in range(3)]
    buf = bytearray()
    for v in out:
        for i in range(3):
            q = int(round((v[i] - lo[i]) / span[i] * 65535))
            buf += struct.pack('<H', max(0, min(65535, q)))
        for i in range(3):
            buf.append(max(0, min(255, int(round(srgb_to_linear(v[3 + i]) * 255)))))
    idx = bytearray()
    wide = len(out) > 65535
    for i in index:
        idx += struct.pack('<I' if wide else '<H', i)
    return {
        'lo': [round(x, 4) for x in lo],
        'span': [round(x, 4) for x in span],
        'wide': wide,
        'verts': base64.b64encode(bytes(buf)).decode(),
        'index': base64.b64encode(bytes(idx)).decode(),
        'count': len(index),
    }


def write(models, out_path):
    body = json.dumps(models, separators=(',', ':'))
    header = (
        '/**\n'
        ' * Imported vehicle meshes.\n'
        ' *\n'
        ' * Generated by tools/import-usdz.py from the low-poly car packs; do not\n'
        ' * edit by hand. Each entry is a quantised position buffer, a colour per\n'
        ' * vertex and an index list, all base64. Normals are not stored -- the mesh\n'
        ' * builder takes a flat normal per triangle, which is what these models\n'
        ' * want anyway and saves a quarter of the file.\n'
        ' */\n\n'
        'export interface ImportedMesh {\n'
        '  name: string;\n'
        '  lo: number[];\n'
        '  span: number[];\n'
        '  wide: boolean;\n'
        '  verts: string;\n'
        '  index: string;\n'
        '  count: number;\n'
        '}\n\n'
        'export const IMPORTED: Record<string, ImportedMesh> = '
    )
    Path(out_path).write_text(header + body + ';\n')
    print('wrote', out_path, f'{Path(out_path).stat().st_size / 1024:.0f} KB')


def main(src_dir, out_path):
    src = Path(src_dir)
    models = {}
    for f, wanted in WANTED.items():
        path = src / f
        stage = Usd.Stage.Open(str(path))
        textures = texture_lookup(path)
        groups = {}
        for p in stage.Traverse():
            if not p.IsA(UsdGeom.Mesh):
                continue
            parts = str(p.GetPath()).split('/')
            if 'RootNode' not in parts:
                continue
            groups.setdefault(parts[parts.index('RootNode') + 1], []).append(p)
        for name, (aid, label, length) in wanted.items():
            if name not in groups:
                print('  missing', name)
                continue
            tris = collect(stage, groups[name], textures)
            out, index = pack(tris, length)
            models[aid] = dict(encode(out, index), name=label)
            print(f'  {aid:20s} {len(index)//3:6d} tris {len(out):6d} verts')

    path = src / THIRD
    stage = Usd.Stage.Open(str(path))
    textures = texture_lookup(path)
    for p in stage.Traverse():
        if not p.IsA(UsdGeom.Mesh):
            continue
        if p.GetName() not in THIRD_WANTED:
            continue
        aid, label, length = THIRD_WANTED[p.GetName()]
        tris = collect(stage, [p], textures)
        out, index = pack(tris, length)
        models[aid] = dict(encode(out, index), name=label)
        print(f'  {aid:20s} {len(index)//3:6d} tris {len(out):6d} verts')

    write(models, out_path)


if __name__ == '__main__':
    if len(sys.argv) > 3 and sys.argv[3] == 'survey':
        survey(sys.argv[1], sys.argv[2])
    else:
        main(sys.argv[1], sys.argv[2])
