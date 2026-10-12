# PRD — Hamzi: Plan Tracker Pribadi

> Nama kerja: **Hamzi** (maskot kucing dengan mata huruf hamzah ء). Nama app disimpan di satu konstanta `APP_NAME` agar mudah diganti.
> Dokumen pendamping: `TECH-SPEC.md` (arsitektur, skema DB, kontrak AI), `DESIGN-SYSTEM.md` (token, komponen, maskot), `UI-SPEC.md` (spesifikasi per layar, sesuai prototipe), `FEATURE-CHECKLIST.md` (daftar periksa semua fitur), `BUILD-PLAN.md` (urutan build + prompt), `prototype/` (sumber kebenaran visual), `AGENTS.md` (aturan agent).

| | |
|---|---|
| Versi | **0.2** (disesuaikan dengan prototipe UI yang disetujui pengguna) |
| Tanggal | 12 Oktober 2026 |
| Pemilik | Pengguna tunggal (mahasiswa Sistem Informasi) |
| Platform target | PWA: Android (Chrome, dipasang ke layar utama) + web desktop |
| Biaya target | Rp0 (semua layanan free tier) |
| Bahasa UI | Indonesia (id-ID), mata uang IDR, zona waktu Asia/Jakarta (WIB) |
| Tujuan utama | **Pengingat diri** (rutinitas, belajar, tugas, kuliah) yang menyenangkan; pencatatan keuangan & akademik; AI sebagai tambahan opsional |

**Aturan emas:** tampilan dan perilaku layar mengikuti prototipe di `docs/prototype/` dan `UI-SPEC.md`. Bila PRD dan prototipe berbeda, **PRD menang untuk aturan/rumus, prototipe menang untuk tampilan dan teks UI.** Data di prototipe adalah contoh, bukan data bawaan.

---

## 1. Ringkasan

### 1.1 Masalah
Rencana, deadline kuliah, rutinitas harian, keuangan harian, target tabungan/investasi, dan proses belajar tersebar di banyak tempat. Akibatnya rutinitas tidak konsisten, deadline bentrok, pengeluaran tidak terpantau, dan jam belajar tidak terukur.

### 1.2 Visi
Satu aplikasi pribadi yang halus dan menyenangkan dipakai tiap hari. Isinya **Rencana, Kuliah, Keuangan, Tabungan & Investasi, dan Tumbuh** (rutinitas wajib + belajar mandiri + pohon yang tumbuh + kalender kebun + pengingat). Ada maskot **Hamzi** dan **Chat Hamzi**, asisten AI yang bisa merangkum file dosen, memberi saran dari data pengguna, dan menambahkan data lewat perintah chat **dengan konfirmasi**. Semua yang bisa dilakukan lewat chat juga bisa dilakukan manual.

### 1.3 Tujuan terukur
| ID | Tujuan |
|---|---|
| T1 | Mencatat satu transaksi ≤ 5 detik dan ≤ 3 ketukan (tidak termasuk mengetik angka) dari layar mana pun. |
| T2 | Seluruh fitur berjalan di free tier tanpa biaya bulanan. |
| T3 | Terasa seperti app native di Android: ikon sendiri, layar penuh, cold start < 2 detik pada perangkat menengah. |
| T4 | **Pengingat sampai di HP** walau app ditutup (push), dengan tombol aksi langsung di notifikasi; tetap berfungsi tanpa AI. |
| T5 | Data yang dikirim ke AI dapat diaudit di "Riwayat AI"; mode ringkasan otomatis hanya mengirim agregat. |
| T6 | Tidak ada kehilangan data: export penuh (JSON/CSV) dan pengingat backup berkala. |
| T7 | Semua rumus (IPK, anggaran, proyeksi tabungan, pohon, streak) dihitung kode dan punya unit test; AI tidak pernah menghitung angka. |

### 1.4 Non-tujuan (v1)
- Bukan aplikasi multi-pengguna/kolaborasi/sosial.
- Tidak terhubung ke rekening bank, e-wallet, atau broker; tidak ada harga pasar real-time.
- Tidak memberi rekomendasi produk investasi spesifik.
- Bukan app native di Play Store (PWA cukup).
- Tidak untuk data pekerjaan internal/instansi atau data responden survei.
- iOS tidak menjadi target pengujian (diusahakan jalan, tidak dijamin).
- AI **tidak boleh** menghapus atau mengubah data yang sudah ada; AI hanya mengusulkan data baru yang dikonfirmasi pengguna.

---

## 2. Konteks Pengguna
- Pengguna tunggal: mahasiswa Sistem Informasi semester 6, HP Android dan laptop.
- Pola pakai: buka berkali-kali sehari dengan sesi singkat (centang rutinitas, catat pengeluaran, centang tugas, mulai timer), dan review mingguan.
- AI dipakai **sesekali** (beberapa kali per minggu); fungsi utama adalah pengingat.
- Konektivitas tidak selalu stabil: pencatatan harus tetap bisa dilakukan offline.
- Pemilik adalah developer yang membangun dengan coding agent (Antigravity).

---

## 3. Prinsip Produk
1. **Mengingatkan dengan lembut.** Pengingat tepat waktu, bisa ditindaklanjuti dari notifikasi, tanpa membuat merasa bersalah.
2. **Cepat dulu.** Input harian harus lebih cepat daripada membuka catatan biasa.
3. **Tumbuh, bukan dihukum.** Pohon hanya bertambah; hari yang terlewat tidak mengurangi apa pun.
4. **AI menafsirkan, kode menghitung.** Angka dihitung kode; AI merangkum dan mengusulkan.
5. **AI mengusulkan, pengguna memutuskan.** Setiap perubahan data dari AI lewat kartu konfirmasi dan bisa diurungkan.
6. **Privasi bawaan.** Tidak ada nomor rekening/kartu/NIK; semua data terlindungi RLS; data yang dikirim ke AI dapat diaudit.
7. **Halus dan hidup.** Animasi lembut, maskot responsif, bisa dimatikan (mode Minimal).
8. **Gratis dan portabel.** Free tier; export kapan saja; tidak terkunci pada satu vendor AI.
9. **Bertahap.** Setiap milestone menghasilkan app yang bisa dipakai.

---

## 4. Peta Modul & Prioritas

Prioritas: **P0** = wajib v1, **P1** = penting di v1, **P2** = setelah v1 (tetap dispesifikasikan agar tidak hilang).

| Kode | Modul | Isi utama | Prioritas | Milestone |
|---|---|---|---|---|
| AUTH | Auth & Onboarding | Login, onboarding, panduan notifikasi | P0 | M0 |
| HOME | Beranda | Header, kartu pengeluaran, grid layanan, hari ini, target, streak, Kata Hamzi, menu tambah | P0 | M1–M9 |
| TASK | Tugas | CRUD, prioritas, subtugas, Hari ini/Minggu ini, terlambat, tunda | P0 | M2 |
| PROJ | Proyek & Milestone | Proyek, milestone, progres | P0 | M2 |
| CAL | Kalender | Agenda gabungan | P0/P1 | M2 |
| RUT | Rutinitas | Rutinitas wajib & kebiasaan (centang/jumlah), jadwal, pengingat | P0 | M3 |
| BEL | Belajar mandiri | Modul → unit, timer fokus, target mingguan | P0 | M3 |
| TUM | Pohon & Kebun | Tetes air, tahap pohon, kalender kebun, streak | P0 | M3 |
| NOT | Pengingat & Notifikasi | Push Android, aksi di notifikasi, jam tenang, kotak notifikasi | P0 | M4 |
| FIN | Keuangan | Dompet, transaksi, catat cepat, anggaran, ringkasan | P0 | M5 |
| KUL | Kuliah | Semester, matkul, jadwal, kehadiran, ujian, nilai, IPS/IPK, simulasi | P0 | M6 |
| GOAL | Target Tabungan | Target, setoran, proyeksi, dana darurat | P0 | M7 |
| INV | Investasi | Portofolio manual, P/L | P1 | M7 |
| MAS | Maskot & Gamifikasi | Hamzi 8 mood, mesin mood, XP, level | P0 (komponen) / P1 (mesin mood) | M1, M8 |
| OFF | Offline & Sinkron | Cache baca, antrean tulis | P1 | M8 |
| AI | Ringkasan AI | Kata Hamzi harian, review mingguan, privasi, ketahanan | P1 | M9 |
| CHAT | Chat Hamzi | Chat, baca file dosen, aksi lewat perintah, bagikan ke Hamzi | P1 | M9 |
| SET | Pengaturan & Data | Tema, privasi, export/impor, diagnostik | P0/P1 | M0–M10 |
| SRCH | Pencarian & Tambah cepat | Pencarian global, sheet tambah cepat, shortcut | P0/P1 | M2–M10 |
| DESK | Tampilan desktop | Sidebar, dua kolom, panel chat kanan, dialog, pintasan keyboard | P0 | M1 (kerangka) + tiap milestone |

