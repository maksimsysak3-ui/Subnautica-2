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

PACKS = ['Ultimate_Low-Poly_Car_Pack.usdz', 'Low_Poly_cars_pack.usdz',
         'Mini_Pack_8.usdz', 'Ultimate_Pack_2.usdz', 'Civil_Service.usdz',
         'Airplane.usdz', 'Boeing_787.usdz']

#: Packs whose contents are one vehicle, however many surfaces it is drawn in.
#:
#: The overlap rule that separates cars parked side by side has nothing to
#: separate here, and it gets the aircraft wrong: a 787's engine fans are
#: modelled as free discs that touch neither wing, so they come out as two more
#: "vehicles" a quarter the size of the aeroplane. A pack holding one model is
#: told so rather than guessed at.
WHOLE_PACKS = {'Airplane.usdz', 'Boeing_787.usdz'}

#: The real length of a pack's median vehicle, in metres.
#:
#: Every pack is scaled so its median vehicle is TYPICAL long, which is right
#: for a pack of cars and absurd for a pack of one aeroplane -- a 787 scaled to
#: 4.5m would park in a driveway. A pack of aircraft says its own size instead.
PACK_LENGTH = {'Airplane.usdz': 34.0, 'Boeing_787.usdz': 60.0,
               # A civil fleet's median is a truck, not a hatchback: scaled to
               # 4.5m its taxi came out 2.9m long and its bus 6.3m.
               'Civil_Service.usdz': 6.5}

#: Names this library gives to run-together mesh names.
#:
#: One pack names its meshes after the vehicle -- which is worth having -- but
#: as "Rdservtruck_CervicetruckTex_0", and the first word of that is not
#: something to show a player. Only the compound names actually shipped are
#: listed; anything not here keeps the artist's word, title-cased.
NAME_ALIAS = {
    'garbagetruck': 'Refuse truck',
    'citybus': 'City bus',
    'firetruck': 'Fire engine',
    'policesedan': 'Police car',
    'rdservtruck': 'Service truck',
    'towtruck': 'Tow truck',
    'postvan': 'Post van',
}

#: The id prefix and name for a pack whose contents are not cars.
#:
#: classify() reads a height-to-length ratio, which says nothing useful about
#: an aeroplane -- both of these would come out "Truck" -- so an aircraft pack
#: names its own.
PACK_KIND = {'Airplane.usdz': ('air', 'airliner', 'Airliner'),
             'Boeing_787.usdz': ('air', 'widebody', 'Widebody airliner')}

#: Meshes to leave out, by a fragment of their prim path.
SKIP_MESH = ()

#: Every vehicle in a pack is measured against this one, in metres.
TYPICAL = 4.5

#: Source variants to leave out, by the hash of their packed geometry.
#:
#: Empty. It held three liveries of one small van whose glazing and lamps were
#: painted body colour in the atlas; they come back in with the rest of the
#: pack now that the sampler no longer needs them excluded.
DROP_SHAPES: set[str] = set()

