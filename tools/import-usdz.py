"""
Turns the USDZ car packs into data the game can load.

Run once, offline, and commit what it writes. It is a build-time tool, not
part of the game: the game has no USD parser and never sees a .usdz.

The hard part is that a pack is a scene, not a list of vehicles, and none of
the three is arranged the way you would hope. In one, a mesh is a whole row of
cars' worth of wheels. In another the meshes are merged BY MATERIAL across the
entire scene, so one "mesh" is every windscreen in the pack and another is
every body panel. Only the smallest has one mesh per vehicle.

So nothing here trusts the mesh boundaries. Every triangle in the pack is
thrown into one pile and the pile is cut back into vehicles geometrically: bin
the triangles on a coarse grid, join touching bins, and each connected island
is a vehicle. Islands too big to be one vehicle -- two cars parked close
enough to touch -- are cut again at the widest gap across them. An earlier
version tried to tell bodies from shared parts by their size and hand each
body the wheels nearest it, and it swapped roofs between neighbours and tore
panels off half the pack.

Scale is per pack, not per vehicle: the median vehicle in a pack is taken to
be 4.5m and everything else is measured against it, so a box truck comes out
bigger than a hatchback instead of every model being stretched to a length
somebody typed in.

Most bodies are the same geometry in a different livery, which is how a pack
gets nine colours of one hatchback. Identical geometry is stored once as a
shape and each vehicle keeps only its own colour buffer.

Colour comes from the material: sampled from the texture at each triangle's UV
centroid where there is one, which works because a low-poly atlas is flat
patches rather than gradients, and taken from the diffuse colour where there
is not.

    pip install usd-core pillow
    python3 tools/import-usdz.py <dir-of-usdz> src/assets/fleet-data.ts
"""

import base64
import math
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

#: Every vehicle in a pack is measured against this one, in metres.
TYPICAL = 4.5

#: Source variants to leave out, by the hash of their packed geometry.
#:
#: Three liveries of the small van have their cab glazing, grille and lamps
#: painted the body colour in the pack's own texture -- the front of the van is
#: one flat sheet of red, teal or brown with no windscreen in it. Nothing in
#: the import can recover what the artist did not put there, and the automatic
#: test for it ("much less glass than my siblings") threw away good cars to
#: catch these, so they are named outright instead. The hash is of the geometry
#: after packing, which is stable across runs.
DROP_SHAPES = {
    'd1056e32904a',                        # small van, red livery
    '5ab7d2f06a62',                        # small van, teal livery
    'd7830ed2d51b',                        # small van, brown livery
}


#: What to call a shape, from its measurements.
#:
#: Real manufacturer names are trademarks and every brand in this library is
#: fictional on purpose, so a model is named for what it is. Height over length
#: does most of the work: it is about 0.24 on a supercar, 0.32 on a saloon,
#: 0.38 on an SUV and 0.45 upwards on a van, and it does not care how big the
#: pack drew things.
def classify(length, height):
    """The key and label for a vehicle of these measurements, in metres."""
    ratio = height / max(length, 1e-6)
    if length >= 6.0:
        return 'truck', 'Truck'
    if ratio >= 0.42:
        return ('van', 'Van') if length >= 4.2 else ('microvan', 'Small van')
    if ratio >= 0.355:
        return ('suv', 'SUV') if length >= 4.2 else ('crossover', 'Crossover')
    if ratio <= 0.285:
        return 'sports', 'Sports car'
    if length < 3.8:
        return 'citycar', 'City car'
    if length >= 4.7:
        return 'estate', 'Estate'
    if length >= 4.2:
        return 'saloon', 'Saloon'
    return 'hatchback', 'Hatchback'


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
    #: Barycentric weights for sampling one facet's UV footprint.
    #:
    #: Sixteen points spread over the triangle rather than three at its
    #: corners. The corners are the worst places to read a texture: they sit
    #: exactly on the seam between two patches of the atlas, so a corner sample
    #: is as likely to pick up the neighbouring panel as the one it belongs to.
    SPREAD = [(a2 / 6, b2 / 6, 1 - a2 / 6 - b2 / 6)
              for a2 in range(1, 6) for b2 in range(1, 6 - a2)]

    tris, base = [], 0
    for c in counts:
        face = [idx[base + k] for k in range(c)]
        for k in range(1, c - 1):
            corner = (face[0], face[k], face[k + 1])
            # One colour for the whole facet: the dominant texel over its own
            # UV footprint, not a colour per corner.
            #
            # A low-poly car is a set of crisp flat planes, and a colour per
            # corner means the rasteriser gradients across every one of them --
            # which is what made the whole fleet look smeared and foggy. So the
            # facet is sampled across its area and the winner is the colour
            # that covers most of it, by mode rather than by mean: a mean of
            # two patches is a colour that appears nowhere on the car, while
            # the mode is the panel colour with the seam and the decal outvoted.
            if img is not None and uvs is not None and len(uvs) > max(corner):
                votes = {}
                for wa, wb, wc in SPREAD:
                    u = (uvs[corner[0]][0] * wa + uvs[corner[1]][0] * wb
                         + uvs[corner[2]][0] * wc)
                    v = (uvs[corner[0]][1] * wa + uvs[corner[1]][1] * wb
                         + uvs[corner[2]][1] * wc)
                    px = int(min(max(u, 0.0), 1.0) * (img.width - 1))
                    py = int((1.0 - min(max(v, 0.0), 1.0)) * (img.height - 1))
                    texel = img.getpixel((px, py))
                    # Bucketed, so two texels a shade apart count as one vote
                    # rather than splitting the panel's majority between them.
                    key = tuple(q >> 3 for q in texel)
                    hit = votes.get(key)
                    if hit is None:
                        votes[key] = [1, texel]
                    else:
                        hit[0] += 1
                n, texel = max(votes.values(), key=lambda h: h[0])
                col = tuple(srgb_to_linear(q / 255.0) for q in texel)
            else:
                # A flat diffuseColor is already linear; only a texel needs
                # converting. Running every colour through srgb_to_linear was
                # why the pack that carries no textures at all and states its
                # colours outright came out two stops dark.
                col = rgb
            tris.append(([world[i] for i in corner], [col, col, col]))
        base += c
    xs = [p[0] for t, _ in tris for p in t]
    ys = [p[1] for t, _ in tris for p in t]
    zs = [p[2] for t, _ in tris for p in t]
    box = (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)) if tris else None
    return tris, box


