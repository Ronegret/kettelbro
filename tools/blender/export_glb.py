"""Exporta art/personajes/<id>.blend a public/models/<id>.glb (contrato §2, §5, §6).

Uso:
  blender --background --factory-startup --python tools/blender/export_glb.py -- --id bro

glTF binario, Y arriba, un clip por Action (nombre = ExerciseId o "idle"), muestreo a 30 fps con optimización
de tamaño, solo huesos que deforman, 4 influencias por vértice, sin UV (colores lisos), sin cámaras ni luces.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import common as C  # noqa: E402


def main():
    cid = C.args()["id"]
    bpy.ops.wm.open_mainfile(filepath=C.blend_path(cid))
    sc = bpy.context.scene
    sc.render.fps = C.FPS
    for ob in list(bpy.data.objects):
        if ob.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(ob)
    for ob in bpy.data.objects:
        if ob.animation_data:
            ob.animation_data.action = None  # cada clip sale de su pista NLA
            ob.animation_data.use_nla = True
    out = C.glb_path(cid)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    realistic = C.load_spec()["characters"][cid].get("source") == "mpfb"  # persona de MakeHuman: con texturas (WebP)
    extra = {"export_image_format": "WEBP", "export_image_webp_fallback": False, "export_image_quality": 82} if realistic else {}
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_texcoords=realistic,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_skins=True,
        export_def_bones=True,
        export_influence_nb=4,
        export_morph=False,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_merge_animation="ACTION",
        export_frame_step=1,
        export_force_sampling=False,  # se exportan las claves reducidas de animate.py (interpolación lineal)
        export_optimize_animation_size=True,
        export_optimize_animation_keep_anim_armature=False,  # sin canales constantes de huesos (ahorra ~40 % del JSON)
        export_optimize_animation_keep_anim_object=True,  # las pesas conservan sus 3 canales en cada clip
        export_anim_single_armature=True,
        export_reset_pose_bones=True,
        export_rest_position_armature=True,
        export_anim_slide_to_zero=True,
        **extra,
    )
    print(f"[export] {out} ({os.path.getsize(out) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
