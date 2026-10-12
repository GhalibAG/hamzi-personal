// npm run visual — memotret app pada kondisi yang sama dengan screenshot prototipe (docs/prototype/screens),
// membuat gambar berdampingan prototipe | app di tests/visual/out/compare-<nama>.png dan skor selisih piksel.
// Selisih > 5% = PERINGATAN untuk ditinjau manusia (bukan kegagalan otomatis), sesuai TECH-SPEC §13.
// Butuh dev server: `npm run dev` (atau BASE=http://localhost:4173 untuk `npm run preview`).
// Jam dibekukan ke Senin 12 Okt 2026 16:08 WIB; setiap shot memakai konteks baru (data demo segar).
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = 'tests/visual/out';
const PROTO = 'docs/prototype/screens';
const only = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });

const M = { w: 390, h: 844 };
const D = { w: 1440, h: 900 };

const moduleId = async (page) => page.evaluate(() => JSON.parse(localStorage.getItem('hamzi-demo-v1') ?? '{}').learning_modules?.[0]?.id ?? '');
const clickLabel = (re) => async (page) => { await page.getByRole('button', { name: re }).first().click(); await page.waitForTimeout(400); };
const press = (keys) => async (page) => { for (const k of keys) { await page.getByRole('button', { name: k, exact: true }).first().click(); } await page.waitForTimeout(200); };

const SHOTS = [
  { name: '01-beranda', path: '/', vp: M },
  { name: '02-beranda-bawah', path: '/', vp: M, act: async (p) => { await p.mouse.wheel(0, 2000); await p.waitForTimeout(500); } },
  { name: '03-beranda-menu-tambah', path: '/', vp: M, act: clickLabel(/^Tambah cepat$/) },
  { name: '04-rencana-hari-ini', path: '/rencana', vp: M },
  { name: '05-rencana-centang-toast', path: '/rencana', vp: M, act: clickLabel(/^Tandai selesai: Baca bab 3/) },
  { name: '06-rencana-proyek', path: '/rencana?tab=proyek', vp: M },
  { name: '07-kuliah-jadwal', path: '/kuliah', vp: M },
  { name: '08-kuliah-nilai-simulasi', path: '/kuliah?tab=nilai', vp: M },
  { name: '09-keuangan', path: '/keuangan', vp: M },
  { name: '10-keuangan-catat-cepat', path: '/keuangan?quick=expense', vp: M, act: press(['2', '5', '000']) },
  { name: '11-keuangan-tersimpan', path: '/keuangan?quick=expense', vp: M, act: async (p) => { await press(['2', '5', '000'])(p); await p.getByRole('button', { name: /^Simpan/ }).first().click(); await p.waitForTimeout(600); } },
  { name: '12-tumbuh-hari-ini', path: '/tumbuh', vp: M },
  { name: '13-tumbuh-semua-wajib-selesai', path: '/tumbuh', vp: M, act: async (p) => {
    for (const re of [/Catat pengeluaran hari ini/, /Tidur sebelum 23:00/]) {
      const b = p.getByRole('button', { name: re }).and(p.locator('[aria-pressed="false"]')).first();
      if (await b.count()) { await b.click(); await p.waitForTimeout(300); }
    }
    await p.waitForTimeout(500);
  } },
  { name: '14-tumbuh-kalender-kebun', path: '/tumbuh?tab=kalender', vp: M },
  { name: '15-tumbuh-pengingat-notifikasi', path: '/tumbuh?tab=pengingat', vp: M },
  { name: '16-tumbuh-tambah-modul', path: '/tumbuh', vp: M, act: clickLabel(/\+ Modul/) },
  { name: '17-tumbuh-timer-fokus', path: '/tumbuh', vp: M, act: async (p) => { const id = await moduleId(p); await p.goto(`${BASE}/tumbuh/sesi?modul=${id}`); await p.waitForTimeout(1200); } },
  { name: '18-chat-rps', path: '/chat', vp: M },
  { name: '19-chat-perintah-rutinitas', path: '/chat', vp: M, act: async (p) => { const i = p.getByRole('textbox').last(); await i.fill('tambahin rutinitas siapin bekal jam 06:30 sen-jum'); await i.press('Enter'); await p.waitForTimeout(1500); } },
  { name: '20-chat-tersimpan', path: '/chat', vp: M, act: async (p) => { const i = p.getByRole('textbox').last(); await i.fill('tambahin rutinitas siapin bekal jam 06:30 sen-jum'); await i.press('Enter'); await p.waitForTimeout(1500); await p.getByRole('button', { name: /^Simpan$/ }).last().click(); await p.waitForTimeout(800); } },
  { name: '21-maskot-8-mood', path: '/dev/maskot', vp: { w: 1120, h: 640 } },
  { name: 'd01-beranda-chat', path: '/', vp: D, act: async (p) => { await p.keyboard.press('c'); await p.waitForTimeout(1200); } },
  { name: 'd02-beranda', path: '/', vp: D },
  { name: 'd03-rencana', path: '/rencana', vp: D },
  { name: 'd04-kuliah', path: '/kuliah', vp: D },
  { name: 'd05-keuangan', path: '/keuangan', vp: D },
  { name: 'd06-keuangan-catat-dialog', path: '/keuangan?quick=expense', vp: D, act: async (p) => { await p.keyboard.type('25000'); await p.waitForTimeout(300); } },
  { name: 'd07-tumbuh', path: '/tumbuh', vp: D },
  { name: 'd08-tumbuh-timer', path: '/tumbuh', vp: D, act: async (p) => { const id = await moduleId(p); await p.goto(`${BASE}/tumbuh/sesi?modul=${id}`); await p.waitForTimeout(1200); } },
  { name: 'd09-beranda-1280-chat', path: '/', vp: { w: 1280, h: 800 }, act: async (p) => { await p.keyboard.press('c'); await p.waitForTimeout(1200); } },
];

