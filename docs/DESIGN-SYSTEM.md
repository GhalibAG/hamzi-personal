# DESIGN-SYSTEM — Hamzi: Plan Tracker Pribadi

Pendamping `PRD.md`, `TECH-SPEC.md`, dan `UI-SPEC.md`. Semua nilai di dokumen ini **diambil dari prototipe yang disetujui** (`docs/prototype/*.dc.html`). Bila ragu, buka file prototipe atau screenshot `docs/prototype/screens/` — itu sumber kebenaran visual.

**Arah visual:** gaya super-app yang halus: kartu membulat, bayangan lembut, header hijau dengan lingkaran dekoratif (bukan gradien), grid ikon bulat, navigasi bawah dengan pil aktif. Identitas, warna, ikon, dan maskot orisinal; jangan memakai aset/logo/maskot merek lain.

> Keputusan "siluet": bentuk membulat + lingkaran dekoratif berlapis di area berwarna (header Beranda, kartu saldo, kartu IPK, kartu pohon). Tidak memakai gradien.

---

## 1. Prinsip
1. Tenang dan hidup: latar `#FAFBFA`, aksen hijau, banyak ruang.
2. Satu tangan: aksi utama di separuh bawah; FAB kanan bawah.
3. Angka jelas: nominal besar tebal, tabular.
4. Umpan balik ≤ 100 ms: toast, centang, chip "+1 tetes air".
5. Maskot membantu, bukan mengganggu (maks satu maskot besar per layar).
6. Konsisten: semua nilai dari token di bawah; tidak ada angka ajaib di komponen.

---

## 2. Warna

### 2.1 Token (`src/styles/tokens.css`)
```css
:root {
  /* Brand hijau */
  --brand-50:#ECFDF3; --brand-100:#D1FADF; --brand-200:#A6F4C5; --brand-300:#6CE9A6; --brand-400:#32D583;
  --brand-500:#12B76A; --brand-600:#039855; --brand-700:#027A48; --brand-800:#05603A; --brand-900:#054F31;
  --brand-tint:#E7F8EF;                       /* gelembung ikon "Catat" */

  /* Netral */
  --n-0:#FFFFFF; --n-25:#FAFBFA; --n-50:#F4F7F5; --n-100:#EAEFEC; --n-200:#DCE3DF; --n-300:#C3CDC8;
  --n-400:#98A5A0; --n-500:#6B7873; --n-600:#4F5B56; --n-700:#3A4541; --n-900:#14201B;

  /* Peran */
  --bg:var(--n-25); --surface:var(--n-0); --surface-2:var(--n-50); --border:var(--n-100); --border-strong:var(--n-200);
  --text:var(--n-900); --text-2:var(--n-600); --text-3:var(--n-500); --text-muted:var(--n-700);
  --primary:var(--brand-700); --on-primary:#FFFFFF; --primary-soft:var(--brand-50); --on-primary-soft:var(--brand-800);
  --nav-active-pill:var(--brand-100);
  --header-bg:var(--brand-700);
  --header-circle-1:var(--brand-600);         /* opacity .55, kanan atas 260px */
  --header-circle-2:var(--brand-800);         /* opacity .45, kiri bawah 180px */
  --header-circle-3:var(--brand-500);         /* opacity .18, 90px */
  --on-header-sub:var(--brand-100);           /* "Selamat sore," */
  --scrim:rgba(20,32,27,.40);
  --white-14:rgba(255,255,255,.14); --white-16:rgba(255,255,255,.16);

  /* Status */
  --warn-bg:#FEF0C7; --warn-fg:#93370D; --warn-strong:#B54708; --warn-banner-bg:#FFFAEB; --warn-banner-border:#FEDF89;
  --danger:#F04438; --danger-bg:#FEE4E2; --danger-fg:#B42318; --danger-soft:#FFFBFA; --danger-border:#FECDCA; --danger-tint:#FEECEB; --danger-deep:#912018;
  --info-bg:#E6F7FB; --info-fg:#0E7090;

  /* Aksen modul (bg / ikon / batang) */
  --mod-rencana-bg:#EAF4FF;   --mod-rencana-fg:#1570EF;   --mod-rencana-bar:#2E90FA;  --mod-rencana-text:#175CD3;
  --mod-kuliah-bg:#F1EEFF;    --mod-kuliah-fg:#6938EF;    --mod-kuliah-bar:#7A5AF8;
  --mod-kuliah-hero:#5925DC;  --mod-kuliah-deep:#4A1FB8;  --mod-kuliah-line:#D9D6FE; --mod-kuliah-sub:#EBE9FE;
  --mod-keuangan-bg:#E7F8EF;  --mod-keuangan-fg:#039855;
  --mod-target-bg:#FEF4E6;    --mod-target-fg:#DC6803;    --mod-target-bar:#F79009;   --mod-target-track:#FEF0C7;
  --mod-invest-bg:#FDEDF8;    --mod-invest-fg:#C11574;    --mod-invest-bar:#EE46BC;
  --mod-belajar-bg:#E6F7FB;   --mod-belajar-fg:#088AB2;   --mod-belajar-bar:#06AED4;  --mod-belajar-text:#0E7090;
  --mod-rutin-bg:#FEECEB;     --mod-rutin-fg:#D92D20;

  /* Palet modul belajar (color_index 0..4): bg / teks inisial / bar */
  --lm-0-bg:#E6F7FB; --lm-0-fg:#0E7090; --lm-0-bar:#06AED4;
  --lm-1-bg:#EAF4FF; --lm-1-fg:#175CD3; --lm-1-bar:#2E90FA;
  --lm-2-bg:#FEF4E6; --lm-2-fg:#B54708; --lm-2-bar:#F79009;
  --lm-3-bg:#F1EEFF; --lm-3-fg:#5925DC; --lm-3-bar:#7A5AF8;
  --lm-4-bg:#FDEDF8; --lm-4-fg:#C11574; --lm-4-bar:#EE46BC;

  /* Maskot */
  --cat-fur:#FFF4E0; --cat-fur-2:#F3E6CC; --cat-shade:#F2E0BD; --cat-ear:#FDA29B; --cat-nose:#F97066;
  --cat-ink:#054F31; --cat-scarf:#12B76A; --cat-scarf-line:#027A48; --cat-scarf-knot:#039855;
  --spark-1:#F79009; --spark-2:#FDB022;

  /* Pohon */
  --tree-ground:#A6F4C5; --tree-soil:#B88A5F; --tree-trunk:#93623C; --tree-leaf-1:#32D583; --tree-leaf-2:#12B76A;
  --tree-leaf-3:#039855; --tree-fruit:#F79009; --tree-flower:#FDA29B;

  /* Radius, bayangan */
  --r-xs:6px; --r-sm:8px; --r-md:12px; --r-lg:14px; --r-xl:16px; --r-2xl:18px; --r-3xl:20px; --r-4xl:22px;
  --r-5xl:24px; --r-6xl:26px; --r-sheet:28px; --r-pill:999px;
  --shadow-1:0 1px 3px rgba(20,32,27,.12);                     /* segmented aktif */
  --shadow-bubble:0 4px 12px rgba(5,79,49,.18);                /* balon Hamzi */
  --shadow-float:0 16px 40px rgba(2,122,72,.18);               /* kartu pengeluaran */
  --shadow-hero-green:0 16px 40px rgba(2,122,72,.22);
  --shadow-hero-purple:0 16px 40px rgba(89,37,220,.25);
  --shadow-fab:0 12px 32px rgba(2,122,72,.35);
  --shadow-pop:0 12px 32px rgba(20,32,27,.16);                 /* menu FAB */
  --shadow-toast:0 12px 32px rgba(20,32,27,.25);
  --shadow-notif:0 16px 40px rgba(20,32,27,.22);
  --shadow-sheet:0 -12px 32px rgba(20,32,27,.12);
  --shadow-day-sel:0 8px 20px rgba(2,122,72,.25);
}
```
Mode gelap (P1): definisikan ulang peran (`--bg:#0B1410; --surface:#121D18; --surface-2:#1A2822; --border:#22332B; --text:#E8F1EC; --text-2:#B2C2BA; --text-3:#8A9C93; --primary:var(--brand-400); --on-primary:#052E1D`), aksen modul tetap; prototipe hanya mendefinisikan mode terang.

