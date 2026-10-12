# UI-SPEC — Spesifikasi Layar Hamzi (sesuai prototipe)

Dokumen ini menerjemahkan prototipe yang disetujui menjadi spesifikasi yang bisa langsung dibangun. Urutan elemen, teks, ukuran, dan warna di sini **harus** sama dengan prototipe.

**Sumber kebenaran visual**
- Kode prototipe: `docs/prototype/<Layar>.dc.html` (HTML + style inline + logika contoh di `<script data-dc-script>`).
- Lihat langsung: jalankan `npx serve docs/prototype` lalu buka `http://localhost:3000/Main.dc.html` (pakai DevTools mode perangkat 390×844). Semua layar saling terhubung lewat tab bawah.
- Screenshot acuan (390×844 @2x): `docs/prototype/screens/NN-nama.png` (daftar di §13).

**Cara membaca**
- Token warna/radius/tipografi → `DESIGN-SYSTEM.md`. Komponen → DESIGN-SYSTEM §5.
- `{nilai}` = data dinamis; sumber datanya ditulis di kolom **Data**.
- Data di prototipe (nama matkul, angka) adalah **contoh** → di M1 dipakai sebagai mock (`src/lib/mock/`), mulai M2 diganti data nyata.
- Mapping file prototipe → rute: `Main`→`/`, `Rencana`→`/rencana`, `Kuliah`→`/kuliah`, `Keuangan`→`/keuangan`, `Belajar`→`/tumbuh`, `Chat`→`/chat`, `Hamzi`→komponen `Mascot`, `Maskot`→papan referensi (tidak menjadi layar app).

---

## 0. Kerangka Umum (semua layar tab)
- Viewport acuan 390×844; latar `--bg`.
- Konten scroll di atas navigasi bawah (76 px). FAB di `right 16 / bottom 92`.
- Navigasi bawah: **Beranda · Rencana · Kuliah · Keuangan · Tumbuh** (ikon Home, Plan, Cap, Wallet, Sprout). Item aktif = pil hijau muda 56×30 + ikon terisi + label tebal hijau.
- Header layar non-Beranda: overline kecil + judul 26/800 di kiri, tombol bulat 44 di kanan.
- Segmented di bawah kartu utama, margin 14–16 px.

---

## 1. Beranda `/` — `Main.dc.html` · screenshot 01, 02, 03

### 1.1 Header hijau
| Elemen | Spesifikasi | Data |
|---|---|---|
| Blok | bg `--header-bg`, padding 20/20/92, 3 lingkaran dekoratif (260 px kanan-atas `brand-600` .55; 180 px kiri-bawah `brand-800` .45; 90 px `brand-500` .18) | – |
| Salam | "Selamat sore," 13/500 `--on-header-sub`; nama 22/800 putih | salam: 04–10 pagi, 10–15 siang, 15–18 sore, 18–04 malam (WIB); `profiles.display_name` |
| Tombol mata | IconButton onHeader; ikon Eye ↔ EyeOff; `aria-label` "Sembunyikan nominal"/"Tampilkan nominal" | `user_settings.hide_amounts` (toggle global) |
| Tombol lonceng | IconButton onHeader; titik 8 px `#FDB022` border 2 `--header-bg` bila ada notifikasi belum dibaca → `/notifikasi` | jumlah `scheduled_notifications` sent & `read_at is null` |
| Hamzi | 76 px, tombol (`aria-label` "Ketuk Hamzi"); ketuk → mood reaksi + kalimat acak 3 dtk | mesin mood |
| Balon | Tautan ke `/chat`: kalimat 13/500 + "Ngobrol sama Hamzi →" 12/800 `--primary`; radius 18/18/18/6; `--shadow-bubble` | kalimat dari mesin mood (`lines.id.ts`) |
| Lembar | Strip `--bg` radius atas 28 setinggi 28 px di dasar header | – |

