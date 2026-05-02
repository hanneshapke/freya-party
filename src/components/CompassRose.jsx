export default function CompassRose({ size = 40, className = "" }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle
        cx="50"
        cy="50"
        r="35"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeDasharray="2 3"
      />
      <path d="M50 10 L55 50 L50 55 L45 50 Z" fill="currentColor" />
      <path d="M50 90 L45 50 L50 45 L55 50 Z" fill="currentColor" opacity="0.4" />
      <path d="M10 50 L50 45 L55 50 L50 55 Z" fill="currentColor" opacity="0.6" />
      <path d="M90 50 L50 55 L45 50 L50 45 Z" fill="currentColor" opacity="0.6" />
      <circle cx="50" cy="50" r="3" fill="currentColor" />
      <text
        x="50"
        y="8"
        textAnchor="middle"
        fontSize="8"
        fill="currentColor"
        fontFamily="serif"
      >
        N
      </text>
    </svg>
  );
}