---

## 5. Arsitektur Informasi

**Navigasi bawah (5 tab, urutan tetap):** Beranda · Rencana · Kuliah · Keuangan · **Tumbuh**.
- **Chat Hamzi** (`/chat`) dibuka dari: balon omongan Hamzi di header Beranda, tombol "Tanya Hamzi" di kartu Kata Hamzi, menu Bagikan Android, dan (desktop) panel kanan.
- **Notifikasi** (`/notifikasi`) dari ikon lonceng di header Beranda.
- **Pengaturan** (`/pengaturan`) dari ikon gear di header layar Notifikasi (Beranda › lonceng › gear), dari kartu "Jam tenang" di Tumbuh › Pengingat (→ `/pengaturan/notifikasi`), dan dari sidebar desktop. Header Beranda **tidak** ditambah tombol lain (sesuai prototipe: hanya mata dan lonceng).
- Tombol **+** (FAB) kontekstual per tab.

| Tab | Isi (segmented) |
|---|---|
| Beranda | Header + kartu pengeluaran, grid Layanan 4×2, Hari ini, Target + Streak, Kata Hamzi |
| Rencana | Strip minggu · **Hari ini · Minggu ini · Proyek** (Kebiasaan muncul di Hari ini) |
| Kuliah | Kartu IPK · **Jadwal · Tugas kuliah · Nilai** |
| Keuangan | Saldo · Anggaran · Hari ini · Target & investasi |
| Tumbuh | Kartu pohon · **Hari ini · Kalender · Pengingat** |

Rute lengkap: `DESIGN-SYSTEM.md` §9. Detail per layar: `UI-SPEC.md`.

---

## 6. Spesifikasi Fungsional

Format ID: `MODUL-NN`. AC = acceptance criteria. Setiap ID dipetakan ke layar, milestone, dan test di `FEATURE-CHECKLIST.md`.

### 6.1 AUTH — Auth & Onboarding
| ID | Kebutuhan | P |
|---|---|---|
| AUTH-01 | Login dengan Google OAuth atau email magic link (Supabase Auth). | P0 |
| AUTH-02 | Pendaftaran publik dinonaktifkan setelah akun pemilik dibuat (langkah manual terdokumentasi). | P0 |
| AUTH-03 | Sesi persisten, logout dari semua perangkat. | P0 |
| AUTH-04 | Onboarding 6 langkah: nama panggilan → tanggal awal siklus anggaran (default 1) → dompet awal → anggaran bulanan total (boleh lewati) → **pasang ke layar utama + izinkan notifikasi** → **panduan baterai** (matikan optimasi baterai untuk Chrome; tampilkan langkah untuk Xiaomi/Oppo/Vivo/Samsung secara umum). | P0 |
| AUTH-05 | Kunci PIN lokal. | P2 |
| AUTH-06 | Hapus akun beserta seluruh data (konfirmasi dua langkah). | P1 |

AC: tanpa login semua rute → `/masuk`; onboarding sekali; pengguna kedua tidak bisa mendaftar; langkah notifikasi bisa dilewati dan diulang dari Pengaturan > Notifikasi.

### 6.2 HOME — Beranda
| ID | Kebutuhan | P |
|---|---|---|
| HOME-01 | Header hijau `brand-700` dengan 3 lingkaran dekoratif. Isinya: salam sesuai waktu WIB ("Selamat pagi/siang/sore/malam,") + nama panggilan, tombol mata (sembunyikan nominal), tombol lonceng dengan titik bila ada notifikasi belum dibaca. | P0 |
| HOME-02 | Hamzi (76 px, mood dari mesin mood) + balon omongan berisi satu kalimat konteks + tautan "Ngobrol sama Hamzi →" ke `/chat`. Ketuk Hamzi = reaksi singkat (ganti mood sesaat + kalimat acak dari bank dialog). | P0 |
| HOME-03 | Kartu mengambang "Pengeluaran hari ini": nominal, badge perbandingan vs rata-rata 7 hari (▲/▼ %), bar anggaran bulan berjalan (%), tile "Aman per hari" dan "Saldo semua dompet". | P0 |
| HOME-04 | Grid Layanan 4×2: Tugas, Kalender, Kuliah, Catat, Tabungan, Investasi, Belajar, Rutinitas → deep link (lihat UI-SPEC). | P0 |
| HOME-05 | "Hari ini": kelas berikutnya hari ini (jam, "N mnt lagi", ruang, dosen) + maks 3 tugas teratas (skor prioritas §7.9) yang bisa dicentang, dengan pil prioritas (Tinggi/Sedang/Rendah/Kritis); "Lihat semua" → Rencana. | P0 |
| HOME-06 | Dua kartu: target tabungan teratas (ring %, terkumpul/target) dan streak harian + level (bar XP ke level berikutnya). | P0 |
| HOME-07 | Kartu "Kata Hamzi": ringkasan AI harian atau templat lokal; tombol aksi utama (dari saran pertama, mis. "Buat tugas cicil") + tombol "Tanya Hamzi" → `/chat`. | P1 (templat P0) |
| HOME-08 | FAB + membuka menu: Catat pengeluaran, Tugas baru, Mulai timer belajar. | P0 |
| HOME-09 | Mode sembunyikan nominal mengganti semua nominal dengan "Rp •••••" di semua layar. | P0 |
| HOME-10 | Skeleton saat memuat, empty state dengan maskot. | P0 |

AC: dari cache Beranda tampil < 1 detik pada kunjungan kedua; tampilan sesuai `prototype/Main.dc.html` dan screenshot `01`, `02`, `03`.

### 6.3 TASK — Tugas
| ID | Kebutuhan | P |
|---|---|---|
| TASK-01 | Buat/ubah/hapus (soft delete + toast Urungkan 3,5 detik) tugas: judul, catatan, tenggat (tanggal + jam opsional), prioritas (Rendah/Sedang/Tinggi/Kritis), status, tag sumber (Kuliah/Belajar/Keuangan/Pribadi/Proyek). | P0 |
| TASK-02 | Hubungkan ke proyek, milestone, atau mata kuliah. | P0 |
| TASK-03 | Subtugas dengan progres; ditampilkan "N subtugas" di meta. | P0 |
| TASK-04 | Tab **Hari ini**: kartu progres (ring "x dari y tugas selesai", baris "Fokus: N tugas prioritas tinggi", chip "+XP" hari ini), seksi **Terlambat · N** (merah, tombol Tunda), seksi **Hari ini** (urut skor prioritas), seksi **Kebiasaan** (RUT-05). | P0 |
| TASK-05 | Tab **Minggu ini**: tugas 7 hari ke depan dikelompokkan per hari (judul hari "Selasa, 13 Okt"), sisi kanan: jam / label sumber. | P0 |
| TASK-06 | Strip minggu Sen–Min di atas: hari dipilih memfilter "Hari ini" ke tanggal itu; titik hijau = ada item. | P0 |
| TASK-07 | Centang selesai: animasi, toast "Mantap, satu beres! +10 XP" dengan **Urungkan** (3,5 detik), XP sesuai §7.8. | P0 |
| TASK-08 | Tunda cepat dari tombol **Tunda** di app: geser tenggat +1 jam / besok (jam sama) / Sabtu terdekat. Dari **notifikasi**, "Tunda 1 jam" hanya mengingatkan lagi 1 jam kemudian (tenggat tidak berubah). | P0 |
| TASK-09 | Pengulangan (harian, mingguan hari tertentu, bulanan, setiap N hari). | P1 |
| TASK-10 | Pengingat: offset sebelum tenggat (default 1 jam; opsi 1 hari). | P0 |
| TASK-11 | View tambahan "Semua" dan "Matriks Eisenhower" dari menu filter. | P2 |
| TASK-12 | Filter (status, prioritas, proyek, matkul, tag) di pencarian. | P1 |