### 1.2 Kartu "Pengeluaran hari ini" (floating, margin −76 px)
- Kiri: label 12/600 `--text-2` + nominal `amount` (26/800).
- Kanan: badge `--warn-bg`/`--warn-fg` "▲ 37% dari rata-rata" (▼ dan bg `--primary-soft`/`--brand-800` bila turun; sembunyikan bila rata-rata 0).
- "Anggaran Oktober" + "58%" lalu bar 8 px (warna sesuai §7.4 PRD).
- 2 StatTile: "Aman per hari" (bg `--primary-soft`) dan "Saldo semua dompet" (bg `--surface-2`).
- Data: `rpc_home` (`spent_today`, `pct_vs_avg`, `budget_used_pct`, `safe_daily`, `balance_total`), nama bulan siklus.
- Ketuk kartu → `/keuangan`. Mode sembunyikan: semua nominal "Rp •••••".

### 1.3 Grid Layanan (4×2)
| Label | Ikon & warna | Tujuan |
|---|---|---|
| Tugas | Plan, rencana | `/rencana` |
| Kalender | Calendar, rencana | `/rencana/kalender` |
| Kuliah | Cap, kuliah | `/kuliah` |
| Catat | Receipt, keuangan | buka sheet Catat cepat (`?quick=expense`) |
| Tabungan | Target, target | `/keuangan` (scroll ke Target) |
| Investasi | TrendUp, invest | `/keuangan/investasi` |
| Belajar | Book, belajar | `/tumbuh` (scroll ke Belajar mandiri) |
| Rutinitas | Repeat, rutin | `/tumbuh` |

### 1.4 "Hari ini"
- Judul `section-lg` + tautan "Lihat semua" → `/rencana`.
- `ClassCard` kelas berikutnya hari ini (jika ada): "16:30" + "22 mnt lagi" (hanya ≤ 120 mnt), "Pemrograman Web", "Lab Komputer 2 · Bu Rina". Tidak ada kelas → kartu tidak tampil.
- Maks 3 `TaskRow` (skor prioritas): CheckBox (centang → `rpc_task_set_done`, mood happy, kalimat "Satu tugas sudah beres. Mantap!"), judul, meta "Besok 19:00 · Kuliah", `PriorityPill`.
- Kosong: EmptyState kecil "Belum ada tugas hari ini. Mau tambah satu?" + tombol "+ Tugas".

### 1.5 Dua kartu
- Kiri (→ `/keuangan/target/:id`): Ring 56 (`--mod-target-bar` di track `--mod-target-track`) dengan "34%", "Dana darurat", "Rp 1,7 jt / Rp 5 jt" (target prioritas tertinggi aktif). Tidak ada target → "Buat target pertama".
- Kanan (→ `/tumbuh`): kotak 40 `--mod-rutin-bg` + Flame, "4 hari" (`stat`), "Streak harian · Lv 3", bar 6 `--mod-belajar-bar` = progres XP ke level berikutnya.

### 1.6 Kartu "Kata Hamzi"
- bg `--primary-soft` radius 22: ikon Sparkle + "Kata Hamzi" 13/800 + teks kanan 11 "ringkasan hari ini · AI" atau "ringkasan hari ini · templat" (sumber selalu disebut di sini).
- Paragraf 14/1,55.
- Tombol `primary` 40: label dari `action_key` saran pertama (Buat tugas cicil → sheet tugas terisi; Mulai fokus → timer; Catat pengeluaran → sheet; Cek anggaran → `/keuangan/anggaran`; Lihat rutinitas → `/tumbuh`). Tombol kedua varian `outline-soft` "Tanya Hamzi" → `/chat`.

### 1.7 FAB & menu tambah (screenshot 03)
- FAB + → scrim + 3 item SpeedDial (dari bawah ke atas: "Mulai timer belajar", "Tugas baru", "Catat pengeluaran"); FAB berputar 45°; ketuk scrim menutup.

---

## 2. (dicadangkan)

---

## 3. Rencana `/rencana` — `Rencana.dc.html` · screenshot 04, 05, 06

### 3.1 Header
"Senin, 12 Oktober" (overline) + "Rencana"; IconButton Search (→ `/cari`) dan Calendar (→ `/rencana/kalender`).

