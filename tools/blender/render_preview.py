"""Hojas de contacto para revisar a ojo: por clip, 4 vistas (filas: lado, frente, 3/4, espalda) x N fotogramas.

Uso:
  blender --background --factory-startup --python tools/blender/render_preview.py -- --id bro [--clips a,b] [--frames 5] [--rest]

Salida: art/previews/<id>_<clip>.png (y <id>_rest.png con --rest). Render Workbench (luz de estudio, color del
material, contorno de objeto): no es el sombreado cómic del visor, sirve para juzgar forma, poses y rasgos.
El fondo de cada hoja rota por las tintas de las cartas para comprobar la lectura de la ropa.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402

VIEWS = [("lado", Vector((-1, 0, 0))), ("frente", Vector((0, -1, 0))), ("tres-cuartos", Vector((-1, -1, 0)).normalized()), ("espalda", Vector((0, 1, 0)))]
# --views atras: lado, 3/4 trasero y espalda (para revisar glúteos y entrepierna).
VIEWS_BACK = [("lado", Vector((-1, 0, 0))), ("tres-cuartos-espalda", Vector((-1, 1, 0)).normalized()), ("espalda", Vector((0, 1, 0)))]
TW, TH = 300, 400


def setup(bg_hex):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.render.resolution_x, sc.render.resolution_y = TW, TH
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "Standard"
    sh = sc.display.shading
    sh.light = "STUDIO"
    sh.color_type = "TEXTURE"
    sh.show_object_outline = True
    sh.object_outline_color = C.hex_linear("#11122a")
    sh.show_specular_highlight = False
    world = sc.world or bpy.data.worlds.new("Fondo")
    sc.world = world
    world.color = C.hex_linear(bg_hex)
    cam = bpy.data.objects.get("PreviewCam")
    if not cam:
        cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
        sc.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 2.35
    sc.camera = cam
    return sc, cam


def aim(cam, view_dir, target):
    cam.location = target + view_dir * 6.0
    cam.rotation_euler = (-view_dir).to_track_quat("-Z", "Y").to_euler()


def render_tile(sc, path):
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    a = np.empty(TW * TH * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    os.remove(path)
    return a.reshape(TH, TW, 4)


def save_sheet(tiles, cols, path):
    rows = (len(tiles) + cols - 1) // cols
    sheet = np.ones((rows * TH, cols * TW, 4), dtype=np.float32)
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        y0 = (rows - 1 - r) * TH  # las filas de Blender van de abajo arriba
        sheet[y0:y0 + TH, c * TW:(c + 1) * TW] = t
    img = bpy.data.images.new("sheet", cols * TW, rows * TH, alpha=True)
    img.pixels.foreach_set(sheet.ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    print(f"[preview] {path}")


def assign(clip):
    act = bpy.data.actions[clip]
    for ob in bpy.data.objects:
        if ob.animation_data is None:
            continue
        slot = next((s for s in act.slots if s.identifier == "OB" + ob.name), None)
        ob.animation_data.use_nla = False  # solo la acción activa (las pistas NLA son para el exportador)
        ob.animation_data.action = act if slot else None
        if slot:
            ob.animation_data.action_slot = slot
    return int(act.frame_range[0]), int(act.frame_range[1])


def clip_box(f0, f1):
    """Centro y escala ortográfica que abarcan el esqueleto y las pesas en todo el clip (suelo incluido)."""
    sc = bpy.context.scene
    rig = bpy.data.objects["Rig"]
    lo, hi = Vector((9, 9, 0)), Vector((-9, -9, 0))
    for fr in range(f0, f1 + 1, max(1, (f1 - f0) // 12)):
        sc.frame_set(fr)
        pts = [rig.matrix_world @ pb.head for pb in rig.pose.bones] + [rig.matrix_world @ pb.tail for pb in rig.pose.bones]
        pts += [bpy.data.objects[n].matrix_world.translation for n in ("Kettlebell", "Kettlebell2") if bpy.data.objects[n].scale.x > 0.01]
        for p in pts:
            lo = Vector((min(lo.x, p.x), min(lo.y, p.y), 0))
            hi = Vector((max(hi.x, p.x), max(hi.y, p.y), max(hi.z, p.z)))
    c = (lo + hi) / 2
    span = max(hi.z + 0.15, (max(hi.x - lo.x, hi.y - lo.y) + 0.5) / (TW / TH))
    return Vector((c.x, c.y, (hi.z + 0.1) / 2)), max(1.0, span * 1.08)


def main():
    a = C.args()
    cid = a["id"]
    bpy.ops.wm.open_mainfile(filepath=C.blend_path(cid))
    out_dir = os.path.join(C.ROOT, "art", "previews")
    os.makedirs(out_dir, exist_ok=True)
    tmp = os.path.join(out_dir, "_tile.png")
    inks = list(C.load_spec()["fondosDeCarta"].values())
    nfr = int(a.get("frames", 5))

    if "rest" in a:
        sc, cam = setup("#4fc9e8")
        for ob in bpy.data.objects:
            if ob.animation_data:
                ob.animation_data.use_nla = False
                ob.animation_data.action = None
        bpy.data.objects["Rig"].data.pose_position = "REST"
        for name in ("Kettlebell", "Kettlebell2"):
            bpy.data.objects[name].hide_render = True
        tiles = []
        for zoom, target in ((2.35, Vector((0, 0, 0.92))), (0.62, Vector((0, 0, 1.56)))):
            cam.data.ortho_scale = zoom
            for _, vd in VIEWS:
                aim(cam, vd, target)
                tiles.append(render_tile(sc, tmp))
        save_sheet(tiles, 4, os.path.join(out_dir, f"{cid}_rest.png"))
        return

    if "overview" in a:
        # Vista general de muchos clips: una fila por clip (lado al 0/25/50 %, 3/4 y frente al 50 %), 8 clips por hoja.
        global TW, TH
        TW, TH = 160, 210
        clips = a["clips"].split(",") if "clips" in a else sorted(act.name for act in bpy.data.actions)
        plan = [(VIEWS[0][1], 0.0), (VIEWS[0][1], 0.25), (VIEWS[0][1], 0.5), (VIEWS[2][1], 0.5), (VIEWS[1][1], 0.25)]
        for page in range(0, len(clips), 8):
            sc, cam = setup(inks[(page // 8) % len(inks)])
            tiles = []
            for clip in clips[page:page + 8]:
                f0, f1 = assign(clip)
                target, cam.data.ortho_scale = clip_box(f0, f1)
                for vd, ph in plan:
                    sc.frame_set(f0 + round((f1 - f0) * ph))
                    aim(cam, vd, target)
                    tiles.append(render_tile(sc, tmp))
            save_sheet(tiles, len(plan), os.path.join(out_dir, f"{cid}_overview{page // 8 + 1}.png"))
            print("[preview] filas:", ", ".join(clips[page:page + 8]))
        return

    # --zoom 1.0 --tz 1.2: detalle (escala ortográfica y altura del centro); se guarda con sufijo _zoom.
    zoom = float(a.get("zoom", 2.35))
    target = Vector((0, -0.12, float(a.get("tz", 0.92))))
    suffix = "_zoom" if "zoom" in a else ""
    clips = a["clips"].split(",") if "clips" in a else sorted(act.name for act in bpy.data.actions)
    for ci, clip in enumerate(clips):
        sc, cam = setup(inks[ci % len(inks)])
        cam.data.ortho_scale = zoom
        f0, f1 = assign(clip)
        if "zoom" not in a:
            target, cam.data.ortho_scale = clip_box(f0, f1)
        tiles = []
        frames = [f0 + round((f1 - f0) * k / nfr) for k in range(nfr)]
        for _, vd in (VIEWS_BACK if a.get("views") == "atras" else VIEWS):
            for fr in frames:
                sc.frame_set(fr)
                aim(cam, vd, target)
                tiles.append(render_tile(sc, tmp))
        save_sheet(tiles, nfr, os.path.join(out_dir, f"{cid}_{clip}{suffix}.png"))


if __name__ == "__main__":
    main()
