export default function Stamp({ children, rotate = "-rotate-6", size = "lg" }) {
  const dim = size === "lg" ? "w-32 h-32" : size === "md" ? "w-24 h-24" : "w-16 h-16";
  return (
    <div className="inline-block relative">
      <div className="absolute inset-0 bg-terracotta rounded-full blur-xl opacity-30" />
      <div
        className={`relative ${dim} rounded-full border-4 border-ink bg-parchment-100 flex items-center justify-center transform ${rotate} shadow-lg`}
      >
        <div className="absolute inset-2 rounded-full border-2 border-dashed border-ink opacity-40" />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}