#: Liveries to leave out, by asset id.
#:
#: car.suv1 through car.van12: the whole of Low_Poly_cars_pack, which is the
#: one pack in the library with a baked atlas and no padding between its
#: islands. Everything that survives is either flat-coloured or textured one
#: image per vehicle, and neither can bleed.
DROP_MODELS = {
    'car.suv1',
    'car.suv2',
    'car.van1',
    'car.van2',
    'car.van3',
    'car.van4',
    'car.van5',
    'car.microvan1',
    'car.suv3',
    'car.microvan2',
    'car.microvan3',
    'car.microvan4',
    'car.van6',
    'car.van7',
    'car.van8',
    'car.van9',
    'car.van10',
    'car.van11',
    'car.estate2',
    'car.estate3',
    'car.estate4',
    'car.estate5',
    'car.estate6',
    'car.estate7',
    'car.estate8',
    'car.estate9',
    'car.estate10',
    'car.microvan5',
    'car.microvan6',
    'car.suv4',
    'car.microvan7',
    'car.microvan8',
    'car.microvan9',
    'car.microvan10',
    'car.microvan11',
    'car.microvan12',
    'car.microvan13',
    'car.microvan14',
    'car.microvan15',
    'car.microvan16',
    'car.suv5',
    'car.suv6',
    'car.suv7',
    'car.suv8',
    'car.suv9',
    'car.van12',
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
                # RGBA, always. The decal sheets in these packs are PNGs that
                # are transparent everywhere except the badge or the stripe on
                # them, and converting one to RGB paints every transparent
                # texel pure black. That is where the black triangles all over
                # the civil fleet came from: a decal is separate geometry laid
                # on the bodywork, and away from the mark it must draw nothing
                # rather than a black patch.
                out[Path(n).name] = Image.open(io.BytesIO(z.read(n))).convert('RGBA')
    return out


def material_colour(prim, textures):
    """(rgb, image, texture name) for a mesh: a colour, a texture, or grey."""
    mat = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()[0]
    if not mat:
        return (0.6, 0.6, 0.6), None, None
    surf = mat.GetSurfaceOutput()
    src = surf.GetConnectedSources()[0] if surf else None
    if not src:
        return (0.6, 0.6, 0.6), None, None
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
                    return (0.6, 0.6, 0.6), textures[name], name
        val = diff.Get()
        if val is not None:
            return (float(val[0]), float(val[1]), float(val[2])), None, None
    return (0.6, 0.6, 0.6), None, None


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def mid(a, b):
    """Midpoint of two world-space points."""
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)


def mid2(a, b):
    """Midpoint of two uvs."""
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)


