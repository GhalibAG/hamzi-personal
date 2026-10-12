// Komponen nilai (KUL-09, P1): nama, bobot %, skor (kosong = belum ada).
import { useId, useState } from 'react';
import { Button, Field, inputCls, Sheet } from '@/components/ui';
import { useRemove, useUpsert } from '@/data/hooks';
import { uuid } from '@/data/repo';
import type { GradeComponent } from '@/data/types';
import { toast, toastUndo } from '@/stores/ui';
import { componentFormSchema, fieldErrors, parseDecimal } from '../schema';

const num = (x: number | null | undefined) => (x === null || x === undefined ? '' : String(x).replace('.', ','));

export function GradeComponentSheet({ open, onClose, courseId, component, suggestedWeight }: {
  open: boolean; onClose: () => void; courseId: string; component?: GradeComponent; suggestedWeight?: number;
}) {
  const save = useUpsert('grade_components');
  const remove = useRemove('grade_components');
  const [name, setName] = useState(component?.name ?? '');
  const [weight, setWeight] = useState(component ? num(component.weight_pct) : suggestedWeight ? String(suggestedWeight) : '');
  const [score, setScore] = useState(num(component?.score));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formId = useId();

  const submit = async () => {
    const parsed = componentFormSchema.safeParse({ name, weight_pct: parseDecimal(weight || 'x'), score: score.trim() ? parseDecimal(score) : null });
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    setErrors({});
    try {
      await save.save({ ...(component ?? {}), id: component?.id ?? uuid(), course_id: courseId, ...parsed.data });
      toast(component ? 'Komponen nilai diperbarui' : 'Komponen nilai ditambahkan');
      onClose();
    } catch {
      toast('Gagal menyimpan. Coba lagi ya.');
    }
  };

  const del = async () => {
    if (!component) return;
    const snap = component;
    await remove.remove(snap.id);
    onClose();
    toastUndo(`Komponen ${snap.name} dihapus`, () => void save.save(snap));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={component ? 'Ubah komponen nilai' : 'Komponen nilai baru'}
      closeButton
      footer={
        <div className="flex flex-col gap-2">
          <Button type="submit" form={formId} size="lg" block>Simpan</Button>
          {component && <Button variant="danger-outline" block onClick={() => void del()}>Hapus komponen</Button>}
        </div>
      }
    >
      <form id={formId} className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Nama komponen" htmlFor="gc-name" error={errors.name}>
          <input id="gc-name" data-autofocus className={inputCls} value={name} maxLength={40} placeholder="Tugas, UTS, UAS, Kuis…" onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bobot (%)" htmlFor="gc-w" error={errors.weight_pct}>
            <input id="gc-w" inputMode="decimal" className={inputCls} value={weight} placeholder="30" onChange={(e) => setWeight(e.target.value)} />
          </Field>
          <Field label="Skor (0–100)" htmlFor="gc-s" error={errors.score} hint="Kosongkan bila belum keluar">
            <input id="gc-s" inputMode="decimal" className={inputCls} value={score} placeholder="–" onChange={(e) => setScore(e.target.value)} />
          </Field>
        </div>
      </form>
    </Sheet>
  );
}
