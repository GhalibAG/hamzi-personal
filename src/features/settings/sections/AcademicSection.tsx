// Pengaturan > Akademik (SET-01, SET-02): skala nilai (bobot & rentang angka), total SKS kurikulum, target IPK.
import { useState, type FormEvent } from 'react';
import { decimalId } from '@common/format.ts';
import { Button, Field, inputCls } from '@/components/ui';
import { DEFAULT_SETTINGS } from '@/data';
import { useSettings, useUpdateSettings } from '@/data/hooks';
import { cx } from '@/lib/cx';
import { toast } from '@/stores/ui';
import { CardBody, SettingsCard } from '../components/rows';

interface GradeDraft { letter: string; points: string; min: string }

const num = (s: string) => Number(s.trim().replace(',', '.'));
const fmt = (n: number) => decimalId(n, Number.isInteger(n * 10) ? 1 : 2);

function toDraft(scale: Record<string, number>, ranges: [string, number][]): GradeDraft[] {
  return ranges.map(([letter, min]) => ({ letter, points: fmt(scale[letter] ?? 0), min: String(min) }));
}

/** Validasi skala: bobot 0–4, nilai minimal 0–100 bilangan bulat, urut menurun, huruf terakhir mulai dari 0. */
function validateScale(rows: GradeDraft[]): string | null {
  for (const r of rows) {
    const p = num(r.points);
    if (!r.points.trim() || Number.isNaN(p) || p < 0 || p > 4) return `Bobot ${r.letter} harus 0–4.`;
    const m = Number(r.min);
    if (!/^\d{1,3}$/.test(r.min.trim()) || m > 100) return `Nilai minimal ${r.letter} harus 0–100.`;
  }
  for (let i = 1; i < rows.length; i++) {
    if (Number(rows[i].min) >= Number(rows[i - 1].min)) return `Nilai minimal ${rows[i].letter} harus lebih kecil dari ${rows[i - 1].letter}.`;
    if (num(rows[i].points) > num(rows[i - 1].points)) return `Bobot ${rows[i].letter} tidak boleh lebih besar dari ${rows[i - 1].letter}.`;
  }
  if (rows.length && Number(rows[rows.length - 1].min) !== 0) return `Nilai minimal ${rows[rows.length - 1].letter} harus 0.`;
  return null;
}

function GradeScaleEditor() {
  const s = useSettings();
  const upd = useUpdateSettings();
  const [draft, setDraft] = useState<GradeDraft[] | null>(null);
  const rows = draft ?? toDraft(s.grade_scale, s.grade_ranges);
  const error = draft ? validateScale(rows) : null;
  const edit = (i: number, k: 'points' | 'min', v: string) => setDraft(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const save = () => {
    if (!draft || error) return;
    upd.mutate(
      { grade_scale: Object.fromEntries(rows.map((r) => [r.letter, num(r.points)])), grade_ranges: rows.map((r) => [r.letter, Number(r.min)] as [string, number]) },
      { onSuccess: () => { setDraft(null); toast('Skala nilai tersimpan.'); }, onError: () => toast('Skala belum tersimpan. Coba lagi.') },
    );
  };
  const reset = () => setDraft(toDraft(DEFAULT_SETTINGS.grade_scale, DEFAULT_SETTINGS.grade_ranges));
  return (
    <SettingsCard title="Skala nilai" desc="Bobot dipakai menghitung IPS/IPK; nilai minimal dipakai mengubah angka komponen menjadi huruf.">
      <CardBody>
        <table className="w-full border-collapse text-body">
          <caption className="sr-only">Skala nilai: huruf, bobot, nilai angka minimal</caption>
          <thead>
            <tr className="text-left text-meta text-ink-3">
              <th scope="col" className="pb-1.5 font-semibold">Huruf</th>
              <th scope="col" className="pb-1.5 font-semibold">Bobot</th>
              <th scope="col" className="pb-1.5 font-semibold">Nilai minimal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.letter}>
                <th scope="row" className="w-16 py-1 text-left font-extrabold">{r.letter}</th>
                <td className="py-1 pr-2">
                  <input aria-label={`Bobot ${r.letter}`} inputMode="decimal" className={cx(inputCls, 'h-11 tabular')} value={r.points} onChange={(e) => edit(i, 'points', e.target.value)} />
                </td>
                <td className="py-1">
                  <input aria-label={`Nilai minimal ${r.letter}`} inputMode="numeric" className={cx(inputCls, 'h-11 tabular')} value={r.min} onChange={(e) => edit(i, 'min', e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && <span role="alert" className="text-meta font-semibold text-danger-fg">{error}</span>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={save} disabled={!draft || !!error || upd.isPending}>Simpan skala</Button>
          <Button size="sm" variant="secondary" onClick={reset}>Kembalikan bawaan</Button>
          {draft && <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Batal</Button>}
        </div>
      </CardBody>
    </SettingsCard>
  );
}

function TargetsForm() {
  const s = useSettings();
  const upd = useUpdateSettings();
  const [credits, setCredits] = useState<string | null>(null);
  const [gpa, setGpa] = useState<string | null>(null);
  const cVal = credits ?? String(s.curriculum_credits);
  const gVal = gpa ?? (s.target_gpa === null ? '' : decimalId(s.target_gpa, 2));
  const cNum = Number(cVal);
  const cErr = !/^\d{1,3}$/.test(cVal.trim()) || cNum < 1 || cNum > 300 ? 'Isi 1–300 SKS.' : undefined;
  const gNum = gVal.trim() === '' ? null : num(gVal);
  const gErr = gNum !== null && (Number.isNaN(gNum) || gNum < 0 || gNum > 4) ? 'Target IPK harus 0,00–4,00.' : undefined;
  const dirty = credits !== null || gpa !== null;
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (cErr || gErr || !dirty) return;
    upd.mutate(
      { curriculum_credits: cNum, target_gpa: gNum === null ? null : Math.round(gNum * 100) / 100 },
      { onSuccess: () => { setCredits(null); setGpa(null); toast('Tersimpan.'); }, onError: () => toast('Belum tersimpan. Coba lagi.') },
    );
  };
  return (
    <SettingsCard title="Kurikulum & target">
      <CardBody>
        <form onSubmit={save} noValidate className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total SKS kurikulum" htmlFor="ak-sks" error={credits !== null ? cErr : undefined}>
              <input id="ak-sks" inputMode="numeric" className={cx(inputCls, 'tabular')} value={cVal} onChange={(e) => setCredits(e.target.value)} />
            </Field>
            <Field label="Target IPK" htmlFor="ak-gpa" hint="Kosongkan bila belum ada" error={gpa !== null ? gErr : undefined}>
              <input id="ak-gpa" inputMode="decimal" placeholder="mis. 3,50" className={cx(inputCls, 'tabular')} value={gVal} onChange={(e) => setGpa(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" size="sm" className="self-start" disabled={!dirty || !!cErr || !!gErr || upd.isPending}>Simpan</Button>
        </form>
      </CardBody>
    </SettingsCard>
  );
}

export function AcademicSection() {
  return (
    <>
      <TargetsForm />
      <GradeScaleEditor />
    </>
  );
}