### 3.2 WeekStrip
Minggu berjalan Sen–Min; hari ini terpilih default; titik = ada tugas/ujian/kelas; ketuk = memilih tanggal (tab Hari ini menampilkan tanggal itu; judul seksi berubah jadi "Selasa, 13 Okt" bila bukan hari ini).

### 3.3 Segmented: Hari ini · Minggu ini · Proyek

**Hari ini**
1. Kartu progres: Ring 52 (`--brand-500` di `--brand-100`) = selesai/total tugas hari itu; "x dari y tugas selesai" 15/800; "Fokus: N tugas prioritas tinggi" 12; chip kanan "+{xp} XP" (`--primary-soft`/`--brand-800`) = XP hari ini dari tugas.
2. "Terlambat · N" (14/800 `--danger-fg`) — kartu `--danger-soft` border `--danger-border`: kotak kosong merah, judul, "Kemarin 23:59 · Proyek PKM" merah, tombol "Tunda" (outline merah) → menu +1 jam / Besok / Akhir pekan.
3. "Hari ini" — `TaskRow` dengan Tag sumber + meta + `PriorityDot`. Centang → toast "Mantap, satu beres! +{xp} XP" + Urungkan (3,5 dtk). FAB disembunyikan saat toast tampil.
4. "Kebiasaan" — grid 3 `HabitTile` (RUT-05) untuk **semua** rutinitas terjadwal hari ini (wajib & tidak; status sama dengan Tumbuh): "5/8" + "Minum air". Ketuk +1, tahan −1. Data di prototipe hanya contoh.

**Minggu ini** — per hari (judul 14/800 "Selasa, 13 Okt"), kartu putih: judul kiri, kanan jam (merah bila tenggat < 24 jam) atau label sumber berwarna (Kuliah ungu, Rutin hijau).

**Proyek** — kartu proyek (PROJ-03): nama 16/800 + Tag jenis; bar 8 warna jenis; "9 dari 20 tugas · 45%" + "Tenggat 30 Nov" / "1 terlambat" (merah) / "Tanpa tenggat"; daftar milestone (✓ dicoret abu, ● tebal, ○ abu). Ketuk → `/rencana/proyek/:id`.

### 3.4 FAB → sheet "Tugas baru"
Field: Judul (wajib), tenggat (chip Hari ini/Besok/Pilih tanggal + jam), prioritas (4 chip), sumber/proyek/matkul (pilih), pengingat (chip 1 jam/1 hari/Tidak). Tombol Simpan 56.

### 3.5 Detail turunan
- `/rencana/tugas/:id`: field sama + subtugas (checklist) + hapus (Urungkan).
- `/rencana/proyek/:id`: header warna jenis, bar, milestone (tambah/ubah), tugas per milestone.
- `/rencana/kalender`: header "Oktober 2026" + panah; grid 7×6 sel 44 (angka + titik warna sumber); daftar agenda hari terpilih di bawah (kelas ungu, tugas biru, ujian oranye, event abu); FAB → sheet **Event baru** (judul, tanggal, jam mulai/selesai atau seharian; CAL-03).

---

## 4. Kuliah `/kuliah` — `Kuliah.dc.html` · screenshot 07, 08

### 4.1 Header
"Semester 6 · Ganjil 2026/2027" + "Kuliah"; IconButton Sliders → `/kuliah/semester`.

### 4.2 Kartu IPK (hero ungu)
bg `--mod-kuliah-hero`, radius 24, lingkaran `#6938EF` & `#7A5AF8`; "IPK saat ini" + 40/800; kanan "Proyeksi akhir semester" + 22/800; 3 tile (`--white-14`): "SKS lulus 95/144", "Target IPK 3,65", "Kehadiran 94%". Data: `rpc_gpa_summary`, `user_settings.target_gpa`, `curriculum_credits`.

### 4.3 Segmented: Jadwal · Tugas kuliah · Nilai

