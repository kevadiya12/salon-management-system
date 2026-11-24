interface ReceptionMetricCardProps {
  label: string;
  value: number;
  detail: string;
  accent?: boolean;
}

function ReceptionMetricCard({
  label,
  value,
  detail,
  accent = false,
}: ReceptionMetricCardProps) {
  return (
    <article
      className={`rounded-2xl border p-5 sm:p-6 ${
        accent
          ? 'border-gold/25 bg-gold/[0.07]'
          : 'border-white/[0.09] bg-white/[0.025]'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-400">
        {label}
      </p>
      <p className="mt-4 font-serif text-4xl text-cream">{value}</p>
      <p className="mt-2 text-xs text-stone-500">{detail}</p>
    </article>
  );
}

export default ReceptionMetricCard;
