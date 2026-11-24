interface SectionHeadingProps {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  centered?: boolean;
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  centered = false,
}: SectionHeadingProps) {
  return (
    <div className={centered ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
        {eyebrow}
      </p>
      <h2
        className="mt-4 font-serif text-3xl leading-tight tracking-tight text-cream sm:text-4xl lg:text-5xl"
        id={id}
      >
        {title}
      </h2>
      <p className="mt-4 text-sm leading-7 text-stone-400 sm:text-base">
        {description}
      </p>
    </div>
  );
}

export default SectionHeading;