**Jadwal**
- Banner ujian ≤ 3 hari: `--warn-banner-bg` border `--warn-banner-border`, ikon Alert dalam kotak `--warn-bg`, "Kuis Analisis Sistem · H-3", "Kamis 10:00 · bab 1–3 · 2 sesi belajar dijadwalkan".
- "Senin, 12 Okt" + timeline: kolom jam 44 + garis vertikal; kelas lewat = kartu putih opacity .75 + chip "Hadir ✓" (atau "Tandai hadir" kecil bila belum); kelas berikutnya = kartu `--mod-kuliah-bg` border `--mod-kuliah-line`, "22 mnt lagi", tombol "Tandai hadir" (ungu → berubah "Hadir ✓" hijau) dan "Catatan" (sheet catatan pertemuan).
- "Kehadiran per mata kuliah": kartu daftar "6/6 · 100%"; merah + " · batas 75%" bila < batas + 5.
- Tanpa kelas hari ini: "Tidak ada kelas hari ini" + jadwal besok ringkas.

**Tugas kuliah** — kartu: judul 14/700, tenggat relatif kanan (merah bila besok), "Basis Data Lanjut · bobot 10%".

**Nilai**
- "Simulasi IPS semester ini" + "IPS 3,71" (20/800 ungu).
- Teks: "Ketuk nilai untuk mencoba skenario. Target IPK 3,65 butuh IPS ≥ 3,82 · skenario ini belum cukup" (atau "tercapai ✓"; atau "tidak tercapai dengan SKS semester ini").
- Kartu per matkul: nama + "3 SKS"; chip nilai 44×36 radius 12 (terpilih ungu putih) → simpan ke `courses.sim_grade`, IPS & proyeksi di hero dihitung ulang langsung (`common/calc`).
- Bawah: tombol `secondary` "Jadikan nilai resmi" (konfirmasi) untuk matkul yang nilai akhirnya sudah keluar.

### 4.4 Turunan
- `/kuliah/semester`: daftar semester (aktif), tambah semester, daftar matkul (+ tambah: kode, nama, SKS, dosen, ruang, warna, jadwal mingguan multi-baris, target nilai).
- `/kuliah/matkul/:id`: jadwal, kehadiran per pertemuan, komponen nilai (P1), ujian, tugas.
- **Tambahan di luar prototipe (diizinkan):** FAB di Kuliah (gaya sama dengan FAB Beranda) → sheet pilihan: Tugas kuliah, Ujian, Matkul. Uji visual Kuliah mengabaikan area FAB.

---

## 5. Keuangan `/keuangan` — `Keuangan.dc.html` · screenshot 09, 10, 11

### 5.1 Header
"Siklus 1–31 Oktober · sisa 20 hari" + "Keuangan"; tombol pil "3 dompet" (ikon Wallet) → `/keuangan/dompet`.

### 5.2 Kartu saldo (hero hijau)
`--primary` radius 24, lingkaran `brand-600`/`brand-800`; "Saldo semua dompet" + 32/800; 2 tile `--white-14`: "↓ Masuk bulan ini", "↑ Keluar bulan ini". Data: `v_wallet_balance`, `rpc_finance_period(siklus)`.

### 5.3 Kartu Anggaran
"Anggaran Oktober" + "58% dari Rp 2.000.000"; bar 10; tile "Aman per hari" & "Keluar hari ini"; 3 baris kategori (grid 84px/1fr/44px: nama, bar 8, %). Ketuk → `/keuangan/anggaran`. Tanpa anggaran: tombol "Atur anggaran".

### 5.4 "Hari ini · N transaksi"
Kartu daftar: ikon 40 radius 14 (inisial kategori, warna kategori), kategori 14/700, meta "Tunai · 12:30 · nasi padang", nominal kanan "−Rp 25.000" (pemasukan "+Rp …" hijau). Ketuk → edit. Teks kanan judul "N transaksi" adalah tautan → `/keuangan/transaksi`.

### 5.5 "Target & investasi"
Carousel horizontal kartu 160: ikon 36 + nama + bar 6 + "34% · Rp 1,7 jt / 5 jt" atau "60% · nabung Rp 473rb/bln"; kartu investasi: "+2,1%" 18/800 hijau (merah bila negatif) + "Diperbarui manual · 3 hari lalu". **Tambahan di luar prototipe:** kartu terakhir "+ Target" (border putus-putus `--border-strong`).

