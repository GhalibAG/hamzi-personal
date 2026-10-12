// Alur kritis HP (390×844), data demo segar per test.
import { test, expect } from './fixtures';

test('catat pengeluaran 25.000 → toast sisa aman Rp 40.000 + Urungkan', async ({ page }) => {
  await page.goto('/keuangan?quick=expense');
  for (const k of ['2', '5', '000']) await page.getByRole('button', { name: k, exact: true }).click();
  await page.getByRole('button', { name: /^Simpan/ }).click();
  await expect(page.getByText(/Tersimpan\. Sisa aman hari ini Rp 40\.000/)).toBeVisible();
  await expect(page.getByText('4 transaksi')).toBeVisible();
  await page.getByRole('button', { name: 'Urungkan' }).click();
  await expect(page.getByText('3 transaksi')).toBeVisible();
});

test('centang rutinitas wajib → tetes air bertambah', async ({ page }) => {
  await page.goto('/tumbuh');
  await expect(page.getByText('4 tetes lagi jadi Pohon rindang')).toBeVisible();
  await page.getByRole('button', { name: /Catat pengeluaran hari ini/ }).and(page.locator('[aria-pressed="false"]')).first().click();
  await expect(page.getByText('3 tetes lagi jadi Pohon rindang')).toBeVisible();
  await expect(page.getByText('+1 tetes air').first()).toBeVisible();
});

test('tambah tugas lewat sheet → muncul di Rencana', async ({ page }) => {
  await page.goto('/rencana?quick=task');
  await page.getByLabel(/Judul/).fill('Kerjakan kuis online e2e');
  await page.getByRole('button', { name: /^Simpan/ }).click();
  await expect(page.getByText('Kerjakan kuis online e2e')).toBeVisible();
});

test('centang tugas → toast XP → Urungkan', async ({ page }) => {
  await page.goto('/rencana');
  await page.getByRole('button', { name: /^Tandai selesai: Baca bab 3/ }).click();
  await expect(page.getByText(/Mantap, satu beres! \+\d+ XP/)).toBeVisible();
  await page.getByRole('button', { name: 'Urungkan' }).click();
  await expect(page.getByRole('button', { name: /^Tandai selesai: Baca bab 3/ })).toBeVisible();
});

test('chat: perintah rutinitas → kartu → Simpan → muncul di Tumbuh', async ({ page }) => {
  await page.goto('/chat');
  const input = page.getByRole('textbox').last();
  await input.fill('tambahin rutinitas siapin bekal jam 06:30 sen-jum');
  await input.press('Enter');
  await expect(page.getByText('Siapin bekal').first()).toBeVisible();
  await page.getByRole('button', { name: /^Simpan$/ }).last().click();
  await expect(page.getByText(/1 item ditambahkan/)).toBeVisible();
  await page.goto('/tumbuh');
  await expect(page.getByText('Siapin bekal').first()).toBeVisible();
});

test('timer fokus: mulai → selesai → siram pohon', async ({ page }) => {
  await page.goto('/tumbuh');
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('hamzi-demo-v1') ?? '{}').learning_modules[0].id as string);
  await page.goto(`/tumbuh/sesi?modul=${id}`);
  await expect(page.getByText('Fokus · 25 menit')).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-10-12T09:21:00Z')); // +13 menit
  await page.getByRole('button', { name: 'Selesai', exact: true }).click();
  await page.getByRole('button', { name: /Siram pohon/ }).click();
  await expect(page.getByText(/tetes air/).first()).toBeVisible();
});

test('mode sembunyikan nominal menyembunyikan angka di Beranda', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Rp 85.000').first()).toBeVisible();
  await page.getByRole('button', { name: 'Sembunyikan nominal' }).click();
  await expect(page.getByText('Rp 85.000')).toHaveCount(0);
  await expect(page.getByText('Rp •••••').first()).toBeVisible();
});
