// Cek alur Catat cepat (FIN-03): simpan 25.000 → toast "Sisa aman hari ini Rp 40.000" (HP & desktop) + Urungkan.
//   node tests/visual/finance-check.mjs [--base=http://localhost:5173]
import { chromium } from '@playwright/test';

const opt = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const base = opt.base ?? process.env.BASE ?? 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'OK   ' : 'FAIL ') + msg); if (!ok) failed++; };

async function run(desktop) {
  const ctx = await browser.newContext({ viewport: desktop ? { width: 1440, height: 900 } : { width: 390, height: 844 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta', acceptDownloads: true });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-10-12T09:08:00Z'));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + '/keuangan', { waitUntil: 'networkidle' });
  await page.getByText('Saldo semua dompet').first().waitFor();
  const tag = desktop ? '[desktop]' : '[hp]';
  if (desktop) {
    await page.keyboard.press('e');
    const input = page.getByLabel('Berapa yang keluar?');
    await input.waitFor();
    await input.fill('25000');
    check((await input.inputValue()) === '25.000', `${tag} format otomatis "25.000"`);
    await input.press('Enter');
  } else {
    await page.getByRole('button', { name: 'Catat transaksi' }).click();
    const dlg = page.getByRole('dialog', { name: 'Catat transaksi' });
    await dlg.waitFor();
    for (const k of ['2', '5', '000']) await dlg.getByRole('button', { name: k, exact: true }).click();
    check(await dlg.getByText('Rp 25.000').isVisible(), `${tag} nominal tampil Rp 25.000`);
    await dlg.getByRole('button', { name: 'Simpan' }).click();
  }
  const toast = page.getByRole('status').filter({ hasText: 'Tersimpan' });
  await toast.waitFor({ timeout: 3000 });
  const text = (await toast.innerText()).trim();
  check(text.includes('Tersimpan. Sisa aman hari ini Rp 40.000.'), `${tag} toast: ${text.split('\n')[0]}`);
  await page.waitForTimeout(400);
  const count = desktop ? page.getByText('4 transaksi · lihat semua') : page.getByText('4 transaksi', { exact: true });
  check(await count.isVisible(), `${tag} daftar hari ini jadi 4 transaksi`);
  check(await page.getByText('Rp 1.225.000').first().isVisible(), `${tag} saldo jadi Rp 1.225.000`);
  await page.getByRole('button', { name: 'Urungkan' }).click();
  await page.waitForTimeout(600);
  const count3 = desktop ? page.getByText('3 transaksi · lihat semua') : page.getByText('3 transaksi', { exact: true });
  check(await count3.isVisible(), `${tag} Urungkan → kembali 3 transaksi`);
  if (desktop) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
    const { readFileSync } = await import('node:fs');
    const buf = readFileSync(await dl.path());
    const txt = buf.toString('utf8');
    check(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, `${tag} CSV diawali BOM UTF-8 (${dl.suggestedFilename()})`);
    check(txt.includes('Tanggal,Jam,Jenis,Kategori,Dompet,Ke dompet,Nominal,Catatan') && txt.includes('2026-10-12,12:30,Pengeluaran,Makan,Tunai,,-25000,nasi padang'), `${tag} CSV berisi header & baris transaksi`);
  }
  check(errors.length === 0, `${tag} tanpa error konsol${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

async function extra() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-10-12T09:08:00Z'));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // Ubah transaksi: Makan 25.000 → 30.000 → sisa aman (2.000.000 − 1.165.000) / 20 = 41.750 → Rp 41.000
  await page.goto(base + '/keuangan', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Ubah Makan' }).click();
  const dlg = page.getByRole('dialog', { name: 'Ubah transaksi' });
  await dlg.waitFor();
  check(await dlg.getByText('Rp 25.000').isVisible(), '[edit] nominal awal Rp 25.000');
    for (let i = 0; i < 5; i++) await dlg.getByRole('button', { name: 'Hapus', exact: true }).click();
  for (const k of ['3', '000', '0']) await dlg.getByRole('button', { name: k, exact: true }).click();
  await dlg.getByRole('button', { name: 'Simpan' }).click();
  const t1 = page.getByRole('status').filter({ hasText: 'Tersimpan' });
  await t1.waitFor({ timeout: 3000 });
  check((await t1.innerText()).includes('Sisa aman hari ini Rp 41.000.'), `[edit] toast: ${(await t1.innerText()).split('\n')[0]}`);
  check(await page.getByText('3 transaksi', { exact: true }).isVisible(), '[edit] tetap 3 transaksi');
  // Target: Laptop baru 60% → setor 2.400.000 → 80% (lewat 75%)
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Tabungan' }).click();
  await page.waitForTimeout(700);
  const box = await page.locator('#target').boundingBox();
  check(!!box && box.y >= 0 && box.y + box.height <= 844 - 76, `[hash] Beranda › Tabungan → /keuangan#target terlihat (y=${box ? Math.round(box.y) : '–'})`);
  await page.getByRole('link', { name: /Laptop baru/ }).first().click();
  await page.getByRole('button', { name: 'Setor', exact: true }).click();
  await page.getByLabel('Nominal').fill('2400000');
  await page.getByRole('dialog').getByRole('button', { name: 'Setor', exact: true }).last().click();
  const t2 = page.getByRole('status').filter({ hasText: 'Mantap' });
  await t2.waitFor({ timeout: 3000 });
  check((await t2.innerText()).includes('Laptop baru sudah 75%'), `[goal] toast: ${(await t2.innerText()).split('\n')[0]}`);
  check(await page.getByText('80%').first().isVisible(), '[goal] ring jadi 80%');
  check(errors.length === 0, `[extra] tanpa error konsol${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

await run(false);
await run(true);
await extra();
await browser.close();
if (failed) { console.log(`${failed} cek gagal`); process.exit(1); }
console.log('Semua cek lulus');
