interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  gold?: boolean;
}

export function StatCard({ label, value, sub, accent, gold }: StatCardProps) {
  return (
    <div className="card p-5">
      <p className="text-xs font-bold text-nictm-600 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-4xl font-extrabold leading-none
        ${accent ? "text-nictm-800" : gold ? "text-nictm-gold" : "text-nictm-950"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-nictm-600 mt-2">{sub}</p>}
    </div>
  );
}
