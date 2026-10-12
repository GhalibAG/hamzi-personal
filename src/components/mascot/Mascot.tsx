// Port 1:1 docs/prototype/Hamzi.dc.html (DESIGN-SYSTEM §6). Mata = SVG path hamzah (ء), bukan teks.
import { memo } from 'react';
import type { Mood } from '@common/lines.id.ts';
import { useReducedMotion } from '@/lib/hooks';
import { MOODS } from './moods';

export interface MascotProps {
  mood?: Mood;
  size?: number;
  /** Orientasi B: mata kanan dicerminkan. Default A. */
  mirror?: boolean;
  /** Tanpa animasi (dekoratif kecil, reduced motion, mode Minimal). */
  still?: boolean;
  /** Dekoratif → aria-hidden. Bila membawa pesan, beri `label`. */
  decorative?: boolean;
  className?: string;
}

const EYE = 'M16.6 6.4 C14.6 4.1 9.4 4.5 9.3 8.4 C9.2 11.8 12.9 12.7 16.3 12 Q12.4 15.6 7.6 18.9';

function MascotBase({ mood = 'calm', size = 76, mirror = false, still = false, decorative = true, className }: MascotProps) {
  const reduced = useReducedMotion();
  const quiet = still || reduced;
  const m = MOODS[mood] ?? MOODS.calm;

  const tf = (side: 'L' | 'R') => {
    const flip = side === 'R' && mirror ? -1 : 1;
    const rot = side === 'R' && mirror ? -m.r : m.r;
    const r = mood === 'worried' ? m.r * (side === 'L' ? -1 : 1) : rot;
    return `translate(${m.dx} ${m.dy}) rotate(${r}) scale(${m.sx * flip} ${m.sy}) translate(-12 -12)`;
  };
  const blink = m.blink && !quiet ? '1 1;1 1;1 0.1;1 1' : '1 1;1 1;1 1;1 1';
  const big = mood === 'excited' || mood === 'celebrate';
  const breathe = quiet ? '1;1;1' : big ? '1;1.05;1' : '1;1.018;1';
  const label = `Hamzi, maskot kucing, sedang ${m.name}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
    >
      <g transform="translate(100 196)">
        <g>
          {!quiet && (
            <animateTransform attributeName="transform" type="scale" values={breathe} dur={big ? '0.9s' : '4s'} repeatCount="indefinite" />
          )}
          <g transform="translate(-100 -196)">
            <path d="M150 178 C186 172 194 136 174 120" fill="none" stroke="var(--cat-fur-2)" strokeWidth="15" strokeLinecap="round" />
            <path d="M174 120 C170 116 166 116 164 119" fill="none" stroke="var(--cat-shade)" strokeWidth="15" strokeLinecap="round" />
            <ellipse cx="100" cy="182" rx="56" ry="36" fill="var(--cat-fur)" />
            <ellipse cx="100" cy="198" rx="44" ry="12" fill="var(--cat-shade)" />
            <path d="M40 72 C30 42 34 20 47 22 C60 24 74 38 84 48 Z" fill="var(--cat-fur)" />
            <path d="M49 60 C44 45 46 33 52 34 C59 36 66 43 72 50 Z" fill="var(--cat-ear)" />
            <g transform="translate(200 0) scale(-1 1)">
              <path d="M40 72 C30 42 34 20 47 22 C60 24 74 38 84 48 Z" fill="var(--cat-fur)" />
              <path d="M49 60 C44 45 46 33 52 34 C59 36 66 43 72 50 Z" fill="var(--cat-ear)" />
            </g>
            <ellipse cx="100" cy="96" rx="72" ry="60" fill="var(--cat-fur)" />
            <path d="M92 40 Q100 52 108 40 M80 44 Q84 52 88 46 M112 46 Q116 52 120 44" fill="none" stroke="var(--cat-shade)" strokeWidth="5" strokeLinecap="round" />
            <ellipse cx="100" cy="146" rx="46" ry="9" fill="var(--cat-shade)" opacity="0.6" />
            <path d="M50 146 Q100 166 150 146 L148 160 Q100 180 52 160 Z" fill="var(--cat-scarf)" />
            <path d="M52 153 Q100 172 149 153" fill="none" stroke="var(--cat-scarf-line)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M58 160 L46 182 L60 178 Z M62 160 L64 184 L72 174 Z" fill="var(--cat-scarf-knot)" />
            <circle cx="60" cy="158" r="8" fill="var(--cat-scarf)" />
            <circle cx="56" cy="114" r="11" fill="var(--cat-ear)" opacity="0.42" />
            <circle cx="144" cy="114" r="11" fill="var(--cat-ear)" opacity="0.42" />
            <g stroke="var(--cat-ink)" strokeWidth="1.6" strokeLinecap="round" opacity="0.4">
              <path d="M44 106 L18 102 M44 112 L16 114 M46 118 L22 126" />
              <path d="M156 106 L182 102 M156 112 L184 114 M154 118 L178 126" />
            </g>
            {m.brow !== undefined && (
              <>
                <path d={`M58 70 L82 ${m.brow}`} fill="none" stroke="var(--cat-ink)" strokeWidth="3" strokeLinecap="round" />
                <path d={`M142 70 L118 ${m.brow}`} fill="none" stroke="var(--cat-ink)" strokeWidth="3" strokeLinecap="round" />
              </>
            )}
            {(['L', 'R'] as const).map((side) => (
              <g key={side} transform={side === 'L' ? 'translate(72 90)' : 'translate(128 90)'}>
                <g>
                  {!quiet && m.blink && (
                    <animateTransform attributeName="transform" type="scale" values={blink} keyTimes="0;0.93;0.96;1" dur="4.6s" repeatCount="indefinite" />
                  )}
                  <g transform={tf(side)}>
                    <path d={EYE} fill="none" stroke="var(--cat-ink)" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </g>
              </g>
            ))}
            <path d="M95 106 L105 106 L100 112 Z" fill="var(--cat-nose)" stroke="var(--cat-nose)" strokeWidth="2.5" strokeLinejoin="round" />
            <path d={m.mouth} fill={m.fill ? 'var(--cat-ink)' : 'none'} stroke="var(--cat-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            {mood === 'excited' && (
              <g>
                <path d="M158 52 L161 61 L170 64 L161 67 L158 76 L155 67 L146 64 L155 61 Z" fill="var(--spark-1)" />
                <path d="M40 40 L42 45 L47 47 L42 49 L40 54 L38 49 L33 47 L38 45 Z" fill="var(--spark-2)" />
              </g>
            )}
            {mood === 'sleeping' && (
              <g fill="var(--brand-700)" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800">
                <text x="150" y="52" fontSize="18">
                  z{!quiet && <animate attributeName="opacity" values="0.2;1;0.2" dur="2.4s" repeatCount="indefinite" />}
                </text>
                <text x="166" y="32" fontSize="24">
                  Z{!quiet && <animate attributeName="opacity" values="1;0.2;1" dur="2.4s" repeatCount="indefinite" />}
                </text>
              </g>
            )}
            {mood === 'celebrate' && (
              <g>
                <rect x="26" y="30" width="8" height="14" rx="2" fill="var(--mod-target-bar)" transform="rotate(-20 30 37)" />
                <rect x="164" y="26" width="8" height="14" rx="2" fill="var(--mod-rencana-bar)" transform="rotate(25 168 33)" />
                <circle cx="178" cy="70" r="5" fill="var(--mod-invest-bar)" />
                <circle cx="20" cy="76" r="5" fill="var(--brand-500)" />
                <rect x="140" y="8" width="7" height="12" rx="2" fill="var(--mod-kuliah-bar)" transform="rotate(40 143 14)" />
                <rect x="54" y="6" width="7" height="12" rx="2" fill="var(--danger)" transform="rotate(-35 57 12)" />
              </g>
            )}
          </g>
        </g>
      </g>
    </svg>
  );
}

export const Mascot = memo(MascotBase);
