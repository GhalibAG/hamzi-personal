// Screenshot cepat satu rute. Contoh:
//   node tests/visual/shoot.mjs / out/home.png            (HP 390×844)
//   node tests/visual/shoot.mjs /keuangan out/k.png --desktop   (1440×900)
//   opsi: --w=1280 --h=800 --full --click="teks tombol" --wait=800 --base=http://localhost:5173
// Jam dibekukan ke Senin 12 Okt 2026 16:08 WIB (sama dengan prototipe) kecuali --realtime.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const path = pos[0] ?? '/';
const out = pos[1] ?? 'tests/visual/out/shot.png';
const desktop = !!opt.desktop;
const w = Number(opt.w ?? (desktop ? 1440 : 390));
const h = Number(opt.h ?? (desktop ? 900 : 844));
const base = opt.base ?? process.env.BASE ?? 'http://localhost:5173';

const execPath = process.env.PW_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch(execPath ? { executablePath: execPath } : {});
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
const page = await ctx.newPage();
if (!opt.realtime) await page.clock.setFixedTime(new Date('2026-10-12T09:08:00Z'));
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base + path, { waitUntil: 'networkidle' });
await page.waitForTimeout(Number(opt.wait ?? 600));
for (const c of [].concat(opt.click ?? [])) {
  await page.getByText(String(c), { exact: false }).first().click();
  await page.waitForTimeout(500);
}
mkdirSync(dirname(out), { recursive: true });
await page.screenshot({ path: out, fullPage: !!opt.full });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
console.log('saved', out);
await browser.close();
