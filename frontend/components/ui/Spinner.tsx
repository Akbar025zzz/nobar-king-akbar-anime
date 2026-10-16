export function Spinner({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-2 border-white/15 border-t-accent-500 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
