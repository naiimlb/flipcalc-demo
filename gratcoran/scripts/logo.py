"""Génère le logo SVG de Grat'Coran : un livre ouvert dont les pages forment une onde sonore."""
import sys

def quad(p0, c, p1, t):
    return tuple((1 - t) ** 2 * p0[i] + 2 * t * (1 - t) * c[i] + t ** 2 * p1[i] for i in range(2))

def y_on(seg, x):
    lo, hi = 0.0, 1.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if quad(*seg, mid)[0] < x: lo = mid
        else: hi = mid
    return quad(*seg, lo)[1]

def motif(scale=1.0, cx=256, cy=256):
    """Retourne les éléments SVG du motif (centré sur cx, cy)."""
    S = 256
    left = ((104, 344), (184, 322), (S, 372))
    right = ((S, 372), (328, 322), (408, 344))
    # positions et hauteurs des barres (onde) ; la barre centrale est le dos du livre
    xs = [132, 170, 208, 256, 304, 342, 380]
    hs = [74, 128, 178, 226, 150, 196, 96]
    w = 26
    out = []
    for x, h in zip(xs, hs):
        seg = left if x <= S else right
        base = (y_on(seg, x) if x != S else 372) - 18
        out.append(f'<rect x="{x - w/2:.1f}" y="{base - h:.1f}" width="{w}" height="{h}" rx="{w/2}" fill="#fff"/>')
    out.append(f'<path d="M{left[0][0]} {left[0][1]} Q{left[1][0]} {left[1][1]} {S} {left[2][1]} Q{right[1][0]} {right[1][1]} {right[2][0]} {right[2][1]}" fill="none" stroke="#fff" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>')
    out.append(f'<path d="M92 380 Q180 360 {S} 408 Q332 360 420 380" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>')
    body = "\n    ".join(out)
    # recentre verticalement le motif (boîte englobante ≈ y 128..415)
    dy = cy - 272
    return f'<g transform="translate({cx},{cy + 0}) scale({scale}) translate({-256},{-256 + dy / scale if scale else 0})">\n    {body}\n  </g>'

def svg(rounded=True, scale=1.0):
    rx = 'rx="116"' if rounded else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10b981"/>
      <stop offset=".5" stop-color="#0d9f9a"/>
      <stop offset="1" stop-color="#2563eb"/>
    </linearGradient>
    <radialGradient id="h" cx=".3" cy=".2" r=".9">
      <stop offset="0" stop-color="#fff" stop-opacity=".22"/>
      <stop offset=".6" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" {rx} fill="url(#g)"/>
  <rect width="512" height="512" {rx} fill="url(#h)"/>
  {motif(scale)}
</svg>
'''

if __name__ == "__main__":
    kind = sys.argv[1]
    if kind == "logo": print(svg(True, 1.0))
    elif kind == "square": print(svg(False, 1.0))
    elif kind == "maskable": print(svg(False, 0.78))