### 5.6 Sheet Catat cepat (FIN-03, screenshot 10)
Urutan: handle → Segmented "Pengeluaran | Pemasukan" → label "Berapa yang keluar?" + nominal 38/800 (abu bila 0) → chip "5rb" "10rb" "20rb" "50rb" (menambah) → chip kategori (scroll horizontal) → baris "Dompet: Tunai ▾" & "Hari ini, 16:08 ▾" (pemilih) → Keypad → tombol "Simpan" 56 (nonaktif abu bila 0). Catatan opsional lewat ikon kecil di baris dompet (P1). Simpan → tutup, toast "Tersimpan. Sisa aman hari ini Rp {aman_per_hari baru}." (contoh screenshot 11: Rp 40.000 setelah mencatat Rp 25.000), data Beranda/Keuangan diperbarui (optimistic).

### 5.7 Turunan
- `/keuangan/transaksi`: grup per hari (judul + total), cari, filter chip (jenis, kategori, dompet).
- `/keuangan/anggaran`: total + per kategori (input nominal, bar).
- `/keuangan/dompet`: daftar dompet + saldo, tambah, "Pindah saldo" (transfer).
- `/keuangan/target/:id`: ring besar, terkumpul/target, kebutuhan per bulan, status, riwayat setoran, tombol "Setor"/"Tarik".
- `/keuangan/investasi`: total nilai, P/L, daftar aset, disclaimer tetap.

---

## 6. Tumbuh `/tumbuh` — `Belajar.dc.html` · screenshot 12–17

### 6.1 Header
"Rutinitas + belajar mandiri" + "Tumbuh"; chip api kanan (40 tinggi, `--danger-tint`/`--danger-fg`, Flame + "4 hari") = streak.

### 6.2 Kartu pohon
bg `--primary-soft` radius 26, lingkaran `--brand-100` kanan atas; `Tree` 170×160 kiri; kanan: "POHONMU" (overline `--brand-800`), nama tahap 19/800, bar 8 (track putih, isi `--brand-500`), "2 tetes lagi jadi Pohon rindang" 12/600, chip "+1 tetes air" (`--info-bg`/`--info-fg`) 1,8 dtk setelah menyiram (`role=status`). Data: `rpc_growth_overview`.

### 6.3 Segmented: Hari ini · Kalender · Pengingat

**Hari ini** (screenshot 12, 13)
1. "Rutinitas wajib · 2/4" (16/800) + tombol "+ Rutinitas" (36, putih border, teks hijau 800).
2. `RoutineRow` per rutinitas wajib terjadwal hari ini (urut jam pengingat). Ketuk bulatan → `rpc_routine_set`; animasi + chip "+1 tetes air"; bila semua selesai: bunga di pohon + mood happy/excited + kalimat "Semua rutinitas wajib beres. Pohonmu berbunga!".
3. Jenis jumlah: baris menampilkan "5/8" di bulatan dan ketuk menambah.
4. "Kebiasaan lain" (rutinitas tidak wajib) — dilipat bila kosong/disembunyikan.
5. "Belajar mandiri" (16/800) + tombol "+ Modul".
6. `ModuleRow` per modul aktif; ▶ → timer `/tumbuh/sesi?modul=id`; ketuk kartu → `/tumbuh/modul/:id`.
7. Kosong: EmptyState Hamzi calm "Tambah rutinitas pertamamu. Pohonmu mulai dari biji kecil." + 2 tombol.

**Kalender** (screenshot 14) — kartu "Kebun Oktober 2026" + "7 pohon"; panah bulan (← →) di kiri-kanan judul; header hari Sen…Min (11/700); grid `GardenDay` 7 kolom (offset hari pertama); legenda "· kosong · tunas = sebagian · pohon = semua wajib · bunga = + belajar"; kartu detail hari terpilih ("12 Oktober (hari ini)" + kalimat §7.12 PRD). Data: `rpc_garden_month`.

