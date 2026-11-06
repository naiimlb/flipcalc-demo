import { WORDMARK_PATH, WORDMARK_VIEWBOX } from './wordmark-path';

/** « #HASHTAG® » officiel, vectorisé depuis le logo (blanc par défaut). */
export function Wordmark({ className = '', color = '#fff' }: { className?: string; color?: string }) {
  return (
    <svg viewBox={WORDMARK_VIEWBOX} className={className} role="img" aria-label="#HASHTAG">
      <path d={WORDMARK_PATH} fill={color} fillRule="evenodd" />
    </svg>
  );
}

/** Petit caddie dessiné « au pinceau » : traits épais, bouts ronds, légèrement irréguliers. */
export function BrushCart({ className = '', color = '#0a0a0b' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 64 56" className={className} aria-hidden="true">
      <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5c3.2-.8 6.4-1 9.6-.6l7 24.6c9.5.4 19.4-.3 29.2-1.6" strokeWidth="5.2" />
        <path d="M13.8 14.6c13.6-.9 27.6-1.4 43.4-.6-2.2 5.6-4.4 10.4-7 15.4" strokeWidth="4.6" />
        <path d="M22 22.2c8.8-.5 17.6-.6 26.8-.2" strokeWidth="3.2" opacity=".9" />
      </g>
      <circle cx="25" cy="45" r="5" fill={color} />
      <circle cx="46.5" cy="44.2" r="5" fill={color} />
    </svg>
  );
}

/**
 * Logo décliné en version COURSES : le « #HASHTAG® » blanc identique au logo,
 * et « COURSES. » manuscrit noir (au lieu de « BANGERS. ») avec un caddie au pinceau.
 */
export function CoursesLogo({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const widths = { sm: 'w-[132px]', md: 'w-[188px]', lg: 'w-[250px]', xl: 'w-[300px]' } as const;
  const script = { sm: 'text-[21px]', md: 'text-[30px]', lg: 'text-[40px]', xl: 'text-[48px]' } as const;
  const cart = { sm: 'w-[22px]', md: 'w-[31px]', lg: 'w-[41px]', xl: 'w-[49px]' } as const;
  return (
    <div className={`relative inline-flex flex-col items-stretch ${widths[size]} ${className}`} aria-label="#HASHTAG COURSES.">
      <Wordmark className="block w-full h-auto drop-shadow-[0_2px_0_rgba(120,0,50,0.25)]" />
      <div className="flex items-end justify-end -mt-[0.32em] pr-[2%] leading-none" style={{ fontSize: 'inherit' }}>
        <span
          className={`font-marker ${script[size]} text-ink leading-none -rotate-[4deg] tracking-[0.02em] translate-y-[2px]`}
          aria-hidden="true"
        >
          COURSES.
        </span>
        <BrushCart className={`${cart[size]} ml-[0.2em] -rotate-[8deg] translate-y-[1px]`} />
      </div>
    </div>
  );
}