AC: tugas terlambat tampil di seksi Terlambat; tugas berulang membuat instance berikutnya tepat satu kali; tampilan sesuai `prototype/Rencana.dc.html`.

### 6.4 PROJ — Proyek & Milestone
| ID | Kebutuhan | P |
|---|---|---|
| PROJ-01 | Proyek: nama, deskripsi, jenis (Kuliah/Pribadi/Skill/Lomba), warna, tenggat, status. | P0 |
| PROJ-02 | Milestone (judul, tenggat, status selesai/berjalan/belum) dan tugas di bawahnya. | P0 |
| PROJ-03 | Kartu proyek di tab Proyek: nama, chip jenis, bar progres, "x dari y tugas · z%", tenggat atau "N terlambat" (merah) atau "Tanpa tenggat", daftar milestone (✓ selesai dicoret, ● berjalan tebal, ○ belum). | P0 |
| PROJ-04 | "Pecah dengan AI": AI mengusulkan milestone + tugas; ditinjau sebelum disimpan (lewat Chat Hamzi). | P1 |

### 6.5 CAL — Kalender
| ID | Kebutuhan | P |
|---|---|---|
| CAL-01 | Kalender bulan `/rencana/kalender` (dari ikon kalender di header Rencana dan grid Beranda): titik per hari; ketuk hari → daftar agenda. | P0 |
| CAL-02 | Sumber: tugas bertenggat, ujian, jadwal kuliah, event pribadi, rutinitas (opsional filter). | P0 |
| CAL-03 | Event pribadi (judul, mulai/selesai, seharian). | P1 |
| CAL-04 | Ekspor .ics. | P2 |

### 6.6 RUT — Rutinitas (rutinitas wajib & kebiasaan)
Satu entitas **routine** dipakai untuk "Rutinitas wajib" (tab Tumbuh) dan "Kebiasaan" (Rencana > Hari ini).

| ID | Kebutuhan | P |
|---|---|---|
| RUT-01 | Rutinitas: nama (≤ 60), jenis **centang** atau **jumlah** (target N per hari, mis. Minum air 8), **wajib** (ya/tidak, default ya), jadwal ulang (**Setiap hari / Sen–Jum / Akhir pekan / hari tertentu**), jam pengingat (opsional), pengingat aktif, ikon/warna, arsip. | P0 |
| RUT-02 | Tambah dari tombol "+ Rutinitas" (sheet: nama, chip Ulangi, jam pengingat, Simpan) atau dari Chat Hamzi. | P0 |
| RUT-03 | Centang/ketuk menandai selesai untuk **hari WIB ini**; jenis jumlah: ketuk = +1, tahan = −1; selesai bila mencapai target. Membatalkan centang di hari yang sama diperbolehkan. | P0 |
| RUT-04 | Tumbuh > Hari ini menampilkan **Rutinitas wajib · x/y** (rutinitas wajib yang terjadwal hari ini): bulatan centang, nama, "Setiap hari · wajib", chip lonceng + jam. Baris selesai berlatar hijau muda. Rutinitas tidak wajib tampil di seksi "Kebiasaan lain" di bawahnya (boleh dilipat). | P0 |
| RUT-05 | Rencana > Hari ini > **Kebiasaan**: grid 3 kolom **semua** rutinitas terjadwal hari ini (wajib maupun tidak; data & status sama dengan Tumbuh — ini akses cepat, bukan data terpisah), menampilkan "n/target" + nama; ketuk = +1 (jenis centang: 0/1). Kartu penuh berlatar merah muda. | P0 |
| RUT-06 | Ubah/arsipkan rutinitas dari detail (`/tumbuh/rutinitas/:id`): riwayat 12 minggu (heatmap), streak per rutinitas. | P1 |
| RUT-07 | Memenuhi rutinitas memberi tetes air (TUM-02) dan XP (§7.8). | P0 |

AC: rutinitas "Sen–Jum" tidak muncul dan tidak diingatkan pada Sabtu/Minggu; membatalkan centang menarik kembali tetes air hari itu.

### 6.7 BEL — Belajar mandiri
Struktur: **Modul** (mis. "SQL & Basis Data") → **Unit** (mis. "Unit 7 · Normalisasi").

| ID | Kebutuhan | P |
|---|---|---|
| BEL-01 | Modul: judul, kategori (Pemrograman/Basis Data/Statistik/Bahasa/Sertifikasi/Kuliah/Lainnya), warna (otomatis bergilir), target menit/minggu (default 120), jam pengingat + hari, pengingat aktif, status. | P0 |
| BEL-02 | "+ Modul" (sheet): nama, jumlah unit (chip 5/10/15/20), jam pengingat → membuat N unit "Unit 1…N" (estimasi 30 mnt). | P0 |
| BEL-03 | Unit: judul, jenis (Video/Bacaan/Latihan/Proyek/Kuis), tautan, estimasi menit, status, catatan. Detail modul `/tumbuh/modul/:id` untuk mengubah unit. | P0 |
| BEL-04 | Kartu modul di Tumbuh > Hari ini: inisial berwarna, judul, "done/total", bar progres, meta "Berikutnya: Unit X · ingat HH:MM" atau "Sudah belajar hari ini · …" atau "tanpa pengingat", tombol ▶ bulat. | P0 |
| BEL-05 | **Timer fokus** layar penuh (`/tumbuh/sesi`): durasi default 25 mnt; judul modul + unit berikutnya; ring progres; Hamzi mood `focus` saat jalan, `calm` saat jeda, `celebrate` saat selesai; tombol Jeda/Lanjut + Selesai; tombol kecilkan (timer tetap berjalan, chip di header). Timer berbasis timestamp (tahan layar mati). | P0 |
| BEL-06 | Selesai sesi: catat `study_session` (durasi aktual); bila ≥ 10 menit beri tetes air (TUM-02); tampil "Beres!" + "Kerja bagus! Pohonmu dapat 1 tetes air." + tombol "Siram pohon & kembali"; lalu tanya "Unit X selesai?" [Ya, tandai] [Belum]. | P0 |
| BEL-07 | Target mingguan total & per modul; statistik menit minggu ini. | P1 |
| BEL-08 | Catat sesi manual (durasi, tanggal). | P1 |
| BEL-09 | Template modul (Dasar Web, SQL & Basis Data, Statistika Dasar, Python untuk Data, UI/UX Dasar, Bahasa Inggris Akademik). | P1 |
| BEL-10 | Kartu ulasan (spaced repetition). | P2 |

AC: kunci layar 5 menit saat timer jalan → sisa waktu tetap benar; sesi < 10 menit tercatat tetapi tidak memberi tetes air.