**Pengingat** (screenshot 15)
1. Kartu `--info-bg`: "Pengingat muncul sebagai notifikasi HP walau app ditutup (setelah dipasang ke layar utama). Bisa langsung ditandai selesai dari notifikasi." + tombol "Coba pengingat" (`--info-fg` putih) → Edge `push-test` (offline/izin belum ada → arahkan ke Pengaturan > Notifikasi).
2. `ReminderRow` untuk setiap rutinitas & modul ber-jam, urut jam; Switch = `remind_enabled`.
3. Kartu jam tenang: "Jam tenang 23:00–05:00" + "Pengingat otomatis dari sistem tidak dikirim di jam ini dan maksimal 6 per hari. Pengingat buatanmu selalu dikirim." Ketuk → `/pengaturan/notifikasi`.
4. Bila izin notifikasi belum diberikan: banner kuning di atas "Notifikasi belum aktif" + tombol "Aktifkan".

### 6.4 Sheet "+ Rutinitas" / "+ Modul" (screenshot 16)
Judul 18/800 ("Rutinitas wajib baru" / "Modul belajar baru"); label+input 48 radius 14 ("Nama rutinitas" placeholder "mis. Minum air 8 gelas" / "Nama modul" placeholder "mis. Python untuk data"); rutinitas: chip "Ulangi" (Setiap hari / Sen–Jum / Akhir pekan) + **tambahan di luar prototipe:** tautan teks kecil "Opsi lain" (jenis jumlah & target, wajib/tidak, hari kustom); modul: tambahan tautan "Pakai templat" (BEL-09) di bawah judul sheet; modul: chip "Jumlah unit / bab" (5/10/15/20 unit); baris "Jam pengingat" + `input type=time`; tombol "Simpan" 56 (nonaktif bila nama kosong). Jam di jam tenang → teks peringatan kecil.

### 6.5 Timer fokus `/tumbuh/sesi` (screenshot 17)
Layar penuh `--primary-soft`: tombol ChevronDown (kecilkan; timer tetap jalan dengan chip kecil ikon Clock + "18:20" di atas navigasi bawah pada semua layar), label status "Fokus · 25 menit"/"Dijeda"/"Sesi selesai"; judul modul 18/800 + unit 13; ring 260 (putih, track `--brand-100`, isi `--brand-500`); Hamzi 120 (focus/calm/celebrate) + waktu 44/800 tabular ("Beres!" saat selesai); kalimat Hamzi 14/600 `--brand-800`; bawah: "Jeda/Lanjut" (outline) + "Selesai" (primary) → setelah selesai satu tombol "Siram pohon & kembali", lalu sheet "Unit 7 selesai?" [Ya, tandai] [Belum].

### 6.6 Turunan
- `/tumbuh/modul/:id`: header warna modul, progres, **statistik minggu ini** (menit vs target, BEL-07), pengingat (jam + hari), daftar unit (centang, ubah judul/jenis/tautan, tambah, urutkan), riwayat sesi + tombol "Catat sesi manual" (durasi, tanggal; BEL-08).
- Tumbuh **tidak memiliki FAB** (sesuai prototipe); penambahan lewat tombol "+ Rutinitas"/"+ Modul".
- `/tumbuh/rutinitas/:id`: ubah semua field RUT-01, heatmap 12 minggu, streak per rutinitas, arsipkan.

---

## 7. Chat Hamzi `/chat` — `Chat.dc.html` · screenshot 18–20

