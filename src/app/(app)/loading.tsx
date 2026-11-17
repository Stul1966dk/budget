// Vises med det samme, når man skifter fane, mens serveren henter data til
// den nye side. Menuen ligger i layoutet og bliver derfor stående.
export default function Loading() {
  return (
    <div
      className="w-full animate-pulse px-4 py-6 sm:px-6 lg:px-8"
      role="status"
      aria-label="Henter side"
    >
      <div className="h-7 w-40 rounded-lg bg-white/25" />
      <div className="mt-2 h-4 w-full max-w-xl rounded bg-white/15" />
      <div className="mt-1.5 h-4 w-2/3 max-w-md rounded bg-white/15" />

      <div className="mt-5 h-12 w-56 rounded-xl bg-white/30" />

      <div className="mt-5 space-y-2 rounded-xl bg-white/20 p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-5 rounded bg-white/25" />
        ))}
      </div>
    </div>
  );
}