### 6.8 TUM — Pohon, Kebun & Streak
| ID | Kebutuhan | P |
|---|---|---|
| TUM-01 | Kartu pohon di atas tab Tumbuh: ilustrasi pohon sesuai **tahap** (§7.11), label "POHONMU", nama tahap, bar progres ke tahap berikutnya, teks "N tetes lagi jadi {tahap}", chip "+1 tetes air" sesaat setelah menyiram. Bila semua rutinitas wajib hari ini selesai: bunga merah muda muncul di sekitar pohon. | P0 |
| TUM-02 | **Tetes air** didapat dari: rutinitas terpenuhi (1 per rutinitas per hari), **setiap sesi** belajar yang durasinya sendiri ≥ 10 menit (1 per sesi, maks 3 per hari), dan opsional tugas selesai (pengaturan "Tugas juga menyiram pohon", default mati, maks 3 per hari). Membatalkan aksi di hari yang sama menarik tetes air itu. | P0 |
| TUM-03 | Pohon **tidak pernah layu/mati** dan tetes air tidak pernah berkurang karena hari terlewat. | P0 |
| TUM-04 | Tab **Kalender**: "Kebun {Bulan Tahun}" + jumlah pohon bulan ini; grid Sen–Min; tiap hari menampilkan ikon level (§7.12): titik (kosong), tunas, bibit, pohon; bunga bila ada sesi belajar ≥ 10 menit; hari depan abu-abu; hari ini bergaris putus-putus; ketuk hari → kartu detail ("Semua rutinitas wajib selesai, jadi satu pohon di kebun."). Legenda di bawah. Navigasi bulan sebelumnya/berikutnya. | P0 |
| TUM-05 | **Streak harian** (chip api di header Tumbuh dan kartu Beranda) sesuai §7.13. | P0 |
| TUM-06 | Ganti jenis pohon per semester/bulan (koleksi pohon). | P2 |

### 6.9 NOT — Pengingat & Notifikasi
| ID | Kebutuhan | P |
|---|---|---|
| NOT-01 | Web Push ke Android (PWA terpasang) + **kotak notifikasi dalam app** (`/notifikasi`) sebagai cadangan dan riwayat 14 hari. | P0 |
| NOT-02 | **Pengingat buatan pengguna** (selalu dikirim pada jamnya, ±1 menit): rutinitas (jam + hari terjadwal), modul belajar (jam + hari), tugas (offset sebelum tenggat). | P0 |
| NOT-03 | **Pengingat sistem** (maks 6 per hari, tidak dikirim di jam tenang): kelas 30 menit sebelum mulai, ujian H-3 & H-1 pukul 19:00, "Catat pengeluaran hari ini?" 21:00, anggaran 80% & 100%, review mingguan Minggu 19:00, setoran target (tanggal rencana), pengingat backup 14 hari, valuasi investasi bulanan, ringkasan pagi 07:00 (default mati). | P0/P1 |
| NOT-04 | **Tombol aksi di notifikasi**: rutinitas → "Tandai selesai" / "Tunda 10 mnt"; modul → "Mulai sekarang" / "Tunda 10 mnt"; tugas → "Selesai" / "Tunda 1 jam"; kelas → "Tandai hadir"; catat pengeluaran → "Catat". Aksi selesai/tunda bekerja tanpa membuka app. | P0 |
| NOT-05 | Tab Tumbuh > **Pengingat**: kartu info + tombol "Coba pengingat" (mengirim push uji sungguhan); daftar semua pengingat buatan pengguna urut jam (jam, nama, jenis "Rutinitas wajib · Setiap hari" / "Belajar mandiri · 25 mnt"), toggle per item; kartu jam tenang. | P0 |
| NOT-06 | Jam tenang default **23:00–05:00** (dapat diubah); berlaku untuk pengingat sistem. Jika pengguna memilih jam pengingat di dalam jam tenang, form memberi peringatan tetapi tetap mengizinkan. | P0 |
| NOT-07 | Ketuk notifikasi membuka layar terkait (deep link). | P0 |
| NOT-08 | Isi notifikasi tidak memuat nominal atau data sensitif. Judul = nama rutinitas/modul/tugas (milik pengguna sendiri), badan = kalimat Hamzi, mis. "Pohonmu nunggu disiram. Cuma butuh sebentar." | P0 |
| NOT-09 | Halaman Pengaturan > Notifikasi: status izin & langganan, tombol aktifkan ulang, panduan baterai, toggle per jenis pengingat sistem. | P0 |

AC: dengan app ditutup dan layar terkunci, pengingat rutinitas 06:00 tiba antara 06:00–06:01 WIB; menekan "Tandai selesai" di notifikasi menambah tetes air tanpa membuka app; rutinitas yang sudah selesai sebelum jamnya tidak diingatkan.

### 6.10 FIN — Keuangan
| ID | Kebutuhan | P |
|---|---|---|
| FIN-01 | Dompet: nama, jenis (Tunai/Bank/E-wallet/Lainnya), ikon, warna, saldo awal. **Tanpa kolom nomor rekening/kartu.** Tombol "N dompet" di header → `/keuangan/dompet`. | P0 |
| FIN-02 | Transaksi: Pengeluaran/Pemasukan/Transfer, nominal integer rupiah, kategori, dompet, waktu (default sekarang), catatan opsional ≤ 140. | P0 |
| FIN-03 | **Catat cepat** (sheet dari FAB, shortcut, Beranda): segmented Pengeluaran/Pemasukan; label "Berapa yang keluar?/masuk?"; nominal besar; chip cepat "5rb" "10rb" "20rb" "50rb" (masing-masing **menambah** nominal); chip kategori (5 terbanyak dipakai + "Lainnya"); baris "Dompet: Tunai ▾" dan "Hari ini, HH:MM ▾"; keypad 1–9, 000, 0, ⌫; tombol Simpan (nonaktif bila 0). Setelah simpan: sheet tertutup, toast "Tersimpan. Sisa aman hari ini Rp X." | P0 |
| FIN-04 | Kategori default (singkat, cocok untuk chip): Pengeluaran — Makan, Transport, Kuota, Belanja, Kos & Tagihan, Pendidikan, Kesehatan, Hiburan, Sosial, Lainnya. Pemasukan — Kiriman, Gaji, Usaha, Bonus, Lainnya. Bisa ditambah/diubah/diarsipkan. | P0 |
| FIN-05 | Anggaran bulanan total + per kategori; siklus mulai `budget_cycle_day`; warna bar hijau < 80%, kuning ≥ 80%, merah ≥ 100%. | P0 |
| FIN-06 | Layar Keuangan: kartu hijau saldo semua dompet + "↓ Masuk bulan ini" & "↑ Keluar bulan ini"; kartu Anggaran (persen dari total, bar, tile "Aman per hari" & "Keluar hari ini", 3 kategori teratas dengan bar %); daftar transaksi Hari ini; carousel "Target & investasi". | P0 |
| FIN-07 | Riwayat transaksi (`/keuangan/transaksi`): per hari, cari, filter, edit/hapus + Urungkan. | P0 |
| FIN-08 | Transfer antar dompet dari layar Dompet ("Pindah saldo"). | P0 |
| FIN-09 | Transaksi berulang (otomatis / minta konfirmasi). | P1 |
| FIN-10 | Export CSV. | P0 |
| FIN-11 | Detektor data sensitif (≥ 9 digit, email, pola kartu) di catatan & nama dompet. | P0 |
| FIN-12 | Laporan mingguan/bulanan, donut kategori, tren. | P1 |
| FIN-13 | Koreksi saldo (transaksi `adjustment` dengan arah + atau −) dari layar Dompet. | P1 |

AC: saldo dihitung (bukan disimpan); setelah simpan, Beranda dan Keuangan berubah tanpa reload; tampilan sesuai `prototype/Keuangan.dc.html` dan screenshot `09–11`.

