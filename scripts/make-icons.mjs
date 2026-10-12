// Membuat ikon PWA dari maskot Hamzi (kepala di lingkaran --brand-700). Jalankan: node scripts/make-icons.mjs
// Butuh Playwright (devDependency). Hasil di public/icons/.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const EYE = 'M16.6 6.4 C14.6 4.1 9.4 4.5 9.3 8.4 C9.2 11.8 12.9 12.7 16.3 12 Q12.4 15.6 7.6 18.9';
const head = (ink = '#054F31', fur = '#FFF4E0', ear = '#FDA29B', shade = '#F2E0BD', nose = '#F97066', scarf = '#12B76A') => `
  <path d="M40 72 C30 42 34 20 47 22 C60 24 74 38 84 48 Z" fill="${fur}"/>
  <path d="M49 60 C44 45 46 33 52 34 C59 36 66 43 72 50 Z" fill="${ear}"/>
  <g transform="translate(200 0) scale(-1 1)"><path d="M40 72 C30 42 34 20 47 22 C60 24 74 38 84 48 Z" fill="${fur}"/><path d="M49 60 C44 45 46 33 52 34 C59 36 66 43 72 50 Z" fill="${ear}"/></g>
  <ellipse cx="100" cy="96" rx="72" ry="60" fill="${fur}"/>
  <path d="M92 40 Q100 52 108 40 M80 44 Q84 52 88 46 M112 46 Q116 52 120 44" fill="none" stroke="${shade}" stroke-width="5" stroke-linecap="round"/>
  <path d="M50 146 Q100 166 150 146 L148 160 Q100 180 52 160 Z" fill="${scarf}"/>
  <circle cx="56" cy="114" r="11" fill="${ear}" opacity="0.42"/><circle cx="144" cy="114" r="11" fill="${ear}" opacity="0.42"/>
  <g transform="translate(72 90)"><g transform="rotate(0) scale(1.5 1.5) translate(-12 -12)"><path d="${EYE}" fill="none" stroke="${ink}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/></g></g>
  <g transform="translate(128 90)"><g transform="rotate(0) scale(1.5 1.5) translate(-12 -12)"><path d="${EYE}" fill="none" stroke="${ink}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/></g></g>
  <path d="M95 106 L105 106 L100 112 Z" fill="${nose}" stroke="${nose}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M90 116 Q95 121 100 116 Q105 121 110 116" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`;

const icon = (size, { maskable = false, bg = '#027A48' } = {}) => {
  const scale = maskable ? 0.52 : 0.66;
  const s = (size * scale) / 160;
  const tx = size / 2 - 100 * s;
  const ty = size / 2 - 96 * s + size * 0.02;
  const circle = maskable ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${bg}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${circle}<g transform="translate(${tx} ${ty}) scale(${s})">${head()}</g></svg>`;
};
const badge = (size) => {
  const s = (size * 0.86) / 160;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g transform="translate(${size / 2 - 100 * s} ${size / 2 - 92 * s}) scale(${s})">
  <path d="M40 72 C30 42 34 20 47 22 C60 24 74 38 84 48 Z" fill="#fff"/><g transform="translate(200 0) scale(-1 1)"><path d="M40 72 C30 42 34 20 47 22 C60 24 74 38 84 48 Z" fill="#fff"/></g>
  <ellipse cx="100" cy="96" rx="72" ry="60" fill="#fff"/></g></svg>`;
};
const shortcut = (size, color, path) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="${color}"/><g transform="translate(5 5) scale(0.583)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${path}</g></svg>`;

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/favicon.svg', icon(64));
const jobs = [
  ['icon-192.png', icon(192)], ['icon-512.png', icon(512)], ['maskable-512.png', icon(512, { maskable: true })],
  ['apple-touch-180.png', icon(180, { maskable: true })], ['badge-72.png', badge(72)],
  ['sc-expense.png', shortcut(96, '#039855', '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>')],
  ['sc-task.png', shortcut(96, '#1570EF', '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12l2.5 2.5 4.5-5"/>')],
  ['sc-timer.png', shortcut(96, '#088AB2', '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>')],
  ['sc-chat.png', shortcut(96, '#027A48', '<path d="M12 2l1.8 5.6L19.5 9.5 13.8 11.4 12 17l-1.8-5.6L4.5 9.5l5.7-1.9z"/>')],
];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const page = await browser.newPage();
for (const [name, svg] of jobs) {
  const size = Number(svg.match(/width="(\d+)"/)[1]);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
console.log('ikon dibuat:', jobs.map((j) => j[0]).join(', '));
