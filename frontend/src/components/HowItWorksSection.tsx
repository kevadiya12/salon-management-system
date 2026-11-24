import type { HomepageCopy } from '../types/homepage';
import SectionHeading from './SectionHeading';

interface HowItWorksSectionProps {
  copy: HomepageCopy['steps'];
}

function HowItWorksSection({ copy }: HowItWorksSectionProps) {
  return (
    <section
      aria-labelledby="how-it-works-title"
      className="mx-auto max-w-7xl px-6 py-20 sm:px-10 sm:py-24 lg:px-12"
      id="how-it-works"
    >
      <SectionHeading
        centered
        description={copy.description}
        eyebrow={copy.eyebrow}
        id="how-it-works-title"
        title={copy.title}
      />

      <div className="mt-12 grid gap-4 md:mt-16 md:grid-cols-3">
        {copy.items.map((item, index) => (
          <article
            className="group rounded-2xl border border-white/[0.09] bg-white/[0.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-gold/40 hover:bg-white/[0.04] sm:p-8"
            key={item.title}
          >
            <span className="font-serif text-3xl text-gold/75">
              0{index + 1}
            </span>
            <div className="mb-5 mt-7 h-px w-10 bg-gold/60 transition-all duration-300 group-hover:w-16" />
            <h3 className="text-lg font-medium text-cream">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-stone-400">
              {item.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default HowItWorksSection;