### 6.11 KUL — Kuliah
| ID | Kebutuhan | P |
|---|---|---|
| KUL-01 | Semester (nomor, label mis. "Ganjil 2026/2027", tanggal, satu aktif). Header: "Semester N · {label}". | P0 |
| KUL-02 | Mata kuliah: kode, nama, SKS, dosen (tidak dikirim ke AI otomatis), ruang, warna, nilai target, batas kehadiran (default 75%), nilai akhir. | P0 |
| KUL-03 | Kartu ungu IPK: "IPK saat ini", "Proyeksi akhir semester" (§7.1), tile SKS lulus x/total-kurikulum (default 144, dapat diubah), Target IPK, Kehadiran (rata-rata semua matkul semester aktif). | P0 |
| KUL-04 | Tab **Jadwal**: banner ujian ≤ 3 hari ("Kuis Analisis Sistem · H-3", detail + jumlah sesi belajar terjadwal); timeline kelas hari ini (jam, nama, jam–jam · ruang · dosen, chip status "Hadir ✓" atau "N mnt lagi"); kelas berikutnya menampilkan tombol "Tandai hadir" dan "Catatan"; seksi "Kehadiran per mata kuliah" (hadir/terlaksana · %, merah bila < batas + 5 poin dengan teks "batas 75%"). | P0 |
| KUL-05 | Tab **Tugas kuliah**: tugas yang terhubung ke matkul (judul, tenggat relatif, matkul · bobot/jenis). | P0 |
| KUL-06 | Tab **Nilai**: "Simulasi IPS semester ini" + IPS besar; teks "Target IPK X butuh IPS ≥ Y · skenario ini tercapai ✓/belum cukup" (§7.2); per matkul chip nilai (A, B+, B, C+, C) → IPS & proyeksi dihitung ulang langsung. Pilihan simulasi disimpan di kolom `courses.sim_grade` (bukan nilai resmi) dan dapat "Jadikan nilai resmi". Chip hanya menampilkan nilai dengan bobot ≥ 2 (default A, B+, B, C+, C); nilai resmi D/E diisi di detail matkul. | P0 |
| KUL-07 | Kehadiran per pertemuan (Hadir/Izin/Sakit/Alpa); "Tandai hadir" membuat catatan pertemuan hari ini. | P0 |
| KUL-08 | Ujian (Kuis/UTS/UAS/Praktikum), tanggal-jam, materi; pengingat H-3 & H-1. | P0 |
| KUL-09 | Komponen nilai per matkul (bobot %, skor) + nilai proyeksi + kebutuhan nilai komponen tersisa. | P1 |
| KUL-10 | **Mode ujian**: H-7 sebelum UTS/UAS, sistem mengusulkan pembagian materi jadi sesi belajar harian (draf, dikonfirmasi) dan pengingat belajar harian di hari-hari itu. | P2 |
| KUL-11 | Impor jadwal dari foto KRS/jadwal lewat Chat Hamzi (usulan dikonfirmasi). | P1 (lewat CHAT) |

AC: IPS/IPK lulus test vector TECH-SPEC §13; tampilan sesuai `prototype/Kuliah.dc.html`, screenshot `07–08`.

### 6.12 GOAL — Target Tabungan
| ID | Kebutuhan | P |
|---|---|---|
| GOAL-01 | Target: nama, jenis (Dana Darurat/Barang/Pendidikan/Investasi/Lainnya), nominal, tenggat opsional, ikon, warna, prioritas. | P0 |
| GOAL-02 | Setoran & penarikan; progres = terkumpul ÷ target. | P0 |
| GOAL-03 | Kebutuhan per bulan (§7.5) + status Di jalur/Terlambat/Selesai; kartu di carousel Keuangan menampilkan "34% · Rp 1,7 jt / 5 jt" atau "60% · nabung Rp 473rb/bln". | P0 |
| GOAL-04 | Proyeksi 3 skenario (asumsi, bukan jaminan). | P1 |
| GOAL-05 | Dana darurat otomatis = N × rata-rata pengeluaran bulanan. | P1 |
| GOAL-06 | Jadwal setoran + pengingat. | P1 |
| GOAL-07 | Perayaan maskot 25/50/75/100%. | P1 |
| GOAL-08 | Menautkan target ke aset investasi. | P2 |

### 6.13 INV — Investasi (manual)
| ID | Kebutuhan | P |
|---|---|---|
| INV-01 | Aset (nama generik, kelas, label platform opsional). | P1 |
| INV-02 | Transaksi aset (beli/setor/jual/tarik). | P1 |
| INV-03 | Valuasi manual + "Diperbarui manual · N hari lalu" pada kartu. | P1 |
| INV-04 | Modal bersih, nilai, untung/rugi (nominal & %), alokasi. | P1 |
| INV-05 | Disclaimer tetap: pencatatan pribadi, bukan saran investasi. | P1 |

### 6.14 MAS — Maskot & Gamifikasi
| ID | Kebutuhan | P |
|---|---|---|
| MAS-01 | Komponen `<Mascot mood size mirror? still? />` port 1:1 dari `prototype/Hamzi.dc.html` (SVG, 8 mood, mata = path hamzah). | P0 |
| MAS-02 | Mesin mood dari konteks (DESIGN-SYSTEM §6.4): calm default; happy setelah centang; excited saat streak/level naik; focus saat timer/AI berproses; worried saat tenggat < 24 jam atau anggaran ≥ 80%; sleepy setelah 23:00 atau absen 2 hari; sleeping absen ≥ 3 hari; celebrate saat target 25/50/75/100%. | P1 |
| MAS-03 | XP & level (§7.8); level tampil di Beranda. | P0 |
| MAS-04 | Bank dialog lokal `lines.id.ts` (≥ 40 baris). | P0 |
| MAS-05 | Mode Minimal (tanpa animasi/konfeti; maskot statis kecil). | P1 |
| MAS-06 | Lencana & aksesori. | P2 |

### 6.15 OFF — Offline & Sinkron
| ID | Kebutuhan | P |
|---|---|---|
| OFF-01 | Shell & data terakhir tersedia offline. | P1 |
| OFF-02 | Outbox untuk: transaksi, tugas, log rutinitas, sesi belajar, setoran; idempoten lewat `id` UUID buatan klien. | P1 |
| OFF-03 | Indikator sinkron; last-write-wins. | P1 |
| OFF-04 | AI, chat, push, export penuh menampilkan pesan offline yang jelas. | P1 |

### 6.16 AI — Ringkasan AI
| ID | Kebutuhan | P |
|---|---|---|
| AI-01 | Ringkasan harian (Kata Hamzi) dari payload agregat; dibuat saat app dibuka pertama kali hari itu; fallback templat lokal. | P1 |
| AI-02 | Review mingguan: notifikasi sistem Minggu 19:00 "Review mingguanmu siap" → membuka `/chat?review=minggu`; saat dibuka, klien memanggil `ai-generate` (`weekly_review`) lalu menyimpan hasilnya sebagai pesan Hamzi di percakapan (ringkasan + 3 prioritas minggu depan + kartu aksi opsional). | P1 |
| AI-03 | Kontrol privasi: toggle per modul, kirim nominal ya/tidak, Riwayat AI (payload + respons). | P1 |
| AI-04 | Ketahanan: cache, batas harian, fallback Gemini → Groq → templat, validasi skema, grounding angka. | P1 |
| AI-05 | Batasan isi: tanpa rekomendasi produk investasi, tanpa janji hasil, Bahasa Indonesia, ramah. | P1 |