| Bagian | Spesifikasi |
|---|---|
| Header | putih, border bawah; ChevronLeft (kembali); lingkaran 44 `--primary-soft` berisi Mascot 44 (mood `focus` saat menunggu, `calm` lain); "Hamzi" 16/800; status 12/600 `--brand-600` ("Asisten · bisa baca file & nambah data" / "sedang membaca & mikir…"); IconButton Shield → `/chat/riwayat` |
| Area pesan | bg `--surface-2`, padding 14/12, gap 10, scroll otomatis ke bawah saat pesan baru; semua item `flex-shrink:0` |
| Chip privasi | pil putih border, ikon Lock, "Hamzi cuma lihat data yang kamu izinkan · aksi selalu minta konfirmasi" |
| Pesan | `ChatBubble`, `FileCard`, `TypingDots`, `ActionCard` (DESIGN-SYSTEM §5) |
| Kartu aksi | checkbox per item (bisa diubah sebelum konfirmasi); "Tambahkan N terpilih"/"Simpan" + "Batal"; "Pilih minimal 1" bila 0; sesudah: "✓ N item ditambahkan ke {dest}" + "Urungkan" / "Dibatalkan, tidak ada yang diubah"; ketuk judul item → sheet ubah sebelum simpan (P1) |
| Komposer | putih border atas; baris chip saran (scroll horizontal, `--primary-soft` border `--brand-200` 12,5/700); bila ada lampiran: baris abu "PDF Kontrak Kuliah IMK.pdf · 4 hlm ×"; baris: tombol Clip 44 abu, input pil 44 ("Ketik perintah atau pertanyaan…", Enter = kirim), tombol kirim 44 (hijau aktif / abu nonaktif) |
| Pertama kali melampirkan | dialog privasi CHAT-09 dengan tombol "Mengerti" (set `chat_privacy_ack`) |
| Kuota habis / offline | pesan Hamzi ramah; input nonaktif dengan teks "Chat tersedia lagi besok" / "Butuh internet" |
| Riwayat | percakapan terakhir dimuat; tombol "Percakapan baru" di menu Shield |

Chip saran di prototipe berisi contoh perintah demo; di app asli gunakan chip berikut (label → aksi): "Rangkum minggu ini" → "Rangkum minggu ini"; "+ Rutinitas" → isi input "tambahin rutinitas " (tidak langsung kirim); "Catat pengeluaran" → isi "jajan "; "Aku boros di mana?" → kirim; "+ Tugas" → isi "ada tugas ".

---

## 8–9. (dicadangkan)

## 10. Riwayat AI `/chat/riwayat`
Daftar kronologis: jenis (Ringkasan/Chat), waktu, penyedia/model, status, tombol "Lihat data terkirim" (JSON terformat: payload ringkasan atau `sent_payload` chat + `tools_used`), umpan balik jempol atas/bawah (ikon SVG, bukan emoji). Bagian atas: toggle privasi AI (§SET-03) dan tombol "Hapus riwayat".

## 11. Notifikasi & Pengaturan
- `/notifikasi`: header "Notifikasi" + gear (→ `/pengaturan`); daftar 14 hari (ikon jenis, judul, badan, waktu relatif, tombol aksi yang masih relevan: "Tandai selesai"/"Tunda"); buka layar = tandai dibaca.
- `/pengaturan`: daftar grup: Profil · Tampilan (tema, mode Minimal, sembunyikan nominal default, mata Hamzi A/B) · Notifikasi (status izin, Aktifkan, panduan baterai, jenis pengingat sistem, jam tenang) · Akademik (skala nilai, total SKS kurikulum, target IPK) · Keuangan (awal siklus, kategori) · Tumbuh ("Tugas juga menyiram pohon") · Privasi AI (AI aktif, chat aktif, per modul, kirim nominal) · Data (export JSON/CSV, impor, pengingat backup) · Diagnostik · Keluar · Hapus akun.

## 12. Masuk, Onboarding, Pencarian
- `/masuk`: latar `--header-bg` + lingkaran dekoratif; Hamzi 120 calm; "Hamzi" 26/800 putih; "Teman kecil untuk rencanamu" 14 `--on-header-sub`; tombol putih "Masuk dengan Google" dan "Kirim tautan ke email" (input email).
- `/onboarding` (AUTH-04): satu langkah per layar, indikator titik, Hamzi menyapa; langkah 5 menampilkan instruksi "Pasang ke layar utama" (bila belum standalone) lalu tombol "Aktifkan pengingat"; langkah 6 panduan baterai + tombol "Coba pengingat"; langkah opsional: pilih saran rutinitas (checkbox).
- `/cari`: input besar, hasil dikelompokkan (Tugas, Proyek, Matkul, Transaksi, Modul, Rutinitas).

