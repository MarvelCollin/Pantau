import math, sys

def eye(w, pupil_r, pupil_y, apex=(128, 62), half=100, base_y=None, ctrl_y=230):
    r = w / 2
    ax, ay = apex
    by = base_y if base_y is not None else ay + half
    A, P, B, C = (ax - half, by), (ax, ay), (ax + half, by), (ax, ctrl_y)
    s = math.sqrt(0.5)
    nl, nr = (-s, -s), (s, -s)
    def off(p, n, d): return (p[0] + n[0] * d, p[1] + n[1] * d)
    tb = (C[0] - B[0], C[1] - B[1]); L = math.hypot(*tb); tb = (tb[0] / L, tb[1] / L)
    nb = (-tb[1], tb[0])
    if nb[1] < 0: nb = (-nb[0], -nb[1])
    na = (-nb[0], nb[1])
    o1, o2, o3, o4 = off(A, nl, r), off(P, nl, r), off(P, nr, r), off(B, nr, r)
    o5, o6 = off(B, nb, r), off(A, na, r)
    t = (o5[0] - (ax), 0)
    k = (C[1] - B[1]) / (C[0] - B[0])
    cy_out = o5[1] + k * (ax - o5[0])
    outer = (f"M{o1[0]:.2f} {o1[1]:.2f}L{o2[0]:.2f} {o2[1]:.2f}A{r} {r} 0 0 1 {o3[0]:.2f} {o3[1]:.2f}"
             f"L{o4[0]:.2f} {o4[1]:.2f}A{r} {r} 0 0 1 {o5[0]:.2f} {o5[1]:.2f}"
             f"Q{ax} {cy_out:.2f} {o6[0]:.2f} {o6[1]:.2f}A{r} {r} 0 0 1 {o1[0]:.2f} {o1[1]:.2f}Z")
    apex_in_y = ay + r / s
    nin = (-nb[0], -nb[1])
    pa = (A[0] - na[0] * r, A[1] - na[1] * r)
    kl = (C[1] - A[1]) / (C[0] - A[0])
    c_in = pa[1] + kl * (ax - pa[0])
    t_ = ((-(pa[0]) + (ax + apex_in_y - ax) ) - pa[1])
    tt = ((apex_in_y + ax) - pa[0] - pa[1]) / ((C[0] - A[0]) / math.hypot(C[0]-A[0], C[1]-A[1]) + (C[1] - A[1]) / math.hypot(C[0]-A[0], C[1]-A[1]))
    dx = (C[0] - A[0]) / math.hypot(C[0]-A[0], C[1]-A[1]); dy = (C[1] - A[1]) / math.hypot(C[0]-A[0], C[1]-A[1])
    pl = (pa[0] + dx * tt, pa[1] + dy * tt)
    pr = (2 * ax - pl[0], pl[1])
    inner = f"M{ax} {apex_in_y:.2f}L{pr[0]:.2f} {pr[1]:.2f}Q{ax} {c_in:.2f} {pl[0]:.2f} {pl[1]:.2f}Z"
    pupil = f"M{ax - pupil_r} {pupil_y}a{pupil_r} {pupil_r} 0 1 0 {2 * pupil_r} 0a{pupil_r} {pupil_r} 0 1 0 {-2 * pupil_r} 0Z"
    bottom_out = 0.25 * o5[1] + 0.5 * cy_out + 0.25 * o6[1]
    bottom_in = 0.25 * pl[1] + 0.5 * c_in + 0.25 * pr[1]
    return outer + inner, pupil, dict(top=ay - r, bottom=bottom_out, inner_top=apex_in_y, inner_bottom=bottom_in, left=o1[0] - r * 0.3)

def svg(lid, pupil, lid_color="#000", pupil_color="#000", bg=None, size=256, transform=""):
    bgr = f'<rect width="256" height="256" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="{size}" height="{size}">{bgr}'
            f'<g{(" transform=" + chr(34) + transform + chr(34)) if transform else ""}><path fill="{lid_color}" fill-rule="evenodd" d="{lid}"/>'
            f'<path fill="{pupil_color}" d="{pupil}"/></g></svg>\n')

if __name__ == "__main__":
    lid, pupil, m = eye(22, 25, 149)
    print("regular", {k: round(v, 1) for k, v in m.items()})
    shift = 128 - (m["top"] + m["bottom"]) / 2 - 3
    open("final/pantau-symbol-black.svg", "w").write(svg(lid, pupil, transform=f"translate(0 {shift:.2f})"))
    lid_s, pupil_s, ms = eye(32, 30, 147)
    print("small", {k: round(v, 1) for k, v in ms.items()})
    shift_s = 128 - (ms["top"] + ms["bottom"]) / 2 - 3
    open("final/pantau-symbol-small-black.svg", "w").write(svg(lid_s, pupil_s, transform=f"translate(0 {shift_s:.2f})"))
