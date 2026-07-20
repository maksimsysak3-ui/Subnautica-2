#!/usr/bin/env python3
"""Convert the supplied USDZ meshes to web-ready GLB files.
Car  -> assets/models/f1_car.glb        (33 parts, value-based PBR, node names kept)
Wheel-> assets/models/steering_wheel.glb (textured PBR, maps embedded in the GLB)
Nothing is embedded in index.html; these are separate binary assets.
"""
import numpy as np, trimesh, io
from PIL import Image
from pxr import Usd, UsdGeom, UsdShade

OUT="assets/models"

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
    P=np.array(m.GetPointsAttr().Get(), dtype=np.float64)
    N=np.array(m.GetNormalsAttr().Get(), dtype=np.float64)
    fc=np.array(m.GetFaceVertexCountsAttr().Get(), dtype=np.int64)
    fi=np.array(m.GetFaceVertexIndicesAttr().Get(), dtype=np.int64)
    # world transform (row-vector convention)
    M=np.array(xform.GetLocalToWorldTransform(prim), dtype=np.float64)
    Pw=(np.c_[P, np.ones(len(P))] @ M)[:, :3]
    Pw[:,1]+=yshift
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

# =========================================================================
def convert_car():
    st=Usd.Stage.Open(f"{OUT}/car_src/scene.usdc")
    xf=UsdGeom.XformCache(Usd.TimeCode.Default())
    # global min-y to drop wheels onto ground plane y=0
    gminy=1e9
    prims=[p for p in st.Traverse() if p.GetTypeName()=="Mesh"]
    for p in prims:
        m=UsdGeom.Mesh(p); P=np.array(m.GetPointsAttr().Get(),dtype=np.float64)
        M=np.array(xf.GetLocalToWorldTransform(p),dtype=np.float64)
        gminy=min(gminy, ((np.c_[P,np.ones(len(P))]@M)[:,1]).min())
    yshift=-gminy
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
    st=Usd.Stage.Open(f"{OUT}/wheel_src/scene.usdc")
    xf=UsdGeom.XformCache(Usd.TimeCode.Default())
    p=[pr for pr in st.Traverse() if pr.GetTypeName()=="Mesh"][0]
    Pw,Nw,faces,uv=mesh_arrays(p, xf, 0.0, want_uv=True)
    TS=(1024,1024)
    base=Image.open(f"{OUT}/wheel_src/0/DefaultMaterial_baseColor.jpg").convert("RGB").resize(TS)
    normal=Image.open(f"{OUT}/wheel_src/0/DefaultMaterial_normal.jpg").convert("RGB").resize(TS)
    rough=Image.open(f"{OUT}/wheel_src/0/DefaultMaterial_metallicRoughness_rough.jpg").convert("L").resize(TS)
    metal=Image.open(f"{OUT}/wheel_src/0/DefaultMaterial_metallicRoughness_metal.jpg").convert("L").resize(TS)
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
    convert_car()
    convert_wheel()
