# Prototipe UI Hamzi (acuan visual)

Folder ini adalah **sumber kebenaran visual**. Jangan diubah oleh agent; bila desain berubah, pemilik memperbarui file di sini dan screenshot-nya.

## Isi
| File | Layar app |
|---|---|
| `Main.dc.html` | Beranda `/` |
| `Rencana.dc.html` | Rencana `/rencana` |
| `Kuliah.dc.html` | Kuliah `/kuliah` |
| `Keuangan.dc.html` | Keuangan `/keuangan` (+ sheet catat cepat) |
| `Belajar.dc.html` | **Tumbuh** `/tumbuh` (+ sheet rutinitas/modul, timer `/tumbuh/sesi`) |
| `Chat.dc.html` | Chat Hamzi `/chat` |
| `Hamzi.dc.html` | Komponen maskot (`Mascot.tsx`) |
| `Maskot.dc.html` | Papan referensi 8 mood + orientasi mata |
| `Desktop-Beranda/Rencana/Kuliah/Keuangan/Tumbuh.dc.html` | Versi desktop ≥ 1024 px (buka di jendela lebar, mis. 1440×900) |
| `DeskSidebar.dc.html`, `DeskChat.dc.html` | Komponen sidebar & panel Chat desktop |
| `screens/*.png` | Screenshot HP 390×844 (01–22) dan desktop 1440×900 / 1280×800 (d01–d09); daftar di `UI-SPEC.md` §13 |
| `support.js`, `fonts/` | Penampil lokal (Preact + runtime kecil) agar prototipe bisa dibuka tanpa internet |

## Cara membuka
```bash
npx serve docs/prototype        # atau: cd docs/prototype && python3 -m http.server 3000
```
Buka `http://localhost:3000/Main.dc.html`, aktifkan mode perangkat 390×844 di DevTools. Tab bawah berpindah antar file. Semua tombol di prototipe berfungsi dengan **data contoh** (tidak tersimpan).

## Cara membaca kodenya
- Bagian `<x-dc>` = struktur & style (inline). `{{nama}}` = nilai dari fungsi `renderVals()`.
- `<sc-for list="{{items}}" as="x">` = perulangan; `<sc-if value="{{cond}}">` = kondisional; `<dc-import name="Hamzi">` = komponen maskot.
- `<script type="text/x-dc" data-dc-script>` = logika contoh (state, data mock, rumus tampilan). Angka & teks di sini dipakai sebagai mock di M1.
- Saat porting ke React: ubah style inline menjadi kelas Tailwind/token (DESIGN-SYSTEM §2), `<sc-for>` → `.map()`, `<sc-if>` → `&&`, handler `onClick="{{fn}}"` → `onClick={fn}`.
