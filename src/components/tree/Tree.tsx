// Pohon 6 tahap — geometri persis docs/prototype/Belajar.dc.html (DESIGN-SYSTEM §6.7). Pohon tidak pernah layu.
import { memo } from 'react';
import { useReducedMotion } from '@/lib/hooks';

export interface TreeProps {
  /** 0 Biji … 5 Pohon berbuah */
  stage: number;
  bloom?: boolean;
  width?: number;
  height?: number;
  label?: string;
  still?: boolean;
  className?: string;
}

function TreeBase({ stage, bloom = false, width = 170, height = 160, label, still = false, className }: TreeProps) {
  const reduced = useReducedMotion();
  const quiet = still || reduced;
  const s = Math.max(0, Math.min(5, Math.floor(stage)));
  return (
    <svg width={width} height={height} viewBox="0 0 200 190" role="img" aria-label={label ?? 'Pohon'} className={className} focusable="false">
      <ellipse cx="100" cy="174" rx="86" ry="13" fill="var(--tree-ground)" />
      <ellipse cx="100" cy="171" rx="34" ry="7" fill="var(--tree-soil)" />
      {s === 0 && (
        <g>
          <ellipse cx="100" cy="165" rx="8" ry="5.5" fill="var(--tree-trunk)" />
          <path d="M100 160 Q103 154 107 153" fill="none" stroke="var(--tree-leaf-1)" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {s === 1 && (
        <g>
          <path d="M100 170 L100 146" stroke="var(--tree-leaf-3)" strokeWidth="4" strokeLinecap="round" />
          <path d="M100 150 C92 138 80 140 81 148 C84 155 95 154 100 150 Z" fill="var(--tree-leaf-1)" />
          <path d="M100 150 C108 138 120 140 119 148 C116 155 105 154 100 150 Z" fill="var(--tree-leaf-2)" />
        </g>
      )}
      {s === 2 && (
        <g>
          <path d="M100 170 L100 118" stroke="var(--tree-leaf-3)" strokeWidth="5" strokeLinecap="round" />
          <path d="M100 148 C90 136 74 138 75 147 C78 155 93 154 100 148 Z" fill="var(--tree-leaf-1)" />
          <path d="M100 136 C110 124 126 126 125 135 C122 143 107 142 100 136 Z" fill="var(--tree-leaf-2)" />
          <path d="M100 122 C92 108 78 110 79 119 C82 127 94 127 100 122 Z" fill="var(--tree-leaf-2)" />
          <path d="M100 120 C106 106 118 106 118 114 C116 121 106 122 100 120 Z" fill="var(--tree-leaf-1)" />
        </g>
      )}
      {s === 3 && (
        <g>
          <path d="M95 171 L97 116 L103 116 L105 171 Z" fill="var(--tree-trunk)" />
          <g>
            {!quiet && <animateTransform attributeName="transform" type="rotate" values="-1.2 100 170;1.2 100 170;-1.2 100 170" dur="5s" repeatCount="indefinite" />}
            <circle cx="100" cy="100" r="38" fill="var(--tree-leaf-2)" />
            <circle cx="88" cy="88" r="14" fill="var(--tree-leaf-1)" />
          </g>
        </g>
      )}
      {s >= 4 && (
        <g>
          <path d="M92 172 L95 110 Q100 104 105 110 L108 172 Z" fill="var(--tree-trunk)" />
          <path d="M100 132 L80 116 M100 126 L118 112" stroke="var(--tree-trunk)" strokeWidth="5" strokeLinecap="round" />
          <g>
            {!quiet && <animateTransform attributeName="transform" type="rotate" values="-1 100 172;1 100 172;-1 100 172" dur="5s" repeatCount="indefinite" />}
            <circle cx="68" cy="102" r="30" fill="var(--tree-leaf-3)" />
            <circle cx="132" cy="102" r="30" fill="var(--tree-leaf-3)" />
            <circle cx="100" cy="74" r="44" fill="var(--tree-leaf-2)" />
            <circle cx="84" cy="60" r="15" fill="var(--tree-leaf-1)" />
            {s >= 5 && (
              <g>
                <circle cx="72" cy="104" r="6" fill="var(--tree-fruit)" />
                <circle cx="128" cy="96" r="6" fill="var(--tree-fruit)" />
                <circle cx="112" cy="70" r="6" fill="var(--tree-fruit)" />
                <circle cx="90" cy="86" r="6" fill="var(--tree-fruit)" />
              </g>
            )}
          </g>
        </g>
      )}
      {bloom && (
        <g>
          <circle cx="150" cy="40" r="5" fill="var(--tree-flower)" /><circle cx="150" cy="40" r="2" fill="var(--n-0)" />
          <circle cx="48" cy="56" r="5" fill="var(--tree-flower)" /><circle cx="48" cy="56" r="2" fill="var(--n-0)" />
          <circle cx="160" cy="120" r="4" fill="var(--tree-flower)" />
        </g>
      )}
    </svg>
  );
}

export const Tree = memo(TreeBase);

/** Ikon level kebun harian (viewBox 24). level -1 = hari depan (titik). */
export function GardenIcon({ level, bloom = false, size = 22 }: { level: number; bloom?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {level <= 0 && <circle cx="12" cy="18" r="1.6" fill="var(--n-300)" />}
      {level === 1 && (
        <g>
          <path d="M12 21v-6" stroke="var(--tree-leaf-3)" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 16c-1-3-4-3.5-4.5-2 0 1.6 2.5 2.6 4.5 2zM12 16c1-3 4-3.5 4.5-2 0 1.6-2.5 2.6-4.5 2z" fill="var(--tree-leaf-1)" />
        </g>
      )}
      {level === 2 && (
        <g>
          <path d="M12 21v-7" stroke="var(--tree-trunk)" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="12" cy="11" r="5.5" fill="var(--tree-leaf-1)" />
        </g>
      )}
      {level === 3 && (
        <g>
          <path d="M12 22v-8" stroke="var(--tree-trunk)" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="12" cy="9.5" r="8" fill="var(--tree-leaf-2)" />
        </g>
      )}
      {bloom && level === 3 && <circle cx="15.5" cy="7" r="2.4" fill="var(--tree-flower)" />}
    </svg>
  );
}

export interface GardenDayProps {
  day: number;
  /** -1 = belum terjadi */
  level: number;
  bloom: boolean;
  selected: boolean;
  today: boolean;
  ariaLabel: string;
  onClick: () => void;
}

/** Sel kalender kebun (DESIGN-SYSTEM §5 GardenDay). */
export function GardenDay({ day, level, bloom, selected, today, ariaLabel, onClick }: GardenDayProps) {
  const future = level < 0;
  const base = 'flex h-12 flex-col items-center justify-center rounded-md border-2 p-0 transition-colors';
  const tone = selected
    ? 'border-brand-500 bg-primary-soft'
    : today
      ? 'border-dashed border-brand-300 bg-surface'
      : 'border-transparent bg-transparent';
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} aria-pressed={selected} className={`${base} ${tone} ${future ? 'text-n-400' : 'text-ink-muted'}`}>
      <GardenIcon level={level} bloom={bloom} />
      <span className="text-2xs font-bold">{day}</span>
    </button>
  );
}
