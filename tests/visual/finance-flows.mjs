// Alur Keuangan lain: transfer, koreksi saldo, dompet baru (+ cek data sensitif), transaksi berulang, anggaran, kategori,
// cari/filter riwayat, aset + valuasi. Jalankan: node tests/visual/finance-flows.mjs (server dev di :5173, data demo).
import { chromium } from '@playwright/test';
const base = 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-12T09:08:00Z'));
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'OK   ' : 'FAIL ') + msg); if (!ok) failed++; };
const toastText = async (re) => { const t = page.getByRole('status').filter({ hasText: re }); await t.waitFor({ timeout: 3000 }); return (await t.innerText()).split('\n')[0]; };
const wait = (ms = 400) => page.waitForTimeout(ms);

await page.goto(base + '/keuangan/dompet', { waitUntil: 'networkidle' });
// transfer 100.000 Bank -> Tunai
await page.getByRole('button', { name: 'Pindah saldo' }).click();
await page.getByLabel('Dari', { exact: true }).selectOption({ label: 'Bank' });
await page.getByLabel('Ke', { exact: true }).selectOption({ label: 'Tunai' });
await page.getByLabel('Nominal').fill('100000');
await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click();
check((await toastText(/dipindahkan/)).includes('Saldo dipindahkan'), 'transfer toast');
await wait();
check(await page.getByText('Rp 450.000').isVisible(), 'Tunai jadi Rp 450.000');
check(await page.getByText('Rp 650.000').isVisible(), 'Bank jadi Rp 650.000');
check(await page.getByText('Rp 1.250.000').first().isVisible(), 'total tetap Rp 1.250.000');
// adjust -50.000 Tunai
await page.getByRole('button', { name: 'Sesuaikan saldo' }).click();
await page.getByRole('button', { name: 'Kurangi (−)' }).click();
await page.getByLabel('Selisih').fill('50000');
check(await page.getByText('Rp 450.000 → Rp 400.000', { exact: false }).isVisible().catch(() => false) || await page.getByRole('dialog').getByText('Rp 400.000').isVisible(), 'pratinjau saldo 450.000 → 400.000');
await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click();
await toastText(/disesuaikan/); await wait();
check(await page.getByText('Rp 1.200.000').first().isVisible(), 'total jadi Rp 1.200.000 setelah koreksi');
// add wallet
await page.getByRole('button', { name: 'Dompet', exact: true }).click();
await page.getByLabel('Nama dompet').fill('Tabungan 1234567890123');
check(await page.getByRole('alert').filter({ hasText: 'nomor panjang' }).isVisible(), 'peringatan data sensitif pada nama dompet');
check(await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).isDisabled(), 'simpan diblokir bila nomor panjang');
await page.getByLabel('Nama dompet').fill('Celengan');
await page.getByLabel('Saldo awal').fill('75000');
await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click();
await wait();
check(await page.getByRole('button', { name: 'Ubah dompet Celengan' }).isVisible(), 'dompet baru tampil');
// recurring add (monthly, start today) then "Catat sekarang"
await page.getByRole('button', { name: '+ Tambah' }).first().click();
await page.getByLabel('Nominal').fill('650000');
await page.getByLabel('Kategori').selectOption({ label: 'Kos & Tagihan' });
await page.getByLabel('Tanggal', { exact: true }).selectOption('12');
await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click();
await wait();
check(await page.getByText('Tiap bulan tgl 12').isVisible(), 'aturan berulang tampil');
await page.getByRole('button', { name: 'Catat sekarang' }).click();
await toastText(/dicatat/); await wait();
check(await page.getByText('berikutnya 12 Nov', { exact: false }).isVisible().catch(() => false) || await page.getByText(/berikutnya .*12 Nov/).isVisible(), 'next_run maju ke 12 Nov');
// budget save: Kuota 200.000
await page.goto(base + '/keuangan/anggaran', { waitUntil: 'networkidle' });
await page.getByLabel('Anggaran Kuota').fill('200000');
await page.getByRole('button', { name: 'Simpan anggaran' }).click();
await toastText(/Anggaran disimpan/); await wait();
check(await page.getByText(/162\.000 · 81%/).isVisible(), 'Kuota 162.000 · 81% dari 200.000');
// category add
await page.getByLabel('Nama kategori baru').fill('Laundry');
await page.getByRole('button', { name: '+ Tambah' }).click();
await wait();
check(await page.getByText('Laundry').first().isVisible(), 'kategori baru tampil');
// transactions search
await page.goto(base + '/keuangan/transaksi', { waitUntil: 'networkidle' });
await page.getByLabel('Cari transaksi').fill('padang');
await wait();
check(await page.getByText('1 transaksi cocok').isVisible(), 'cari "padang" → 1 transaksi');
await page.getByLabel('Cari transaksi').fill('');
await page.getByRole('button', { name: 'Transfer', exact: true }).click();
await wait();
check(await page.getByText('Pindah saldo').first().isVisible(), 'filter Transfer menampilkan pindah saldo');
// asset add
await page.goto(base + '/keuangan/investasi', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Aset', exact: true }).click();
await page.getByLabel('Nama aset').fill('Emas');
await page.getByLabel('Kelas aset', { exact: true }).selectOption('emas');
await page.getByLabel('Modal awal (opsional)').fill('500000');
await page.getByLabel('Nilai sekarang (opsional)').fill('480000');
await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click();
await page.waitForURL(/investasi\/.+/); await wait(800);
check(await page.getByText('−Rp 20.000').isVisible(), 'aset emas rugi −Rp 20.000');
check(await page.getByText('−4%').isVisible(), 'persen −4%');
await page.getByRole('button', { name: 'Perbarui nilai' }).click();
await page.getByLabel(/Nilai Emas sekarang/).fill('520000');
await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click();
await wait(600);
check(await page.getByText('+Rp 20.000').isVisible(), 'setelah update nilai: +Rp 20.000');
await page.goto(base + '/keuangan/investasi', { waitUntil: 'networkidle' });
check(await page.getByText('Emas', { exact: true }).first().isVisible(), 'alokasi memuat Emas');
check(errors.length === 0, 'tanpa error konsol' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? `${failed} gagal` : 'semua lulus');