def world_of(p):
    """Subdivision works in world space already; this keeps the types even."""
    return (p[0], p[1], p[2])


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
    rgb, img, texname = material_colour(prim, textures)
    uvs = None
    for nm in ('primvars:st', 'primvars:st0', 'primvars:UVMap'):
        a = prim.GetAttribute(nm)
        if a and a.Get() is not None:
            uvs = a.Get()
            break
    #: Barycentric weights for sampling a facet's UV footprint.
    #:
    #: Spread over the triangle rather than at its corners -- a corner sits on
    #: the seam between two patches of the atlas and is the worst place to read
    #: one -- and pulled in towards the centroid, because these atlases have no
    #: padding and a sample near a facet's edge can land a texel into the
    #: neighbouring island.
    _RAW = [(a2 / 6, b2 / 6, 1 - a2 / 6 - b2 / 6)
            for a2 in range(1, 6) for b2 in range(1, 6 - a2)]
    _PULL = 0.30
    SPREAD = [tuple(w * (1 - _PULL) + _PULL / 3 for w in p) for p in _RAW]

    #: Whether this mesh is a decal: a texture that is transparent somewhere.
    #:
    #: A decal is a separate sheet of geometry laid on the bodywork carrying a
    #: livery stripe, a badge or a door line, and it needs different treatment
    #: from bodywork in three ways. It is coarse geometry with a fine mark on
    #: it, so it needs splitting much further. A facet that only clips the mark
    #: must be dropped rather than painted, or it comes out as a black triangle
    #: the size of the facet -- which is what put the sawtooth down the flank of
    #: every bus in the pack. And what survives sits in the same plane as the
    #: body, so it has to be lifted clear or it z-fights.
    decal = img is not None and img.mode == 'RGBA' and img.getextrema()[3][0] < 250

    def sample(uv):
        """(rgb, alpha) at a uv, or None where the texture is transparent."""
        px = int(min(max(uv[0], 0.0), 1.0) * (img.width - 1))
        py = int((1.0 - min(max(uv[1], 0.0), 1.0)) * (img.height - 1))
        t = img.getpixel((px, py))
        return (t[0], t[1], t[2]), (t[3] if len(t) > 3 else 255)

    def vote(pa, pb, pc):
        """
        The colour covering most of a facet, and how much of it that is.

        Samples are grouped by how far apart they are rather than by bucketing
        them, and that distinction is the whole thing. These textures are JPEGs
        and a flat panel is never two texels the same: bucketing splits one
        panel's votes across four neighbouring buckets, every facet in the pack
        then looks like a boundary, and the subdivision below fires everywhere
        -- it turned an eight megabyte fleet into thirty-eight. Grouping by
        distance is blind to that noise and still sees a real edge, where the
        two colours are nowhere near each other.
        """
        hits, clear = [], 0
        for wa, wb, wc in SPREAD:
            uv = (pa[0] * wa + pb[0] * wb + pc[0] * wc,
                  pa[1] * wa + pb[1] * wb + pc[1] * wc)
            texel, alpha = sample(uv)
            if alpha < 128:
                clear += 1
            else:
                hits.append(texel)
        n = len(SPREAD)
        # A body facet needs a majority to be opaque; a decal facet needs
        # nearly all of it. Anything less is a facet clipping the edge of the
        # mark, and painting it the mark's colour is how a badge becomes a
        # black triangle four metres long.
        keep = 0.98 if decal else 0.5
        if clear > n * (1.0 - keep) or not hits:
            return None, 1.0            # transparent: draw nothing here
        groups = []                     # [count, running sum, representative]
        for t in hits:
            for g in groups:
                if max(abs(t[i] - g[2][i]) for i in range(3)) <= NOISE:
                    g[0] += 1
                    g[1] = tuple(g[1][i] + t[i] for i in range(3))
                    break
            else:
                groups.append([1, t, t])
        best = max(groups, key=lambda g: g[0])
        # The mean of the winning group, not one sample of it: within a group
        # the spread is JPEG noise, and averaging it out is the one place a
        # mean is the right answer.
        texel = tuple(int(round(c / best[0])) for c in best[1])
        return texel, best[0] / len(hits)

    #: How far apart two samples may be and still be the same panel, per
    #: channel out of 255. Wide enough to swallow JPEG ringing on a flat
    #: colour, far narrower than the gap between a body and its glass.
    NOISE = 26

    #: How much of a facet one colour has to cover before it is called flat.
    AGREE = 0.80
    #: How far a facet may be split. Each level is four sub-facets, so 2 is at
    #: most sixteen -- and only where the texture actually changes.
    #:
    #: A decal goes five levels, up to 1024. That sounds extravagant and is
    #: not: there are eight decal meshes in the pack against two hundred body
    #: ones, the mark on them is a few texels across, and two levels cannot
    #: resolve a stripe at all -- they can only decide whether to paint the
    #: whole facet.
    #:
    #: Bodywork goes two. Three was tried, against the school bus's rub rail:
    #: ten centimetres of black on a facet a metre long, which at two levels
    #: the sub-facets straddle, so the mode picks black for some and yellow for
    #: others and the stripe comes out as a sawtooth down the flank. Three made
    #: the sawtooth finer and never made it a line, at 2.3 times the facets
    #: against 1.7 and three megabytes of bundle. A thin stripe is the limit of
    #: one colour per facet, and more subdivision buys a smaller version of the
    #: same artefact rather than fixing it.
    DEPTH = 5 if decal else 2

    def split(pos, uv, depth, out):   # noqa: kept for subdivide() below
        """
        Emit this facet, subdivided until each piece is one colour.

        This is the fix for the whole class of problem. One colour per facet is
        what keeps these models crisp -- a colour per corner gradients across
        every flat panel and the fleet came out looking smeared -- but a facet
        that straddles a window frame, a door shut line or a livery stripe has
        no one colour, and forcing one on it is what made the windows read as
        triangles with the glass leaking past the frame. So a facet that does
        not agree with itself is cut at its edge midpoints, in position and in
        uv together, and each quarter asks the same question again. The frame
        gets resolved because the geometry follows the texture instead of the
        texture being flattened onto the geometry.
        """
        texel, agree = vote(*uv)
        if texel is None:
            return                      # transparent decal: nothing to draw
        if agree >= AGREE or depth >= DEPTH:
            col = tuple(srgb_to_linear(q / 255.0) for q in texel)
            pts = [world_of(p) for p in pos]
            if decal:
                # Lift it clear of the bodywork along its own normal. A decal
                # is modelled in the same plane as the panel it is printed on,
                # and coplanar surfaces flicker.
                ux, uy, uz = (pts[1][i] - pts[0][i] for i in range(3))
                vx, vy, vz = (pts[2][i] - pts[0][i] for i in range(3))
                nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
                ln = (nx * nx + ny * ny + nz * nz) ** 0.5
                if ln > 1e-9:
                    d = LIFT / ln
                    pts = [(q[0] + nx * d, q[1] + ny * d, q[2] + nz * d) for q in pts]
            out.append((pts, [col, col, col]))
            return
        mp = [mid(pos[1], pos[2]), mid(pos[2], pos[0]), mid(pos[0], pos[1])]
        mu = [mid2(uv[1], uv[2]), mid2(uv[2], uv[0]), mid2(uv[0], uv[1])]
        split((pos[0], mp[2], mp[1]), (uv[0], mu[2], mu[1]), depth + 1, out)
        split((mp[2], pos[1], mp[0]), (mu[2], uv[1], mu[0]), depth + 1, out)
        split((mp[1], mp[0], pos[2]), (mu[1], mu[0], uv[2]), depth + 1, out)
        split((mp[0], mp[1], mp[2]), (mu[0], mu[1], mu[2]), depth + 1, out)

    # Facets undivided, each carrying what it needs to be split later.
    #
    # Subdivision cannot happen here. Vehicles are found by welding vertices
    # and walking the surface, and two neighbouring facets split to different
    # depths no longer share the vertices along their common edge -- so every
    # surface in the pack shatters into fragments and the grouping collapses.
    # The civil fleet came out as a hundred and sixty-five "vehicles" the one
    # time this ran in the wrong order. So the facet keeps its uvs and its
    # splitter, grouping runs on the coarse mesh, and subdivide() below is
    # called once each vehicle is known.
    # How far to lift a decal, in this file's own units. Taken from the mesh's
    # own size so it is the same fraction of a bus as of a badge.
    span = max(max(p[i] for p in world) - min(p[i] for p in world) for i in range(3)) \
        if world else 1.0
    LIFT = span * 0.0016

    tris, base = [], 0
    for c in counts:
        face = [idx[base + k] for k in range(c)]
        for k in range(1, c - 1):
            corner = (face[0], face[k], face[k + 1])
            pos = [world[i] for i in corner]
            if img is not None and uvs is not None and len(uvs) > max(corner):
                tris.append((pos, [rgb, rgb, rgb],
                             tuple((uvs[i][0], uvs[i][1]) for i in corner), split))
            else:
                # A flat diffuseColor is already linear; only a texel needs
                # converting. Running every colour through srgb_to_linear was
                # why the pack that carries no textures at all and states its
                # colours outright came out two stops dark.
                tris.append((pos, [rgb, rgb, rgb], None, None))
        base += c
    xs = [p[0] for t in tris for p in t[0]]
    ys = [p[1] for t in tris for p in t[0]]
    zs = [p[2] for t in tris for p in t[0]]
    box = (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)) if tris else None
    return tris, box, texname


