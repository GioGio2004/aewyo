// Hand-authored kitchen elevation with CAD dimension lines (scale 0.16 px/mm).
// Draw-in animation lives in globals.css (.bp .s / .d / .t); static under
// prefers-reduced-motion. Decorative — hidden from the accessibility tree.
export default function Blueprint({ className }: { className?: string }) {
  const s = {
    stroke: "#1C1917",
    strokeWidth: 1,
    fill: "none",
    vectorEffect: "non-scaling-stroke",
  } as const;
  return (
    <svg
      viewBox="0 0 560 400"
      className={`bp ${className ?? ""}`}
      aria-hidden="true"
      focusable="false"
    >
      {/* structure */}
      <g strokeOpacity={0.32}>
        {/* floor */}
        <line className="s" pathLength={1} x1={56} y1={330} x2={504} y2={330} {...s} strokeOpacity={0.5} style={{ animationDelay: "0.1s" }} />
        {/* base cabinets */}
        <rect className="s" pathLength={1} x={88} y={215} width={384} height={115} {...s} style={{ animationDelay: "0.25s" }} />
        <line className="s" pathLength={1} x1={184} y1={215} x2={184} y2={330} {...s} style={{ animationDelay: "0.4s" }} />
        <line className="s" pathLength={1} x1={280} y1={215} x2={280} y2={330} {...s} style={{ animationDelay: "0.45s" }} />
        <line className="s" pathLength={1} x1={376} y1={215} x2={376} y2={330} {...s} style={{ animationDelay: "0.5s" }} />
        {/* countertop */}
        <rect className="s" pathLength={1} x={84} y={207} width={392} height={8} {...s} style={{ animationDelay: "0.35s" }} />
        {/* wall cabinets */}
        <rect className="s" pathLength={1} x={88} y={15} width={184} height={96} {...s} style={{ animationDelay: "0.55s" }} />
        <rect className="s" pathLength={1} x={288} y={15} width={184} height={96} {...s} style={{ animationDelay: "0.6s" }} />
        <line className="s" pathLength={1} x1={180} y1={15} x2={180} y2={111} {...s} style={{ animationDelay: "0.65s" }} />
        <line className="s" pathLength={1} x1={380} y1={15} x2={380} y2={111} {...s} style={{ animationDelay: "0.7s" }} />
      </g>

      {/* dimension lines */}
      <g strokeOpacity={0.4}>
        {/* overall width 2400 */}
        <line className="d" pathLength={1} x1={88} y1={336} x2={88} y2={368} {...s} style={{ animationDelay: "0.8s" }} />
        <line className="d" pathLength={1} x1={472} y1={336} x2={472} y2={368} {...s} style={{ animationDelay: "0.8s" }} />
        <line className="d" pathLength={1} x1={92} y1={360} x2={468} y2={360} {...s} style={{ animationDelay: "0.9s" }} />
        <path className="d" pathLength={1} d="M98 357 L92 360 L98 363" {...s} style={{ animationDelay: "1s" }} />
        <path className="d" pathLength={1} d="M462 357 L468 360 L462 363" {...s} style={{ animationDelay: "1s" }} />
        {/* base + counter height 760 */}
        <line className="d" pathLength={1} x1={478} y1={207} x2={510} y2={207} {...s} style={{ animationDelay: "0.85s" }} />
        <line className="d" pathLength={1} x1={478} y1={330} x2={510} y2={330} {...s} style={{ animationDelay: "0.85s" }} />
        <line className="d" pathLength={1} x1={502} y1={211} x2={502} y2={326} {...s} style={{ animationDelay: "0.95s" }} />
        <path className="d" pathLength={1} d="M499 217 L502 211 L505 217" {...s} style={{ animationDelay: "1.05s" }} />
        <path className="d" pathLength={1} d="M499 320 L502 326 L505 320" {...s} style={{ animationDelay: "1.05s" }} />
        {/* wall cabinet height 600 */}
        <line className="d" pathLength={1} x1={82} y1={15} x2={52} y2={15} {...s} style={{ animationDelay: "0.85s" }} />
        <line className="d" pathLength={1} x1={82} y1={111} x2={52} y2={111} {...s} style={{ animationDelay: "0.85s" }} />
        <line className="d" pathLength={1} x1={58} y1={19} x2={58} y2={107} {...s} style={{ animationDelay: "0.95s" }} />
        <path className="d" pathLength={1} d="M55 25 L58 19 L61 25" {...s} style={{ animationDelay: "1.05s" }} />
        <path className="d" pathLength={1} d="M55 101 L58 107 L61 101" {...s} style={{ animationDelay: "1.05s" }} />
      </g>

      {/* mm labels — the accent's second (and last) appearance */}
      <g
        className="t"
        style={{ animationDelay: "1.15s" }}
        fill="#5E4634"
        fontSize={11}
        letterSpacing="0.08em"
      >
        <text x={280} y={353} textAnchor="middle">
          2400
        </text>
        <text
          x={494}
          y={268}
          textAnchor="middle"
          transform="rotate(-90 494 268)"
        >
          760
        </text>
        <text x={50} y={63} textAnchor="middle" transform="rotate(-90 50 63)">
          600
        </text>
      </g>
    </svg>
  );
}