### 6.17 CHAT — Chat Hamzi
| ID | Kebutuhan | P |
|---|---|---|
| CHAT-01 | Layar `/chat`: header (kembali, avatar Hamzi 44 px dengan mood, "Hamzi", status "Asisten · bisa baca file & nambah data" / "sedang membaca & mikir…", ikon perisai → Riwayat AI & izin); chip info "Hamzi cuma lihat data yang kamu izinkan · aksi selalu minta konfirmasi"; gelembung pengguna (hijau, kanan) dan Hamzi (putih, kiri); indikator mengetik; chip saran di atas input; tombol lampiran; input; tombol kirim (nonaktif bila kosong). | P1 |
| CHAT-02 | **Lampiran**: PDF, JPG, PNG, WebP ≤ 10 MB (≤ 20 halaman disarankan); kartu file di gelembung pengguna (ikon jenis, nama, "PDF · N halaman"). Hamzi merangkum dan mengusulkan aksi. | P1 |
| CHAT-03 | **Perintah bahasa alami → kartu aksi**. Hamzi membalas dengan kartu "Usulan …" berisi item ber-checkbox (chip jenis: Tugas/Ujian/Modul/Rutinitas/Keluar/Masuk/Jadwal/Event, judul, detail). Tombol "Tambahkan N terpilih" / "Simpan" (1 item) dan "Batal". Setelah disimpan: "✓ N item ditambahkan ke {modul}" + **Urungkan**. Dibatalkan: "Dibatalkan, tidak ada yang diubah". | P1 |
| CHAT-04 | **Aksi yang diizinkan** (hanya membuat data baru): tambah tugas, tambah rutinitas, tambah modul belajar (+unit), catat pengeluaran/pemasukan, tambah ujian, tambah jadwal kelas, tambah event, tambah setoran target. **Tidak ada** hapus, ubah data lama, transfer, ubah pengaturan. Permintaan di luar itu dijawab dengan penjelasan + tautan ke layar terkait. | P1 |
| CHAT-05 | **Pertanyaan tentang data** ("rangkum minggu ini", "aku boros di mana?") dijawab memakai alat baca agregat; angka hanya dari hasil alat. | P1 |
| CHAT-06 | Chip saran default: "Rangkum minggu ini", "+ Rutinitas", "Catat pengeluaran", "Aku boros di mana?", "+ Tugas". Ketuk chip = mengisi/mengirim contoh perintah. | P1 |
| CHAT-07 | **Bagikan ke Hamzi**: app muncul di menu Bagikan Android (PWA share target); file/teks yang dibagikan membuka `/chat` dengan lampiran siap kirim. | P1 |
| CHAT-08 | Riwayat percakapan tersimpan (30 hari, bisa dihapus); file lampiran dihapus otomatis setelah 7 hari. | P1 |
| CHAT-09 | Peringatan privasi saat pertama kali melampirkan file: "File dibaca oleh Gemini (gratis). Jangan unggah KTP, data nilai/identitas orang lain, atau nomor rekening." Detektor sensitif memperingatkan sebelum kirim teks yang memuat nomor panjang/email. | P1 |
| CHAT-10 | Batas pemakaian: maks 30 pesan chat/hari (konfigurasi); saat kuota habis atau AI gagal: pesan ramah + saran memakai menu manual; fungsi app lain tidak terpengaruh. | P1 |
| CHAT-11 | "Pecah proyek dengan AI" dan "Buat modul dari silabus" adalah perintah chat biasa yang menghasilkan kartu aksi. | P1 |

AC: perintah "tambahin rutinitas minum air 8 gelas jam 9 pagi" menghasilkan kartu Rutinitas (nama "Minum air 8 gelas", jenis jumlah target 8 atau centang, Setiap hari, pengingat 09:00); menekan Simpan membuatnya muncul di Tumbuh dan Pengingat; Urungkan menghapusnya (soft delete). Tidak ada data yang berubah tanpa menekan tombol konfirmasi.

### 6.18 SET — Pengaturan & Data
| ID | Kebutuhan | P |
|---|---|---|
| SET-01 | Profil (nama panggilan), tema (Terang/Gelap/Sistem), awal siklus anggaran, total SKS kurikulum, target IPK. | P0 |
| SET-02 | Skala nilai (default §7.1), default timer, jam tenang, "Tugas juga menyiram pohon". | P0 |
| SET-03 | Privasi AI: AI aktif, chat aktif, toggle per modul, kirim nominal, Riwayat AI. | P1 |
| SET-04 | Export JSON + CSV; impor/restore JSON. | P0 |
| SET-05 | Pengingat backup 14 hari. | P1 |
| SET-06 | Mode Minimal; sembunyikan nominal (nilai tersimpan `user_settings.hide_amounts`, sama dengan tombol mata; default mati). | P1 |
| SET-07 | Diagnostik: versi, status sinkron, status push, ukuran DB, kuota AI hari ini. | P1 |
| SET-08 | Hapus akun. | P1 |

### 6.19 DESK — Tampilan Desktop (pengguna sering memakai laptop)
| ID | Kebutuhan | P |
|---|---|---|
| DESK-01 | ≥ 1024 px: sidebar kiri 240 px (5 tab + Chat Hamzi + Notifikasi + Pengaturan + kartu streak/level) menggantikan navigasi bawah dan FAB. | P0 |
| DESK-02 | Setiap halaman tab memakai susunan dua kolom sesuai DESIGN-SYSTEM §11.4 dan prototipe `Desktop-*.dc.html`. | P0 |
| DESK-03 | Panel Chat Hamzi kanan 380 px yang bisa dibuka/tutup di semua halaman; status diingat; seret-lepas file ke panel. | P1 |
| DESK-04 | Sheet → dialog tengah 440 px; catat transaksi dengan nominal diketik (tanpa keypad) dan Enter untuk simpan. | P0 |
| DESK-05 | Pintasan keyboard N/E/T/R/"/"/C/Esc; fokus terlihat; hover state. | P1 |
| DESK-06 | Header halaman berisi tombol aksi utama (+ Tambah/+ Catat/…) dan pencarian di Beranda. | P0 |
| DESK-07 | Tablet 768–1023: navigasi bawah tetap, konten maks 640 px di tengah. | P1 |

### 6.20 SRCH — Pencarian & Tambah cepat
| ID | Kebutuhan | P |
|---|---|---|
| SRCH-01 | Pencarian global (tugas, proyek, matkul, transaksi, modul, rutinitas) dari ikon cari di Rencana. | P1 |
| SRCH-02 | Parameter `?quick=expense|income|task|timer|routine|module` membuka sheet terkait. | P0 |
| SRCH-03 | PWA shortcuts: Catat pengeluaran, Tambah tugas, Mulai belajar, Chat Hamzi. | P1 |

---

## 7. Aturan Bisnis & Rumus

Semua rumus di `supabase/functions/_shared/common/calc/*` (diimpor klien via alias `@common/calc`; fungsi murni + unit test, test vector `TECH-SPEC.md` §13). Uang selalu integer rupiah. "Hari" = hari kalender WIB.

### 7.1 Nilai, IPS, IPK
- Skala default (dapat diubah): **A=4,0; B+=3,5; B=3,0; C+=2,5; C=2,0; D=1,0; E=0**.
- Rentang angka→huruf default: ≥85 A, ≥80 B+, ≥70 B, ≥65 C+, ≥55 C, ≥40 D, <40 E.
- `IPS = Σ(bobot × SKS) / Σ SKS` (matkul bernilai di semester itu). `IPK` sama untuk semua semester; matkul diulang → nilai terbaru menggantikan.
- **Proyeksi akhir semester** = IPK bila matkul semester aktif memakai nilai: resmi bila ada, selain itu pilihan simulasi, selain itu nilai target matkul; matkul tanpa satu pun dilewati.
- **Pembulatan tampilan**: IPS/IPK dibulatkan *half-up* 2 desimal (3,5625 → **3,56**; 3,565 → **3,57**; 3,7059 → **3,71**). Nilai **minimal yang dibutuhkan** dibulatkan **ke atas** 2 desimal (3,8176 → **3,82**).

### 7.2 Target IPK
- `rata_rata_dibutuhkan = (target × (SKS_selesai + SKS_sisa) − poin_terkumpul) / SKS_sisa`; > 4,0 → "tidak tercapai".
- **IPS dibutuhkan semester ini** = rumus yang sama dengan `SKS_sisa = SKS semester aktif` (contoh: IPK 3,62 dari 95 SKS, semester 17 SKS, target 3,65 → **3,82**).