def subdivide(tris):
    """
    Split every facet until each piece is one colour, and drop the clear ones.

    Run once a vehicle is known, never before: see read_mesh. A facet whose uv
    footprint is transparent throughout disappears here, which is what takes
    the black patches off the decal geometry.
    """
    out = []
    for t in tris:
        if t[2] is None:
            out.append((t[0], t[1]))
        else:
            t[3](tuple(t[0]), t[2], 0, out)
    return out


#: Part words to strip when a mesh name is used to name the vehicle it is
#: part of. One pack names its meshes "Firetruck_body_red_0" and the like,
#: which is worth far more than a name derived from measurements.
PART_WORDS = (
    'body', 'windows', 'window', 'wheel', 'wheels', 'tires', 'tyres', 'rear',
    'front', 'head', 'lights', 'light', 'flashers', 'siren', 'trim', 'glass',
    'grill', 'grille', 'bumper', 'interior', 'seats', 'plate', 'mirror',
    'rim', 'rims', 'tire', 'tyre', 'hub', 'hubs', 'brake', 'exhaust', 'roof',
    'door', 'doors', 'hood', 'bonnet', 'boot', 'spoiler', 'chassis', 'panel',
    'black', 'white', 'grey', 'gray', 'silver', 'red', 'blue', 'green',
    'yellow', 'orange', 'purple', 'brown', 'pink', 'light', 'dark', 'cyan',
    'teal', 'gold', 'beige', 'tan', 'lime', 'navy', 'maroon',
)


