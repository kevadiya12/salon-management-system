import { salonConfig } from '../config/salon';

interface SalonBrandProps {
  variant?: 'standard' | 'display';
}

function SalonBrand({ variant = 'standard' }: SalonBrandProps) {
  const isDisplay = variant === 'display';
  const markClassName = isDisplay
    ? 'h-12 w-12 text-2xl sm:h-14 sm:w-14 sm:text-3xl'
    : 'h-10 w-10 text-lg';

  return (
    <span className={`flex shrink-0 items-center ${isDisplay ? 'gap-4' : 'gap-3'}`}>
      <span
        aria-hidden="true"
        className={`flex items-center justify-center overflow-hidden rounded-full border border-gold/60 font-serif text-gold ${markClassName} ${
          isDisplay
            ? ''
            : 'transition duration-200 group-hover:bg-gold group-hover:text-charcoal'
        }`}
      >
        {salonConfig.logoUrl ? (
          <img
            alt=""
            className="h-full w-full object-contain"
            src={salonConfig.logoUrl}
          />
        ) : (
          salonConfig.name.charAt(0).toLocaleUpperCase()
        )}
      </span>
      <span className="leading-tight">
        <span
          className={
            isDisplay
              ? 'block font-serif text-xl tracking-[0.14em] text-cream sm:text-2xl'
              : 'block text-sm font-semibold tracking-[0.12em] text-cream'
          }
        >
          {salonConfig.name}
        </span>
        <span
          className={
            isDisplay
              ? 'mt-1 block text-[10px] font-medium uppercase tracking-[0.3em] text-gold sm:text-xs'
              : 'mt-1 block text-[10px] tracking-[0.28em] text-gold'
          }
        >
          Queue
        </span>
      </span>
    </span>
  );
}

export default SalonBrand;
