"""Ajusta el halo 3D de un personaje para que NADA atraviese el cuerpo.

Uso:  blender --background --python tools/blender/mh/halo_fit.py -- --id bro [--n 400]

Qué hace: toma la malla real del personaje en reposo (cuerpo y ropa: solo las caras de tronco, cuello, cabeza y cintura escapular, con
distancia con signo; el pelo, como puntos) y calcula dos cosas con sus holguras reales:
  1. La órbita (animate.halo_pose): el cuerpo de la pesa da la vuelta a la cabeza y las manos, que cuelgan de él, quedan fuera de la
     malla. Se busca por recocido simulado la órbita más pequeña y natural que lo cumpla y deje a cada brazo al menos una postura de
     codo sin choque en todos los instantes.
  2. El codo de cada brazo en cada instante: entre 36 direcciones del codo alrededor del eje hombro-mano se elige, por programación
     dinámica, la sucesión de mayor holgura y giro más suave (la mano lejana pasa por delante de la barbilla, la cercana va al lado).
Escribe el resultado en spec/mh_fit.json (clave "halo", con "poles") y lo imprime con la peor holgura de cada pieza.
"""
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

import animate as A  # noqa: E402
import common as C  # noqa: E402

CORE = {"Hips", "Spine", "Chest", "Neck", "Head"}
SHOULDER = {"Shoulder.L", "Shoulder.R"}
STEPS = 180  # = fotogramas del clip del halo (181, el último repite el primero): cada fotograma tiene su propio codo, sin interpolar
NPOLE = 36
R_BALL = 0.095 + 0.006  # radio de la pesa + margen de 6 mm
R_FIST = 0.048  # puño: a la altura del agarre
R_UPPER = (0.045, 0.040)  # radio del brazo, del hombro al codo
R_FORE = (0.042, 0.031)  # radio del antebrazo: grueso junto al codo, fino en la muñeca (t = 0.75); después va la mano
HANDS_APART = 0.045  # bell.handsApart de characters.json
MARGIN = 0.003  # holgura mínima exigida (m)
SIGN_RANGE = 0.07  # más lejos de la superficie que esto, un punto se da por fuera
FLARE = 0.15  # cuánto puede sobresalir el codo hacia fuera del hombro sin penalizar (m)
PRIOR = {  # intervalo de cada parámetro de la órbita
    "as": (0.19, 0.30), "ad": (0.19, 0.30), "cy": (-0.06, 0.10), "z0": (-0.03, 0.08), "z1": (0.0, 0.10), "pw": (0.6, 2.2),
    "ti": (-1.0, 0.4), "ti2": (-0.8, 0.8), "tf": (-1.0, 1.0), "tf2": (-0.8, 0.8), "alpha": (0.0, 85.0),
}
SEED = {"as": 0.21, "ad": 0.24, "cy": 0.0, "z0": 0.07, "z1": 0.0, "pw": 1.0, "ti": -0.1, "ti2": 0.0, "tf": -0.5, "tf2": 0.5, "alpha": 85.0}  # a mano: manos algo detrás de la pesa a los lados
F, RT, UP = Vector((0, -1, 0)), Vector((-1, 0, 0)), Vector((0, 0, 1))


class Env:
    """Obstáculos: superficie del tronco/cuello/cabeza (distancia con signo) y vértices del pelo (distancia sin signo)."""

    def __init__(self, tree, hair):
        self.tree, self.hair = tree, hair

    def point(self, p, rad):
        """Holgura de una esfera de radio rad centrada en p."""
        q = Vector(p)
        loc, nor, _, d = self.tree.find_nearest(q)
        # El signo solo es fiable cerca de la superficie (la malla está abierta en las axilas): lejos de ella el punto está fuera.
        s = 9.0 if loc is None else (d if d > SIGN_RANGE or (q - loc).dot(nor) >= 0 else -d)
        if self.hair is not None:
            s = min(s, float(np.linalg.norm(self.hair - np.array(q), axis=1).min()))
        return s - rad

    def tube(self, a, b, radii, n, wrist=1.0):
        """Holgura de un tubo entre a y b: radio de radii[0] a radii[1] en t = wrist y de ahí al puño."""
        worst = 9.0
        for i in range(n + 1):
            t = i / n
            r = radii[0] + (radii[1] - radii[0]) * min(t / wrist, 1.0) if t <= wrist else radii[1] + (R_FIST - radii[1]) * ((t - wrist) / max(1e-6, 1 - wrist))
            worst = min(worst, self.point(a + (b - a) * t, r))
        return worst


