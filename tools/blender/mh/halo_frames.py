"""Hoja de revisión del halo: una fila por vista (frente, tres cuartos, lado, espalda) y una columna por fotograma.

Uso:  blender --background --factory-startup --python tools/blender/mh/halo_frames.py -- --id bro --frames 0,30,45,48,51,60 [--clip halo] [--tw 220 --th 300]
Salida: art/previews/halo_<id>.png
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
    RP.TW, RP.TH = int(a.get("tw", 220)), int(a.get("th", 300))
    out_dir = os.path.join(C.ROOT, "art", "previews")
    tmp = os.path.join(out_dir, "_tile.png")
    frames = [int(x) for x in a["frames"].split(",")]
    sc, cam = RP.setup("#4fc9e8")
    f0, f1 = RP.assign(a.get("clip", "halo"))
    target, cam.data.ortho_scale = RP.clip_box(f0, f1)
    cam.data.ortho_scale *= float(a.get("zoom", 0.75))
    target = target.copy()
    target.z += float(a.get("up", 0.0))
    views = [RP.VIEWS[1][1], RP.VIEWS[2][1], RP.VIEWS[0][1], RP.VIEWS[3][1]]
    tiles = []
    for vd in views:
        for fr in frames:
            sc.frame_set(f0 + fr)
            RP.aim(cam, vd, target)
            tiles.append(RP.render_tile(sc, tmp))
    RP.save_sheet(tiles, len(frames), os.path.join(out_dir, f"halo_{cid}.png"))


if __name__ == "__main__":
    main()
