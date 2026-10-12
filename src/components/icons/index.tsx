// Ikon SVG dari prototipe (DESIGN-SYSTEM §8). viewBox 24, stroke currentColor, round.
// Ikon yang tidak ada di prototipe (Gear, Trash, Edit, Filter, Logout, dst.) mengikuti gaya Lucide stroke 1,9.
import type { ReactNode, SVGProps } from 'react';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
  strokeWidth?: number;
  /** Varian terisi (ikon navigasi aktif). */
  filled?: boolean;
  title?: string;
}

function make(name: string, draw: (filled: boolean) => ReactNode, opts: { sw?: number; fillMode?: 'stroke' | 'fill' } = {}) {
  const C = ({ size = 22, strokeWidth, filled = false, title, ...rest }: IconProps) => {
    const isFill = opts.fillMode === 'fill';
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={isFill || filled ? 'currentColor' : 'none'}
        stroke={isFill ? 'none' : 'currentColor'}
        strokeWidth={strokeWidth ?? opts.sw ?? 1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
        focusable="false"
        {...rest}
      >
        {title ? <title>{title}</title> : null}
        {draw(filled)}
      </svg>
    );
  };
  C.displayName = `Icon.${name}`;
  return C;
}

export const Icon = {
  Home: make('Home', () => <path d="M3.5 10.5L12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z" />),
  Plan: make('Plan', (f) => (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8.5 12l2.5 2.5 4.5-5" stroke={f ? 'var(--on-primary)' : 'currentColor'} fill="none" />
    </>
  )),
  Cap: make('Cap', () => (
    <>
      <path d="M2 9.5L12 4.5l10 5-10 5z" />
      <path d="M6 11.5v4.5c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.5" />
    </>
  )),
  Wallet: make('Wallet', (f) => (
    <>
      <path d="M19 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H5" />
      <circle cx="16.5" cy="14" r={f ? 1.4 : 1.2} fill={f ? 'var(--on-primary)' : 'currentColor'} stroke="none" />
    </>
  )),
  Sprout: make('Sprout', () => (
    <>
      <path d="M12 21v-9" />
      <path d="M12 12c0-4 3-7 8-7 0 5-3 8-8 7z" />
      <path d="M12 14c0-3-2.5-5.5-7-5.5 0 4 2.5 6 7 5.5z" />
    </>
  )),
  Calendar: make('Calendar', () => (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  )),
  Receipt: make('Receipt', () => (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  )),
  Target: make('Target', () => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </>
  )),
  TrendUp: make('TrendUp', () => (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  )),
  TrendDown: make('TrendDown', () => (
    <>
      <path d="M3 7l6 6 4-4 8 8" />
      <path d="M15 17h6v-6" />
    </>
  )),
  Book: make('Book', () => (
    <>
      <path d="M2.5 5.5h6a3.5 3.5 0 0 1 3.5 3.5v11a3 3 0 0 0-3-3H2.5z" />
      <path d="M21.5 5.5h-6A3.5 3.5 0 0 0 12 9v11a3 3 0 0 1 3-3h6.5z" />
    </>
  )),
  Repeat: make('Repeat', () => (
    <>
      <path d="M17 2l3 3-3 3" />
      <path d="M4 11V9a4 4 0 0 1 4-4h12" />
      <path d="M7 22l-3-3 3-3" />
      <path d="M20 13v2a4 4 0 0 1-4 4H4" />
    </>
  )),
  Eye: make('Eye', () => (
    <>
      <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  )),
  EyeOff: make('EyeOff', () => (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3 3.8M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 19 12 19c1.8 0 3.3-.5 4.6-1.2" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  )),
  Bell: make('Bell', () => (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  )),
  BellOff: make('BellOff', () => (
    <>
      <path d="M3 3l18 18" />
      <path d="M8.3 4.6A6 6 0 0 1 18 9c0 3 .6 4.9 1.2 6M15 16.5H3.5S6 15 6 9" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  )),
  Search: make('Search', () => (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  )),
  Sliders: make('Sliders', () => (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  )),
  Flame: make('Flame', () => <path d="M12 22c4 0 7-2.7 7-7 0-3.5-2.4-6-4-8-.3 2-1.3 3.4-2.6 4C12.5 7.6 11 4.5 8.5 2.5 8.5 6 5 9 5 15c0 4.3 3 7 7 7z" />, { fillMode: 'fill' }),
  Sparkle: make('Sparkle', () => (
    <>
      <path d="M12 2l1.8 5.6L19.5 9.5 13.8 11.4 12 17l-1.8-5.6L4.5 9.5l5.7-1.9z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </>
  ), { fillMode: 'fill' }),
  Plus: make('Plus', () => <path d="M12 5v14M5 12h14" />, { sw: 2.4 }),
  Minus: make('Minus', () => <path d="M5 12h14" />, { sw: 2.4 }),
  ChevronLeft: make('ChevronLeft', () => <path d="M15 18l-6-6 6-6" />, { sw: 2 }),
  ChevronRight: make('ChevronRight', () => <path d="M9 18l6-6-6-6" />, { sw: 2 }),
  ChevronDown: make('ChevronDown', () => <path d="M6 9l6 6 6-6" />, { sw: 2 }),
  ChevronUp: make('ChevronUp', () => <path d="M6 15l6-6 6 6" />, { sw: 2 }),
  ArrowRight: make('ArrowRight', () => <path d="M5 12h14M13 6l6 6-6 6" />, { sw: 2.2 }),
  ArrowUp: make('ArrowUp', () => <path d="M12 19V5M6 11l6-6 6 6" />, { sw: 2.2 }),
  ArrowDown: make('ArrowDown', () => <path d="M12 5v14M6 13l6 6 6-6" />, { sw: 2.2 }),
  Swap: make('Swap', () => (
    <>
      <path d="M7 4L3 8l4 4" />
      <path d="M3 8h14" />
      <path d="M17 20l4-4-4-4" />
      <path d="M21 16H7" />
    </>
  )),
  Play: make('Play', () => <path d="M7 4.5v15l12-7.5z" />, { fillMode: 'fill' }),
  Pause: make('Pause', () => (
    <>
      <rect x="6" y="4.5" width="4" height="15" rx="1.2" />
      <rect x="14" y="4.5" width="4" height="15" rx="1.2" />
    </>
  ), { fillMode: 'fill' }),
  Check: make('Check', () => <path d="M5 12.5l4.5 4.5L19 7.5" />, { sw: 2.4 }),
  X: make('X', () => <path d="M6 6l12 12M18 6L6 18" />, { sw: 2 }),
  Clip: make('Clip', () => <path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9" />, { sw: 2 }),
  Shield: make('Shield', () => (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  )),
  Lock: make('Lock', () => (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ), { sw: 2.2 }),
  Alert: make('Alert', () => (
    <>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </>
  ), { sw: 2 }),
  Clock: make('Clock', () => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  )),
  Timer: make('Timer', () => (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2h6" />
    </>
  ), { sw: 2 }),
  Gear: make('Gear', () => (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  )),
  Trash: make('Trash', () => (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </>
  )),
  Edit: make('Edit', () => (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  )),
  Filter: make('Filter', () => <path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" />),
  Logout: make('Logout', () => (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  )),
  Download: make('Download', () => (
    <>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  )),
  Upload: make('Upload', () => (
    <>
      <path d="M12 21V9" />
      <path d="M7 14l5-5 5 5" />
      <path d="M5 3h14" />
    </>
  )),
  Send: make('Send', () => <path d="M5 12h14M13 6l6 6-6 6" />, { sw: 2.2 }),
  Info: make('Info', () => (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  )),
  More: make('More', () => (
    <>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" />
    </>
  )),
  File: make('File', () => (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  )),
  Image: make('Image', () => (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-9 9" />
    </>
  )),
  Moon: make('Moon', () => <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />),
  Sun: make('Sun', () => (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  )),
  User: make('User', () => (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  )),
  Database: make('Database', () => (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
  )),
  Activity: make('Activity', () => <path d="M3 12h4l3-8 4 16 3-8h4" />),
  ThumbUp: make('ThumbUp', () => (
    <>
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
      <path d="M7 10l4-7a2 2 0 0 1 3 2l-1 4h6a2 2 0 0 1 2 2.3l-1.3 7A2 2 0 0 1 17.7 20H7" />
    </>
  )),
  ThumbDown: make('ThumbDown', () => (
    <>
      <path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1z" />
      <path d="M17 14l-4 7a2 2 0 0 1-3-2l1-4H5a2 2 0 0 1-2-2.3l1.3-7A2 2 0 0 1 6.3 4H17" />
    </>
  )),
  Drop: make('Drop', () => <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />),
  Undo: make('Undo', () => (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </>
  )),
  Backspace: make('Backspace', () => (
    <>
      <path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
      <path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
    </>
  )),
  Phone: make('Phone', () => (
    <>
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M11 18h2" />
    </>
  )),
  Battery: make('Battery', () => (
    <>
      <rect x="2" y="7" width="17" height="10" rx="2" />
      <path d="M22 11v2" />
      <path d="M6 10v4M9.5 10v4" />
    </>
  )),
} as const;

export type IconName = keyof typeof Icon;