### 7.3 Kehadiran
`persen = hadir / pertemuan_terlaksana × 100`; peringatan merah bila `persen < batas + 5`. Kehadiran di kartu IPK = rata-rata persen semua matkul semester aktif (dibulatkan).

### 7.4 Anggaran & "aman per hari"
- Periode dimulai `budget_cycle_day` (1–28). `hari_tersisa` termasuk hari ini (min 1).
- `hari_tersisa = tanggal_akhir_siklus − hari_ini + 1` (contoh: 12 Okt pada siklus 1–31 Okt → **20**; header Keuangan "sisa 20 hari").
- `sisa = anggaran − terpakai`; `aman_per_hari = floor(max(0, sisa) / hari_tersisa / 1000) × 1000` (dibulatkan ke bawah ke ribuan untuk tampilan).
- Badge Beranda: `(pengeluaran_hari_ini − rata2_7hari) / rata2_7hari` dibulatkan → "▲ 37% dari rata-rata" / "▼ …"; bila rata-rata 0 → sembunyikan badge.
- Warna bar anggaran: < 80% hijau, 80–99% kuning, ≥ 100% merah.

### 7.5 Target tabungan
- `progres = terkumpul / target` (tampilan maks 100%).
- `bulan_tersisa = max(1, ceil(hari_ke_tenggat / 30,4375))`; `kebutuhan_per_bulan = ceil((target − terkumpul) / bulan_tersisa)`.
- Dengan return `r`/thn, `i = r/12`: `FV = C(1+i)^n + P((1+i)^n − 1)/i`; `P = (Target − C(1+i)^n) / (((1+i)^n − 1)/i)` dibulatkan ke atas.

### 7.6 Dana darurat
`target = N × rata-rata pengeluaran bulanan 3 bulan terakhir` (N default 6).

### 7.7 Investasi
`modal_bersih = Σbeli+setor − Σjual+tarik`; `UL = nilai_terkini − modal_bersih`; `UL% = UL / modal_bersih`.

### 7.8 XP & level
- XP: tugas selesai 10 × (1 / 1,2 / 1,5 / 2) untuk Rendah/Sedang/Tinggi/Kritis (dibulatkan); rutinitas terpenuhi 5; sesi belajar 1 per 5 menit (maks 60/hari); catat transaksi 2 (maks 3/hari); semua rutinitas wajib hari itu selesai +10 bonus; target belajar mingguan 50; target tabungan 25/50/75/100% = 20/30/40/100.
- XP ke level berikutnya: `100 + 50 × (level − 1)`; level dari total XP kumulatif (0–99 → Lv 1, 100–249 → Lv 2, 250–449 → Lv 3, …). XP ditarik kembali bila aksi diurungkan di hari yang sama.

### 7.9 Skor prioritas tugas
`skor = bobot_prioritas(1/2/3/4 → 10/20/35/50) + urgensi (terlambat +60, ≤24 jam +40, ≤72 jam +20) + keterkaitan (ujian/proyek ≤ 7 hari +10)`; seri dipecah tenggat lalu waktu dibuat.

### 7.10 Lain-lain
- Simpan UTC, tampilkan WIB. Soft delete + purge 30 hari.
- "N mnt lagi" untuk kelas berikutnya hanya bila ≤ 120 menit; selain itu tampil jam saja.

### 7.11 Pohon (tahap)
`total_air = jumlah water_events`. Tahap berdasarkan ambang:

| Tetes air | Tahap | Ilustrasi |
|---|---|---|
| 0–4 | Biji | biji + kecambah kecil |
| 5–14 | Tunas | batang + 2 daun |
| 15–29 | Bibit | batang + 4 daun |
| 30–49 | Pohon muda | batang + 1 tajuk |
| 50–79 | Pohon rindang | batang bercabang + 3 tajuk |
| ≥ 80 | Pohon berbuah | rindang + buah oranye |

`progres_ke_tahap_berikutnya = (air − ambang_tahap_ini) / (ambang_berikutnya − ambang_tahap_ini)`. Tahap terakhir: progres 100% + teks "Sudah tahap tertinggi. Kebunmu bertambah tiap bulan."

### 7.12 Level kebun harian
Untuk hari D: `W` = rutinitas **wajib** yang terjadwal di D, `S` = yang terpenuhi.
- "Belajar" pada aturan ini = **total menit sesi belajar hari D ≥ 10** (gabungan semua sesi).
- W = 0: level 0 (titik), kecuali belajar → level 3.
- S = 0 → 0; 0 < S/W < 0,5 → 1 (tunas); 0,5 ≤ S/W < 1 → 2 (bibit); S = W → 3 (pohon).
- **Bunga** bila level 3 dan belajar (total ≥ 10 menit) di hari D.
- "Jumlah pohon" bulan = jumlah hari level 3.
- Bunga di kartu pohon (TUM-01) = hari ini level 3.

### 7.13 Streak harian
Hari **memenuhi syarat** bila level kebun = 3 **atau** total menit belajar hari itu ≥ 10. Streak = jumlah hari berturut-turut memenuhi syarat sampai kemarin, **ditambah 1 bila hari ini sudah memenuhi syarat**. (Hari ini yang belum memenuhi syarat tidak memutus streak sampai hari berganti.)

---

## 8. Kebutuhan Non-Fungsional

| ID | Kategori | Kebutuhan |
|---|---|---|
| NFR-01 | Performa | LCP < 2,5 dtk di Android menengah 4G; JS awal ≤ 250 KB gzip; 60 fps; interaksi < 100 ms. |
| NFR-02 | PWA | Installable, standalone, ikon maskable, shortcuts, share target, update dengan prompt. |
| NFR-03 | Pengingat | Ketepatan ±1 menit untuk pengingat buatan pengguna (penjadwal tiap menit); retry sekali bila gagal. |
| NFR-04 | Keamanan | RLS semua tabel; kunci hanya di backend; CSP; validasi zod; tanpa analitik pihak ketiga. |
| NFR-05 | Privasi | Tanpa nomor rekening/kartu/NIK; mode ringkasan otomatis hanya agregat; chat mengirim teks/file yang pengguna kirim + hasil alat; semua tercatat di Riwayat AI. |
| NFR-06 | Aksesibilitas | Kontras ≥ 4,5:1; target sentuh ≥ 44–48 px; `prefers-reduced-motion`; label ARIA; font 130% tidak merusak layout. |
| NFR-07 | Keandalan | Tanpa kehilangan data offline→online; tulis idempoten. |
| NFR-08 | Biaya | Seluruhnya free tier; Diagnostik memperingatkan DB > 70% dari 500 MB dan Storage > 70%. |
| NFR-09 | Kompatibilitas | Chrome Android 2 versi terakhir; Chrome/Edge/Firefox/Safari desktop. |
| NFR-10 | Pemeliharaan | TS strict, lint, test, migrasi berversi, ADR. |
| NFR-11 | Lokalisasi | "Rp 1.250.000", "Sen, 12 Okt 2026", 24 jam, minggu mulai Senin, desimal koma (3,62). |
| NFR-12 | Kesesuaian visual | Setiap layar dibandingkan dengan screenshot prototipe (`docs/prototype/screens/`) pada viewport 390×844 (HP) dan 1440×900 (desktop, `d*.png`); selisih tata letak/teks/warna dianggap bug. |
| NFR-13 | Responsif | Tanpa scroll horizontal dari 360 px sampai 1920 px; HP < 768, tablet 768–1023, desktop ≥ 1024 (DESIGN-SYSTEM §11). |

---

## 9. Privasi AI

### 9.1 Mode ringkasan otomatis (Kata Hamzi, review mingguan)
- Hanya payload agregat dari RPC + allowlist (TECH-SPEC §7.2). Tanpa catatan transaksi, nama dompet, nama dosen, nama target/aset, atau nomor apa pun.
- Default: saldo/tabungan/investasi hanya persen.