function readPng(f) { return PNG.sync.read(readFileSync(f)); }

function compose(a, b) {
  const gap = 24;
  const out = new PNG({ width: a.width + b.width + gap, height: Math.max(a.height, b.height) });
  out.data.fill(255);
  PNG.bitblt(a, out, 0, 0, a.width, a.height, 0, 0);
  PNG.bitblt(b, out, 0, 0, b.width, b.height, a.width + gap, 0);
  return out;
}

function diffPct(a, b) {
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  const crop = (img) => { const c = new PNG({ width: w, height: h }); PNG.bitblt(img, c, 0, 0, w, h, 0, 0); return c; };
  const n = pixelmatch(crop(a).data, crop(b).data, null, w, h, { threshold: 0.2 });
  return (n / (w * h)) * 100;
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' });
const report = [];
for (const s of SHOTS) {
  if (only.length && !only.some((o) => s.name.startsWith(o))) continue;
  // Skala perangkat disamakan dengan screenshot prototipe (HP @2x, desktop @1,5x) agar perbandingan piksel adil.
  const protoPath = `${PROTO}/${s.name}.png`;
  const dsf = existsSync(protoPath) ? readPng(protoPath).width / s.vp.w : 2;
  const ctx = await browser.newContext({ viewport: { width: s.vp.w, height: s.vp.h }, deviceScaleFactor: dsf, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-10-12T09:08:00Z'));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    await page.goto(BASE + s.path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    if (s.act) await s.act(page);
    const appFile = `${OUT}/app-${s.name}.png`;
    await page.screenshot({ path: appFile });
    const protoFile = `${PROTO}/${s.name}.png`;
    let pct = null;
    if (existsSync(protoFile)) {
      const a = readPng(protoFile);
      const b = readPng(appFile);
      writeFileSync(`${OUT}/compare-${s.name}.png`, PNG.sync.write(compose(a, b)));
      pct = diffPct(a, b);
    }
    report.push({ name: s.name, diff: pct === null ? '–' : pct.toFixed(1) + '%', warn: pct !== null && pct > 5, errors: errors.length });
  } catch (e) {
    report.push({ name: s.name, diff: 'GAGAL', warn: true, errors: errors.length, err: String(e).split('\n')[0] });
  }
  await ctx.close();
}
await browser.close();
console.table(report);
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
const warn = report.filter((r) => r.warn).length;
console.log(`${report.length} layar dipotret; ${warn} perlu ditinjau (selisih > 5% atau gagal). Bandingkan tests/visual/out/compare-*.png.`);