def all_triangles(path):
    """Every triangle in the pack, in world space, with its colour."""
    stage = Usd.Stage.Open(str(path))
    textures = texture_lookup(path)
    out = []
    for prim in stage.Traverse():
        if prim.IsA(UsdGeom.Mesh):
            out += read_mesh(prim, textures)[0]
    return out


def components(tris):
    """
    Indices of the triangles in each welded surface, as lists.

    Nothing in these packs respects vehicle boundaries -- one is merged by
    material across the whole scene, so a single "mesh" is every windscreen in
    it -- but the surfaces themselves do: a car's bodywork is one connected
    sheet of triangles and its neighbour's is another, whatever file they are
    stored in. So the vertices are welded on position and the triangles joined
    through them. This cannot cut a car in half or fuse two together, which
    every geometric guess at the same problem did.
    """
    ids, parent, faces = {}, [], []
    for corner, _ in tris:
        row = []
        for p in corner:
            k = (round(p[0], 2), round(p[1], 2), round(p[2], 2))
            if k not in ids:
                ids[k] = len(parent)
                parent.append(len(parent))
            row.append(ids[k])
        faces.append(row)

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for row in faces:
        for k in (1, 2):
            ra, rb = find(row[0]), find(row[k])
            if ra != rb:
                parent[ra] = rb
    out = {}
    for i, row in enumerate(faces):
        out.setdefault(find(row[0]), []).append(i)
    return list(out.values())


def box_of(group, tris):
    """(minx, maxx, miny, maxy, minz, maxz) of a group of triangles."""
    pts = [p for i in group for p in tris[i][0]]
    return (min(p[0] for p in pts), max(p[0] for p in pts),
            min(p[1] for p in pts), max(p[1] for p in pts),
            min(p[2] for p in pts), max(p[2] for p in pts))


