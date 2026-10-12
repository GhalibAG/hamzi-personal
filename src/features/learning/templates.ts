// Templat modul belajar (BEL-09). Judul unit siap pakai; estimasi 30 mnt per unit.
import type { LearningUnit } from '@/data/types';

export interface ModuleTemplate {
  key: string;
  title: string;
  category: 'pemrograman' | 'basis_data' | 'statistik' | 'bahasa' | 'sertifikasi' | 'kuliah' | 'lainnya';
  units: { title: string; kind: LearningUnit['kind'] }[];
}

const b = (title: string): ModuleTemplate['units'][number] => ({ title, kind: 'bacaan' });
const v = (title: string): ModuleTemplate['units'][number] => ({ title, kind: 'video' });
const l = (title: string): ModuleTemplate['units'][number] => ({ title, kind: 'latihan' });
const p = (title: string): ModuleTemplate['units'][number] => ({ title, kind: 'proyek' });
const k = (title: string): ModuleTemplate['units'][number] => ({ title, kind: 'kuis' });

export const MODULE_TEMPLATES: ModuleTemplate[] = [
  {
    key: 'dasar-web', title: 'Dasar Web', category: 'pemrograman',
    units: [
      b('HTML: struktur dokumen'), b('HTML: teks, tautan & gambar'), l('HTML: form & tabel'), v('CSS: selector & box model'),
      l('CSS: flexbox'), l('CSS: grid'), b('Desain responsif'), b('JavaScript: variabel & tipe data'),
      l('JavaScript: fungsi & kondisi'), l('DOM & event'), b('Fetch API & JSON'), p('Proyek: halaman portofolio'),
    ],
  },
  {
    key: 'sql-basis-data', title: 'SQL & Basis Data', category: 'basis_data',
    units: [
      b('Konsep basis data relasional'), l('SELECT dasar'), l('Filter & urut'), l('Agregasi & GROUP BY'),
      l('JOIN antar tabel'), l('Subquery'), b('DDL: CREATE & ALTER'), b('Indeks'),
      b('Normalisasi'), b('Transaksi & ACID'), l('View & fungsi'), p('Studi kasus: basis data toko'),
    ],
  },
  {
    key: 'statistika-dasar', title: 'Statistika Dasar', category: 'statistik',
    units: [
      b('Jenis data & skala pengukuran'), l('Ukuran pemusatan'), l('Ukuran penyebaran'), b('Visualisasi data'),
      l('Peluang dasar'), b('Distribusi normal'), b('Sampling & distribusi sampling'), l('Interval kepercayaan'),
      l('Uji hipotesis'), l('Korelasi & regresi linear'), k('Kuis akhir'),
    ],
  },
  {
    key: 'python-data', title: 'Python untuk Data', category: 'pemrograman',
    units: [
      b('Python: variabel & tipe data'), l('Kondisi & perulangan'), l('Fungsi & modul'), l('List, dict & set'),
      b('NumPy dasar'), b('pandas: DataFrame'), l('pandas: membersihkan data'), l('pandas: groupby & agregasi'),
      v('Visualisasi dengan matplotlib'), l('Membaca CSV & Excel'), l('Analisis data eksploratif'), p('Proyek mini analisis data'),
    ],
  },
  {
    key: 'uiux-dasar', title: 'UI/UX Dasar', category: 'lainnya',
    units: [
      b('Prinsip desain UI'), b('Riset pengguna'), l('Persona & user journey'), b('Arsitektur informasi'),
      l('Wireframe'), b('Tipografi & warna'), b('Komponen & design system'), p('Prototipe interaktif'),
      l('Uji usability'), b('Aksesibilitas dasar'),
    ],
  },
  {
    key: 'inggris-akademik', title: 'Bahasa Inggris Akademik', category: 'bahasa',
    units: [
      b('Academic vocabulary'), l('Reading: skimming & scanning'), l('Reading: main idea'), v('Listening: lectures'),
      b('Grammar: tenses'), b('Grammar: passive voice'), l('Paragraph writing'), b('Essay structure'),
      l('Paraphrasing & citation'), p('Presentation skills'),
    ],
  },
];

export function templateByKey(key: string | null | undefined): ModuleTemplate | undefined {
  return MODULE_TEMPLATES.find((t) => t.key === key);
}
