// Sheet Proyek (PROJ-01) & Milestone (PROJ-02): buat/ubah/status/hapus (soft delete + Urungkan).
import { useState } from 'react';
import { z } from 'zod';
import { detectSensitive, SENSITIVE_MESSAGE } from '@common/sensitive.ts';
import { Button, Field, inputCls, Sheet, textareaCls } from '@/components/ui';
import { useRemove, useUpsert } from '@/data/hooks';
import type { Milestone, Project } from '@/data/types';
import { toast, toastUndo } from '@/stores/ui';
import { ChipGroup } from '@/features/tasks/components/FormBits';
import { KIND_LABEL, MS_STATUS_LABEL, STATUS_LABEL } from '../derive';

const KINDS = (Object.keys(KIND_LABEL) as Project['kind'][]).map((k) => ({ value: k, label: KIND_LABEL[k] }));
const STATUSES = (Object.keys(STATUS_LABEL) as Project['status'][]).map((k) => ({ value: k, label: STATUS_LABEL[k] }));
const MS_STATUSES = (Object.keys(MS_STATUS_LABEL) as Milestone['status'][]).map((k) => ({ value: k, label: MS_STATUS_LABEL[k] }));

const sensitive = (v: string, ctx: z.RefinementCtx, path: string) => {
  const k = detectSensitive(v)[0];
  if (k) ctx.addIssue({ code: 'custom', path: [path], message: SENSITIVE_MESSAGE[k] });
};

const projectSchema = z.object({
  name: z.string().trim().min(1, 'Nama proyek wajib diisi').max(120, 'Maksimal 120 karakter'),
  description: z.string().max(1000, 'Maksimal 1000 karakter'),
  due: z.string().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Tanggal tidak valid'),
}).superRefine((v, ctx) => { sensitive(v.name, ctx, 'name'); sensitive(v.description, ctx, 'description'); });

type Errors = Partial<Record<string, string>>;
const toErrors = (r: z.SafeParseReturnType<unknown, unknown>): Errors => {
  const e: Errors = {};
  if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] ??= i.message;
  return e;
};

export function ProjectFormSheet({ open, onClose, project, onSaved }: {
  open: boolean; onClose: () => void; project?: Project; onSaved?: (id: string) => void;
}) {
  const upsert = useUpsert('projects');
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [kind, setKind] = useState<Project['kind']>(project?.kind ?? 'kuliah');
  const [status, setStatus] = useState<Project['status']>(project?.status ?? 'aktif');
  const [due, setDue] = useState(project?.due_date ?? '');
  const [errors, setErrors] = useState<Errors>({});

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const errs = toErrors(projectSchema.safeParse({ name, description, due }));
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const [row] = await upsert.save({
      ...(project ? { id: project.id } : {}),
      name: name.trim(), description: description.trim() || null, kind, status: project ? status : 'aktif', due_date: due || null,
    });
    toast(project ? 'Proyek diperbarui' : 'Proyek dibuat');
    onClose();
    onSaved?.(row.id);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={project ? 'Ubah proyek' : 'Proyek baru'}
      closeButton
      footer={<Button size="lg" block type="submit" form="project-form" disabled={upsert.isPending}>Simpan</Button>}
    >
      <form id="project-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Nama proyek" htmlFor="pj-name" error={errors.name}>
          <input id="pj-name" data-autofocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Mis. Tugas Besar RPL" maxLength={120} aria-invalid={!!errors.name} />
        </Field>
        <ChipGroup label="Jenis" options={KINDS} value={kind} onChange={setKind} />
        <Field label="Tenggat (opsional)" htmlFor="pj-due" error={errors.due}>
          <div className="flex gap-2">
            <input id="pj-due" type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} />
            {due && <Button variant="secondary" onClick={() => setDue('')}>Hapus</Button>}
          </div>
        </Field>
        <Field label="Deskripsi (opsional)" htmlFor="pj-desc" error={errors.description}>
          <textarea id="pj-desc" className={textareaCls} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Tujuan, catatan singkat…" />
        </Field>
        {project && <ChipGroup label="Status" options={STATUSES} value={status} onChange={setStatus} hint="Proyek selesai tetap tersimpan di tab Proyek bagian bawah." />}
      </form>
    </Sheet>
  );
}

const msSchema = z.object({
  title: z.string().trim().min(1, 'Judul milestone wajib diisi').max(160, 'Maksimal 160 karakter'),
  due: z.string().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Tanggal tidak valid'),
}).superRefine((v, ctx) => sensitive(v.title, ctx, 'title'));

export function MilestoneSheet({ open, onClose, projectId, milestone, nextSort }: {
  open: boolean; onClose: () => void; projectId: string; milestone?: Milestone; nextSort: number;
}) {
  const upsert = useUpsert('milestones');
  const rm = useRemove('milestones');
  const [title, setTitle] = useState(milestone?.title ?? '');
  const [due, setDue] = useState(milestone?.due_date ?? '');
  const [status, setStatus] = useState<Milestone['status']>(milestone?.status ?? 'belum');
  const [errors, setErrors] = useState<Errors>({});

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const errs = toErrors(msSchema.safeParse({ title, due }));
    setErrors(errs);
    if (Object.keys(errs).length) return;
    await upsert.save({
      ...(milestone ? { id: milestone.id } : { project_id: projectId, sort: nextSort }),
      title: title.trim(), due_date: due || null, status,
    });
    toast(milestone ? 'Milestone diperbarui' : 'Milestone ditambahkan');
    onClose();
  };

  const del = async () => {
    if (!milestone) return;
    const id = milestone.id;
    onClose();
    await rm.remove(id);
    toastUndo('Milestone dihapus', () => void rm.undo(id));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={milestone ? 'Ubah milestone' : 'Milestone baru'}
      closeButton
      footer={
        <div className="flex flex-col gap-2">
          <Button size="lg" block type="submit" form="ms-form" disabled={upsert.isPending}>Simpan</Button>
          {milestone && <Button variant="danger-outline" block onClick={() => void del()}>Hapus milestone</Button>}
        </div>
      }
    >
      <form id="ms-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Judul" htmlFor="ms-title" error={errors.title}>
          <input id="ms-title" data-autofocus className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mis. Desain basis data & ERD" maxLength={160} aria-invalid={!!errors.title} />
        </Field>
        <Field label="Tenggat (opsional)" htmlFor="ms-due" error={errors.due}>
          <input id="ms-due" type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <ChipGroup label="Status" options={MS_STATUSES} value={status} onChange={setStatus} />
      </form>
    </Sheet>
  );
}