#: Mesh names that describe the mesh rather than the vehicle.
#:
#: Only one of the four packs names its meshes after what they are part of
#: ("Firetruck_body_red_0"). The others name them after the exporter's own
#: bookkeeping -- Object_12, Paint_Material_020, Transport3_TransportPack --
#: and taking those as vehicle names produced a fleet called "Object 6c" and
#: "Paint Material 1b". A hint is only worth having if it is a word about a
#: vehicle, so anything starting with one of these is refused and the model
#: falls back to being named from its measurements.
GENERIC = {
    'object', 'paint', 'trim', 'body', 'material', 'mesh', 'transport',
    'group', 'node', 'default', 'polygon', 'cube', 'plane', 'part', 'item',
    'geo', 'model', 'shape', 'element', 'piece', 'obj', 'sm', 'mi',
    'palette', 'cylinder', 'sphere', 'box', 'circle', 'curve', 'lp', 'hp',
}


def name_hint(prim):
    """The vehicle a mesh belongs to, from its name, or None."""
    parts = prim.GetName().split('_')
    keep = []
    for w in parts:
        if w.lower() in PART_WORDS or w.isdigit():
            break
        keep.append(w)
    if not keep:
        return None
    head = keep[0].rstrip('0123456789').lower()
    # A one- or two-letter head is an index, not a word: "e1_palette" is the
    # exporter counting its materials, and taking it produced a fleet of cars
    # called "E1 palette".
    if head in GENERIC or len(head) < 3:
        return None
    # The first word only. A mesh called "Garbagetruck_GarbagetruckTex_0"
    # names its vehicle twice over and its texture once, and joining what
    # survives the part-word filter produced "Garbagetruck Garbagetrucktex".
    label = NAME_ALIAS.get(head, keep[0].capitalize())
    return label if len(label) > 2 else None


def all_triangles(path):
    """
    Every triangle in the pack, in world space, with its colour, the vehicle
    name each one's mesh suggests, and the texture its mesh reads from.
    """
    stage = Usd.Stage.Open(str(path))
    textures = texture_lookup(path)
    out, hints, texes = [], [], []
    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh):
            continue
        if any(skip in str(prim.GetPath()) for skip in SKIP_MESH):
            continue
        tris, _box, texname = read_mesh(prim, textures)
        out += tris
        hints += [name_hint(prim)] * len(tris)
        texes += [texname] * len(tris)
    return out, hints, texes


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
    for corner in (t[0] for t in tris):
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


