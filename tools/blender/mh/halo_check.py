"""Comprueba, con el esqueleto y la malla YA animados, que en el clip del halo nada atraviesa la cabeza, el cuello ni el tronco.

Uso:  blender --background --python tools/blender/mh/halo_check.py -- --id bro [--clip halo] [--step 2]
Por fotograma mide (mm, positivo = hay aire) la pesa, los puños y los tubos del brazo y el antebrazo contra la superficie posada del
cuerpo y la ropa, y el pelo. Es la prueba final de mh/halo_fit.py, que ajusta en reposo.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import common as C  # noqa: E402
import halo_fit as H  # noqa: E402
import render_preview as RP  # noqa: E402
from mathutils import Vector  # noqa: E402


def main():
    a = C.args()
    cid = a["id"]
    clip = a.get("clip", "halo")
    step = int(a.get("step", 2))
    bpy.ops.wm.open_mainfile(filepath=C.blend_path(cid))
    spec_all = C.load_spec()
    sk = spec_all["characters"][cid]["skeleton"]
    hang = spec_all["bell"]["hang"]
    sc, _ = RP.setup("#4fc9e8")
    f0, f1 = RP.assign(clip)
    rig = bpy.data.objects["Rig"]
    bell = bpy.data.objects["Kettlebell"]
    W = rig.matrix_world
    worst = {}
    rows = []
    for f in range(f0, f1 + 1, step):
        sc.frame_set(f)
        bpy.context.view_layer.update()
        env = H.build_env(sk, quiet=True)
        vals = {}
        ball = bell.matrix_world @ Vector((0, 0, -hang))
        vals["pesa"] = env.point(ball, H.R_BALL - 0.006)
        for s in ("R", "L"):
            pb = rig.pose.bones
            j = W @ pb["UpperArm." + s].head
            e = W @ pb["ForeArm." + s].head
            wr = W @ pb["Hand." + s].head
            g = wr + (W @ pb["Hand." + s].tail - wr).normalized() * sk["wristToGrip"]
            vals["puño " + s] = env.point(g, H.R_FIST)
            vals["brazo " + s] = env.tube(j + (e - j) * 0.45, e, H.R_UPPER, 5)
            vals["antebrazo " + s] = env.tube(e, g, H.R_FORE, 8, 0.75)
        for k, v in vals.items():
            if k not in worst or v < worst[k][0]:
                worst[k] = (v, f)
        rows.append((f, min(vals.values())))
    print(f"[check] {cid}/{clip}: fotogramas {f0}-{f1}")
    for k, (v, f) in sorted(worst.items(), key=lambda kv: kv[1][0]):
        print(f"[check]   {k:14s} {v * 1000:+6.1f} mm (fotograma {f}, fase {(f - f0) / max(1, f1 - f0):.2f})")
    bad = [(f, v) for f, v in rows if v < -0.008]
    print(f"[check] fotogramas con más de 8 mm de choque: {len(bad)} de {len(rows)}" + (f" -> {[(f, round(v * 1000)) for f, v in bad]}" if bad else ""))


if __name__ == "__main__":
    main()
