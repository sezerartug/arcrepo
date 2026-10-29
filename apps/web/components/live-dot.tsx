/** "Canlı" indicator; the dot only pulses when the user has not asked for reduced motion. */
export function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive">
      <span className="relative flex size-2.5" aria-hidden="true">
        <span className="absolute inline-flex size-full rounded-full bg-destructive opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
      </span>
      Canlı
    </span>
  );
}
