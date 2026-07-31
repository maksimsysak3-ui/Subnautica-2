#!/usr/bin/env python3
"""Convert the supplied USDZ meshes to web-ready GLB files.

Car  -> assets/models/f1_car.glb        (33 parts, value-based PBR, node names kept)
Wheel-> assets/models/steering_wheel.glb (textured PBR, maps embedded in the GLB)
Nothing is embedded in index.html; these are separate binary assets.

Requires: numpy, trimesh, Pillow, and usd-core (the `pxr` module).

    python3 -m pip install numpy trimesh pillow usd-core
    python3 tools_convert.py

The USD sources are the extracted contents of the original .usdz files and are
NOT in the repository (see .gitignore) — extract them to assets/models/car_src/
and assets/models/wheel_src/ before running, or point --out somewhere else.
"""
import argparse, sys, os

try:
    import numpy as np
    import trimesh
    from PIL import Image
    from pxr import Usd, UsdGeom, UsdShade
except ImportError as e:                       # a clear message beats a bare traceback
    sys.exit(f"Missing dependency: {e.name}.\n"
             "Install with:  python3 -m pip install numpy trimesh pillow usd-core")

# Resolved from the script's own location, not the current directory, so running
# it from anywhere writes to the repo rather than to wherever the shell happens
# to be. --out overrides it.
REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(REPO_ROOT, "assets", "models")
TEX_SIZE = 1024                                # steering-wheel map resolution

# ---- car material name -> approximate PBR values -------------------------
CAR_MAT = {
 'Carbon_Fiber___Twill':  dict(base=[0.020,0.020,0.024,1], metal=0.30, rough=0.42),
 'Carbon_Fiber___Plain':  dict(base=[0.022,0.022,0.026,1], metal=0.30, rough=0.40),
 'Titanium___Polished':   dict(base=[0.62,0.62,0.64,1],    metal=1.00, rough=0.20),
 'Titanium___Satin':      dict(base=[0.50,0.50,0.53,1],    metal=1.00, rough=0.42),
 'Fabric_Black':          dict(base=[0.030,0.030,0.035,1], metal=0.00, rough=0.85),
 'Rubber___Weathered':    dict(base=[0.014,0.014,0.016,1], metal=0.00, rough=0.82),
}
DEFAULT=dict(base=[0.05,0.05,0.05,1], metal=0.2, rough=0.6)

def tri_faces(counts):
    """fan-triangulate polygon face-vertex-counts -> flat index offsets into the
    per-face vertex-index stream. Returns list of (a,b,c) indices into that stream."""
    out=[]; o=0
    for c in counts:
        for k in range(1,c-1):
            out.append((o, o+k, o+k+1))
        o+=c
    return np.array(out, dtype=np.int64)

def mesh_arrays(prim, xform, yshift, want_uv=False):
    m=UsdGeom.Mesh(prim)
    pts=m.GetPointsAttr().Get()
    if pts is None:
        raise ValueError(f"{prim.GetPath()} has no points")
    P=np.array(pts, dtype=np.float64)
    fc=np.array(m.GetFaceVertexCountsAttr().Get(), dtype=np.int64)
    fi=np.array(m.GetFaceVertexIndicesAttr().Get(), dtype=np.int64)
    # world transform (row-vector convention)
    M=np.array(xform.GetLocalToWorldTransform(prim), dtype=np.float64)
    Pw=(np.c_[P, np.ones(len(P))] @ M)[:, :3]
    Pw[:,1]+=yshift
    # Normals are optional in USD. This used to index straight into the attribute
    # and die with an opaque TypeError on any mesh without authored normals;
    # trimesh can derive them from the faces perfectly well, so hand back None.
    raw_n=m.GetNormalsAttr().Get()
    if raw_n is None or len(raw_n)!=len(P):
        # None, or authored face-varying (one per face-vertex) rather than one per
        # point — either way it does not line up with the vertex array, so drop it
        Nw=None
    else:
        N=np.array(raw_n, dtype=np.float64)
        Nm=np.linalg.inv(M[:3,:3]).T
        Nw=N @ Nm
        Nw/=(np.linalg.norm(Nw,axis=1,keepdims=True)+1e-12)
    # triangulate: build faces that index into the point array via fi stream
    facestream=tri_faces(fc)             # indices into fi order
    faces=fi[facestream]                 # -> point indices  (T,3)
    uv=None
    if want_uv:
        st=UsdGeom.PrimvarsAPI(prim).GetPrimvar("st0")
        if st and st.Get() is not None:
            uv=np.array(st.Get(), dtype=np.float64)[:, :2]
    return Pw, Nw, faces, uv

