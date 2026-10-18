"""Hoja de revisión de postura: por clip, el perfil en 6 instantes y el frente en 3. Para comparar con la técnica de referencia.

Uso:  blender --background --factory-startup --python tools/blender/mh/preview_poses.py -- --id bro --clips two-hand-swing,goblet-squat [--tw 240 --th 320]
Salida: art/previews/pose_<id>_<clip>.png
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import bpy  # noqa: E402

import common as C  # noqa: E402
import render_preview as RP  # noqa: E402


def main():
    a = C.args()
    cid = a["id"]
    bpy.ops.wm.open_mainfile(filepath=C.blend_path(cid))
    RP.TW, RP.TH = int(a.get("tw", 240)), int(a.get("th", 320))
    out_dir = os.path.join(C.ROOT, "art", "previews")
    tmp = os.path.join(out_dir, "_tile.png")
    clips = a["clips"].split(",")
    side, front = RP.VIEWS[0][1], RP.VIEWS[1][1]
    plan = [(side, k / 6) for k in range(6)] + [(front, 0.0), (front, 0.25), (front, 0.5)]
    for ci, clip in enumerate(clips):
        sc, cam = RP.setup("#4fc9e8")
        f0, f1 = RP.assign(clip)
        target, cam.data.ortho_scale = RP.clip_box(f0, f1)
        tiles = []
        for vd, ph in plan:
            sc.frame_set(f0 + round((f1 - f0) * ph))
            RP.aim(cam, vd, target)
            tiles.append(RP.render_tile(sc, tmp))
        RP.save_sheet(tiles, 9, os.path.join(out_dir, f"pose_{cid}_{clip}.png"))


if __name__ == "__main__":
    main()
