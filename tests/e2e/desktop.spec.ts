// Desktop 1440×900: sidebar, pintasan keyboard, dialog catat (nominal diketik), panel chat.
import { test, expect } from './fixtures';

test('desktop: sidebar + pintasan E → dialog catat → simpan dengan Enter', async ({ page }) => {
  await page.goto('/keuangan');
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible();
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(300); // fokus otomatis ke input nominal
  await page.keyboard.type('25000');
  await expect(page.getByRole('dialog').getByText('Rp 25.000').or(page.getByRole('dialog').locator('input[value="25.000"]')).first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Sisa aman hari ini Rp 40\.000/)).toBeVisible();
});

test('desktop: tombol C membuka panel Chat Hamzi', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('c');
  await expect(page.getByRole('complementary', { name: 'Chat Hamzi' })).toBeVisible();
});
