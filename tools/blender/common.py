"""Módulo común de los scripts de personajes (se ejecuta dentro de Blender 5.2).

Convenciones (contrato §2): metros, el personaje mira a -Y en Blender (= +Z en glTF), +X = su izquierda,
Z arriba, origen entre los pies. Un solo Armature "Rig".
"""
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
SPEC_PATH = os.path.join(HERE, "spec", "characters.json")
POSES_PATH = os.path.join(ROOT, "art", "personajes", "poses2d.json")
FPS = 30

# Huesos del contrato (§3), en orden padre -> hijo.
BONES = [
    ("Hips", None),
    ("Spine", "Hips"),
    ("Chest", "Spine"),
    ("Neck", "Chest"),
    ("Head", "Neck"),
    ("Shoulder.L", "Chest"),
    ("UpperArm.L", "Shoulder.L"),
    ("ForeArm.L", "UpperArm.L"),
    ("Hand.L", "ForeArm.L"),
    ("Shoulder.R", "Chest"),
    ("UpperArm.R", "Shoulder.R"),
    ("ForeArm.R", "UpperArm.R"),
    ("Hand.R", "ForeArm.R"),
    ("UpLeg.L", "Hips"),
    ("Leg.L", "UpLeg.L"),
    ("Foot.L", "Leg.L"),
    ("Toe.L", "Foot.L"),
    ("UpLeg.R", "Hips"),
    ("Leg.R", "UpLeg.R"),
    ("Foot.R", "Leg.R"),
    ("Toe.R", "Foot.R"),
]
TAIL_BONES = [("Tail.1", "Head"), ("Tail.2", "Tail.1"), ("Tail.3", "Tail.2")]  # coleta (contrato §3, opcionales)
PARENT = dict(BONES + TAIL_BONES)


def bones_for(spec):
    """Huesos del personaje: los 21 del contrato + la coleta si tiene pelo recogido."""
    return BONES + (TAIL_BONES if "pelo" in spec.get("features", {}) else [])
MATERIALS = ["skin", "tattoo", "top", "bottoms", "shoes", "hair", "beard", "earrings", "eyes", "mouth"]
BELL_MATERIALS = ["bell", "bellHandle"]
SIDES = {"L": 1.0, "R": -1.0}  # signo de X de cada lado


def args():
    """Argumentos tras '--' en la línea de Blender: --id bro, --clips a,b, --out ruta."""
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = {}
    for i, a in enumerate(argv):
        if a.startswith("--"):
            nxt = argv[i + 1] if i + 1 < len(argv) else None
            out[a[2:]] = nxt if nxt is not None and not nxt.startswith("--") else "1"
    out.setdefault("id", "bro")
    return out


FIT_PATH = os.path.join(HERE, "spec", "mh_fit.json")


def load_spec():
    """characters.json + las medidas ajustadas de los personajes de MakeHuman (mh_fit.json, escrito por mh/build_mh.py)."""
    with open(SPEC_PATH, encoding="utf-8") as f:
        spec = json.load(f)
    if os.path.exists(FIT_PATH):
        with open(FIT_PATH, encoding="utf-8") as f:
            for cid, fit in json.load(f).items():
                if not cid.startswith("_"):
                    spec["characters"][cid].update(fit)
                    spec["characters"][cid].pop("features", None)  # sin coleta ni rasgos pintados: la malla es de MakeHuman
    return spec


def blend_path(char_id):
    return os.path.join(ROOT, "art", "personajes", f"{char_id}.blend")


def glb_path(char_id):
    return os.path.join(ROOT, "public", "models", f"{char_id}.glb")


# ───────────────────────── Color ─────────────────────────

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def hex_linear(h):
    return tuple(srgb_to_linear(c) for c in hex_rgb(h))