def vehicles_in(path):
    """
    The vehicles in a pack, as lists of triangles, plus the pack's scale.

    Welded surfaces are the atoms; a vehicle is every surface standing on the
    same patch of ground. Two surfaces are the same vehicle when their plans
    overlap, which is true of a car's paint, trim, glass, lights and wheels and
    false of its neighbour parked half a metre away -- so the whole business
    needs no size rule and cannot mistake a long van for two cars.

    Surfaces are welded per file but not across cars, so this holds even in the
    pack whose meshes are merged by material across the entire scene.
    """
    tris = all_triangles(path)
    groups = components(tris)
    boxes = [box_of(g, tris) for g in groups]

    parent = list(range(len(groups)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    # Overlap has to be a real overlap, not a shared edge, or a row of cars
    # bumper to bumper joins up into one very long vehicle.
    scale_guess = max(max(b[1] - b[0], b[5] - b[4]) for b in boxes)
    eps = scale_guess * 0.004
    order = sorted(range(len(groups)), key=lambda i: boxes[i][0])
    for a in range(len(order)):
        ba = boxes[order[a]]
        for b in range(a + 1, len(order)):
            bb = boxes[order[b]]
            if bb[0] > ba[1]:
                break                       # sorted on x: nothing further can touch
            if min(ba[1], bb[1]) - max(ba[0], bb[0]) > eps and \
               min(ba[5], bb[5]) - max(ba[4], bb[4]) > eps:
                ra, rb = find(order[a]), find(order[b])
                if ra != rb:
                    parent[ra] = rb
    merged = {}
    for i in range(len(groups)):
        merged.setdefault(find(i), []).extend(groups[i])

    span = lambda b: max(b[1] - b[0], b[5] - b[4])
    vehicles = [[tris[i] for i in g] for g in merged.values() if len(g) >= 200]
    lengths = sorted(span(box_of(range(len(v)), v)) for v in vehicles)
    # One scale for the whole pack, from its median vehicle, so a truck stays
    # bigger than a hatchback instead of every model being stretched to a
    # length somebody typed in.
    scale = TYPICAL / max(lengths[len(lengths) // 2], 1e-6)
    return vehicles, scale


def pack_vehicle(tris, scale):
    """
    Recentre, stand on the ground, face +x, and scale into metres.

    The triangles are put into a canonical order first, and that matters more
    than it looks. Two liveries of one body are matched by a geometry hash that
    ignores triangle order -- it has to, because the same model exported twice
    comes out traversed differently. But the shape is then stored once, from
    whichever livery was read first, while every livery keeps its own colour
    buffer indexed by ITS vertex order. Get those two orders out of step and a
    car is painted with another car's colours in the wrong places: glass and
    wheels come out body-coloured, which is what happened to the orange saloon.
    Sorting here makes any two identical bodies produce identical ordering, so
    the colour buffers line up by construction.
    """
    xs = [p[0] for t, _ in tris for p in t]
    ys = [p[1] for t, _ in tris for p in t]
    zs = [p[2] for t, _ in tris for p in t]
    ex, ez = max(xs) - min(xs), max(zs) - min(zs)
    swap = ez > ex
    cx, cz, y0 = (max(xs) + min(xs)) / 2, (max(zs) + min(zs)) / 2, min(ys)

    def canon(t):
        # Rotated so the smallest corner comes first, not sorted: rotation
        # keeps the winding, and two triangles that share all three positions
        # with opposite windings -- which these packs are full of, every
        # double-sided quad is a pair -- must not compare equal, or the sort
        # falls back on input order and the whole exercise is defeated.
        pts = [(round((p[0] - cx) * scale, 3), round((p[1] - y0) * scale, 3),
                round((p[2] - cz) * scale, 3)) for p in t[0]]
        k = pts.index(min(pts))
        return pts[k:] + pts[:k]

    seen, order, index = {}, [], []
    for corner, cols in sorted(tris, key=canon):
        for p, col in zip(corner, cols):
            x, z = (p[0] - cx) * scale, (p[2] - cz) * scale
            if swap:
                x, z = z, -x
            key = (round(x, 4), round((p[1] - y0) * scale, 4), round(z, 4),
                   round(col[0], 3), round(col[1], 3), round(col[2], 3))
            i = seen.get(key)
            if i is None:
                i = len(order)
                seen[key] = i
                order.append(key)
            index.append(i)
    return order, index


def unbake(tris):
    """
    Lifts a vehicle's albedo back out of its own baked shading.

    These textures are painted with the light already in them -- ambient
    occlusion in the wheel arches, a highlight along the shoulder, a shaded
    underside. The renderer then lights the model again, so everything arrives
    twice-darkened: the whole fleet came out muted and washed out beside the
    procedural buildings, whose albedo is authored bright because it is albedo.

    So each vehicle is scaled until its brightest body colour sits at a proper
    albedo level, and its chroma is pushed back out by the amount the double
    shading cost it. Per vehicle rather than globally, because a black car and
    a white one need different amounts and a single constant would blow one out
    to keep the other visible.
    """
    lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    vals = sorted(lum(c) for _, cols in tris for c in cols)
    if not vals:
        return tris
    # The ninetieth percentile rather than the maximum: a single specular
    # texel would otherwise set the scale for the whole car.
    top = vals[int(len(vals) * 0.90)]
    gain = min(3.2, 0.74 / max(top, 0.02))
    out = []
    for corner, cols in tris:
        lifted = []
        for c in cols:
            v = [min(1.0, x * gain) for x in c]
            g = lum(v)
            # Chroma back out around the luminance, which is what baked shading
            # flattens first.
            lifted.append(tuple(min(1.0, max(0.0, g + (v[i] - g) * 1.45))
                                for i in range(3)))
        out.append((corner, lifted))
    return out


def cluster(order, index, cell):
    """
    A cheap copy of a shape: vertices welded onto a grid, and the triangles
    that survive it.

    Vertex clustering, which is the decimation that suits these models: the
    bodies are already flat-shaded slabs, so snapping to a grid a third of a
    metre across keeps the silhouette and the colour breaks and throws away
    the panel gaps, the wheel spokes and the lamp bezels. A car goes from
    three thousand triangles to a few hundred.

    Needed because a forecourt parks eight of them. A full model each puts a
    corner shop over the triangle ceiling on its own.
    """
    rep, remap = {}, []
    for v in order:
        key = (round(v[0] / cell), round(v[1] / cell), round(v[2] / cell))
        if key not in rep:
            rep[key] = len(rep)
        remap.append(rep[key])
    # The representative keeps the first position and colour that landed in it,
    # so a cluster straddling a colour break takes one side rather than a blend.
    out = [None] * len(rep)
    for v, r in zip(order, remap):
        if out[r] is None:
            out[r] = v
    keep = []
    seen = set()
    for i in range(0, len(index), 3):
        a, b, c = (remap[index[i + k]] for k in range(3))
        if a == b or b == c or a == c:
            continue                       # collapsed onto a line
        sig = tuple(sorted((a, b, c)))
        if sig in seen:
            continue                       # a duplicate of one already kept
        seen.add(sig)
        keep += [a, b, c]
    return out, keep


def b64(b):
    return base64.b64encode(bytes(b)).decode()


def packed_hash(order, index):
    """
    Shape identity: the packed vertex positions and index list exactly.

    Deliberately stricter than the class hash below. Two liveries may only
    share a stored shape if their packed buffers agree vertex for vertex,
    because each livery's colour buffer is indexed by that order -- share a
    shape between two orderings that merely describe the same solid and one car
    gets painted with the other's colours in the wrong places. Canonical
    sorting makes genuine copies agree; anything that does not agree now keeps
    its own shape, which costs a little data and cannot be wrong.
    """
    return hashlib.sha1(
        json.dumps([[v[0], v[1], v[2]] for v in order]).encode()
        + json.dumps(index).encode()).hexdigest()[:12]


def geo_hash(order, index):
    """
    Identity of a shape: where its triangles are, and nothing else.

    Colour is deliberately not in it -- the whole point is that nine liveries
    of one hatchback come out as one shape. Neither is triangle order, because
    the triangles of a vehicle are gathered from wherever in the scene they
    happened to be stored. Positions are already in metres at the pack's own
    scale by the time this runs, so two copies of one body agree to the
    millimetre and hash the same.
    """
    rows = sorted(
        tuple(sorted((round(order[index[i + k]][0], 3),
                      round(order[index[i + k]][1], 3),
                      round(order[index[i + k]][2], 3)) for k in range(3)))
        for i in range(0, len(index), 3))
    return hashlib.sha1(json.dumps(rows).encode()).hexdigest()[:12]


def main(src_dir, out_path):
    src = Path(src_dir)

    # Read every vehicle in every pack first, so a shape can be recognised
    # across packs and named once from its measurements.
    found = []
    for f in PACKS:
        groups, scale = vehicles_in(src / f)
        print(f'== {f}: {len(groups)} vehicles, {1 / scale:.1f} units per metre')
        for tris in groups:
            order, index = pack_vehicle(unbake(tris), scale)
            # Two hashes, doing two different jobs. The loose one groups
            # liveries of one body so they get one name and one number, and it
            # has to ignore triangle order to do that. The strict one decides
            # whether they may share a stored shape, and it must not: a shape
            # is stored once but every livery's colour buffer is indexed by its
            # own vertex order, so sharing between two orderings that merely
            # describe the same solid paints one car with the other's colours.
            found.append((geo_hash(order, index), packed_hash(order, index),
                          order, index))

    # One name per geometry, from its size, and a running number per class.
    named, counts = {}, {}
    for norm, _geo, order, _index in found:
        geo = norm
        if geo in named:
            continue
        length = max(v[0] for v in order) - min(v[0] for v in order)
        height = max(v[1] for v in order)
        key, label = classify(length, height)
        counts[key] = n = counts.get(key, 0) + 1
        named[geo] = (key, label, n)

    # Some liveries in these packs have their glass painted the body colour --
    # the windscreen, the side windows and the light lenses all sample the same
    # patch of the atlas as the panels do. On its own that is indistinguishable
    # from a car with very dark glass, so it is judged against its own
    # siblings: liveries of one body share geometry, so if some of them have a
    # neutral mid-grey glazing material and others have none at all, the ones
    # with none have broken UVs rather than tinted windows.
    # Deliberately conservative. An earlier, looser version of this threw away
    # thirteen liveries to catch three, including some of the best in the pack:
    # "less glass than my siblings" is a weak signal because a livery may
    # legitimately have darker glass, and the strong signal -- essentially none
    # at all -- is the only one worth acting on automatically.
    def glazed(order):
        n = 0
        for v in order:
            lum = 0.2126 * v[3] + 0.7152 * v[4] + 0.0722 * v[5]
            hi, lo = max(v[3], v[4], v[5]), min(v[3], v[4], v[5])
            sat = (hi - lo) / max(hi, 1e-6)
            if 0.10 < lum < 0.62 and sat < 0.18:
                n += 1
        return n / max(len(order), 1)

    glass = {}
    for norm, _geo, order, _index in found:
        glass.setdefault(norm, []).append(glazed(order))
    broken = set()
    for norm, fracs in glass.items():
        best = max(fracs)
        if best < 0.10 or len(fracs) < 2:
            continue                       # nothing to compare against
        for i, f in enumerate(fracs):
            if f < best * 0.25:
                broken.add((norm, i))
    if broken:
        print(f'  dropping {len(broken)} liveries whose glass is painted body colour')

    shapes, models, seen = {}, {}, {}
    livery = {}
    for norm, geo, order, index in found:
        livery[norm] = k = livery.get(norm, -1) + 1
        if (norm, k) in broken or geo in DROP_SHAPES:
            continue
        key, label, n = named[norm]
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
            # The cheap copy, on the same quantisation so one decoder does
            # both. Cell size scales with the model so a van and a hatchback
            # lose about the same proportion of their detail.
            cell = max(span[0], span[2]) * 0.075
            lorder, lindex = cluster(order, index, cell)
            lbuf = bytearray()
            for v in lorder:
                for i in range(3):
                    q = int(round((v[i] - lo[i]) / span[i] * 65535))
                    lbuf += struct.pack('<H', max(0, min(65535, q)))
            lib = bytearray()
            for i in lindex:
                lib += struct.pack('<H', i)
            shapes[geo] = {
                'lo': [round(x, 4) for x in lo],
                'span': [round(x, 4) for x in span],
                'wide': wide,
                'verts': b64(buf),
                'index': b64(ib),
                'count': len(index),
                'lowVerts': b64(lbuf),
                'lowIndex': b64(lib),
                'lowCount': len(lindex),
                'label': key,
            }
            shapes[geo]['cell'] = round(cell, 4)
        cbuf = bytearray()
        for v in order:
            for i in range(3):
                cbuf.append(max(0, min(255, int(round(v[3 + i] * 255)))))
        lorder, _ = cluster(order, index, shapes[geo]['cell'])
        lcbuf = bytearray()
        for v in lorder:
            for i in range(3):
                lcbuf.append(max(0, min(255, int(round(v[3 + i] * 255)))))
        # Liveries of one shape share its number and take a letter.
        seen[norm] = liv = seen.get(norm, 0) + 1
        base = f'{key}{n}'
        aid = f'car.{base}' + ('' if liv == 1 else chr(ord('a') + liv - 1))
        models[aid] = {
            'name': f'{label} {n}' + ('' if liv == 1 else chr(ord('a') + liv - 1)),
            'shape': geo,
            'colour': b64(cbuf),
            'lowColour': b64(lcbuf),
        }
        length = max(v[0] for v in order) - min(v[0] for v in order)
        print(f'  {aid:18s} {len(index)//3:6d} tris  {length:4.1f}m  shape {geo}')

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
        '  verts: string;\n  index: string;\n  count: number;\n'
        '  lowVerts: string;\n  lowIndex: string;\n  lowCount: number;\n'
        '  cell: number;\n  label: string;\n'
        '}\n\n'
        'export interface ImportedModel {\n'
        '  name: string;\n  shape: string;\n  colour: string;\n  lowColour: string;\n'
        '}\n\n'
        'export const FLEET_DATA: { shapes: Record<string, ImportedShape>;'
        ' models: Record<string, ImportedModel> } = '
    )
    Path(out_path).write_text(header + body + ';\n')
    print('wrote', out_path, f'{Path(out_path).stat().st_size / 1024:.0f} KB')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
