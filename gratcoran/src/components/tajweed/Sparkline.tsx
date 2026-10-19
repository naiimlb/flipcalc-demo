/**
 * Mini-courbe du score essai après essai (0 à 100 %, un seul axe fixe).
 * Couleurs validées : #059669 sur fond clair, #0f9f73 sur fond sombre.
 */
export function Sparkline({ scores, width = 88, height = 28 }: { scores: number[]; width?: number; height?: number }) {
  const pad = 5;
  const pts = scores.map((s, i) => {
    const x = scores.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (scores.length - 1);
    const y = pad + (1 - Math.max(0, Math.min(1, s))) * (height - 2 * pad);
    return { x, y, s, i };
  });
  const last = pts[pts.length - 1];
  const label = `Évolution du score : ${scores.map((s) => `${Math.round(s * 100)} %`).join(", ")}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label} className="shrink-0 text-[#059669] dark:text-[#0f9f73]">
      <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} className="stroke-line" strokeWidth={1} />
      {pts.length > 1 && (
        <polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {pts.map((p) => (
        <circle key={p.i} cx={p.x} cy={p.y} r={7} fill="transparent">
          <title>{`Essai ${p.i + 1} : ${Math.round(p.s * 100)} %`}</title>
        </circle>
      ))}
      {last && <circle cx={last.x} cy={last.y} r={4} fill="currentColor" stroke="rgb(var(--surface))" strokeWidth={2} />}
    </svg>
  );
}
