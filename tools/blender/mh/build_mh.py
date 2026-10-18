"""Monta un personaje realista (MakeHuman vía MPFB, activos CC0) sobre el esqueleto del contrato.

Uso (con las preferencias del usuario, donde está instalada la extensión MPFB; NO con --factory-startup):
  blender --background --python tools/blender/mh/build_mh.py -- --id bro [--stage raw|rig]

Pasos:
  1. Humano de MPFB con parámetros de people.json, piel, ojos, cejas, pestañas, pelo, ropa y calzado.
  2. Puño: se flexionan los dedos del esqueleto de MPFB y se hornea la pose en las mallas (las manos del contrato son rígidas).
  3. Se miden las articulaciones del esqueleto de MPFB y se escriben en characters.json (skeleton, scale2d).
  4. Se crea el esqueleto del contrato (21 huesos) sobre esas articulaciones y se reparten los pesos de MPFB entre sus huesos.
  5. Materiales por rol (skin, hair, eyes, ...) con texturas reducidas, pesas y guardado en art/personajes/<id>.blend.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402

EXT = "bl_ext.user_default.mpfb"
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
RAD = math.pi / 180


def mpfb():
    """Importa los servicios de MPFB (la extensión debe estar activa en las preferencias)."""
    import importlib

    names = ("humanservice", "targetservice", "locationservice", "objectservice")
    return {n: importlib.import_module(f"{EXT}.services.{n}") for n in names}


def people():
    with open(os.path.join(HERE, "people.json"), encoding="utf-8") as f:
        return json.load(f)


# ───────────────────────── 1. Humano ─────────────────────────

def clear_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures, bpy.data.actions):
        for d in list(coll):
            coll.remove(d)


def make_human(cfg):
    m = mpfb()
    HS, TS, LS = m["humanservice"].HumanService, m["targetservice"].TargetService, m["locationservice"].LocationService
    data = LS.get_user_data()
    macro = TS.get_default_macro_info_dict()
    macro.update(cfg["macro"])
    macro["race"] = dict(cfg["race"])
    base = HS.create_human(macro_detail_dict=macro, feet_on_ground=True, scale=0.1)
    rig = HS.add_builtin_rig(base, "default")
    path = lambda rel: os.path.join(data, rel)  # noqa: E731
    HS.set_character_skin(path(cfg["skin"]), base, skin_type="GAMEENGINE")
    parts = {"base": base}
    add = lambda key, rel, kind: parts.__setitem__(key, HS.add_mhclo_asset(path(rel), base, asset_type=kind, material_type="GAMEENGINE", subdiv_levels=0))  # noqa: E731
    add("eyes", cfg["eyes"]["mhclo"], "Eyes")
    if cfg.get("eyebrows"):
        add("eyebrows", cfg["eyebrows"], "Eyebrows")
    if cfg.get("eyelashes"):
        add("eyelashes", cfg["eyelashes"], "Eyelashes")
    add("hair", cfg["hair"], "Hair")
    for i, rel in enumerate(cfg["clothes"]):
        add(f"clothes{i}", rel, "Clothes")
    add("shoes", cfg["shoes"], "Clothes")
    return base, rig, parts, data


# ───────────────────────── 2. Puño ─────────────────────────

FIST = {  # grados por falange (se prueba el signo mirando la malla)
    2: (70, 95, 60), 3: (75, 98, 60), 4: (78, 100, 60), 5: (80, 100, 55),
}
THUMB = (20, 35, 45)


def pose_fists(rig, sign=1.0):
    for side in ("L", "R"):
        for f, angs in FIST.items():
            for k, a in enumerate(angs):
                pb = rig.pose.bones.get(f"finger{f}-{k + 1}.{side}")
                if pb:
                    pb.rotation_mode = "XYZ"
                    pb.rotation_euler = (sign * a * RAD, 0, 0)
        for k, a in enumerate(THUMB):
            pb = rig.pose.bones.get(f"finger1-{k + 1}.{side}")
            if pb:
                pb.rotation_mode = "XYZ"
                pb.rotation_euler = (sign * a * RAD, 0, 0)
    bpy.context.view_layer.update()


def bake_meshes(parts):
    """Mallas ya deformadas (puño) y sin lo que oculta la máscara, con sus grupos de vértices de MPFB."""
    dg = bpy.context.evaluated_depsgraph_get()
    out = {}
    for key, ob in parts.items():
        ev = ob.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        nob = bpy.data.objects.new(key, me)
        bpy.context.scene.collection.objects.link(nob)
        groups = [g.name for g in ob.vertex_groups]
        for g in groups:
            nob.vertex_groups.new(name=g)
        # new_from_object conserva los pesos en la malla; si los nombres no se enlazaron, se copian a mano
        if len(nob.vertex_groups) and not any(len(v.groups) for v in me.vertices[:50]):
            src = ev.data
            for v in src.vertices:
                for g in v.groups:
                    nob.vertex_groups[g.group].add([v.index], g.weight, "REPLACE")
        for slot in ob.material_slots:
            nob.data.materials.append(slot.material)
        out[key] = nob
    return out


# ───────────────────────── 3. Medidas del esqueleto de MPFB ─────────────────────────

def measure(rig):
    """Articulaciones del esqueleto de MPFB en la pose de reposo, con las claves de build_character.rest_joints."""
    W, B = rig.matrix_world, rig.data.bones
    head = lambda n: W @ B[n].head_local  # noqa: E731
    tail = lambda n: W @ B[n].tail_local  # noqa: E731
    j = {}
    hl, hr = head("upperleg01.L"), head("upperleg01.R")
    ankle_y = (head("foot.L").y + head("foot.R").y) / 2
    j["P"] = Vector((0, 0, (hl.z + hr.z) / 2))
    j["C"] = Vector((0, 0, head("neck01").z))
    hd, hd_tail = head("head"), tail("head")
    j["H"] = Vector((0, 0, hd.z + 0.48 * (hd_tail.z - hd.z)))
    for side in ("L", "R"):
        j["hip" + side] = head(f"upperleg01.{side}")
        j["knee" + side] = head(f"lowerleg01.{side}")
        j["ankle" + side] = head(f"foot.{side}")
        balls = [head(f"toe{k}-1.{side}") for k in range(1, 6)]
        j["ball" + side] = sum(balls, Vector()) / 5
        tips = [tail(f"toe{k}-3.{side}") for k in range(2, 6)] + [tail(f"toe1-2.{side}")]
        j["tip" + side] = min(tips, key=lambda p: p.y)
        j["clav" + side] = head(f"clavicle.{side}")
        j["sh" + side] = head(f"upperarm01.{side}")
        j["el" + side] = head(f"lowerarm01.{side}")
        j["wr" + side] = head(f"wrist.{side}")
    return j, ankle_y, hd_tail.z - hd.z, hd.z


def fit_skeleton(j, head_len, head_base_z, cfg):
    """Dimensiones del bloque skeleton de characters.json a partir de las articulaciones medidas."""
    cz = j["C"].z
    ua = j["elL"] - j["shL"]
    return {
        "hipZ": round(j["P"].z, 4),
        "hipHalfWidth": round(abs(j["hipL"].x - j["hipR"].x) / 2, 4),
        "thigh": round((j["hipL"] - j["kneeL"]).length, 4),
        "shin": round((j["kneeL"] - j["ankleL"]).length, 4),
        "ankleZ": round(j["ankleL"].z, 4),
        "ankleHalfWidth": round(abs(j["ankleL"].x - j["ankleR"].x) / 2, 4),
        "heel": 0.07,
        "footToBall": round(abs(j["ankleL"].y - j["ballL"].y), 4),
        "ballToTip": round(abs(j["ballL"].y - j["tipL"].y), 4),
        "spine": round((cz - j["P"].z) / 2, 4),
        "chest": round((cz - j["P"].z) / 2, 4),
        "neck": round(head_base_z - cz, 4),
        "headCenterAboveNeck": round(j["H"].z - head_base_z, 4),
        "headBone": round(head_len, 4),
        "shoulderHalfWidth": round(abs(j["clavL"].x - j["clavR"].x) / 2 + 0.07, 4),
        "shoulderDrop": round(cz - j["shL"].z, 4),
        "upperArm": round(ua.length, 4),
        "foreArm": round((j["wrL"] - j["elL"]).length, 4),
        "wristToGrip": cfg.get("wristToGrip", 0.07),
        "hand": cfg.get("handLen", 0.1),
        "restArmDeg": round(math.degrees(math.atan2(abs(ua.x), -ua.z)), 1),
        "restElbowDeg": 0,
        "armRootHalfWidth": round(abs(j["shL"].x - j["shR"].x) / 2, 4),
        "armRootForward": round(-j["shL"].y, 4),
    }


# ───────────────────────── 4. Esqueleto del contrato y pesos ─────────────────────────

NON_DEFORM = ("joint-", "helper-", "Delete")
NON_DEFORM_EXACT = ("root", "body", "HelperGeometry", "JointCubes", "Left", "Mid", "Right", "fingernails", "toenails")


def our_bone(name):
    """Hueso del contrato que recoge el peso de un grupo de MPFB (None = no deforma)."""
    side = name[-2:] if name.endswith((".L", ".R")) else ""
    base = name[: -len(side)] if side else name
    if base in NON_DEFORM_EXACT or base.startswith(NON_DEFORM):
        return None
    if base == "pelvis":
        return "Hips"
    if base.startswith("upperleg"):
        return "UpLeg" + side
    if base.startswith("lowerleg"):
        return "Leg" + side
    if base == "foot":
        return "Foot" + side
    if base.startswith("toe"):
        return "Toe" + side
    if base in ("spine05", "spine04"):
        return "Spine"
    if base in ("spine03", "spine02", "spine01", "breast"):
        return "Chest"
    if base in ("clavicle", "shoulder01"):
        return "Shoulder" + side
    if base.startswith("upperarm"):
        return "UpperArm" + side
    if base.startswith("lowerarm"):
        return "ForeArm" + side
    if base == "wrist" or base.startswith(("finger", "metacarpal")):
        return "Hand" + side
    if base.startswith("neck"):
        return "Neck"
    return "Head"  # cabeza, mandíbula, ojos y toda la musculatura facial


def reskin(ob, bone_names):
    """Sustituye los grupos de MPFB por los del contrato (suma por hueso, 4 influencias como máximo, normalizado)."""
    old = {g.index: g.name for g in ob.vertex_groups}
    rows = []
    for v in ob.data.vertices:
        acc = {}
        for g in v.groups:
            tgt = our_bone(old.get(g.group, ""))
            if tgt and g.weight > 1e-5:
                acc[tgt] = acc.get(tgt, 0.0) + g.weight
        rows.append(acc)
    ob.vertex_groups.clear()
    for n in bone_names:
        ob.vertex_groups.new(name=n)
    orphans = 0
    for vi, acc in enumerate(rows):
        if not acc:
            acc = {"Hips": 1.0}
            orphans += 1
        top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
        tot = sum(w for _, w in top)
        for b, w in top:
            ob.vertex_groups[b].add([vi], w / tot, "REPLACE")
    return orphans


# ───────────────────────── 5. Materiales ─────────────────────────

TEX_SIZE = {"skin": 1024, "hair": 1024, "top": 1024, "shoes": 512, "eyes": 256, "eyebrows": 256, "eyelashes": 256}


def read_mhmat(path):
    out = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            p = line.split()
            if len(p) >= 2 and not line.startswith(("#", "//")):
                out.setdefault(p[0], p[1])
    return out


def load_image(path, size, srgb=True, name=None):
    img = bpy.data.images.load(path, check_existing=False)
    if name:
        img.name = name
    if max(img.size) > size:
        img.scale(size, size)
    if not srgb:
        img.colorspace_settings.name = "Non-Color"
    img.pack()
    return img


def paint_out(img, rects, ref):
    """Borra rótulos de una textura: cada rectángulo (fracciones u0,v0,u1,v1 con el origen arriba a la izquierda) se rellena con el color medio de `ref`."""
    import numpy as np

    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)  # la fila 0 es la de abajo

    def box(r):
        u0, v0, u1, v1 = r
        return int((1 - v1) * h), int((1 - v0) * h), int(u0 * w), int(u1 * w)

    y0, y1, x0, x1 = box(ref)
    fill = px[y0:y1, x0:x1].reshape(-1, 4).mean(axis=0)
    for r in rects:
        y0, y1, x0, x1 = box(r)
        px[y0:y1, x0:x1] = fill
    img.pixels.foreach_set(px.ravel())
    img.update()
    img.pack()  # sin esto el exportador usaría la copia empaquetada de antes del retoque


def pbr(role, mhmat_path, alpha=False, normal=False, roughness=0.55, metallic=0.0, spec=0.35, paint=None):
    mh = read_mhmat(mhmat_path)
    folder = os.path.dirname(mhmat_path)
    size = TEX_SIZE.get(role, 1024)
    mat = bpy.data.materials.new(role)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Specular IOR Level"].default_value = spec
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = load_image(os.path.join(folder, mh["diffuseTexture"]), size, True, role + "_color")
    if paint:
        paint_out(tex.image, paint["rects"], paint["ref"])
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if alpha:
        nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        try:
            mat.blend_method = "BLEND"
        except Exception:  # noqa: BLE001
            pass
    if normal and mh.get("normalmapTexture"):
        nimg = nt.nodes.new("ShaderNodeTexImage")
        nimg.image = load_image(os.path.join(folder, mh["normalmapTexture"]), min(size, 512), False, role + "_normal")
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(nimg.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    mat.diffuse_color = (0.8, 0.8, 0.8, 1)
    return mat


def solid(role, hex_color, roughness=0.5, metallic=0.0):
    m = C.make_material(role, hex_color)
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Roughness"].default_value = roughness
    b.inputs["Metallic"].default_value = metallic
    return m


def set_material(ob, mat):
    me = ob.data
    me.materials.clear()
    me.materials.append(mat)
    for p in me.polygons:
        p.material_index = 0


# ───────────────────────── Montaje ─────────────────────────

def assemble(cid, cfg, base, rig, parts, data):
    import build_character as BC
    from mathutils import Matrix

    pose_fists(rig, 1.0)
    baked = bake_meshes(parts)
    for key, o in baked.items():
        o.data.transform(parts[key].matrix_world)
    j, ankle_y, head_len, head_base_z = measure(rig)
    # El personaje queda centrado entre los pies (los tobillos en y = 0).
    shift = Vector((0, -ankle_y, 0))
    for o in baked.values():
        o.data.transform(Matrix.Translation(shift))
    for k in j:
        j[k] = j[k] + shift
    j["P"].y = j["C"].y = j["H"].y = 0.0
    if cfg.get("sockFix"):
        # El calcetín del calzado asoma a trozos por encima de las mallas ajustadas (z-fighting): se mete 9 mm hacia el eje de la pierna.
        for v in baked["shoes"].data.vertices:
            a = j["ankleL"] if v.co.x > 0 else j["ankleR"]
            t = C.smoothstep(a.z + 0.03, a.z + 0.08, v.co.z)
            dx, dy = v.co.x - a.x, v.co.y - a.y
            n = math.hypot(dx, dy)
            if t > 0 and n > 1e-6:
                v.co.x -= dx / n * 0.009 * t
                v.co.y -= dy / n * 0.009 * t
    sk = fit_skeleton(j, head_len, head_base_z, cfg.get("fit", {}))
    height = max(v.co.z for v in baked["base"].data.vertices)
    scale2d = round((sk["thigh"] + sk["shin"]) / 66.0, 5)
    for s in ("L", "R"):
        j["grip" + s] = j["wr" + s] + (j["wr" + s] - j["el" + s]).normalized() * sk["wristToGrip"]
    print(f"[mh] altura {height:.3f} m · muslo {sk['thigh']} · espinilla {sk['shin']} · brazo {sk['upperArm']}+{sk['foreArm']} · cuello {sk['neck']} · scale2d {scale2d}")

    fit = json.load(open(C.FIT_PATH, encoding="utf-8")) if os.path.exists(C.FIT_PATH) else {"_doc": "Medidas ajustadas por tools/blender/mh/build_mh.py"}
    fit[cid] = {"source": "mpfb", "height": round(height, 3), "scale2d": scale2d, "skeleton": sk, "minArmAbduction": cfg.get("minArmAbduction", 8)}
    with open(C.FIT_PATH, "w", encoding="utf-8") as fh:
        json.dump(fit, fh, indent=2)
    spec_all = C.load_spec()

    # Esqueleto del contrato sobre las articulaciones medidas
    bones = C.BONES
    ours = BC.build_rig(BC.rest_frames(sk, j), bones)
    names = [n for n, _ in bones]

    # Materiales por rol
    path = lambda rel: os.path.join(data, rel)  # noqa: E731
    mhmat_of = lambda mhclo: os.path.join(os.path.dirname(path(mhclo)), os.path.basename(mhclo).replace(".mhclo", ".mhmat"))  # noqa: E731
    mats = {
        "base": pbr("skin", path(cfg["skin"]), roughness=0.62, spec=0.3),
        "hair": pbr("hair", mhmat_of(cfg["hair"]), alpha=True, roughness=0.75, spec=0.35),
        "eyes": pbr("eyes", path(cfg["eyes"]["mhmat"]), roughness=0.15, spec=0.6),
        "shoes": pbr("shoes", mhmat_of(cfg["shoes"]), roughness=0.6),
    }
    if cfg.get("eyebrows"):
        mats["eyebrows"] = pbr("eyebrows", mhmat_of(cfg["eyebrows"]), alpha=True, roughness=0.8)
    if cfg.get("eyelashes"):
        mats["eyelashes"] = pbr("eyelashes", mhmat_of(cfg["eyelashes"]), alpha=True, roughness=0.8)
    for i, rel in enumerate(cfg["clothes"]):
        mats[f"clothes{i}"] = pbr("top" if i == 0 else f"top{i}", mhmat_of(rel), normal=True, roughness=0.7, spec=0.25, paint=cfg.get("paint", {}).get(f"clothes{i}"))

    tris = 0
    for key, o in baked.items():
        set_material(o, mats[key])
        orphans = reskin(o, names)
        o.name = "Body" if key == "base" else key.capitalize()
        o.parent = ours
        mod = o.modifiers.new("Rig", "ARMATURE")
        mod.object = ours
        tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
        o.data.shade_smooth()
        print(f"[mh]   {o.name}: {len(o.data.vertices)} vértices, huérfanos {orphans}")
    for o in list(parts.values()):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.objects.remove(rig, do_unlink=True)

    # Pesas (las mismas del contrato)
    bell = cfg.get("bell", {"bell": "#17181f", "bellHandle": "#17181f"})
    bmats = {"bell": solid("bell", bell["bell"], 0.4, 0.35), "bellHandle": solid("bellHandle", bell["bellHandle"], 0.4, 0.5)}
    bell_me = BC.mesh_from(BC.build_bell_mesh(spec_all), "Kettlebell", bmats)
    for name in ("Kettlebell", "Kettlebell2"):
        ob = bpy.data.objects.new(name, bell_me)
        bpy.context.scene.collection.objects.link(ob)
        ob.rotation_mode = "QUATERNION"
        ob.location = (0.35 if name == "Kettlebell" else -0.35, -0.25, 0.165 + 0.095 * 0.9)
    tris += 2 * sum(len(p.vertices) - 2 for p in bell_me.polygons)
    print(f"[mh] {cid}: {tris} triángulos con pesas, {len(bones)} huesos")
    out = C.blend_path(cid)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    C.save(out)
    print(f"[mh] guardado {out}")
    return ours


# ───────────────────────── Vista previa ─────────────────────────

def render_quick(objs, png, size=(700, 940), yaw=0.0, target_z=0.9, dist=5.2, focal=70):
    sc = bpy.context.scene
    for o in bpy.data.objects:
        if o.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(o)
    cam_d = bpy.data.cameras.new("cam")
    cam_d.lens = focal
    cam = bpy.data.objects.new("cam", cam_d)
    sc.collection.objects.link(cam)
    a = math.radians(yaw)
    cam.location = (math.sin(a) * dist, -math.cos(a) * dist, target_z + 0.05)
    d = Vector((0, 0, target_z)) - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light, sh.color_type, sh.show_cavity = "STUDIO", "TEXTURE", False
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.film_transparent = False
    sc.world = sc.world or bpy.data.worlds.new("w")
    sc.world.color = (0.55, 0.6, 0.65)
    sc.render.filepath = png
    bpy.ops.render.render(write_still=True)


def main():
    a = C.args()
    cid = a["id"]
    stage = a.get("stage", "rig")
    cfg = people()[cid]
    clear_scene()
    base, rig, parts, data = make_human(cfg)
    print(f"[mh] {cid}: {len(base.data.vertices)} vértices en la malla base, {len(rig.data.bones)} huesos MPFB, partes: {list(parts)}")
    out_dir = os.path.join(C.ROOT, "art", "previews", "mh")
    os.makedirs(out_dir, exist_ok=True)
    if stage == "raw":
        sign = float(a.get("sign", 1))
        pose_fists(rig, sign)
        baked = bake_meshes(parts)
        for o in list(parts.values()) + [rig]:
            o.hide_render = True
        print("[mh] malla horneada:", {k: len(v.data.vertices) for k, v in baked.items()})
        for yaw in (0, 90, 35):
            render_quick(list(baked.values()), os.path.join(out_dir, f"{cid}_raw_{yaw}.png"), yaw=yaw)
        render_quick(list(baked.values()), os.path.join(out_dir, f"{cid}_raw_hand.png"), size=(700, 700), yaw=20, target_z=1.0, dist=1.6, focal=85)
        return
    assemble(cid, cfg, base, rig, parts, data)
    for yaw in (0, 90, 35):
        render_quick(None, os.path.join(out_dir, f"{cid}_rig_{yaw}.png"), yaw=yaw)


if __name__ == "__main__":
    main()