def luminance(h):
    r, g, b = (srgb_to_linear(c) for c in hex_rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def make_material(name, hex_color):
    """Material de color liso (el visor lo sustituye por sombreado cómic según el nombre)."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    rgb = hex_linear(hex_color)
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    mat.diffuse_color = (*rgb, 1.0)  # vista sólida / Workbench
    return mat


# ───────────────────────── Escena ─────────────────────────

def save(path):
    bpy.context.preferences.filepaths.save_version = 0  # sin copias .blend1
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.unit_settings.system = "METRIC"
    return sc


# ───────────────────────── Geometría ─────────────────────────

def frame3(y, xhint):
    """Base ortonormal con Y = y y X lo más parecido a xhint (Z = X × Y). Columnas X, Y, Z."""
    y = Vector(y).normalized()
    x = Vector(xhint) - y * Vector(xhint).dot(y)
    if x.length < 1e-6:
        alt = Vector((0, 0, 1)) if abs(y.z) < 0.9 else Vector((1, 0, 0))
        x = alt - y * alt.dot(y)
    x.normalize()
    z = x.cross(y)
    return Matrix((x, y, z)).transposed()


def mat4(rot3, pos):
    m = rot3.to_4x4()
    m.translation = Vector(pos)
    return m


def perp(v, axis):
    """Componente de v perpendicular a axis."""
    a = Vector(axis).normalized()
    return Vector(v) - a * Vector(v).dot(a)


def ik2(a, b, l1, l2, pole):
    """IK analítico de dos huesos: posición de la articulación intermedia (rodilla / codo).

    a = raíz, b = objetivo, pole = dirección hacia la que se dobla la articulación. Si el objetivo
    queda fuera de alcance, la cadena se estira recta hacia él.
    """
    a, b = Vector(a), Vector(b)
    ab = b - a
    d = ab.length
    u = ab.normalized() if d > 1e-9 else Vector((0, 0, -1))
    p = perp(pole, u)
    if p.length < 1e-9:
        p = perp(Vector((0, 1, 0)) if abs(u.y) < 0.9 else Vector((1, 0, 0)), u)
    p.normalize()
    if d >= l1 + l2 - 1e-6:
        return a + u * l1
    d = max(d, abs(l1 - l2) + 1e-4)
    x = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(0.0, l1 * l1 - x * x))
    return a + u * x + p * h


def limb_normal(root, mid, end, fallback, eps=0.02):
    """Normal del plano de flexión de una extremidad (eje de bisagra de rodilla / codo).

    Se usa igual en reposo y en cada fotograma, así el eje X de los huesos significa lo mismo siempre.
    `fallback` decide el plano cuando la extremidad está recta (p. ej. la puntera del pie para la rodilla).
    """
    axis = Vector(end) - Vector(root)
    p = perp(Vector(mid) - Vector(root), axis)
    fb = perp(fallback, axis)
    if fb.length > 1e-9:
        p = p + fb.normalized() * eps
    n = p.cross(axis)
    return n.normalized() if n.length > 1e-12 else Vector((1, 0, 0))


def smoothstep(e0, e1, x):
    if e1 == e0:
        return 1.0 if x >= e1 else 0.0
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ───────────────────────── Lienzo 2D -> Blender ─────────────────────────

class Canvas:
    """Pasa puntos de rig.ts (x adelante, y ABAJO, z lado derecho; unidades del lienzo) a Blender."""

    def __init__(self, scale, x0, ground_y=170.0, drop=0.0, yaw=0.0):
        self.s = scale
        self.x0 = x0
        self.g = ground_y
        self.drop = drop  # metros que baja el cuerpo (no los pies)
        self.yaw = yaw    # giro de todo el personaje alrededor de la vertical (grados, + = hacia su izquierda)
        self.rot = Matrix.Rotation(math.radians(yaw), 3, "Z")

    def foot(self, q):
        return self.rot @ Vector((-q[2] * self.s, -(q[0] - self.x0) * self.s, (self.g - q[1]) * self.s))

    def p(self, q):
        return self.foot(q) - Vector((0, 0, self.drop))

    def d(self, q):
        return self.rot @ Vector((-q[2], -q[0], -q[1])).normalized()