def open_stage(rel):
    """Open a USD stage, with a message that says what to do if it isn't there."""
    path=os.path.join(OUT, rel)
    if not os.path.exists(path):
        sys.exit(f"Source not found: {path}\n"
                 "The extracted USD sources are not committed (see .gitignore) — "
                 "unzip the original .usdz into that folder first.")
    stage=Usd.Stage.Open(path)
    if stage is None:
        sys.exit(f"Could not open {path} as a USD stage.")
    return stage

# =========================================================================
def convert_car():
    st=open_stage("car_src/scene.usdc")
    xf=UsdGeom.XformCache(Usd.TimeCode.Default())
    prims=[p for p in st.Traverse() if p.GetTypeName()=="Mesh"]
    if not prims:
        sys.exit("car_src/scene.usdc contains no Mesh prims.")
    # global min-y to drop the wheels onto the ground plane at y=0
    mins=[]
    for p in prims:
        m=UsdGeom.Mesh(p); pts=m.GetPointsAttr().Get()
        if pts is None: continue
        P=np.array(pts,dtype=np.float64)
        M=np.array(xf.GetLocalToWorldTransform(p),dtype=np.float64)
        mins.append(((np.c_[P,np.ones(len(P))]@M)[:,1]).min())
    if not mins:
        sys.exit("None of the car meshes have points — nothing to convert.")
    yshift=-min(mins)
    scene=trimesh.Scene()
    tot=0
    for p in prims:
        binding=UsdShade.MaterialBindingAPI(p).ComputeBoundMaterial()[0]
        matname=binding.GetPath().name if binding else "-"
        spec=CAR_MAT.get(matname, DEFAULT)
        Pw,Nw,faces,_=mesh_arrays(p, xf, yshift)
        tm=trimesh.Trimesh(vertices=Pw, faces=faces, vertex_normals=Nw, process=False)
        tm.visual=trimesh.visual.TextureVisuals(
            material=trimesh.visual.material.PBRMaterial(
                name=matname,
                baseColorFactor=spec['base'],
                metallicFactor=spec['metal'],
                roughnessFactor=spec['rough']))
        scene.add_geometry(tm, node_name=p.GetName(), geom_name=p.GetName())
        tot+=len(faces)
    scene.export(f"{OUT}/f1_car.glb")
    print(f"car  -> f1_car.glb  parts={len(prims)} tris={tot} yshift={yshift:.1f}")

# =========================================================================
def convert_wheel():
    st=open_stage("wheel_src/scene.usdc")
    xf=UsdGeom.XformCache(Usd.TimeCode.Default())
    meshes=[pr for pr in st.Traverse() if pr.GetTypeName()=="Mesh"]
    if not meshes:
        sys.exit("wheel_src/scene.usdc contains no Mesh prims.")
    p=meshes[0]
    Pw,Nw,faces,uv=mesh_arrays(p, xf, 0.0, want_uv=True)
    TS=(TEX_SIZE,TEX_SIZE)
    def tex(name, mode):
        path=os.path.join(OUT,"wheel_src","0",name)
        if not os.path.exists(path):
            sys.exit(f"Missing wheel texture: {path}")
        return Image.open(path).convert(mode).resize(TS)
    base  =tex("DefaultMaterial_baseColor.jpg","RGB")
    normal=tex("DefaultMaterial_normal.jpg","RGB")
    rough =tex("DefaultMaterial_metallicRoughness_rough.jpg","L")
    metal =tex("DefaultMaterial_metallicRoughness_metal.jpg","L")
    # glTF metallicRoughness: G=roughness, B=metallic
    sz=rough.size
    if metal.size!=sz: metal=metal.resize(sz)
    mr=Image.merge("RGB",(Image.new("L",sz,0), rough, metal))
    tm=trimesh.Trimesh(vertices=Pw, faces=faces, vertex_normals=Nw, process=False)
    tm.visual=trimesh.visual.TextureVisuals(
        uv=uv,
        material=trimesh.visual.material.PBRMaterial(
            name="SteeringWheel",
            baseColorTexture=base,
            normalTexture=normal,
            metallicRoughnessTexture=mr,
            metallicFactor=1.0, roughnessFactor=1.0))
    trimesh.Scene({ 'steering_wheel': tm }).export(f"{OUT}/steering_wheel.glb")
    print(f"wheel-> steering_wheel.glb tris={len(faces)} uv={uv is not None} tex={sz}")

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=OUT,
        help="model directory to read *_src/ from and write the .glb files into "
             "(default: the repo's assets/models)")
    ap.add_argument("--tex-size", type=int, default=1024,
        help="steering-wheel texture resolution, px (default: 1024)")
    ap.add_argument("--only", choices=["car","wheel"],
        help="convert just one of the two assets")
    args=ap.parse_args()
    OUT=os.path.abspath(args.out)
    TEX_SIZE=args.tex_size
    if args.only!="wheel": convert_car()
    if args.only!="car":   convert_wheel()