def basis_poles(j, g, n):
    """n direcciones de codo perpendiculares al eje hombro-mano."""
    u = (g - j).normalized()
    e1 = C.perp(Vector((0, 0, 1)) if abs(u.z) < 0.9 else Vector((1, 0, 0)), u).normalized()
    e2 = u.cross(e1)
    return [e1 * math.cos(2 * math.pi * k / n) + e2 * math.sin(2 * math.pi * k / n) for k in range(n)]


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.dot(ab), 1e-12)))
    return (p - (a + ab * t)).length


def arm_clearance(env, j, g, pole, L1, L2, pb, detail=None, side="", k=0):
    """Holgura de un brazo con su codo (brazo y antebrazo contra el cuerpo y contra la pesa)."""
    e = C.ik2(j, g, L1, L2, pole)
    sh = j + (e - j) * 0.45  # el arranque del brazo está dentro del hombro por construcción
    vals = {
        "brazo-cuerpo": env.tube(sh, e, R_UPPER, 5),
        "antebrazo-cuerpo": env.tube(e, g, R_FORE, 8, 0.75),
        "antebrazo-pesa": seg_dist(pb, e, g) - R_FORE[0] - R_BALL,
        "brazo-pesa": seg_dist(pb, sh, e) - R_UPPER[0] - R_BALL,
    }
    if detail is not None:
        for name, v in vals.items():
            key = f"{name} {side}"
            detail[key] = min(detail.get(key, (9.0, 0)), (v, k))
    return min(vals.values())


def geometry(env, p, J, P0, L1, L2, hc, hang, steps):
    """Holgura de la pesa y los puños, error de alcance y lista de (lado, k, hombro, mano, pesa) por fotograma (sin codos)."""
    worst, reach = 9.0, 0.0
    frames = []
    for k in range(steps):
        h = A.halo_pose(p, k / steps, hc, F, RT, UP, hang, apart=HANDS_APART)
        worst = min(worst, env.point(h["pb"], R_BALL))
        for side in ("R", "L"):
            hand = h["hand"][side]
            worst = min(worst, env.point(hand, R_FIST))
            j = A.shoulder_reach(P0[side], J[side], hand, hc, Vector((1, 0, 0)) if side == "L" else Vector((-1, 0, 0)), F)  # el solver gira la clavícula y el tronco hacia la mano
            reach = max(reach, (hand - j).length - 0.985 * (L1 + L2))
            frames.append((side, k, j, hand, h["pb"]))
    return worst, reach, frames


def val(c):
    """Valor de una holgura de codo: satura la ventaja de sobrar y castiga fuerte el choque."""
    return 100.0 * min(c, 0.02) if c >= 0 else 600.0 * c


