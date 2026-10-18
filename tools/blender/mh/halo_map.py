"""Mapa de dónde puede estar la mano izquierda sin que el brazo atraviese el cuerpo (herramienta de diagnóstico del halo).

Uso:  blender --background --python tools/blender/mh/halo_map.py -- --id bro

Para cada posición de la mano (x lateral, adelante, altura; relativas al centro de la cabeza) imprime la mejor holgura (mm) entre 36 codos
posibles. Lado derecho (x<0 = hacia el lado derecho del personaje) = cruzar el cuerpo.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import common as C  # noqa: E402
import halo_fit as H  # noqa: E402
from mathutils import Vector  # noqa: E402


def main():
    a = C.args()
    cid = a["id"]
    bpy.ops.wm.open_mainfile(filepath=C.blend_path(cid))
    spec_all = C.load_spec()
    sk = spec_all["characters"][cid]["skeleton"]
    L1, L2 = sk["upperArm"], sk["foreArm"] + sk["wristToGrip"]
    rig = bpy.data.objects["Rig"]
    rig.data.pose_position = "REST"
    bpy.context.view_layer.update()
    env = H.build_env(sk)
    W, B = rig.matrix_world, rig.data.bones
    j = W @ B["UpperArm.L"].head_local
    hb = B["Head"]
    hc = W @ (hb.head_local + (hb.tail_local - hb.head_local) * 0.48)
    print(f"[mapa] hombro izq. rel. cabeza: x={j.x - hc.x:+.3f} adelante={-(j.y - hc.y):+.3f} z={j.z - hc.z:+.3f}; alcance {L1 + L2:.3f}")
    xs = [-0.30 + 0.04 * i for i in range(15)]  # -0.30 (derecha) .. +0.26 (izquierda)
    fw = [0.08 - 0.04 * i for i in range(10)]  # adelante 0.08 .. -0.28 (negativo = detrás)
    print("[mapa] columnas x(cm) =", " ".join(f"{int(round(x * 100)):+4d}" for x in xs))
    for dz in (-0.16, -0.12, -0.08, -0.04, 0.0, 0.04, 0.08):
        print(f"[mapa] mano a z={dz * 100:+.0f} cm de la cabeza (filas = adelante en cm; mm de holgura, ## = fuera de alcance)")
        for f in fw:
            row = []
            for x in xs:
                g = Vector((hc.x + x, hc.y - f, hc.z + dz))
                if (g - j).length > 0.985 * (L1 + L2):
                    row.append("  ##")
                    continue
                best = max(H.arm_clearance(env, j, g, pole, L1, L2, g + Vector((0, 0, 0.3))) for pole in H.basis_poles(j, g, 24))
                row.append(f"{int(round(max(-99, min(99, best * 1000)))):+4d}")
            print(f"[mapa] {int(round(f * 100)):3d} |", " ".join(row))
        sys.stdout.flush()


if __name__ == "__main__":
    main()
