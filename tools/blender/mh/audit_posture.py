"""Auditoría de postura: mide ángulos de cada clip (ya animado) y los vuelca en art/personajes/audit_<id>.json.

Uso:  blender --background --factory-startup --python tools/blender/mh/audit_posture.py -- --id bro

Convenciones (Blender): +X = izquierda del personaje, -Y = delante, +Z = arriba. Ángulos en grados.
  trunk      inclinación del tronco (cadera -> base del cuello) desde la vertical; + = hacia delante, - = hacia atrás.
  neck       cuello (base -> centro de la cabeza) respecto al tronco; + = flexionado hacia delante/abajo, - = extendido hacia atrás/arriba.
  head       orientación de la cabeza (hueso Head) respecto al tronco; mismo signo. Es lo que se ve como «barbilla arriba».
  kneeL/R    flexión de la rodilla (0 = recta).
  hipL/R     flexión de la cadera (0 = muslo alineado con el tronco).
  valgusL/R  metros que la rodilla queda por dentro de la línea cadera-tobillo (+ = hacia dentro).
  elbowL/R   flexión del codo (0 = recto).
  armL/R     elevación del brazo respecto al tronco (0 = pegado al costado, 180 = vertical arriba).
  wristOffL/R   desplazamiento (m) del puño respecto al hombro en el plano: adelante(+)/atrás(-) y lateral.
  bellZ, bellY  altura y avance de la pesa (m) respecto a la cadera.
  stance     separación de los tobillos (m).
  pelvisTilt/pelvisYaw/trunkLat   caída lateral y giro de la cadera, e inclinación lateral del tronco (grados).
  kneeFwdL/R  avance de la rodilla sobre el tobillo (m).
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402


def assign(clip):
    act = bpy.data.actions[clip]
    for ob in bpy.data.objects:
        if ob.animation_data is None:
            continue
        slot = next((s for s in act.slots if s.identifier == "OB" + ob.name), None)
        ob.animation_data.use_nla = False
        ob.animation_data.action = act if slot else None
        if slot:
            ob.animation_data.action_slot = slot
    return int(act.frame_range[0]), int(act.frame_range[1])


def lean(v):
    """Inclinación hacia delante (+) o atrás (-) de un vector en el plano sagital."""
    return math.degrees(math.atan2(-v.y, v.z))


def angle(a, b):
    return math.degrees(a.angle(b)) if a.length > 1e-6 and b.length > 1e-6 else 0.0


def main():
    cid = C.args()["id"]
    bpy.ops.wm.open_mainfile(filepath=C.blend_path(cid))
    rig = bpy.data.objects["Rig"]
    sc = bpy.context.scene
    out = {}
    for act in sorted(bpy.data.actions, key=lambda a: a.name):
        f0, f1 = assign(act.name)
        rows = []
        for fr in range(f0, f1 + 1, max(1, (f1 - f0) // 40)):
            sc.frame_set(fr)
            pb = rig.pose.bones
            h = lambda n: pb[n].head.copy()  # noqa: E731
            t = lambda n: pb[n].tail.copy()  # noqa: E731
            P, C7 = h("Hips"), h("Neck")
            head_c = h("Head") + (t("Head") - h("Head")) * 0.48
            trunk = C7 - P
            neckv = head_c - C7
            row = {"f": fr, "trunk": lean(trunk), "neck": lean(neckv) - lean(trunk), "head": lean(t("Head") - h("Head")) - lean(trunk)}
            for s in ("L", "R"):
                hip, knee, ank = h("UpLeg." + s), h("Leg." + s), h("Foot." + s)
                row["knee" + s] = 180 - angle(hip - knee, ank - knee)
                row["hip" + s] = angle(trunk, knee - hip)
                tt = (hip.z - knee.z) / max(1e-6, hip.z - ank.z)
                xm = hip.x + (ank.x - hip.x) * tt
                inward = (xm - knee.x) if s == "L" else (knee.x - xm)
                row["valgus" + s] = inward
                sh, el, wr = h("UpperArm." + s), h("ForeArm." + s), h("Hand." + s)
                row["elbow" + s] = 180 - angle(sh - el, wr - el)
                row["arm" + s] = angle(el - sh, -trunk)
                row["wristOff" + s] = [-(wr.y - sh.y), wr.x - sh.x, wr.z - sh.z]
            row["stance"] = abs(h("Foot.L").x - h("Foot.R").x)
            hl, hr = h("UpLeg.L"), h("UpLeg.R")
            hw = max(1e-6, (hl - hr).length)
            row["pelvisTilt"] = math.degrees(math.asin(max(-1, min(1, (hl.z - hr.z) / hw))))  # + = cadera izquierda más alta
            row["pelvisYaw"] = math.degrees(math.atan2(-(hl.y - hr.y), hl.x - hr.x))  # giro de la cadera sobre el eje vertical
            row["trunkLat"] = math.degrees(math.atan2(trunk.x, trunk.z))  # inclinación lateral del tronco (+ = hacia la izquierda)
            for s in ("L", "R"):
                row["kneeFwd" + s] = -(h("Leg." + s).y - h("Foot." + s).y)  # cuánto pasa la rodilla del tobillo hacia delante (m)
            bells = [bpy.data.objects[n] for n in ("Kettlebell", "Kettlebell2") if bpy.data.objects[n].scale.x > 0.01]
            if bells:
                bp = bells[0].matrix_world.translation
                row["bellZ"], row["bellY"] = bp.z - P.z, -(bp.y - P.y)
            row["hipsZ"] = P.z
            rows.append(row)
        out[act.name] = rows
    path = os.path.join(C.ROOT, "art", "personajes", f"audit_{cid}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f)
    print(f"[audit] {path} ({len(out)} clips)")


if __name__ == "__main__":
    main()
