// Motif pseudo-QR déterministe (seedé par l'id du billet) — purement
// visuel pour la maquette. Le vrai QR (qrcode.toDataURL, HMAC-SHA256) est
// généré côté ticket-service, cf. la démo réelle faite plus tôt dans le
// projet.
function seededGrid(seed: string, size: number): boolean[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const cells: boolean[] = [];
  for (let i = 0; i < size * size; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    cells.push((h >>> 24) % 3 !== 0);
  }
  return cells;
}

export function QrPlaceholder({ seed, size = 12 }: { seed: string; size?: number }) {
  const cells = seededGrid(seed, size);

  return (
    <div
      className="grid aspect-square w-full gap-[2px] rounded-lg bg-white p-3"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
    >
      {cells.map((filled, i) => (
        <div key={i} className={filled ? "bg-[#1a1a2e]" : "bg-white"} />
      ))}
    </div>
  );
}
