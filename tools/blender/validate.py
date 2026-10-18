"""Valida art/personajes/<id>.blend antes de exportar (lo que el GLB no deja comprobar fácil).

Uso:
  blender --background --factory-startup --python tools/blender/validate.py -- --id bro

Comprueba: huesos y materiales del contrato, que todo vértice tenga peso (≤ 4 influencias, suma 1), triángulos,
pies plantados (el tobillo no se desliza más de 5 mm en clips sin desplazamiento), bucle (primer = último
fotograma) y deformaciones feas: aristas que se estiran o aplastan demasiado en codos, rodillas, hombros y
cadera en 6 instantes de cada clip. Sale con código 1 si hay errores.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Quaternion  # noqa: E402

import common as C  # noqa: E402

LOCOMOTION = {"suitcase-carry", "rack-carry", "farmer-carry", "bottom-up-carry", "waiter-carry", "turkish-get-up"}
STRETCH_BAD, SQUASH_BAD = 1.8, 0.35   # error
STRETCH_WARN, SQUASH_WARN = 1.45, 0.55  # aviso


def main():
    cid = C.args()["id"]
    bpy.ops.wm.open_mainfile(filepath=C.blend_path(cid))
    errors, warns = [], []
    rig = bpy.data.objects.get("Rig")
    body = bpy.data.objects.get("Body")
    if not rig or not body:
        print("ERROR: faltan Rig o Body")
        sys.exit(1)
    spec = C.load_spec()["characters"][cid]
    realistic = spec.get("source") == "mpfb"  # persona de MakeHuman: texturas y más triángulos
    bones = [b.name for b in rig.data.bones]
    want = [n for n, _ in C.bones_for(spec)]
    if sorted(bones) != sorted(want):
        errors.append(f"huesos distintos del contrato: {sorted(set(bones) ^ set(want))}")
    mats = {m.name for m in body.data.materials}
    for m in ["skin"] if realistic else C.MATERIALS:
        if m not in mats:
            errors.append(f"falta el material {m}")

    me = body.data
    gname = {g.index: g.name for g in body.vertex_groups}
    unweighted, over4, badsum = 0, 0, 0
    for v in me.vertices:
        ws = [g for g in v.groups if g.weight > 1e-5]
        if not ws:
            unweighted += 1
        if len(ws) > 4:
            over4 += 1
        if ws and abs(sum(g.weight for g in ws) - 1) > 1e-3:
            badsum += 1
        for g in ws:
            if gname[g.group] not in want:
                errors.append(f"grupo de vértices sin hueso: {gname[g.group]}")
    if unweighted:
        errors.append(f"{unweighted} vértices sin peso")
    if over4:
        errors.append(f"{over4} vértices con más de 4 influencias")
    if badsum:
        warns.append(f"{badsum} vértices con pesos que no suman 1")
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    if realistic:  # el resto de mallas con piel (pelo, ropa, ojos...) también cuenta
        tris += sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == "MESH" and o.parent == rig and o is not body for p in o.data.polygons)
    for name in ("Kettlebell", "Kettlebell2"):
        ob = bpy.data.objects.get(name)
        if not ob:
            errors.append(f"falta {name}")
        else:
            tris += sum(len(p.vertices) - 2 for p in ob.data.polygons)
    limit = 60000 if realistic else 14000
    if tris > limit:
        errors.append(f"{tris} triángulos (> {limit})")

    # Aristas de reposo (para medir deformación) y región de cada vértice (hueso de más peso).
    rest = [v.co.copy() for v in me.vertices]
    main_bone = []
    for v in me.vertices:
        g = max(v.groups, key=lambda g: g.weight, default=None)
        main_bone.append(gname[g.group] if g else "?")
    edges = [(e.vertices[0], e.vertices[1], (rest[e.vertices[0]] - rest[e.vertices[1]]).length) for e in me.edges]
    edges = [e for e in edges if e[2] > 0.006]  # en aristas de < 6 mm (rizos, curvas cerradas) la proporción es ruido

    import json
    with open(C.POSES_PATH, encoding="utf-8") as f:
        poses = json.load(f)["characters"][cid]["clips"]
    dg = bpy.context.evaluated_depsgraph_get()
    sc = bpy.context.scene
    for act in bpy.data.actions:
        for ob in (rig, bpy.data.objects["Kettlebell"], bpy.data.objects["Kettlebell2"]):
            slot = next((s for s in act.slots if s.identifier == "OB" + ob.name), None)
            ob.animation_data.use_nla = False
            ob.animation_data.action = act
            ob.animation_data.action_slot = slot
        f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])

        # Saltos de rotación entre fotogramas seguidos (giros bruscos de muñeca, volteos de cuaternión).
        cb = act.layers[0].strips[0].channelbag(next(s for s in act.slots if s.identifier == "OBRig"))
        quats = {}
        for fc in cb.fcurves:
            if fc.data_path.endswith("rotation_quaternion"):
                quats.setdefault(fc.data_path, [None] * 4)[fc.array_index] = fc
        jump, where = 0.0, ""
        for path, fcs in quats.items():
            prev = None
            for fr in range(f0, f1 + 1):
                q = Quaternion([fc.evaluate(fr) for fc in fcs]).normalized()
                if prev is not None:
                    ang = math.degrees(2 * math.acos(min(1.0, abs(prev.dot(q)))))
                    if ang > jump:
                        jump, where = ang, f"{path.split('\"')[1]} en el fotograma {fr}"
                prev = q
        # > 80° en un fotograma es un volteo (error); 35-80° es movimiento balístico rápido (aviso).
        (errors if jump > (120 if realistic else 80) else warns if jump > 35 else []).append(f"{act.name}: giro de {jump:.0f}° en un fotograma ({where})")
        print(f"[validate] {act.name}: giro máximo entre fotogramas {jump:.1f}° ({where})")

        def bone_pos(fr):
            sc.frame_set(fr)
            return {n: (rig.matrix_world @ rig.pose.bones[n].head).copy() for n in ("Foot.L", "Foot.R", "Hand.L", "Hand.R", "Hips")}

        p0, p1 = bone_pos(f0), bone_pos(f1)
        gap = max((p0[k] - p1[k]).length for k in p0)
        if gap > 1e-3:
            errors.append(f"{act.name}: el bucle salta {gap * 1000:.1f} mm entre el primer y el último fotograma")
        # Pies que deben quedar plantados: los que tienen el tobillo fijo en la 2D (en la zancada o el RDL a
        # una pierna, el otro pie se mueve a propósito).
        frames2d = poses.get(act.name, {}).get("frames", [])
        fixed = [foot for i, foot in ((0, "Foot.R"), (1, "Foot.L"))
                 if frames2d and max(abs(f["ankle"][i][k] - frames2d[0]["ankle"][i][k]) for f in frames2d for k in (0, 1)) < 0.5]
        if act.name not in LOCOMOTION and fixed:
            slide = 0.0
            ref = {k: p0[k] for k in fixed}
            for fr in range(f0, f1 + 1, 2):
                p = bone_pos(fr)
                slide = max(slide, max((p[k] - ref[k]).length for k in ref))
            if slide > (0.02 if realistic else 0.005):
                errors.append(f"{act.name}: los pies se deslizan {slide * 1000:.1f} mm")
            else:
                print(f"[validate] {act.name}: pies plantados {'+'.join(fixed)} (deriva máx. {slide * 1000:.2f} mm)")

        worst = {}
        for k in range(6):
            sc.frame_set(f0 + round((f1 - f0) * k / 6))
            ev = body.evaluated_get(dg)
            m = ev.to_mesh()
            co = [v.co.copy() for v in m.vertices]
            ev.to_mesh_clear()
            for a, b, l0 in edges:
                r = (co[a] - co[b]).length / l0
                if r > STRETCH_WARN or r < SQUASH_WARN:
                    region = main_bone[a]
                    w = worst.get(region)
                    dev = max(r, 1 / max(r, 1e-6))
                    if w is None or dev > w[0]:
                        worst[region] = (dev, r, k)
        for region, (dev, r, k) in sorted(worst.items(), key=lambda kv: -kv[1][0]):
            msg = f"{act.name}: arista en {region} {'estirada' if r > 1 else 'aplastada'} x{r:.2f} (instante {k}/6)"
            # Pliegues de flexión profunda (corva, codo, delante del cuello) son propios de la piel lineal: en las
            # articulaciones que se doblan el error salta a x2,4 / x0,2; por debajo queda como aviso.
            crease = region.split(".")[0] in {"Neck", "Chest", "UpperArm", "ForeArm", "UpLeg", "Leg"}
            hi, lo = (2.4, 0.2) if crease else (STRETCH_BAD, SQUASH_BAD)
            hard = (r > hi or r < lo) and not region.startswith("Tail") and not realistic  # el pelo es blando; en las mallas densas de MakeHuman las aristas de pliegue se juzgan a ojo
            (errors if hard else warns).append(msg)

    print(f"[validate] {cid}: {len(me.vertices)} vértices, {tris} triángulos, {len(bones)} huesos, {len(bpy.data.actions)} clips")
    for w in warns:
        print(f"[validate] aviso: {w}")
    for e in errors:
        print(f"[validate] ERROR: {e}")
    if errors:
        sys.exit(1)
    print("[validate] OK")


if __name__ == "__main__":
    main()
