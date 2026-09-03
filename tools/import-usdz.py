"""
Turns the USDZ car packs into data the game can load.

Run once, offline, and commit what it writes. It is a build-time tool, not
part of the game: the game has no USD parser and never sees a .usdz.

Three things this has to get right, none of them obvious from the file:

A pack is a scene, not a list of vehicles. In the largest one the car bodies
are one set of meshes and the wheels are a handful of shared meshes that each
span a whole row of cars -- so a vehicle is a body plus whatever slice of the
shared meshes stands inside its own footprint. Taking the bodies alone gives
forty-five cars with no wheels.

Most of those bodies are the same geometry with a different texture, which is
how the pack gets nine colours of one hatchback. Storing them as nine models
would be nine copies of the mesh; instead identical geometry is stored once as
a shape and each vehicle keeps only its own colour buffer.

Colour comes from the material: sampled from the texture at each triangle's UV
centroid where there is one, which works because a low-poly atlas is flat
patches rather than gradients, and taken from the diffuse colour where there
is not.

    pip install usd-core pillow
    python3 tools/import-usdz.py <dir-of-usdz> src/assets/fleet-data.ts
"""

import base64
import hashlib
import io
import json
import struct
import sys
import zipfile
from pathlib import Path

from pxr import Usd, UsdGeom, UsdShade, Gf
from PIL import Image

PACKS = ['Ultimate_Low-Poly_Car_Pack.usdz', 'Low_poly_cars_pack (1).usdz',
         'Low_Poly_cars_pack.usdz']

# What each shape is, once it has been identified by rendering it. Keyed by the
# name of the first body mesh that produced the shape. Real manufacturer names
# are trademarks and every brand in this library is fictional on purpose, so
# the models are named for what they are.
NAMES = {
    'Zenvo': ('hypercar', 'Hypercar', 4.7),
    'Sterrato': ('rallysuper', 'Rally supercar', 4.6),
    'Artura': ('midsuper', 'Mid-engined supercar', 4.6),
    'Mercedes': ('luxsaloon', 'Luxury saloon', 5.0),
    'Ford': ('hothatch', 'Hot hatch', 4.4),
    'Ferrari': ('supercar', 'Supercar', 4.7),
    'Land_Rover': ('luxsuv', 'Luxury SUV', 5.0),
    'Transport1': ('boxtruck', 'Box truck', 6.6),
    'Transport2': ('icecream', 'Ice cream van', 5.4),
    'Transport3': ('ambulance', 'Ambulance', 5.9),
    'Transport4': ('oldsaloon', 'Old saloon', 4.6),
    'Transport5': ('bubblecar', 'Bubble car', 4.1),
    'Transport6': ('police', 'Police car', 4.8),
    'Transport7': ('compactsuv', 'Compact SUV', 4.3),
    'Object_0': ('saloon', 'Saloon', 4.7),
    'Object_2': ('hatchback', 'Hatchback', 4.0),
    'Object_7': ('pickup', 'Pickup truck', 5.4),
    'Object_12': ('van', 'Panel van', 5.4),
    'Object_18': ('estate', 'Estate', 4.8),
    'Object_27': ('pickup4x4', 'Off-road pickup', 5.6),
    'Object_28': ('trailer', 'Tipping trailer', 4.4),
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
            f = tex.GetInput('file')
            if f and f.Get() is not None:
                name = Path(str(f.Get()).strip('@')).name
                if name in textures:
                    return (0.6, 0.6, 0.6), textures[name]
        val = diff.Get()
        if val is not None:
            return (float(val[0]), float(val[1]), float(val[2])), None
    return (0.6, 0.6, 0.6), None


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def read_mesh(prim, textures):
    """World-space triangles with a flat colour each, plus the bounding box."""
    mesh = UsdGeom.Mesh(prim)
    pts = mesh.GetPointsAttr().Get()
    counts = mesh.GetFaceVertexCountsAttr().Get()
    idx = mesh.GetFaceVertexIndicesAttr().Get()
    if not pts or not counts:
        return [], None
    xf = UsdGeom.Xformable(prim).ComputeLocalToWorldTransform(Usd.TimeCode.Default())
    world = [xf.Transform(Gf.Vec3d(p[0], p[1], p[2])) for p in pts]
    rgb, img = material_colour(prim, textures)
    uvs = None
    for nm in ('primvars:st', 'primvars:st0', 'primvars:UVMap'):
        a = prim.GetAttribute(nm)
        if a and a.Get() is not None:
            uvs = a.Get()
            break
    tris, base = [], 0
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
    xs = [p[0] for t, _ in tris for p in t]
    ys = [p[1] for t, _ in tris for p in t]
    zs = [p[2] for t, _ in tris for p in t]
    box = (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)) if tris else None
    return tris, box


