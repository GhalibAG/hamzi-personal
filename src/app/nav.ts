import { Icon } from '@/components/icons';

export const TABS = [
  { to: '/', label: 'Beranda', icon: Icon.Home, match: (p: string) => p === '/' },
  { to: '/rencana', label: 'Rencana', icon: Icon.Plan, match: (p: string) => p.startsWith('/rencana') || p.startsWith('/cari') },
  { to: '/kuliah', label: 'Kuliah', icon: Icon.Cap, match: (p: string) => p.startsWith('/kuliah') },
  { to: '/keuangan', label: 'Keuangan', icon: Icon.Wallet, match: (p: string) => p.startsWith('/keuangan') },
  { to: '/tumbuh', label: 'Tumbuh', icon: Icon.Sprout, match: (p: string) => p.startsWith('/tumbuh') },
] as const;

/** Rute tanpa navigasi bawah di HP (layar penuh). */
export function hideBottomNav(path: string): boolean {
  return path.startsWith('/chat') || path.startsWith('/tumbuh/sesi') || path.startsWith('/masuk') || path.startsWith('/onboarding');
}