def solve_poles(env, fr, L1, L2, npole, wang=8.0, nstart=6, amax=1.0):
    """Sucesión de codos de un brazo a lo largo del ciclo (programación dinámica): mayor holgura y giro suave del codo entre fotogramas
    (wang pesa el giro; el codo nunca gira más de amax rad entre fotogramas: al interpolar dos codos casi opuestos la mezcla pasaría por el cuerpo).
    fr = fotogramas de ese lado en orden. Devuelve [(holgura, dirección del codo)] por fotograma."""
    n = len(fr)
    cand = [[(arm_clearance(env, j, g, pole, L1, L2, pb), pole) for pole in basis_poles(j, g, npole)] for _, k, j, g, pb in fr]
    # Coste de postura: el codo no se abre más de FLARE hacia fuera del hombro (nada de alas de pollo)
    side_sign = 1.0 if fr[0][0] == "L" else -1.0
    flare = [[max(0.0, side_sign * (C.ik2(j, g, L1, L2, pole).x - j.x) - FLARE) for _, pole in cand[f]] for f, (_, k, j, g, pb) in enumerate(fr)]
    ang = [[[cand[f - 1][m][1].angle(cand[f][i][1]) for m in range(npole)] for i in range(npole)] for f in range(1, n)]
    big = 1e6  # coste de un giro prohibido
    best_path, best_total = None, -1e18
    for start in range(0, npole, max(1, npole // nstart)):  # el ciclo se cierra: el último codo debe parecerse al primero
        score_t = [val(cand[0][i][0]) - 300.0 * flare[0][i] if i == start else -1e18 for i in range(npole)]
        back = []
        for f in range(1, n):
            new, bp = [], []
            for i in range(npole):
                prev = [score_t[m] - wang * ang[f - 1][i][m] ** 2 - (big if ang[f - 1][i][m] > amax else 0.0) for m in range(npole)]
                m = max(range(npole), key=prev.__getitem__)
                new.append(prev[m] + val(cand[f][i][0]) - 300.0 * flare[f][i])
                bp.append(m)
            score_t = new
            back.append(bp)
        closing = [score_t[i] - wang * cand[0][start][1].angle(cand[-1][i][1]) ** 2 - (big if cand[0][start][1].angle(cand[-1][i][1]) > amax else 0.0) for i in range(npole)]
        i = max(range(npole), key=closing.__getitem__)
        if closing[i] > best_total:
            path = [i]
            for bp in reversed(back):
                path.append(bp[path[-1]])
            path.reverse()
            best_total, best_path = closing[i], path
    exist = min(max(c for c, _ in row) for row in cand)  # peor fotograma con su mejor codo (sin exigir continuidad)
    return [cand[f][idx] for f, idx in enumerate(best_path)], exist


def cost(p):
    """Más pequeña = órbita más cerrada y natural."""
    return 1.5 * (p["as"] + p["ad"]) + 2.0 * p["z1"] + 0.05 * (abs(p["ti"]) + abs(p["tf"]) + abs(p["ti2"]) + abs(p["tf2"])) + 0.06 * p["alpha"] / 85.0 + 0.6 * abs(p["cy"])


def build_env(sk, quiet=False):
    """Superficie de tronco/cuello/cabeza/hombros (Body + ropa) y vértices del pelo, en reposo y en el mundo."""
    dg = bpy.context.evaluated_depsgraph_get()
    verts, polys, hair = [], [], []
    for name in ("Body", "Clothes0", "Hair"):
        ob = bpy.data.objects.get(name)
        if not ob:
            continue
        gname = {g.index: g.name for g in ob.vertex_groups}
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        keep = set()
        for src, vv in zip(ob.data.vertices, me.vertices):
            wc = sum(g.weight for g in src.groups if gname.get(g.group) in CORE)
            ws = sum(g.weight for g in src.groups if gname.get(g.group) in SHOULDER)
            if wc + ws > 0.5 and (mw @ vv.co).z > sk["hipZ"] + 0.1:
                keep.add(vv.index)
        if name == "Hair":
            hair += [tuple(mw @ me.vertices[i].co) for i in keep]
        else:
            base = len(verts)
            verts += [tuple(mw @ v.co) for v in me.vertices]
            polys += [tuple(base + i for i in p.vertices) for p in me.polygons if all(i in keep for i in p.vertices)]
        ev.to_mesh_clear()
    if not quiet:
        print(f"[halo] obstáculos: {len(polys)} caras de cuerpo y ropa + {len(hair)} vértices de pelo")
    return Env(BVHTree.FromPolygons(verts, polys), np.array(hair, dtype=np.float64) if hair else None)


def main():
    a = C.args()
    cid = a["id"]
    n = int(a.get("n", 400))
    bpy.ops.wm.open_mainfile(filepath=C.blend_path(cid))
    spec_all = C.load_spec()
    sk = spec_all["characters"][cid]["skeleton"]
    hang = spec_all["bell"]["hang"]
    L1, L2 = sk["upperArm"], sk["foreArm"] + sk["wristToGrip"]

    rig = bpy.data.objects["Rig"]
    for ob in bpy.data.objects:
        if ob.animation_data:
            ob.animation_data.use_nla = False
            ob.animation_data.action = None
    rig.data.pose_position = "REST"
    bpy.context.view_layer.update()

    env = build_env(sk)
    W, B = rig.matrix_world, rig.data.bones
    J = {s: W @ B["UpperArm." + s].head_local for s in ("R", "L")}
    P0 = {s: W @ B["Shoulder." + s].head_local for s in ("R", "L")}  # origen de la clavícula
    hb = B["Head"]
    hc = W @ (hb.head_local + (hb.tail_local - hb.head_local) * 0.48)
    rnd = random.Random(11)

    def score(p, steps=24, npole=18, sides=("L",)):
        # La órbita es simétrica: basta el brazo izquierdo para ajustarla (el derecho es su espejo medio ciclo después).
        gw, reach, frames = geometry(env, p, J, P0, L1, L2, hc, hang, steps)
        arm = exist = -0.08
        if gw > -0.03 and reach <= 0:
            res = [solve_poles(env, [f for f in frames if f[0] == s], L1, L2, npole, nstart=3, amax=1.0 * 48 / steps) for s in sides]  # (en la búsqueda; el ajuste final deja saltos mayores)
            arm = min(min(c for c, _ in path) for path, _ in res)
            exist = min(e for _, e in res)
        # La existencia de un codo libre en cada instante suaviza la búsqueda; la continuidad del codo (arm) es la exigencia final.
        short = max(0.0, MARGIN - gw) ** 2 + max(0.0, MARGIN - exist) ** 2 + 0.5 * max(0.0, MARGIN - arm) ** 2
        return cost(p) + 3000.0 * short + 60.0 * max(0.0, reach), gw, arm

    if "p" in C.args():  # órbita dada a mano: solo se ajustan los codos
        best = json.loads(C.args()["p"])
        best_sc = 0.0
    else:
        starts = [(score(SEED)[0], dict(SEED))]
        for _ in range(max(80, n // 2)):
            p = {k: rnd.uniform(*v) for k, v in PRIOR.items()}
            starts.append((score(p)[0], p))
        starts.sort(key=lambda x: x[0])
        print(f"[halo] mejor muestreo: objetivo {starts[0][0]:.3f}")
        best, best_sc = None, 1e9
        seed = next(s for s in starts if s[1] is not None and s[1] == SEED)  # la órbita hecha a mano parte siempre
        for sc0, p0 in [seed] + [s for s in starts if s is not seed][:2]:
            cur, cur_sc, temp = dict(p0), sc0, 0.05
            for it in range(max(60, n // 3)):
                q = {k: min(PRIOR[k][1], max(PRIOR[k][0], v + rnd.gauss(0, 0.07 * (PRIOR[k][1] - PRIOR[k][0])))) for k, v in cur.items()}
                q_sc = score(q)[0]
                if q_sc < cur_sc or rnd.random() < math.exp((cur_sc - q_sc) / max(temp, 1e-6)):
                    cur, cur_sc = q, q_sc
                    if cur_sc < best_sc:
                        best, best_sc = dict(cur), cur_sc
                temp *= 0.985
            print(f"[halo]   arranque {sc0:.3f} -> mejor hasta ahora {best_sc:.3f}", flush=True)
    best = {k: round(v, 4) for k, v in best.items()}
    sc, gw, arm = score(best, STEPS, 24, ("L", "R"))  # (con la sucesión de codos suave)
    print(f"[halo] órbita elegida (objetivo {best_sc:.3f}): {json.dumps(best)}")
    print(f"[halo] comprobación fina de la órbita: pesa y puños {gw * 1000:.1f} mm, peor brazo {arm * 1000:.1f} mm", flush=True)

    # Codos: programación dinámica sobre NPOLE direcciones por fotograma, completa (48 pasos)
    gw, reach, frames = geometry(env, best, J, P0, L1, L2, hc, hang, STEPS)
    print(f"[halo] pesa y puños: holgura {gw * 1000:.1f} mm, error de alcance {reach * 1000:.1f} mm")
    poles = {"R": [], "L": []}
    detail = {}

    for side in ("R", "L"):
        fr = [f for f in frames if f[0] == side]
        path, _ = solve_poles(env, fr, L1, L2, NPOLE, wang=3.0, nstart=9, amax=1.05)
        for (_, k, j, g, pb), (_, pole) in zip(fr, path):
            arm_clearance(env, j, g, pole, L1, L2, pb, detail=detail, side=side, k=k)
            poles[side].append([round(x, 4) for x in pole])
    worst = min(v for v, _ in detail.values())
    print(f"[halo] holgura final de los brazos: {worst * 1000:.1f} mm")
    for name, (v, k) in sorted(detail.items(), key=lambda kv: kv[1][0]):
        print(f"[halo]   {name}: {v * 1000:.1f} mm (fase {k / STEPS:.2f})")
    best["poles"] = poles
    with open(C.FIT_PATH, encoding="utf-8") as fh:
        fit = json.load(fh)
    fit[cid]["halo"] = best
    with open(C.FIT_PATH, "w", encoding="utf-8") as fh:
        json.dump(fit, fh, indent=2)
    print(f"[halo] guardado en {C.FIT_PATH}")


if __name__ == "__main__":
    main()
