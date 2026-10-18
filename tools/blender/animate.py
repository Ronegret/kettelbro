"""Crea los clips (una Action por ejercicio, con slots para Rig, Kettlebell y Kettlebell2) a partir de las poses 2D.

Uso:
  node scripts/export-poses2d.mjs            # genera art/personajes/poses2d.json
  blender --background --factory-startup --python tools/blender/animate.py -- --id bro [--clips idle,two-hand-swing]

Por fotograma: la pelvis, el tronco, la cabeza y los pies salen de rig.ts (pasados a metros); rodillas y codos
se resuelven con IK analítico de dos huesos (common.ik2) y se escriben como claves FK (cuaterniones). Los brazos
se reorientan por DIRECCIÓN (la 2D tiene brazos ~10 cm más cortos): así los brazos rectos siguen rectos.
Las pesas se hornean siguiendo a las manos. Pies plantados: el tobillo es el de la 2D en cada fotograma.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import common as C  # noqa: E402


# Clips revisados a ojo (los que genera el build por defecto). Con --clips all se generan los 30.
READY = ["idle", "kettlebell-deadlift", "two-hand-swing", "goblet-squat",
         # tanda A (2026-10-16)
         "one-arm-swing", "single-leg-rdl", "hip-bridge", "prying-goblet-squat", "front-squat", "reverse-lunge-racked",
         "strict-press", "push-press", "floor-press", "half-kneeling-press", "one-arm-row", "high-pull", "clean", "snatch",
         "clean-and-press", "bottom-up-press",
         # tanda B (2026-10-16)
         "turkish-get-up", "windmill", "arm-bar", "halo", "figure-8",
         "suitcase-carry", "rack-carry", "farmer-carry", "bottom-up-carry", "waiter-carry"]

# Ajustes 3D por clip cuando la posición 2D no vale tal cual para el cuerpo 3D (corrección técnica).
# hands="chest": manos (agarre de los cuernos) fijas en el marco del pecho: fwd/down en metros desde el
# punto medio de los hombros; elbows = hacia dónde apunta el codo en el marco del pecho (abajo, delante, fuera):
# en el goblet, abajo y delante de las costillas ("codos adentro" = sin abrirlos).
OVERRIDES = {
    "goblet-squat": {"hands": "chest", "fwd": 0.2, "down": 0.12, "elbows": (1.0, 0.45, 0.15)},
    # Molino: pies y cadera girados 45° hacia la izquierda (lejos de la pesa); la bisagra va en ese plano.
    "windmill": {"yaw": 45.0},
    # Halo: pesa invertida cogida por los cuernos; palmas enfrentadas a lo largo del asa (fijas a la pesa).
    "halo": {"grip": "horns", "freeHands": True, "halo3d": True},  # las manos no se apoyan: brazo por dirección, no por posición
    # Get-up: 40 s de movimiento lento. Claves a 15 fps y tolerancia doble (no se nota) para el tamaño del GLB.
    "turkish-get-up": {"keyStep": 2, "tolScale": 2.0},
}


def quat_track(quats):
    """Signo continuo (evita giros de 360° al interpolar)."""
    out = []
    for q in quats:
        if out and out[-1].dot(q) < 0:
            q = -q
        out.append(q)
    return out


def shoulder_reach(p0, j, hand, mid, out, fwd, cap=0.09, gain=0.15, push=0.07):
    """Hombro (cabeza del brazo) tras girar la clavícula y el tronco hacia la mano, como hace una persona al llevar las manos a la
    cabeza: protracción/elevación hacia la mano y, si la mano cruza al otro lado de la línea media (mid), el hombro se adelanta hasta
    `push` m (fwd = delante; out = hacia el lado de este hombro). p0 = origen de la clavícula, j = hombro en reposo, hand = objetivo.
    La longitud de la clavícula se conserva."""
    u = j - p0
    shift = (hand - j) * gain
    cross = max(0.0, min(1.0, -(hand - mid).dot(out) / 0.12))
    shift = shift + fwd * (push * cross)
    if shift.length > cap:
        shift = shift.normalized() * cap
    return p0 + (u + shift).normalized() * u.length


def halo_pose(p, t, hc, F, Rt, Up, hang, poles=None, apart=0.045):
    """Halo en 3D: el cuerpo de la pesa (boca arriba) da una vuelta alrededor de la cabeza.
    p = parámetros ajustados por personaje (mh/halo_fit.py), t = fase 0..1, hc = centro de la cabeza, F/Rt/Up = delante, derecha y arriba
    del cuerpo, hang = distancia del agarre al centro del cuerpo de la pesa. La 2D no sirve aquí: sus manos salen de una dirección a
    brazo completo y los brazos acaban atravesando el tronco.
    Devuelve: pb (centro de la pesa), D (eje, del agarre al cuerpo), G (agarre), B (línea entre las manos), pole (dirección de cada codo)."""
    th = 2 * math.pi * t
    s, c = math.sin(th), math.cos(th)
    b = 0.5 - 0.5 * c  # 0 = la pesa pasa por delante, 1 = por detrás
    ctr = hc + F * p["cy"]
    pb = ctr + F * (p["ad"] * c) + Rt * (p["as"] * s) + Up * (p["z0"] - p["z1"] * (1 - b) ** p["pw"])
    radial = F * (p["ad"] * c) + Rt * (p["as"] * s)
    rh = radial.normalized() if radial.length > 1e-6 else F
    # Eje de la pesa: inclinado hacia fuera/dentro de la órbita (ti) y hacia atrás/delante (tf). Con la pesa de lado, los puños quedan
    # delante de la barbilla y no sobre el hombro, y el antebrazo del brazo lejano pasa por delante del cuello en vez de atravesarlo.
    # ti2/tf2: segundo armónico, así la pesa puede inclinarse mucho a los lados (manos junto al cuello) y poco delante y detrás (manos fuera de la cara).
    ti = p["ti"] + p.get("ti2", 0.0) * math.cos(2 * th)
    tf = p["tf"] + p.get("tf2", 0.0) * math.cos(2 * th)
    D = (Up - rh * ti - F * tf).normalized()
    G = pb - D * hang
    phi = math.radians(p["alpha"]) * s
    B = C.perp(Rt * math.cos(phi) - F * math.sin(phi), D).normalized()  # línea entre las manos: perpendicular al eje de la pesa
    if B.dot(Rt) < 0:
        B = -B
    hand = {"R": G + B * apart, "L": G - B * apart}
    pole = {}
    for side in ("R", "L") if poles else ():
        # Codos precalculados por mh/halo_fit.py (los de mayor holgura contra el cuerpo y de giro suave), interpolados en el ciclo
        tab = poles[side]
        x = (t % 1.0) * len(tab)
        i0 = int(x) % len(tab)
        w = x - int(x)
        v0, v1 = Vector(tab[i0]), Vector(tab[(i0 + 1) % len(tab)])
        pole[side] = (v0 * (1 - w) + v1 * w).normalized()
    return {"pb": pb, "D": D, "G": G, "B": B, "pole": pole, "hand": hand}


class Solver:
    def __init__(self, rig, spec, bell_spec):
        self.sk = dict(spec["skeleton"], _scale2d=spec["scale2d"])
        self.k = spec["height"] / 1.75  # los OVERRIDES están en metros de bro
        self.min_abd = math.radians(spec.get("minArmAbduction", 0))
        self.bones = C.bones_for(spec)
        self.bell = bell_spec
        self.rest = {b.name: b.matrix_local.copy() for b in rig.data.bones}
        self.rest_len = {b.name: b.length for b in rig.data.bones}
        self.prev = {}  # estado entre fotogramas (polo del codo, palma)
        self.halo_p = spec.get("halo") if (spec.get("halo") or {}).get("poles") else None  # halo 3D ajustado de este personaje (None: se usa la 2D)
        self.phase = 0.0  # fase 0..1 del clip en curso (la fija build_clip)
        self.rel = {n: (self.rest[p].inverted() @ self.rest[n]) if p else None for n, p in self.bones}

    ROLL_STEP = math.radians(25)

    def limit_roll(self, name, rot):
        """Limita el giro del hueso sobre su propio eje a 25° por fotograma (la dirección no se toca, así que
        las posiciones de codos, manos y pies no cambian). Evita los volteos del plano de flexión."""
        y, x = rot.col[1].normalized(), rot.col[0]
        prev = self.prev.get("x" + name)
        if prev is not None:
            xp = C.perp(prev, y)
            if xp.length > 1e-6:
                xp.normalize()
                ang = math.atan2(xp.cross(x).dot(y), xp.dot(x))
                if abs(ang) > self.ROLL_STEP:
                    x = Matrix.Rotation(math.copysign(self.ROLL_STEP, ang), 3, y) @ xp
                    rot = C.frame3(y, x)
        self.prev["x" + name] = rot.col[0].copy()
        return rot

    def tail(self, res):
        """Coleta (Tail.1-3): cuelga hacia el suelo según el segmento y se retrasa con la aceleración de la
        cabeza. La aceleración se calcula de forma cíclica, así el bucle cierra sin salto."""
        if "Tail.1" not in self.rel:
            return
        n = len(res) - 1  # el último fotograma repite el primero
        tie = [(r[2]["Head"] @ self.rel["Tail.1"]).translation.copy() for r in res[:n]]
        fps2 = C.FPS * C.FPS
        sag, lag = (0.0, 0.25, 0.45), (0.003, 0.007, 0.01)
        down = Vector((0, 0, -1))
        head_rest = self.rest["Head"].to_3x3()
        for f in range(n + 1):
            i = f % n
            acc = (tie[(i + 1) % n] - 2 * tie[i] + tie[i - 1]) * fps2
            basis, _, pose = res[f]
            rot_head = pose["Head"].to_3x3() @ head_rest.inverted()
            left = rot_head @ Vector((1, 0, 0))
            start = tie[i] if f < n else tie[0]
            for k in range(3):
                name = f"Tail.{k + 1}"
                ln = self.rest[name].to_3x3().col[1].length * (self.rest_len[name])
                d = ((rot_head @ self.rest[name].to_3x3().col[1]) * (1 - sag[k]) + down * sag[k] - acc * lag[k]).normalized()
                if start.z + d.z * ln < 0.03:  # tumbada: la coleta descansa en el suelo, no lo atraviesa
                    d.z = (0.03 - start.z) / ln
                    d.normalize()
                basis[name] = self.child(pose, name, C.frame3(d, left))
                start = start + pose[name].to_3x3().col[1].normalized() * ln

    def child(self, pose, name, rot=None):
        """Pose (espacio del armature) de un hueso hijo con la rotación deseada `rot` (o la de reposo)."""
        base = pose[C.PARENT[name]] @ self.rel[name]
        if rot is None:
            pose[name] = base
            return Matrix.Identity(3)
        rot = self.limit_roll(name, rot)
        basis = base.to_3x3().inverted() @ rot
        pose[name] = base @ basis.to_4x4()
        return basis

    def drop(self, fr, cv):
        """Cuánto bajar el cuerpo para que la pierna alcance el tobillo (la 2D estira la pierna un pelo
        cuando la postura es ancha; aquí la pelvis baja esos milímetros y los pies quedan plantados)."""
        reach = 0.9995 * (self.sk["thigh"] + self.sk["shin"])
        dz = 0.0
        # Caderas reales de este cuerpo (pelvis ± semiancho en el eje de la pelvis), no las de la 2D: con una cadera más ancha
        # la pierna alcanza menos y, sin esto, el pie se deslizaría en las posturas anchas.
        p2 = [cv.p(q) for q in fr["hip"]]
        axis = (p2[1] - p2[0]).normalized()
        pelvis = cv.p(fr["pelvis"])
        hw = self.sk["hipHalfWidth"]
        for i in (0, 1):
            v = pelvis + axis * (hw if i else -hw) - cv.p(fr["ankle"][i])
            h2 = reach * reach - v.x * v.x - v.y * v.y
            if h2 > 0 and v.length > reach:
                dz = max(dz, v.z - h2 ** 0.5)
        return dz

    def frame(self, fr, cv, ov):
        sk = self.sk
        cv = C.Canvas(cv.s, cv.x0, cv.g, self.drop(fr, cv), cv.yaw)
        P, Cc, H = cv.p(fr["pelvis"]), cv.p(fr["chest"]), cv.p(fr["head"])
        up = cv.d(fr["up"])
        hip = [cv.p(q) for q in fr["hip"]]  # 0 = derecha, 1 = izquierda
        sh = [cv.p(q) for q in fr["sh"]]
        left_p = (hip[1] - hip[0]).normalized()
        left_c = (sh[1] - sh[0]).normalized()
        left_h = -cv.d(fr["hL"])
        U = (Cc - P).normalized()
        Fc = left_c.cross(U).normalized()

        pose, basis = {}, {}
        hips = C.mat4(C.frame3(up, left_p), P)
        pose["Hips"] = hips
        b = self.rest["Hips"].inverted() @ hips
        basis["Hips"] = (b.translation.copy(), b.to_quaternion())
        basis["Spine"] = self.child(pose, "Spine", C.frame3(U, left_p + left_c))
        basis["Chest"] = self.child(pose, "Chest", C.frame3(U, left_c))
        basis["Neck"] = self.child(pose, "Neck", C.frame3(H - Cc, left_c + left_h))
        basis["Head"] = self.child(pose, "Head", C.frame3(cv.d(fr["hU"]), left_h))

        # ── Brazos ──
        L1, L2 = sk["upperArm"], sk["foreArm"] + sk["wristToGrip"]
        fallback = -Fc - U * 0.5
        J, Ed, Hd, bent = {}, {}, {}, {}
        halo = None
        if ov.get("halo3d") and self.halo_p:
            hb = pose["Head"]
            hc = hb.translation + hb.to_3x3().col[1].normalized() * (self.rest_len["Head"] * 0.48)
            halo = halo_pose(self.halo_p, self.phase, hc, Fc, -left_c, U, self.bell["hang"], self.halo_p["poles"], self.bell["handsApart"])
        for i, side in ((0, "R"), (1, "L")):
            basis["Shoulder." + side] = self.child(pose, "Shoulder." + side)
            J[side] = (pose["Shoulder." + side] @ self.rel["UpperArm." + side]).translation
            if halo is not None:
                # Clavícula hacia la mano (protracción): con las manos junto a la cabeza el hombro no se queda quieto.
                p0 = pose["Shoulder." + side].translation
                j1 = shoulder_reach(p0, J[side], halo["hand"][side], hc, left_c if side == "L" else -left_c, Fc)
                rot = (J[side] - p0).rotation_difference(j1 - p0).to_matrix() @ pose["Shoulder." + side].to_3x3()
                basis["Shoulder." + side] = self.child(pose, "Shoulder." + side, rot)
                J[side] = (pose["Shoulder." + side] @ self.rel["UpperArm." + side]).translation
                Hd[side] = halo["hand"][side]
                Ed[side] = J[side] + halo["pole"][side]
                bent[side] = 1.0
            elif side == "L" and fr.get("free2"):
                # Brazo libre relajado: cuelga junto al muslo, codo algo flexionado (en el marco del pecho).
                out = left_c
                ua = (-U * math.cos(self.min_abd + 0.07) + out * math.sin(self.min_abd + 0.07) + Fc * 0.1).normalized()
                Ed[side] = J[side] + ua * L1
                Hd[side] = Ed[side] + (ua + Fc * 0.3).normalized() * L2
                bent[side] = 1.0
            elif ov.get("hands") == "chest":
                s = C.SIDES[side]
                Hd[side] = Cc + (Fc * ov["fwd"] - U * ov["down"]) * self.k + left_c * (s * self.bell["handsApart"])
                ed = Vector(ov["elbows"])
                Ed[side] = J[side] + (-U * ed[0] + Fc * ed[1] + left_c * (s * ed[2])).normalized() * L1
                bent[side] = 1.0
            else:
                # Mano: vector hombro->mano de la 2D escalado a la longitud del brazo 3D (la mano 2D es continua;
                # el codo 3D de rig.ts cambia de lado al pasar el brazo por recto y no se copia). El codo lo pone ik2.
                sh2, el2, ha2 = cv.p(fr["sh"][i]), cv.p(fr["elbow"][i]), cv.p(fr["hand"][i])
                Hd[side] = J[side] + (ha2 - sh2) * ((L1 + L2) / (44 * cv.s))
                Ed[side] = J[side] + (el2 - sh2)  # solo da la dirección del polo
                bent[side] = C.smoothstep(5, 15, math.degrees((el2 - sh2).angle(ha2 - el2, 0.0)))
                # Mano apoyada (handFix de la 2D: suelo, muslo): manda la posición, no la dirección del brazo.
                hf = 0.0 if ov.get("freeHands") else fr.get("handFix", [0, 0])[i]
                if hf > 0:
                    Hd[side] = Hd[side].lerp(cv.p(fr["hand"][i]), hf)

        # Brazos libres por fuera del torso: abducción mínima (con el torso en V, un brazo colgando recto lo
        # atravesaría). No se aplica con las dos manos en la misma pesa ni con la mano apoyada.
        if fr["bellAt"] != "both" and ov.get("hands") != "chest":
            for i, side in ((0, "R"), (1, "L")):
                if fr.get("handFix", [0, 0])[i] > 0.5:
                    continue
                out = left_c * C.SIDES[side]
                d = Hd[side] - J[side]
                if -d.dot(U) < 0.3 * d.length:
                    continue  # solo brazos que cuelgan (con el brazo arriba el ángulo no tiene sentido)
                ang = math.atan2(d.dot(out), -d.dot(U))
                if -0.6 < ang < self.min_abd:
                    rot = Matrix.Rotation(self.min_abd - ang, 3, -Fc * C.SIDES[side])
                    if math.atan2((rot @ d).dot(out), -(rot @ d).dot(U)) < ang:
                        rot = rot.inverted()
                    Hd[side] = J[side] + rot @ d
                    Ed[side] = J[side] + rot @ (Ed[side] - J[side])

        # ── Pesas ── (posición final de las manos según el agarre)
        bells = []
        grips = {}
        at = fr["bellAt"]
        for k, bd in enumerate(fr["bells"]):
            if halo is not None:
                D = halo["D"]
                B = C.perp(halo["B"], D).normalized()
            else:
                D = cv.d(bd["dir"])
                B = C.perp(cv.d(bd["bar"]), D).normalized()
            if at == "both":
                if B.dot(-left_c) < 0:
                    B = -B
                G = (Hd["R"] + Hd["L"]) / 2
                Hd["R"] = G + B * self.bell["handsApart"]
                Hd["L"] = G - B * self.bell["handsApart"]
                grips["R"] = grips["L"] = B
            else:
                side = "L" if (at == "hand2" or (at == "pair" and k == 1)) else "R"
                G = Hd[side]
                grips[side] = B
            rot = Matrix((B, (-D).cross(B), -D)).transposed()
            bells.append((G, rot.to_quaternion(), bd["size"]))

        for side in ("R", "L"):
            s = C.SIDES[side]
            # Polo del codo: la flexión de la 2D + 1 cm hacia el respaldo. Con el brazo recto manda el respaldo
            # (si no, el ruido de redondeo de la 2D haría girar el brazo sobre su eje de un fotograma a otro).
            # Con el brazo recto el polo es arbitrario: se hereda del fotograma anterior (continuidad) y no se
            # recalcula, para que el brazo no gire 180° sobre su eje de un fotograma al siguiente.
            axis = Hd[side] - J[side]
            ref = C.perp(self.prev.get("pole" + side, fallback), axis).normalized()
            p2d = C.perp(Ed[side] - J[side], axis)
            if halo is None and p2d.dot(ref) < 0:
                p2d = -p2d  # el codo no se dobla hacia atrás: la 2D eligió el otro lado al pasar por recto
            w = bent[side] if p2d.length > 1e-6 else 0.0
            pole = (p2d.normalized() * w + ref * (1 - w)) if w > 0 else ref
            if pole.length < 1e-6:
                pole = ref
            pole.normalize()
            self.prev["pole" + side] = pole
            E = C.ik2(J[side], Hd[side], L1, L2, pole)
            n_arm = C.limb_normal(J[side], E, Hd[side], pole)
            yh = (Hd[side] - E).normalized()
            x_hand = n_arm
            if side in grips and ov.get("grip") == "horns":
                x_hand = grips[side] * (-1.0 if side == "R" else 1.0) * s  # palma hacia la pesa
            elif side in grips:
                # Palma perpendicular al asa. Si el asa queda casi paralela al antebrazo (la pesa voltea en el
                # arranque, halo), ese producto es inestable: manda la palma del fotograma anterior.
                raw = grips[side].cross(yh)
                prev = self.prev.get("palm" + side)
                if prev is not None:
                    pp = C.perp(prev, yh).normalized()
                    if raw.dot(pp) < 0:
                        raw = -raw
                    w = C.smoothstep(0.15, 0.45, raw.length)
                    palm = (raw.normalized() * w if raw.length > 1e-6 else Vector()) + pp * (1 - w)
                else:
                    palm = raw if raw.dot(P - Hd[side]) >= 0 else -raw  # palma hacia el cuerpo (agarre prono)
                if palm.length > 1e-6:
                    palm.normalize()
                    self.prev["palm" + side] = palm.copy()
                    x_hand = palm * s
            x_fore = n_arm + x_hand
            if x_fore.length < 1e-3:
                x_fore = n_arm
            basis["UpperArm." + side] = self.child(pose, "UpperArm." + side, C.frame3(E - J[side], n_arm))
            basis["ForeArm." + side] = self.child(pose, "ForeArm." + side, C.frame3(yh, x_fore))
            basis["Hand." + side] = self.child(pose, "Hand." + side, C.frame3(yh, x_hand))

        # ── Piernas ──
        for i, side in ((0, "R"), (1, "L")):
            base = pose["Hips"] @ self.rel["UpLeg." + side]
            Hj = base.translation
            A = cv.foot(fr["ankle"][i])
            heel, toe = cv.foot(fr["heel"][i]), cv.foot(fr["toe"][i])
            ffwd = (toe - heel).normalized()
            pole = C.perp(cv.p(fr["knee"][i]) - Hj, A - Hj) + C.perp(ffwd, A - Hj).normalized() * 0.02
            K = C.ik2(Hj, A, sk["thigh"], sk["shin"], pole)
            n_leg = C.limb_normal(Hj, K, A, ffwd)
            basis["UpLeg." + side] = self.child(pose, "UpLeg." + side, C.frame3(K - Hj, n_leg))
            basis["Leg." + side] = self.child(pose, "Leg." + side, C.frame3(A - K, n_leg))
            foot = C.frame3(ffwd, cv.d(fr["footUp"][i]).cross(ffwd))
            basis["Foot." + side] = self.child(pose, "Foot." + side, foot)
            basis["Toe." + side] = self.child(pose, "Toe." + side, foot)
        return basis, bells, pose


# Tolerancias de la reducción de claves (grados / metros). La cadena cadera-pierna es la más estricta:
# un error de 0,08° en la cadera mueve el pie ~1 mm. Primer y último fotograma se conservan (bucle).
TOL_DEG = {"Hips": 0.08, "Spine": 0.15, "Chest": 0.15, "UpLeg": 0.08, "Leg": 0.08, "Foot": 0.15, "Toe": 0.3,
           "Shoulder": 0.15, "UpperArm": 0.15, "ForeArm": 0.25, "Hand": 0.3, "Neck": 0.3, "Head": 0.3, "Tail": 0.6,
           "bell": 0.3}
TOL_M = {"Hips": 0.0005, "bell": 0.001}


def rdp_keep(n, err, step=1):
    """Ramer-Douglas-Peucker sobre el tiempo: índices de fotograma a conservar (err normalizado: > 1 = fuera).
    step > 1 remuestrea: solo hay claves en fotogramas múltiplos de step (p. ej. 2 = 15 fps)."""
    keep = {0, n - 1}
    stack = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        if j - i < 2 * step:
            continue
        worst, wk = 1.0, None
        for k in range(i + step, j - (j - i) % step if (j - i) % step else j, step):
            e = err(i, j, k)
            if e > worst:
                worst, wk = e, k
        if wk is not None:
            keep.add(wk)
            stack += [(i, wk), (wk, j)]
    return sorted(keep)


def reduce_track(quats=None, vecs=None, deg=0.2, meters=0.001, step=1):
    """Fotogramas a conservar para una rotación (slerp, como glTF/three.js) y/o una traslación (lerp)."""
    n = len(quats or vecs)

    def err(i, j, k):
        t = (k - i) / (j - i)
        e = 0.0
        if quats:
            q = quats[i].slerp(quats[j], t)
            e = max(e, math.degrees(2 * math.acos(min(1.0, abs(q.dot(quats[k]))))) / deg)
        if vecs:
            e = max(e, (vecs[i].lerp(vecs[j], t) - vecs[k]).length / meters)
        return e
    return rdp_keep(n, err, step)


def write_curves(strip, slot, groups):
    """groups: [(fotogramas_a_conservar, [(data_path, index, nombre_grupo, valores_por_fotograma)])]."""
    cb = strip.channelbag(slot, ensure=True)
    keys = 0
    for frames, channels in groups:
        for path, idx, group, vals in channels:
            fc = cb.fcurves.new(path, index=idx, group_name=group)
            fc.keyframe_points.add(len(frames))
            co = []
            for f in frames:
                co += (f, vals[f])
            fc.keyframe_points.foreach_set("co", co)
            fc.keyframe_points.foreach_set("interpolation", [1] * len(frames))  # LINEAR
            fc.update()
            keys += len(frames)
    return keys


def build_clip(clip, data, solver, rig, bells_obj, ov):
    frames = data["frames"]
    n = len(frames)
    x0 = sum((f["ankle"][0][0] + f["ankle"][1][0]) / 2 for f in frames) / n  # origen entre los pies
    cv = C.Canvas(solver.sk["_scale2d"], x0, yaw=ov.get("yaw", 0.0))
    # El estado entre fotogramas (polo del codo, palma, giro limitado) tiene memoria: se repite el ciclo hasta
    # que el último fotograma coincide con el primero y luego se igualan exactamente (bucle sin salto).
    solver.prev = {}
    res = None
    for _ in range(6):
        res = []
        for i, fr in enumerate(frames):
            solver.phase = i / (n - 1) if n > 1 else 0.0
            res.append(solver.frame(fr, cv, ov))
        gap = max(math.degrees(res[0][0][b].to_quaternion().rotation_difference(res[-1][0][b].to_quaternion()).angle)
                  for b in res[0][0] if b != "Hips")
        if gap < 0.3:
            break
    res[-1] = res[0]
    solver.tail(res)

    act = bpy.data.actions.new(clip)
    act.use_fake_user = True
    layer = act.layers.new("Base")
    strip = layer.strips.new(type="KEYFRAME")

    rig_slot = act.slots.new(id_type="OBJECT", name=rig.name)
    groups = []
    for name, _ in solver.bones:
        tol = TOL_DEG[name.split(".")[0]]
        ch = []
        locs = None
        if name == "Hips":
            locs = [r[0]["Hips"][0] for r in res]
            for k in range(3):
                ch.append((f'pose.bones["Hips"].location', k, name, [v[k] for v in locs]))
            qs = quat_track([r[0]["Hips"][1] for r in res])
        else:
            qs = quat_track([r[0][name].to_quaternion() for r in res])
        for k in range(4):
            ch.append((f'pose.bones["{name}"].rotation_quaternion', k, name, [q[k] for q in qs]))
        groups.append((reduce_track(qs, locs, tol * ov.get("tolScale", 1.0), TOL_M["Hips"] * ov.get("tolScale", 1.0), ov.get("keyStep", 1)), ch))
    keys = write_curves(strip, rig_slot, groups)

    slots = {rig.name: rig_slot}
    for bi, ob in enumerate(bells_obj):
        slot = act.slots.new(id_type="OBJECT", name=ob.name)
        locs, quats, scales = [], [], []
        for _, bells, pose in res:
            if bi < len(bells):
                g, q, size = bells[bi]
                locs.append(g)
                quats.append(q)
                scales.append(size)
            else:  # pesa sin usar en este clip: escondida dentro de la pelvis
                locs.append(pose["Hips"].translation.copy())
                quats.append(Matrix.Identity(3).to_quaternion())
                scales.append(0.001)
        quats = quat_track(quats)
        keep = reduce_track(quats, locs, TOL_DEG["bell"] * ov.get("tolScale", 1.0), TOL_M["bell"], ov.get("keyStep", 1))
        keep = sorted(set(keep) | {f for f in range(1, n) if abs(scales[f] - scales[f - 1]) > 1e-6} | {f - 1 for f in range(1, n) if abs(scales[f] - scales[f - 1]) > 1e-6})
        bc = [("location", k, "", [v[k] for v in locs]) for k in range(3)]
        bc += [("rotation_quaternion", k, "", [q[k] for q in quats]) for k in range(4)]
        bc += [("scale", k, "", scales) for k in range(3)]
        keys += write_curves(strip, slot, [(keep, bc)])
        slots[ob.name] = slot

    act.use_frame_range = True
    act.frame_start, act.frame_end = 0, n - 1
    act.use_cyclic = True
    for ob in [rig] + bells_obj:
        tr = ob.animation_data.nla_tracks.new()
        tr.name = clip
        st = tr.strips.new(clip, 0, act)
        st.action_slot = slots[ob.name]
    dense = n * (len(solver.bones) * 4 + 3 + 2 * 10)
    print(f"[animate] {clip}: {n} fotogramas ({(n - 1) / C.FPS:.2f} s), origen x0 = {x0:.1f}, claves {keys} de {dense} ({100 * keys / dense:.0f} %)")
    return res


def main():
    a = C.args()
    cid = a["id"]
    bpy.ops.wm.open_mainfile(filepath=C.blend_path(cid))
    spec_all = C.load_spec()
    spec = spec_all["characters"][cid]
    sk = dict(spec["skeleton"], _scale2d=spec["scale2d"])
    with open(C.POSES_PATH, encoding="utf-8") as f:
        poses = json.load(f)["characters"][cid]["clips"]
    clips = list(poses) if a.get("clips") == "all" else a["clips"].split(",") if "clips" in a else READY
    missing = [c for c in clips if c not in poses]
    if missing:
        raise SystemExit(f"Clips sin poses en {C.POSES_PATH}: {missing} (¿falta node scripts/export-poses2d.mjs?)")

    rig = bpy.data.objects["Rig"]
    bells = [bpy.data.objects["Kettlebell"], bpy.data.objects["Kettlebell2"]]
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act)
    for ob in [rig] + bells:
        ob.animation_data_clear()
        ob.animation_data_create()
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"

    solver = Solver(rig, spec, spec_all["bell"])
    for clip in clips:
        build_clip(clip, poses[clip], solver, rig, bells, OVERRIDES.get(clip, {}))
    for ob in [rig] + bells:
        ob.animation_data.action = None
    bpy.context.scene.frame_start = 0
    C.save(C.blend_path(cid))
    print(f"[animate] guardado {C.blend_path(cid)} con {len(clips)} clips")


if __name__ == "__main__":
    main()