### 9.2 Mode Chat Hamzi
- Yang dikirim ke AI: teks yang pengguna ketik, file yang pengguna lampirkan, riwayat percakapan (maks 12 pesan terakhir), dan **hasil alat baca** (agregat yang menghormati `ai_share`).
- Tidak pernah dikirim otomatis: catatan transaksi, nama dompet, nama dosen, isi tabel mentah.
- Redaksi otomatis (nomor ≥ 9 digit, email, nomor telepon) pada teks pengguna sebelum dikirim; pengguna diperingatkan.
- Isi file diperlakukan sebagai **data**, bukan perintah; aksi apa pun dari isi file tetap harus dikonfirmasi pengguna.
- Free tier penyedia dapat memakai prompt untuk peningkatan produk; karena itu peringatan CHAT-09 wajib tampil.

---

## 10. Roadmap & Definition of Done

Urutan disusun agar **pengingat** (tujuan utama) jalan lebih awal dan AI paling akhir.

| Milestone | Isi | Definition of Done |
|---|---|---|
| **M0 Fondasi** | Repo, stack, token, router 5 tab, Supabase (Auth, migrasi, RLS), PWA shell, CI, deploy | Login; sign-up publik nonaktif; PWA terpasang di Android; 5 tab kosong; CI hijau |
| **M1 UI Kit & Layar Statis** | Port semua layar prototipe (HP **dan desktop**) ke komponen React dengan data contoh (mock), komponen Mascot, sheet/dialog, toast, sidebar, panel chat | Setiap layar cocok dengan screenshot prototipe HP & desktop (NFR-12); semua interaksi lokal prototipe berjalan dengan mock |
| **M2 Rencana** | TASK (termasuk pengulangan), PROJ, CAL (termasuk event), HOME-05/08, kerangka Pengaturan (profil, tampilan) | Tugas/proyek CRUD; Hari ini/Minggu ini/Proyek; kalender; Beranda "Hari ini" nyata |
| **M3 Tumbuh** | RUT, BEL (termasuk statistik, sesi manual, templat), TUM, XP/level, streak, Pengaturan Tumbuh | Rutinitas & modul CRUD; timer; tetes air, tahap pohon, kalender kebun, streak lulus test vector |
| **M4 Pengingat** | NOT, penjadwal Cloudflare, aksi notifikasi, kotak notifikasi, panduan baterai, keep-alive | Push tiba saat app ditutup; "Tandai selesai" dari notifikasi bekerja; jam tenang; uji 3 hari berturut |
| **M5 Keuangan** | FIN-01…13, HOME-03/09, onboarding langkah 1–4, Pengaturan Keuangan | Catat cepat ≤ 3 ketukan; anggaran & aman per hari benar; export CSV |
| **M6 Kuliah** | KUL-01…09, Pengaturan Akademik | Jadwal & kehadiran; IPS/IPK/proyeksi/simulasi lulus test vector |
| **M7 Target & Investasi** | GOAL-01…07, INV-01…05 | Progres & kebutuhan/bulan benar; carousel Keuangan nyata |
| **M8 Maskot hidup & Offline** | MAS-02/05, OFF-01…04 | Mesin mood; outbox teruji putus-sambung |
| **M9 AI & Chat Hamzi** | AI-01…05, CHAT-01…11, HOME-07 | Kata Hamzi; chat dengan file & kartu aksi; Urungkan; share target; Riwayat AI; fallback saat kuota habis |
| **M10 Poles & Rilis** | NFR, SET, SRCH, export/impor, diagnostik, P2 terpilih (mode ujian, koleksi pohon) | Lighthouse ≥ 90; semua item P0/P1 di FEATURE-CHECKLIST tercentang; uji pakai 14 hari |

---

## 11. Metrik Keberhasilan (pribadi)
- ≥ 80% hari dalam sebulan mencapai level kebun ≥ 2.
- Pengingat yang ditindaklanjuti (selesai/tunda) ≥ 60%.
- Median waktu catat transaksi ≤ 5 detik.
- ≥ 3 sesi belajar per minggu.
- Nol insiden data hilang; nol biaya bulanan.

---

## 12. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Project Supabase gratis di-pause setelah 7 hari aktivitas rendah (dokumentasi tidak menjamin pg_cron dihitung sebagai aktivitas) | App & pengingat berhenti | Penjadwal eksternal Cloudflare Worker memanggil Edge Function tiap menit (= permintaan API nyata) + ping harian GitHub Actions cadangan; cara "Resume project" didokumentasikan |
| Push Android ditahan penghemat baterai | Pengingat terlambat | Panduan baterai di onboarding, urgency high, kotak notifikasi dalam app |
| Kuota/kebijakan AI gratis berubah | AI/chat gagal | Abstraksi penyedia, fallback, templat lokal, batas harian; fitur inti tidak bergantung AI |
| Prompt free tier dipakai penyedia | Kebocoran data | Agregat untuk ringkasan; peringatan & redaksi di chat; Riwayat AI |
| Prompt injection dari file | Aksi tak diinginkan | AI hanya bisa mengusulkan data baru; selalu kartu konfirmasi; tanpa alat hapus/ubah |
| Tidak ada backup harian di free tier | Kehilangan data | Export JSON + pengingat 14 hari |
| Scope membengkak | Tidak selesai | Milestone berurutan; P2 di M10 |
| Agent (Gemini Flash) menyimpang dari desain | UI tidak sesuai | Prototipe + screenshot sebagai acuan; M1 khusus port UI; checklist |
| Rendering glyph Arab berbeda antar perangkat | Mata maskot tidak konsisten | Mata = SVG path, bukan teks |

---

## 13. Keputusan (sudah ditetapkan)

| # | Topik | Keputusan |
|---|---|---|
| 1 | Nama app | "Hamzi" (nama kerja), konstanta `APP_NAME` |
| 2 | Arti "siluet" | Bentuk membulat, kartu lembut, lingkaran dekoratif di header; **bukan** gradien |
| 3 | Mata hamzah | Opsi **A** (kedua mata identik); konstanta `EYE_MIRROR = false` (opsi B tersedia di komponen) |
| 4 | Tab bawah | Beranda · Rencana · Kuliah · Keuangan · Tumbuh |
| 5 | Skala nilai | A/B+/B/C+/C/D/E = 4/3,5/3/2,5/2/1/0 (bisa diubah di Pengaturan) |
| 6 | Siklus anggaran | Tanggal 1 (bisa diubah) |
| 7 | Sembunyikan nominal default | Mati |
| 8 | PIN lokal | Tidak di v1 (P2) |
| 9 | Target ↔ aset | P2 |
| 10 | Domain | `*.pages.dev` |
| 11 | Sumber tetes air | Rutinitas + sesi belajar; tugas opsional (default mati) |
| 12 | Jam tenang | 23:00–05:00, hanya untuk pengingat sistem |
| 13 | Penjadwal | Cloudflare Worker Cron → Edge Function `scheduler-tick` tiap menit |
| 14 | Chatbot | Gemini (function calling + baca file), Groq cadangan teks; aksi = usulan + konfirmasi |

Pertanyaan yang masih terbuka (tidak menghalangi build): nama final app; jenis pohon per semester (P2).

---

## 14. Glosarium
- **PWA**: web app yang bisa dipasang ke layar utama.
- **RLS**: Row Level Security PostgreSQL.
- **Agregat**: ringkasan angka tanpa data mentah.
- **Outbox**: antrean tulis lokal yang dikirim saat online.
- **Tetes air**: poin pertumbuhan pohon dari rutinitas/belajar.
- **Level kebun**: tingkat pencapaian rutinitas wajib satu hari (0–3).
- **Kartu aksi**: usulan data dari Chat Hamzi yang harus dikonfirmasi.
- **Function calling**: kemampuan model AI memanggil "alat" yang didefinisikan app.
- **Share target**: kemampuan PWA muncul di menu Bagikan Android.