## 13. Daftar Screenshot Acuan (`docs/prototype/screens/`)
| File | Isi |
|---|---|
| 01-beranda.png | Beranda atas |
| 02-beranda-bawah.png | Beranda gulir ke bawah (Hari ini, Target, Streak, Kata Hamzi) |
| 03-beranda-menu-tambah.png | Menu FAB terbuka |
| 04-rencana-hari-ini.png | Rencana tab Hari ini |
| 05-rencana-centang-toast.png | Setelah centang tugas + toast |
| 06-rencana-proyek.png | Tab Proyek |
| 07-kuliah-jadwal.png | Kuliah tab Jadwal |
| 08-kuliah-nilai-simulasi.png | Tab Nilai |
| 09-keuangan.png | Keuangan |
| 10-keuangan-catat-cepat.png | Sheet catat cepat (Rp 25.000) |
| 11-keuangan-tersimpan.png | Setelah simpan + toast |
| 12-tumbuh-hari-ini.png | Tumbuh tab Hari ini |
| 13-tumbuh-semua-wajib-selesai.png | Semua rutinitas wajib selesai (bunga) |
| 14-tumbuh-kalender-kebun.png | Tab Kalender |
| 15-tumbuh-pengingat-notifikasi.png | Tab Pengingat + banner notifikasi uji |
| 16-tumbuh-tambah-modul.png | Sheet modul baru |
| 17-tumbuh-timer-fokus.png | Timer fokus |
| 18-chat-rps.png | Chat: ringkasan RPS + kartu usulan |
| 19-chat-perintah-rutinitas.png | Perintah rutinitas → kartu |
| 20-chat-tersimpan.png | Setelah Simpan + Urungkan |
| 21-maskot-8-mood.png | 8 mood Hamzi (orientasi A) |
| 22-maskot-mata-cermin.png | Orientasi B (referensi saja) |
| d01-beranda-chat.png | Desktop 1440×900: Beranda + panel Chat terbuka |
| d02-beranda.png | Desktop Beranda, panel tertutup |
| d03-rencana.png | Desktop Rencana |
| d04-kuliah.png | Desktop Kuliah |
| d05-keuangan.png | Desktop Keuangan |
| d06-keuangan-catat-dialog.png | Dialog catat transaksi (nominal diketik) |
| d07-tumbuh.png | Desktop Tumbuh |
| d08-tumbuh-timer.png | Dialog timer fokus |
| d09-beranda-1280-chat.png | 1280×800 dengan panel chat (header membungkus) |

Catatan: banner notifikasi di screenshot 15 adalah simulasi notifikasi Android; di app asli itu notifikasi sistem, bukan elemen halaman (kecuali sebagai toast saat app sedang terbuka).

## 14. Desktop (≥ 1024 px) — `Desktop-*.dc.html` · screenshot d01–d09
Aturan lengkap di DESIGN-SYSTEM §11. Ringkasnya:
- Sidebar kiri (`DeskSidebar.dc.html`) menggantikan navigasi bawah & FAB; panel Chat kanan (`DeskChat.dc.html`) dibuka dari sidebar, tautan "Ngobrol sama Hamzi →", tombol "Tanya Hamzi", atau tombol `C`.
- Setiap halaman tab memakai **komponen yang sama** dengan versi HP, disusun dua kolom (tabel §11.4). Data, teks, dan perilaku identik dengan versi HP; hanya susunan & kontrol masukan (ketik vs keypad, dialog vs sheet) yang berbeda.
- Layar turunan (detail tugas/proyek/matkul/modul, pengaturan, notifikasi) di desktop tampil di area utama dengan lebar maks 760 px; form sheet → dialog.
- Login & onboarding di desktop: kartu tengah 440 px di atas latar `--header-bg` dengan lingkaran dekoratif.
- Uji: `npm run visual` juga memotret 1440×900 dan 1280×800 untuk d01–d09.
