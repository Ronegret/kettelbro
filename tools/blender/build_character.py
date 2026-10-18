"""Construye un personaje (malla con piel + Armature "Rig" + pesas) en pose A.

Uso:
  blender --background --factory-startup --python tools/blender/build_character.py -- --id bro

Salida: art/personajes/<id>.blend (lo usan animate.py, export_glb.py, validate.py y render_preview.py).
Todo sale de tools/blender/spec/characters.json: nada se hace a mano.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402

X = Vector((1, 0, 0))
Y = Vector((0, 1, 0))
Z = Vector((0, 0, 1))
FWD = Vector((0, -1, 0))
RAD = math.pi / 180


# ───────────────────────── Esqueleto en reposo ─────────────────────────

def rest_joints(sk):
    """Articulaciones en pose A (metros, ejes de Blender)."""
    j = {"P": Vector((0, 0, sk["hipZ"]))}
    cz = sk["hipZ"] + sk["spine"] + sk["chest"]
    j["C"] = Vector((0, 0, cz))
    j["H"] = j["C"] + Z * (sk["neck"] + sk["headCenterAboveNeck"])
    a = sk["restArmDeg"] * RAD
    eb = sk["restElbowDeg"] * RAD
    for side, s in C.SIDES.items():
        hip = Vector((s * sk["hipHalfWidth"], 0, sk["hipZ"]))
        ank_t = Vector((s * sk["ankleHalfWidth"], 0, sk["ankleZ"]))
        d = (ank_t - hip).normalized()
        knee = hip + d * sk["thigh"]
        ankle = knee + d * sk["shin"]
        j["hip" + side], j["knee" + side], j["ankle" + side] = hip, knee, ankle
        j["ball" + side] = ankle + FWD * sk["footToBall"]
        j["tip" + side] = j["ball" + side] + FWD * sk["ballToTip"]
        # Articulación 3D del hombro: más fuera y algo delante que el hombro 2D, para que el brazo cuelgue
        # por fuera del torso (los brazos se reorientan por dirección, así que la 2D no se ve afectada).
        sh = Vector((s * sk["armRootHalfWidth"], -sk["armRootForward"], cz - sk["shoulderDrop"]))
        ua = Vector((s * math.sin(a), 0, -math.cos(a)))
        el = sh + ua * sk["upperArm"]
        fa = (ua * math.cos(eb) + FWD * math.sin(eb)).normalized()
        wr = el + fa * sk["foreArm"]
        j["clav" + side] = Vector((s * 0.03, 0, cz - 0.015))
        j["sh" + side], j["el" + side], j["wr" + side] = sh, el, wr
        j["grip" + side] = wr + fa * sk["wristToGrip"]
    return j


ARM_FALLBACK = Vector((0, 1, -0.5))  # codo hacia atrás y abajo (en el marco del pecho)


def rest_frames(sk, j):
    """(cabeza, base 3x3, longitud) de cada hueso. animate.py usa las mismas reglas por fotograma."""
    f = {}
    up = C.frame3(Z, X)
    f["Hips"] = (j["P"], up, 0.1)
    f["Spine"] = (j["P"], up, sk["spine"])
    f["Chest"] = (j["P"] + Z * sk["spine"], up, sk["chest"])
    f["Neck"] = (j["C"], up, sk["neck"])
    f["Head"] = (j["C"] + Z * sk["neck"], up, sk["headBone"])
    for side in C.SIDES:
        sh, el, wr, grip = j["sh" + side], j["el" + side], j["wr" + side], j["grip" + side]
        clav = j["clav" + side]
        f["Shoulder." + side] = (clav, C.frame3(sh - clav, FWD), (sh - clav).length)
        n_arm = C.limb_normal(sh, el, grip, ARM_FALLBACK)
        f["UpperArm." + side] = (sh, C.frame3(el - sh, n_arm), sk["upperArm"])
        f["ForeArm." + side] = (el, C.frame3(wr - el, n_arm), sk["foreArm"])
        f["Hand." + side] = (wr, C.frame3(wr - el, n_arm), sk["hand"])
        hip, knee, ankle = j["hip" + side], j["knee" + side], j["ankle" + side]
        n_leg = C.limb_normal(hip, knee, ankle, FWD)
        f["UpLeg." + side] = (hip, C.frame3(knee - hip, n_leg), sk["thigh"])
        f["Leg." + side] = (knee, C.frame3(ankle - knee, n_leg), sk["shin"])
        foot = C.frame3(FWD, Z.cross(FWD))
        f["Foot." + side] = (ankle, foot, sk["footToBall"])
        f["Toe." + side] = (j["ball" + side], foot, sk["ballToTip"])
    return f


def build_rig(frames, bones):
    arm = bpy.data.armatures.new("Rig")
    rig = bpy.data.objects.new("Rig", arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for name, parent in bones:
        head, rot, length = frames[name]
        eb = arm.edit_bones.new(name)
        eb.head = head
        eb.tail = head + rot.col[1] * length
        eb.align_roll(rot.col[2])
        eb.use_deform = True
        if parent:
            eb.parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    worst = 0.0
    for name, _ in bones:
        b = arm.bones[name]
        worst = max(worst, max((b.matrix_local.to_3x3().col[i] - frames[name][1].col[i]).length for i in range(3)))
    assert worst < 1e-4, f"base de hueso distinta de la prevista ({worst})"
    arm.display_type = "STICK"
    return rig


# ───────────────────────── Malla ─────────────────────────

class MB:
    """Acumula vértices (con pesos de piel) y caras (con material) antes de crear la malla."""

    def __init__(self):
        self.co, self.w, self.faces, self.mats = [], [], [], []

    def v(self, co, w):
        self.co.append(Vector(co))
        self.w.append(dict(w))
        return len(self.co) - 1

    def f(self, idx, mat, inside):
        """Cara con la normal hacia fuera de `inside` (punto interior de la pieza)."""
        pts = [self.co[i] for i in idx]
        n = Vector((0, 0, 0))
        for a, b in zip(pts, pts[1:] + pts[:1]):
            n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
        cen = sum(pts, Vector()) / len(pts)
        if n.length < 1e-14:
            return  # cara degenerada (polo)
        if n.dot(cen - Vector(inside)) < 0:
            idx = list(reversed(idx))
        self.faces.append(list(idx))
        self.mats.append(mat)


def ring_band(mb, rings, closed_start=True, closed_end=True):
    """Une anillos de igual número de vértices. rings: [(idx[], material, centro, tangente)]."""
    for k in range(len(rings) - 1):
        a, mat, ca, _ = rings[k]
        b, _, cb, _ = rings[k + 1]
        n = len(a)
        cen = (ca + cb) / 2
        for i in range(n):
            j2 = (i + 1) % n
            mb.f([a[i], a[j2], b[j2], b[i]], mat, cen)
    for k, closed, sgn in ((0, closed_start, 1), (len(rings) - 1, closed_end, -1)):
        if not closed:
            continue
        idx, mat, cen, tan = rings[k]
        if k == len(rings) - 1:
            mat = rings[k - 1][1]
        c = mb.v(cen, mb.w[idx[0]])
        for i in range(len(idx)):
            mb.f([idx[i], idx[(i + 1) % len(idx)], c], mat, cen + tan * (0.01 * sgn))


def blend(pairs):
    """Pesos encadenados: pairs = [(hueso, t)] con t creciente -> reparto suave sin solapes."""
    out = {}
    rest = 1.0
    for name, t in pairs:
        out[name] = rest * (1 - t)
        rest *= t
    out[pairs[-1][0]] = out.get(pairs[-1][0], 0) + rest
    return {k: v for k, v in out.items() if v > 1e-4}


def torso_weights(sk, k):
    """Reparto Hips/Spine/Chest/Neck/Head por altura; k = altura del personaje / 1,75 (ajustado en bro)."""
    p, c = sk["hipZ"], sk["hipZ"] + sk["spine"] + sk["chest"]

    def w(z):
        t1 = C.smoothstep(p + 0.03 * k, p + 0.15 * k, z)
        t2 = C.smoothstep(p + sk["spine"] - 0.0, p + sk["spine"] + 0.12 * k, z)
        t3 = C.smoothstep(c - 0.02 * k, c + 0.09 * k, z)  # cuello ancho: la flexión se reparte
        t4 = C.smoothstep(c + 0.114 * k, c + 0.154 * k, z)
        return blend([("Hips", t1), ("Spine", t2), ("Chest", t3), ("Neck", t4), ("Head", 1.0)])
    return w


def refine(rows, min_gap=0.03):
    """Inserta anillos intermedios (Catmull-Rom) donde el perfil va espaciado: siluetas más suaves."""
    out = []
    for i, a in enumerate(rows):
        out.append(a)
        if i + 1 < len(rows) and rows[i + 1][0] - a[0] > min_gap:
            b = rows[i + 1]
            p = rows[i - 1] if i > 0 else a
            q = rows[i + 2] if i + 2 < len(rows) else b
            mid = [(a[0] + b[0]) / 2]
            for k in (1, 2, 3):
                mid.append(0.5 * a[k] + 0.5 * b[k] + 0.125 * (a[k] - p[k]) + 0.125 * (b[k] - q[k]))
            out.append(mid + [a[4]])
    return out


def build_volumes(mb, spec, w_torso):
    """Volúmenes extra pegados al torso (pecho, glúteos): elipsoides del color de la prenda."""
    for vol in spec.get("volumes", []):
        x, fwd, z = vol["center"]
        rx, rf, rz = vol["radii"]
        w = w_torso(z) if vol.get("bone") == "torso" else {vol["bone"]: 1.0}
        for sgn in ((1, -1) if vol.get("mirror") else (1,)):
            ellipsoid(mb, Vector((x * sgn, -fwd, z)), X * rx, FWD * rf, Z * rz, vol["mat"], w, 14, 9)


def se(t, n):
    return math.copysign(abs(t) ** (2.0 / n), t)


def build_torso(mb, spec, w_torso):
    tor = spec["torso"]
    seg = tor["segments"]
    rings = []
    bulges = tor.get("bulges", [])
    for z, a, b, dy, mat in tor["rings"]:
        cen = Vector((0, -dy, z))
        idx = []
        for i in range(seg):
            th = 2 * math.pi * i / seg
            x, yf = a * se(math.sin(th), 2.4), dy + b * se(math.cos(th), 2.4)
            # Abultamientos integrados en la superficie (pecho, pectorales, glúteos): sin costuras ni bolas sueltas.
            for bg in bulges:
                sd = 1 if bg["side"] == "front" else -1
                c = math.cos(th) * sd
                if c > 0:
                    gz = math.exp(-((z - bg["z"]) / bg["height"]) ** 2)
                    gx = math.exp(-((abs(x) - bg["x"]) / bg["width"]) ** 2)
                    yf += sd * bg["amount"] * gz * gx * c ** bg.get("falloff", 0.5)
            idx.append(mb.v(Vector((x, -yf, z)), w_torso(z)))
        rings.append((idx, mat, cen, Z))
    ring_band(mb, rings)


class Chain:
    """Polilínea de una extremidad (raíz -> articulación -> extremo) con tangente suavizada en el codo/rodilla."""

    def __init__(self, pts, soften=0.035):
        self.pts = pts
        self.len = [(b - a).length for a, b in zip(pts, pts[1:])]
        self.dirs = [(b - a).normalized() for a, b in zip(pts, pts[1:])]
        self.soften = soften

    def at(self, s):
        acc = 0.0
        for i, ln in enumerate(self.len):
            last = i == len(self.len) - 1
            if s <= acc + ln or last:
                p = self.pts[i] + self.dirs[i] * (s - acc)
                t = self.dirs[i]
                if i > 0 and s - acc < self.soften:  # cerca de la articulación previa
                    u = 0.5 + 0.5 * (s - acc) / self.soften
                    t = (self.dirs[i - 1] * (1 - u) + self.dirs[i] * u).normalized()
                elif not last and acc + ln - s < self.soften:
                    u = 0.5 - 0.5 * (acc + ln - s) / self.soften
                    t = (self.dirs[i] * (1 - u) + self.dirs[i + 1] * u).normalized()
                return p, t
            acc += ln
        return self.pts[-1], self.dirs[-1]


def limb_axes(t, side):
    s = C.SIDES[side]
    f = C.perp(FWD, t).normalized()
    lat = C.perp(C.perp(X * s, t), f).normalized()
    return f, lat


def profile_at(profile, s):
    """Interpola [s, rx, ry, dy] del perfil."""
    if s <= profile[0][0]:
        return profile[0][1:4]
    for a, b in zip(profile, profile[1:]):
        if s <= b[0]:
            u = (s - a[0]) / (b[0] - a[0])
            return [a[k] + (b[k] - a[k]) * u for k in (1, 2, 3)]
    return profile[-1][1:4]


def limb_point(chain, profile, side, s, th, extra=0.0):
    """Punto de la superficie de una extremidad. th: 0 = delante, 90° = fuera, 180° = detrás."""
    c, t = chain.at(s)
    f, lat = limb_axes(t, side)
    rx, ry, dy = profile_at(profile, s)
    return c + f * ((ry + extra) * math.cos(th) + dy) + lat * ((rx + extra) * math.sin(th)), c, t


def build_limb(mb, chain, prof, side, wfn):
    seg = prof["segments"]
    rings = []
    for s, rx, ry, dy, mat in prof["profile"]:
        idx = []
        for i in range(seg):
            th = 2 * math.pi * i / seg
            p, c, t = limb_point(chain, prof["profile"], side, s, th)
            idx.append(mb.v(p, wfn(s, th) if getattr(wfn, "per_vertex", False) else wfn(s)))
        rings.append((idx, mat, chain.at(s)[0], chain.at(s)[1]))
    ring_band(mb, rings)


def arm_weights(sk, side):
    ua, fa = sk["upperArm"], sk["foreArm"]

    def w(s):
        t1 = C.smoothstep(ua - 0.05, ua + 0.04, s)
        t2 = C.smoothstep(ua + fa - 0.025, ua + fa + 0.015, s)
        return blend([("UpperArm." + side, t1), ("ForeArm." + side, t2), ("Hand." + side, 1.0)])
    return w


def leg_weights(sk, side):
    th = sk["thigh"]

    def w(s):
        return blend([("UpLeg." + side, C.smoothstep(th - 0.085, th + 0.07, s)), ("Leg." + side, 1.0)])
    return w


def build_hand(mb, spec, sk, j, side, wfn):
    """Puño: bloque redondeado (superelipse) a lo largo de la mano + pulgar."""
    h = spec["hand"]
    el, wr = j["el" + side], j["wr" + side]
    yax = (wr - el).normalized()
    s = C.SIDES[side]
    palm = C.perp(X * -s, yax).normalized()                  # palma hacia el muslo
    front = C.perp(C.perp(FWD, yax), palm).normalized()      # lado del pulgar
    hw, ht, ln = h["width"] / 2, h["thickness"] / 2, h["length"]
    prof = [(-0.005, 0.6, 0.75), (0.02, 0.86, 0.92), (0.045, 1.0, 1.0), (0.075, 1.0, 1.0), (0.095, 0.88, 0.88), (ln, 0.5, 0.6)]
    s0 = sk["upperArm"] + sk["foreArm"]
    rings = []
    seg = 12
    for y, kw, kt in prof:
        cen = wr + yax * y
        idx = []
        for i in range(seg):
            th = 2 * math.pi * i / seg
            p = cen + front * (hw * kw * se(math.cos(th), 3.2)) + palm * (ht * kt * se(math.sin(th), 3.2))
            idx.append(mb.v(p, wfn(s0 + y)))
        rings.append((idx, "skin", cen, yax))
    ring_band(mb, rings)
    # Pulgar: cápsula corta en el lado del índice, sobre la palma.
    r, ln_t = h["thumb"]
    a = wr + yax * 0.025 + front * (hw * 0.85) + palm * (ht * 0.35)
    b = a + yax * ln_t + palm * 0.012 - front * 0.008
    tch = Chain([a, b])
    tprof = [[-0.006, r * 0.5, r * 0.5, 0, "skin"], [0.0, r, r, 0, "skin"], [ln_t * 0.8, r * 0.9, r * 0.9, 0, "skin"], [ln_t + 0.004, r * 0.45, r * 0.45, 0, "skin"]]
    build_limb(mb, tch, {"segments": 8, "profile": tprof}, side, lambda _s: wfn(s0 + 0.06))


# ── Cabeza ──

class Head:
    def __init__(self, spec, center):
        hd = spec["head"]
        self.rx, self.ry, self.rz = hd["radii"]
        self.rz_low = hd.get("chinDrop", self.rz)
        self.back = hd["back"]
        self.jaw = hd["jawWidth"]
        self.chin = hd["chinForward"]
        self.c = center

    def local(self, phi, psi):
        """(lateral +izq, frente, arriba) en metros para azimut phi (0 = cara, + = izquierda) y elevación psi."""
        lat = math.sin(phi) * math.cos(psi)
        fr = math.cos(phi) * math.cos(psi)
        up = math.sin(psi)
        x, y, z = lat * self.rx, fr * self.ry, up * self.rz
        if up < 0:
            k = -up
            x *= 1 - (1 - self.jaw) * k ** 1.4
            if fr > 0:
                y += self.chin * k * fr
            z = -self.rz_low * (k ** 1.15)  # mandíbula más larga y cuadrada
        if fr > 0.62:
            y = self.ry * 0.62 + (y - self.ry * 0.62) * 0.7  # cara algo más plana
        return x, y - self.back, z

    def p(self, phi, psi):
        x, y, z = self.local(phi, psi)
        return self.c + X * x + FWD * y + Z * z

    def n(self, phi, psi):
        e = 1e-3
        a = self.p(phi + e, psi) - self.p(phi - e, psi)
        b = self.p(phi, min(psi + e, math.pi / 2)) - self.p(phi, max(psi - e, -math.pi / 2))
        n = a.cross(b)
        if n.length < 1e-12:
            n = self.p(phi, psi) - self.c
        n.normalize()
        return n if n.dot(self.p(phi, psi) - self.c) > 0 else -n

    def psi_at_up(self, phi, up_m):
        """Elevación psi en la que la superficie está a `up_m` metros del centro (en altura)."""
        lo, hi = -math.pi / 2, math.pi / 2
        for _ in range(40):
            mid = (lo + hi) / 2
            if self.local(phi, mid)[2] < up_m:
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2


def build_head(mb, spec, head):
    nu, nv = spec["head"]["segments"]
    w = {"Head": 1.0}
    grid = []
    for k in range(1, nv):
        psi = -math.pi / 2 + math.pi * k / nv
        grid.append([mb.v(head.p(2 * math.pi * i / nu, psi), w) for i in range(nu)])
    bot = mb.v(head.p(0, -math.pi / 2), w)
    top = mb.v(head.p(0, math.pi / 2), w)
    for k in range(len(grid) - 1):
        for i in range(nu):
            j2 = (i + 1) % nu
            mb.f([grid[k][i], grid[k][j2], grid[k + 1][j2], grid[k + 1][i]], "skin", head.c)
    for i in range(nu):
        j2 = (i + 1) % nu
        mb.f([grid[0][i], grid[0][j2], bot], "skin", head.c)
        mb.f([grid[-1][i], grid[-1][j2], top], "skin", head.c)


def ellipsoid(mb, center, ax, ay, az, mat, w, nu=10, nv=6):
    """Elipsoide con semiejes vectoriales ax, ay, az (az = polo)."""
    rows = []
    for k in range(1, nv):
        v = -math.pi / 2 + math.pi * k / nv
        rows.append([mb.v(center + ax * (math.cos(v) * math.cos(2 * math.pi * i / nu)) + ay * (math.cos(v) * math.sin(2 * math.pi * i / nu)) + az * math.sin(v), w) for i in range(nu)])
    bot, top = mb.v(center - az, w), mb.v(center + az, w)
    for k in range(len(rows) - 1):
        for i in range(nu):
            j2 = (i + 1) % nu
            mb.f([rows[k][i], rows[k][j2], rows[k + 1][j2], rows[k + 1][i]], mat, center)
    for i in range(nu):
        j2 = (i + 1) % nu
        mb.f([rows[0][i], rows[0][j2], bot], mat, center)
        mb.f([rows[-1][i], rows[-1][j2], top], mat, center)


def surface_frame(head, phi, psi):
    n = head.n(phi, psi)
    t_lat = C.perp(head.p(phi + 0.01, psi) - head.p(phi - 0.01, psi), n).normalized()
    t_up = n.cross(t_lat)
    if t_up.z < 0:
        t_up = -t_up
    return head.p(phi, psi), n, t_lat, t_up


def lerp_table(table, x):
    if x <= table[0][0]:
        return table[0][1]
    for (x0, y0), (x1, y1) in zip(table, table[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return table[-1][1]


BEARD_TOP = [(0, -0.040), (12, -0.044), (22, -0.048), (34, -0.044), (48, -0.028), (64, -0.012), (80, 0.0), (94, 0.006)]
PHI_BEARD = 94


def beard_thickness(fb, phi_deg, psi, v):
    t = fb["thickness"] + (fb["chinThickness"] - fb["thickness"]) * C.smoothstep(-0.7, -1.2, psi) * (1 - C.smoothstep(25, 60, abs(phi_deg)))
    edge = min(C.smoothstep(1.0, 0.82, v), C.smoothstep(PHI_BEARD, PHI_BEARD - 10, abs(phi_deg)))
    return 0.0015 + (t - 0.0015) * edge


def build_beard(mb, spec, head):
    fb = spec["features"]["barba"]
    w = {"Head": 1.0}
    nu, nv = 22, 9
    rows = []
    for i in range(nu + 1):
        phi_deg = -PHI_BEARD + 2 * PHI_BEARD * i / nu
        phi = phi_deg * RAD
        psi_top = head.psi_at_up(phi, lerp_table(BEARD_TOP, abs(phi_deg)))
        col = []
        for k in range(1, nv + 1):
            v = k / nv
            psi = -math.pi / 2 + (psi_top + math.pi / 2) * v
            col.append(mb.v(head.p(phi, psi) + head.n(phi, psi) * beard_thickness(fb, phi_deg, psi, v), w))
        rows.append(col)
    bot = mb.v(head.p(0, -math.pi / 2) - Z * fb["chinThickness"] * 0.6, w)
    for i in range(nu):
        for k in range(nv - 1):
            mb.f([rows[i][k], rows[i + 1][k], rows[i + 1][k + 1], rows[i][k + 1]], "beard", head.c)
        mb.f([rows[i][0], rows[i + 1][0], bot], "beard", head.c)
    return lambda phi_deg, psi: beard_thickness(fb, phi_deg, psi, 0.5)


def head_angles(head, q):
    """Ángulos (phi, psi) aproximados del punto q (proyección radial sobre el cráneo escalado)."""
    d = q - head.c
    lat = d.dot(X) / head.rx
    fr = (d.dot(FWD) + head.back) / head.ry
    up = d.dot(Z) / (head.rz if d.z >= 0 else head.rz_low)
    return math.atan2(lat, fr), math.atan2(up, math.hypot(lat, fr))


class Decal:
    """Formas planas pegadas a la cara (ojos, párpados, cejas, boca, rubor), en metros del plano tangente
    en (phi0, psi0): u hacia el lado del personaje indicado por `mirror`, v hacia arriba."""

    def __init__(self, mb, head, phi0_deg, psi0_deg, mirror=1.0, lift=None):
        self.mb, self.head, self.m = mb, head, mirror
        self.p0, _, self.tl, self.tu = surface_frame(head, phi0_deg * RAD, psi0_deg * RAD)
        self.lift = lift or (lambda phi, psi: 0.0)  # grosor extra bajo la forma (barba)
        self.w = {"Head": 1.0}

    def pt(self, u, v, off):
        q = self.p0 + self.tl * (u * self.m) + self.tu * v
        phi, psi = head_angles(self.head, q)
        return self.mb.v(self.head.p(phi, psi) + self.head.n(phi, psi) * (off + self.lift(phi, psi)), self.w)

    def fan(self, outline, off, mat):
        cu = sum(u for u, _ in outline) / len(outline)
        cv = sum(v for _, v in outline) / len(outline)
        c = self.pt(cu, cv, off)
        ring = [self.pt(u, v, off) for u, v in outline]
        for i in range(len(ring)):
            self.mb.f([c, ring[i], ring[(i + 1) % len(ring)]], mat, self.head.c)

    def strip(self, top, bottom, off, mat):
        a = [self.pt(u, v, off) for u, v in top]
        b = [self.pt(u, v, off) for u, v in bottom]
        for i in range(len(a) - 1):
            self.mb.f([a[i], a[i + 1], b[i + 1], b[i]], mat, self.head.c)


def ellipse(cu, cv, a, b, n=14, flat_bottom=1.0, tilt=0.0):
    pts = []
    for k in range(n):
        t = 2 * math.pi * k / n
        u, v = a * math.cos(t), b * math.sin(t) * (1.0 if math.sin(t) >= 0 else flat_bottom)
        pts.append((cu + u, cv + v + u * tilt))
    return pts


def build_eye(mb, head, fe, s):
    """Ojo de ilustración: esclerótica blanca, iris grande oscuro, brillo blanco, párpado superior (y pestañas)."""
    d = Decal(mb, head, s * fe["phi"], fe["psi"], mirror=s)  # u > 0 = hacia fuera
    w, h, ri, tilt = fe["w"] / 2, fe["h"] / 2, fe["iris"], math.tan(fe.get("tilt", 0) * RAD)
    d.fan(ellipse(0, 0, w, h, 16, 0.8, tilt), 0.0010, "eyewhite")
    iris = []
    for k in range(14):
        t = 2 * math.pi * k / 14
        u, v = ri * math.cos(t), -h * 0.08 + ri * math.sin(t)
        lim = h * math.sqrt(max(0.0, 1 - (u / w) ** 2)) * 0.97
        iris.append((u, max(-lim * 0.8, min(lim, v)) + u * tilt))
    d.fan(iris, 0.0019, "eyes")
    hl = ri * 0.32
    hu = 0.32 * ri * s  # el brillo cae del mismo lado en los dos ojos (luz desde la izquierda de la cara)
    d.fan(ellipse(hu, h * 0.22, hl, hl, 8), 0.0027, "eyewhite")
    # Párpado superior: arco sobre la mitad de arriba, más grueso hacia fuera, con un pequeño rabillo.
    lid, n = fe["lid"], 10
    top, bot = [], []
    for k in range(n + 1):
        t = math.pi * (1 - k / n)  # de dentro (u < 0) a fuera
        u, v = w * 1.04 * math.cos(t), h * 1.02 * math.sin(t) + w * math.cos(t) * tilt
        thick = lid * (0.6 + 0.6 * k / n)
        bot.append((u, v))
        top.append((u, v + thick))
    top.append((w * 1.25, h * 0.15 + w * tilt + lid * 1.2))
    bot.append((w * 1.18, h * 0.05 + w * tilt))
    d.strip(top, bot, 0.0033, "eyes")
    if fe.get("lashes"):
        for k, (u0, ang, ln) in enumerate(((0.35, 55, 0.004), (0.65, 40, 0.0048), (0.92, 25, 0.005))):
            t = math.pi * (1 - u0)
            u, v = w * 1.04 * math.cos(t), h * 1.02 * math.sin(t) + w * math.cos(t) * tilt + lid
            a = ang * RAD
            tip = (u + ln * math.cos(a), v + ln * math.sin(a))
            d.fan([(u - 0.0012, v - 0.0004), tip, (u + 0.0012, v - 0.0002)], 0.0034, "eyes")


def build_brow(mb, head, fb, s):
    d = Decal(mb, head, s * fb["phi"], fb["psi"], mirror=s)
    bw, n = fb["width"] / 2, 9
    top, bot = [], []
    for k in range(n + 1):
        u = -bw + 2 * bw * k / n
        x = u / bw
        v = fb["arch"] * (1 - x * x) + fb["slope"] * u
        thick = fb["thick"] * (1.0 - 0.45 * max(0.0, x))  # se afina hacia fuera
        bot.append((u, v - thick / 2))
        top.append((u, v + thick / 2))
    d.strip(top, bot, 0.0022, fb["material"])


def build_mouth(mb, head, fm, lift):
    """Sonrisa: labio inferior en media luna con las comisuras hacia arriba, labio superior fino y línea de la boca."""
    d = Decal(mb, head, 0, fm["psi"], lift=lift)
    mw, n = fm["width"] / 2, 12
    line = [(u, fm["smile"] * (u / mw) ** 2) for u in (-mw + 2 * mw * k / n for k in range(n + 1))]
    lower = [(u, v - fm["lower"] * (1 - (u / mw) ** 2) ** 0.8) for u, v in line]
    upper = [(u, v + fm["upper"] * (1 - (u / mw) ** 2) ** 0.6 * (1 - 0.35 * math.exp(-((u / mw) * 6) ** 2))) for u, v in line]
    d.strip(line, lower, 0.0012, "mouth")
    if fm["upper"] > 0:
        d.strip(upper, line, 0.0012, "mouth")
    thin = [(u, v + 0.0006) for u, v in line]
    thin2 = [(u, v - 0.0006) for u, v in line]
    d.strip(thin, thin2, 0.0019, fm.get("lineMaterial", "eyes"))


def build_nose(mb, head, fn):
    w = {"Head": 1.0}

    def sp(phi_deg, psi_deg, out):
        p, n, _, _ = surface_frame(head, phi_deg * RAD, psi_deg * RAD)
        return mb.v(p + n * out, w)
    tip = sp(0, fn["tip"][0], fn["tip"][1])
    bridge = sp(0, fn["bridge"][0], fn["bridge"][1])
    base = sp(0, fn["base"][0], fn["base"][1])
    wl, wr = sp(fn["wing"][0], fn["wing"][1], 0.004), sp(-fn["wing"][0], fn["wing"][1], 0.004)
    bl, br = sp(fn["wing"][0] * 0.45, fn["bridge"][0] - 2, 0.001), sp(-fn["wing"][0] * 0.45, fn["bridge"][0] - 2, 0.001)
    inside = head.c
    for tri in ((bridge, bl, tip), (bridge, tip, br), (bl, wl, tip), (br, tip, wr), (wl, base, tip), (wr, tip, base)):
        mb.f(list(tri), "skin", inside)


def build_face(mb, spec, head, beard_t):
    w = {"Head": 1.0}
    f = spec["features"]
    for s in (1, -1):
        build_eye(mb, head, f["ojos"], s)
        build_brow(mb, head, f["cejas"], s)
        if "rubor" in f:
            fr = f["rubor"]
            Decal(mb, head, s * fr["phi"], fr["psi"], mirror=s).fan(ellipse(0, 0, fr["w"] / 2, fr["h"] / 2, 12), 0.0008, "blush")
        # Orejas
        p, n, tl, tu = surface_frame(head, s * 90 * RAD, -6 * RAD)
        kf = head.rz / 0.108
        ec = p + FWD * -0.012 + n * 0.004
        ellipsoid(mb, ec, n * 0.011 * kf, FWD * 0.021 * kf, Z * 0.031 * kf, "skin", w, 10, 6)
        # Pendientes: aro que atraviesa el lóbulo, girado 35° para leerse de frente y de lado.
        fe = f["pendientes"]
        R, r = fe["ringRadius"], fe["tubeRadius"]
        lobe = ec - Z * 0.027 * kf
        hc = lobe - Z * (R - 0.004) + n * 0.004
        axis = (n * math.cos(35 * RAD) + FWD * math.sin(35 * RAD)).normalized()
        u = Z
        v = axis.cross(u).normalized()
        nu_, nv_ = 14, 6
        rows = []
        for i in range(nu_):
            a = 2 * math.pi * i / nu_
            cdir = u * math.cos(a) + v * math.sin(a)
            rows.append([mb.v(hc + cdir * (R + r * math.cos(2 * math.pi * k / nv_)) + axis * (r * math.sin(2 * math.pi * k / nv_)), w) for k in range(nv_)])
        for i in range(nu_):
            i2 = (i + 1) % nu_
            a = 2 * math.pi * (i + 0.5) / nu_
            ring_c = hc + (u * math.cos(a) + v * math.sin(a)) * R
            for k in range(nv_):
                k2 = (k + 1) % nv_
                mb.f([rows[i][k], rows[i2][k], rows[i2][k2], rows[i][k2]], "earrings", ring_c)
    build_nose(mb, head, f["nariz"])
    build_mouth(mb, head, f["boca"], lambda phi, psi: beard_t(math.degrees(phi), psi))


# ── Pelo recogido (princess) ──

def tail_chain(spec, head):
    """Puntos de la coleta en reposo: atadura en la coronilla y tres segmentos (Tail.1-3)."""
    fh = spec["features"]["pelo"]
    phi, psi = fh["tie"][0] * RAD, fh["tie"][1] * RAD
    pts = [head.p(phi, psi) + head.n(phi, psi) * fh["capThickness"]]
    for lat, back, up, ln in fh["tail"]:
        pts.append(pts[-1] + Vector((lat, back, up)).normalized() * ln)
    return pts


def tube_along(mb, path, radii, sides, mat, weights, closed=True):
    """Tubo a lo largo de una polilínea (rizos, mechones) con radio por punto y pesos por punto."""
    rings = []
    prev_a = None
    for i, (c, r) in enumerate(zip(path, radii)):
        t = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        a = C.perp(prev_a if prev_a is not None else (X if abs(t.x) < 0.9 else Y), t).normalized()
        prev_a = a
        b = t.cross(a)
        idx = [mb.v(c + (a * math.cos(2 * math.pi * k / sides) + b * math.sin(2 * math.pi * k / sides)) * r, weights[i]) for k in range(sides)]
        rings.append((idx, mat, c, t))
    ring_band(mb, rings, closed, closed)


def helix(center_fn, axis_fn, n, turns, radius_fn, phase=0.0):
    """Puntos de una hélice alrededor de un eje curvo: center_fn(u), axis_fn(u) -> (tangente, normal)."""
    pts = []
    for k in range(n + 1):
        u = k / n
        c = center_fn(u)
        t, a = axis_fn(u)
        b = t.cross(a)
        ang = 2 * math.pi * turns * u + phase
        pts.append(c + (a * math.cos(ang) + b * math.sin(ang)) * radius_fn(u))
    return pts


def build_hair(mb, spec, head, tail):
    fh = spec["features"]["pelo"]
    T = fh["capThickness"]
    w = {"Head": 1.0}
    # Casquete liso (pelo recogido y tirante) con el borde afinado sobre la piel.
    nu, nv = 40, 10
    rows = []
    for i in range(nu):
        phi_deg = -180 + 360 * i / nu
        phi = phi_deg * RAD
        psi0 = head.psi_at_up(phi, lerp_table(fh["hairline"], abs(phi_deg)))
        col = []
        for k in range(nv):
            v = k / nv
            psi = psi0 + (math.pi / 2 - 0.05 - psi0) * v
            t = 0.0015 + (T - 0.0015) * C.smoothstep(0.0, 0.25, v)
            col.append(mb.v(head.p(phi, psi) + head.n(phi, psi) * t, w))
        rows.append(col)
    top = mb.v(head.p(0, math.pi / 2) + Z * (T + 0.002), w)
    for i in range(nu):
        i2 = (i + 1) % nu
        for k in range(nv - 1):
            mb.f([rows[i][k], rows[i2][k], rows[i2][k + 1], rows[i][k + 1]], "hair", head.c)
        mb.f([rows[i][nv - 1], rows[i2][nv - 1], top], "hair", head.c)
    # Rizos que enmarcan la cara: tirabuzón en cada sien y dos rizos en "C" en la frente.
    for s in (1, -1):
        phi = s * fh["tendril"][0] * RAD
        psi0 = head.psi_at_up(phi, fh["tendril"][1])
        p0 = head.p(phi, psi0) + head.n(phi, psi0) * (T * 0.6)
        out = head.n(phi, psi0)
        ln = fh["tendril"][2]
        axis = (Vector((0, 0, -1)) + out * 0.25 - FWD * 0.15).normalized()
        pts = helix(lambda u: p0 + axis * (ln * u), lambda u: (axis, C.perp(out, axis).normalized()), 22, 2.3, lambda u: 0.009 * (1 - 0.3 * u))
        tube_along(mb, pts, [0.0058 * (1 - 0.35 * k / len(pts)) for k in range(len(pts))], 6, "hair", [w] * len(pts))
        phi_c = s * fh["foreheadCurl"][0] * RAD
        psi_c = head.psi_at_up(phi_c, fh["foreheadCurl"][1])
        pc, nc = head.p(phi_c, psi_c), head.n(phi_c, psi_c)
        ax2 = (Vector((0, 0, -1)) + nc * 0.35 + X * (0.25 * s)).normalized()
        p1 = pc + nc * (T * 0.8)
        pts = helix(lambda u: p1 + ax2 * (fh["foreheadCurl"][2] * u), lambda u: (ax2, C.perp(nc, ax2).normalized()), 14, 1.4, lambda u: 0.007)
        tube_along(mb, pts, [0.005 * (1 - 0.3 * k / len(pts)) for k in range(len(pts))], 6, "hair", [w] * len(pts))
    # Coleta alta: núcleo cónico + dos hebras en hélice que dibujan 5-7 rizos grandes en cascada (Tail.1-3).
    lens = [(b - a).length for a, b in zip(tail, tail[1:])]
    L1, L2, total = lens[0], lens[0] + lens[1], sum(lens)
    ch = Chain(tail, soften=0.04)

    def wt(s):
        return blend([("Head", C.smoothstep(-0.01, 0.02, s)), ("Tail.1", C.smoothstep(L1 - 0.025, L1 + 0.025, s)),
                      ("Tail.2", C.smoothstep(L2 - 0.025, L2 + 0.025, s)), ("Tail.3", 1.0)])

    def core_r(s):
        u = s / total
        return 0.012 + 0.008 * math.sin(math.pi * min(1.0, u * 1.4)) - 0.004 * u

    n = 14
    ss = [-0.01 + (total + 0.01) * k / n for k in range(n + 1)]
    tube_along(mb, [ch.at(s)[0] for s in ss], [max(0.006, core_r(s)) for s in ss], 10, "hair", [wt(s) for s in ss])

    def axis_fn(u):
        c, t = ch.at(0.02 + (total - 0.02) * u)
        return t, C.perp(X, t).normalized()

    turns = fh["curls"] / 2
    for phase in (0.0,):
        m = 64
        pts = helix(lambda u: ch.at(0.02 + (total - 0.02) * u)[0], axis_fn, m, turns,
                    lambda u: core_r(0.02 + (total - 0.02) * u) * 0.8 + 0.016 * (1 - 0.4 * u), phase)
        rad = [0.019 * (1 - 0.45 * k / m) for k in range(m + 1)]
        tube_along(mb, pts, rad, 7, "hair", [wt(0.02 + (total - 0.02) * k / m) for k in range(m + 1)])
    # Goma beige en la atadura.
    c, t = ch.at(0.004)
    a = C.perp(X, t).normalized()
    b = t.cross(a)
    tor = []
    for i in range(10):
        th = 2 * math.pi * i / 10
        dd = a * math.cos(th) + b * math.sin(th)
        tor.append([mb.v(c + dd * (0.019 + 0.005 * math.cos(2 * math.pi * k / 5)) + t * (0.005 * math.sin(2 * math.pi * k / 5)), wt(0.004)) for k in range(5)])
    for i in range(10):
        i2 = (i + 1) % 10
        rc = c + (a * math.cos(2 * math.pi * (i + 0.5) / 10) + b * math.sin(2 * math.pi * (i + 0.5) / 10)) * 0.019
        for k in range(5):
            k2 = (k + 1) % 5
            mb.f([tor[i][k], tor[i2][k], tor[i2][k2], tor[i][k2]], "bottoms", rc)


# ── Tatuajes ──

def tri_wave(x):
    x = x % 1.0
    return 4 * x - 1 if x < 0.5 else 3 - 4 * x


def build_tattoos(mb, spec, chain, side, wfn):
    prof = spec["arm"]["profile"]
    off = spec["features"]["tatuajes"]["offset"]
    n = 32

    def pt(s, th):
        return limb_point(chain, prof, side, s, th, off)[0]

    def band(s_top, s_bot):
        top = [mb.v(pt(s_top(i / n), 2 * math.pi * i / n), wfn(s_top(i / n))) for i in range(n)]
        bot = [mb.v(pt(s_bot(i / n), 2 * math.pi * i / n), wfn(s_bot(i / n))) for i in range(n)]
        for i in range(n):
            i2 = (i + 1) % n
            mb.f([top[i], top[i2], bot[i2], bot[i]], "tattoo", chain.at((s_top(i / n) + s_bot(i / n)) / 2)[0])

    def blob(s0, th0, outline):
        """Figura plana (contorno en coordenadas (ds, d_arco) metros) centrada en (s0, th0)."""
        c, _, _ = limb_point(chain, prof, side, s0, th0, off)
        r = profile_at(prof, s0)[0]
        cv = mb.v(c, wfn(s0))
        ring = []
        for ds, darc in outline:
            ring.append(mb.v(pt(s0 + ds, th0 + darc / r), wfn(s0 + ds)))
        axis_c = chain.at(s0)[0]
        for i in range(len(ring)):
            mb.f([cv, ring[i], ring[(i + 1) % len(ring)]], "tattoo", axis_c)

    def star(rad_out, rad_in):
        return [((rad_out if k % 2 == 0 else rad_in) * math.cos(math.pi * k / 5), (rad_out if k % 2 == 0 else rad_in) * math.sin(math.pi * k / 5)) for k in range(10)]

    if spec["features"]["tatuajes"].get("estilo") == "estrella-muneca":
        if side == "L":
            blob(0.47, 75 * RAD, star(0.017, 0.0075))
        return
    # Banda tribal en zigzag bajo la manga (los dos brazos).
    band(lambda u: 0.178 + 0.009 * (tri_wave(u * 6) + 1) / 2, lambda u: 0.204 + 0.012 * (tri_wave(u * 6 + 0.5) + 1) / 2)
    if side == "R":
        band(lambda u: 0.372, lambda u: 0.386)
        band(lambda u: 0.494, lambda u: 0.506)
        for k in range(4):
            th = k * math.pi / 2 + math.pi / 4
            blob(0.44, th, [(0.034, 0), (0.017, 0.012), (0, 0.022), (-0.017, 0.012), (-0.034, 0), (-0.017, -0.012), (0, -0.022), (0.017, -0.012)])
    else:
        band(lambda u: 0.372, lambda u: 0.388)
        blob(0.455, 70 * RAD, star(0.03, 0.013))
        blob(0.455, -110 * RAD, star(0.03, 0.013))


# ── Zapatillas ──

SHOE = [(-0.088, 0.03, 0.07), (-0.082, 0.04, 0.095), (-0.06, 0.045, 0.118), (-0.03, 0.047, 0.125), (0.0, 0.048, 0.125),
        (0.04, 0.05, 0.108), (0.09, 0.052, 0.085), (0.14, 0.05, 0.068), (0.175, 0.044, 0.058), (0.196, 0.034, 0.048), (0.207, 0.02, 0.036)]


def build_shoe(mb, spec, j, side):
    fs = spec["features"]["zapatillas"]
    sole = fs["sole"]
    k = fs.get("scale", 1.0)
    sole_mat = fs.get("soleMaterial", "top")
    ankle = j["ankle" + side]
    s = C.SIDES[side]
    base = Vector((ankle.x, ankle.y, 0))
    rings = []
    for f, w, h in ((f * k, w * k, h * k) for f, w, h in SHOE):
        cz = h / 2
        # Ángulo en el que la superelipse cruza la altura de la suela: así la línea de suela queda recta.
        A = math.asin(max(0.0, 1 - sole / cz) ** (3.2 / 2))
        bottom = [math.pi + A + (math.pi - 2 * A) * k / 6 for k in range(7)]          # suela
        top = [2 * math.pi - A + (math.pi + 2 * A) * k / 10 for k in range(1, 10)]   # empeine
        idx = []
        mats = []
        cen = base + FWD * f + Z * cz
        for a in bottom + top:
            u = w * se(math.cos(a), 3.2)
            zz = cz + cz * se(math.sin(a), 3.2)
            p = base + FWD * f + X * (u * s) + Z * zz
            wgt = blend([("Foot." + side, C.smoothstep(0.1 * k, 0.15 * k, f)), ("Toe." + side, 1.0)])
            idx.append(mb.v(p, wgt))
            mats.append(zz <= sole + 1e-4)
        rings.append((idx, mats, cen))
    # Caras: suela (material top) cuando los dos vértices inferiores están a la altura de la suela o por debajo.
    for k in range(len(rings) - 1):
        a, ma, ca = rings[k]
        b, _, cb = rings[k + 1]
        n = len(a)
        for i in range(n):
            i2 = (i + 1) % n
            mat = sole_mat if (ma[i] and ma[i2]) else "shoes"
            mb.f([a[i], a[i2], b[i2], b[i]], mat, (ca + cb) / 2)
    for k, sgn in ((0, 1), (len(rings) - 1, -1)):
        idx, _, cen = rings[k]
        c = mb.v(cen, mb.w[idx[0]])
        for i in range(len(idx)):
            mb.f([idx[i], idx[(i + 1) % len(idx)], c], "shoes", cen + FWD * (0.01 * sgn))


# ── Pesas ──

def catmull(pts, n):
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            out.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1])
    return out


def build_bell_mesh(spec):
    b = spec["bell"]
    mb = MB()
    R, hang = b["bodyRadius"], b["hang"]
    c = Vector((0, 0, -hang))
    nu, nv = 20, 12
    rows = []
    for k in range(1, nv):
        v = -math.pi / 2 + math.pi * k / nv
        z = max(math.sin(v) * R, -R * b.get("flatBase", 0.9))
        rr = math.cos(v) * R
        rows.append([mb.v(c + Vector((rr * math.cos(2 * math.pi * i / nu), rr * math.sin(2 * math.pi * i / nu), z)), {}) for i in range(nu)])
    bot, top = mb.v(c + Vector((0, 0, -R * b.get("flatBase", 0.9))), {}), mb.v(c + Vector((0, 0, R)), {})
    for k in range(len(rows) - 1):
        for i in range(nu):
            i2 = (i + 1) % nu
            mb.f([rows[k][i], rows[k][i2], rows[k + 1][i2], rows[k + 1][i]], "bell", c)
    for i in range(nu):
        i2 = (i + 1) % nu
        mb.f([rows[0][i], rows[0][i2], bot], "bell", c)
        mb.f([rows[-1][i], rows[-1][i2], top], "bell", c)
    hw = b["handleHalfWidth"]
    zb = -hang + R * 0.7  # los cuernos nacen dentro del cuerpo
    ctrl = [(-hw * 0.8, zb), (-hw * 1.0, zb * 0.62), (-hw * 1.05, zb * 0.33), (-hw * 0.95, -0.012), (-hw * 0.62, 0.0), (0.0, 0.002)]
    ctrl = ctrl + [(-x, z) for x, z in reversed(ctrl[:-1])]
    path = catmull([Vector((x, 0, z)) for x, z in ctrl], 3)
    r = b["handleRadius"]
    rings = []
    for i, p in enumerate(path):
        t = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        nrm = Y.cross(t).normalized()
        idx = [mb.v(p + nrm * (r * math.cos(2 * math.pi * k / 8)) + Y * (r * math.sin(2 * math.pi * k / 8)), {}) for k in range(8)]
        rings.append((idx, "bellHandle", p, t))
    ring_band(mb, rings, closed_start=False, closed_end=False)
    return mb


def mesh_from(mb, name, materials):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in mb.co], [], mb.faces)
    names = []
    for m in mb.mats:
        if m not in names:
            names.append(m)
    for m in names:
        me.materials.append(materials[m])
    me.polygons.foreach_set("material_index", [names.index(m) for m in mb.mats])
    me.shade_smooth()
    me.validate(clean_customdata=False)
    me.update()
    return me


def main():
    a = C.args()
    cid = a["id"]
    spec_all = C.load_spec()
    spec = spec_all["characters"][cid]
    sk = spec["skeleton"]
    C.reset_scene()

    mats = {m: C.make_material(m, h) for m, h in spec["palette"].items() if not m.startswith("_")}
    for m in C.BELL_MATERIALS:
        mats[m] = C.make_material(m, spec_all["bell"]["palette"][m])

    bones = C.bones_for(spec)
    spec["torso"]["rings"] = refine(spec["torso"]["rings"])
    for part in ("leg", "arm"):
        spec[part]["profile"] = refine(spec[part]["profile"])
    j = rest_joints(sk)
    frames = rest_frames(sk, j)
    head = Head(spec, j["H"])
    tail = None
    if "pelo" in spec["features"]:
        tail = tail_chain(spec, head)
        for k in range(3):
            frames[f"Tail.{k + 1}"] = (tail[k], C.frame3(tail[k + 1] - tail[k], X), (tail[k + 1] - tail[k]).length)
    rig = build_rig(frames, bones)

    mb = MB()
    w_torso = torso_weights(sk, spec["height"] / 1.75)
    build_torso(mb, spec, w_torso)
    build_volumes(mb, spec, w_torso)
    for side in C.SIDES:
        leg = Chain([j["hip" + side], j["knee" + side], j["ankle" + side]])
        build_limb(mb, leg, spec["leg"], side, leg_weights(sk, side))
        arm = Chain([j["sh" + side], j["el" + side], j["wr" + side]])
        aw = arm_weights(sk, side)
        build_limb(mb, arm, spec["arm"], side, aw)
        build_hand(mb, spec, sk, j, side, aw)
        build_tattoos(mb, spec, arm, side, aw)
        build_shoe(mb, spec, j, side)
    build_head(mb, spec, head)
    beard_t = build_beard(mb, spec, head) if "barba" in spec["features"] else (lambda *_: 0.0)
    if tail:
        build_hair(mb, spec, head, tail)
    build_face(mb, spec, head, beard_t)

    me = mesh_from(mb, "Body", mats)
    body = bpy.data.objects.new("Body", me)
    bpy.context.scene.collection.objects.link(body)
    for name, _ in bones:
        body.vertex_groups.new(name=name)
    for vi, w in enumerate(mb.w):
        tot = sum(w.values())
        for bone, val in sorted(w.items(), key=lambda kv: -kv[1])[:4]:
            body.vertex_groups[bone].add([vi], val / tot, "REPLACE")
    body.parent = rig
    mod = body.modifiers.new("Rig", "ARMATURE")
    mod.object = rig

    bell_me = mesh_from(build_bell_mesh(spec_all), "Kettlebell", mats)
    for name in ("Kettlebell", "Kettlebell2"):
        ob = bpy.data.objects.new(name, bell_me)
        bpy.context.scene.collection.objects.link(ob)
        ob.rotation_mode = "QUATERNION"
        ob.location = (0.35 if name == "Kettlebell" else -0.35, -0.25, 0.165 + 0.095 * 0.9)

    tris = sum(len(p.vertices) - 2 for p in me.polygons) + 2 * sum(len(p.vertices) - 2 for p in bell_me.polygons)
    print(f"[build] {cid}: {len(me.vertices)} vértices, {tris} triángulos con pesas, {len(bones)} huesos")
    out = C.blend_path(cid)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    C.save(out)
    print(f"[build] guardado {out}")


if __name__ == "__main__":
    main()