def vehicles_in(path, whole=False, typical=TYPICAL):
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
    tris, hints, texes = all_triangles(path)
    if whole:
        span_all = box_of(range(len(tris)), tris)
        long_side = max(span_all[1] - span_all[0], span_all[5] - span_all[4])
        return [tris], typical / max(long_side, 1e-6), [None]
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
    #
    # Measured against the SMALLER of the two footprints, in both axes. A part
    # of a vehicle -- a wheel, a mirror, a light bar -- sits wholly inside its
    # vehicle's plan, so it scores 1.0 however small it is, while two vehicles
    # standing side by side share an edge at most. A bare epsilon here was not
    # enough: the civil service pack parks its models close, and a fire engine
    # and a school bus a few centimetres apart came in as one vehicle.
    order = sorted(range(len(groups)), key=lambda i: boxes[i][0])

    # The texture each surface reads from.
    #
    # Overlap alone cannot separate two models the pack parked overlapping --
    # its police cruiser stands half inside an unmarked sedan, and its service
    # truck inside a flatbed -- because they really do share a plan. But the
    # pack paints each vehicle from its own image, and two surfaces that read
    # from different images are never the same vehicle. Where a surface has no
    # texture at all (a flat-coloured pack) this says nothing and the overlap
    # rule decides on its own.
    def tex_of(g):
        tally = {}
        for i in g:
            if texes[i] is not None:
                tally[texes[i]] = tally.get(texes[i], 0) + 1
        return max(tally.items(), key=lambda kv: kv[1])[0] if tally else None

    gtex = [tex_of(g) for g in groups]

    def share(a0, a1, b0, b1):
        span = min(a1 - a0, b1 - b0)
        return (min(a1, b1) - max(a0, b0)) / max(span, 1e-6)

    for a in range(len(order)):
        ba = boxes[order[a]]
        for b in range(a + 1, len(order)):
            bb = boxes[order[b]]
            if bb[0] > ba[1]:
                break                       # sorted on x: nothing further can touch
            ta, tb = gtex[order[a]], gtex[order[b]]
            if ta is not None and tb is not None and ta != tb:
                continue
            if share(ba[0], ba[1], bb[0], bb[1]) > 0.55 and \
               share(ba[4], ba[5], bb[4], bb[5]) > 0.55:
                ra, rb = find(order[a]), find(order[b])
                if ra != rb:
                    parent[ra] = rb
    merged = {}
    for i in range(len(groups)):
        merged.setdefault(find(i), []).extend(groups[i])

    span = lambda b: max(b[1] - b[0], b[5] - b[4])
    # A vehicle has a plan; a decal does not. One pack ships a flat 300-facet
    # sheet beside each model -- a backdrop or a shadow catcher, a metre and a
    # half wide and sixty long -- and it is connected to nothing, so the
    # overlap rule leaves it standing on its own as a "vehicle".
    def solid(g):
        b = box_of(g, tris)
        w, d = b[1] - b[0], b[5] - b[4]
        return min(w, d) >= 0.15 * max(w, d)
    kept = [g for g in merged.values() if len(g) >= 200 and solid(g)]
    vehicles = [[tris[i] for i in g] for g in kept]
    # The name its meshes agree on, if they carry one.
    names = []
    for g in kept:
        tally = {}
        for i in g:
            h = hints[i]
            if h is not None:
                tally[h] = tally.get(h, 0) + 1
        names.append(max(tally.items(), key=lambda kv: kv[1])[0] if tally else None)
    lengths = sorted(span(box_of(range(len(v)), v)) for v in vehicles)
    # One scale for the whole pack, from its median vehicle, so a truck stays
    # bigger than a hatchback instead of every model being stretched to a
    # length somebody typed in.
    scale = typical / max(lengths[len(lengths) // 2], 1e-6)
    return vehicles, scale, names


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


def despeckle(tris, rounds=3):
    """
    Removes single facets that took a neighbouring panel's colour.

    Sampling can only ever be a guess for a long thin facet. These atlases pack
    their islands with no padding, so a sliver along the top of a windscreen or
    down an A-pillar has a UV footprint a texel or two wide that straddles two
    islands, and no choice of sample position fixes it -- the facet genuinely
    covers both. That is where the ragged red teeth along the glass edge, the
    olive slivers at the wiper line and the dark wedges on the bonnet came
    from.

    So it is cleaned up topologically instead, the way speckle is removed from
    any segmentation. Facets are grouped into regions of one colour that touch
    along an edge; a region far too small to be a panel, and fenced in on
    nearly every side by one other region, is not a panel -- it is a misread of
    the region around it, and it takes that region's colour.

    The two conditions matter equally. Size alone would eat the headlamps and
    the mirrors; being surrounded alone would eat a whole roof panel where the
    glass wraps it. A real feature is either big or it borders several things.
    """
    if not tris:
        return tris
    key = lambda p: (round(p[0], 3), round(p[1], 3), round(p[2], 3))
    ckey = lambda c: (round(c[0], 2), round(c[1], 2), round(c[2], 2))

    def area_of(t):
        a, b, c = t
        ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
        vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
        return math.sqrt((uy * vz - uz * vy) ** 2 + (uz * vx - ux * vz) ** 2
                         + (ux * vy - uy * vx) ** 2) / 2

    areas = [area_of(t) for t, _ in tris]
    total = sum(areas) or 1.0

    # Facets that share an edge, found through welded vertex positions.
    edges = {}
    for i, (corner, _) in enumerate(tris):
        k = [key(p) for p in corner]
        for a, b in ((0, 1), (1, 2), (2, 0)):
            e = tuple(sorted((k[a], k[b])))
            edges.setdefault(e, []).append(i)
    neighbours = [[] for _ in tris]
    for share in edges.values():
        if len(share) < 2:
            continue
        for a in share:
            for b in share:
                if a != b:
                    neighbours[a].append(b)

    cols = [list(c[0]) for _, c in tris]

    for _ in range(rounds):
        # Regions: adjacent facets of the same colour.
        parent = list(range(len(tris)))

        def find(a):
            while parent[a] != a:
                parent[a] = parent[parent[a]]
                a = parent[a]
            return a

        for i, ns in enumerate(neighbours):
            for j in ns:
                if ckey(cols[i]) == ckey(cols[j]):
                    ra, rb = find(i), find(j)
                    if ra != rb:
                        parent[ra] = rb
        region, size = {}, {}
        for i in range(len(tris)):
            r = find(i)
            region.setdefault(r, []).append(i)
            size[r] = size.get(r, 0.0) + areas[i]

        # How much of the car each colour covers in total, across every
        # region. A colour used once, on three facets by the windscreen
        # surround, is a misread; a colour used on all four wheels is a
        # material, however little of the car each spoke covers.
        spread = {}
        for i in range(len(tris)):
            k = ckey(cols[i])
            spread[k] = spread.get(k, 0.0) + areas[i]

        changed = False
        for r, members in region.items():
            # Far too small to be a panel: a fiftieth of the whole car.
            if size[r] > total * 0.02:
                continue
            oneoff = spread.get(ckey(cols[members[0]]), 0.0) < total * 0.004
            border, around = {}, {}
            for i in members:
                for j in neighbours[i]:
                    rj = find(j)
                    if rj == r:
                        continue
                    k = ckey(cols[j])
                    border[k] = border.get(k, 0) + 1
                    around[k] = max(around.get(k, 0.0), size[rj])
            if not border:
                continue
            edge_total = sum(border.values())
            best, n = max(border.items(), key=lambda kv: kv[1])
            # Fenced in on nearly every side by one other region -- unless the
            # colour is a one-off, in which case there is nothing to protect:
            # it is not a material the model uses anywhere else.
            if not oneoff and n < edge_total * 0.6:
                continue
            # And that region has to be a panel in its own right, an order of
            # magnitude bigger than the speck. Without this the rule eats the
            # spokes out of every alloy wheel: a spoke is small and it is
            # surrounded by the hub, but the hub is no bigger than it is. A
            # windscreen next to a sliver of body colour is fifty times larger.
            if around.get(best, 0.0) < size[r] * 18.0:
                continue
            for i in members:
                cols[i] = list(best)
            changed = True
        if not changed:
            break

    return [(t[0], [tuple(cols[i])] * 3) for i, t in enumerate(tris)]


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
    # The colour is part of the cluster key, not just the position.
    #
    # Welding on position alone merges a windscreen vertex with the roof vertex
    # beside it, and the survivor keeps whichever colour happened to arrive
    # first -- so the body colour bleeds into the glass or the glass into the
    # body, on every parked car in the city, because parked cars all use this
    # copy. Keying on colour as well means a weld never crosses a colour
    # boundary: the panel edges stay exactly where the artist put them, and the
    # decimation only ever collapses vertices that were the same colour anyway.
    rep, remap = {}, []
    for v in order:
        key = (round(v[0] / cell), round(v[1] / cell), round(v[2] / cell),
               round(v[3], 2), round(v[4], 2), round(v[5], 2))
        if key not in rep:
            rep[key] = len(rep)
        remap.append(rep[key])
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
        groups, scale, names = vehicles_in(src / f, f in WHOLE_PACKS,
                                           PACK_LENGTH.get(f, TYPICAL))
        kind = PACK_KIND.get(f)
        print(f'== {f}: {len(groups)} vehicles, {1 / scale:.1f} units per metre')
        for tris, given in zip(groups, names):
            # The triangles as read, and nothing else.
            #
            # There were two passes here and both are gone. despeckle()
            # absorbed small regions of colour into their neighbours, and
            # unbake() lifted the albedo and pushed the chroma. Both were
            # written for one pack whose atlas has no padding, and both are
            # damage on a pack that is correctly mapped: a decal, a light lens,
            # a door line and a livery stripe are exactly the small regions
            # despeckle ate, and unbake turned a correctly exposed texture into
            # a garish one. The rule now is the file as the artist shipped it.
            order, index = pack_vehicle(subdivide(tris), scale)
            # Two hashes, doing two different jobs. The loose one groups
            # liveries of one body so they get one name and one number, and it
            # has to ignore triangle order to do that. The strict one decides
            # whether they may share a stored shape, and it must not: a shape
            # is stored once but every livery's colour buffer is indexed by its
            # own vertex order, so sharing between two orderings that merely
            # describe the same solid paints one car with the other's colours.
            found.append((geo_hash(order, index), packed_hash(order, index),
                          order, index, given, kind))

    # One name per geometry, from its size, and a running number per class.
    named, counts = {}, {}
    for norm, _geo, order, _index, given, kind in found:
        geo = norm
        if geo in named:
            continue
        length = max(v[0] for v in order) - min(v[0] for v in order)
        height = max(v[1] for v in order)
        if kind:
            prefix, key, label = kind
        elif given:
            # The pack named it; a name the artist gave is worth more than one
            # derived from a bounding box.
            prefix = 'car'
            key = given.lower().replace(' ', '')
            label = given.replace('_', ' ')
        else:
            prefix = 'car'
            key, label = classify(length, height)
        counts[key] = n = counts.get(key, 0) + 1
        named[geo] = (prefix, key, label, n)

    # There was a heuristic here that dropped a livery whose glazing was
    # painted body colour in the atlas -- "much less glass than my siblings".
    # It is gone. It was always a guess, it cost good cars to catch bad ones,
    # and the packs are now taken whole; where a livery really is unrecoverable
    # it goes in DROP_MODELS by name instead of being sniffed out.
    broken = set()

    shapes, models, seen = {}, {}, {}
    livery, dupes = {}, set()
    for norm, geo, order, index, _given, _kind in found:
        livery[norm] = k = livery.get(norm, -1) + 1
        if (norm, k) in broken or geo in DROP_SHAPES:
            continue
        prefix, key, label, n = named[norm]
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
        # Two packs ship the same model three times over -- the same solid with
        # the same paint on it, not three liveries -- and an exact duplicate is
        # a second entry in the picker that draws the first one again.
        stamp = (geo, bytes(cbuf))
        if stamp in dupes:
            continue
        dupes.add(stamp)

        # Liveries of one shape share its number and take a letter.
        seen[norm] = liv = seen.get(norm, 0) + 1
        base = f'{key}{n}'
        aid = f'{prefix}.{base}' + ('' if liv == 1 else chr(ord('a') + liv - 1))
        models[aid] = {
            'name': f'{label} {n}' + ('' if liv == 1 else chr(ord('a') + liv - 1)),
            'shape': geo,
            'colour': b64(cbuf),
            'lowColour': b64(lcbuf),
        }
        length = max(v[0] for v in order) - min(v[0] for v in order)
        print(f'  {aid:18s} {len(index)//3:6d} tris  {length:4.1f}m  shape {geo}')

    for aid in DROP_MODELS:
        if models.pop(aid, None) is None:
            print(f'  ! {aid} is not in the pack; DROP_MODELS is out of date')
        else:
            print(f'  dropped {aid}')

    # A shape only earns its place if a surviving livery still points at it.
    used = {m['shape'] for m in models.values()}
    for geo in [g for g in shapes if g not in used]:
        del shapes[geo]

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
