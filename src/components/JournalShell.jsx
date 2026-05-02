export default function JournalShell({ children }) {
  return (
    <div className="min-h-screen relative bg-parchment-50 text-ink">
      <div className="paper-noise" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
