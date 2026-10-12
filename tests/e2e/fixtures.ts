import { test as base, expect } from '@playwright/test';

/** Jam dibekukan Senin 12 Okt 2026 16:08 WIB (sama dengan prototipe & data demo). */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.clock.setFixedTime(new Date('2026-10-12T09:08:00Z'));
    await provide(page);
  },
});
export { expect };