### 2.2 Kontras (verifikasi dengan axe)
| Pasangan | Pakai |
|---|---|
| Putih di `brand-700` (≈5,4:1) | Teks header, tombol utama ✅ |
| `brand-100` di `brand-700` | Teks kecil sekunder header ("Selamat sore,") ✅ |
| Putih di `--mod-kuliah-hero` #5925DC | Kartu IPK ✅ |
| Putih di `brand-500`/`brand-600` | ❌ untuk teks kecil |
| `n-500` (#6B7873) di putih | Meta/caption ✅ (≥4,5:1) |
Status selalu disertai teks/ikon, tidak hanya warna.

---

## 3. Tipografi
Font **Plus Jakarta Sans** 400/500/600/700/800 (self-host `@fontsource`). Angka: `font-variant-numeric: tabular-nums` untuk timer & nominal di tabel.

| Token | px / bobot / lain | Contoh |
|---|---|---|
| `display-2xl` | 44 / 800 / ls −1 | Timer "24:58" |
| `display-xl` | 40 / 800 / ls −1 | IPK "3,62" |
| `display-lg` | 38 / 800 / ls −1 | Nominal keypad |
| `display` | 32 / 800 / ls −0,8 | Saldo semua dompet |
| `amount` | 26 / 800 / ls −0,5 | Pengeluaran hari ini |
| `title` | 26 / 800 / ls −0,5 | Judul layar ("Rencana") |
| `name` | 22 / 800 / ls −0,3 | Nama di header Beranda |
| `stat` | 24 / 800 | "4 hari" |
| `section-lg` | 17 / 800 | "Hari ini" Beranda |
| `section` | 16 / 800 | Judul seksi lain |
| `section-sm` | 14 / 800 | Judul subseksi Rencana/Kuliah ("Terlambat · 1", "Hari ini", "Senin, 12 Okt") |
| `stage` | 19 / 800 | Nama tahap pohon |
| `card-title` | 15 / 700–800 | Judul kartu |
| `body-strong` | 14 / 600–700 | Judul item daftar |
| `body` | 14 / 500, lh 1,55 | Paragraf, balon chat |
| `label` | 13 / 600–700 | Tombol kecil, tab segmented |
| `meta` | 12 / 500–600 | Meta item, caption |
| `small` | 11,5 / 600 | Label grid, meta kecil |
| `micro` | 11 / 600 (aktif 800) | Label nav, chip kecil |
| `overline` | 11 / 700 / uppercase / ls .5 | "POHONMU" |

---

## 4. Layout & Struktur Layar (mobile 390 × 844 acuan)
- **AppShell**: tinggi penuh; area konten scroll `position:absolute; inset:0 0 76px 0; overflow-y:auto`; navigasi bawah tetap.
- Gutter horizontal 16 px; jarak antar seksi 18–22 px; jarak antar kartu dalam daftar 10 px.
- **Header layar (non-Beranda)**: padding 20/16/0; baris kiri = overline meta (12/600 `text-3`) + `title`; kanan = 1–2 `IconButton` 44 px (lingkaran putih, border `--border`) atau tombol pil 44 px.
- **Header Beranda**: blok `--header-bg`, padding 20/20/92, 3 lingkaran dekoratif (lihat token), lembar `--bg` radius atas 28 setinggi 28 px di dasar header; kartu pengeluaran mengambang dengan margin −76 px.
- **Navigasi bawah**: tinggi 76 px, putih, garis atas `--border`, grid 5 kolom, padding 6/4/10; item = ikon 22 dalam kotak 56×30 + label `micro`; aktif = pil `--nav-active-pill` radius pill, ikon terisi `--primary`, label 800 `--primary`; non-aktif ikon garis `--text-3`.
- **FAB**: 56 px lingkaran `--primary`, ikon + 26 px stroke 2,4; posisi `right:16; bottom:92`; `--shadow-fab`; z di atas konten, di bawah sheet.
- **Sheet bawah**: putih, radius atas 28, padding 10/16/16–20, handle 36×4 `--border-strong`; backdrop `--scrim`; tutup dengan ketuk backdrop/Esc/geser turun.
- **Toast**: `left/right:16; bottom:92`, latar `--n-900`, teks putih 13/600, radius 16, padding 12–14, aksi teks `--brand-300` 800; durasi 3,5 dtk; **FAB disembunyikan selama toast tampil**.
- **Notifikasi dalam app (banner uji)**: `top:12; left/right:10`, putih, radius 22, `--shadow-notif`.
- **Desktop** §11.

---

## 5. Komponen (spesifikasi dari prototipe)

| Komponen | Spesifikasi |
|---|---|
| `IconButton` | 44×44, radius pill. Varian `onHeader` (bg `--white-16`, ikon putih 20, stroke 1,9) dan `default` (putih, border `--border`, ikon `--text-muted`). Wajib `aria-label`. |
| `Button` | Tinggi 56 (utama di sheet/timer, 16/800), 44 (kartu), 40 (kecil 13/700–800), 36 (mini 12–13/700). Radius pill. Varian: `primary` (`--primary`/putih), `outline-primary` (border 2 `--primary`, teks `--primary`), `soft` (`--primary-soft`/`--on-primary-soft`), `secondary` (putih, border `--border-strong`, teks `--text-muted`), `outline-soft` (putih, border `--brand-200`, teks `--brand-800`; mis. "Tanya Hamzi"), `outline-kuliah` (putih, border `--mod-kuliah-line`, teks `--mod-kuliah-deep`; "Catatan"), `danger-outline` (putih, border `--danger-border`, teks `--danger-fg`; "Tunda"), `disabled` (`--border-strong`/`--text-3`). |
| `Card` | Putih, border 1 `--border`, radius 18–22, padding 12–16. Varian `tinted` (bg modul), `hero` (warna solid + lingkaran dekoratif), `floating` (`--shadow-float`, radius 22). |
| `Segmented` | Wadah `--border` (#EAEFEC) radius pill padding 4, grid N kolom gap 4; tombol tinggi 40 radius pill `label`; aktif putih + `--shadow-1` teks `--text`, non-aktif transparan teks `--text-2`. Di sheet catat cepat: sama. |
| `Chip` (pilihan) | Tinggi 36–40, padding 0/14, radius pill, 13/700. Aktif: bg `--primary-soft`, teks `--on-primary-soft`, border `--brand-300`. Non-aktif: putih, border `--border-strong`, teks `--text-muted`. |
| `ChipQuick` | Seperti Chip non-aktif, untuk +5rb dst. |
| `Tag` | 11/700, padding 2–4 / 7–10, radius pill; warna per sumber (Kuliah: `--mod-kuliah-bg`/#5925DC, Belajar: `--info-bg`/`--info-fg`, Keuangan: `--brand-tint`/`--brand-800`, Tugas: `--mod-rencana-bg`/`--mod-rencana-text`, Ujian: `--warn-bg`/`--warn-fg`, Rutinitas: `--primary-soft`/`--brand-800`, Keluar: `--danger-bg`/`--danger-fg`, Masuk: `--primary-soft`/`--brand-800`, Jadwal: `--mod-kuliah-bg`/#5925DC, Modul: `--info-bg`/`--info-fg`, Event: `--surface-2`/`--text-muted`, Setoran: `--mod-target-bg`/`--warn-strong`). **Jenis proyek** (chip di kartu proyek, sesuai prototipe): kuliah `--mod-rencana-bg`/`--mod-rencana-fg` (bar `--mod-rencana-bar`), pribadi `--mod-invest-bg`/`--mod-invest-fg` (bar `--mod-invest-bar`), skill `--mod-belajar-bg`/`--mod-belajar-fg` (bar `--mod-belajar-bar`), lomba `--mod-target-bg`/`--mod-target-fg` (bar `--mod-target-bar`). |
| `PriorityPill` (Beranda) | Tinggi ±24, 11/700; Tinggi `--danger-bg`/`--danger-fg`; Sedang `--warn-bg`/`--warn-fg`; Rendah `--border`/`--text-muted`; Kritis `--danger-fg`/putih. |
| `PriorityDot` (Rencana) | 10 px; Tinggi `--danger`, Sedang `--mod-target-bar`, Rendah `--n-400`, Kritis `--danger-deep`; `aria-label` "Prioritas …". |
| `CheckBox` (tugas) | Area sentuh 44; kotak 24 radius 8; kosong border 2 `--n-300`; terisi `--brand-500` + centang putih 14 stroke 3,2. Judul selesai dicoret `--text-3`. |
| `CheckCircle` (rutinitas) | Sama, radius 50%; baris selesai bg `--primary-soft` border `--brand-200`, judul `--brand-800`. |
| `ProgressBar` | Tinggi 6/8/10, radius pill, track `--border`, isi warna modul; transisi width 600 ms ease-out. Anggaran: hijau/kuning/merah §7.4 PRD. |
| `Ring` | SVG r=22 (56) stroke 7 atau r=118 (260) stroke 12; round cap; start −90°. |
| `Amount` | Format `Rp 1.250.000`; `hidden` → `Rp •••••`; ringkas "Rp 1,7 jt", "Rp 473rb". |
| `Keypad` | Grid 3 kolom gap 8; tombol 52 tinggi, radius 16, bg `--surface-2`, 20/700. Urutan 1–9, 000, 0, ⌫ (`aria-label` "Hapus"). |
| `WeekStrip` | Grid 7, gap 4, sel 68 tinggi radius 18: hari 11/600 + tanggal 17/800 + titik 5 px; terpilih bg `--primary` teks putih `--shadow-day-sel` titik `--brand-200`. |
| `ServiceTile` | Kotak 52 radius 18 bg modul + ikon 24 warna modul; label `small` `--text-muted`; grid 4 kolom gap 14/6. |
| `TaskRow` | Kartu putih border, radius 18, padding 10/14/10/8: CheckBox, judul + meta, PriorityPill/Dot. |
| `ClassCard` | bg `--mod-kuliah-bg`, radius 18, padding 12/14: jam 15/800 `--mod-kuliah-deep` + "N mnt lagi" 10,5/600, garis 1 `--mod-kuliah-line`, nama 14/700 + detail 12. |
| `StatTile` | bg `--primary-soft` (atau `--surface-2`) radius 14 padding 10/12: label 11/600 + nilai 15/800. Pada hero: bg `--white-14`. |
| `HabitTile` | min-tinggi 84, radius 18, padding 12: "n/target" 20/800 + nama 11,5/600; penuh: bg `--danger-tint` border `--danger-border` teks `--danger-deep`. |
| `ModuleRow` | Kartu putih radius 20: inisial 44 radius 14 (palet lm-i), judul 14/700 + "done/total", bar 6, meta 11,5; tombol ▶ 44 lingkaran `--primary`. |
| `RoutineRow` | radius 18, padding 8/12/8/6: CheckCircle, nama 14/700 + meta 12, chip lonceng (bg `--surface-2`, 12/700, ikon 13). |
| `ReminderRow` | Kartu putih radius 18: jam 16/800 tabular (min 50), nama 14/700 + jenis 12, `Switch`. |
| `Switch` | Track 44×26 radius pill (`--brand-500` aktif / `--n-300`), knob 20 putih; `role="switch"`, area sentuh 52×44. |
| `GardenDay` | Tombol 48 tinggi radius 12: ikon 22 (titik/tunas/bibit/pohon + bunga) + tanggal 10,5/700; terpilih bg `--primary-soft` border 2 `--brand-500`; hari ini border 2 dashed `--brand-300`; hari depan teks `--n-400`. |
| `Tree` | SVG 200×190 (tampil 170×160), 6 tahap §6.7, tajuk berayun ±1° 5 dtk. |
| `ChatBubble` | Pengguna: `--primary`, teks putih, radius 20/20/6/20, maks 80%. Hamzi: putih border, radius 20/20/20/6, maks 86%, `white-space: pre-line`. Semua item daftar chat `flex-shrink:0`. |
| `FileCard` | 250 lebar, border `--brand-200`, ikon jenis 40×44 radius 10 (`--danger-bg`/`--danger-fg` untuk PDF), nama 13/700, meta 11,5. |
| `ActionCard` | Lebar 92%, border `--brand-200`, radius 20: header `--primary-soft` (ikon kilau + judul 13/800 `--brand-800`); baris item (checkbox 22 radius 7, Tag jenis, judul 13,5/700, detail 12); tombol "Tambahkan N terpilih"/"Simpan" + "Batal"; setelah selesai: status 12,5/700 + "Urungkan". |
| `TypingDots` | 3 titik 7 px (`--brand-300`, `--brand-400`, `--brand-500`). |
| `SpeedDial` | Item pil 48 tinggi putih `--shadow-pop`: lingkaran 34 bg modul + ikon 18 + teks 14/700; muncul di atas FAB dengan scrim; FAB berputar 45°. |
| `EmptyState` | Hamzi (mood sesuai) + judul + 1 kalimat + tombol. |
| `Skeleton` | Blok `--surface-2` shimmer 1,4 dtk. |

Semua komponen interaktif: elemen semantik asli (`button`, `a`, `input`, `label`), fokus terlihat (ring 2 px `--brand-400`), `aria-pressed` untuk pilihan, `aria-label` untuk ikon.

---

## 6. Maskot — Hamzi

### 6.1 Konsep
Kucing krem bulat bersyal hijau; **kedua mata = huruf hamzah (ء)** sebagai SVG path. Port 1:1 dari `docs/prototype/Hamzi.dc.html` ke `src/components/mascot/Mascot.tsx`.

### 6.2 Geometri (viewBox 0 0 200 200)
| Bagian | Bentuk (dari prototipe) | Warna |
|---|---|---|
| Ekor | path `M150 178 C186 172 194 136 174 120` stroke 15 round (+ ujung `--cat-shade`) | `--cat-fur-2` |
| Badan | ellipse (100,182) 56×36; bayangan ellipse (100,198) 44×12 | `--cat-fur` / `--cat-shade` |
| Telinga | path `M40 72 C30 42 34 20 47 22 C60 24 74 38 84 48 Z` + dalam `M49 60 C44 45 46 33 52 34 C59 36 66 43 72 50 Z`; kanan = cermin `translate(200 0) scale(-1 1)` | `--cat-fur` / `--cat-ear` |
| Kepala | ellipse (100,96) 72×60; motif dahi 3 lengkung stroke 5 `--cat-shade`; bayangan dagu ellipse (100,146) 46×9 op .6 | `--cat-fur` |
| Syal | path `M50 146 Q100 166 150 146 L148 160 Q100 180 52 160 Z` + garis `M52 153 Q100 172 149 153` stroke 2,5; simpul kiri lingkaran (60,158) r8 + 2 ekor | `--cat-scarf` / `--cat-scarf-line` / `--cat-scarf-knot` |
| Pipi | lingkaran (56,114) & (144,114) r11 op .42 | `--cat-ear` |
| Kumis | 3 garis per sisi stroke 1,6 op .4 | `--cat-ink` |
| Hidung | segitiga `M95 106 L105 106 L100 112 Z` stroke 2,5 join round | `--cat-nose` |
| **Mata** | path hamzah (viewBox 24): `M16.6 6.4 C14.6 4.1 9.4 4.5 9.3 8.4 C9.2 11.8 12.9 12.7 16.3 12 Q12.4 15.6 7.6 18.9`, stroke 2,7 round, tanpa fill; pusat mata kiri (72,90), kanan (128,90); transform `translate(dx dy) rotate(r) scale(sx sy) translate(-12 -12)` | `--cat-ink` |
| Mulut | per mood (tabel 6.3), stroke 2,4 | `--cat-ink` |

Orientasi: **A (default)** kedua mata identik. B (`mirror`): mata kanan `scale(-sx sy)` dan `rotate(-r)`.

### 6.3 Mood (nilai persis)
| Mood | r | sx | sy | dx,dy | Kedip | Mulut (d) | Isi mulut | Ekstra | Alis |
|---|---|---|---|---|---|---|---|---|---|
| `calm` | 0 | 1,5 | 1,5 | 0,0 | ya | `M90 116 Q95 121 100 116 Q105 121 110 116` | none | – | – |
| `happy` | 90 | 1,45 | 1,45 | 0,2 | tidak | `M86 114 Q93 125 100 116 Q107 125 114 114` | none | – | – |
| `excited` | 0 | 1,8 | 1,8 | 0,−2 | ya | `M90 115 Q100 132 110 115 Z` | ink | 2 bintang kilau (`--spark-1`, `--spark-2`) | – |
| `focus` | 0 | 1,3 | 1,3 | 3,3 | ya | `M94 118 L106 118` | none | – | datar: kiri `M58 70 L82 72`, kanan cermin |
| `worried` | ±12 (kiri −12, kanan +12) | 1,45 | 1,45 | 0,2 | ya | `M90 120 Q95 115 100 118 Q105 121 110 116` | none | – | miring: kiri `M58 70 L82 60` |
| `sleepy` | 0 | 1,5 | 0,7 | 0,4 | tidak | `M95 118 Q100 128 105 118 Q100 112 95 118 Z` | ink | – | – |
| `sleeping` | 0 | 1,5 | 0,18 | 0,6 | tidak | `M95 117 Q100 120 105 117` | none | "z" & "Z" berkedip (`--primary`) | – |
| `celebrate` | 90 | 1,45 | 1,45 | 0,2 | tidak | `M88 114 Q100 134 112 114 Z` | ink | 6 konfeti warna modul | – |

### 6.4 Pemicu & dialog
| Mood | Pemicu (mesin mood, prioritas atas → bawah) | Contoh kalimat |
|---|---|---|
| `celebrate` | Target 25/50/75/100%, naik tahap pohon | "Target 50% tercapai!" / "Pohonmu naik jadi {tahap}!" |
| `sleeping` | Absen ≥ 3 hari (saat dibuka pertama, 10 dtk lalu `calm`) | "Zzz… aku nunggu kamu balik." |
| `excited` | Streak bertambah, level naik | "Streak {n} hari! Kamu keren." |
| `focus` | Timer berjalan, AI memproses | "Fokus dulu ya, aku jagain waktunya." |
| `worried` | Tugas tenggat < 24 jam, anggaran ≥ 80%, kehadiran mepet | "{Tugas} tenggatnya besok, mau dicicil?" |
| `happy` | Baru mencentang tugas/rutinitas (30 dtk) | "Satu tugas sudah beres. Mantap!" |
| `sleepy` | ≥ 23:00, atau absen tepat 2 hari | "Jangan begadang ya, catat yang penting saja." |
| `calm` | Default | "Hari ini {n} tugas & {k} kelas. Mulai dari yang kecil ya!" |
Kalimat ≤ 80 karakter, tidak menghakimi, tanpa nominal bila sembunyikan nominal aktif. Bank ≥ 40 baris di `lines.id.ts`.

### 6.5 Animasi
- Napas: skala 1 → 1,018 → 1 (4 dtk) berporos (100,196); excited/celebrate 1 → 1,05 (0,9 dtk).
- Kedip: scaleY 1 → 0,1 → 1 pada 93–96% siklus 4,6 dtk (hanya mood dengan "Kedip: ya").
- `still`/`prefers-reduced-motion`/mode Minimal → tanpa animasi.
- Implementasi React: CSS keyframes atau SMIL seperti prototipe; keduanya diperbolehkan.

### 6.6 API
```tsx
<Mascot mood="calm" size={76} mirror={settings.eye_mirror} still={reducedMotion} />
// Ukuran dipakai: 44 (header chat), 76 (Beranda), 108–120 (timer, papan mood)
```

---

### 6.7 Pohon (komponen `Tree`)
Geometri persis dari `docs/prototype/Belajar.dc.html` (viewBox 0 0 200 190): tanah ellipse (100,174) 86×13 `--tree-ground`; tanah pot ellipse (100,171) 34×7 `--tree-soil`.
| Tahap | Isi |
|---|---|
| 0 Biji | ellipse (100,165) 8×5,5 `--tree-trunk` + kecambah stroke `--tree-leaf-1` |
| 1 Tunas | batang 100,170→146 stroke 4 `--tree-leaf-3`; 2 daun |
| 2 Bibit | batang ke 118 stroke 5; 4 daun bergantian |
| 3 Pohon muda | batang trapesium `M95 171 L97 116 L103 116 L105 171 Z`; tajuk lingkaran (100,100) r38 `--tree-leaf-2` + sorot (88,88) r14 `--tree-leaf-1`; berayun |
| 4 Pohon rindang | batang bercabang; tajuk (68,102) r30, (132,102) r30 `--tree-leaf-3`, (100,74) r44 `--tree-leaf-2`, sorot (84,60) r15 |
| 5 Pohon berbuah | tahap 4 + 4 buah r6 `--tree-fruit` |
| Bunga hari ini | 3 bunga `--tree-flower`: (150,40) r5 + titik putih r2, (48,56) r5 + titik putih r2, (160,120) r4 tanpa titik |
`GardenDay` ikon 22 (viewBox 24): level 0 titik r1,6 `--n-300`; 1 tunas; 2 bibit (batang + lingkaran r5,5 `--tree-leaf-1`); 3 pohon (batang + lingkaran r8 `--tree-leaf-2`); bunga lingkaran r2,4 `--tree-flower` di (15,5;7).

---

## 7. Motion
| Token | Nilai |
|---|---|
| `--dur-fast` | 120 ms |
| `--dur-base` | 200 ms (segmented, switch, FAB rotate) |
| `--dur-slow` | 320 ms (sheet) |
| `--dur-fill` | 600 ms (bar/ring) |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` |
Pola: sheet naik dengan spring (stiffness 320, damping 32); toast fade+slide 200 ms; chip "+1 tetes air" muncul 1,8 dtk; centang 180 ms; count-up angka 500 ms saat berubah; `prefers-reduced-motion` → fade 100 ms saja.

---

## 8. Ikon
Semua ikon adalah **SVG inline dari prototipe** (viewBox 24, `fill:none`, `stroke:currentColor`, `stroke-linecap/linejoin: round`, stroke 1,8–2). Buat komponen di `src/components/icons/`:
| Nama | Path (d) |
|---|---|
| `Home` | `M3.5 10.5L12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z` (aktif: fill) |
| `Plan` | rect 4,4,16,16 rx4 + `M8.5 12l2.5 2.5 4.5-5` (aktif: rect terisi, centang putih) |
| `Cap` | `M2 9.5L12 4.5l10 5-10 5z` + `M6 11.5v4.5c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.5` |
| `Wallet` | `M19 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H5` + circle 16.5,14 r1.2 |
| `Sprout` (Tumbuh) | `M12 21v-9` + `M12 12c0-4 3-7 8-7 0 5-3 8-8 7z` + `M12 14c0-3-2.5-5.5-7-5.5 0 4 2.5 6 7 5.5z` |
| `Calendar` | rect 3.5,5,17,15 rx3 + `M3.5 10h17M8 3v4M16 3v4` |
| `Receipt` (Catat) | `M6 3h12v18l-3-2-3 2-3-2-3 2z` + `M9 8h6M9 12h6` |
| `Target` | circle r8.5 + circle r4.5 + titik |
| `TrendUp` | `M3 17l6-6 4 4 8-8` + `M15 7h6v6` |
| `Book` (Belajar) | `M2.5 5.5h6a3.5 3.5 0 0 1 3.5 3.5v11a3 3 0 0 0-3-3H2.5z` + `M21.5 5.5h-6A3.5 3.5 0 0 0 12 9v11a3 3 0 0 1 3-3h6.5z` |
| `Repeat` (Rutinitas) | `M17 2l3 3-3 3` + `M4 11V9a4 4 0 0 1 4-4h12` + `M7 22l-3-3 3-3` + `M20 13v2a4 4 0 0 1-4 4H4` |
| `Eye` / `EyeOff` | `M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z` + circle r3 / garis `M3 3l18 18` + varian |
| `Bell` | `M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z` + `M10 20a2 2 0 0 0 4 0` |
| `Search` | circle 11,11 r7 + `M20 20l-3.5-3.5` |
| `Sliders` | `M4 7h10M18 7h2M4 17h4M12 17h8` + circles |
| `Flame` | `M12 22c4 0 7-2.7 7-7 0-3.5-2.4-6-4-8-.3 2-1.3 3.4-2.6 4C12.5 7.6 11 4.5 8.5 2.5 8.5 6 5 9 5 15c0 4.3 3 7 7 7z` (fill) |
| `Sparkle` | `M12 2l1.8 5.6L19.5 9.5 13.8 11.4 12 17l-1.8-5.6L4.5 9.5l5.7-1.9z` (fill) |
| `Plus`, `ChevronLeft` (`M15 18l-6-6 6-6`), `ChevronDown` (`M6 9l6 6 6-6`), `ArrowRight` (`M5 12h14M13 6l6 6-6 6`), `Play` (`M7 4.5v15l12-7.5z` fill), `Check` (`M5 12.5l4.5 4.5L19 7.5`), `Clip` (paperclip), `Shield` (`M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z` + check), `Lock`, `Alert` (segitiga), `Clock` |
Ikon yang belum ada di prototipe (gear, trash, edit, filter, logout): Lucide dengan stroke 1,9 agar seragam.

---

## 9. Daftar Layar & Rute

| Rute | Layar | Sumber desain | P |
|---|---|---|---|
| `/masuk` | Login (Hamzi 120 + nama app + tombol Google/magic link) | UI-SPEC §12 | P0 |
| `/onboarding` | 6 langkah | UI-SPEC §12 | P0 |
| `/` | **Beranda** | `Main.dc.html` | P0 |
| `/notifikasi` | Kotak notifikasi (+ ikon gear ke Pengaturan) | UI-SPEC §11 | P0 |
| `/chat` | **Chat Hamzi** | `Chat.dc.html` | P1 |
| `/chat/riwayat` | Riwayat AI (payload & respons) + izin data | UI-SPEC §10 | P1 |
| `/cari` | Pencarian | UI-SPEC §12 | P1 |
| `/rencana` `?tab=hari-ini|minggu|proyek` | **Rencana** | `Rencana.dc.html` | P0 |
| `/rencana/tugas/baru`, `/rencana/tugas/:id` | Form/detail tugas (sheet di mobile) | UI-SPEC §3 | P0 |
| `/rencana/proyek/:id` | Detail proyek | UI-SPEC §3 | P0 |
| `/rencana/kalender` | Kalender bulan | UI-SPEC §3 | P0 |
| `/kuliah` `?tab=jadwal|tugas|nilai` | **Kuliah** | `Kuliah.dc.html` | P0 |
| `/kuliah/matkul/:id`, `/kuliah/semester` | Detail matkul, kelola semester & matkul | UI-SPEC §4 | P0 |
| `/keuangan` | **Keuangan** | `Keuangan.dc.html` | P0 |
| `/keuangan/transaksi`, `/keuangan/anggaran`, `/keuangan/dompet` | Riwayat, anggaran, dompet | UI-SPEC §5 | P0 |
| `/keuangan/target/:id`, `/keuangan/investasi(/:id)` | Target, investasi | UI-SPEC §5 | P0/P1 |
| `/tumbuh` `?tab=hari-ini|kalender|pengingat` | **Tumbuh** | `Belajar.dc.html` | P0 |
| `/tumbuh/sesi` | Timer fokus (layar penuh) | `Belajar.dc.html` (overlay) | P0 |
| `/tumbuh/modul/:id`, `/tumbuh/rutinitas/:id` | Detail modul & rutinitas | UI-SPEC §6 | P0/P1 |
| `/pengaturan`, `/pengaturan/profil`, `/pengaturan/tampilan`, `/pengaturan/notifikasi`, `/pengaturan/akademik`, `/pengaturan/keuangan`, `/pengaturan/tumbuh`, `/pengaturan/privasi-ai`, `/pengaturan/data`, `/pengaturan/diagnostik` | Pengaturan (path lengkap; berbeda dari `/notifikasi` = kotak notifikasi) | UI-SPEC §11 | P0/P1 |
| `/dev/maskot`, `/dev/pohon` | Halaman pengembang (hanya `import.meta.env.DEV`) | M1.2–M1.3 | – |
Parameter `?quick=expense|income|task|timer|routine|module` membuka sheet terkait.

---

## 10. Aksesibilitas
- Kontras §2.2; target sentuh ≥ 44 px; fokus terlihat; urutan logis.
- Segmented = tombol dengan `aria-pressed` (atau Radix Tabs dengan role tab).
- Grafik/heatmap/kalender: `aria-label` ringkasan.
- Maskot dekoratif `aria-hidden`, kecuali membawa pesan (`role="img"` + label mood).
- Pesan galat spesifik ("Nominal harus lebih dari 0").
- Dukung font 130% tanpa teks terpotong (gunakan `rem` di implementasi; px di dokumen ini setara 16 px = 1 rem).

---

## 11. Responsif & Desktop (prototipe: `Desktop-*.dc.html`, `DeskSidebar`, `DeskChat`)

### 11.1 Breakpoint
| Lebar | Navigasi | Konten | Sheet | Chat |
|---|---|---|---|---|
| < 768 (HP) | Navigasi bawah 5 tab + FAB | Satu kolom penuh (prototipe HP) | Sheet bawah | Layar `/chat` |
| 768–1023 (tablet) | Navigasi bawah + FAB | Satu kolom, maks 640 px di tengah | Sheet bawah (maks 640) | Layar `/chat` |
| ≥ 1024 (desktop) | **Sidebar kiri 240 px** (tanpa navigasi bawah & tanpa FAB) | Area utama `max-width 1120`, padding 24/32; **dua kolom** (`flex-wrap`, kolom kiri `flex: 3 1 400px`, kanan `flex: 2 1 290px`) | **Dialog tengah** 440 px (radius 24, scrim) | **Panel kanan 380 px** yang bisa dibuka/tutup; status terbuka diingat (localStorage) |
| ≥ 1024 + panel chat | sama | Lebar sisa ≈ 820 px; kolom tetap dua bila muat, turun jadi satu kolom bila tidak | sama | Panel tetap |

Satu basis kode: komponen yang sama, layout berubah via CSS (`@media (min-width:1024px)`) + `useMediaQuery` hanya untuk mengganti Sheet ↔ Dialog dan BottomNav ↔ Sidebar.

### 11.2 Sidebar (`DeskSidebar`)
Putih, border kanan `--border`, padding 20/14. Atas: lingkaran 44 `--primary-soft` berisi Hamzi (still) + "Hamzi" 18/800 + "Plan tracker pribadi" 12/600. Item 44 tinggi radius 12, ikon 22 + label 14/700; aktif bg `--primary-soft` teks `--primary` 800. Urutan: Beranda, Rencana, Kuliah, Keuangan, Tumbuh — garis pemisah — **Chat Hamzi** (tombol toggle panel, kunci "C"), Notifikasi (badge jumlah `#FDB022`), Pengaturan. Bawah: kartu `--surface-2` radius 16 (streak + level + bar XP + teks pintasan).

### 11.3 Header halaman desktop
Kiri: overline 12/600 + judul 26/800. Kanan (wrap bila sempit): kontrol khusus halaman — Beranda: kotak cari 280 (ikon + "Cari tugas, matkul, transaksi…" + kunci "/"), tombol mata, tombol utama "+ Tambah" (menu: Tugas baru N, Catat pengeluaran E, Mulai timer belajar T, Rutinitas baru R); Rencana: segmented tab + "+ Tugas baru"; Kuliah: "Kelola semester & matkul" + "+ Tugas / Ujian"; Keuangan: "3 dompet", "Export CSV", "+ Catat (E)"; Tumbuh: chip streak, "+ Rutinitas", "+ Modul". Tombol utama: tinggi 44, `--primary`, `--shadow-day-sel`. Bila lebar < 1180 dengan panel chat terbuka, kotak cari menyusut menjadi IconButton.

### 11.4 Tata letak per halaman (desktop)
| Halaman | Susunan |
|---|---|
| Beranda | Banner hijau radius 24 (Hamzi 96 + salam 28/800 + kalimat + "Ngobrol sama Hamzi →" membuka panel chat + 3 StatTile: pengeluaran hari ini, aman per hari, saldo). Kiri: Hari ini (kelas berikutnya + daftar tugas dengan Tag sumber & PriorityPill + "+ Tambah tugas (N)"), Kata Hamzi. Kanan: grid Layanan 4×2 dalam kartu, kartu target + streak, kartu ringkas Rutinitas wajib → Tumbuh. |
| Rencana | Kiri: konten tab (Hari ini = kartu progres, Terlambat, daftar tugas; Minggu ini = grid kartu per hari; Proyek = grid kartu proyek). Kanan: kalender bulan kecil (pilih tanggal) + kartu "Agenda {tgl}" + Kebiasaan (grid 3). |
| Kuliah | Banner IPK ungu satu baris penuh. Kiri: banner ujian, jadwal hari ini, tugas kuliah, kehadiran. Kanan: kartu Simulasi IPS (selalu terlihat, tanpa tab). |
| Keuangan | Baris 1: kartu saldo + kartu anggaran (dengan bar kategori). Baris 2 kiri: **tabel** transaksi hari ini (Jam, Kategori, Catatan, Dompet, Nominal); kanan: daftar Target & investasi. Catat = dialog: input nominal diketik (format otomatis "25.000"), chip 5rb–50rb, kategori, dompet, waktu, catatan, "Simpan (Enter)". Keypad tidak ditampilkan di desktop. |
| Tumbuh | Kiri: kartu pohon besar (240) + kebun bulan selalu terlihat. Kanan: rutinitas wajib (grid 2 kolom), belajar mandiri (grid kartu dengan tombol "Mulai fokus 25 mnt"), daftar "Pengingat hari ini" dengan switch. Timer = dialog tengah 420 (Hamzi 80 + ring + jam 30/800 + Jeda/Selesai; Spasi = jeda, Esc = kecilkan). |
| Chat | Panel kanan `DeskChat` (header 40 avatar + "Chat Hamzi" + perisai + tutup; pesan; chip; input "Enter kirim"; seret-lepas file ke panel = lampiran). Rute `/chat` di desktop = percakapan di tengah maks 760 px. |

### 11.5 Interaksi desktop
- Hover: baris/item `--surface-2`; tombol utama `--brand-800`; kursor pointer.
- Fokus keyboard terlihat di semua kontrol; urutan tab: sidebar → header → konten → panel chat.
- Pintasan (abaikan bila fokus di input): `N` tugas baru, `E` catat pengeluaran, `T` timer, `R` rutinitas baru, `/` fokus cari, `C` buka/tutup chat, `Esc` tutup dialog/menu.
- Toast desktop: kiri bawah area konten (`left: sidebar + 32`, `bottom: 24`).
- Dialog menjebak fokus; Enter = simpan bila valid.

---

## 12. Aset
- [ ] Ikon app 192/512/maskable 512 (Hamzi kepala di lingkaran `--brand-700`), favicon.svg, apple-touch 180, badge 72 monokrom (siluet kepala kucing).
- [ ] Ikon shortcut 96: pengeluaran, tugas, belajar, chat.
- [ ] Splash: Hamzi di `--brand-700`.
- [ ] `lines.id.ts` (maskot) dan kalimat notifikasi.
- [ ] Semua ikon §8 sebagai komponen.
