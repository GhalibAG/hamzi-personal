// Grup Pengaturan (UI-SPEC §11, DESIGN-SYSTEM §9 rute /pengaturan/*).
import { Icon } from '@/components/icons';
import type { ModTone } from '@/components/ui';

export type GroupPath = 'profil' | 'tampilan' | 'notifikasi' | 'akademik' | 'keuangan' | 'tumbuh' | 'privasi-ai' | 'data' | 'diagnostik';

export interface SettingsGroup {
  path: GroupPath;
  label: string;
  desc: string;
  icon: (typeof Icon)[keyof typeof Icon];
  tone: ModTone;
}

export const GROUPS: SettingsGroup[] = [
  { path: 'profil', label: 'Profil', desc: 'Nama panggilan', icon: Icon.User, tone: 'keuangan' },
  { path: 'tampilan', label: 'Tampilan', desc: 'Tema, mode Minimal, nominal, mata Hamzi', icon: Icon.Sun, tone: 'target' },
  { path: 'notifikasi', label: 'Notifikasi', desc: 'Izin, baterai, jenis pengingat, jam tenang', icon: Icon.Bell, tone: 'rutin' },
  { path: 'akademik', label: 'Akademik', desc: 'Skala nilai, total SKS, target IPK', icon: Icon.Cap, tone: 'kuliah' },
  { path: 'keuangan', label: 'Keuangan', desc: 'Awal siklus anggaran, kategori', icon: Icon.Wallet, tone: 'keuangan' },
  { path: 'tumbuh', label: 'Tumbuh', desc: 'Pohon & timer fokus', icon: Icon.Sprout, tone: 'belajar' },
  { path: 'privasi-ai', label: 'Privasi AI', desc: 'AI aktif, chat, data yang dikirim', icon: Icon.Shield, tone: 'invest' },
  { path: 'data', label: 'Data', desc: 'Export, impor, pengingat backup', icon: Icon.Database, tone: 'rencana' },
  { path: 'diagnostik', label: 'Diagnostik', desc: 'Versi, status push, jumlah data', icon: Icon.Activity, tone: 'rencana' },
];

/** Versi app (sinkron dengan package.json; bisa ditimpa VITE_APP_VERSION saat build). */
export const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.1.0';