def vehicles_in(path):
    """Groups of triangles, one per vehicle, keyed by the body mesh's name."""
    stage = Usd.Stage.Open(str(path))
    textures = texture_lookup(path)
    groups = {}
    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh):
            continue
        parts = str(prim.GetPath()).split('/')
        key = parts[parts.index('RootNode') + 1] if 'RootNode' in parts else prim.GetName()
        groups.setdefault(key, []).append(prim)

    read = {}
    for key, prims in groups.items():
        tris, boxes = [], []
        for p in prims:
            t, b = read_mesh(p, textures)
            tris += t
            if b:
                boxes.append(b)
        if not tris:
            continue
        box = (min(b[0] for b in boxes), max(b[1] for b in boxes),
               min(b[2] for b in boxes), max(b[3] for b in boxes),
               min(b[4] for b in boxes), max(b[5] for b in boxes))
        read[key] = (tris, box)

    # A body is a group whose plan is about the size of a vehicle. A shared
    # parts mesh -- the wheels for a whole row -- is much longer than it is
    # wide, or much wider than any single car, so it fails that test.
    span = lambda b: (b[1] - b[0], b[5] - b[4])
    sizes = sorted(max(span(b)) for _, b in read.values())
    typical = sizes[len(sizes) // 2]
    bodies, shared = {}, {}
    for key, (tris, box) in read.items():
        w, d = span(box)
        bodies[key] = (tris, box) if max(w, d) < typical * 2.2 else None
        if bodies[key] is None:
            shared[key] = tris
        else:
            bodies[key] = (tris, box)
    bodies = {k: v for k, v in bodies.items() if v is not None}

    # Assign each shared triangle to the nearest body rather than to every
    # body whose padded box it happens to fall in. Overlapping boxes let one
    # car pick up its neighbour's wheels, which is invisible in a render and
    # fatal to shape sharing: two cars of the same model then hash differently
    # and the pack stores forty copies of one hatchback.
    out = {key: list(tris) for key, (tris, _) in bodies.items()}
    centres = [(key, (box[0] + box[1]) / 2, (box[4] + box[5]) / 2)
               for key, (_, box) in bodies.items()]
    reach = max(max(span(box)) for _, box in bodies.values()) * 1.2
    for tset in shared.values():
        for corner, col in tset:
            cx = sum(p[0] for p in corner) / 3.0
            cz = sum(p[2] for p in corner) / 3.0
            key, d = min(((k, (cx - x) ** 2 + (cz - z) ** 2) for k, x, z in centres),
                         key=lambda kv: kv[1])
            if d <= reach * reach:
                out[key].append((corner, col))
    return out


def pack_vehicle(tris, target_len):
    """Recentre, stand on the ground, face +x, scale to a real length."""
    xs = [p[0] for t, _ in tris for p in t]
    ys = [p[1] for t, _ in tris for p in t]
    zs = [p[2] for t, _ in tris for p in t]
    ex, ez = max(xs) - min(xs), max(zs) - min(zs)
    swap = ez > ex
    s = target_len / max(ex, ez, 1e-6)
    cx, cz, y0 = (max(xs) + min(xs)) / 2, (max(zs) + min(zs)) / 2, min(ys)

    seen, order, index = {}, [], []
    for corner, col in tris:
        for p in corner:
            x, z = (p[0] - cx) * s, (p[2] - cz) * s
            if swap:
                x, z = z, -x
            key = (round(x, 4), round((p[1] - y0) * s, 4), round(z, 4),
                   round(col[0], 3), round(col[1], 3), round(col[2], 3))
            i = seen.get(key)
            if i is None:
                i = len(order)
                seen[key] = i
                order.append(key)
            index.append(i)
    return order, index


def b64(b):
    return base64.b64encode(bytes(b)).decode()


def geo_hash(tris):
    """
    Identity of a shape: where its triangles are, and nothing else.

    Colour is deliberately not in it -- the whole point is that nine liveries
    of one hatchback come out as one shape. Neither is triangle order, because
    a vehicle's wheels are sliced out of a mesh shared with its neighbours and
    arrive in whatever order that mesh happened to store them. So: recentre,
    scale to unit length, round to a few millimetres, sort.
    """
    xs = [p[0] for t, _ in tris for p in t]
    ys = [p[1] for t, _ in tris for p in t]
    zs = [p[2] for t, _ in tris for p in t]
    ex, ez = max(xs) - min(xs), max(zs) - min(zs)
    s = 1.0 / max(ex, ez, 1e-6)
    cx, cz, y0 = (max(xs) + min(xs)) / 2, (max(zs) + min(zs)) / 2, min(ys)
    rows = []
    for corner, _ in tris:
        rows.append(tuple(sorted(
            (round((p[0] - cx) * s, 3), round((p[1] - y0) * s, 3),
             round((p[2] - cz) * s, 3)) for p in corner)))
    return hashlib.sha1(json.dumps(sorted(rows)).encode()).hexdigest()[:12]


def main(src_dir, out_path):
    src = Path(src_dir)

    # Read every vehicle in every pack first. A pack is mostly one body in
    # several liveries, and only one of those liveries carries the mesh name
    # NAMES knows; the others have to be recognised by their geometry. So the
    # grouping is done on a length-normalised copy -- scaling to a real length
    # can't come first, because a variant would not know which length to use
    # and a millimetre of difference puts it in a group of its own. That was
    # the bug that dropped fifty-nine vehicles to twenty-one.
    found = []
    for f in PACKS:
        print('==', f)
        for key, tris in vehicles_in(src / f).items():
            found.append((key, tris, geo_hash(tris)))
            print(f'  read {key:14s} {len(tris):6d} tris')

    # One spec per geometry group, from whichever member of it is named.
    spec_of = {}
    for key, _, norm in found:
        if key in NAMES:
            spec_of.setdefault(norm, NAMES[key])
    unnamed = 0
    for _, _, norm in found:
        if norm not in spec_of:
            unnamed += 1
            spec_of[norm] = (f'other{unnamed}', f'Car {unnamed}', 4.6)

    shapes, models, counts = {}, {}, {}
    for key, tris, norm in found:
        spec = spec_of[norm]
        order, index = pack_vehicle(tris, spec[2])
        # Whatever is left of a shared parts mesh after every body has taken
        # its own wheels is a strip of loose spares lying on the ground. It
        # passes the size test -- it is car-sized -- but nothing that stands
        # under a metre tall once scaled is a vehicle.
        if max(v[1] for v in order) < 0.9:
            print(f'  skip {key} ({len(index)//3} tris of loose parts)')
            continue
        # Positions are shared; only the colour buffer differs per livery, and
        # the vertex dedup keys on colour too, so a shape is only reusable when
        # the buffers line up exactly. Cache the first one under the group.
        geo = norm
        if geo not in shapes:
            xs = [v[0] for v in order]
            ys = [v[1] for v in order]
            zs = [v[2] for v in order]
            lo = (min(xs), min(ys), min(zs))
            span = [max(max(x) - min(x), 1e-6) for x in (xs, ys, zs)]
            buf = bytearray()
            for v in order:
                for i in range(3):
                    q = int(round((v[i] - lo[i]) / span[i] * 65535))
                    buf += struct.pack('<H', max(0, min(65535, q)))
            wide = len(order) > 65535
            ib = bytearray()
            for i in index:
                ib += struct.pack('<I' if wide else '<H', i)
            shapes[geo] = {
                'lo': [round(x, 4) for x in lo],
                'span': [round(x, 4) for x in span],
                'wide': wide,
                'verts': b64(buf),
                'index': b64(ib),
                'count': len(index),
                'label': spec[0],
            }
        cbuf = bytearray()
        for v in order:
            for i in range(3):
                cbuf.append(max(0, min(255, int(round(srgb_to_linear(v[3 + i]) * 255)))))
        base = spec[0]
        n = counts[base] = counts.get(base, 0) + 1
        # Second and later liveries take a dash rather than a bare digit, so
        # 'other1' and its second copy don't collide with the group 'other12'.
        aid = f'car.{base}' + ('' if n == 1 else f'-{n}')
        # Liveries of a named shape number ('Saloon 2'); liveries of an
        # unnamed one letter, because 'Car 9 2' reads as two numbers.
        suffix = '' if n == 1 else \
            chr(ord('a') + n - 1) if spec[1][-1].isdigit() else f' {n}'
        models[aid] = {
            'name': spec[1] + suffix,
            'shape': geo,
            'colour': b64(cbuf),
        }
        print(f'  {aid:22s} {len(index)//3:6d} tris  shape {geo}')

    body = json.dumps({'shapes': shapes, 'models': models}, separators=(',', ':'))
    header = (
        '/**\n'
        ' * Imported vehicle meshes.\n'
        ' *\n'
        ' * Generated by tools/import-usdz.py from the low-poly car packs; do not\n'
        ' * edit by hand.\n'
        ' *\n'
        ' * A shape is a quantised position buffer and an index list; a model is a\n'
        ' * shape plus a colour per vertex. Most of the pack is one body in several\n'
        ' * liveries, so splitting them this way stores the geometry once and pays\n'
        ' * three bytes a vertex for each extra colour rather than nine.\n'
        ' *\n'
        ' * Normals are not stored: the mesh builder takes a flat normal per\n'
        ' * triangle, which is what these models want anyway.\n'
        ' */\n\n'
        'export interface ImportedShape {\n'
        '  lo: number[];\n  span: number[];\n  wide: boolean;\n'
        '  verts: string;\n  index: string;\n  count: number;\n  label: string;\n'
        '}\n\n'
        'export interface ImportedModel {\n'
        '  name: string;\n  shape: string;\n  colour: string;\n'
        '}\n\n'
        'export const FLEET_DATA: { shapes: Record<string, ImportedShape>;'
        ' models: Record<string, ImportedModel> } = '
    )
    Path(out_path).write_text(header + body + ';\n')
    print('wrote', out_path, f'{Path(out_path).stat().st_size / 1024:.0f} KB')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
